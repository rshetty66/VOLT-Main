"""Offline structural checker for proposed journal lines (synthetic or controlled data).

    python3 -I scripts/validate_journals.py FILE.json

Prints a result.schema.json-shaped report. Exit 0: every executed check passed. Exit 1: a check
failed. Exit 2: the file could not be read. See references/controls-validation.md for the input
contract and for what this utility deliberately does NOT prove.
"""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fa_common import EXACT, Report, cli, nonblank, parse_decimal  # noqa: E402

LINE_FIELDS = (
    "tenant_id", "line_id", "journal_id", "entity", "basis", "ledger", "period", "currency", "account", "rule_id",
    "rule_version", "accounting_date", "source_system", "event_id", "event_version", "measurement_ref",
    "debit", "credit",
)
STRUCTURAL_FIELDS = tuple(f for f in LINE_FIELDS if f not in ("source_system", "event_id", "event_version", "measurement_ref"))
LINEAGE_FIELDS = ("source_system", "event_id", "event_version", "measurement_ref")
RULE_FIELDS = ("tenant_id", "rule_id", "version", "status", "basis", "valid_from", "valid_to")

SCOPES = {
    "J_STRUCTURE": "document: tenant_id, open_periods, currency_precision, rules and non-empty lines with required fields",
    "J_TENANT": "every line and rule carries the document tenant_id",
    "J_AMOUNT_FORMAT": "debit/credit are nonnegative fixed-point decimal strings of at most 38 digits",
    "J_ONE_SIDED": "each line has exactly one positive side",
    "J_CURRENCY_PRECISION": "currency is in the precision table and amounts respect its decimal places",
    "J_PERIOD_OPEN": "line period is open and accounting_date falls in that period",
    "J_RULE_APPROVED": "rule tenant/id/version exists, APPROVED, same basis, date within valid interval, declared ledger and JOURNAL disposition honored",
    "J_LINEAGE": "source_system, event_id, event_version and measurement_ref are present",
    "J_UNIQUE_LINE_ID": "line_id unique within the document",
    "J_EVENT_IDENTITY": "tenant/source/event/version/basis maps to one journal (one-journal-per-event demo contract)",
    "J_BALANCE": "debits equal credits per journal/entity/basis/ledger/period/currency",
}
NOT_RUN = {
    "POLICY_ACCURACY": "accounting policy correctness requires approved client policy review",
    "APPROVED_MEASUREMENT": "EIR, ECL, fair value and FX amounts are not calculated or verified",
    "SOURCE_COMPLETENESS": "source population and control totals are not reconciled",
    "ACCOUNT_INTERSECTIONS": "target platform account/dimension intersections are not validated",
    "GOLDEN_CASE_MATCH": "account roles and amounts are not compared with independently approved golden cases",
    "DURABLE_REPLAY": "durable idempotency, replay and acknowledgement handling are not exercised",
    "REGULATORY_ACCURACY": "regulatory return mappings and validation rules are not checked",
    "AUTHORIZATION": "real user authorization and segregation of duties are not checked",
    "ERP_IMPORT": "no import or posting to an ERP, hub or GL is performed",
}
LIMITATIONS = [
    "Offline structural check of the supplied document only; not a certified accounting engine.",
    "Balanced journals can still be wrong: golden-case comparison and policy review remain required.",
    "One-journal-per-event demo contract; production events may create several journal groups.",
]


def validate(doc) -> dict:
    report = Report(doc, SCOPES, dict(NOT_RUN))
    if not _structure(doc, report):
        for cid in SCOPES:
            if cid != "J_STRUCTURE":
                report.skip(cid, "skipped because J_STRUCTURE failed")
        return report.render(LIMITATIONS)

    tenant = doc["tenant_id"]
    lines = doc["lines"]
    precision = doc["currency_precision"]
    open_periods = set(doc["open_periods"])
    rules = {(r["tenant_id"], r["rule_id"], r["version"]): r for r in doc["rules"]}

    for r in doc["rules"]:
        if r["tenant_id"] != tenant:
            report.fail("J_TENANT", f"rule {r['rule_id']} v{r['version']} tenant {r['tenant_id']!r} != {tenant!r}")

    amounts = {}
    seen_lines = set()
    event_journals = defaultdict(set)
    for line in lines:
        lid = line["line_id"]
        if line["tenant_id"] != tenant:
            report.fail("J_TENANT", f"line {lid} tenant {line['tenant_id']!r} != {tenant!r}")
        if lid in seen_lines:
            report.fail("J_UNIQUE_LINE_ID", f"duplicate line_id {lid}")
        seen_lines.add(lid)

        missing = [f for f in LINEAGE_FIELDS if not nonblank(str(line.get(f) or ""))]
        if missing:
            report.fail("J_LINEAGE", f"line {lid} missing {', '.join(missing)}")
        else:
            key = (line["tenant_id"], line["source_system"], line["event_id"], str(line["event_version"]), line["basis"])
            event_journals[key].add(line["journal_id"])

        dr, cr = parse_decimal(line["debit"], signed=False), parse_decimal(line["credit"], signed=False)
        if dr is None or cr is None:
            report.fail("J_AMOUNT_FORMAT", f"line {lid} debit={line['debit']!r} credit={line['credit']!r}")
        else:
            if (dr > 0) == (cr > 0):
                report.fail("J_ONE_SIDED", f"line {lid} must have exactly one positive side (debit {dr}, credit {cr})")
            places = precision.get(line["currency"])
            if not isinstance(places, int) or isinstance(places, bool) or places < 0:
                report.fail("J_CURRENCY_PRECISION", f"line {lid} currency {line['currency']!r} not in precision table")
            elif max(-dr.as_tuple().exponent, -cr.as_tuple().exponent) > places:
                report.fail("J_CURRENCY_PRECISION", f"line {lid} exceeds {places} decimal places for {line['currency']}")
            amounts[lid] = (dr, cr)

        if line["period"] not in open_periods:
            report.fail("J_PERIOD_OPEN", f"line {lid} period {line['period']} is not open")
        elif not line["accounting_date"].startswith(line["period"] + "-"):
            report.fail("J_PERIOD_OPEN", f"line {lid} accounting_date {line['accounting_date']} outside period {line['period']}")

        _check_rule(line, rules.get((line["tenant_id"], line["rule_id"], str(line["rule_version"]))), report)

    for key, journals in event_journals.items():
        if len(journals) > 1:
            report.fail("J_EVENT_IDENTITY", f"event {'/'.join(key)} appears in journals {sorted(journals)}")

    if "J_AMOUNT_FORMAT" in report.status:
        report.skip("J_BALANCE", "skipped because J_AMOUNT_FORMAT failed")
    else:
        totals = defaultdict(lambda: [EXACT.create_decimal(0), EXACT.create_decimal(0)])
        for line in lines:
            g = tuple(line[f] for f in ("journal_id", "entity", "basis", "ledger", "period", "currency"))
            dr, cr = amounts[line["line_id"]]
            totals[g][0] = EXACT.add(totals[g][0], dr)
            totals[g][1] = EXACT.add(totals[g][1], cr)
        for g, (dr, cr) in totals.items():
            if dr != cr:
                report.fail("J_BALANCE", f"{'/'.join(g)} debits {dr} != credits {cr} (difference {EXACT.subtract(dr, cr)})")

    for cid in SCOPES:
        report.done(cid)
    return report.render(LIMITATIONS)


def _check_rule(line, rule, report):
    lid = line["line_id"]
    if rule is None:
        report.fail("J_RULE_APPROVED", f"line {lid} rule {line['rule_id']} v{line['rule_version']} not found for tenant")
        return
    problems = []
    if rule["status"] != "APPROVED":
        problems.append(f"status {rule['status']}")
    if rule["basis"] != line["basis"]:
        problems.append(f"basis {rule['basis']} != line basis {line['basis']}")
    if not rule["valid_from"] <= line["accounting_date"] <= rule["valid_to"]:
        problems.append(f"accounting_date {line['accounting_date']} outside {rule['valid_from']}..{rule['valid_to']}")
    if "ledger" in rule and rule["ledger"] != line["ledger"]:
        problems.append(f"ledger {rule['ledger']} != line ledger {line['ledger']}")
    if "disposition" in rule and rule["disposition"] != "JOURNAL":
        problems.append(f"disposition {rule['disposition']} does not permit journal lines")
    if problems:
        report.fail("J_RULE_APPROVED", f"line {lid} rule {rule['rule_id']} v{rule['version']}: {'; '.join(problems)}")


def _structure(doc, report) -> bool:
    if not isinstance(doc, dict):
        report.fail("J_STRUCTURE", "document must be a JSON object")
        return False
    ok = True
    if not nonblank(doc.get("tenant_id")):
        report.fail("J_STRUCTURE", "tenant_id is required")
        ok = False
    if not isinstance(doc.get("open_periods"), list) or not all(isinstance(p, str) for p in doc["open_periods"]):
        report.fail("J_STRUCTURE", "open_periods must be a list of YYYY-MM strings")
        ok = False
    if not isinstance(doc.get("currency_precision"), dict):
        report.fail("J_STRUCTURE", "currency_precision must be an object")
        ok = False
    rules = doc.get("rules")
    if not isinstance(rules, list):
        report.fail("J_STRUCTURE", "rules must be a list")
        ok = False
    else:
        for i, r in enumerate(rules):
            if not isinstance(r, dict) or any(not nonblank(r.get(f)) for f in RULE_FIELDS):
                report.fail("J_STRUCTURE", f"rules[{i}] needs non-empty {', '.join(RULE_FIELDS)}")
                ok = False
    lines = doc.get("lines")
    if not isinstance(lines, list) or not lines:
        report.fail("J_STRUCTURE", "lines must be a non-empty list")
        return False
    for i, line in enumerate(lines):
        if not isinstance(line, dict):
            report.fail("J_STRUCTURE", f"lines[{i}] must be an object")
            ok = False
            continue
        missing = [f for f in STRUCTURAL_FIELDS if f not in ("debit", "credit") and not nonblank(line.get(f))]
        missing += [f for f in ("debit", "credit") if f not in line]
        if missing:
            report.fail("J_STRUCTURE", f"lines[{i}] missing {', '.join(missing)}")
            ok = False
    return ok


if __name__ == "__main__":
    sys.exit(cli(validate))
