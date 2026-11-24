"""Load the FSDF schema and synthetic data into SQLite and run the schema's own post-load checks.

SQLite stands in for Oracle here: the DDL is converted with a few mechanical rewrites (types, DATE literals,
identity clauses, interval partitioning) and foreign keys are enforced. It proves the data is consistent with the
schema and that balances tie; it does not prove the DDL compiles on Oracle.
"""
from __future__ import annotations

import csv
import json
import re
import sqlite3
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest

from volt_ledger.fim import to_sqlite

ROOT = Path(__file__).resolve().parents[2]
FSDF = ROOT / "fsdf"
SCHEMA = FSDF / "schema.sql"
DATA = FSDF / "synthetic_data.sql"

FAMILIES = {"LOAN", "MORTGAGE", "LEASE", "OVERDRAFT", "CASA", "TERM_DEPOSIT", "CARD", "FACILITY", "TRADE_FINANCE",
            "INVESTMENT", "DERIVATIVE", "REPO_SBL", "BORROWING", "LIFE", "ANNUITY", "HEALTH", "PNC", "REINS_ASSUMED"}


def checks(schema: str) -> list[tuple[str, str]]:
    section = schema[schema.index("-- 9. POST-LOAD CHECKS"):]
    out = []
    for m in re.finditer(r"^-- (9\.\d+) .*?\n(.*?)(?=^-- 9\.\d+ |\Z)", section, flags=re.S | re.M):
        body = "\n".join(line for line in m.group(2).splitlines() if not line.lstrip().startswith("--")).strip()
        if body:
            out.append((m.group(1), to_sqlite(body).rstrip(";")))
    return out


@pytest.fixture(scope="module")
def db() -> sqlite3.Connection:
    con = sqlite3.connect(":memory:")
    con.execute("PRAGMA foreign_keys = ON")
    schema = SCHEMA.read_text()
    ddl = to_sqlite(schema[:schema.index("-- 9. POST-LOAD CHECKS")])
    con.executescript(ddl)
    con.executescript(to_sqlite(DATA.read_text()))
    return con


def test_data_file_is_up_to_date(tmp_path):
    out = tmp_path / "data.sql"
    subprocess.run([sys.executable, str(FSDF / "make_synthetic.py"), str(out)], check=True, capture_output=True)
    assert out.read_text() == DATA.read_text(), "run python fsdf/make_synthetic.py and commit synthetic_data.sql"


def test_foreign_keys_hold(db):
    assert db.execute("PRAGMA foreign_key_check").fetchall() == []


@pytest.mark.parametrize("check_id, sql", checks(SCHEMA.read_text()))
def test_post_load_check_returns_no_rows(db, check_id, sql):
    assert db.execute(sql).fetchall() == [], f"check {check_id} found breaks"


def test_every_product_family_has_contracts(db):
    have = {r[0] for r in db.execute("SELECT DISTINCT v_contract_family FROM fsi_d_contract")}
    assert have == FAMILIES
    assert db.execute("SELECT COUNT(*) FROM fsi_d_ins_reins_treaty").fetchone()[0] > 0
    assert db.execute("SELECT COUNT(*) FROM fsi_d_ins_group WHERE v_direction = 'REINS_HELD'").fetchone()[0] > 0


def test_bank_gl_matches_volt_ledger_trial_balance(db):
    """Entity 001's GL, summed by target account, equals the volt-ledger synthetic TB moved onto the target chart."""
    app = ROOT
    mapping = {m["legacy_code"]: m["target"] for m in
               json.loads((app / "tests" / "golden" / "synbank_target_coa.json").read_text())["mapping"]}
    expected: dict[str, Decimal] = {}
    with (app / "data" / "synthetic" / "tb_2026-09.csv").open() as f:
        for r in csv.DictReader(f):
            amt = Decimal(r["debit"].replace(",", "") or 0) - Decimal(r["credit"].replace(",", "") or 0)
            acct = mapping[r["account_code"]]
            expected[acct] = expected.get(acct, Decimal(0)) + amt
    got = {code: Decimal(str(total)) for code, total in db.execute(
        "SELECT a.v_gl_account_code, SUM(g.n_balance) FROM fct_gl_balance g "
        "JOIN dim_gl_account a ON a.n_gl_account_sk = g.n_gl_account_sk "
        "JOIN dim_org_unit o ON o.n_org_sk = g.n_org_sk WHERE o.v_segment_code = '001' "
        "GROUP BY a.v_gl_account_code")}
    assert {k: v for k, v in got.items()} == {k: v for k, v in expected.items() if v != 0}


def test_ecl_matches_position_allowance(db):
    rows = db.execute(
        "SELECT e.n_contract_sk FROM fct_expected_loss e JOIN fct_position p "
        "ON p.n_contract_sk = e.n_contract_sk AND p.fic_mis_date = e.fic_mis_date "
        "WHERE ABS(e.n_ecl_booked - p.n_impairment_allow) > 0.005").fetchall()
    assert rows == []


def test_lic_equals_claim_reserves_for_issued_groups(db):
    rows = db.execute(
        "SELECT m.n_group_sk FROM fct_ifrs17_measurement m JOIN fsi_d_ins_group g ON g.n_group_sk = m.n_group_sk "
        "WHERE g.v_direction = 'ISSUED' AND ABS(m.n_lic - COALESCE((SELECT SUM(f.n_case_reserve + f.n_ibnr_alloc) "
        "FROM fct_ins_claim_financial f JOIN fsi_d_ins_claim c ON c.n_claim_sk = f.n_claim_sk "
        "JOIN fsi_d_ins_policy p ON p.n_contract_sk = c.n_contract_sk WHERE p.n_group_sk = m.n_group_sk), 0)) > 0.005"
    ).fetchall()
    assert rows == []
