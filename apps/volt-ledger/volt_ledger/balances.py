"""Balances (Phase 6 step 3 subset). The full get_balances with concept expansion, GAAP views and fiscal-year
rules from phase3-engine.md section 6 comes with the mapping step."""
from __future__ import annotations

from collections import defaultdict

from .store import Store


def account_balances(store: Store, period: str, include_proposals: bool = True) -> dict[tuple[str, str], int]:
    """Signed balance (debit positive, minor units) per (account_id, dimensions JSON): trial balance rows for the
    period, plus proposed journal lines dated in or before the period."""
    out: dict[tuple[str, str], int] = defaultdict(int)
    for r in store.conn.execute("SELECT account_id, dimensions, debit_minor, credit_minor FROM tb_row WHERE period = ?",
                                (period,)):
        out[(r[0], r[1])] += r[2] - r[3]
    if include_proposals:
        for r in store.conn.execute(
                "SELECT l.account_id, l.dimensions, l.debit_minor, l.credit_minor FROM journal_line l "
                "JOIN journal_entry j ON j.journal_id = l.journal_id WHERE j.period <= ?", (period,)):
            out[(r[0], r[1])] += r[2] - r[3]
    return {k: v for k, v in out.items() if v != 0}
