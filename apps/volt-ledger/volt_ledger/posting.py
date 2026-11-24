"""Posting service (Phase 3, section 5; Phase 6 step 3).

post_journal_entry is the single write path into the proposal ledger. Reversals go through it too.
All journals have status 'proposed': the brain never posts to a client's general ledger.
"""
from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from typing import Literal, Mapping, Sequence

from .evidence import canonical_json, write_evidence
from .money import minor_units, to_wire
from .store import Store

_PERIOD = re.compile(r"[0-9]{4}-(0[1-9]|1[0-2])")
Kind = Literal["adjustment", "reclass", "allocation", "gaap_adjustment", "reversal"]
KINDS = ("adjustment", "reclass", "allocation", "gaap_adjustment", "reversal")
GAAP_VIEWS = ("base", "ifrs", "us-gaap")


class PostingError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code


@dataclass(frozen=True)
class LineIn:
    account_id: str
    debit: int = 0
    credit: int = 0
    currency: str = "USD"
    dimensions: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class JournalIn:
    idempotency_key: str
    period: str
    kind: Kind
    description: str
    lines: Sequence[LineIn]
    gaap: str = "base"
    source_refs: Sequence[dict] = ()


@dataclass(frozen=True)
class JournalOut:
    journal_id: str
    evidence_id: str
    created: bool


def _payload(j: JournalIn, reverses: str | None) -> dict:
    return {"period": j.period, "kind": j.kind, "description": j.description, "gaap": j.gaap,
            "reverses": reverses,
            "lines": [{"account_id": l.account_id, "debit": l.debit, "credit": l.credit, "currency": l.currency,
                       "dimensions": dict(sorted(l.dimensions.items()))} for l in j.lines],
            "source_refs": list(j.source_refs)}


def is_locked(store: Store, period: str) -> bool:
    r = store.conn.execute("SELECT action FROM period_lock_event WHERE period = ? ORDER BY seq DESC LIMIT 1",
                           (period,)).fetchone()
    return bool(r) and r[0] == "lock"


def _lock_event(store: Store, period: str, action: str, actor: str, reason: str) -> str:
    if not _PERIOD.fullmatch(period):
        raise PostingError("bad_period", f"period must be YYYY-MM, got {period!r}")
    if (action == "lock") == is_locked(store, period):
        raise PostingError("lock_state", f"period {period} is already {'locked' if action == 'lock' else 'open'}")
    with store.transaction() as cur:
        ev = write_evidence(cur, f"{action}_period", {"period": period, "reason": reason}, {"state": action}, [], actor)
        cur.execute("INSERT INTO period_lock_event (period, action, actor, reason, evidence_id) VALUES (?,?,?,?,?)",
                    (period, action, actor, reason, ev.evidence_id))
    return ev.evidence_id


def lock_period(store: Store, period: str, actor: str, reason: str) -> str:
    return _lock_event(store, period, "lock", actor, reason)


def unlock_period(store: Store, period: str, actor: str, reason: str) -> str:
    """Engagement lead only; the console enforces the role. Kept as an event so the history is visible."""
    return _lock_event(store, period, "unlock", actor, reason)


def post_journal_entry(store: Store, journal: JournalIn, actor: str, _reverses: str | None = None) -> JournalOut:
    payload = _payload(journal, _reverses)
    payload_hash = hashlib.sha256(canonical_json(payload).encode("ascii")).hexdigest()

    prior = store.conn.execute("SELECT journal_id, payload_hash, evidence_id FROM journal_entry WHERE idempotency_key = ?",
                               (journal.idempotency_key,)).fetchone()
    if prior:
        if prior["payload_hash"] != payload_hash:
            raise PostingError("idempotency_conflict", "this idempotency key was used for a different journal")
        return JournalOut(prior["journal_id"], prior["evidence_id"], created=False)

    _validate(store, journal)

    with store.transaction() as cur:
        if is_locked(store, journal.period):   # checked again inside the transaction
            raise PostingError("period_locked", f"period {journal.period} is locked")
        n = cur.execute("SELECT COUNT(*) FROM journal_entry").fetchone()[0] + 1
        journal_id = f"J{n:06d}"
        total = sum(l.debit for l in journal.lines)
        ev = write_evidence(
            cur, "reverse_journal_entry" if _reverses else "post_journal_entry",
            {"idempotency_key": journal.idempotency_key, **payload,
             "lines": [{**ln, "debit": to_wire(ln["debit"]), "credit": to_wire(ln["credit"])} for ln in payload["lines"]]},
            {"journal_id": journal_id, "status": "proposed", "total": to_wire(total)},
            [*journal.source_refs, *([{"journal_id": _reverses}] if _reverses else [])], actor)
        cur.execute("INSERT INTO journal_entry (journal_id, idempotency_key, payload_hash, period, status, kind, gaap, "
                    "reverses_journal_id, description, actor, evidence_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                    (journal_id, journal.idempotency_key, payload_hash, journal.period, "proposed", journal.kind,
                     journal.gaap, _reverses, journal.description, actor, ev.evidence_id))
        cur.executemany("INSERT INTO journal_line (journal_id, line_no, account_id, dimensions, debit_minor, credit_minor, "
                        "currency) VALUES (?,?,?,?,?,?,?)",
                        [(journal_id, i + 1, l.account_id, json.dumps(dict(l.dimensions), sort_keys=True), l.debit,
                          l.credit, l.currency) for i, l in enumerate(journal.lines)])
    return JournalOut(journal_id, ev.evidence_id, created=True)


def _validate(store: Store, j: JournalIn) -> None:
    if not j.idempotency_key or len(j.idempotency_key) > 200:
        raise PostingError("bad_key", "idempotency key must be 1 to 200 characters")
    if not _PERIOD.fullmatch(j.period):
        raise PostingError("bad_period", f"period must be YYYY-MM, got {j.period!r}")
    if j.kind not in KINDS:
        raise PostingError("bad_kind", f"kind must be one of {', '.join(KINDS)}")
    if j.gaap not in GAAP_VIEWS:
        raise PostingError("bad_gaap", f"gaap must be one of {', '.join(GAAP_VIEWS)}")
    if len(j.lines) < 2:
        raise PostingError("empty", "a journal needs at least two lines")
    currencies = {l.currency for l in j.lines}
    if len(currencies) != 1:
        raise PostingError("mixed_currency", "one currency per journal in v1")
    minor_units(next(iter(currencies)))   # unknown currency raises
    for i, l in enumerate(j.lines, start=1):
        for amt in (l.debit, l.credit):
            if not isinstance(amt, int) or isinstance(amt, bool):
                raise PostingError("bad_line", f"line {i}: amounts must be int minor units")
        if l.debit < 0 or l.credit < 0:
            raise PostingError("bad_line", f"line {i}: amounts cannot be negative")
        if (l.debit > 0) == (l.credit > 0):
            raise PostingError("bad_line", f"line {i}: exactly one of debit or credit must be above zero")
        r = store.conn.execute("SELECT element_type FROM element WHERE element_id = ?", (l.account_id,)).fetchone()
        if r is None:
            raise PostingError("unknown_account", f"line {i}: {l.account_id} does not exist")
        if r[0] != "account":
            raise PostingError("not_posting_account", f"line {i}: {l.account_id} is a {r[0]}, not an account")
        for dim, member in l.dimensions.items():
            if store.conn.execute("SELECT 1 FROM element WHERE element_id = ? AND element_type = 'member'",
                                  (f"mem:{dim}:{member}",)).fetchone() is None:
                raise PostingError("unknown_member", f"line {i}: unknown {dim} member {member!r}")
    if is_locked(store, j.period):
        raise PostingError("period_locked", f"period {j.period} is locked")
    debits = sum(l.debit for l in j.lines)
    credits = sum(l.credit for l in j.lines)
    if debits != credits:
        raise PostingError("unbalanced", f"debits {debits} != credits {credits} (minor units)")


def reverse_journal_entry(store: Store, journal_id: str, period: str, reason: str,
                          idempotency_key: str, actor: str) -> JournalOut:
    original = store.conn.execute("SELECT * FROM journal_entry WHERE journal_id = ?", (journal_id,)).fetchone()
    if original is None:
        raise PostingError("unknown_journal", f"{journal_id} does not exist")
    if original["kind"] == "reversal":
        raise PostingError("reverse_reversal", "a reversal cannot be reversed; propose the original again instead")
    done = store.conn.execute("SELECT journal_id FROM journal_entry WHERE reverses_journal_id = ?", (journal_id,)).fetchone()
    if done:
        prior = store.conn.execute("SELECT idempotency_key FROM journal_entry WHERE journal_id = ?", (done[0],)).fetchone()
        if prior[0] != idempotency_key:
            raise PostingError("already_reversed", f"{journal_id} was already reversed by {done[0]}")
    lines = [LineIn(r["account_id"], debit=r["credit_minor"], credit=r["debit_minor"], currency=r["currency"],
                    dimensions=json.loads(r["dimensions"]))
             for r in store.conn.execute("SELECT * FROM journal_line WHERE journal_id = ? ORDER BY line_no", (journal_id,))]
    rev = JournalIn(idempotency_key, period, "reversal", f"Reversal of {journal_id}: {reason}", lines,
                    gaap=original["gaap"], source_refs=[{"journal_id": journal_id}])
    return post_journal_entry(store, rev, actor, _reverses=journal_id)


def journal_as_dict(store: Store, journal_id: str) -> dict:
    h = store.conn.execute("SELECT * FROM journal_entry WHERE journal_id = ?", (journal_id,)).fetchone()
    lines = store.conn.execute("SELECT * FROM journal_line WHERE journal_id = ? ORDER BY line_no", (journal_id,)).fetchall()
    return {**dict(h), "lines": [dict(r) for r in lines]}


__all__ = ["LineIn", "JournalIn", "JournalOut", "PostingError", "post_journal_entry", "reverse_journal_entry",
           "lock_period", "unlock_period", "is_locked", "journal_as_dict"]
