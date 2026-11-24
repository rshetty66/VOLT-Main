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
