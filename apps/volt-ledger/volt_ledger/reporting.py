"""Balances, statements, ratios and the output gate (phase3-engine.md sections 6 and 8; Phase 6 step 6).

Every function here reads; the tool wrappers write one evidence record per call so each figure the model quotes
can be traced to a stored computation. Concept balances come from accounts through their latest mapping, plus the
concept's calculation children (all weights +1 on signed, debit-positive balances).

Simplifications in v1 (A27): balances are the trial balance for the period plus, when asked, proposed journals in or
before it; there is no fiscal-year roll-forward and no GAAP adjustment view yet (gaap is a presentation choice).
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from decimal import ROUND_HALF_EVEN, Decimal
from fractions import Fraction
from pathlib import Path
from typing import Mapping

from .balances import account_balances
from .drivers import latest_driver
from .evidence import write_evidence
from .mapping import active_mapping, open_gaps
from .money import format_amount, to_wire
from .store import Store

METRICS_FILE = Path(__file__).resolve().parent.parent / "data" / "metrics" / "metrics-v1.json"
STATEMENTS = {("ifrs", "BS"): "stmt:IFRS:BS", ("ifrs", "IS"): "stmt:IFRS:IS",
              ("us-gaap", "BS"): "stmt:USGAAP:BS", ("us-gaap", "IS"): "stmt:USGAAP:IS"}


class ReportingError(ValueError):
    def __init__(self, code: str, message: str, details: list | None = None) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.details = details or []


def _matches(dims_json: str, want: Mapping[str, str]) -> bool:
    d = json.loads(dims_json)
    return all(d.get(k) == v for k, v in want.items())


class Balances:
    """Signed balances for one period, dimension filter and proposal setting, with concept roll-ups."""

    def __init__(self, store: Store, period: str, dimensions: Mapping[str, str] | None = None,
                 include_proposals: bool = False) -> None:
        self.store = store
        self.by_account: dict[str, int] = defaultdict(int)
        for (acct, dims), bal in account_balances(store, period, include_proposals).items():
            if _matches(dims, dimensions or {}):
                self.by_account[acct] += bal
        self.mapped: dict[str, list[str]] = defaultdict(list)       # concept -> accounts
        self.unmapped: list[str] = []
        self.pending_review: list[str] = []
        # A mapping waits for review when it has a review item whose latest engagement-lead decision is not approve.
        queued = {r[0] for r in store.conn.execute("SELECT ref_id FROM review_item WHERE kind = 'mapping'")}
        reviewed = {r[0]: r[1] for r in store.conn.execute(
            "SELECT i.ref_id, d.decision FROM review_item i JOIN review_decision d ON d.item_id = i.item_id "
            "WHERE d.stage = 'engagement_lead' ORDER BY d.seq")}
        for acct in sorted(self.by_account):
            m = active_mapping(store, acct)
            if m is None:
                self.unmapped.append(acct)
                continue
            self.mapped[m["to_element"]].append(acct)
            if m["association_id"] in queued and reviewed.get(m["association_id"]) != "approve":
                self.pending_review.append(acct)
        self.children: dict[str, list[str]] = defaultdict(list)
        for r in store.conn.execute("SELECT from_element, to_element FROM association WHERE association_type = 'calculation' "
                                    "ORDER BY from_element"):
            self.children[r[1]].append(r[0])

    def element(self, element_id: str) -> int:
        """Signed balance of an account, or of a concept through mappings and calculation children."""
        if element_id.startswith("acct:"):
            return self.by_account.get(element_id, 0)
        return sum(self.by_account[a] for a in self.mapped.get(element_id, [])) + \
            sum(self.element(c) for c in self.children.get(element_id, []))


def balance_type(store: Store, element_id: str) -> str | None:
    r = store.conn.execute("SELECT balance_type FROM element WHERE element_id = ?", (element_id,)).fetchone()
    return r[0] if r else None


def natural(store: Store, element_id: str, signed: int) -> int:
    """The amount as a reader expects it: credit-natured concepts shown positive when in credit."""
    return -signed if balance_type(store, element_id) == "credit" else signed


def get_balances(store: Store, period: str, element_ids: list[str], dimensions: Mapping[str, str] | None = None,
                 include_proposals: bool = False) -> dict:
    unknown = [e for e in element_ids if store.conn.execute(
        "SELECT 1 FROM element WHERE element_id = ? AND element_type IN ('account','concept')", (e,)).fetchone() is None]
    if unknown:
        raise ReportingError("unknown_element", "not an account or concept", unknown)
    b = Balances(store, period, dimensions, include_proposals)
    return {"period": period, "dimensions": dict(dimensions or {}), "include_proposals": include_proposals,
            "balances": {e: {"signed": b.element(e), "natural": natural(store, e, b.element(e))} for e in element_ids},
            "accounts_pending_review": len(b.pending_review), "accounts_unmapped": len(b.unmapped)}


def build_statement(store: Store, period: str, gaap: str, statement: str, dimensions: Mapping[str, str] | None = None,
                    include_proposals: bool = False) -> dict:
    root = STATEMENTS.get((gaap, statement))
    if root is None:
        raise ReportingError("bad_statement", "gaap is ifrs or us-gaap; statement is BS or IS")
    b = Balances(store, period, dimensions, include_proposals)
    if not b.by_account:
        raise ReportingError("no_data", f"no trial balance for {period}")
    lines = []
    for r in store.conn.execute("SELECT a.to_element, e.label, e.xbrl_ifrs, e.xbrl_usgaap, e.traits FROM association a "
                                "JOIN element e ON e.element_id = a.to_element WHERE a.association_type = 'presentation' "
                                "AND a.from_element = ? AND a.gaap = ? ORDER BY a.ord", (root, gaap)):
        signed = b.element(r[0])
        if signed == 0 and json.loads(r[4] or "{}").get("industry"):
            continue   # an industry line (insurance) is shown only when the entity has a balance on it
        lines.append({"concept": r[0], "label": r[1], "xbrl": r[2] if gaap == "ifrs" else r[3],
                      "is_total": bool(b.children.get(r[0])), "amount": natural(store, r[0], signed)})
    # Unmapped accounts are not on any line; accounts with an open policy gap are on their line but flagged.
    # Both are listed so nothing is silently dropped or silently presented.
    excluded = [{"account": a, "signed": b.by_account[a]} for a in b.unmapped]
    flagged = [{"account": a, "signed": b.by_account[a], "gaps": g, "on_statement": a not in b.unmapped}
               for a in sorted(b.by_account) if (g := open_gaps(store, a))]
    checks = {}
    if statement == "BS":
        pat = natural(store, "canon:ProfitAfterTax", b.element("canon:ProfitAfterTax"))
        checks = {"total_assets": b.element("canon:TotalAssets"),
                  "total_liabilities_and_equity": -b.element("canon:TotalLiabilitiesAndEquity"),
                  "current_year_profit": pat}
        checks["difference"] = checks["total_assets"] - checks["total_liabilities_and_equity"] - pat
        # The difference must be fully explained by excluded (unmapped) accounts.
        checks["explained_by_excluded"] = -sum(x["signed"] for x in excluded)
        checks["balances"] = checks["difference"] == 0
        checks["unexplained"] = checks["difference"] - checks["explained_by_excluded"]
    return {"period": period, "gaap": gaap, "statement": statement, "dimensions": dict(dimensions or {}),
            "include_proposals": include_proposals, "lines": lines, "excluded": excluded, "flagged": flagged, "checks": checks,
            "accounts_pending_review": b.pending_review, "draft": bool(b.pending_review or excluded or flagged)}


# ---- ratios -----------------------------------------------------------------------------------------------------

def load_metrics(path: Path = METRICS_FILE) -> dict[str, dict]:
    return {m["metric_id"]: m for m in json.loads(path.read_text())["metrics"]}


_TOKEN = re.compile(r"\s*(?:(?P<num>[0-9]+(?:\.[0-9]+)?)|(?P<ref>(?:canon|acct|driver):[A-Za-z0-9_:]+)|(?P<op>[-+*/()]))")


def _tokens(formula: str) -> list[tuple[str, str]]:
    out, pos = [], 0
    formula = formula.strip()
    while pos < len(formula):
        m = _TOKEN.match(formula, pos)
        if not m or m.end() == pos:
            raise ReportingError("bad_formula", f"cannot read formula at {formula[pos:pos + 20]!r}")
        kind = m.lastgroup
        out.append((kind, m.group(kind)))
        pos = m.end()
    return out


def evaluate(formula: str, resolve) -> Fraction:
    """A small recursive-descent evaluator: numbers, references, + - * / and brackets. No eval, no names, no calls."""
    toks = _tokens(formula)
    i = 0

    def peek():
        return toks[i] if i < len(toks) else (None, None)

    def take():
        nonlocal i
        if i >= len(toks):
            raise ReportingError("bad_formula", "the formula ends too early")
        i += 1
        return toks[i - 1]

    def expr():
        v = term()
        while peek()[1] in ("+", "-"):
            v = v + term() if take()[1] == "+" else v - term()
        return v

    def term():
        v = factor()
        while peek()[1] in ("*", "/"):
            op = take()[1]
            rhs = factor()
            if op == "/" and rhs == 0:
                raise ReportingError("undefined", "division by zero")
            v = v * rhs if op == "*" else v / rhs
        return v

    def factor():
        kind, val = take()
        if kind == "num":
            return Fraction(Decimal(val))
        if kind == "ref":
            return resolve(val)
        if val == "-":
            return -factor()
        if val == "(":
            v = expr()
            if take()[1] != ")":
                raise ReportingError("bad_formula", "missing )")
            return v
        raise ReportingError("bad_formula", f"unexpected {val!r}")

    v = expr()
    if i != len(toks):
        raise ReportingError("bad_formula", f"unexpected {toks[i][1]!r}")
    return v


def compute_ratio(store: Store, metric_id: str, period: str, dimensions: Mapping[str, str] | None = None,
                  include_proposals: bool = False) -> dict:
    metrics = load_metrics()
    m = metrics.get(metric_id)
    if m is None:
        raise ReportingError("unknown_metric", f"{metric_id}; known: {', '.join(sorted(metrics))}")
    b = Balances(store, period, dimensions, include_proposals)
    inputs, missing = {}, []

    def resolve(ref: str) -> Fraction:
        if ref.startswith("driver:"):
            d = latest_driver(store, ref[7:], period, dict(dimensions or {}))
            if d is None:
                missing.append(ref)
                return Fraction(0)
            inputs[ref] = {"value": str(d["value"]), "evidence_id": d["evidence_id"]}
            return Fraction(d["value"])
        if store.conn.execute("SELECT 1 FROM element WHERE element_id = ?", (ref,)).fetchone() is None:
            raise ReportingError("bad_formula", f"unknown element {ref}")
        v = natural(store, ref, b.element(ref))
        inputs[ref] = {"natural_minor": to_wire(v)}
        return Fraction(v)

    base = {"metric_id": metric_id, "version": m["version"], "label": m["label"], "formula": m["formula"],
            "unit": m["unit"], "period": period, "dimensions": dict(dimensions or {}),
            "include_proposals": include_proposals}
    try:
        value = evaluate(m["formula"], resolve)
    except ReportingError as e:
        if e.code != "undefined":
            raise
        return {**base, "status": "undefined", "inputs": inputs, "value": None}
    if missing:
        return {**base, "status": "not_computable", "missing": missing, "inputs": inputs, "value": None}
    if m["unit"] == "money":
        if value.denominator != 1:
            raise ReportingError("bad_formula", "a money metric must come out in whole minor units")
        out = to_wire(int(value))
    else:
        out = str((Decimal(value.numerator) / Decimal(value.denominator)).quantize(Decimal("0.000001"), ROUND_HALF_EVEN))
    return {**base, "status": "ok", "inputs": inputs, "value": out, "draft": bool(b.pending_review)}


def display_ratio(r: dict, currency: str) -> dict[str, str]:
    if r["status"] != "ok":
        return {"value": r["status"]}
    if r["unit"] == "money":
        n = int(r["value"])
        return {"value": f"{format_amount(n, currency)} {currency}"}
    if r["unit"] == "percent":
        return {"value": f"{(Decimal(r['value']) * 100).quantize(Decimal('0.01'), ROUND_HALF_EVEN)}%"}
    return {"value": str(Decimal(r["value"]).quantize(Decimal("0.01"), ROUND_HALF_EVEN))}


# ---- output gate ------------------------------------------------------------------------------------------------

_NUMBER = re.compile(r"(?<![\w.])-?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|(?<![\w.,])-?\d+\.\d+%?|(?<![\w.,])-?\d+%")


def _norm(token: str) -> str:
    t = token.replace(",", "").rstrip("%").lstrip("-")
    if "." in t:
        t = t.rstrip("0").rstrip(".")
    return t


def check_output(store: Store, text: str, evidence_ids: list[str]) -> dict:
    """Gate (spec section 6): every monetary or ratio figure in the draft must appear in the outputs of the
    cited evidence records. Plain integers without grouping (years, counts, section numbers) are not checked."""
    known: set[str] = set()
    for e in evidence_ids:
        r = store.conn.execute("SELECT outputs FROM evidence WHERE evidence_id = ?", (e,)).fetchone()
        if r:
            known.update(_norm(t) for t in _NUMBER.findall(r[0]))
            known.update(_norm(t) for t in re.findall(r"\d+(?:\.\d+)?", r[0]))
    figures = sorted({t for t in _NUMBER.findall(text)})
    unsupported = [t for t in figures if _norm(t) not in known]
    return {"figures": len(figures), "unsupported": unsupported, "pass": not unsupported}
