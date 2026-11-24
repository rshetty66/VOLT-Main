import sqlite3

import pytest

from volt_ledger.balances import account_balances
from volt_ledger.evidence import verify_chain
from volt_ledger.posting import (JournalIn, LineIn, PostingError, lock_period, post_journal_entry,
                                 reverse_journal_entry, unlock_period)

FEES = "acct:SYNBANK:4100"
INTEREST = "acct:SYNBANK:4000"


def reclass(key="k1", amount=1_000_000_00, period="2026-09"):
    return JournalIn(key, period, "reclass", "Move EIR-integral loan fees to interest income", [
        LineIn(FEES, debit=amount, dimensions={"BusinessLine": "Retail"}),
        LineIn(INTEREST, credit=amount, dimensions={"BusinessLine": "Retail"}),
    ])


def test_balanced_journal_is_stored_with_evidence(bank):
    out = post_journal_entry(bank, reclass(), "user:test")
    assert out.created and out.journal_id == "J000001"
    assert bank.count("journal_line") == 2
    assert verify_chain(bank) == []


def test_unbalanced_journal_raises_and_writes_nothing(bank):
    before = (bank.count("journal_entry"), bank.count("evidence"))
    bad = JournalIn("k2", "2026-09", "adjustment", "x", [LineIn(FEES, debit=100), LineIn(INTEREST, credit=99)])
    with pytest.raises(PostingError) as e:
        post_journal_entry(bank, bad, "user:test")
    assert e.value.code == "unbalanced"
    assert (bank.count("journal_entry"), bank.count("evidence")) == before


@pytest.mark.parametrize("lines,code", [
    ([LineIn(FEES, debit=100)], "empty"),
    ([LineIn(FEES, debit=100, credit=100), LineIn(INTEREST, credit=0, debit=0)], "bad_line"),
    ([LineIn("acct:SYNBANK:9999", debit=1), LineIn(INTEREST, credit=1)], "unknown_account"),
    ([LineIn("canon:InterestIncome", debit=1), LineIn(INTEREST, credit=1)], "not_posting_account"),
    ([LineIn(FEES, debit=1, dimensions={"BusinessLine": "Mars"}), LineIn(INTEREST, credit=1)], "unknown_member"),
    ([LineIn(FEES, debit=1), LineIn(INTEREST, credit=1, currency="EUR")], "mixed_currency"),
])
def test_validation(bank, lines, code):
    with pytest.raises(PostingError) as e:
        post_journal_entry(bank, JournalIn("kv", "2026-09", "adjustment", "x", lines), "user:test")
    assert e.value.code == code


def test_reversal_restores_balances(bank):
    before = account_balances(bank, "2026-09")
    j = post_journal_entry(bank, reclass(), "user:test")
    assert account_balances(bank, "2026-09") != before
    reverse_journal_entry(bank, j.journal_id, "2026-09", "test", "rev-1", "user:test")
    assert account_balances(bank, "2026-09") == before


def test_journal_reversed_once_only(bank):
    j = post_journal_entry(bank, reclass(), "user:test")
    r1 = reverse_journal_entry(bank, j.journal_id, "2026-09", "test", "rev-1", "user:test")
    assert reverse_journal_entry(bank, j.journal_id, "2026-09", "test", "rev-1", "user:test").journal_id == r1.journal_id
    with pytest.raises(PostingError, match="already_reversed"):
        reverse_journal_entry(bank, j.journal_id, "2026-09", "test", "rev-2", "user:test")
    with pytest.raises(PostingError, match="reverse_reversal"):
        reverse_journal_entry(bank, r1.journal_id, "2026-09", "test", "rev-3", "user:test")


def test_period_lock_blocks_posting(bank):
    lock_period(bank, "2026-09", "user:lead", "close")
    with pytest.raises(PostingError, match="period_locked"):
        post_journal_entry(bank, reclass(), "user:test")
    unlock_period(bank, "2026-09", "user:lead", "reopen for adjustment")
    assert post_journal_entry(bank, reclass(), "user:test").created


def test_idempotency(bank):
    a = post_journal_entry(bank, reclass(), "user:test")
    b = post_journal_entry(bank, reclass(), "user:test")
    assert (a.journal_id, b.created) == (b.journal_id, False)
    with pytest.raises(PostingError, match="idempotency_conflict"):
        post_journal_entry(bank, reclass(amount=5), "user:test")


@pytest.mark.parametrize("sql", ["UPDATE journal_line SET debit_minor = 1", "DELETE FROM journal_entry",
                                 "UPDATE evidence SET actor = 'x'", "DELETE FROM tb_row"])
def test_append_only(bank, sql):
    post_journal_entry(bank, reclass(), "user:test")
    with pytest.raises(sqlite3.DatabaseError, match="append-only"):
        bank.conn.execute(sql)
