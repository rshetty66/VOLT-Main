"""Mapping, policy gaps and the review queue (Phase 6 step 4a).

The model proposes; these functions check and record. A mapping never overwrites an earlier one: a new mapping
supersedes it and the history stays. Low-confidence mappings, first-run mappings and every policy gap go to the
review queue (A9), and nothing reaches the client view without engagement-lead approval first.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Literal

from .evidence import write_evidence
from .store import Store

REVIEW_THRESHOLD = Decimal("0.90")
GAP_TYPES = ("recognition_basis_mixed", "stage_not_captured", "catch_all_account", "dimension_in_account",
             "lease_model_difference", "capitalisation_policy", "gross_vs_net", "unmappable_sign", "other")


class MappingError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


@dataclass(frozen=True)
class MappingOut:
    association_id: str
    evidence_id: str
    review_item_id: str | None


@dataclass(frozen=True)
class GapOut:
    gap_id: str
    evidence_id: str
    review_item_id: str


def _confidence(value: object) -> Decimal:
    try:
        c = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise MappingError("bad_confidence", f"confidence must be a number from 0 to 1, got {value!r}") from None
    if not (Decimal(0) <= c <= Decimal(1)):
        raise MappingError("bad_confidence", f"confidence must be from 0 to 1, got {value!r}")
    return c.quantize(Decimal("0.01"))


def _element_type(store: Store, element_id: str) -> str | None:
    r = store.conn.execute("SELECT element_type FROM element WHERE element_id = ?", (element_id,)).fetchone()
    return r[0] if r else None


def _next(cur, table: str, prefix: str) -> str:
    return f"{prefix}{cur.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0] + 1:06d}"


def _review(cur, kind: str, ref_id: str, reason: str, evidence_id: str) -> str:
    item_id = _next(cur, "review_item", "R")
    cur.execute("INSERT INTO review_item (item_id, kind, ref_id, reason, evidence_id) VALUES (?,?,?,?,?)",
                (item_id, kind, ref_id, reason, evidence_id))
    return item_id


def active_mapping(store: Store, account_id: str) -> dict | None:
    """The latest mapping for an account (later mappings supersede earlier ones)."""
    r = store.conn.execute(
        "SELECT a.association_id, a.to_element, a.confidence, a.evidence_id FROM association a "
        "JOIN evidence e ON e.evidence_id = a.evidence_id "
        "WHERE a.association_type = 'mapping' AND a.from_element = ? ORDER BY e.seq DESC LIMIT 1",
        (account_id,)).fetchone()
    return dict(r) if r else None


def open_gaps(store: Store, account_id: str) -> list[str]:
    return [r[0] for r in store.conn.execute(
        "SELECT from_element FROM association WHERE association_type = 'gap_of' AND to_element = ? ORDER BY 1",
        (account_id,))]


def map_line_item_to_element(store: Store, account_id: str, concept_id: str, confidence: object, rationale: str,
                             actor: str, source_refs: list[str] | None = None, first_client_run: bool = True) -> MappingOut:
    if _element_type(store, account_id) != "account":
        raise MappingError("not_account", f"{account_id} is not an account")
    if _element_type(store, concept_id) != "concept":
        raise MappingError("not_concept", f"{concept_id} is not a canonical concept")
    if not rationale.strip():
        raise MappingError("no_rationale", "a mapping needs a rationale")
    conf = _confidence(confidence)
    reasons = []
    if conf < REVIEW_THRESHOLD:
        reasons.append(f"confidence_below_{REVIEW_THRESHOLD}")
    if first_client_run:
        reasons.append("first_client_run")
    sources = [{"element_id": account_id}] + [{"cite": s} for s in (source_refs or [])]
    for r in store.conn.execute("SELECT doc_id, row_number FROM tb_row WHERE account_id = ? ORDER BY 1, 2", (account_id,)):
        sources.append({"doc_id": r[0], "row": r[1]})
    with store.transaction() as cur:
        n = cur.execute("SELECT COUNT(*) FROM association WHERE association_type = 'mapping' AND from_element = ?",
                        (account_id,)).fetchone()[0] + 1
        assoc_id = f"mapping:{account_id}:{n}"
        ev = write_evidence(cur, "map_line_item_to_element",
                            {"account_id": account_id, "concept_id": concept_id, "confidence": str(conf),
                             "rationale": rationale},
                            {"association_id": assoc_id, "review": reasons}, sources, actor)
        cur.execute("INSERT INTO association (association_id, from_element, to_element, association_type, gaap, weight, "
                    "ord, confidence, evidence_id) VALUES (?,?,?,?,?,?,?,?,?)",
                    (assoc_id, account_id, concept_id, "mapping", None, None, None, str(conf), ev.evidence_id))
        item = _review(cur, "mapping", assoc_id, ",".join(reasons), ev.evidence_id) if reasons else None
    return MappingOut(assoc_id, ev.evidence_id, item)


def flag_policy_gap(store: Store, element_ids: list[str], gap_type: str, decision_needed: str,
                    standard_refs: list[str], rationale: str, confidence: object, actor: str) -> GapOut:
    if not element_ids:
        raise MappingError("no_elements", "a gap must name at least one account or concept")
    for e in element_ids:
        if _element_type(store, e) not in ("account", "concept"):
            raise MappingError("bad_element", f"{e} is not an account or concept")
    if gap_type not in GAP_TYPES:
        raise MappingError("bad_gap_type", f"gap_type must be one of {', '.join(GAP_TYPES)}")
    if not decision_needed.strip():
        raise MappingError("no_decision", "say what decision a person must make")
    conf = _confidence(confidence)
    # v1 holds no standard_paragraph elements, so every reference is stored unverified (A8).
    refs = [{"ref": r, "verified": False} for r in standard_refs]
    with store.transaction() as cur:
        n = cur.execute("SELECT COUNT(*) FROM element WHERE element_type = 'policy_gap'").fetchone()[0] + 1
        gap_id = f"gap:{n:06d}"
        ev = write_evidence(cur, "flag_policy_gap",
                            {"element_ids": element_ids, "gap_type": gap_type, "decision_needed": decision_needed,
                             "standard_refs": standard_refs, "rationale": rationale, "confidence": str(conf)},
                            {"gap_id": gap_id}, [{"element_id": e} for e in element_ids], actor)
        traits = {"gap_type": gap_type, "decision_needed": decision_needed, "standard_refs": refs,
                  "rationale": rationale, "confidence": str(conf)}
        cur.execute("INSERT INTO element (element_id, element_type, label, traits, provenance, evidence_id) "
                    "VALUES (?,?,?,?,?,?)",
                    (gap_id, "policy_gap", f"{gap_type}: {decision_needed[:80]}", json.dumps(traits, sort_keys=True),
                     json.dumps({"source": "model_proposal" if actor == "model" else actor, "evidence_id": ev.evidence_id}),
                     ev.evidence_id))
        for e in element_ids:
            cur.execute("INSERT INTO association (association_id, from_element, to_element, association_type, "
                        "evidence_id) VALUES (?,?,?,?,?)", (f"gap_of:{gap_id}->{e}", gap_id, e, "gap_of", ev.evidence_id))
        item = _review(cur, "policy_gap", gap_id, "always_review", ev.evidence_id)
    return GapOut(gap_id, ev.evidence_id, item)


def get_ontology_context(store: Store, query: str | None = None, element_id: str | None = None,
                         limit: int = 8) -> dict:
    """Read-only context for the model: for an account, its TB rows and current mapping; for a concept, its
    calculation parent and children; for a text query, the best-matching concepts by label and XBRL name."""
    if element_id:
        e = store.conn.execute("SELECT element_id, element_type, label, balance_type, xbrl_ifrs, xbrl_usgaap "
                               "FROM element WHERE element_id = ?", (element_id,)).fetchone()
        if e is None:
            return {"status": "not_found", "element_id": element_id}
        out: dict = {"status": "ok", "element": dict(e)}
        if e["element_type"] == "account":
            rows = store.conn.execute("SELECT doc_id, row_number, debit_minor, credit_minor, dimensions FROM tb_row "
                                      "WHERE account_id = ? ORDER BY 1, 2", (element_id,)).fetchall()
            net = sum(r[2] - r[3] for r in rows)
            out["tb"] = {"rows": [{"doc_id": r[0], "row": r[1], "dimensions": json.loads(r[4])} for r in rows],
                         "sign": "debit" if net > 0 else "credit" if net < 0 else "zero"}
            out["active_mapping"] = active_mapping(store, element_id)
            out["gaps"] = open_gaps(store, element_id)
        elif e["element_type"] == "concept":
            out["parent"] = [r[0] for r in store.conn.execute(
                "SELECT to_element FROM association WHERE association_type='calculation' AND from_element=?", (element_id,))]
            out["children"] = [r[0] for r in store.conn.execute(
                "SELECT from_element FROM association WHERE association_type='calculation' AND to_element=? ORDER BY 1",
                (element_id,))]
        return out
    words = [w for w in re.findall(r"[a-z0-9]+", (query or "").lower()) if len(w) > 2]
    scored = []
    for r in store.conn.execute("SELECT element_id, label, balance_type, xbrl_ifrs, xbrl_usgaap FROM element "
                                "WHERE element_type = 'concept'"):
        hay = " ".join(str(x or "") for x in r).lower()
        score = sum(1 for w in words if w in hay)
        if score:
            scored.append((-score, r[0], dict(r)))
    scored.sort()
    return {"status": "ok", "query": query, "candidates": [s[2] for s in scored[:limit]]}


def coverage(store: Store, doc_id: str) -> dict:
    """Gate G6 and test V3: every account in a TB is mapped or has a linked gap."""
    accounts = [r[0] for r in store.conn.execute(
        "SELECT DISTINCT account_id FROM tb_row WHERE doc_id = ? ORDER BY 1", (doc_id,))]
    mapped = [a for a in accounts if active_mapping(store, a)]
    gapped = [a for a in accounts if open_gaps(store, a)]
    neither = [a for a in accounts if a not in mapped and a not in gapped]
    return {"accounts": len(accounts), "mapped": len(mapped), "with_gap": len(gapped), "unaccounted": neither}


Stage = Literal["engagement_lead", "client"]


def record_review_decision(store: Store, item_id: str, stage: Stage, decision: str, by_user: str, note: str = "") -> str:
    """People only: the console never exposes this to the model. Client stage needs engagement-lead approval first."""
    if by_user in ("model", "system") or not by_user.startswith("user:"):
        raise MappingError("not_a_person", "review decisions are made by signed-in people only")
    if store.conn.execute("SELECT 1 FROM review_item WHERE item_id = ?", (item_id,)).fetchone() is None:
        raise MappingError("unknown_item", item_id)
    if stage == "client" and _latest(store, item_id, "engagement_lead") != "approve":
        raise MappingError("needs_lead_approval", "the engagement lead must approve before the client stage")
    with store.transaction() as cur:
        ev = write_evidence(cur, "record_review_decision",
                            {"item_id": item_id, "stage": stage, "decision": decision, "note": note},
                            {"recorded": True}, [{"review_item": item_id}], by_user)
        cur.execute("INSERT INTO review_decision (item_id, stage, decision, by_user, note, evidence_id) "
                    "VALUES (?,?,?,?,?,?)", (item_id, stage, decision, by_user, note, ev.evidence_id))
    return ev.evidence_id


def _latest(store: Store, item_id: str, stage: str) -> str | None:
    r = store.conn.execute("SELECT decision FROM review_decision WHERE item_id = ? AND stage = ? ORDER BY seq DESC LIMIT 1",
                           (item_id, stage)).fetchone()
    return r[0] if r else None


def client_visible(store: Store) -> list[str]:
    """Items the client may see: approved by the engagement lead (and not since rejected)."""
    return [r[0] for r in store.conn.execute("SELECT item_id FROM review_item ORDER BY item_id")
            if _latest(store, r[0], "engagement_lead") == "approve"]
