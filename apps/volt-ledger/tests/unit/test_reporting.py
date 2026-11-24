"""Balances, statements, ratios and the output gate (Phase 6 step 6). Expected values are worked by hand from
data/synthetic/make_synthetic.py (amounts in USD millions there)."""
from __future__ import annotations

import pytest

from volt_ledger.reporting import ReportingError, build_statement, check_output, compute_ratio, evaluate, get_balances

M = 100_000_000  # one million dollars in cents


def test_golden_income_statement(mapped_bank):
    st = build_statement(mapped_bank, "2026-09", "ifrs", "IS")
    amounts = {l["concept"]: l["amount"] for l in st["lines"]}
    assert amounts["canon:InterestIncome"] == 630 * M
    assert amounts["canon:InterestExpense"] == 280 * M
    assert amounts["canon:NetInterestIncome"] == 350 * M
    assert amounts["canon:NonInterestIncome"] == 244 * M        # 4300 and 4900 are left out pending a policy decision
    assert amounts["canon:TotalOperatingIncome"] == 594 * M
    assert amounts["canon:OperatingExpenses"] == 483 * M
    assert amounts["canon:ProfitBeforeTax"] == 51 * M
    assert amounts["canon:ProfitAfterTax"] == -4 * M
    assert [l["concept"] for l in st["lines"]][:3] == ["canon:InterestIncome", "canon:InterestExpense", "canon:NetInterestIncome"]
    assert {x["account"] for x in st["excluded"]} == {"acct:SYNBANK:4300-RET", "acct:SYNBANK:4300-COM",
                                                     "acct:SYNBANK:4900", "acct:SYNBANK:6950"}
    assert len(st["flagged"]) == 9 and st["draft"] is True
    assert st["lines"][0]["xbrl"].startswith("ifrs-full:")


def test_golden_balance_sheet_ties_once_exclusions_are_explained(mapped_bank):
    st = build_statement(mapped_bank, "2026-09", "ifrs", "BS")
    c = st["checks"]
    assert c["total_assets"] == 16_455 * M
    assert c["total_liabilities_and_equity"] == 16_400 * M
    assert c["current_year_profit"] == -4 * M
    assert c["difference"] == 59 * M and c["explained_by_excluded"] == 59 * M and c["unexplained"] == 0
    us = build_statement(mapped_bank, "2026-09", "us-gaap", "BS")
    assert us["checks"] == c and us["lines"][0]["xbrl"].startswith("us-gaap:")


def test_golden_ratios(mapped_bank):
    nii = compute_ratio(mapped_bank, "nii", "2026-09")
    assert (nii["status"], nii["value"]) == ("ok", str(350 * M))
    assert compute_ratio(mapped_bank, "efficiency_ratio", "2026-09")["value"] == "0.813131"   # 483 / 594
    assert compute_ratio(mapped_bank, "loan_to_deposit", "2026-09")["value"] == "0.867227"    # 10,320 / 11,900
    assert compute_ratio(mapped_bank, "allowance_ratio", "2026-09")["value"] == "0.015737"    # 165 / 10,485


def test_business_line_ratio_and_undefined(mapped_bank):
    r = compute_ratio(mapped_bank, "bl_operating_income", "2026-09", {"BusinessLine": "Retail"})
    # Retail: interest 330 - 150 + fees 95 + 60 + 22 - 18 = 339
    assert r["value"] == str(339 * M)
    u = compute_ratio(mapped_bank, "bl_efficiency_ratio", "2026-09", {"BusinessLine": "Treasury"})
    assert u["status"] == "ok"
    z = compute_ratio(mapped_bank, "efficiency_ratio", "2026-09", {"BusinessLine": "Unassigned"})
    assert z["status"] == "undefined"


def test_balances_and_errors(mapped_bank):
    b = get_balances(mapped_bank, "2026-09", ["canon:LoansNet", "acct:SYNBANK:1490"])
    assert b["balances"]["canon:LoansNet"]["natural"] == 10_320 * M
    assert b["balances"]["acct:SYNBANK:1490"]["signed"] == -165 * M
    with pytest.raises(ReportingError, match="unknown_element"):
        get_balances(mapped_bank, "2026-09", ["canon:Nope"])
    with pytest.raises(ReportingError, match="unknown_metric"):
        compute_ratio(mapped_bank, "made_up", "2026-09")


def test_evaluator_refuses_code():
    for bad in ["__import__('os')", "canon:A ** 2", "1 +", "(1"]:
        with pytest.raises(ReportingError):
            evaluate(bad, lambda r: 1)
    assert evaluate("(1 + 2) * 3 / 4 - -1", lambda r: 0) == pytest.approx(3.25)


def test_check_output(mapped_bank):
    from volt_ledger.evidence import write_evidence
    with mapped_bank.transaction() as cur:
        ev = write_evidence(cur, "t", {}, {"display": {"nii": "350,000,000.00 USD", "eff": "81.31%"}}, [], "system")
    ok = check_output(mapped_bank, "NII was 350,000,000.00 USD and efficiency 81.31% in 2026 [S03].", [ev.evidence_id])
    assert ok["pass"] and ok["figures"] == 2
    bad = check_output(mapped_bank, "NII was 351,000,000.00 USD, about 81.3%.", [ev.evidence_id])
    assert bad["unsupported"] == ["351,000,000.00", "81.3%"]
