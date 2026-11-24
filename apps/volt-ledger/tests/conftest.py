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


GOLDEN = ROOT / "tests" / "golden"


def apply_golden_mapping(store: Store) -> None:
    """Map and flag the synthetic bank the way a reviewed first pass would (tests/golden/synbank_mapping.json)."""
    import json

    from volt_ledger.mapping import flag_policy_gap, map_line_item_to_element
    g = json.loads((GOLDEN / "synbank_mapping.json").read_text())
    for code, concept in g["mappings"].items():
        map_line_item_to_element(store, f"acct:SYNBANK:{code}", concept, "0.95", "golden mapping", "user:golden",
                                 first_client_run=False)
    for code, gap in g["gaps"].items():
        flag_policy_gap(store, [f"acct:SYNBANK:{code}"], gap, "decide the policy", [], "seeded gap", "0.9", "user:golden")


@pytest.fixture
def mapped_bank(bank: Store) -> Store:
    apply_golden_mapping(bank)
    return bank
