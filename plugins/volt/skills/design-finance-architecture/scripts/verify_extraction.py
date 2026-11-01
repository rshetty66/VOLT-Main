"""Deterministic check of figures extracted (by a model or a person) from a financial statement.

    python3 -I scripts/verify_extraction.py FILE.json

Input: the document's text per page, the extracted figures (each with the page it came from and the
exact text quoted from that page), and arithmetic tie rules between figures. The check proves that
every quote is really on its cited page, that each value is a whole number shown in its quote, and
that the declared ties hold within an explicit rounding tolerance. It does not prove the figures are
the right ones for the purpose, that the statement is complete, or that it is audited.

Exit 0: every executed check passed. Exit 1: a check failed. Exit 2: the file could not be read.
"""
from __future__ import annotations

import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fa_common import EXACT, Report, cli, nonblank, parse_decimal  # noqa: E402

SCALES = {"units", "thousands", "millions", "billions"}
EVIDENCE_CLASSES = {"CLIENT_DOCUMENT", "PUBLIC_FILING", "ILLUSTRATIVE_EXAMPLE"}
ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")
FIGURE_FIELDS = ("id", "label", "value", "scale", "currency", "period", "quote", "evidence_class")

SCOPES = {
    "X_STRUCTURE": "pages, figures and ties are well formed; figure ids unique; values are decimal strings; evidence class declared",
    "X_QUOTE_ON_PAGE": "each figure's quote appears on its cited page (whitespace and case normalised)",
    "X_VALUE_IN_QUOTE": "each figure's value equals a whole number shown in its quote (absolute value, separators removed)",
    "X_SCALE_DECLARED": "each figure declares units, thousands, millions or billions",
    "X_PERIOD_CONSISTENT": "periods are ISO dates and every tie compares figures of one period",
    "X_TIES": "each declared tie sums to zero within its tolerance, using figures of one scale and currency",
}
NOT_RUN = {
    "AUDIT_ASSURANCE": "whether the statement is audited or reviewed is not assessed",
    "POPULATION_COMPLETENESS": "whether the extracted figures are the complete set for the purpose is not assessed",
    "POLICY_ACCURACY": "whether the figures are fit for the accounting or regulatory use is not assessed",
}
LIMITATIONS = [
    "Proves the figures are faithfully transcribed from the supplied text; it does not assess the source itself.",
    "Scanned PDFs without a text layer cannot be checked; their figures must be re-keyed and confirmed by a person.",
]


def normalise(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[‐-―−]", "-", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def numbers_in(text: str) -> list:
    out = []
    for m in NUMBER.finditer(text):
        token = m.group(0).rstrip(",").replace(",", "")
        value = parse_decimal(token, signed=False)
        if value is not None:
            out.append(value)
    return out


def validate(doc) -> dict:
    report = Report(doc, SCOPES, dict(NOT_RUN))
    if not _structure(doc, report):
        for cid in SCOPES:
            if cid != "X_STRUCTURE":
                report.skip(cid, "skipped because X_STRUCTURE failed")
        return report.render(LIMITATIONS)

    pages = {p["page"]: normalise(p["text"]) for p in doc["pages"]}
    figures = {f["id"]: f for f in doc["figures"]}
    values = {fid: parse_decimal(f["value"], signed=True) for fid, f in figures.items()}

    for fid, f in figures.items():
        if f["scale"] not in SCALES:
            report.fail("X_SCALE_DECLARED", f"{fid}: scale {f['scale']!r} is not one of {', '.join(sorted(SCALES))}")
        if not ISO_DATE.match(f["period"]):
            report.fail("X_PERIOD_CONSISTENT", f"{fid}: period {f['period']!r} is not an ISO date (YYYY-MM-DD)")
        page = pages.get(f["page"])
        if page is None:
            report.fail("X_QUOTE_ON_PAGE", f"{fid}: page {f['page']} is not in the document")
        elif normalise(f["quote"]) not in page:
            report.fail("X_QUOTE_ON_PAGE", f"{fid}: quote not found on page {f['page']}: {f['quote']!r}")
        if abs(values[fid]) not in [abs(n) for n in numbers_in(f["quote"])]:
            report.fail("X_VALUE_IN_QUOTE", f"{fid}: value {f['value']} is not a number shown in its quote {f['quote']!r}")

    for tie in doc["ties"]:
        members = [figures[name] for name, _ in tie["terms"]]
        for key, check in (("scale", "X_TIES"), ("currency", "X_TIES"), ("period", "X_PERIOD_CONSISTENT")):
            seen = {m[key] for m in members}
            if len(seen) > 1:
                report.fail(check, f"tie {tie['id']}: mixes {key}s {sorted(seen)}")
        total = EXACT.create_decimal(0)
        for name, sign in tie["terms"]:
            total = EXACT.add(total, EXACT.multiply(values[name], EXACT.create_decimal(sign)))
        tolerance = parse_decimal(tie["tolerance"], signed=False)
        if abs(total) > tolerance:
            report.fail("X_TIES", f"tie {tie['id']}: off by {total} (tolerance {tie['tolerance']})")

    for cid in SCOPES:
        report.done(cid)
    return report.render(LIMITATIONS)


def _structure(doc, report) -> bool:
    if not isinstance(doc, dict):
        report.fail("X_STRUCTURE", "document must be a JSON object")
        return False
    ok = True
    if not nonblank(doc.get("tenant_id")):
        report.fail("X_STRUCTURE", "tenant_id is required")
        ok = False
    pages = doc.get("pages")
    if not isinstance(pages, list) or not pages or not all(
        isinstance(p, dict) and isinstance(p.get("page"), int) and not isinstance(p.get("page"), bool) and isinstance(p.get("text"), str) for p in pages
    ):
        report.fail("X_STRUCTURE", "pages must be a non-empty list of {page: int, text: str}")
        return False
    figures = doc.get("figures")
    if not isinstance(figures, list) or not figures:
        report.fail("X_STRUCTURE", "figures must be a non-empty list")
        return False
    for i, f in enumerate(figures):
        if not isinstance(f, dict) or any(not nonblank(f.get(k)) for k in FIGURE_FIELDS) or not isinstance(f.get("page"), int) or isinstance(f.get("page"), bool):
            report.fail("X_STRUCTURE", f"figures[{i}] needs non-empty {', '.join(FIGURE_FIELDS)} and an integer page")
            ok = False
            continue
        if parse_decimal(f["value"], signed=True) is None:
            report.fail("X_STRUCTURE", f"figure {f['id']}: value {f['value']!r} must be a plain decimal string such as 412345 or -6")
            ok = False
        if f["evidence_class"] not in EVIDENCE_CLASSES:
            report.fail("X_STRUCTURE", f"figure {f['id']}: evidence_class must be one of {', '.join(sorted(EVIDENCE_CLASSES))}")
            ok = False
    if not ok:
        return False
    for fid, n in Counter(f["id"] for f in figures).items():
        if n > 1:
            report.fail("X_STRUCTURE", f"figure id {fid} appears {n} times")
            ok = False
    ids = {f["id"] for f in figures}
    ties = doc.get("ties")
    if not isinstance(ties, list):
        report.fail("X_STRUCTURE", "ties must be a list (it may be empty)")
        return False
    for i, tie in enumerate(ties):
        terms = tie.get("terms") if isinstance(tie, dict) else None
        if (
            not isinstance(tie, dict) or not nonblank(tie.get("id")) or parse_decimal(tie.get("tolerance"), signed=False) is None
            or not isinstance(terms, list) or len(terms) < 2
            or not all(isinstance(t, list) and len(t) == 2 and t[1] in (1, -1) and not isinstance(t[1], bool) for t in terms)
        ):
            report.fail("X_STRUCTURE", f"ties[{i}] needs an id, a decimal tolerance and at least two [figure_id, 1 or -1] terms")
            ok = False
            continue
        unknown = [t[0] for t in terms if t[0] not in ids]
        if unknown:
            report.fail("X_STRUCTURE", f"tie {tie['id']} references unknown figures {unknown}")
            ok = False
    return ok


if __name__ == "__main__":
    sys.exit(cli(validate))
