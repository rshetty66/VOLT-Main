"""Builds data/peers/peers.json (the peer registry, peer-results-search-spec.md section 3) from the corpus manifest.

Usage: python tools/make_peers.py /mnt/project-files/volt-ledger/corpus/manifest.csv

Calendars, release lags and URL templates are written here by hand from the corpus (24 Nov 2026); every known
document URL, hash and page count comes from the manifest. Release lags are [ASSUMPTION P2]: about how long after
period end each issuer publishes, used only to decide which period is "latest".
JSON rather than the spec's YAML, so the service needs no YAML parser [ASSUMPTION P3].
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

OUT = Path(__file__).resolve().parent.parent / "data" / "peers" / "peers.json"

# peer_id: (manifest institution, segment, fiscal_year_end MM-DD, cadence, release_lag_days, templates)
PEERS = {
    "rbc": ("Royal Bank of Canada", "big6", "10-31", "quarterly", 35, {
        "press_release": "https://www.rbc.com/investor-relations/_assets-custom/pdf/{fy}q{q}release.pdf",
        "supplementary_financial_info": "https://www.rbc.com/investor-relations/_assets-custom/pdf/{yy}q{q}supp.pdf",
        "report_to_shareholders": "https://www.rbc.com/investor-relations/_assets-custom/pdf/{fy}q{q}_report.pdf"}),
    "td": ("TD Bank Group", "big6", "10-31", "quarterly", 35, {
        "press_release": "https://www.td.com/content/dam/tdcom/canada/about-td/pdf/quarterly-results/{fy}/q{q}/{fy}-q{q}-earnings-newsrelease-en.pdf",
        "supplementary_financial_info": "https://www.td.com/content/dam/tdcom/canada/about-td/pdf/quarterly-results/{fy}/q{q}/{fy}-q{q}-financial-supppack-en.pdf",
        "report_to_shareholders": "https://www.td.com/content/dam/tdcom/canada/about-td/pdf/quarterly-results/{fy}/q{q}/{fy}-q{q}-report-shareholders-en.pdf"}),
    "bmo": ("BMO Financial Group", "big6", "10-31", "quarterly", 35, {
        "press_release": "https://www.bmo.com/ir/qtrinfo/1/{fy}-q{q}/Q{q}{yy}_EarningsRelease.pdf",
        "supplementary_financial_info": "https://www.bmo.com/ir/qtrinfo/1/{fy}-q{q}/SuppQ{q}{yy}.pdf",
        "report_to_shareholders": "https://www.bmo.com/ir/qtrinfo/1/{fy}-q{q}/Q{q}{yy}_ReportToShareholders.pdf"}),
    "bns": ("Scotiabank", "big6", "10-31", "quarterly", 35, {
        "press_release": "https://www.scotiabank.com/content/dam/scotiabank/corporate/quarterly-reports/{fy}/q{q}/Q{q}{yy}_Quarterly_Press_Release-EN.pdf",
        "supplementary_financial_info": "https://www.scotiabank.com/content/dam/scotiabank/corporate/quarterly-reports/{fy}/q{q}/Q{q}{yy}_Supplementary_Financial_Information-EN.pdf",
        "report_to_shareholders": "https://www.scotiabank.com/content/dam/scotiabank/corporate/quarterly-reports/{fy}/q{q}/Q{q}{yy}_Shareholders_Report-EN.pdf"}),
    "cibc": ("CIBC", "big6", "10-31", "quarterly", 35, {
        "press_release": "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/{fy}/q{q}{yy}newsrelease-en.pdf",
        "supplementary_financial_info": "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/{fy}/q{q}{yy}financials-en.pdf",
        "report_to_shareholders": "https://www.cibc.com/content/dam/cibc-public-assets/about-cibc/investor-relations/pdfs/quarterly-results/{fy}/q{q}{yy}report-en.pdf"}),
    "nbc": ("National Bank of Canada", "big6", "10-31", "quarterly", 35, {
        "press_release": "https://www.nbc.ca/content/dam/bnc/a-propos-de-nous/relations-investisseurs/resultats-trimestriels/{fy}/comm-q{q}-{fy}.pdf",
        "supplementary_financial_info": "https://www.nbc.ca/content/dam/bnc/a-propos-de-nous/relations-investisseurs/resultats-trimestriels/{fy}/suppack-q{q}-{fy}.pdf",
        "report_to_shareholders": "https://www.nbc.ca/content/dam/bnc/a-propos-de-nous/relations-investisseurs/resultats-trimestriels/{fy}/report-shareholder-q{q}-{fy}.pdf"}),
    "eqb": ("EQB Inc.", "midsize", "10-31", "quarterly", 35, {
        "press_release": "https://eqb.investorroom.com/download/EQB+Earnings+Release+-+Q{q}+{fy}+SEDAR.pdf",
        "report_to_shareholders": "https://eqb.investorroom.com/download/EQB+Report+to+Shareholders+Q{q}+{fy}+SEDAR.pdf"}),
    "lb": ("Laurentian Bank of Canada", "midsize", "10-31", "quarterly", 35, {}),
    "atb": ("ATB Financial", "midsize", "03-31", "quarterly", 60, {
        "quarterly_report": "https://www.atb.com/siteassets/pdf/company/our-business/quarterly-reports/atb-financial-fy{yy}-q{q}-results.pdf"}),
    "sprott": ("Sprott Inc.", "asset_manager", "12-31", "quarterly", 45, {}),
    "otpp": ("Ontario Teachers' Pension Plan", "pension", "12-31", "semiannual", 70, {}),
    "omers": ("OMERS", "pension", "12-31", "semiannual", 70, {}),
    "cppib": ("CPP Investments", "pension", "03-31", "quarterly", 50, {}),
    "desjardins": ("Desjardins Group", "cooperative", "12-31", "quarterly", 45, {}),
    "manulife": ("Manulife", "insurer", "12-31", "quarterly", 45, {
        "report_to_shareholders": "https://www.manulife.com/content/dam/manulife-com/ca/financial-documents/investors/MFC_SR_{fy}_Q{q}_EN.pdf",
        "supplementary_financial_info": "https://www.manulife.com/content/dam/manulife-com/ca/financial-documents/investors/MFC_SIP_{fy}_Q{q}_EN.pdf",
        "interim_financial_statements": "https://www.manulife.com/content/dam/manulife-com/ca/financial-documents/investors/MFC_FS_{fy}_Q{q}_EN.pdf"}),
    "sunlife": ("Sun Life", "insurer", "12-31", "quarterly", 45, {
        "press_release": "https://www.sunlife.com/content/dam/sunlife/regional/global-marketing/documents/com/pa-e-q{q}{yy}-earnings.pdf",
        "supplementary_financial_info": "https://www.sunlife.com/content/dam/sunlife/regional/global-marketing/documents/com/pa-e-q{q}{yy}-finsupp.pdf",
        "report_to_shareholders": "https://www.sunlife.com/content/dam/sunlife/regional/global-marketing/documents/com/pa-e-q{q}{yy}-shrpt.pdf"}),
    "gwo": ("Great-West Lifeco", "insurer", "12-31", "quarterly", 45, {
        "report_to_shareholders": "https://www.canadalife.com/content/dam/lifeco/documents/investor-relations/reports/{fy}/q{q}/lifeco-q{q}-{fy}-quarterly-report-to-shareholders-en.pdf",
        "supplementary_financial_info": "https://www.canadalife.com/content/dam/lifeco/documents/investor-relations/reports/{fy}/q{q}/lifeco-q{q}-{fy}-supplement.pdf"}),
    "ia": ("iA Financial Group", "insurer", "12-31", "quarterly", 45, {}),
    "intact": ("Intact Financial", "insurer", "12-31", "quarterly", 45, {
        "mdna": "https://www.intactfc.com/presentations/Q{q}-{fy}-MDA.pdf",
        "interim_financial_statements": "https://www.intactfc.com/presentations/Q{q}_{fy}_Financial-Statements.pdf",
        "supplementary_financial_info": "https://www.intactfc.com/presentations/Q{q}-{fy}-Stats-Supplement.pdf"}),
    "vancity": ("Vancity", "credit_union", "12-31", "annual", 100, {}),
    "servus": ("Servus Credit Union", "credit_union", "10-31", "quarterly", 45, {}),
    "meridian": ("Meridian Credit Union", "credit_union", "12-31", "annual", 100, {}),
    "coast_capital": ("Coast Capital", "credit_union", "12-31", "annual", 100, {}),
}
EXTRA_DOMAINS = {"coast_capital": ["www.coastcapitalsavings.com"], "manulife": ["www.manulife.com"],
                 "cppib": ["www.cppinvestments.com"], "meridian": ["www.meridiancu.ca"]}
GROUPS = {
    "big6": ["rbc", "td", "bmo", "bns", "cibc", "nbc"],
    "canadian_midsize": ["eqb", "lb", "atb"],
    "canadian_banks": ["rbc", "td", "bmo", "bns", "cibc", "nbc", "eqb", "lb"],
    "cooperatives_and_credit_unions": ["desjardins", "vancity", "servus", "meridian", "coast_capital"],
    "insurers": ["manulife", "sunlife", "gwo", "ia", "intact"],
    "maple_pensions": ["cppib", "otpp", "omers"],
    "asset_managers": ["sprott"],
}
# Allowed for secondary copies only (spec section 2): news wires and SEC EDGAR. Never news sites or aggregators.
SECONDARY_DOMAINS = ["www.newswire.ca", "www.prnewswire.com", "www.sec.gov"]
AGGREGATORS = {"ca.finance.yahoo.com", "finance.yahoo.com"}


def period_key(fiscal_period: str) -> str:
    """'Q3 FY2026' or 'Q3 2026' -> 'FY2026-Q3'; 'H1 2026' -> 'FY2026-H1'; 'FY2025' -> 'FY2025'."""
    m = re.fullmatch(r"(Q[1-4]|H[12])\s+(?:FY)?(\d{4})", fiscal_period.strip())
    if m:
        return f"FY{m.group(2)}-{m.group(1)}"
    m = re.fullmatch(r"FY(\d{4})", fiscal_period.strip())
    if m:
        return f"FY{m.group(1)}"
    raise ValueError(f"unrecognised fiscal period {fiscal_period!r}")


def build(manifest: Path) -> dict:
    rows = list(csv.DictReader(manifest.open(newline="", encoding="utf-8")))
    peers = []
    for pid, (inst, segment, fye, cadence, lag, templates) in PEERS.items():
        docs = [r for r in rows if r["institution"] == inst]
        domains = sorted({urlparse(r["url"]).hostname for r in docs if r["source_tier"] == "primary"}
                         | {urlparse(t).hostname for t in templates.values()} | set(EXTRA_DOMAINS.get(pid, [])))
        domains = [d for d in domains if d not in SECONDARY_DOMAINS and d not in AGGREGATORS]
        # Aggregators are never a source (spec section 2); news-wire copies are secondary whatever the manifest says.
        docs = [r for r in docs if urlparse(r["url"]).hostname not in AGGREGATORS]
        known = [{"period": period_key(r["fiscal_period"]), "period_end": r["period_end"], "doc_type": r["doc_type"],
                  "url": r["url"], "sha256": r["sha256"],
                  "source_tier": "secondary" if urlparse(r["url"]).hostname in SECONDARY_DOMAINS else r["source_tier"],
                  "pages": int(r["pages"]) if r["pages"] else None, "corpus_path": r["local_path"],
                  "file_type": r["file_type"]} for r in docs]
        peers.append({"peer_id": pid, "name": inst, "segment": segment, "gaap": "ifrs", "fiscal_year_end": fye,
                      "cadence": cadence, "release_lag_days": lag, "ir_domains": domains, "templates": templates,
                      "known_documents": known})
    return {"version": "peers-v1", "built_from": "corpus/manifest.csv (24 Nov 2026)", "groups": GROUPS,
            "secondary_domains": SECONDARY_DOMAINS, "peers": peers}


if __name__ == "__main__":
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(build(Path(sys.argv[1])), indent=1) + "\n")
    print(f"wrote {OUT}")
