"""Insurance extension (IFRS 17): loads on top of an existing bank graph, and insurer charts design and present."""
from __future__ import annotations

import copy
import json

import pytest

from tests.conftest import GOLDEN, fresh_store
from volt_ledger.coa import Concepts, check_design, coverage
from volt_ledger.ingest import ColumnMap, ingest_trial_balance
from volt_ledger.mapping import map_line_item_to_element
from volt_ledger.ontology import (DEFAULT_ONTOLOGY, EXTENSIONS, OntologyError, _load_file, dimension_members,
                                  load_ontology)
from volt_ledger.reporting import build_statement
from volt_ledger.store import Store

G = json.loads((GOLDEN / "synbank_target_coa.json").read_text())
INSURANCE_ACCOUNTS = [   # as proposed by the FSDF synthetic insurer (entity 002)
    {"code": "18000", "name": "Insurance and reinsurance assets", "class": "asset", "parent": "10000"},
    {"code": "18100", "name": "Reinsurance contract assets", "class": "asset", "parent": "18000",
     "concept_id": "canon:ReinsuranceContractAssets"},
    {"code": "24000", "name": "Insurance contract liabilities", "class": "liability", "parent": "20000"},
    {"code": "24100", "name": "Insurance contract liabilities issued", "class": "liability", "parent": "24000",
     "concept_id": "canon:InsuranceContractLiabilities"},
    {"code": "45000", "name": "Insurance service result", "class": "revenue", "parent": "40000"},
    {"code": "45100", "name": "Insurance revenue", "class": "revenue", "parent": "45000",
     "concept_id": "canon:InsuranceRevenue"},
    {"code": "55000", "name": "Insurance service expenses", "class": "expense", "parent": "50000"},
    {"code": "55100", "name": "Insurance service expense", "class": "expense", "parent": "55000",
     "concept_id": "canon:InsuranceServiceExpense"},
    {"code": "55200", "name": "Net expense from reinsurance held", "class": "expense", "parent": "55000",
     "concept_id": "canon:NetExpenseFromReinsuranceHeld"},
    {"code": "56000", "name": "Insurance finance", "class": "expense", "parent": "50000"},
    {"code": "56100", "name": "Insurance finance expense", "class": "expense", "parent": "56000",
     "concept_id": "canon:InsuranceFinanceIncomeExpense"},
]


def test_extension_adds_to_an_already_loaded_bank_graph():
    s = Store(":memory:")
    _load_file(s, DEFAULT_ONTOLOGY, "system")             # a ledger deployed before the extension existed
    assert s.conn.execute("SELECT 1 FROM element WHERE element_id = 'canon:InsuranceRevenue'").fetchone() is None
    load_ontology(s)                                      # the next start adds the extension only
    assert s.conn.execute("SELECT 1 FROM element WHERE element_id = 'canon:InsuranceRevenue'").fetchone()
    assert "Insurance" in dimension_members(s, "BusinessLine") and dimension_members(s, "InsuranceCoverage") == ["LRC", "LIC"]
    n = s.conn.execute("SELECT COUNT(*) FROM element").fetchone()[0]
    load_ontology(s)
    assert s.conn.execute("SELECT COUNT(*) FROM element").fetchone()[0] == n


def test_extension_never_redefines_or_loads_alone(tmp_path):
    with pytest.raises(OntologyError, match="not loaded"):
        _load_file(Store(":memory:"), EXTENSIONS[0], "system")
    doc = json.loads(EXTENSIONS[0].read_text())
    doc["version"] = "ext-bad"
    doc["concepts"][0]["id"] = "canon:Goodwill"
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(doc))
    with pytest.raises(OntologyError, match="redefines"):
        _load_file(fresh_store(), bad, "system")


def test_insurance_concepts_classify_and_roll_up(store):
    cs = Concepts(store)
    assert cs.klass("canon:InsuranceContractLiabilities") == "liability"
    assert cs.klass("canon:ReinsuranceContractAssets") == "asset"
    assert cs.klass("canon:InsuranceRevenue") == "revenue"
    assert cs.klass("canon:InsuranceServiceExpense") == "expense"
    assert cs.klass("canon:InsuranceFinanceIncomeExpense") == "expense"
    assert cs.parent["canon:InsuranceRevenue"] == "canon:InsuranceServiceResult"
    assert cs.parent["canon:InsuranceServiceResult"] == "canon:TotalOperatingIncome"
    for memo in ("canon:ContractualServiceMargin", "canon:RiskAdjustment", "canon:PresentValueOfFutureCashFlows"):
        assert cs.info[memo]["statement"] is None and memo not in cs.parent


def test_insurer_chart_passes_and_counts_insurance_lines(mapped_bank):
    design = copy.deepcopy(G["design"])
    design["accounts"] += INSURANCE_ACCOUNTS
    bad = [c for c in check_design(mapped_bank, design) if not c["ok"]]
    assert bad == []
    post = {a["concept_id"] for a in design["accounts"] if a.get("concept_id")}
    cov = coverage(mapped_bank, post, set())
    assert cov["industries"] == ["insurance"]
    missing = cov["statements"]["ifrs"]["missing"]
    assert "canon:InsuranceServiceResult" not in missing and "canon:InsuranceRevenue" not in missing
    assert {"canon:InsuranceContractAssets", "canon:SegregatedFundLiabilities"} <= set(missing)
    bank = coverage(mapped_bank, {a["concept_id"] for a in G["design"]["accounts"] if a.get("concept_id")}, set())
    assert bank["industries"] == [] and not any("Insurance" in c for c in bank["statements"]["ifrs"]["missing"])


def test_insurer_statement_presents_ifrs17_lines_and_bank_statement_hides_them(tmp_path, bank):
    tb = tmp_path / "ins.csv"
    tb.write_text("account_code,account_name,debit,credit\n"
                  "100,Cash,500.00,\n200,Insurance contract liabilities,,420.00\n300,Share capital,,50.00\n"
                  "400,Insurance revenue,,100.00\n500,Insurance service expense,70.00,\n")
    s = fresh_store()
    ingest_trial_balance(s, tb, "SYNINS", "2026-09", "USD", ColumnMap(dimensions={}))
    for code, concept in [("100", "canon:CashAndCentralBankBalances"), ("200", "canon:InsuranceContractLiabilities"),
                          ("300", "canon:ShareCapital"), ("400", "canon:InsuranceRevenue"),
                          ("500", "canon:InsuranceServiceExpense")]:
        map_line_item_to_element(s, f"acct:SYNINS:{code}", concept, "0.95", "test", "user:test", first_client_run=False)
    inc = {ln["concept"]: ln["amount"] for ln in build_statement(s, "2026-09", "ifrs", "IS")["lines"]}
    assert inc["canon:InsuranceRevenue"] == 10_000 and inc["canon:InsuranceServiceResult"] == 3_000
    bs = build_statement(s, "2026-09", "ifrs", "BS")
    assert bs["checks"]["balances"] and "canon:ReinsuranceContractAssets" not in {ln["concept"] for ln in bs["lines"]}
    bank_lines = {ln["concept"] for ln in build_statement(bank, "2026-09", "ifrs", "IS")["lines"]}
    assert not any("Insurance" in c for c in bank_lines)
