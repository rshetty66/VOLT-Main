"""Property-based tests from phase3-engine.md section 10.1 (P1 to P10)."""
from __future__ import annotations

import csv
import io
import sqlite3
import tempfile
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from tests.conftest import COLUMNS, SYNTHETIC_TB, fresh_store
from volt_ledger.balances import account_balances
from volt_ledger.evidence import verify_chain
from volt_ledger.ingest import ColumnMap, ingest_trial_balance
from volt_ledger.mapping import map_line_item_to_element, record_review_decision
from volt_ledger.money import MINOR_UNITS, format_amount, from_wire, parse_amount, to_wire
from volt_ledger.posting import JournalIn, LineIn, PostingError, lock_period, post_journal_entry, reverse_journal_entry
from volt_ledger.store import APPEND_ONLY_TABLES

SETTINGS = settings(max_examples=int(__import__("os").environ.get("VOLT_PROPERTY_EXAMPLES", "300")), deadline=None,
                    suppress_health_check=[HealthCheck.too_slow, HealthCheck.function_scoped_fixture])

_BASE = fresh_store()
ingest_trial_balance(_BASE, SYNTHETIC_TB, "SYNBANK", "2026-09", "USD", COLUMNS)
ACCOUNTS = [r[0] for r in _BASE.conn.execute("SELECT element_id FROM element WHERE element_type='account' ORDER BY 1")]
_BASE.close()


def bank():
    s = fresh_store()
    ingest_trial_balance(s, SYNTHETIC_TB, "SYNBANK", "2026-09", "USD", COLUMNS)
    return s


amounts = st.integers(min_value=1, max_value=10**15)
side_lines = st.lists(st.tuples(st.sampled_from(ACCOUNTS), amounts), min_size=1, max_size=6)


@st.composite
def balanced_journal(draw, key="k"):
    debits = draw(side_lines)
    total = sum(a for _, a in debits)
    n = draw(st.integers(min_value=1, max_value=4))
    cuts = sorted(draw(st.lists(st.integers(min_value=1, max_value=max(total - 1, 1)), min_size=n - 1, max_size=n - 1,
                                unique=True))) if total > n else []
    parts = [b - a for a, b in zip([0, *cuts], [*cuts, total])]
    credits = [(draw(st.sampled_from(ACCOUNTS)), p) for p in parts if p > 0]
    lines = [LineIn(a, debit=v) for a, v in debits] + [LineIn(a, credit=v) for a, v in credits]
    return JournalIn(key, "2026-09", "adjustment", "generated", lines)


@SETTINGS
@given(balanced_journal(), st.integers(min_value=-3, max_value=3).filter(lambda x: x != 0))
def test_p1_balanced_iff_stored(j, nudge):
    s = bank()
    assert post_journal_entry(s, j, "prop").created
    first = j.lines[0]
    if first.debit + nudge <= 0:
        return
    bad = JournalIn("k-bad", j.period, j.kind, j.description,
                    [LineIn(first.account_id, debit=first.debit + nudge), *j.lines[1:]])
    before = (s.count("journal_entry"), s.count("journal_line"), s.count("evidence"))
    with pytest.raises(PostingError, match="unbalanced"):
        post_journal_entry(s, bad, "prop")
    assert (s.count("journal_entry"), s.count("journal_line"), s.count("evidence")) == before


@SETTINGS
@given(balanced_journal(key="a"), balanced_journal(key="b"))
def test_p2_reversal_restores_state(prior, j):
    s = bank()
    post_journal_entry(s, prior, "prop")
    before = account_balances(s, "2026-09")
    out = post_journal_entry(s, j, "prop")
    reverse_journal_entry(s, out.journal_id, "2026-09", "prop", "rev", "prop")
    assert account_balances(s, "2026-09") == before


@SETTINGS
@given(balanced_journal(), st.lists(st.sampled_from(["2026-08", "2026-09", "2026-10"]), max_size=3, unique=True))
def test_p3_locked_periods_refuse(j, locked):
    s = bank()
    for p in locked:
        lock_period(s, p, "prop", "test")
    before = (s.count("journal_entry"), s.count("evidence"))
    if "2026-09" in locked:
        with pytest.raises(PostingError, match="period_locked"):
            post_journal_entry(s, j, "prop")
        assert (s.count("journal_entry"), s.count("evidence")) == before
    else:
        assert post_journal_entry(s, j, "prop").created


@SETTINGS
@given(balanced_journal())
def test_p4_idempotency(j):
    s = bank()
    a = post_journal_entry(s, j, "prop")
    b = post_journal_entry(s, j, "prop")
    assert a.journal_id == b.journal_id and not b.created and s.count("journal_entry") == 1
    changed = JournalIn(j.idempotency_key, j.period, j.kind, j.description + " (edited)", j.lines)
    with pytest.raises(PostingError, match="idempotency_conflict"):
        post_journal_entry(s, changed, "prop")


@SETTINGS
@given(st.integers(min_value=-10**18, max_value=10**18), st.sampled_from(sorted(MINOR_UNITS)))
def test_p7_money_round_trips(x, cur):
    assert parse_amount(format_amount(x, cur), cur) == x
    assert from_wire(to_wire(x)) == x


@SETTINGS
@given(st.sampled_from(APPEND_ONLY_TABLES), st.sampled_from(["UPDATE {t} SET rowid = rowid", "DELETE FROM {t}"]))
def test_p8_append_only(table, sql):
    s = bank()
    post_journal_entry(s, JournalIn("k", "2026-09", "adjustment", "x",
                                    [LineIn(ACCOUNTS[0], debit=5), LineIn(ACCOUNTS[1], credit=5)]), "prop")
    lock_period(s, "2026-10", "prop", "x")
    m = map_line_item_to_element(s, ACCOUNTS[0], "canon:CashAndCentralBankBalances", "0.9", "x", "model")
    record_review_decision(s, m.review_item_id, "engagement_lead", "approve", "user:prop")
    from volt_ledger.allocation import AllocationRule, propose_allocation_rule
    from volt_ledger.drivers import record_driver_value
    record_driver_value(s, "driver", "fte", "2026-09", {"BusinessLine": "Retail"}, "1", "FTE", {"user": "p"}, "user:p")
    propose_allocation_rule(s, AllocationRule(["acct:SYNBANK:6100"], {"CostCentre": "IT01"}, "fte", "BusinessLine",
                                              ["Retail"]), "p8", "model")
    s.conn.execute("INSERT INTO peer_document (doc_id, peer_id, period, doc_type, url, source_tier, retrieved_utc, sha256, "
                   "pages, bytes, path, evidence_id) VALUES ('P00001','td','FY2026-Q3','press_release','https://www.td.com/x.pdf',"
                   "'primary','2026-11-24T00:00:00Z','00',1,1,'/x.pdf','E000001')")
    assert s.conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] > 0   # triggers fire only on existing rows
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        s.conn.execute(sql.format(t=table))


@SETTINGS
@given(st.lists(balanced_journal(), min_size=1, max_size=3), st.data())
def test_p9_tampering_is_detected(journals, data):
    s = bank()
    for i, j in enumerate(journals):
        post_journal_entry(s, JournalIn(f"k{i}", j.period, j.kind, j.description, j.lines), "prop")
    assert verify_chain(s) == []
    n = s.count("evidence")
    target = data.draw(st.integers(min_value=1, max_value=n))
    s.conn.execute("DROP TRIGGER evidence_no_update")   # simulate someone bypassing the database guard
    s.conn.execute("UPDATE evidence SET outputs = outputs || ' ' WHERE seq = ?", (target,))
    assert verify_chain(s) != []


cell = st.one_of(st.just(""), st.text(alphabet="0123456789.,-()", max_size=12),
                 st.decimals(min_value=0, max_value=10**9, places=2, allow_nan=False).map(lambda d: f"{d:,.2f}"))
row = st.tuples(st.one_of(st.just(""), st.from_regex(r"[0-9]{3,5}", fullmatch=True), st.just("bad code!")),
                st.text(alphabet="abc ", max_size=8), cell, cell)


@SETTINGS
@given(st.lists(row, max_size=25))
def test_p10_every_row_accounted_for(rows):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["account_code", "account_name", "debit", "credit"])
    w.writerows(rows)
    with tempfile.TemporaryDirectory() as d:
        f = Path(d) / "tb.csv"
        f.write_text(buf.getvalue())
        s = fresh_store()
        r = ingest_trial_balance(s, f, "P10", "2026-09", "USD", ColumnMap())
        n_rows = len(list(csv.reader(io.StringIO(buf.getvalue())))) - 1
        assert r.data_rows == n_rows
        assert r.stored + len(r.rejected) == n_rows
        assert s.count("tb_row") == r.stored


# ---- P5 and P6: allocation (Phase 6 step 5) ---------------------------------------------------------------------

from decimal import Decimal  # noqa: E402
from fractions import Fraction  # noqa: E402

from volt_ledger.allocation import AllocationRule, largest_remainder, propose_allocation_rule, run_allocation  # noqa: E402
from volt_ledger.drivers import record_driver_value  # noqa: E402

weights_st = st.dictionaries(st.text("ABCDEFGHIJKLMNOPQRSTUVWXYZ", min_size=1, max_size=3),
                             st.decimals(min_value=0, max_value=10**9, places=4, allow_nan=False, allow_infinity=False),
                             min_size=1, max_size=50).filter(lambda w: any(v > 0 for v in w.values()))


@SETTINGS
@given(pool=st.integers(min_value=-10**15, max_value=10**15), weights=weights_st)
def test_p5_largest_remainder_is_exact(pool, weights):
    shares = largest_remainder(pool, weights)
    assert sum(shares.values()) == pool
    total = sum(Fraction(v) for v in weights.values())
    for k, v in weights.items():
        assert abs(Fraction(shares[k]) - Fraction(pool) * Fraction(v) / total) < 1


IT_POOL_ACCTS = ["acct:SYNBANK:6000", "acct:SYNBANK:6100", "acct:SYNBANK:6400"]
LINES = ["Retail", "Commercial", "Wealth", "Treasury"]


@settings(max_examples=max(20, SETTINGS.max_examples // 10), deadline=None)
@given(pool_accts=st.lists(st.sampled_from(IT_POOL_ACCTS), min_size=1, max_size=3, unique=True),
       drivers=st.lists(st.integers(min_value=0, max_value=10**6), min_size=4, max_size=4).filter(any))
def test_p6_allocation_moves_exactly_the_pool(pool_accts, drivers):
    s = bank()
    for bl, v in zip(LINES, drivers):
        record_driver_value(s, "driver", "fte", "2026-09", {"BusinessLine": bl}, str(v), "FTE", {"user": "t"}, "user:t")
    rule = AllocationRule(pool_accts, {"CostCentre": "IT01"}, "fte", "BusinessLine", LINES)
    rule_id, item, _ = propose_allocation_rule(s, rule, "p6", "model")
    record_review_decision(s, item, "engagement_lead", "approve", "user:lead")
    before = account_balances(s, "2026-09")
    in_pool = lambda d: '"CostCentre": "IT01"' in d  # noqa: E731
    pool_before = sum(b for (a, d), b in before.items() if a in pool_accts and in_pool(d))
    r = run_allocation(s, rule_id, "2026-09", "p6", "model")
    after = account_balances(s, "2026-09")
    assert r.pool == pool_before and sum(r.shares.values()) == pool_before
    assert sum(b for (a, d), b in after.items() if a in pool_accts and in_pool(d)) == 0
    moved = sum(after.get(k, 0) - before.get(k, 0) for k in set(after) | set(before)
                if k[0] in pool_accts and not in_pool(k[1]))
    assert moved == pool_before
    # Every account's total is unchanged: allocation only moves cost between dimensions.
    for a in pool_accts:
        assert sum(b for (x, _), b in after.items() if x == a) == sum(b for (x, _), b in before.items() if x == a)
    s.close()
