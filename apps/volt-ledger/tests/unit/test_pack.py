"""Bank knowledge pack v1: sealed contents, data requirements register and exam."""
from __future__ import annotations

import json
import shutil

import pytest

from volt_ledger import fim, pack
from volt_ledger.coa import propose_design
from volt_ledger.pack import PackError

from tests.conftest import GOLDEN, apply_golden_mapping


@pytest.fixture(scope="module")
def p() -> dict:
    return pack.load_pack()


def test_pack_is_sealed_and_lists_its_contents(p):
    info = pack.pack_info(p)
    assert info["id"] == "fs-bank" and info["version"] == "1"
    assert {c["item"] for c in info["contents"]} >= {"reference_chart", "ontology", "information_model", "map_rules",
                                                     "attributes", "exam"}


def test_a_changed_file_breaks_the_seal(p, tmp_path, monkeypatch):
    root = tmp_path / "packs" / "fs-bank" / "v1"
    shutil.copytree(pack.PACKS / "fs-bank" / "v1", root)
    m = json.loads((root / "pack.json").read_text())
    m["files"]["exam"]["sha256"] = "0" * 64
    (root / "pack.json").write_text(json.dumps(m))
    monkeypatch.setattr(pack, "PACKS", tmp_path / "packs")
    with pytest.raises(PackError, match="pack_changed: files changed since the pack was sealed: exam"):
        pack.load_pack()
    with pytest.raises(PackError, match="unknown_pack"):
        pack.load_pack("fs-bank", "9")


def test_map_rules_match_the_information_model(store, p):
    fim.load_information_model(store)
    have = {(r["v_product_code"], r["v_balance_type"], r["account"], r["n_sign"]) for r in fim.map_rules(store)}
    assert have == {(r["product"], r["balance_type"], r["account"], r["sign"]) for r in p["map_rules"]}


def test_register_covers_every_posting_account(store, p):
    reg = pack.data_requirements(store, p)
    accounts = {r["account"] for r in reg["rows"]}
    assert len(accounts) == reg["posting_accounts"] == 55
    assert reg["accounts_by_backing"] == {"gl": 27, "instrument": 16, "event": 12}
    loans = [r for r in reg["rows"] if r["account"] == "13900"]
    assert {r["backing"] for r in loans} == {"all", "instrument", "instrument:ALLOWANCE"}
    assert any("n_ifrs9_stage" in r["attribute"] for r in loans)
    assert all(r["why"] and r["dq_rule"] for r in reg["rows"])
    csv = pack.register_csv(reg)
    assert csv.startswith("account,account_name,concept_id") and csv.count("\n") == reg["requirements"] + 1


def test_exam_skips_what_it_cannot_score(store, p):
    r = pack.run_exam(store, p)
    assert r["overall"] == "not_run" and {s["status"] for s in r["sections"]} == {"skipped"}


def test_exam_passes_the_reviewed_answers(mapped_bank, p):
    fim.load_information_model(mapped_bank)
    g = json.loads((GOLDEN / "synbank_target_coa.json").read_text())
    d = propose_design(mapped_bank, g["design"], "user:golden")
    doc = mapped_bank.conn.execute("SELECT doc_id FROM source_document").fetchone()[0]
    r = pack.run_exam(mapped_bank, p, doc, d["design_id"])
    assert r["overall"] == "pass", r
    assert [s["score_pct"] for s in r["sections"]] == [100.0, 100.0, 100.0, 100.0]


def test_exam_marks_wrong_mappings(bank, p):
    from volt_ledger.mapping import map_line_item_to_element
    apply_golden_mapping(bank)
    map_line_item_to_element(bank, "acct:SYNBANK:1000", "canon:DueFromBanks", "0.95", "wrong", "model",
                             first_client_run=False)
    doc = bank.conn.execute("SELECT doc_id FROM source_document").fetchone()[0]
    m = pack.run_exam(bank, p, doc)["sections"][0]
    assert m["status"] == "pass" and m["correct"] == m["total"] - 1
    assert m["misses"] == ["1000: mapped to canon:DueFromBanks, expected canon:CashAndCentralBankBalances"]
