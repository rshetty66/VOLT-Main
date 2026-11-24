"""Property-based tests from phase3-engine.md section 10.1 (P5 and P6 arrive with the allocation step)."""
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
