"""Builds the synthetic bank trial balance (A2, A15) used by the demo and tests.

Run: python data/synthetic/make_synthetic.py
Writes tb_2026-09.csv. The bank is fictional ("Synthetic Bank", client id SYNBANK); amounts are USD, year to date
for income statement accounts (A16). Seeded policy gaps (phase2-ontology.md section 5) are marked in GAPS below.
Retained earnings is the balancing figure, so the file always balances.
"""
from __future__ import annotations

import csv
from decimal import Decimal
from pathlib import Path

M = Decimal("1000000")  # amounts below are in USD millions

# code, name, side, amount (USD m), business_line, cost_centre, credit_stage
ROWS: list[tuple[str, str, str, str, str, str, str]] = [
    ("1000", "Cash and balances with central bank", "D", "1250", "Treasury", "", ""),
    ("1100", "Due from banks", "D", "340", "Treasury", "", ""),
    ("1200", "Investment securities - FVOCI", "D", "2100", "Treasury", "", ""),
    ("1210", "Investment securities - amortised cost", "D", "1450", "Treasury", "", ""),
    ("1300", "Trading assets", "D", "260", "Treasury", "", ""),
    ("1310", "Derivative assets", "D", "85", "Treasury", "", ""),
    ("1400", "Residential mortgages", "D", "5800", "Retail", "", "Stage1"),
    ("1400", "Residential mortgages", "D", "420", "Retail", "", "Stage2"),
    ("1400", "Residential mortgages", "D", "95", "Retail", "", "Stage3"),
    ("1410", "Commercial loans", "D", "3100", "Commercial", "", "Stage1"),
    ("1410", "Commercial loans", "D", "310", "Commercial", "", "Stage2"),
    ("1410", "Commercial loans", "D", "120", "Commercial", "", "Stage3"),
    ("1420", "Credit card receivables", "D", "640", "Retail", "", "Stage1"),
    ("1490", "Allowance for loan losses", "C", "165", "", "", ""),                 # GAP stage_not_captured
    ("1500", "Premises and equipment", "D", "180", "CorporateCentre", "", ""),
    ("1510", "Right-of-use assets", "D", "95", "CorporateCentre", "", ""),
    ("1600", "Goodwill", "D", "150", "CorporateCentre", "", ""),
    ("1610", "Software and other intangibles", "D", "110", "CorporateCentre", "", ""),
    ("1700", "Deferred tax assets", "D", "40", "CorporateCentre", "", ""),
    ("1900", "Other assets", "D", "75", "CorporateCentre", "", ""),
    ("2000", "Due to banks", "C", "600", "Treasury", "", ""),
    ("2100", "Current accounts", "C", "3000", "Retail", "", ""),
    ("2100", "Current accounts", "C", "1200", "Commercial", "", ""),
    ("2110", "Savings deposits", "C", "4800", "Retail", "", ""),
    ("2120", "Term deposits", "C", "2900", "Wealth", "", ""),
    ("2200", "Debt securities issued", "C", "1800", "Treasury", "", ""),
    ("2210", "Subordinated debt", "C", "400", "Treasury", "", ""),
    ("2300", "Derivative liabilities", "C", "80", "Treasury", "", ""),
    ("2400", "Lease liabilities", "C", "105", "CorporateCentre", "", ""),
    ("2500", "Current tax payable", "C", "25", "CorporateCentre", "", ""),
    ("2600", "Provisions", "C", "30", "CorporateCentre", "", ""),
    ("2900", "Other liabilities", "C", "95", "CorporateCentre", "", ""),
    ("3000", "Share capital", "C", "1200", "CorporateCentre", "", ""),
    ("3200", "FVOCI reserve", "C", "35", "CorporateCentre", "", ""),
    ("3300", "Non-controlling interests", "C", "20", "CorporateCentre", "", ""),
    ("4000", "Interest income - loans", "C", "330", "Retail", "", ""),
    ("4000", "Interest income - loans", "C", "190", "Commercial", "", ""),
    ("4010", "Interest income - securities", "C", "110", "Treasury", "", ""),
    ("5000", "Interest expense - deposits", "D", "150", "Retail", "", ""),
    ("5000", "Interest expense - deposits", "D", "60", "Wealth", "", ""),
    ("5010", "Interest expense - debt issued", "D", "70", "Treasury", "", ""),
    ("4100", "Loan and card fees", "C", "95", "Retail", "", ""),                    # GAP recognition_basis_mixed
    ("4110", "Account service fees", "C", "60", "Retail", "", ""),
    ("4120", "Wealth management fees", "C", "45", "Wealth", "", ""),
    ("4130", "Card interchange net of scheme costs", "C", "22", "Retail", "", ""),  # GAP gross_vs_net
    ("5100", "Fee and commission expense", "D", "18", "Retail", "", ""),
    ("4200", "Trading income", "C", "40", "Treasury", "", ""),
    ("4300-RET", "Insurance commission - Retail", "C", "12", "", "", ""),          # GAP dimension_in_account
    ("4300-COM", "Insurance commission - Commercial", "C", "6", "", "", ""),        # GAP dimension_in_account
    ("4900", "Sundry income", "C", "38", "", "", ""),                                # GAP catch_all_account
    ("6000", "Salaries and benefits", "D", "140", "", "OPS01", ""),
    ("6000", "Salaries and benefits", "D", "40", "", "IT01", ""),
    ("6000", "Salaries and benefits", "D", "30", "", "FIN01", ""),
    ("6000", "Salaries and benefits", "D", "30", "", "HR01", ""),
    ("6100", "IT costs", "D", "85", "CorporateCentre", "IT01", ""),                 # allocation pool (step 5)
    ("6200", "Rent expense", "D", "12", "CorporateCentre", "BR01", ""),             # GAP lease_model_difference
    ("6210", "Premises costs", "D", "28", "CorporateCentre", "BR01", ""),
    ("6300", "Depreciation and amortisation", "D", "45", "CorporateCentre", "CORP01", ""),
    ("6400", "Software development costs", "D", "18", "CorporateCentre", "IT01", ""),  # GAP capitalisation_policy
    ("6900", "Other operating expenses", "D", "55", "CorporateCentre", "CORP01", ""),
    ("6950", "Marketing expense", "C", "3", "Retail", "", ""),                      # GAP unmappable_sign
    ("7000", "Credit loss expense", "D", "60", "", "", ""),
    ("8000", "Income tax expense", "D", "55", "CorporateCentre", "", ""),
]
RETAINED = ("3100", "Retained earnings", "CorporateCentre")


def build(out: Path) -> None:
    debit = sum(Decimal(a) for _, _, s, a, *_ in ROWS if s == "D")
    credit = sum(Decimal(a) for _, _, s, a, *_ in ROWS if s == "C")
    plug = debit - credit
    if plug <= 0:
        raise SystemExit("retained earnings would not be a credit; adjust the data")
    rows = [*ROWS, (RETAINED[0], RETAINED[1], "C", str(plug), RETAINED[2], "", "")]
    with out.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["account_code", "account_name", "debit", "credit", "business_line", "cost_centre", "credit_stage"])
        for code, name, side, amt, bl, cc, stage in rows:
            value = f"{Decimal(amt) * M:,.2f}"
            w.writerow([code, name, value if side == "D" else "", value if side == "C" else "", bl, cc, stage])


if __name__ == "__main__":
    build(Path(__file__).with_name("tb_2026-09.csv"))
