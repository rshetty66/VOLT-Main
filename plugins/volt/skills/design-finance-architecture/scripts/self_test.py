"""Regression cases for validate_journals.py and validate_mapping.py.

    python3 -I scripts/self_test.py

Exits 0 only when every case passes. Uses the synthetic demo documents in ../assets as the
baseline and mutates them for each negative case. When the optional `jsonschema` package is
installed it also checks the example assets and the validator output against the canonical
schemas; otherwise those cases report NOT_RUN (they never count as passes).
"""
from __future__ import annotations

import copy
import decimal
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets"


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


VJ = _load("validate_journals")
VM = _load("validate_mapping")
VX = _load("verify_extraction")
JOURNAL_DEMO = json.loads((ASSETS / "mortgage-demo.json").read_text(encoding="utf-8"))
MAPPING_DEMO = json.loads((ASSETS / "mapping-demo.json").read_text(encoding="utf-8"))
REQUIRED_NOT_RUN = {
    "POLICY_ACCURACY", "APPROVED_MEASUREMENT", "SOURCE_COMPLETENESS", "ACCOUNT_INTERSECTIONS",
    "GOLDEN_CASE_MATCH", "DURABLE_REPLAY", "REGULATORY_ACCURACY", "AUTHORIZATION",
}

CASES: list = []


class NotRun(Exception):
    pass


def case(fn):
    CASES.append(fn)
    return fn


def jd():
    return copy.deepcopy(JOURNAL_DEMO)


def md():
    return copy.deepcopy(MAPPING_DEMO)


def failed(report) -> set:
    return {c["check_id"] for c in report["checks"] if c["status"] == "FAIL"}


def expect_pass(report):
    assert report["status"] == "VALIDATED_SCOPED", (report["status"], report["blockers"])
    assert not failed(report), report["blockers"]


def expect_fail(report, check_id):
    assert check_id in failed(report), f"expected {check_id} to fail; failed={failed(report)} blockers={report['blockers']}"
    assert report["status"] == "BLOCKED"


# ---------------------------------------------------------------- journals: positive

@case
def journal_demo_passes():
    expect_pass(VJ.validate(jd()))


@case
def journal_report_lists_not_run_scope():
    report = VJ.validate(jd())
    not_run = {c["check_id"] for c in report["checks"] if c["status"] == "NOT_RUN"}
    assert REQUIRED_NOT_RUN <= not_run, REQUIRED_NOT_RUN - not_run
    assert report["limitations"], "limitations must be stated"


@case
def journal_report_shape():
    report = VJ.validate(jd())
    assert report["schema_version"] == "2.0.0"
    assert len(report["input_manifest_hash"]) == 64
    assert set(report) == set(json.loads((ASSETS / "result.schema.json").read_text())["required"])


@case
def journal_golden_totals_are_506000():
    doc = jd()
    dr = sum(decimal.Decimal(l["debit"]) for l in doc["lines"])
    cr = sum(decimal.Decimal(l["credit"]) for l in doc["lines"])
    assert dr == cr == decimal.Decimal("506000.00")


@case
def journal_ignores_ambient_decimal_context():
    doc = jd()
    for l in doc["lines"]:
        for side in ("debit", "credit"):
            if l[side] != "0.00":
                l[side] = "1234567890123456789012345678901234.56"
    with decimal.localcontext() as ctx:
        ctx.prec = 3
        expect_pass(VJ.validate(doc))


@case
def journal_38_digit_amounts_balance():
    doc = jd()
    doc["lines"] = doc["lines"][:2]
    doc["lines"][0]["debit"] = "999999999999999999999999999999999999.99"
    doc["lines"][1]["credit"] = "999999999999999999999999999999999999.99"
    expect_pass(VJ.validate(doc))


@case
def journal_two_events_two_journals_pass():
    doc = jd()
    extra = copy.deepcopy(doc["lines"][:2])
    for i, l in enumerate(extra):
        l["line_id"] = f"X{i}"
        l["journal_id"] = "J-ORIG-002"
        l["event_id"] = "FUND-002"
    doc["lines"] += extra
    expect_pass(VJ.validate(doc))


@case
def journal_second_currency_balanced_passes():
    doc = jd()
    doc["currency_precision"]["JPY"] = 0
    extra = copy.deepcopy(doc["lines"][:2])
    for i, l in enumerate(extra):
        l.update(line_id=f"Y{i}", journal_id="J-JPY", event_id="FUND-JPY", currency="JPY")
    extra[0]["debit"], extra[0]["credit"] = "1000", "0"
    extra[1]["debit"], extra[1]["credit"] = "0", "1000"
    doc["lines"] += extra
    expect_pass(VJ.validate(doc))


# ---------------------------------------------------------------- journals: negative

@case
def journal_one_cent_on_large_value_fails():
    doc = jd()
    doc["lines"][0]["debit"] = "500000.01"
    expect_fail(VJ.validate(doc), "J_BALANCE")


@case
def journal_cross_entity_offset_fails():
    doc = jd()
    doc["lines"][1]["entity"] = "BANK-US"  # principal debit no longer offsets in BANK-CA
    expect_fail(VJ.validate(doc), "J_BALANCE")


@case
def journal_cross_currency_offset_fails():
    doc = jd()
    doc["currency_precision"]["USD"] = 2
    doc["lines"][1]["currency"] = "USD"
    expect_fail(VJ.validate(doc), "J_BALANCE")


@case
def journal_cross_ledger_offset_fails():
    doc = jd()
    doc["lines"][1]["ledger"] = "CA-USGAAP"
    expect_fail(VJ.validate(doc), "J_BALANCE")


@case
def journal_cross_period_offset_fails():
    doc = jd()
    doc["open_periods"].append("2026-11")
    doc["lines"][1].update(period="2026-11", accounting_date="2026-11-01")
    expect_fail(VJ.validate(doc), "J_BALANCE")


@case
def journal_duplicate_line_id_fails():
    doc = jd()
    doc["lines"][1]["line_id"] = "L1"
    expect_fail(VJ.validate(doc), "J_UNIQUE_LINE_ID")


@case
def journal_duplicate_event_identity_across_journals_fails():
    doc = jd()
    dup = copy.deepcopy(doc["lines"][:2])
    for i, l in enumerate(dup):
        l.update(line_id=f"D{i}", journal_id="J-ORIG-001-REPLAY")
    doc["lines"] += dup
    expect_fail(VJ.validate(doc), "J_EVENT_IDENTITY")


@case
def journal_closed_period_fails():
    doc = jd()
    doc["open_periods"] = ["2026-11"]
    expect_fail(VJ.validate(doc), "J_PERIOD_OPEN")


@case
def journal_accounting_date_outside_period_fails():
    doc = jd()
    doc["lines"][0]["accounting_date"] = "2026-09-30"
    expect_fail(VJ.validate(doc), "J_PERIOD_OPEN")


@case
def journal_rule_not_yet_valid_fails():
    doc = jd()
    doc["rules"][0]["valid_from"] = "2026-10-31"
    expect_fail(VJ.validate(doc), "J_RULE_APPROVED")


@case
def journal_rule_expired_fails():
    doc = jd()
    doc["rules"][0]["valid_to"] = "2026-10-29"
    expect_fail(VJ.validate(doc), "J_RULE_APPROVED")


@case
def journal_draft_rule_fails():
    doc = jd()
    doc["rules"][0]["status"] = "DRAFT"
    expect_fail(VJ.validate(doc), "J_RULE_APPROVED")


@case
def journal_rule_basis_mismatch_fails():
    doc = jd()
    doc["rules"][0]["basis"] = "USGAAP"
    expect_fail(VJ.validate(doc), "J_RULE_APPROVED")


@case
def journal_rule_tenant_mismatch_fails():
    doc = jd()
    doc["rules"][0]["tenant_id"] = "OTHER"
    report = VJ.validate(doc)
    expect_fail(report, "J_TENANT")
    expect_fail(report, "J_RULE_APPROVED")


@case
def journal_line_tenant_mismatch_fails():
    doc = jd()
    doc["lines"][3]["tenant_id"] = "OTHER"
    expect_fail(VJ.validate(doc), "J_TENANT")


@case
def journal_rule_ledger_mismatch_fails():
    doc = jd()
    doc["rules"][0]["ledger"] = "CA-USGAAP"
    expect_fail(VJ.validate(doc), "J_RULE_APPROVED")


@case
def journal_rule_matching_ledger_and_disposition_passes():
    doc = jd()
    doc["rules"][0].update(ledger="CA-IFRS", disposition="JOURNAL")
    expect_pass(VJ.validate(doc))


@case
def journal_rule_no_journal_disposition_fails():
    doc = jd()
    doc["rules"][0]["disposition"] = "NO_JOURNAL"
    expect_fail(VJ.validate(doc), "J_RULE_APPROVED")


@case
def journal_unknown_rule_version_fails():
    doc = jd()
    doc["lines"][0]["rule_version"] = "2"
    expect_fail(VJ.validate(doc), "J_RULE_APPROVED")


@case
def journal_negative_amount_fails():
    doc = jd()
    doc["lines"][0]["debit"] = "-500000.00"
    expect_fail(VJ.validate(doc), "J_AMOUNT_FORMAT")


@case
def journal_exponent_amount_fails():
    doc = jd()
    doc["lines"][0]["debit"] = "5E+5"
    expect_fail(VJ.validate(doc), "J_AMOUNT_FORMAT")


@case
def journal_nan_amount_fails():
    doc = jd()
    doc["lines"][0]["debit"] = "NaN"
    expect_fail(VJ.validate(doc), "J_AMOUNT_FORMAT")


@case
def journal_json_number_amount_fails():
    doc = jd()
    doc["lines"][0]["debit"] = 500000.0
    expect_fail(VJ.validate(doc), "J_AMOUNT_FORMAT")


@case
def journal_amount_over_38_digits_fails():
    doc = jd()
    doc["lines"][0]["debit"] = "1" * 37 + ".00"
    expect_fail(VJ.validate(doc), "J_AMOUNT_FORMAT")


@case
def journal_both_sides_positive_fails():
    doc = jd()
    doc["lines"][0]["credit"] = "1.00"
    expect_fail(VJ.validate(doc), "J_ONE_SIDED")


@case
def journal_both_sides_zero_fails():
    doc = jd()
    doc["lines"][0]["debit"] = "0.00"
    doc["lines"][1]["credit"] = "0.00"
    expect_fail(VJ.validate(doc), "J_ONE_SIDED")


@case
def journal_currency_precision_exceeded_fails():
    doc = jd()
    doc["lines"][0]["debit"] = "500000.001"
    doc["lines"][1]["credit"] = "500000.001"
    expect_fail(VJ.validate(doc), "J_CURRENCY_PRECISION")


@case
def journal_unknown_currency_fails():
    doc = jd()
    for l in doc["lines"]:
        l["currency"] = "XYZ"
    expect_fail(VJ.validate(doc), "J_CURRENCY_PRECISION")


@case
def journal_missing_measurement_ref_fails():
    doc = jd()
    doc["lines"][6]["measurement_ref"] = ""
    expect_fail(VJ.validate(doc), "J_LINEAGE")


@case
def journal_missing_event_id_fails():
    doc = jd()
    doc["lines"][2]["event_id"] = "  "
    expect_fail(VJ.validate(doc), "J_LINEAGE")


@case
def journal_missing_field_blocks_and_skips():
    doc = jd()
    del doc["lines"][0]["account"]
    report = VJ.validate(doc)
    expect_fail(report, "J_STRUCTURE")
    statuses = {c["check_id"]: c["status"] for c in report["checks"]}
    assert statuses["J_BALANCE"] == "NOT_RUN", statuses


@case
def journal_empty_lines_fails():
    doc = jd()
    doc["lines"] = []
    expect_fail(VJ.validate(doc), "J_STRUCTURE")


@case
def journal_non_object_document_fails():
    expect_fail(VJ.validate(["not", "a", "document"]), "J_STRUCTURE")


# ---------------------------------------------------------------- command line

def _run(script: str, payload: str):
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        f.write(payload)
        name = f.name
    try:
        proc = subprocess.run([sys.executable, "-I", str(HERE / script), name], capture_output=True, text=True, timeout=60)
    finally:
        Path(name).unlink()
    return proc


@case
def cli_journal_demo_exit_zero():
    proc = _run("validate_journals.py", json.dumps(JOURNAL_DEMO))
    assert proc.returncode == 0, proc.stdout + proc.stderr
    assert json.loads(proc.stdout)["status"] == "VALIDATED_SCOPED"


@case
def cli_journal_failure_exit_one():
    doc = jd()
    doc["lines"][0]["debit"] = "1.00"
    proc = _run("validate_journals.py", json.dumps(doc))
    assert proc.returncode == 1, proc.returncode


@case
def cli_malformed_json_exit_two():
    proc = _run("validate_journals.py", "{not json")
    assert proc.returncode == 2, proc.returncode
    proc = _run("validate_mapping.py", "{not json")
    assert proc.returncode == 2, proc.returncode


@case
def cli_mapping_demo_exit_zero():
    proc = _run("validate_mapping.py", json.dumps(MAPPING_DEMO))
    assert proc.returncode == 0, proc.stdout + proc.stderr


# ---------------------------------------------------------------- mapping: positive

@case
def mapping_demo_passes():
    expect_pass(VM.validate(md()))


@case
def mapping_report_lists_not_run_scope():
    report = VM.validate(md())
    not_run = {c["check_id"] for c in report["checks"] if c["status"] == "NOT_RUN"}
    assert {"TARGET_INDEPENDENCE", "FX_BASIS_TRANSFORMATION", "EPM_INTERSECTIONS"} <= not_run, not_run


@case
def mapping_split_weights_pass():
    doc = md()
    doc["target_accounts"].append("LOANS_INSURED")
    doc["mapping"][0]["targets"] = [{"account": "LOANS", "weight": "0.6"}, {"account": "LOANS_INSURED", "weight": "0.4"}]
    doc["target"][0]["balance"] = "298800.00"
    doc["target"].append(dict(doc["target"][0], account="LOANS_INSURED", balance="199200.00"))
    expect_pass(VM.validate(doc))


@case
def mapping_zero_balance_retirement_passes():
    doc = md()
    doc["legacy"].append(dict(doc["legacy"][0], account="199", balance="0.00"))
    doc["mapping"].append({"source": "199", "retire": True})
    expect_pass(VM.validate(doc))


@case
def mapping_ignores_ambient_decimal_context():
    doc = md()
    doc["target_accounts"].append("LOANS_INSURED")
    doc["mapping"][0]["targets"] = [{"account": "LOANS", "weight": "0.6"}, {"account": "LOANS_INSURED", "weight": "0.4"}]
    doc["target"][0]["balance"] = "298800.00"
    doc["target"].append(dict(doc["target"][0], account="LOANS_INSURED", balance="199200.00"))
    with decimal.localcontext() as ctx:
        ctx.prec = 2
        expect_pass(VM.validate(doc))


# ---------------------------------------------------------------- mapping: negative

@case
def mapping_weights_not_summing_to_one_fails():
    doc = md()
    doc["mapping"][0]["targets"][0]["weight"] = "0.99"
    expect_fail(VM.validate(doc), "M_WEIGHTS")


@case
def mapping_zero_weight_fails():
    doc = md()
    doc["mapping"][0]["targets"].append({"account": "CASH", "weight": "0"})
    expect_fail(VM.validate(doc), "M_WEIGHTS")


@case
def mapping_negative_weight_fails():
    doc = md()
    doc["mapping"][0]["targets"] = [{"account": "LOANS", "weight": "1.5"}, {"account": "CASH", "weight": "-0.5"}]
    expect_fail(VM.validate(doc), "M_WEIGHTS")


@case
def mapping_duplicate_target_in_split_fails():
    doc = md()
    doc["mapping"][0]["targets"] = [{"account": "LOANS", "weight": "0.5"}, {"account": "LOANS", "weight": "0.5"}]
    expect_fail(VM.validate(doc), "M_WEIGHTS")


@case
def mapping_missing_target_account_fails():
    doc = md()
    doc["mapping"][0]["targets"][0]["account"] = "LOANS_TYPO"
    expect_fail(VM.validate(doc), "M_TARGET_ACCOUNTS_EXIST")


@case
def mapping_duplicate_target_account_list_fails():
    doc = md()
    doc["target_accounts"].append("CASH")
    expect_fail(VM.validate(doc), "M_TARGET_ACCOUNTS_EXIST")


@case
def mapping_unmapped_source_fails():
    doc = md()
    doc["mapping"] = doc["mapping"][:-1]
    expect_fail(VM.validate(doc), "M_SOURCE_COVERAGE")


@case
def mapping_duplicate_mapping_source_fails():
    doc = md()
    doc["mapping"].append(copy.deepcopy(doc["mapping"][0]))
    expect_fail(VM.validate(doc), "M_UNIQUE_KEYS")


@case
def mapping_duplicate_legacy_key_fails():
    doc = md()
    doc["legacy"].append(copy.deepcopy(doc["legacy"][0]))
    expect_fail(VM.validate(doc), "M_UNIQUE_KEYS")


@case
def mapping_duplicate_target_key_fails():
    doc = md()
    doc["target"].append(copy.deepcopy(doc["target"][0]))
    expect_fail(VM.validate(doc), "M_UNIQUE_KEYS")


@case
def mapping_nonzero_retirement_fails():
    doc = md()
    doc["mapping"][3] = {"source": "103", "retire": True}
    expect_fail(VM.validate(doc), "M_RETIREMENT")


@case
def mapping_one_cent_target_mismatch_fails():
    doc = md()
    doc["target"][0]["balance"] = "498000.01"
    expect_fail(VM.validate(doc), "M_PRESERVATION")


@case
def mapping_target_in_wrong_entity_fails():
    doc = md()
    doc["target"][2]["entity"] = "BANK-US"
    expect_fail(VM.validate(doc), "M_PRESERVATION")


@case
def mapping_dropped_target_row_fails():
    doc = md()
    doc["target"] = doc["target"][1:]
    expect_fail(VM.validate(doc), "M_PRESERVATION")


@case
def mapping_global_netting_does_not_hide_error():
    doc = md()
    doc["target"][0]["balance"] = "498001.00"   # +1 on LOANS
    doc["target"][1]["balance"] = "-498001.00"  # -1 on CASH: totals still net to zero
    expect_fail(VM.validate(doc), "M_PRESERVATION")


@case
def mapping_malformed_balance_fails():
    doc = md()
    doc["legacy"][0]["balance"] = "4.98e5"
    expect_fail(VM.validate(doc), "M_AMOUNT_FORMAT")


@case
def mapping_both_targets_and_retire_fails():
    doc = md()
    doc["mapping"][0]["retire"] = True
    expect_fail(VM.validate(doc), "M_STRUCTURE")


@case
def mapping_missing_section_fails():
    doc = md()
    del doc["target"]
    expect_fail(VM.validate(doc), "M_STRUCTURE")



# ---------------------------------------------------------------- extraction verification
# Synthetic fixture pages (test data only): a note-style loan table and an allowance roll-forward.

EXTRACTION_PAGES = [
    {"page": 1, "text": "Note 5 Loans\n(Millions of Canadian dollars)\nAs at October 31, 2025\nResidential mortgages\nGross   412,345\nAllowance for credit losses   (1,234)\nNet   411,111"},
    {"page": 2, "text": "Allowance for credit losses - residential mortgages\nBalance at beginning of year 1,100\nProvision for credit losses 400\nWrite-offs (300)\nRecoveries 40\nExchange rate and other (6)\nBalance at end of year 1,234\nStage 1 300 Stage 2 500 Stage 3 434"},
]


def _fig(fid, value, page, quote, **kw):
    base = {"id": fid, "label": fid, "value": value, "scale": "millions", "currency": "CAD", "period": "2025-10-31",
            "page": page, "quote": quote, "evidence_class": "PUBLIC_FILING"}
    base.update(kw)
    return base


def xd():
    return {
        "tenant_id": "SYNTHETIC",
        "source": {"title": "Fixture annual report", "url": "https://example.com/ar.pdf", "sha256": "0" * 64, "retrieved_at": "2026-11-01T00:00:00Z"},
        "pages": copy.deepcopy(EXTRACTION_PAGES),
        "figures": [
            _fig("gross", "412345", 1, "Gross 412,345"),
            _fig("allowance", "1234", 1, "Allowance for credit losses (1,234)"),
            _fig("net", "411111", 1, "Net 411,111"),
            _fig("opening", "1100", 2, "Balance at beginning of year 1,100"),
            _fig("pcl", "400", 2, "Provision for credit losses 400"),
            _fig("writeoffs", "300", 2, "Write-offs (300)"),
            _fig("recoveries", "40", 2, "Recoveries 40"),
            _fig("other", "-6", 2, "Exchange rate and other (6)"),
            _fig("closing", "1234", 2, "Balance at end of year 1,234"),
            _fig("stage1", "300", 2, "Stage 1 300"),
            _fig("stage2", "500", 2, "Stage 2 500"),
            _fig("stage3", "434", 2, "Stage 3 434"),
        ],
        "ties": [
            {"id": "net_carrying", "terms": [["gross", 1], ["allowance", -1], ["net", -1]], "tolerance": "1"},
            {"id": "rollforward", "terms": [["opening", 1], ["pcl", 1], ["writeoffs", -1], ["recoveries", 1], ["other", 1], ["closing", -1]], "tolerance": "1"},
            {"id": "stages", "terms": [["stage1", 1], ["stage2", 1], ["stage3", 1], ["closing", -1]], "tolerance": "1"},
            {"id": "allowance_agrees", "terms": [["allowance", 1], ["closing", -1]], "tolerance": "0"},
        ],
    }


def _figure(doc, fid):
    return next(f for f in doc["figures"] if f["id"] == fid)


@case
def extraction_fixture_passes():
    expect_pass(VX.validate(xd()))


@case
def extraction_report_lists_not_run_scope():
    report = VX.validate(xd())
    not_run = {c["check_id"] for c in report["checks"] if c["status"] == "NOT_RUN"}
    assert {"AUDIT_ASSURANCE", "POPULATION_COMPLETENESS", "POLICY_ACCURACY"} <= not_run, not_run


@case
def extraction_quote_on_wrong_page_fails():
    doc = xd()
    _figure(doc, "gross")["page"] = 2
    expect_fail(VX.validate(doc), "X_QUOTE_ON_PAGE")


@case
def extraction_invented_quote_fails():
    doc = xd()
    _figure(doc, "pcl")["quote"] = "Provision for credit losses 4,000"
    expect_fail(VX.validate(doc), "X_QUOTE_ON_PAGE")


@case
def extraction_page_out_of_range_fails():
    doc = xd()
    _figure(doc, "net")["page"] = 9
    expect_fail(VX.validate(doc), "X_QUOTE_ON_PAGE")


@case
def extraction_quote_matches_across_line_breaks_and_nbsp():
    doc = xd()
    doc["pages"][0]["text"] = doc["pages"][0]["text"].replace("Gross   412,345", "Gross\n412,345").replace("Net   411,111", "Net 411,111")
    expect_pass(VX.validate(doc))


@case
def extraction_value_not_in_quote_fails():
    doc = xd()
    _figure(doc, "gross")["value"] = "412346"
    expect_fail(VX.validate(doc), "X_VALUE_IN_QUOTE")


@case
def extraction_value_must_be_a_whole_number_token():
    doc = xd()
    doc["ties"] = []
    _figure(doc, "gross")["value"] = "345"
    expect_fail(VX.validate(doc), "X_VALUE_IN_QUOTE")


@case
def extraction_parenthesised_negative_matches_absolute_value():
    doc = xd()
    _figure(doc, "allowance")["value"] = "-1234"
    doc["ties"] = [{"id": "net_carrying", "terms": [["gross", 1], ["allowance", 1], ["net", -1]], "tolerance": "1"}]
    expect_pass(VX.validate(doc))


@case
def extraction_wrong_sign_in_tie_fails():
    doc = xd()
    doc["ties"][1]["terms"][2] = ["writeoffs", 1]
    expect_fail(VX.validate(doc), "X_TIES")


@case
def extraction_tie_outside_tolerance_fails():
    doc = xd()
    doc["pages"][1]["text"] = doc["pages"][1]["text"].replace("Recoveries 40", "Recoveries 43")
    _figure(doc, "recoveries").update(value="43", quote="Recoveries 43")
    expect_fail(VX.validate(doc), "X_TIES")


@case
def extraction_rounding_within_tolerance_passes():
    doc = xd()
    doc["pages"][1]["text"] = doc["pages"][1]["text"].replace("Recoveries 40", "Recoveries 41")
    _figure(doc, "recoveries").update(value="41", quote="Recoveries 41")
    expect_pass(VX.validate(doc))


@case
def extraction_mixed_scale_in_tie_fails():
    doc = xd()
    _figure(doc, "net")["scale"] = "thousands"
    expect_fail(VX.validate(doc), "X_TIES")


@case
def extraction_unknown_scale_fails():
    doc = xd()
    _figure(doc, "stage1")["scale"] = "lakhs"
    expect_fail(VX.validate(doc), "X_SCALE_DECLARED")


@case
def extraction_non_iso_period_fails():
    doc = xd()
    _figure(doc, "gross")["period"] = "Oct 2025"
    expect_fail(VX.validate(doc), "X_PERIOD_CONSISTENT")


@case
def extraction_mixed_periods_in_tie_fails():
    doc = xd()
    _figure(doc, "opening")["period"] = "2024-10-31"
    expect_fail(VX.validate(doc), "X_PERIOD_CONSISTENT")


@case
def extraction_unknown_figure_in_tie_fails():
    doc = xd()
    doc["ties"][0]["terms"].append(["missing_figure", 1])
    expect_fail(VX.validate(doc), "X_STRUCTURE")


@case
def extraction_duplicate_figure_id_fails():
    doc = xd()
    doc["figures"].append(copy.deepcopy(doc["figures"][0]))
    expect_fail(VX.validate(doc), "X_STRUCTURE")


@case
def extraction_missing_evidence_class_fails():
    doc = xd()
    _figure(doc, "net")["evidence_class"] = "GUESS"
    expect_fail(VX.validate(doc), "X_STRUCTURE")


@case
def extraction_malformed_value_fails():
    doc = xd()
    _figure(doc, "net")["value"] = "411,111"
    expect_fail(VX.validate(doc), "X_STRUCTURE")


@case
def extraction_ignores_ambient_decimal_context():
    with decimal.localcontext() as ctx:
        ctx.prec = 2
        expect_pass(VX.validate(xd()))


@case
def cli_extraction_exit_codes():
    assert _run("verify_extraction.py", json.dumps(xd())).returncode == 0
    doc = xd()
    _figure(doc, "gross")["value"] = "1"
    assert _run("verify_extraction.py", json.dumps(doc)).returncode == 1
    assert _run("verify_extraction.py", "{bad").returncode == 2


def _minimal_pdf(lines_per_page):
    """Builds a small valid PDF with one Helvetica text line per entry (test fixture only)."""
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for lines in lines_per_page:
        ops = "BT /F1 11 Tf 72 720 Td 14 TL " + " ".join(f"({ln}) Tj T*" for ln in lines) + " ET"
        objs.append(f"<< /Length {len(ops)} >>\nstream\n{ops}\nendstream")
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {len(objs)} 0 R >>")
        kids.append(len(objs))
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>"
    out, offsets = b"%PDF-1.4\n", []
    for i, body in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode() + b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


@case
def pdf_pages_extracts_text_per_page():
    try:
        import pypdf  # noqa: F401, PLC0415
    except ImportError as exc:
        raise NotRun("pypdf not installed") from exc
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        f.write(_minimal_pdf([["Residential mortgages", "Gross 412,345"], ["Balance at end of year 1,234"]]))
        name = f.name
    try:
        proc = subprocess.run([sys.executable, "-I", str(HERE / "pdf_pages.py"), name], capture_output=True, text=True, timeout=60)
    finally:
        Path(name).unlink()
    assert proc.returncode == 0, proc.stderr
    out = json.loads(proc.stdout)
    assert out["page_count"] == 2 and len(out["sha256"]) == 64
    assert "Gross 412,345" in out["pages"][0]["text"] and out["pages"][1]["page"] == 2


# ---------------------------------------------------------------- schemas (optional dependency)

def _schema_validator(name: str):
    try:
        import jsonschema  # noqa: PLC0415
    except ImportError as exc:
        raise NotRun("jsonschema not installed") from exc
    schema = json.loads((ASSETS / name).read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)
    return jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())


@case
def schema_examples_validate():
    _schema_validator("event.schema.json").validate(json.loads((ASSETS / "event-example.json").read_text()))
    _schema_validator("rule.schema.json").validate(json.loads((ASSETS / "rule-example.json").read_text()))


@case
def schema_rule_approved_requires_evidence():
    v = _schema_validator("rule.schema.json")
    rule = json.loads((ASSETS / "rule-example.json").read_text())
    rule["status"] = "APPROVED"
    assert list(v.iter_errors(rule)), "APPROVED rule without approval evidence must be invalid"


@case
def schema_validator_output_conforms():
    v = _schema_validator("result.schema.json")
    v.validate(VJ.validate(jd()))
    v.validate(VM.validate(md()))
    bad = jd()
    bad["lines"][0]["debit"] = "1.00"
    v.validate(VJ.validate(bad))


def main() -> int:
    passed = failed_n = not_run = 0
    for fn in CASES:
        try:
            fn()
        except NotRun as exc:
            not_run += 1
            print(f"NOT_RUN {fn.__name__}: {exc}")
        except Exception as exc:  # noqa: BLE001 - report every failing case
            failed_n += 1
            print(f"FAIL    {fn.__name__}: {type(exc).__name__}: {exc}")
        else:
            passed += 1
            print(f"PASS    {fn.__name__}")
    print(f"\n{passed} passed, {failed_n} failed, {not_run} not run, {len(CASES)} cases")
    return 1 if failed_n else 0


if __name__ == "__main__":
    sys.exit(main())
