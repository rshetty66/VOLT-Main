"""HTTP API the VOLT Console calls (spec.md section 1). Runs as a Render private service.

Every call needs `Authorization: Bearer <VOLT_LEDGER_TOKEN>`. Amounts cross the wire as integer strings of minor
units. Every tool route answers with the same envelope (phase4-llm-layer.md 2.1):
{"status": "ok" | "refused" | "not_found", "evidence_id": ..., "data": ..., "display": ..., "warnings": [...]}

Routes under /v1/tools/ are the ones the model may reach through the console. Routes under /v1/people/ need a
signed-in person, whose id the console passes in the X-Volt-User header; the console never offers them to the model.
"""
from __future__ import annotations

import base64
import hmac
import json
import os
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from .allocation import AllocationError, AllocationRule, propose_allocation_rule, run_allocation
from .coa import (CoaError, check_design, coverage as coa_coverage, design_status, diagnose_coa, export as coa_export,
                  posting_accounts, propose_design, propose_mapping)
from .drivers import DriverError, record_driver_value
from .evidence import write_evidence
from . import fim
from .fim import FimError
from .ingest import ColumnMap, IngestError, ingest_trial_balance
from .mapping import (MappingError, client_visible, coverage, flag_policy_gap, get_ontology_context,
                      map_line_item_to_element, record_review_decision, tb_accounts)
from .money import AmountError, format_amount, from_wire, to_wire
from .ontology import load_ontology
from .posting import JournalIn, LineIn, PostingError, post_journal_entry, reverse_journal_entry
from .reporting import (ReportingError, build_statement, check_output, compute_ratio, display_ratio, get_balances,
                        load_metrics)
from .pack import PackError, data_requirements, load_pack, pack_info, register_csv, run_exam
from .store import Store

WIRE_AMOUNT = r"^[0-9]+$"


class IngestBody(BaseModel):
    filename: str = Field(pattern=r"^[A-Za-z0-9._ -]+\.(csv|xlsx)$")
    content_base64: str
    client: str
    period: str
    currency: str = "USD"
    dimensions: dict[str, str] = {}


class ContextBody(BaseModel):
    query: str | None = None
    element_id: str | None = None


class MapBody(BaseModel):
    account_id: str
    concept_id: str
    confidence: float = Field(ge=0, le=1)
    rationale: str = Field(max_length=600)
    uncertainty: list[str] = []
    source_refs: list[str] = []
    first_client_run: bool = True


class MapManyBody(BaseModel):
    items: list[MapBody] = Field(min_length=1, max_length=500)


class GapBody(BaseModel):
    element_ids: list[str] = Field(min_length=1)
    gap_type: str
    decision_needed: str
    standard_refs: list[str] = []
    rationale: str
    confidence: float = Field(ge=0, le=1)


class LineBody(BaseModel):
    account_id: str
    side: Literal["debit", "credit"]
    amount_minor: str = Field(pattern=WIRE_AMOUNT)
    currency: str = "USD"
    dimensions: dict[str, str] = {}


class JournalBody(BaseModel):
    idempotency_key: str
    period: str
    kind: Literal["adjustment", "reclass", "gaap_adjustment"]
    description: str
    lines: list[LineBody] = Field(min_length=2)
    gaap: Literal["base", "ifrs", "us-gaap"] = "base"
    source_refs: list[str] = []


class ReverseBody(BaseModel):
    journal_id: str
    period: str
    reason: str
    idempotency_key: str


class CoverageBody(BaseModel):
    doc_id: str


PERIOD = r"^[0-9]{4}-(0[1-9]|1[0-2])$"


class BalancesBody(BaseModel):
    period: str = Field(pattern=PERIOD)
    element_ids: list[str] = Field(min_length=1, max_length=60)
    dimensions: dict[str, str] = {}
    include_proposals: bool = False


class StatementBody(BaseModel):
    period: str = Field(pattern=PERIOD)
    gaap: Literal["ifrs", "us-gaap"] = "ifrs"
    statement: Literal["BS", "IS"]
    dimensions: dict[str, str] = {}
    include_proposals: bool = False


class RatioBody(BaseModel):
    metric_id: str
    period: str = Field(pattern=PERIOD)
    dimensions: dict[str, str] = {}
    include_proposals: bool = False


class RuleBody(BaseModel):
    pool_accounts: list[str] = Field(min_length=1)
    pool_filter: dict[str, str] = {}
    basis: Literal["fte", "transaction_count", "rwa"]
    target_dimension: str
    targets: list[str] = Field(min_length=1)
    rationale: str


class RunAllocationBody(BaseModel):
    rule_id: str
    period: str = Field(pattern=PERIOD)
    idempotency_key: str = Field(min_length=1, max_length=200)


class CheckBody(BaseModel):
    text: str = Field(max_length=400_000)
    evidence_ids: list[str] = []


class DriverBody(BaseModel):
    kind: Literal["plan", "driver", "reg", "market"] = "driver"
    key: str
    period: str = Field(pattern=PERIOD)
    dimensions: dict[str, str] = {}
    value: str = Field(pattern=r"^-?[0-9]+(\.[0-9]+)?$")
    unit: str
    note: str = ""


class DiagnoseBody(BaseModel):
    doc_id: str


class DesignBody(BaseModel):
    design: dict
    design_id: str | None = None


class CoaMappingBody(BaseModel):
    design_id: str
    doc_id: str
    rules: list[dict] = Field(min_length=1)


class DesignIdBody(BaseModel):
    design_id: str


class FimLoadBody(BaseModel):
    name: str = "synthetic"


class TraceBody(BaseModel):
    account: str
    filters: dict[str, str] = {}
    ledger: str = "IFRS"


class InstrumentBody(BaseModel):
    instrument_id: str


class AdjLine(BaseModel):
    account: str
    instrument_id: str | None = None
    segments: dict[str, str] = {}
    debit: str | None = None
    credit: str | None = None


class AdjustmentBody(BaseModel):
    level: Literal["instrument", "gl"]
    period: str
    reason_code: str
    rationale: str
    lines: list[AdjLine] = Field(min_length=2, max_length=50)


class ReverseAdjBody(BaseModel):
    adj_id: str
    rationale: str


class RegisterBody(BaseModel):
    design_id: str | None = None


class ExamBody(BaseModel):
    doc_id: str | None = None
    design_id: str | None = None


class DecisionBody(BaseModel):
    item_id: str
    stage: Literal["engagement_lead", "client"]
    decision: Literal["approve", "reject", "amend"]
    note: str = ""



def _token() -> str:
    t = os.environ.get("VOLT_LEDGER_TOKEN", "")
    if not t and os.environ.get("VOLT_LEDGER_DEV") != "1":
        raise RuntimeError("VOLT_LEDGER_TOKEN is not set (set VOLT_LEDGER_DEV=1 for local development only)")
    return t


def create_app(db_path: str | None = None) -> FastAPI:
    token = _token()
    path = db_path or os.environ.get("VOLT_LEDGER_DB", str(Path(__file__).resolve().parent.parent / "data" / "ledger.db"))
    store = Store(path, check_same_thread=False)
    load_ontology(store)
    lock = threading.Lock()
    app = FastAPI(title="volt-ledger", version="0.1.0")

    def auth(authorization: str = Header(default="")) -> None:
        if token and not hmac.compare_digest(authorization, f"Bearer {token}"):
            raise HTTPException(401, "missing or wrong ledger token")

    @contextmanager
    def locked():
        with lock:
            yield store

    def ok(evidence_id: str | None, data: Any, display: dict | None = None, warnings: list[str] | None = None) -> dict:
        return {"status": "ok", "evidence_id": evidence_id, "data": data, "display": display or {}, "warnings": warnings or []}

    def refused(code: str, message: str) -> dict:
        return {"status": "refused", "evidence_id": None, "data": {"code": code, "message": message}, "display": {},
                "warnings": []}

    @app.get("/healthz")
    def healthz() -> dict:
        return {"ok": True}

    # ---- tools the model may reach through the console ---------------------------------------------------------


    @app.post("/v1/ingest/trial_balance", dependencies=[Depends(auth)])
    def ingest(body: IngestBody) -> dict:
        """Called by the console when a person uploads a file, not by the model."""
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / body.filename
            f.write_bytes(base64.b64decode(body.content_base64, validate=True))
            try:
                with locked() as s:
                    r = ingest_trial_balance(s, f, body.client, body.period, body.currency,
                                             ColumnMap(dimensions=body.dimensions), actor="console")
            except (IngestError, AmountError) as e:
                return refused("ingest", str(e))
        data = {"doc_id": r.doc_id, "created": r.created, "data_rows": r.data_rows, "stored": r.stored,
                "rejected": [{"row": x.row_number, "reason": x.reason} for x in r.rejected],
                "total_debit": to_wire(r.total_debit), "total_credit": to_wire(r.total_credit), "balanced": r.balanced}
        display = {"data_rows": str(r.data_rows), "stored": str(r.stored), "rejected": str(len(r.rejected)),
                   "total_debit": f"{format_amount(r.total_debit, body.currency)} {body.currency}",
                   "total_credit": f"{format_amount(r.total_credit, body.currency)} {body.currency}"}
        return ok(r.evidence_id, data, display)


    @app.post("/v1/tools/get_ontology_context", dependencies=[Depends(auth)])
    def ontology_context(body: ContextBody) -> dict:
        with locked() as s:
            ctx = get_ontology_context(s, body.query, body.element_id)
        if ctx["status"] == "not_found":
            return {**refused("not_found", f"{body.element_id} does not exist"), "status": "not_found"}
        return ok(None, ctx)


    @app.post("/v1/tools/map_line_item", dependencies=[Depends(auth)])
    def map_line_item(body: MapBody) -> dict:
        try:
            with locked() as s:
                out = map_line_item_to_element(s, body.account_id, body.concept_id, str(body.confidence),
                                               body.rationale, "model", body.source_refs, body.first_client_run)
        except MappingError as e:
            return refused(e.code, str(e))
        return ok(out.evidence_id, {"association_id": out.association_id, "review_item_id": out.review_item_id})


    @app.post("/v1/tools/map_line_items", dependencies=[Depends(auth)])
    def map_line_items(body: MapManyBody) -> dict:
        """The whole chart in one call: each item is mapped (with its own evidence) or refused, never silently dropped."""
        results = []
        with locked() as s:
            for m in body.items:
                try:
                    out = map_line_item_to_element(s, m.account_id, m.concept_id, str(m.confidence), m.rationale,
                                                   "model", m.source_refs, m.first_client_run)
                    results.append({"account_id": m.account_id, "status": "mapped", "evidence_id": out.evidence_id,
                                    "association_id": out.association_id, "review_item_id": out.review_item_id})
                except MappingError as e:
                    results.append({"account_id": m.account_id, "status": "refused", "code": e.code, "message": str(e)})
        bad = [r for r in results if r["status"] == "refused"]
        return ok(None, {"mapped": len(results) - len(bad), "refused": len(bad), "results": results},
                  warnings=[f"{r['account_id']}: {r['message']}" for r in bad])

    @app.post("/v1/tools/flag_policy_gap", dependencies=[Depends(auth)])
    def gap(body: GapBody) -> dict:
        try:
            with locked() as s:
                out = flag_policy_gap(s, body.element_ids, body.gap_type, body.decision_needed, body.standard_refs,
                                      body.rationale, str(body.confidence), "model")
        except MappingError as e:
            return refused(e.code, str(e))
        return ok(out.evidence_id, {"gap_id": out.gap_id, "review_item_id": out.review_item_id},
                  warnings=["standard references are stored as [UNVERIFIED]"] if body.standard_refs else [])



    @app.post("/v1/tools/propose_journal", dependencies=[Depends(auth)])
    def propose_journal(body: JournalBody) -> dict:
        lines = [LineIn(l.account_id, debit=from_wire(l.amount_minor) if l.side == "debit" else 0,
                        credit=from_wire(l.amount_minor) if l.side == "credit" else 0, currency=l.currency,
                        dimensions=l.dimensions) for l in body.lines]
        j = JournalIn(body.idempotency_key, body.period, body.kind, body.description, lines, body.gaap,
                      [{"cite": c} for c in body.source_refs])
        try:
            with locked() as s:
                out = post_journal_entry(s, j, "model")
        except PostingError as e:
            return refused(e.code, str(e))
        total = sum(l.debit for l in lines)
        cur = lines[0].currency
        data = {"journal_id": out.journal_id, "created": out.created, "total": to_wire(total), "journal_evidence_id": out.evidence_id}
        display = {"total": f"{format_amount(total, cur)} {cur}"}
        with locked() as s:
            ev = recorded(s, "propose_journal", {"idempotency_key": body.idempotency_key, "period": body.period}, data, display)
        return ok(ev, data, display)


    @app.post("/v1/tools/reverse_journal", dependencies=[Depends(auth)])
    def reverse(body: ReverseBody) -> dict:
        try:
            with locked() as s:
                out = reverse_journal_entry(s, body.journal_id, body.period, body.reason, body.idempotency_key, "model")
        except PostingError as e:
            return refused(e.code, str(e))
        return ok(out.evidence_id, {"journal_id": out.journal_id, "created": out.created})


    @app.post("/v1/tools/list_accounts", dependencies=[Depends(auth)])
    def accounts(body: CoverageBody) -> dict:
        with locked() as s:
            rows = tb_accounts(s, body.doc_id)
        if not rows:
            return {**refused("not_found", f"no trial balance {body.doc_id}"), "status": "not_found"}
        return ok(None, rows)

    @app.post("/v1/tools/coverage", dependencies=[Depends(auth)])
    def cover(body: CoverageBody) -> dict:
        with locked() as s:
            c = coverage(s, body.doc_id)
        return ok(None, c, {k: str(v) for k, v in c.items() if k != "unaccounted"} | {"unaccounted": str(len(c["unaccounted"]))})

    def currency_for(s, period: str) -> str:
        r = s.conn.execute("SELECT currency FROM tb_row WHERE period = ? LIMIT 1", (period,)).fetchone()
        return r[0] if r else "USD"

    def money(n: int, cur: str) -> str:
        return f"{format_amount(n, cur)} {cur}"

    def recorded(s, tool: str, inputs: dict, data: dict, display: dict) -> str:
        """Read tools write evidence too, so every figure the model quotes traces to a stored computation."""
        with s.transaction() as cur:
            return write_evidence(cur, tool, inputs, {"data": data, "display": display}, [{"period": inputs.get("period")}],
                                  "model").evidence_id

    @app.post("/v1/tools/get_balances", dependencies=[Depends(auth)])
    def balances(body: BalancesBody) -> dict:
        try:
            with locked() as s:
                b = get_balances(s, body.period, body.element_ids, body.dimensions, body.include_proposals)
                cur = currency_for(s, body.period)
                data = {**b, "balances": {k: {"signed_minor": to_wire(abs(v["signed"])), "signed_side":
                                              "debit" if v["signed"] >= 0 else "credit", "natural_minor": to_wire(abs(v["natural"])),
                                              "natural_negative": v["natural"] < 0} for k, v in b["balances"].items()}}
                display = {k: money(v["natural"], cur) for k, v in b["balances"].items()}
                ev = recorded(s, "get_balances", body.model_dump(), data, display)
        except ReportingError as e:
            return refused(e.code, f"{e}: {', '.join(map(str, e.details))}")
        return ok(ev, data, display, [] if not b["accounts_pending_review"] else
                  [f"{b['accounts_pending_review']} accounts have mappings awaiting review: figures are draft"])

    @app.post("/v1/tools/build_statement", dependencies=[Depends(auth)])
    def statement(body: StatementBody) -> dict:
        try:
            with locked() as s:
                st = build_statement(s, body.period, body.gaap, body.statement, body.dimensions, body.include_proposals)
                cur = currency_for(s, body.period)
                display = {l["label"]: money(l["amount"], cur) for l in st["lines"]}
                display |= {f"check: {k}": (money(v, cur) if isinstance(v, int) and not isinstance(v, bool) else str(v))
                            for k, v in st["checks"].items()}
                data = {**st, "lines": [{**l, "amount": to_wire(abs(l["amount"])), "negative": l["amount"] < 0} for l in st["lines"]],
                        "excluded": [{**x, "signed": to_wire(abs(x["signed"]))} for x in st["excluded"]],
                        "flagged": [{**x, "signed": to_wire(abs(x["signed"]))} for x in st["flagged"]],
                        "checks": {k: (to_wire(abs(v)) if isinstance(v, int) and not isinstance(v, bool) else v)
                                   for k, v in st["checks"].items()}}
                ev = recorded(s, "build_statement", body.model_dump(), data, display)
        except ReportingError as e:
            return refused(e.code, str(e))
        warnings = []
        if st["excluded"]:
            warnings.append(f"{len(st['excluded'])} accounts are unmapped and not on the statement")
        if st["flagged"]:
            warnings.append(f"{len(st['flagged'])} accounts carry open policy gaps")
        if st["accounts_pending_review"]:
            warnings.append(f"{len(st['accounts_pending_review'])} mappings await engagement-lead review: this is a draft")
        return ok(ev, data, display, warnings)

    @app.post("/v1/tools/list_metrics", dependencies=[Depends(auth)])
    def metrics() -> dict:
        return ok(None, [{k: m[k] for k in ("metric_id", "label", "formula", "unit", "audiences")} | 
                         ({"needs_dimension": m["needs_dimension"]} if "needs_dimension" in m else {})
                         for m in load_metrics().values()])

    @app.post("/v1/tools/compute_ratio", dependencies=[Depends(auth)])
    def ratio(body: RatioBody) -> dict:
        try:
            with locked() as s:
                r = compute_ratio(s, body.metric_id, body.period, body.dimensions, body.include_proposals)
                display = display_ratio(r, currency_for(s, body.period))
                ev = recorded(s, "compute_ratio", body.model_dump(), r, display)
        except ReportingError as e:
            return refused(e.code, str(e))
        out = ok(ev, r, display, ["figures are draft: some mappings await review"] if r.get("draft") else [])
        if r["status"] != "ok":
            out["status"] = r["status"]
        return out

    @app.post("/v1/tools/propose_allocation_rule", dependencies=[Depends(auth)])
    def propose_rule(body: RuleBody) -> dict:
        rule = AllocationRule(body.pool_accounts, body.pool_filter, body.basis, body.target_dimension, body.targets)
        try:
            with locked() as s:
                rule_id, item, ev = propose_allocation_rule(s, rule, body.rationale, "model")
        except AllocationError as e:
            return refused(e.code, f"{e} {', '.join(map(str, e.details))}".strip())
        return ok(ev, {"rule_id": rule_id, "review_item_id": item},
                  warnings=["the engagement lead must approve this rule before it can run"])

    @app.post("/v1/tools/run_allocation", dependencies=[Depends(auth)])
    def run_alloc(body: RunAllocationBody) -> dict:
        try:
            with locked() as s:
                r = run_allocation(s, body.rule_id, body.period, body.idempotency_key, "model")
        except (AllocationError, PostingError) as e:
            details = getattr(e, "details", [])
            return refused(e.code, f"{e} {', '.join(map(str, details))}".strip())
        data = {"rule_id": r.rule_id, "period": r.period, "journal_id": r.journal_id, "created": r.created,
                "pool": to_wire(abs(r.pool)), "pool_side": "debit" if r.pool >= 0 else "credit",
                "drivers": r.drivers, "shares": {t: to_wire(abs(v)) for t, v in r.shares.items()}}
        display = {"pool": money(r.pool, r.currency)} | {f"share {t}": money(v, r.currency) for t, v in r.shares.items()}
        display |= {f"driver {t}": d["value"] for t, d in r.drivers.items()}
        data["journal_evidence_id"] = r.evidence_id
        with locked() as s:
            ev = recorded(s, "run_allocation", body.model_dump(), data, display)
        return ok(ev, data, display, ["this is a proposed allocation journal, not posted to the client's GL"])

    # ---- chart-of-accounts design (the primary output) ------------------------------------------------------------

    def coa_refused(e: CoaError) -> dict:
        r = refused(e.code, str(e))
        r["data"]["details"] = e.details
        return r

    @app.post("/v1/tools/diagnose_coa", dependencies=[Depends(auth)])
    def diagnose(body: DiagnoseBody) -> dict:
        try:
            with locked() as s:
                d = diagnose_coa(s, body.doc_id)
                display = {"accounts": str(d["stats"]["accounts"]), "findings": str(len(d["findings"]))} | \
                    {f["id"]: f"{f['count']} ({f['severity']})" for f in d["findings"]}
                ev = recorded(s, "diagnose_coa", body.model_dump(), d, display)
        except CoaError as e:
            return coa_refused(e)
        return ok(ev, d, display)

    @app.post("/v1/tools/check_coa_design", dependencies=[Depends(auth)])
    def check_coa(body: DesignBody) -> dict:
        """A dry run while the model drafts: checks and coverage, nothing stored, not citable."""
        with locked() as s:
            checks = check_design(s, body.design)
            post = posting_accounts(body.design)
            cov = coa_coverage(s, {a["concept_id"] for a in post if a.get("concept_id")},
                               {x["source_dimension"] for x in body.design.get("segments", []) if x.get("source_dimension")})
        failed = [c for c in checks if not c["ok"]]
        return ok(None, {"pass": not failed, "failed_checks": failed, "passed": [c["id"] for c in checks if c["ok"]],
                         "coverage": cov},
                  warnings=[f"{c['id']}: {c['detail']}" for c in failed])

    @app.post("/v1/tools/propose_coa_design", dependencies=[Depends(auth)])
    def propose_coa(body: DesignBody) -> dict:
        try:
            with locked() as s:
                out = propose_design(s, body.design, "model", body.design_id)
        except CoaError as e:
            return coa_refused(e)
        cov = out["coverage"]
        display = {"design": f"{out['design_id']} version {out['version']}", "accounts": str(out["accounts"]),
                   "posting accounts": str(out["posting_accounts"]), "decisions": str(len(out["decisions"])),
                   "IFRS lines producible": f"{cov['statements']['ifrs']['producible']} of {cov['statements']['ifrs']['lines']}",
                   "metrics producible": f"{cov['metrics_producible']} of {cov['metrics_total']}"}
        return ok(out["evidence_id"], out, display,
                  ["the engagement lead must approve the design and each decision in the Ledger review screen"])

    @app.post("/v1/tools/propose_coa_mapping", dependencies=[Depends(auth)])
    def propose_coa_map(body: CoaMappingBody) -> dict:
        try:
            with locked() as s:
                out = propose_mapping(s, body.design_id, body.doc_id, body.rules, "model")
        except CoaError as e:
            return coa_refused(e)
        cur = out["currency"]
        lines = out.pop("recut_lines")
        out["recut_lines"] = lines[:200]
        out["recut_line_count"] = len(lines)
        tie = out["tie_out"]
        display = {"mapping": out["mapping_id"], "recut lines": str(len(lines)),
                   "total old": money(tie["T_TOTAL"]["old"], cur), "total new": money(tie["T_TOTAL"]["new"], cur)}
        display |= {f"reclassified {x['concept']}": money(x["new"] - x["old"], cur) for x in tie["T_CONCEPT"]["reclassified"]}
        warnings = [] if tie["T_CLASS"]["ok"] else ["class tie-out not confirmed: some legacy accounts were unmapped or "
                                                    "unclassified; see the reclassified concepts"]
        return ok(out["evidence_id"], out, display, warnings)

    @app.post("/v1/tools/coa_status", dependencies=[Depends(auth)])
    def coa_state(body: DesignIdBody) -> dict:
        try:
            with locked() as s:
                return ok(None, design_status(s, body.design_id))
        except CoaError as e:
            return coa_refused(e)

    # ---- finance information model: lineage and adjustments (Phase 1) -----------------------------------------
    CCY = "USD"   # the v1 dataset is one currency

    def fim_refused(e: FimError) -> dict:
        return refused(e.code, str(e))

    def trace_display(t: dict) -> dict:
        keys = ("gl_minor", "from_instruments_minor", "instrument_adjustments_minor", "gl_adjustments_minor",
                "adjusted_gl_minor", "untraced_minor")
        d = {k.replace("_minor", ""): money(t[k], CCY) for k in keys}
        d |= {f"{c['instrument_id']}": money(c["amount_minor"], CCY) for c in t["instruments"]}
        return d | {"status": t["status"], "instrument_count": str(t["instrument_count"])}

    def wire(t):
        """Minor-unit integers to wire strings, recursively, for every *_minor key."""
        if isinstance(t, dict):
            return {k: (to_wire(v) if k.endswith("_minor") and isinstance(v, int) else wire(v)) for k, v in t.items()}
        if isinstance(t, list):
            return [wire(x) for x in t]
        return t

    @app.post("/v1/tools/load_information_model", dependencies=[Depends(auth)])
    def fim_load(body: FimLoadBody) -> dict:
        try:
            with locked() as s:
                d = fim.load_information_model(s, body.name, "model")
                rec = fim.reconcile(s)
        except FimError as e:
            return fim_refused(e)
        data = {**d, "tie_out": {"balances_checked": rec["balances_checked"], "ties": rec["ties"],
                                 "breaks": len(rec["breaks"])}}
        return ok(d["evidence_id"], data, {"contracts": str(d["contracts"]), "balances tied": f"{rec['ties']} of "
                                           f"{rec['balances_checked']}"})

    @app.post("/v1/tools/trace_gl_balance", dependencies=[Depends(auth)])
    def fim_trace(body: TraceBody) -> dict:
        try:
            with locked() as s:
                t = fim.trace_gl_balance(s, body.account, body.filters, body.ledger)
                display = trace_display(t)
                ev = recorded(s, "trace_gl_balance", body.model_dump(), wire(t), display)
        except FimError as e:
            return fim_refused(e)
        warn = [] if t["status"] in ("ties", "gl_only") else [f"status {t['status']}: {t['note']}"]
        if any(a["review"] != "approved" for a in t["adjustments"]):
            warn.append("some adjustments await review: adjusted figures are draft")
        return ok(ev, wire(t), display, warn)

    @app.post("/v1/tools/instrument_summary", dependencies=[Depends(auth)])
    def fim_instrument(body: InstrumentBody) -> dict:
        try:
            with locked() as s:
                t = fim.instrument_summary(s, body.instrument_id)
                display = {f"feeds {f['account']} ({f['balance_type']})": money(f["amount_minor"], CCY) for f in t["feeds_gl"]}
                ev = recorded(s, "instrument_summary", body.model_dump(), wire(t), display)
        except FimError as e:
            return fim_refused(e)
        return ok(ev, wire(t), display)

    @app.post("/v1/tools/propose_adjustment", dependencies=[Depends(auth)])
    def fim_adjust(body: AdjustmentBody) -> dict:
        try:
            lines = [{"account": l.account, "instrument_id": l.instrument_id, "segments": l.segments,
                      "debit_minor": from_wire(l.debit) if l.debit else 0,
                      "credit_minor": from_wire(l.credit) if l.credit else 0} for l in body.lines]
            with locked() as s:
                a = fim.propose_adjustment(s, body.level, body.period, body.reason_code, body.rationale, lines, "model")
        except (FimError, AmountError) as e:
            return refused(getattr(e, "code", "amount"), str(e))
        total = sum(x["debit_minor"] for x in a["lines"])
        return ok(a["evidence_id"], wire(a), {"adjustment": a["adj_id"], "total": money(total, CCY)},
                  [f"awaiting engagement-lead review ({a['review_item_id']})"])

    @app.post("/v1/tools/reverse_adjustment", dependencies=[Depends(auth)])
    def fim_reverse(body: ReverseAdjBody) -> dict:
        try:
            with locked() as s:
                a = fim.reverse_adjustment(s, body.adj_id, body.rationale, "model")
        except FimError as e:
            return fim_refused(e)
        return ok(a["evidence_id"], wire(a), {"reversal": a["adj_id"]}, [f"awaiting engagement-lead review ({a['review_item_id']})"])

    # ---- knowledge pack: data requirements and exam ----------------------------------------------------------------

    def register_for(s, design_id: str | None) -> dict:
        pack = load_pack()
        design = None
        if design_id:
            from .coa import load_design
            design, _, _ = load_design(s, design_id)
        return data_requirements(s, pack, design), pack

    @app.post("/v1/tools/data_requirements", dependencies=[Depends(auth)])
    def register(body: RegisterBody) -> dict:
        try:
            with locked() as s:
                reg, pack = register_for(s, body.design_id)
                accounts, catalogue = {}, {}
                for r in reg["rows"]:
                    a = accounts.setdefault(r["account"], {"account": r["account"], "name": r["account_name"],
                                                           "concept": r["concept"], "backing": "gl", "products": ""})
                    if r["backing"] != "all":
                        a["backing"] = r["backing"].split(":")[0]
                        a["products"] = r["products"]
                    catalogue.setdefault(r["backing"], {})[r["attribute"]] = {"why": r["why"], "dq_rule": r["dq_rule"]}
                data = {"pack": pack_info(pack), "chart": reg["chart"], "posting_accounts": reg["posting_accounts"],
                        "accounts_by_backing": reg["accounts_by_backing"], "requirements": reg["requirements"],
                        "accounts": list(accounts.values()),
                        "attributes_by_backing": {k: [{"attribute": a, **v} for a, v in d.items()] for k, d in catalogue.items()}}
                display = {"posting accounts": str(reg["posting_accounts"]), "requirements": str(reg["requirements"])} | \
                          {f"{k} accounts": str(v) for k, v in reg["accounts_by_backing"].items()}
                ev = recorded(s, "data_requirements", body.model_dump(), data, display)
        except (PackError, CoaError) as e:
            return refused(e.code, str(e))
        return ok(ev, data, display)

    @app.post("/v1/tools/run_exam", dependencies=[Depends(auth)])
    def exam(body: ExamBody) -> dict:
        try:
            with locked() as s:
                r = run_exam(s, load_pack(), body.doc_id, body.design_id)
                display = {"overall": r["overall"]} | {x["id"]: f"{x['status']} ({x['score_pct']}%)" if "score_pct" in x
                                                       else x["status"] for x in r["sections"]}
                ev = recorded(s, "run_exam", body.model_dump(), r, display)
        except PackError as e:
            return refused(e.code, str(e))
        return ok(ev, r, display)

    @app.post("/v1/tools/check_output", dependencies=[Depends(auth)])
    def gate(body: CheckBody) -> dict:
        """Called by the console on a draft, not offered to the model."""
        with locked() as s:
            return ok(None, check_output(s, body.text, body.evidence_ids))

    # ---- people only: never offered to the model ----------------------------------------------------------------


    @app.post("/v1/people/review_decision", dependencies=[Depends(auth)])
    def decide(body: DecisionBody, x_volt_user: str = Header(default="")) -> dict:
        if not x_volt_user:
            raise HTTPException(403, "a signed-in person is required")
        try:
            with locked() as s:
                ev = record_review_decision(s, body.item_id, body.stage, body.decision, f"user:{x_volt_user}", body.note)
        except MappingError as e:
            return refused(e.code, str(e))
        return ok(ev, {"recorded": True})

    @app.post("/v1/people/driver_value", dependencies=[Depends(auth)])
    def driver(body: DriverBody, x_volt_user: str = Header(default="")) -> dict:
        if not x_volt_user:
            raise HTTPException(403, "a signed-in person is required")
        try:
            with locked() as s:
                vid, ev = record_driver_value(s, body.kind, body.key, body.period, body.dimensions, body.value, body.unit,
                                              {"user": x_volt_user, "note": body.note}, f"user:{x_volt_user}")
        except DriverError as e:
            return refused(e.code, str(e))
        return ok(ev, {"value_id": vid})

    @app.get("/v1/people/coa_designs", dependencies=[Depends(auth)])
    def coa_designs() -> dict:
        with locked() as s:
            ids = [r[0] for r in s.conn.execute("SELECT DISTINCT design_id FROM coa_design ORDER BY design_id")]
            return ok(None, [design_status(s, i) for i in ids])

    @app.get("/v1/people/coa_export", dependencies=[Depends(auth)])
    def coa_download(design_id: str, what: str) -> PlainTextResponse:
        try:
            with locked() as s:
                text = coa_export(s, design_id, what)
        except CoaError as e:
            raise HTTPException(404, str(e))
        return PlainTextResponse(text, media_type="text/csv")

    @app.get("/v1/people/data_requirements_export", dependencies=[Depends(auth)])
    def register_download(design_id: str | None = None) -> PlainTextResponse:
        try:
            with locked() as s:
                reg, _ = register_for(s, design_id)
        except (PackError, CoaError) as e:
            raise HTTPException(404, str(e))
        return PlainTextResponse(register_csv(reg), media_type="text/csv")

    @app.get("/v1/people/review_items", dependencies=[Depends(auth)])
    def review_items() -> dict:
        with locked() as s:
            rows = [dict(r) for r in s.conn.execute(
                "SELECT i.item_id, i.kind, i.ref_id, i.reason, e.inputs AS proposal FROM review_item i "
                "JOIN evidence e ON e.evidence_id = i.evidence_id ORDER BY i.item_id")]
            visible = set(client_visible(s))
            latest = {}
            for d in s.conn.execute("SELECT item_id, stage, decision, by_user, note FROM review_decision ORDER BY seq"):
                latest[(d[0], d[1])] = {"decision": d[2], "by": d[3], "note": d[4]}
        for r in rows:
            r["proposal"] = json.loads(r["proposal"])
            r["engagement_lead"] = latest.get((r["item_id"], "engagement_lead"))
            r["client"] = latest.get((r["item_id"], "client"))
            r["client_visible"] = r["item_id"] in visible
        return ok(None, rows)

    return app


def main() -> None:   # pragma: no cover - started by uvicorn on Render
    import uvicorn
    uvicorn.run(create_app(), host=os.environ.get("VOLT_LEDGER_HOST", "0.0.0.0"),
                port=int(os.environ.get("PORT", "8790")))


if __name__ == "__main__":   # pragma: no cover
    main()
