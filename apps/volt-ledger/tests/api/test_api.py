import base64

import pytest
from fastapi.testclient import TestClient

from tests.conftest import SYNTHETIC_TB
from volt_ledger.api import create_app

H = {"Authorization": "Bearer test-token"}
DIMS = {"BusinessLine": "business_line", "CostCentre": "cost_centre", "CreditStage": "credit_stage"}


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setenv("VOLT_LEDGER_TOKEN", "test-token")
    c = TestClient(create_app(str(tmp_path / "ledger.db")))
    r = c.post("/v1/ingest/trial_balance", headers=H, json={
        "filename": "tb_2026-09.csv", "content_base64": base64.b64encode(SYNTHETIC_TB.read_bytes()).decode(),
        "client": "SYNBANK", "period": "2026-09", "currency": "USD", "dimensions": DIMS})
    assert r.json()["status"] == "ok" and r.json()["data"]["stored"] == 64
    return c


def test_token_required(monkeypatch, tmp_path):
    monkeypatch.setenv("VOLT_LEDGER_TOKEN", "test-token")
    c = TestClient(create_app(str(tmp_path / "x.db")))
    assert c.get("/healthz").status_code == 200
    assert c.post("/v1/tools/coverage", json={"doc_id": "D0001"}).status_code == 401
    assert c.post("/v1/tools/coverage", json={"doc_id": "D0001"}, headers={"Authorization": "Bearer nope"}).status_code == 401


def test_no_token_refuses_to_start(monkeypatch, tmp_path):
    monkeypatch.delenv("VOLT_LEDGER_TOKEN", raising=False)
    monkeypatch.delenv("VOLT_LEDGER_DEV", raising=False)
    with pytest.raises(RuntimeError):
        create_app(str(tmp_path / "x.db"))


def test_ingest_display_strings(client):
    r = client.post("/v1/ingest/trial_balance", headers=H, json={
        "filename": "tb_2026-09.csv", "content_base64": base64.b64encode(SYNTHETIC_TB.read_bytes()).decode(),
        "client": "SYNBANK", "period": "2026-09", "currency": "USD", "dimensions": DIMS}).json()
    assert r["data"]["created"] is False
    assert r["display"]["total_debit"] == r["display"]["total_credit"]
    assert r["display"]["total_debit"].endswith(" USD")


def test_map_and_gap_return_evidence(client):
    m = client.post("/v1/tools/map_line_item", headers=H, json={
        "account_id": "acct:SYNBANK:1000", "concept_id": "canon:CashAndCentralBankBalances", "confidence": 0.98,
        "rationale": "cash at central bank"}).json()
    assert m["status"] == "ok" and m["evidence_id"].startswith("E") and m["data"]["review_item_id"]
    g = client.post("/v1/tools/flag_policy_gap", headers=H, json={
        "element_ids": ["acct:SYNBANK:4900"], "gap_type": "catch_all_account", "decision_needed": "analyse contents",
        "standard_refs": ["IAS 1"], "rationale": "material sundry balance", "confidence": 0.8}).json()
    assert g["status"] == "ok" and g["warnings"]


def test_journal_amounts_must_be_integer_strings(client):
    lines = [{"account_id": "acct:SYNBANK:4100", "side": "debit", "amount_minor": 100.5},
             {"account_id": "acct:SYNBANK:4000", "side": "credit", "amount_minor": "100"}]
    r = client.post("/v1/tools/propose_journal", headers=H, json={
        "idempotency_key": "k", "period": "2026-09", "kind": "reclass", "description": "x", "lines": lines})
    assert r.status_code == 422


def test_journal_refusal_and_success(client):
    def body(amount_cr):
        return {"idempotency_key": f"k{amount_cr}", "period": "2026-09", "kind": "reclass", "description": "fees to interest",
                "lines": [{"account_id": "acct:SYNBANK:4100", "side": "debit", "amount_minor": "10000000"},
                          {"account_id": "acct:SYNBANK:4000", "side": "credit", "amount_minor": amount_cr}]}
    bad = client.post("/v1/tools/propose_journal", headers=H, json=body("9999999")).json()
    assert bad["status"] == "refused" and bad["data"]["code"] == "unbalanced"
    good = client.post("/v1/tools/propose_journal", headers=H, json=body("10000000")).json()
    assert good["status"] == "ok" and good["display"]["total"] == "100,000.00 USD"
    rev = client.post("/v1/tools/reverse_journal", headers=H, json={
        "journal_id": good["data"]["journal_id"], "period": "2026-09", "reason": "test", "idempotency_key": "r1"}).json()
    assert rev["status"] == "ok"


def test_map_line_items_maps_the_chart_in_one_call(client):
    r = client.post("/v1/tools/map_line_items", headers=H, json={"items": [
        {"account_id": "acct:SYNBANK:1000", "concept_id": "canon:CashAndCentralBankBalances", "confidence": 0.98,
         "rationale": "cash"},
        {"account_id": "acct:SYNBANK:4000", "concept_id": "canon:InterestIncome", "confidence": 0.95, "rationale": "r"},
        {"account_id": "acct:SYNBANK:1000", "concept_id": "canon:NoSuchConcept", "confidence": 0.9, "rationale": "r"}]}).json()
    assert r["status"] == "ok" and (r["data"]["mapped"], r["data"]["refused"]) == (2, 1)
    assert [x["status"] for x in r["data"]["results"]] == ["mapped", "mapped", "refused"]
    assert all(x["evidence_id"].startswith("E") for x in r["data"]["results"][:2])
    assert r["warnings"] and r["warnings"][0].startswith("acct:SYNBANK:1000")


def test_review_needs_a_person_and_lead_first(client):
    m = client.post("/v1/tools/map_line_item", headers=H, json={
        "account_id": "acct:SYNBANK:1000", "concept_id": "canon:CashAndCentralBankBalances", "confidence": 0.98,
        "rationale": "cash"}).json()
    item = m["data"]["review_item_id"]
    d = {"item_id": item, "stage": "client", "decision": "approve"}
    assert client.post("/v1/people/review_decision", headers=H, json=d).status_code == 403
    assert client.post("/v1/people/review_decision", headers={**H, "X-Volt-User": "ctrl"}, json=d).json()["status"] == "refused"
    lead = {**d, "stage": "engagement_lead"}
    assert client.post("/v1/people/review_decision", headers={**H, "X-Volt-User": "rakesh"}, json=lead).json()["status"] == "ok"
    items = client.get("/v1/people/review_items", headers=H).json()["data"]
    assert items[0]["client_visible"] is True


def test_statement_ratio_allocation_and_gate_over_http(client):
    accts = client.post("/v1/tools/list_accounts", headers=H, json={"doc_id": "D0001"}).json()
    assert len(accts["data"]) == 54 and accts["data"][0]["mapped_to"] is None
    for code, concept in [("4000", "canon:InterestIncome"), ("5000", "canon:InterestExpense"), ("6000", "canon:StaffCosts"),
                          ("6100", "canon:ITCosts"), ("6400", "canon:ITCosts")]:
        assert client.post("/v1/tools/map_line_item", headers=H, json={
            "account_id": f"acct:SYNBANK:{code}", "concept_id": concept, "confidence": 0.95, "rationale": "r"}).json()["status"] == "ok"

    nii = client.post("/v1/tools/compute_ratio", headers=H, json={"metric_id": "nii", "period": "2026-09"}).json()
    assert nii["status"] == "ok" and nii["display"]["value"] == "310,000,000.00 USD"   # 520 - 210 on the mapped accounts
    assert nii["warnings"] and nii["evidence_id"]
    st = client.post("/v1/tools/build_statement", headers=H, json={"period": "2026-09", "statement": "IS"}).json()
    assert st["status"] == "ok" and st["display"]["Net interest income"] == "310,000,000.00 USD"
    assert all(isinstance(l["amount"], str) for l in st["data"]["lines"])
    gate = client.post("/v1/tools/check_output", headers=H, json={
        "text": "NII was 310,000,000.00 USD, not 311,000,000.00 USD.", "evidence_ids": [nii["evidence_id"]]}).json()
    assert gate["data"]["unsupported"] == ["311,000,000.00"]

    rule = client.post("/v1/tools/propose_allocation_rule", headers=H, json={
        "pool_accounts": ["acct:SYNBANK:6000", "acct:SYNBANK:6100", "acct:SYNBANK:6400"], "pool_filter": {"CostCentre": "IT01"},
        "basis": "fte", "target_dimension": "BusinessLine", "targets": ["Retail", "Commercial", "Wealth"],
        "rationale": "IT serves staff"}).json()
    assert rule["status"] == "ok"
    run = {"rule_id": rule["data"]["rule_id"], "period": "2026-09", "idempotency_key": "it-1"}
    assert client.post("/v1/tools/run_allocation", headers=H, json=run).json()["data"]["code"] == "rule_not_approved"
    lead = {**H, "X-Volt-User": "lead"}
    assert client.post("/v1/people/review_decision", headers=lead, json={
        "item_id": rule["data"]["review_item_id"], "stage": "engagement_lead", "decision": "approve"}).json()["status"] == "ok"
    assert client.post("/v1/people/driver_value", headers=H, json={"key": "fte", "period": "2026-09", "value": "1", "unit": "FTE"}).status_code == 403
    for bl, v in [("Retail", "120"), ("Commercial", "45"), ("Wealth", "35")]:
        assert client.post("/v1/people/driver_value", headers=lead, json={
            "key": "fte", "period": "2026-09", "dimensions": {"BusinessLine": bl}, "value": v, "unit": "FTE"}).json()["status"] == "ok"
    out = client.post("/v1/tools/run_allocation", headers=H, json=run).json()
    assert out["status"] == "ok" and out["display"]["share Retail"] == "85,800,000.00 USD"
    assert out["data"]["shares"] == {"Retail": "8580000000", "Commercial": "3217500000", "Wealth": "2502500000"}
    gate = client.post("/v1/tools/check_output", headers=H, json={
        "text": "Retail received 85,800,000.00 USD of the 143,000,000.00 USD pool.", "evidence_ids": [out["evidence_id"]]}).json()
    assert gate["data"]["pass"] is True
    items = client.get("/v1/people/review_items", headers=H).json()["data"]
    assert any(i["kind"] == "allocation_rule" and i["engagement_lead"]["decision"] == "approve" for i in items)


def test_coa_design_over_http(client):
    import json

    from tests.conftest import GOLDEN
    g = json.loads((GOLDEN / "synbank_target_coa.json").read_text())
    d = client.post("/v1/tools/diagnose_coa", headers=H, json={"doc_id": "D0001"}).json()
    assert d["status"] == "ok" and d["evidence_id"] and d["display"]["D_CATCH_ALL"] == "1 (high)"
    dry = client.post("/v1/tools/check_coa_design", headers=H, json={"design": g["design"]}).json()
    assert dry["data"]["pass"] and dry["evidence_id"] is None and dry["data"]["failed_checks"] == []
    bad = json.loads(json.dumps(g["design"]))
    bad["accounts"][2]["code"] = "1110"
    fail = client.post("/v1/tools/check_coa_design", headers=H, json={"design": bad}).json()["data"]
    assert not fail["pass"] and [c["id"] for c in fail["failed_checks"]] == ["C_CODE_LENGTH"]
    assert fail["failed_checks"][0]["items"] and "C_CODE_LENGTH" not in fail["passed"]
    r = client.post("/v1/tools/propose_coa_design", headers=H, json={"design": bad}).json()
    assert r["status"] == "refused" and any("C_CODE_LENGTH" in x for x in r["data"]["details"])
    p = client.post("/v1/tools/propose_coa_design", headers=H, json={"design": g["design"]}).json()
    assert p["status"] == "ok" and p["display"]["decisions"] == "6"
    m = client.post("/v1/tools/propose_coa_mapping", headers=H, json={"design_id": "coa:0001", "doc_id": "D0001",
                                                                     "rules": g["mapping"]}).json()
    assert m["status"] == "ok" and m["display"]["total old"] == m["display"]["total new"]
    assert m["warnings"] and m["data"]["recut_line_count"] == 64
    st = client.post("/v1/tools/coa_status", headers=H, json={"design_id": "coa:0001"}).json()
    assert st["data"]["approved_by_lead"] is False and len(st["data"]["decisions"]) == 6
    csv = client.get("/v1/people/coa_export", headers=H, params={"design_id": "coa:0001", "what": "chart"})
    assert csv.status_code == 200 and csv.text.startswith("code,name,class")
    assert client.get("/v1/people/coa_designs", headers=H).json()["data"][0]["design_id"] == "coa:0001"


def test_information_model_routes_trace_adjust_and_feed_the_gate(client, monkeypatch, tmp_path):
    assert client.post("/v1/tools/trace_gl_balance", headers=H, json={"account": "13100"}).json()["status"] == "refused"
    r = client.post("/v1/tools/load_information_model", headers=H, json={}).json()
    assert r["status"] == "ok" and r["data"]["tie_out"] == {"balances_checked": 46, "ties": 46, "breaks": 0}
    t = client.post("/v1/tools/trace_gl_balance", headers=H, json={"account": "13900", "filters": {"product": "MTG"}}).json()
    assert t["status"] == "ok" and t["data"]["status"] == "ties" and t["data"]["untraced_minor"] == "0"
    inst = t["data"]["instruments"][0]["instrument_id"]
    gate = client.post("/v1/tools/check_output", headers=H, json={
        "text": f"The mortgage allowance is {t['display']['gl']}.", "evidence_ids": [t["evidence_id"]]}).json()
    assert gate["data"]["pass"] is True

    a = client.post("/v1/tools/propose_adjustment", headers=H, json={
        "level": "instrument", "period": "2026-09", "reason_code": "ecl_overlay", "rationale": "rate shock",
        "lines": [{"account": "70000", "instrument_id": inst, "debit": "10000"},
                  {"account": "13900", "instrument_id": inst, "credit": "10000"}]}).json()
    assert a["status"] == "ok" and a["display"]["total"] == "100.00 USD" and "awaiting" in a["warnings"][0]
    bad = client.post("/v1/tools/propose_adjustment", headers=H, json={
        "level": "gl", "period": "2026-09", "reason_code": "top_side", "rationale": "x",
        "lines": [{"account": "61000", "debit": "1.5"}, {"account": "23900", "credit": "1"}]}).json()
    assert bad["status"] == "refused"
    t2 = client.post("/v1/tools/trace_gl_balance", headers=H, json={"account": "13900", "filters": {"product": "MTG"}}).json()
    assert t2["data"]["instrument_adjustments_minor"] == "-10000" and any("draft" in w for w in t2["warnings"])
    rv = client.post("/v1/tools/reverse_adjustment", headers=H, json={"adj_id": a["data"]["adj_id"], "rationale": "undo"}).json()
    assert rv["status"] == "ok"
    s = client.post("/v1/tools/instrument_summary", headers=H, json={"instrument_id": inst}).json()
    assert s["status"] == "ok" and len(s["data"]["adjustments"]) == 4   # two lines each
    items = client.get("/v1/people/review_items", headers=H).json()["data"]
    assert sum(i["kind"] == "adjustment" for i in items) == 2


def test_pack_routes_register_and_exam(client):
    r = client.post("/v1/tools/data_requirements", headers=H, json={}).json()
    assert r["status"] == "ok" and r["data"]["posting_accounts"] == 55 and r["data"]["pack"]["id"] == "fs-bank"
    assert {a["backing"] for a in r["data"]["accounts"]} == {"gl", "instrument", "event"}
    csv = client.get("/v1/people/data_requirements_export", headers=H)
    assert csv.status_code == 200 and csv.text.startswith("account,account_name")
    assert client.post("/v1/tools/data_requirements", headers=H, json={"design_id": "coa:9999"}).json()["status"] == "refused"
    e = client.post("/v1/tools/run_exam", headers=H, json={"doc_id": "D0001"}).json()
    assert e["status"] == "ok" and e["data"]["sections"][0]["id"] == "mapping"
    assert e["data"]["sections"][0]["status"] == "fail" and e["display"]["tie_out"] == "skipped"
