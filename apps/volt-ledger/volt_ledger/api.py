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
import os
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from .ingest import ColumnMap, IngestError, ingest_trial_balance
from .mapping import (MappingError, client_visible, coverage, flag_policy_gap, get_ontology_context,
                      map_line_item_to_element, record_review_decision)
from .money import AmountError, format_amount, from_wire, to_wire
from .ontology import load_ontology
from .posting import JournalIn, LineIn, PostingError, post_journal_entry, reverse_journal_entry
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
        return ok(out.evidence_id, {"journal_id": out.journal_id, "created": out.created, "total": to_wire(total)},
                  {"total": f"{format_amount(total, cur)} {cur}"})


    @app.post("/v1/tools/reverse_journal", dependencies=[Depends(auth)])
    def reverse(body: ReverseBody) -> dict:
        try:
            with locked() as s:
                out = reverse_journal_entry(s, body.journal_id, body.period, body.reason, body.idempotency_key, "model")
        except PostingError as e:
            return refused(e.code, str(e))
        return ok(out.evidence_id, {"journal_id": out.journal_id, "created": out.created})


    @app.post("/v1/tools/coverage", dependencies=[Depends(auth)])
    def cover(body: CoverageBody) -> dict:
        with locked() as s:
            c = coverage(s, body.doc_id)
        return ok(None, c, {k: str(v) for k, v in c.items() if k != "unaccounted"} | {"unaccounted": str(len(c["unaccounted"]))})

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

    @app.get("/v1/people/review_items", dependencies=[Depends(auth)])
    def review_items() -> dict:
        with locked() as s:
            rows = [dict(r) for r in s.conn.execute("SELECT item_id, kind, ref_id, reason FROM review_item ORDER BY item_id")]
            visible = set(client_visible(s))
        for r in rows:
            r["client_visible"] = r["item_id"] in visible
        return ok(None, rows)

    return app


def main() -> None:   # pragma: no cover - started by uvicorn on Render
    import uvicorn
    uvicorn.run(create_app(), host=os.environ.get("VOLT_LEDGER_HOST", "0.0.0.0"),
                port=int(os.environ.get("PORT", "8790")))


if __name__ == "__main__":   # pragma: no cover
    main()
