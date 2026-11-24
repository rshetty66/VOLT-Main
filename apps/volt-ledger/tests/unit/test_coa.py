"""CoA design (the brain's primary output): diagnosis, target checks, old-to-new mapping, recut tie-out, coverage."""
from __future__ import annotations

import copy
import json

import pytest

from tests.conftest import GOLDEN
from volt_ledger.coa import (CoaError, check_design, design_status, diagnose_coa, export, propose_design,
                             propose_mapping, recut)
from volt_ledger.mapping import record_review_decision

G = json.loads((GOLDEN / "synbank_target_coa.json").read_text())
M = 1_000_000 * 100


def failed(checks):
    return {c["id"] for c in checks if not c["ok"]}


def test_diagnosis_finds_the_seeded_chart_problems(mapped_bank):
    d = diagnose_coa(mapped_bank, "D0001")
    ids = {f["id"]: f for f in d["findings"]}
    assert d["stats"]["accounts"] == 54 and d["stats"]["dimensions"] == ["BusinessLine", "CostCentre", "CreditStage"]
    assert ids["D_CATCH_ALL"]["accounts"] == ["4900 Sundry income"]
    assert ids["D_DIMENSION_IN_ACCOUNT"]["accounts"] == ["4300-RET Insurance commission - Retail",
                                                         "4300-COM Insurance commission - Commercial"]
    assert set(ids["D_NEAR_DUPLICATE"]["accounts"]) == set(ids["D_DIMENSION_IN_ACCOUNT"]["accounts"])
    assert "stage_not_captured" in ids["D_POLICY_GAPS"]["accounts"]
    assert ids["D_PL_WITHOUT_BUSINESS_LINE"]["accounts"] == ["6000 Salaries and benefits", "7000 Credit loss expense"]
    assert "canon:ShareOfProfitOfAssociates" in ids["D_MISSING_DETAIL"]["accounts"]
    assert [f["severity"] for f in d["findings"]] == sorted((f["severity"] for f in d["findings"]),
                                                             key=["high", "medium", "low"].index)
    with pytest.raises(CoaError):
        diagnose_coa(mapped_bank, "D9999")


def test_golden_target_chart_passes_every_check(mapped_bank):
    assert failed(check_design(mapped_bank, G["design"])) == set()


@pytest.mark.parametrize("mutate, check", [
    (lambda d: d["accounts"].append(dict(d["accounts"][2])), "C_UNIQUE_CODES"),
    (lambda d: d["accounts"][2].update(code="1110"), "C_CODE_LENGTH"),
    (lambda d: d["accounts"][2].update(code="21150", parent="11000"), "C_TYPE_RANGE"),
    (lambda d: d["accounts"][2].update(parent="99999"), "C_PARENT_EXISTS"),
    (lambda d: d["accounts"][0].update(parent="11000"), "C_NO_CYCLES"),
    (lambda d: d["accounts"][2].pop("concept_id"), "C_POSTING_CONCEPT"),
    (lambda d: d["accounts"][2].update(concept_id="canon:DueToBanks"), "C_CONCEPT_CLASS"),
    (lambda d: d["accounts"][2].update(name="Cash - Retail"), "C_NO_SEGMENT_IN_NAME"),
    (lambda d: d["accounts"][3].update(name=d["accounts"][2]["name"]), "C_NAMING"),
    (lambda d: d["segments"].append({"name": "Second", "natural": True}), "S_NATURAL_SEGMENT"),
    (lambda d: d["segments"].append({"name": "X", "source_dimension": "Nope"}), "S_SOURCE_DIMENSION"),
    (lambda d: d["decisions"].append({"topic": "x"}), "D_DECISIONS_COMPLETE"),
])
def test_each_check_catches_its_defect(mapped_bank, mutate, check):
    d = copy.deepcopy(G["design"])
    mutate(d)
    assert check in failed(check_design(mapped_bank, d))


def test_recut_places_every_row_once_and_ties_out(mapped_bank):
    r = recut(mapped_bank, G["design"], "D0001", G["mapping"])
    assert r["ok"] and failed(r["checks"]) == set()
    assert r["tie_out"]["T_TOTAL"] == {"ok": True, "old": 0, "new": 0}
    # The legacy chart left 4300-RET/COM, 4900 and 6950 unmapped, so class tie-out cannot be confirmed for them,
    # and the recut shows exactly where their balances land.
    assert r["tie_out"]["T_CLASS"]["old"]["(unmapped)"] == -59 * M
    moved = {x["concept"]: x["new"] - x["old"] for x in r["tie_out"]["T_CONCEPT"]["reclassified"]}
    assert moved == {"(unmapped)": 59 * M, "canon:FeeAndCommissionIncome": -18 * M,
                     "canon:OtherOperatingIncome": -38 * M, "canon:OtherOperatingExpenses": -3 * M}
    retail = [x for x in r["recut_lines"] if x["account"] == "42500"]
    assert {x["segments"]["BusinessLine"]: x["signed"] for x in retail} == {"Retail": -12 * M, "Commercial": -6 * M}
    stages = {x["segments"]["CreditStage"] for x in r["recut_lines"] if x["account"] == "13100"}
    assert stages == {"Stage1", "Stage2", "Stage3"}


def test_mapping_checks(mapped_bank):
    rules = [x for x in G["mapping"] if x["legacy_code"] not in ("4900", "1100")]
    rules += [{"legacy_code": "1000", "target": "11000"}, {"legacy_code": "9999", "target": "11100"},
              {"legacy_code": "1100", "target": "RETIRE"}]
    bad = failed(recut(mapped_bank, G["design"], "D0001", rules)["checks"])
    assert bad == {"M_ROW_COVERAGE", "M_ROW_UNIQUE", "M_UNKNOWN_SOURCE", "M_POSTING_TARGET", "M_RETIRE_ZERO"}


def test_propose_review_and_export(mapped_bank):
    out = propose_design(mapped_bank, G["design"], "model")
    assert out["design_id"] == "coa:0001" and out["version"] == 1 and len(out["decisions"]) == 6
    cov = out["coverage"]["statements"]["ifrs"]
    assert cov["missing"] == [] and cov["computed_at_consolidation"]
    assert out["coverage"]["metrics_producible"] == out["coverage"]["metrics_total"]
    st = design_status(mapped_bank, "coa:0001")
    assert not st["approved_by_lead"]
    record_review_decision(mapped_bank, out["review_item_id"], "engagement_lead", "approve", "user:lead")
    for d in out["decisions"]:
        record_review_decision(mapped_bank, d["review_item_id"], "engagement_lead", "approve", "user:lead")
    assert design_status(mapped_bank, "coa:0001")["approved_by_lead"]

    m = propose_mapping(mapped_bank, "coa:0001", "D0001", G["mapping"], "model")
    assert m["mapping_id"] == "coa:0001@1:M001"
    chart = export(mapped_bank, "coa:0001", "chart").splitlines()
    assert chart[0].startswith("code,name,class") and len(chart) == 1 + len(G["design"]["accounts"])
    assert "11100,Cash and balances with central banks,asset,11000,Y" in export(mapped_bank, "coa:0001", "chart")
    assert "4300-RET" in export(mapped_bank, "coa:0001", "mapping")
    assert "[UNVERIFIED]" in export(mapped_bank, "coa:0001", "decisions")
    assert "10000 Assets > 11000 Cash and interbank" in export(mapped_bank, "coa:0001", "hierarchy")

    v2 = propose_design(mapped_bank, G["design"], "model", design_id="coa:0001")
    assert v2["version"] == 2 and not design_status(mapped_bank, "coa:0001")["approved_by_lead"]


def test_a_failing_design_or_mapping_is_refused_not_stored(mapped_bank):
    d = copy.deepcopy(G["design"])
    d["accounts"][2]["code"] = "1110"
    with pytest.raises(CoaError) as e:
        propose_design(mapped_bank, d, "model")
    assert e.value.code == "checks_failed" and any("C_CODE_LENGTH" in x for x in e.value.details)
    assert mapped_bank.conn.execute("SELECT COUNT(*) FROM coa_design").fetchone()[0] == 0
    propose_design(mapped_bank, G["design"], "model")
    with pytest.raises(CoaError):
        propose_mapping(mapped_bank, "coa:0001", "D0001", G["mapping"][:-1], "model")
