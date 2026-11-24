from volt_ledger.ontology import calculation_children, dimension_members, load_ontology, presentation_children


def test_loaded_once(store):
    again = load_ontology(store)
    assert again.created is False


def test_presentation_children_of_income_statement(store):
    kids = presentation_children(store, "stmt:IFRS:IS", "ifrs")
    ids = [k["element_id"] for k in kids]
    assert ids[0] == "canon:InterestIncome"
    assert "canon:FeeAndCommissionIncome" in ids and "canon:ProfitAfterTax" in ids
    assert [k["ord"] for k in kids] == sorted(k["ord"] for k in kids)
    # same concept, presented under both GAAPs
    us = [k["element_id"] for k in presentation_children(store, "stmt:USGAAP:IS", "us-gaap")]
    assert "canon:FeeAndCommissionIncome" in us


def test_calculation_children(store):
    kids = {k["element_id"] for k in calculation_children(store, "canon:NetInterestIncome")}
    assert kids == {"canon:InterestIncome", "canon:InterestExpense"}


def test_dimensions(store):
    assert dimension_members(store, "CreditStage") == ["Stage1", "Stage2", "Stage3", "POCI"]


def test_every_concept_has_one_canonical_node_per_xbrl_name(store):
    for col in ("xbrl_ifrs", "xbrl_usgaap"):
        dupes = store.conn.execute(
            f"SELECT {col}, COUNT(*) FROM element WHERE {col} IS NOT NULL GROUP BY {col} HAVING COUNT(*) > 1").fetchall()
        assert dupes == []
