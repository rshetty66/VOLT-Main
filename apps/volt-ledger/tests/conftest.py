from __future__ import annotations

from pathlib import Path

import pytest

from volt_ledger.ingest import ColumnMap, ingest_trial_balance
from volt_ledger.ontology import load_ontology
from volt_ledger.store import Store

ROOT = Path(__file__).resolve().parent.parent
SYNTHETIC_TB = ROOT / "data" / "synthetic" / "tb_2026-09.csv"
COLUMNS = ColumnMap(dimensions={"BusinessLine": "business_line", "CostCentre": "cost_centre", "CreditStage": "credit_stage"})


def fresh_store() -> Store:
    s = Store(":memory:")
    load_ontology(s)
    return s


@pytest.fixture
def store() -> Store:
    return fresh_store()


@pytest.fixture
def bank(store: Store) -> Store:
    """Ontology loaded and the synthetic September 2026 trial balance ingested."""
    ingest_trial_balance(store, SYNTHETIC_TB, "SYNBANK", "2026-09", "USD", COLUMNS)
    return store
