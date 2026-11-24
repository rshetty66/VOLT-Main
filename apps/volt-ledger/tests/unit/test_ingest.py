from pathlib import Path

import pytest

from tests.conftest import COLUMNS, SYNTHETIC_TB
from volt_ledger.ingest import IngestError, ingest_trial_balance


def test_synthetic_tb_every_row_accounted_for(store):
    r = ingest_trial_balance(store, SYNTHETIC_TB, "SYNBANK", "2026-09", "USD", COLUMNS)
    assert r.data_rows == 64
    assert r.stored + len(r.rejected) == r.data_rows
    assert r.rejected == []
    assert r.balanced and r.total_debit == r.total_credit
    assert store.count("tb_row") == 64


def test_repeat_ingest_is_idempotent(bank):
    r = ingest_trial_balance(bank, SYNTHETIC_TB, "SYNBANK", "2026-09", "USD", COLUMNS)
    assert r.created is False
    assert bank.count("tb_row") == 64


def test_bad_rows_are_rejected_with_reasons(store, tmp_path: Path):
    f = tmp_path / "tb.csv"
    f.write_text(
        "account_code,account_name,debit,credit,business_line,cost_centre,credit_stage\n"
        "1000,Cash,100.00,,Treasury,,\n"          # 2 ok
        ",No code,5.00,,,,\n"                    # 3 missing code
        "1001,Bad amount,12.345,,,,\n"           # 4 too many decimals
        "1002,Both sides,1.00,1.00,,,\n"         # 5 both filled
        "1003,Bad member,1.00,,Mars,,\n"         # 6 unknown member
        ",,,,,,\n"                               # 7 blank
        "1000,Cash again,1.00,,Treasury,,\n"     # 8 duplicate of 2
        "2000,Deposits,,100.00,Retail,,\n"       # 9 ok
    )
    r = ingest_trial_balance(store, f, "T1", "2026-09", "USD", COLUMNS)
    assert r.stored == 2
    assert [x.row_number for x in r.rejected] == [3, 4, 5, 6, 7, 8]
    assert r.stored + len(r.rejected) == r.data_rows == 8
    assert r.balanced


def test_missing_columns_refused(store, tmp_path):
    f = tmp_path / "tb.csv"
    f.write_text("code,name\n1,x\n")
    with pytest.raises(IngestError, match="missing columns"):
        ingest_trial_balance(store, f, "T1", "2026-09", "USD", COLUMNS)
