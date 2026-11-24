"""Step 4a: the mapping, gap and review tools, driven by a scripted stand-in for the model.

SCRIPT is test data only. It is not the V1 answer key, which the engagement lead writes blind (phase5-validation.md).
"""
import pytest

from volt_ledger.mapping import (MappingError, active_mapping, client_visible, coverage, flag_policy_gap,
                                 get_ontology_context, map_line_item_to_element, record_review_decision)

C = "canon:"
SCRIPT = {
    "1000": C + "CashAndCentralBankBalances", "1100": C + "DueFromBanks", "1200": C + "InvestmentSecuritiesFVOCI",
    "1210": C + "InvestmentSecuritiesAmortisedCost", "1300": C + "TradingAssets", "1310": C + "DerivativeAssets",
    "1400": C + "LoansGross", "1410": C + "LoansGross", "1420": C + "LoansGross", "1490": C + "CreditLossAllowance",
    "1500": C + "PropertyAndEquipment", "1510": C + "RightOfUseAssets", "1600": C + "Goodwill",
    "1610": C + "IntangibleAssets", "1700": C + "DeferredTaxAssets", "1900": C + "OtherAssets",
    "2000": C + "DueToBanks", "2100": C + "CurrentAccountDeposits", "2110": C + "SavingsDeposits",
    "2120": C + "TermDeposits", "2200": C + "DebtSecuritiesIssued", "2210": C + "SubordinatedDebt",
    "2300": C + "DerivativeLiabilities", "2400": C + "LeaseLiabilities", "2500": C + "CurrentTaxLiabilities",
    "2600": C + "Provisions", "2900": C + "OtherLiabilities", "3000": C + "ShareCapital", "3100": C + "RetainedEarnings",
    "3200": C + "OtherComprehensiveIncomeReserve", "3300": C + "NonControllingInterests",
    "4000": C + "InterestIncome", "4010": C + "InterestIncome", "5000": C + "InterestExpense",
    "5010": C + "InterestExpense", "4110": C + "FeeAndCommissionIncome", "4120": C + "FeeAndCommissionIncome",
    "4130": C + "FeeAndCommissionIncome", "5100": C + "FeeAndCommissionExpense", "4200": C + "TradingIncome",
    "4300-RET": C + "FeeAndCommissionIncome", "4300-COM": C + "FeeAndCommissionIncome",
    "6000": C + "StaffCosts", "6100": C + "ITCosts", "6200": C + "PremisesCosts", "6210": C + "PremisesCosts",
    "6300": C + "DepreciationAndAmortisation", "6400": C + "ITCosts", "6900": C + "OtherOperatingExpenses",
    "7000": C + "CreditLossExpense", "8000": C + "IncomeTaxExpense",
}
GAPS = [
    (["1490"], "stage_not_captured", ["IFRS 9 5.5", "IFRS 7 35H"]),
    (["4100"], "recognition_basis_mixed", ["IFRS 9 B5.4.1", "IFRS 15"]),
    (["4130"], "gross_vs_net", ["IFRS 15 B34"]),
    (["4300-RET", "4300-COM"], "dimension_in_account", ["IFRS 8"]),
    (["4900"], "catch_all_account", ["IAS 1"]),
    (["6200"], "lease_model_difference", ["IFRS 16", "ASC 842"]),
    (["6400"], "capitalisation_policy", ["IAS 38", "ASC 350-40"]),
    (["6950"], "unmappable_sign", []),
]
A = "acct:SYNBANK:"


def run_script(store, confidence="0.95"):
    for code, concept in SCRIPT.items():
        map_line_item_to_element(store, A + code, concept, confidence, f"name and sign fit {concept}", "model")
    for codes, gap_type, refs in GAPS:
        flag_policy_gap(store, [A + c for c in codes], gap_type, "split or reclassify; see rationale", refs,
                        "seeded gap", "0.8", "model")


def test_every_account_mapped_or_gapped(bank):
    run_script(bank)
    cov = coverage(bank, "D0001")
    assert cov["unaccounted"] == []
    assert cov["accounts"] == 54


def test_all_eight_gap_types_flagged_and_reviewed(bank):
    run_script(bank)
    types = {r[0] for r in bank.conn.execute(
        "SELECT json_extract(traits, '$.gap_type') FROM element WHERE element_type = 'policy_gap'")}
    assert len(types) == 8
    assert bank.conn.execute("SELECT COUNT(*) FROM review_item WHERE kind = 'policy_gap'").fetchone()[0] == 8
    refs = bank.conn.execute("SELECT traits FROM element WHERE element_id = 'gap:000001'").fetchone()[0]
    assert '"verified": false' in refs


def test_mapping_traces_to_source_rows(bank):
    out = map_line_item_to_element(bank, A + "1400", C + "LoansGross", "0.97", "mortgage loans", "model")
    import json
    src = json.loads(bank.conn.execute("SELECT sources FROM evidence WHERE evidence_id = ?", (out.evidence_id,)).fetchone()[0])
    assert {"doc_id": "D0001", "row": 8} in src and len([s for s in src if "row" in s]) == 3


def test_review_routing(bank):
    first = map_line_item_to_element(bank, A + "1000", C + "CashAndCentralBankBalances", "0.99", "cash", "model")
    assert first.review_item_id  # first client run: everything reviewed
    later_hi = map_line_item_to_element(bank, A + "1100", C + "DueFromBanks", "0.95", "x", "model", first_client_run=False)
    later_lo = map_line_item_to_element(bank, A + "1900", C + "OtherAssets", "0.60", "x", "model", first_client_run=False)
    assert later_hi.review_item_id is None and later_lo.review_item_id


def test_supersede_keeps_history(bank):
    map_line_item_to_element(bank, A + "4900", C + "OtherOperatingIncome", "0.5", "guess", "model")
    map_line_item_to_element(bank, A + "4900", C + "FeeAndCommissionIncome", "0.7", "after review", "model")
    assert active_mapping(bank, A + "4900")["to_element"] == C + "FeeAndCommissionIncome"
    assert bank.conn.execute("SELECT COUNT(*) FROM association WHERE from_element = ? AND association_type='mapping'",
                             (A + "4900",)).fetchone()[0] == 2


@pytest.mark.parametrize("acct,concept,conf,code", [
    (A + "1000", "canon:Nope", "0.9", "not_concept"),
    ("canon:InterestIncome", C + "InterestIncome", "0.9", "not_account"),
    (A + "1000", C + "CashAndCentralBankBalances", "1.5", "bad_confidence"),
    (A + "1000", C + "CashAndCentralBankBalances", "high", "bad_confidence"),
])
def test_mapping_refusals(bank, acct, concept, conf, code):
    with pytest.raises(MappingError) as e:
        map_line_item_to_element(bank, acct, concept, conf, "x", "model")
    assert e.value.code == code


def test_two_stage_approval(bank):
    out = map_line_item_to_element(bank, A + "1000", C + "CashAndCentralBankBalances", "0.99", "cash", "model")
    item = out.review_item_id
    assert client_visible(bank) == []
    with pytest.raises(MappingError, match="needs_lead_approval"):
        record_review_decision(bank, item, "client", "approve", "user:controller")
    with pytest.raises(MappingError, match="not_a_person"):
        record_review_decision(bank, item, "engagement_lead", "approve", "model")
    record_review_decision(bank, item, "engagement_lead", "approve", "user:rakesh")
    assert client_visible(bank) == [item]
    record_review_decision(bank, item, "client", "approve", "user:controller")


def test_ontology_context(bank):
    ctx = get_ontology_context(bank, query="fee and commission income")
    assert ctx["candidates"][0]["element_id"] == C + "FeeAndCommissionIncome"
    acct = get_ontology_context(bank, element_id=A + "6950")
    assert acct["tb"]["sign"] == "credit"   # an expense account with a credit balance: the unmappable_sign gap
    assert get_ontology_context(bank, element_id="acct:SYNBANK:nope")["status"] == "not_found"
