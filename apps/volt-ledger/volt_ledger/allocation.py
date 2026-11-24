"""Driver-based allocation (phase3-engine.md section 7; Phase 6 step 5).

This is driver-based allocation logic: a cost pool is split across targets in proportion to a measured driver
(FTEs, transaction counts or RWA) for the same period. Driver values are stored inputs entered by people
(drivers.py), never estimates by the model. The model may propose a rule; the engagement lead approves it; only
then can the engine run it, and the run only proposes a journal (kind 'allocation') through post_journal_entry.

Not in v1: activity-based costing, step-down or reciprocal allocation, fixed-percentage splits, and the
'balance' basis (A26: v1 reads every basis from driver_value rows).
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from decimal import Decimal
from fractions import Fraction
from typing import Mapping, Sequence

from .balances import account_balances
from .drivers import latest_driver
from .evidence import write_evidence
from .mapping import _latest
from .posting import JournalIn, LineIn, post_journal_entry
from .store import Store

BASES = ("fte", "transaction_count", "rwa")


class AllocationError(ValueError):
    def __init__(self, code: str, message: str, details: list | None = None) -> None:
        super().__init__(f"{code}: {message}")
        self.code = code
        self.details = details or []


@dataclass(frozen=True)
class AllocationRule:
    pool_accounts: Sequence[str]
    pool_filter: Mapping[str, str]
    basis: str
    target_dimension: str
    targets: Sequence[str]
    rounding: str = "largest_remainder"


@dataclass(frozen=True)
class AllocationResult:
    rule_id: str
    period: str
    pool: int
    currency: str
    drivers: dict[str, dict] = field(default_factory=dict)   # target -> {"value": str, "evidence_id": str}
    shares: dict[str, int] = field(default_factory=dict)     # minor units per target; sum == pool
    journal_id: str = ""
    evidence_id: str = ""
    created: bool = True


def largest_remainder(pool: int, weights: Mapping[str, Decimal]) -> dict[str, int]:
    """Exact split of an integer pool by non-negative weights (at least one above zero).
    raw_i = pool * w_i / sum(w); base_i = raw_i truncated toward zero; the leftover minor units (with the pool's
    sign) go to the targets with the largest fractional parts, ties to the target id that sorts first.
    Exact rational arithmetic, so no precision is lost however large the pool."""
    if not weights:
        raise AllocationError("no_targets", "at least one target is needed")
    w = {k: Fraction(v) for k, v in weights.items()}
    if any(v < 0 for v in w.values()):
        raise AllocationError("negative_driver", "driver values cannot be negative")
    total = sum(w.values())
    if total == 0:
        raise AllocationError("zero_drivers", "all driver values are zero")
    raw = {k: Fraction(pool) * v / total for k, v in w.items()}
    base = {k: int(r) for k, r in raw.items()}            # int() truncates toward zero
    leftover = pool - sum(base.values())
    sign = 1 if leftover > 0 else -1
    order = sorted(raw, key=lambda k: (-abs(raw[k] - base[k]), k))
    for k in order[:abs(leftover)]:
        base[k] += sign
    return base


def _check_rule(store: Store, rule: AllocationRule) -> None:
    def is_type(eid: str, t: str) -> bool:
        return store.conn.execute("SELECT 1 FROM element WHERE element_id = ? AND element_type = ?", (eid, t)).fetchone() is not None
    if not rule.pool_accounts:
        raise AllocationError("no_pool", "name at least one pool account")
    bad = [a for a in rule.pool_accounts if not is_type(a, "account")]
    if bad:
        raise AllocationError("unknown_account", "pool accounts must be trial-balance accounts", bad)
    if rule.basis not in BASES:
        raise AllocationError("bad_basis", f"basis must be one of {', '.join(BASES)}")
    if not rule.targets or len(set(rule.targets)) != len(rule.targets):
        raise AllocationError("bad_targets", "targets must be a non-empty list without repeats")
    bad = [f"{d}:{m}" for d, m in rule.pool_filter.items() if not is_type(f"mem:{d}:{m}", "member")]
    bad += [f"{rule.target_dimension}:{t}" for t in rule.targets if not is_type(f"mem:{rule.target_dimension}:{t}", "member")]
    if bad:
        raise AllocationError("unknown_member", "unknown dimension members", bad)
    if rule.target_dimension in rule.pool_filter:
        raise AllocationError("bad_rule", "the target dimension cannot also filter the pool")
    if rule.rounding != "largest_remainder":
        raise AllocationError("bad_rounding", "v1 rounds by largest remainder only")


def propose_allocation_rule(store: Store, rule: AllocationRule, rationale: str, actor: str) -> tuple[str, str, str]:
    """Record a proposed rule and queue it for the engagement lead. Returns (rule_id, review_item_id, evidence_id)."""
    _check_rule(store, rule)
    if not rationale.strip():
        raise AllocationError("no_rationale", "say why this pool, basis and targets fit")
    definition = json.dumps({**asdict(rule), "pool_filter": dict(sorted(rule.pool_filter.items()))}, sort_keys=True)
    with store.transaction() as cur:
        n = cur.execute("SELECT COUNT(*) FROM allocation_rule").fetchone()[0] + 1
        rule_id = f"rule:{n:06d}"
        ev = write_evidence(cur, "propose_allocation_rule", {"rule": json.loads(definition), "rationale": rationale},
                            {"rule_id": rule_id}, [{"element_id": a} for a in rule.pool_accounts], actor)
        item_id = f"R{cur.execute('SELECT COUNT(*) FROM review_item').fetchone()[0] + 1:06d}"
        cur.execute("INSERT INTO review_item (item_id, kind, ref_id, reason, evidence_id) VALUES (?,?,?,?,?)",
                    (item_id, "allocation_rule", rule_id, "always_review", ev.evidence_id))
        cur.execute("INSERT INTO allocation_rule (rule_id, definition, proposed_by, review_item_id, evidence_id) "
                    "VALUES (?,?,?,?,?)", (rule_id, definition, actor, item_id, ev.evidence_id))
    return rule_id, item_id, ev.evidence_id


def load_rule(store: Store, rule_id: str) -> tuple[AllocationRule, str]:
    r = store.conn.execute("SELECT definition, review_item_id FROM allocation_rule WHERE rule_id = ?", (rule_id,)).fetchone()
    if r is None:
        raise AllocationError("unknown_rule", rule_id)
    return AllocationRule(**json.loads(r[0])), r[1]


def run_allocation(store: Store, rule_id: str, period: str, idempotency_key: str, actor: str) -> AllocationResult:
    rule, item_id = load_rule(store, rule_id)
    if _latest(store, item_id, "engagement_lead") != "approve":
        raise AllocationError("rule_not_approved", f"{rule_id} needs engagement-lead approval before it can run")

    # A replay with the same key returns the journal it made the first time (the pool is empty by then).
    prior = store.conn.execute("SELECT journal_id, evidence_id FROM journal_entry WHERE idempotency_key = ?",
                               (idempotency_key,)).fetchone()
    if prior is not None:
        return _replayed(store, rule, rule_id, period, prior[0], prior[1])

    # 1. The pool: every balance on a pool account whose dimensions match the filter.
    pool_lines = [(acct, json.loads(dims), bal) for (acct, dims), bal in sorted(account_balances(store, period).items())
                  if acct in rule.pool_accounts
                  and all(json.loads(dims).get(k) == v for k, v in rule.pool_filter.items())]
    if not pool_lines:
        raise AllocationError("empty_pool", f"no balance on the pool accounts for {period} matching {dict(rule.pool_filter)}")
    currencies = {r[0] for r in store.conn.execute(
        f"SELECT DISTINCT currency FROM tb_row WHERE period = ? AND account_id IN ({','.join('?' * len(rule.pool_accounts))})",
        (period, *rule.pool_accounts))}
    if len(currencies) != 1:
        raise AllocationError("mixed_currency", f"the pool must be in one currency, found {sorted(currencies)}")
    currency = currencies.pop()

    # 2. Drivers: one stored value per target for the same period.
    drivers, missing = {}, []
    for t in rule.targets:
        d = latest_driver(store, rule.basis, period, {rule.target_dimension: t})
        if d is None:
            missing.append(t)
        else:
            drivers[t] = d
    if missing:
        raise AllocationError("missing_driver", f"no {rule.basis} value for {period}", missing)
    weights = {t: d["value"] for t, d in drivers.items()}
    negative = [t for t, v in weights.items() if v < 0]
    if negative:
        raise AllocationError("negative_driver", "driver values cannot be negative", negative)
    if not any(weights.values()):
        raise AllocationError("zero_drivers", "all driver values are zero")

    # 3 and 4. Split each pool balance exactly and build one journal: move each balance out of the pool and onto the
    # same natural account for each target, so the expense type is kept (A19).
    lines: list[LineIn] = []
    shares = {t: 0 for t in rule.targets}
    for acct, dims, bal in pool_lines:
        split = largest_remainder(bal, weights)
        lines.append(LineIn(acct, debit=-bal if bal < 0 else 0, credit=bal if bal > 0 else 0, currency=currency,
                            dimensions=dims))
        keep = {k: v for k, v in dims.items() if k not in rule.pool_filter and k != rule.target_dimension}
        for t in rule.targets:
            s = split[t]
            shares[t] += s
            if s:
                lines.append(LineIn(acct, debit=s if s > 0 else 0, credit=-s if s < 0 else 0, currency=currency,
                                    dimensions={**keep, rule.target_dimension: t}))
    pool = sum(b for _, _, b in pool_lines)
    j = JournalIn(idempotency_key, period, "allocation",
                  f"Driver-based allocation {rule_id}: {rule.basis} across {rule.target_dimension}", lines,
                  source_refs=[{"allocation_rule": rule_id}] + [{"driver": d["value_id"], "evidence_id": d["evidence_id"]}
                                                                 for d in drivers.values()])
    out = post_journal_entry(store, j, actor)
    return AllocationResult(rule_id, period, pool, currency,
                            {t: {"value": str(d["value"]), "evidence_id": d["evidence_id"]} for t, d in drivers.items()},
                            shares, out.journal_id, out.evidence_id, out.created)


def _replayed(store: Store, rule: AllocationRule, rule_id: str, period: str, journal_id: str, evidence_id: str) -> AllocationResult:
    j = store.conn.execute("SELECT kind, description FROM journal_entry WHERE journal_id = ?", (journal_id,)).fetchone()
    if j[0] != "allocation" or not j[1].startswith(f"Driver-based allocation {rule_id}:"):
        raise AllocationError("idempotency_conflict", "this idempotency key was used for a different journal")
    shares = {t: 0 for t in rule.targets}
    pool, currency = 0, ""
    for r in store.conn.execute("SELECT dimensions, debit_minor, credit_minor, currency FROM journal_line WHERE journal_id = ?",
                                (journal_id,)):
        dims, signed, currency = json.loads(r[0]), r[1] - r[2], r[3]
        t = dims.get(rule.target_dimension)
        if t in shares and not all(dims.get(k) == v for k, v in rule.pool_filter.items()):
            shares[t] += signed
        else:
            pool -= signed
    return AllocationResult(rule_id, period, pool, currency, {}, shares, journal_id, evidence_id, created=False)
