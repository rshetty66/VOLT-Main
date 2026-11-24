"""Driver-based allocation (Phase 6 step 5): rules, drivers, the engine and its golden cases."""
from __future__ import annotations

from decimal import Decimal

import pytest

from volt_ledger.allocation import (AllocationError, AllocationRule, largest_remainder, propose_allocation_rule,
                                    run_allocation)
from volt_ledger.balances import account_balances
from volt_ledger.drivers import DriverError, latest_driver, record_driver_value
from volt_ledger.evidence import verify_chain
from volt_ledger.mapping import record_review_decision

IT_POOL = ["acct:SYNBANK:6000", "acct:SYNBANK:6100", "acct:SYNBANK:6400"]
IT_RULE = AllocationRule(pool_accounts=IT_POOL, pool_filter={"CostCentre": "IT01"}, basis="fte",
                         target_dimension="BusinessLine", targets=["Retail", "Commercial", "Wealth"])
LEAD = "user:lead"


def fte(store, values: dict[str, str], period="2026-09"):
    for bl, v in values.items():
        record_driver_value(store, "driver", "fte", period, {"BusinessLine": bl}, v, "FTE",
                            {"user": "lead", "note": "HR headcount"}, LEAD)


def approved_rule(store, rule=IT_RULE) -> str:
    rule_id, item, _ = propose_allocation_rule(store, rule, "IT serves the business lines in proportion to staff", "model")
    record_review_decision(store, item, "engagement_lead", "approve", LEAD)
    return rule_id


def by_target(store, period="2026-09") -> dict[str, int]:
    out: dict[str, int] = {}
    for (acct, dims), bal in account_balances(store, period).items():
        if acct in IT_POOL and '"CostCentre"' not in dims:
            bl = __import__("json").loads(dims).get("BusinessLine")
            out[bl] = out.get(bl, 0) + bal
    return out


# ---- largest remainder ------------------------------------------------------------------------------------------

def test_golden_three_way_split_of_100():
    """phase3-engine.md 7.2: 100.00 over drivers 1, 1, 1 gives 33.34 / 33.33 / 33.33, leftover to the first id."""
    assert largest_remainder(10000, {"A": Decimal(1), "B": Decimal(1), "C": Decimal(1)}) == {"A": 3334, "B": 3333, "C": 3333}


def test_negative_pool_keeps_sign_and_sums():
    s = largest_remainder(-10000, {"A": Decimal(1), "B": Decimal(1), "C": Decimal(1)})
    assert s == {"A": -3334, "B": -3333, "C": -3333}


def test_zero_weight_target_gets_nothing_and_bad_weights_refused():
    assert largest_remainder(101, {"A": Decimal(1), "B": Decimal(0)}) == {"A": 101, "B": 0}
    with pytest.raises(AllocationError, match="zero_drivers"):
        largest_remainder(100, {"A": Decimal(0)})
    with pytest.raises(AllocationError, match="negative_driver"):
        largest_remainder(100, {"A": Decimal(-1), "B": Decimal(2)})


# ---- drivers ----------------------------------------------------------------------------------------------------

def test_driver_values_are_people_only_strings_and_superseded_not_overwritten(bank):
    with pytest.raises(DriverError, match="not_a_person"):
        record_driver_value(bank, "driver", "fte", "2026-09", {"BusinessLine": "Retail"}, "120", "FTE", {}, "model")
    with pytest.raises(DriverError, match="bad_value"):
        record_driver_value(bank, "driver", "fte", "2026-09", {"BusinessLine": "Retail"}, 120.0, "FTE", {}, LEAD)
    with pytest.raises(DriverError, match="unknown_member"):
        record_driver_value(bank, "driver", "fte", "2026-09", {"BusinessLine": "Mars"}, "1", "FTE", {}, LEAD)
    fte(bank, {"Retail": "100"})
    fte(bank, {"Retail": "120"})
    assert latest_driver(bank, "fte", "2026-09", {"BusinessLine": "Retail"})["value"] == Decimal(120)
    assert bank.count("driver_value") == 2


# ---- rules and runs ---------------------------------------------------------------------------------------------

def test_golden_it_allocation_to_the_cent(bank):
    """IT01 pool 143,000,000.00 (salaries 40m, IT costs 85m, software 18m) by FTE 120 / 45 / 35."""
    fte(bank, {"Retail": "120", "Commercial": "45", "Wealth": "35"})
    rule_id = approved_rule(bank)
    r = run_allocation(bank, rule_id, "2026-09", "alloc-it-2026-09", "model")
    assert r.pool == 14_300_000_000
    assert r.shares == {"Retail": 8_580_000_000, "Commercial": 3_217_500_000, "Wealth": 2_502_500_000}
    assert sum(r.shares.values()) == r.pool
    assert by_target(bank) == r.shares
    # The IT01 cost centre is empty after the allocation (P6 on the golden case).
    left = sum(b for (a, d), b in account_balances(bank, "2026-09").items() if a in IT_POOL and '"IT01"' in d)
    assert left == 0
    assert verify_chain(bank) == []


def test_rule_must_be_approved_before_it_runs(bank):
    fte(bank, {"Retail": "1", "Commercial": "1", "Wealth": "1"})
    rule_id, item, _ = propose_allocation_rule(bank, IT_RULE, "staff based", "model")
    with pytest.raises(AllocationError, match="rule_not_approved"):
        run_allocation(bank, rule_id, "2026-09", "k", "model")
    record_review_decision(bank, item, "engagement_lead", "reject", LEAD)
    with pytest.raises(AllocationError, match="rule_not_approved"):
        run_allocation(bank, rule_id, "2026-09", "k", "model")


def test_missing_driver_lists_every_target(bank):
    fte(bank, {"Retail": "1"})
    rule_id = approved_rule(bank)
    with pytest.raises(AllocationError) as e:
        run_allocation(bank, rule_id, "2026-09", "k", "model")
    assert e.value.code == "missing_driver" and e.value.details == ["Commercial", "Wealth"]


def test_replay_returns_the_same_journal(bank):
    fte(bank, {"Retail": "120", "Commercial": "45", "Wealth": "35"})
    rule_id = approved_rule(bank)
    first = run_allocation(bank, rule_id, "2026-09", "k1", "model")
    again = run_allocation(bank, rule_id, "2026-09", "k1", "model")
    assert (again.journal_id, again.created, again.shares, again.pool) == (first.journal_id, False, first.shares, first.pool)
    with pytest.raises(AllocationError, match="empty_pool"):
        run_allocation(bank, rule_id, "2026-09", "k2", "model")


def test_bad_rules_are_refused(bank):
    for rule, code in [
        (AllocationRule(["acct:SYNBANK:9999"], {}, "fte", "BusinessLine", ["Retail"]), "unknown_account"),
        (AllocationRule(IT_POOL, {}, "headcount_guess", "BusinessLine", ["Retail"]), "bad_basis"),
        (AllocationRule(IT_POOL, {"CostCentre": "IT01"}, "fte", "BusinessLine", ["Retail", "Retail"]), "bad_targets"),
        (AllocationRule(IT_POOL, {"CostCentre": "IT99"}, "fte", "BusinessLine", ["Retail"]), "unknown_member"),
        (AllocationRule(IT_POOL, {"BusinessLine": "CorporateCentre"}, "fte", "BusinessLine", ["Retail"]), "bad_rule"),
    ]:
        with pytest.raises(AllocationError, match=code):
            propose_allocation_rule(bank, rule, "why", "model")
