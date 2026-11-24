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


def test_peer_routes_record_evidence_and_feed_the_gate(monkeypatch, tmp_path):
    from pathlib import Path

    from volt_ledger.peers import import_corpus, load_registry
    from volt_ledger.store import Store

    monkeypatch.setenv("VOLT_LEDGER_TOKEN", "test-token")
    db = tmp_path / "ledger.db"
    c = TestClient(create_app(str(db)))
    r = c.post("/v1/tools/resolve_peer_period", headers=H, json={"peer_ids": ["td"], "as_of": "2026-11-24"}).json()
    assert r["status"] == "ok" and r["evidence_id"] and r["data"][0]["period"] == "FY2026-Q3"
    assert "internal use only" in r["warnings"][0]
    assert c.post("/v1/tools/resolve_peer_period", headers=H, json={"peer_ids": ["nobody"]}).json()["status"] == "refused"

    r = c.post("/v1/tools/fetch_peer_documents", headers=H, json={"items": [
        {"peer_id": "td", "period": "FY2026-Q3", "doc_types": ["press_release"], "url": "https://finance.yahoo.com/x.pdf"}]}).json()
    assert r["status"] == "ok" and r["data"][0]["reason"] == "domain_not_registered"
    assert c.post("/v1/tools/peer_metrics", headers=H, json={"doc_ids": ["P99999"]}).json()["status"] == "refused"

    corpus = Path("/mnt/project-files/volt-ledger/corpus")
    if not (corpus / "manifest.csv").exists():
        pytest.skip("peer corpus not on this machine")
    s = Store(str(db))
    rows = import_corpus(s, load_registry(), corpus, tmp_path / "peer_files")
    rbc = next(x["doc_id"] for x in rows if x.get("doc_id") and x["peer_id"] == "rbc" and x["doc_type"] == "supplementary_financial_info")
    s.conn.close()
    r = c.post("/v1/tools/peer_metrics", headers=H, json={"doc_ids": [rbc], "metric_ids": ["nii", "efficiency_ratio"]}).json()
    assert r["status"] == "ok" and r["display"]["rbc FY2026-Q3 nii"] == "C$8,744 million"
    good = c.post("/v1/tools/check_output", headers=H, json={
        "text": "RBC net interest income was C$8,744 million, efficiency 52.8%.", "evidence_ids": [r["evidence_id"]]}).json()
    bad = c.post("/v1/tools/check_output", headers=H, json={
        "text": "RBC net interest income was C$8,754 million.", "evidence_ids": [r["evidence_id"]]}).json()
    assert good["data"]["pass"] and bad["data"]["unsupported"] == ["8,754"]


def test_coa_design_over_http(client):
    import json

    from tests.conftest import GOLDEN
    g = json.loads((GOLDEN / "synbank_target_coa.json").read_text())
    d = client.post("/v1/tools/diagnose_coa", headers=H, json={"doc_id": "D0001"}).json()
    assert d["status"] == "ok" and d["evidence_id"] and d["display"]["D_CATCH_ALL"] == "1 (high)"
    dry = client.post("/v1/tools/check_coa_design", headers=H, json={"design": g["design"]}).json()
    assert dry["data"]["pass"] and dry["evidence_id"] is None
    bad = json.loads(json.dumps(g["design"]))
    bad["accounts"][2]["code"] = "1110"
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
