"""Finance information model: lineage from GL balance to instrument, and adjustments at both levels."""
from __future__ import annotations

import sqlite3

import pytest

from volt_ledger import fim
from volt_ledger.fim import FimError
from volt_ledger.mapping import record_review_decision
from volt_ledger.store import Store


@pytest.fixture
def model(store: Store) -> Store:
    fim.load_information_model(store)
    return store


def mortgage_in_stage3(s: Store) -> dict:
    t = fim.trace_gl_balance(s, "13900", {"product": "MTG", "credit_stage": "3"})
    return t["instruments"][0]


def test_loading_is_idempotent_and_recorded(store):
    a = fim.load_information_model(store)
    b = fim.load_information_model(store)
    assert a["created"] and not b["created"] and a["dataset_id"] == b["dataset_id"]
    assert a["contracts"] == 438 and store.count("fim_dataset") == 1
    with pytest.raises(FimError, match="unknown_dataset"):
        fim.load_information_model(store, "client.xlsx")


def test_tools_refuse_before_the_model_is_loaded(store):
    with pytest.raises(FimError, match="no_dataset"):
        fim.trace_gl_balance(store, "13100")


def test_every_instrument_backed_and_ifrs17_balance_ties_to_the_cent(model):
    r = fim.reconcile(model)
    assert r["balances_checked"] == 46 and r["ties"] == 46 and r["breaks"] == []


def test_a_loan_balance_traces_to_its_contracts(model):
    t = fim.trace_gl_balance(model, "13100", {"business_line": "Retail"})
    assert t["backing"] == "instrument" and t["status"] == "ties"
    assert t["gl_minor"] == t["from_instruments_minor"] == sum(c["amount_minor"] for c in
                                                                fim.trace_gl_balance(model, "13100", {"business_line": "Retail"}, top=10_000)["instruments"])
    assert t["untraced_minor"] == 0 and len(t["instruments"]) == 20 and t["instrument_count"] > 20
    assert all(c["via"] == ["position CARRYING x 1"] for c in t["instruments"])


def test_insurance_liabilities_trace_to_ifrs17_groups(model):
    t = fim.trace_gl_balance(model, "24100")
    assert t["backing"] == "ifrs17_group" and t["status"] == "ties" and t["untraced_minor"] == 0
    with pytest.raises(FimError, match="bad_filter"):
        fim.trace_gl_balance(model, "24100", {"business_line": "Retail"})


def test_income_traces_through_journals_and_the_rest_is_shown_not_hidden(model):
    t = fim.trace_gl_balance(model, "41100")
    assert t["backing"] == "journal" and t["status"] == "partly_traced"
    assert t["from_instruments_minor"] != 0 and t["gl_minor"] == t["from_instruments_minor"] + t["untraced_minor"]
    assert "journal ACCRUAL" in t["instruments"][0]["via"]


def test_bad_requests_are_refused(model):
    for account, filters, code in [("99999", {}, "unknown_account"), ("60000", {}, "not_posting"),
                                   ("13100", {"cost_centre": "IT01"}, "bad_filter")]:
        with pytest.raises(FimError, match=code):
            fim.trace_gl_balance(model, account, filters)


def test_instrument_adjustment_flows_to_gl_and_still_ties(model):
    inst = mortgage_in_stage3(model)
    before = fim.trace_gl_balance(model, "13900", {"product": "MTG"})
    a = fim.propose_adjustment(model, "instrument", "2026-09", "ecl_overlay", "rate shock overlay", [
        {"account": "70000", "instrument_id": inst["instrument_id"], "debit_minor": 1_000_000_00},
        {"account": "13900", "instrument_id": inst["instrument_id"], "credit_minor": 1_000_000_00}], "model")
    assert a["lines"][1]["credit_stage"] == "3" and a["lines"][1]["business_line"] == inst["business_line"]
    after = fim.trace_gl_balance(model, "13900", {"product": "MTG"})
    assert after["adjusted_gl_minor"] == before["gl_minor"] - 1_000_000_00
    assert after["instrument_adjustments_minor"] == -1_000_000_00 and after["status"] == "ties"
    assert after["adjustments"][0]["review"] == "awaiting_review"
    assert fim.instrument_summary(model, inst["instrument_id"])["adjustments"][0]["adj_id"] == a["adj_id"]
    assert fim.reconcile(model)["breaks"] == []


def test_gl_adjustment_is_owned_at_gl_level(model):
    a = fim.propose_adjustment(model, "gl", "2026-09", "top_side", "bonus accrual", [
        {"account": "61000", "debit_minor": 500_00, "segments": {"business_line": "Retail"}},
        {"account": "23900", "credit_minor": 500_00}], "model")
    t = fim.trace_gl_balance(model, "23900")
    assert t["gl_adjustments_minor"] == -500_00 and t["adjusted_gl_minor"] == t["gl_minor"] - 500_00
    record_review_decision(model, a["review_item_id"], "engagement_lead", "reject", "user:lead")
    assert fim.trace_gl_balance(model, "23900")["gl_adjustments_minor"] == 0


def test_reversal_restores_balances_once(model):
    inst = mortgage_in_stage3(model)
    a = fim.propose_adjustment(model, "instrument", "2026-09", "ecl_overlay", "overlay", [
        {"account": "70000", "instrument_id": inst["instrument_id"], "debit_minor": 250_00},
        {"account": "13900", "instrument_id": inst["instrument_id"], "credit_minor": 250_00}], "model")
    r = fim.reverse_adjustment(model, a["adj_id"], "no longer needed", "model")
    t = fim.trace_gl_balance(model, "13900", {"product": "MTG"})
    assert t["adjusted_gl_minor"] == t["gl_minor"] and len(t["adjustments"]) == 2
    with pytest.raises(FimError, match="already_reversed"):
        fim.reverse_adjustment(model, a["adj_id"], "again", "model")
    with pytest.raises(FimError, match="is_reversal"):
        fim.reverse_adjustment(model, r["adj_id"], "undo the undo", "model")


@pytest.mark.parametrize("level, lines, message", [
    ("gl", [{"account": "61000", "debit_minor": 100}, {"account": "23900", "credit_minor": 99}], "unbalanced"),
    ("gl", [{"account": "60000", "debit_minor": 100}, {"account": "23900", "credit_minor": 100}], "roll-up"),
    ("gl", [{"account": "61000", "debit_minor": 100, "credit_minor": 100}, {"account": "23900", "credit_minor": 100}],
     "exactly one"),
    ("gl", [{"account": "61000", "debit_minor": 100, "segments": {"business_line": "Mars"}},
            {"account": "23900", "credit_minor": 100}], "not a member"),
    ("gl", [{"account": "61000", "debit_minor": 100, "instrument_id": "01-000001"},
            {"account": "23900", "credit_minor": 100}], "names no instrument"),
    ("instrument", [{"account": "70000", "debit_minor": 100}, {"account": "13900", "credit_minor": 100}],
     "not found"),
])
def test_invalid_adjustments_are_refused(model, level, lines, message):
    with pytest.raises(FimError, match=message):
        fim.propose_adjustment(model, level, "2026-09", "other", "test", lines, "model")
    assert model.count("adjustment") == 0


def test_instrument_segments_cannot_be_overridden(model):
    inst = mortgage_in_stage3(model)
    with pytest.raises(FimError, match="differ from instrument"):
        fim.propose_adjustment(model, "instrument", "2026-09", "ecl_overlay", "x", [
            {"account": "70000", "instrument_id": inst["instrument_id"], "debit_minor": 100,
             "segments": {"business_line": "Wealth"}},
            {"account": "13900", "instrument_id": inst["instrument_id"], "credit_minor": 100}], "model")


def test_adjustments_are_append_only(model):
    fim.propose_adjustment(model, "gl", "2026-09", "top_side", "x", [
        {"account": "61000", "debit_minor": 100}, {"account": "23900", "credit_minor": 100}], "model")
    for t in ("adjustment", "adjustment_line", "fim_dataset"):
        with pytest.raises(sqlite3.DatabaseError, match="append-only"):
            model.conn.execute(f"DELETE FROM {t}")


def test_amounts_keep_exact_cents(model):
    assert fim.cents("741867.68") == 74186768 and fim.cents(None) == 0
    with pytest.raises(FimError, match="precision"):
        fim.cents("1.005")
