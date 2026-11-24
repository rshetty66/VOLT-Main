"""Builds synthetic FSDF data for schema.sql: every banking and insurance product family, tied to the GL.

Run: python fsdf/make_synthetic.py [out.sql]   (from apps/volt-ledger)
Writes fsdf/synthetic_data.sql (Oracle INSERTs, load after schema.sql).

Two fictional entities, as of 2026-09-30, IFRS ledger, USD:
- 001 SYNBANK: the volt-ledger synthetic bank. Its GL is data/synthetic/tb_2026-09.csv moved onto the target chart
  in tests/golden/synbank_target_coa.json. Contract-backed lines are split by product, and contracts are generated
  so their positions add up to those lines exactly. Each synthetic contract stands for a pool of similar accounts,
  so amounts per contract are large.
- 002 SYNINS: a small insurer, added so the insurance families have a GL to tie to. Its accounts use proposed
  insurance concepts that are not yet in mvg-bank-v1.json.

Deterministic: the same inputs always give the same file.
"""
from __future__ import annotations

import csv
import json
import random
import re
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
TB = APP / "data" / "synthetic" / "tb_2026-09.csv"
TARGET = APP / "tests" / "golden" / "synbank_target_coa.json"
SCHEMA = Path(__file__).with_name("schema.sql")
OUT = Path(__file__).with_name("synthetic_data.sql")

AS_OF = date(2026, 9, 30)
LEDGER = "IFRS"
CCY = "USD"
M = Decimal("1000000")
C2 = Decimal("0.01")
rng = random.Random(20260930)


def q(x) -> Decimal:
    return Decimal(x).quantize(C2, rounding=ROUND_HALF_UP)


def split(total: Decimal, n: int, spread: float = 0.6) -> list[Decimal]:
    """Split total into n positive amounts that add up to it exactly."""
    w = [1 + rng.uniform(-spread, spread) for _ in range(n)]
    s = sum(w)
    parts = [q(total * Decimal(x / s)) for x in w]
    parts[-1] += total - sum(parts)
    return parts


def split_by(total: Decimal, weights: list[Decimal]) -> list[Decimal]:
    s = sum(weights)
    parts = [q(total * w / s) for w in weights]
    parts[-1] += total - sum(parts)
    return parts


# --------------------------------------------------------------------------------------------------------------
# Row store: table -> list of dicts, written in schema order
# --------------------------------------------------------------------------------------------------------------
rows: dict[str, list[dict]] = {}
seq: dict[str, int] = {}


def add(table: str, **cols) -> dict:
    rows.setdefault(table, []).append(cols)
    return cols


def nxt(name: str) -> int:
    seq[name] = seq.get(name, 0) + 1
    return seq[name]


# --------------------------------------------------------------------------------------------------------------
# Reference data
# --------------------------------------------------------------------------------------------------------------
for c, n in [("USD", "US dollar"), ("CAD", "Canadian dollar"), ("EUR", "Euro"), ("GBP", "Pound sterling")]:
    add("dim_currency", v_ccy_code=c, v_ccy_name=n, n_decimals=2)
for c, n, r in [("US", "United States", "NA"), ("CA", "Canada", "NA"), ("GB", "United Kingdom", "EU"),
                ("DE", "Germany", "EU")]:
    add("dim_country", v_country_code=c, v_country_name=n, v_region=r)

EFF = date(2020, 1, 1)
ORG: dict[str, int] = {}


def org(code, name, htype, otype, seg, parent=None):
    sk = nxt("org")
    ORG[code] = sk
    add("dim_org_unit", n_org_sk=sk, v_org_code=code, v_org_name=name, v_hierarchy_type=htype, v_org_type=otype,
        n_parent_org_sk=ORG.get(parent) if parent else None, v_country_code="US", v_functional_ccy=CCY,
        v_segment_code=seg, d_eff_start=EFF)


org("SYNBANK", "Synthetic Bank", "LEGAL", "ENTITY", "001")
org("SYNINS", "Synthetic Insurance Co", "LEGAL", "ENTITY", "002", "SYNBANK")
org("GROUP", "Synthetic Group", "MGMT", "BUSINESS_LINE", "GRP")
for bl in ["Retail", "Commercial", "Wealth", "Treasury", "CorporateCentre", "Insurance"]:
    org(bl, bl, "MGMT", "BUSINESS_LINE", bl, "GROUP")
for cc in ["OPS01", "IT01", "FIN01", "HR01", "BR01", "CORP01"]:
    org(cc, f"Cost centre {cc}", "MGMT", "COST_CENTRE", cc)
ENTITY = {"001": ORG["SYNBANK"], "002": ORG["SYNINS"]}

# code, name, class, family, accounting treatment, segment code, interest rate (for accruals and P&L splits)
PRODUCTS = [
    ("RES_MTG", "Residential mortgage", "BANKING", "MORTGAGE", "AMORT_COST", "MTG", "0.052"),
    ("COMM_LOAN", "Commercial term loan", "BANKING", "LOAN", "AMORT_COST", "COM", "0.068"),
    ("EQUIP_LEASE", "Equipment finance lease", "BANKING", "LEASE", "AMORT_COST", "LSE", "0.071"),
    ("BUS_OD", "Business overdraft", "BANKING", "OVERDRAFT", "AMORT_COST", "ODR", "0.095"),
    ("CREDIT_CARD", "Credit card", "BANKING", "CARD", "AMORT_COST", "CRD", "0.199"),
    ("NOSTRO", "Nostro account", "BANKING", "CASA", "AMORT_COST", "NST", "0"),
    ("REV_REPO", "Reverse repo", "BANKING", "REPO_SBL", "AMORT_COST", "RRP", "0.043"),
    ("REPO", "Repo", "BANKING", "REPO_SBL", "AMORT_COST", "RPO", "0.044"),
    ("BOND_FVOCI", "Bonds at FVOCI", "BANKING", "INVESTMENT", "FVOCI", "BFV", "0.041"),
    ("BOND_AC", "Bonds at amortised cost", "BANKING", "INVESTMENT", "AMORT_COST", "BAC", "0.038"),
    ("EQUITY_HFT", "Trading equities", "BANKING", "INVESTMENT", "FVTPL", "EQT", "0"),
    ("IRS", "Interest rate swap", "BANKING", "DERIVATIVE", "FVTPL", "IRS", "0"),
    ("FX_FWD", "FX forward", "BANKING", "DERIVATIVE", "FVTPL", "FXF", "0"),
    ("CDS", "Credit default swap", "BANKING", "DERIVATIVE", "FVTPL", "CDS", "0"),
    ("CURR_ACCT", "Current account", "BANKING", "CASA", "AMORT_COST", "CUR", "0.004"),
    ("SAVINGS", "Savings account", "BANKING", "CASA", "AMORT_COST", "SAV", "0.032"),
    ("TERM_DEP", "Term deposit", "BANKING", "TERM_DEPOSIT", "AMORT_COST", "TDP", "0.041"),
    ("INTERBANK", "Interbank borrowing", "BANKING", "BORROWING", "AMORT_COST", "IBK", "0.045"),
    ("ISSUED_BOND", "Senior bond issued", "BANKING", "BORROWING", "AMORT_COST", "BND", "0.047"),
    ("SUB_DEBT", "Subordinated debt", "BANKING", "BORROWING", "AMORT_COST", "SUB", "0.061"),
    ("REVOLVER", "Revolving credit facility", "BANKING", "FACILITY", "AMORT_COST", "RCF", "0"),
    ("LC", "Documentary letter of credit", "BANKING", "TRADE_FINANCE", "AMORT_COST", "TLC", "0"),
    ("GUARANTEE", "Bank guarantee", "BANKING", "TRADE_FINANCE", "AMORT_COST", "TGT", "0"),
    ("TERM_LIFE", "Term life", "INSURANCE", "LIFE", "IFRS17_GMM", "LIF", "0"),
    ("UNIV_LIFE", "Universal life", "INSURANCE", "LIFE", "IFRS17_VFA", "ULF", "0"),
    ("ANNUITY", "Deferred annuity", "INSURANCE", "ANNUITY", "IFRS17_GMM", "ANN", "0"),
    ("GRP_HEALTH", "Group health", "INSURANCE", "HEALTH", "IFRS17_PAA", "HLT", "0"),
    ("MOTOR", "Personal motor", "INSURANCE", "PNC", "IFRS17_PAA", "MTR", "0"),
    ("PROPERTY", "Commercial property", "INSURANCE", "PNC", "IFRS17_PAA", "PRP", "0"),
    ("REINS_ASSUMED", "Reinsurance assumed", "INSURANCE", "REINS_ASSUMED", "IFRS17_GMM", "RIA", "0"),
    ("REINS_HELD", "Reinsurance held", "INSURANCE", "REINS_HELD", "IFRS17_GMM", "RIH", "0"),
]
PROD: dict[str, int] = {}
PINFO: dict[str, tuple] = {}
for code, name, cls, fam, treat, seg, rate in PRODUCTS:
    sk = nxt("product")
    PROD[code] = sk
    PINFO[code] = (cls, fam, treat, Decimal(rate))
    add("dim_product", n_product_sk=sk, v_product_code=code, v_product_name=name, v_business_class=cls,
        v_contract_family=fam, n_hierarchy_level=1, v_acct_treatment=treat, v_segment_code=seg, d_eff_start=EFF)

# GL accounts: target chart plus proposed insurance accounts
target = json.loads(TARGET.read_text())
ins_accounts = [
    {"code": "18000", "name": "Insurance and reinsurance assets", "class": "asset", "parent": "10000"},
    {"code": "18100", "name": "Reinsurance contract assets", "class": "asset", "parent": "18000",
     "concept_id": "canon:ReinsuranceContractAssets"},
    {"code": "24000", "name": "Insurance contract liabilities", "class": "liability", "parent": "20000"},
    {"code": "24100", "name": "Insurance contract liabilities", "class": "liability", "parent": "24000",
     "concept_id": "canon:InsuranceContractLiabilities"},
    {"code": "45000", "name": "Insurance service result", "class": "revenue", "parent": "40000"},
    {"code": "45100", "name": "Insurance revenue", "class": "revenue", "parent": "45000",
     "concept_id": "canon:InsuranceRevenue"},
    {"code": "55000", "name": "Insurance service expenses", "class": "expense", "parent": "50000"},
    {"code": "55100", "name": "Insurance service expense", "class": "expense", "parent": "55000",
     "concept_id": "canon:InsuranceServiceExpense"},
    {"code": "55200", "name": "Net expense from reinsurance held", "class": "expense", "parent": "55000",
     "concept_id": "canon:NetExpenseFromReinsuranceHeld"},
    {"code": "56000", "name": "Insurance finance", "class": "expense", "parent": "50000"},
    {"code": "56100", "name": "Insurance finance expense", "class": "expense", "parent": "56000",
     "concept_id": "canon:InsuranceFinanceIncomeExpense"},
]
ACCT_TYPE = {"asset": "ASSET", "liability": "LIABILITY", "equity": "EQUITY", "revenue": "INCOME",
             "expense": "EXPENSE"}
GL: dict[str, int] = {}
for a in target["design"]["accounts"] + ins_accounts:
    sk = nxt("gl")
    GL[a["code"]] = sk
    t = ACCT_TYPE[a["class"]]
    add("dim_gl_account", n_gl_account_sk=sk, v_gl_account_code=a["code"], v_gl_account_name=a["name"],
        v_account_type=t, v_normal_balance="DR" if t in ("ASSET", "EXPENSE") else "CR",
        v_statement_class="BS" if t in ("ASSET", "LIABILITY", "EQUITY") else "PL",
        v_concept_id=a.get("concept_id"), n_parent_gl_sk=GL.get(a.get("parent") or ""), d_eff_start=EFF)

# Mapping rules (CoA brain output in FSDF form)
RULES = {
    "RES_MTG": [("CARRYING", "13100", 1), ("ALLOWANCE", "13900", -1)],
    "COMM_LOAN": [("CARRYING", "13200", 1), ("ALLOWANCE", "13900", -1)],
    "EQUIP_LEASE": [("CARRYING", "13200", 1), ("ALLOWANCE", "13900", -1)],
    "BUS_OD": [("CARRYING", "13200", 1), ("ALLOWANCE", "13900", -1)],
    "CREDIT_CARD": [("CARRYING", "13300", 1), ("ALLOWANCE", "13900", -1)],
    "NOSTRO": [("CARRYING", "11200", 1)], "REV_REPO": [("CARRYING", "11200", 1)],
    "BOND_FVOCI": [("CARRYING", "12100", 1)], "BOND_AC": [("CARRYING", "12200", 1)],
    "EQUITY_HFT": [("CARRYING", "12300", 1)],
    "IRS": [("FV_POSITIVE", "12400", 1), ("FV_NEGATIVE", "23100", 1)],
    "FX_FWD": [("FV_POSITIVE", "12400", 1), ("FV_NEGATIVE", "23100", 1)],
    "CDS": [("FV_POSITIVE", "12400", 1), ("FV_NEGATIVE", "23100", 1)],
    "CURR_ACCT": [("CARRYING", "21200", -1)], "SAVINGS": [("CARRYING", "21300", -1)],
    "TERM_DEP": [("CARRYING", "21400", -1)], "REPO": [("CARRYING", "21100", -1)],
    "INTERBANK": [("CARRYING", "21100", -1)], "ISSUED_BOND": [("CARRYING", "22100", -1)],
    "SUB_DEBT": [("CARRYING", "22200", -1)],
    **{p: [("IFRS17_LRC_LIC", "24100", -1)] for p in
       ["TERM_LIFE", "UNIV_LIFE", "ANNUITY", "GRP_HEALTH", "MOTOR", "PROPERTY", "REINS_ASSUMED"]},
    "REINS_HELD": [("IFRS17_LRC_LIC", "18100", 1)],
}
for p, rl in RULES.items():
    for bt, acct, sign in rl:
        add("dim_gl_map_rule", n_product_sk=PROD[p], v_balance_type=bt, v_ledger=LEDGER, n_gl_account_sk=GL[acct],
            n_sign=sign)

# --------------------------------------------------------------------------------------------------------------
# GL lines. key: (entity, account, business line, product, stage, cost centre) -> signed USD (debit positive)
# --------------------------------------------------------------------------------------------------------------
gl_lines: dict[tuple, Decimal] = {}


def gl_add(ent, acct, bl, prod, stage, cc, amt: Decimal):
    k = (ent, acct, bl or "", prod or "", stage or "NA", cc or "")
    gl_lines[k] = gl_lines.get(k, Decimal(0)) + amt


legacy_to_target = {m["legacy_code"]: m for m in target["mapping"]}
STAGE = {"Stage1": "1", "Stage2": "2", "Stage3": "3", "": "NA"}

# Product splits for SYNBANK balance sheet lines that are backed by contracts (USD m; stage-1 or unstaged rows)
SPLITS = {
    ("1100", ""): [("NOSTRO", 240), ("REV_REPO", 100)],
    ("1200", ""): [("BOND_FVOCI", 2100)], ("1210", ""): [("BOND_AC", 1450)], ("1300", ""): [("EQUITY_HFT", 260)],
    ("1310", ""): [("IRS", 50), ("FX_FWD", 25), ("CDS", 10)],
    ("2300", ""): [("IRS", 45), ("FX_FWD", 30), ("CDS", 5)],
    ("1400", "Stage1"): [("RES_MTG", 5800)], ("1400", "Stage2"): [("RES_MTG", 420)],
    ("1400", "Stage3"): [("RES_MTG", 95)],
    ("1410", "Stage1"): [("COMM_LOAN", 2800), ("EQUIP_LEASE", 200), ("BUS_OD", 100)],
    ("1410", "Stage2"): [("COMM_LOAN", 310)], ("1410", "Stage3"): [("COMM_LOAN", 120)],
    ("1420", "Stage1"): [("CREDIT_CARD", 640)],
    ("2000", ""): [("REPO", 150), ("INTERBANK", 450)],
    ("2100", "Retail"): [("CURR_ACCT", 3000)], ("2100", "Commercial"): [("CURR_ACCT", 1200)],
    ("2110", ""): [("SAVINGS", 4800)], ("2120", ""): [("TERM_DEP", 2900)],
    ("2200", ""): [("ISSUED_BOND", 1800)], ("2210", ""): [("SUB_DEBT", 400)],
}
# P&L lines split by product (weights come from the contracts, see below)
PL_SPLIT = {("4000", "Retail"): ["RES_MTG", "CREDIT_CARD"],
            ("4000", "Commercial"): ["COMM_LOAN", "EQUIP_LEASE", "BUS_OD"],
            ("4010", "Treasury"): ["BOND_FVOCI", "BOND_AC"],
            ("5000", "Retail"): ["CURR_ACCT", "SAVINGS"], ("5000", "Wealth"): ["TERM_DEP"],
            ("5010", "Treasury"): ["ISSUED_BOND", "SUB_DEBT"]}

backed: list[tuple] = []   # (entity, account, bl, product, stage, signed amount) lines to generate contracts for
pl_pending: list[tuple] = []
tb_total_by_target: dict[str, Decimal] = {}
with TB.open() as f:
    for r in csv.DictReader(f):
        code = r["account_code"]
        amt = Decimal(r["debit"].replace(",", "") or 0) - Decimal(r["credit"].replace(",", "") or 0)
        m = legacy_to_target[code]
        acct = m["target"]
        tb_total_by_target[acct] = tb_total_by_target.get(acct, Decimal(0)) + amt
        bl = (m.get("segments") or {}).get("BusinessLine") or r["business_line"]
        stage, cc = r["credit_stage"], r["cost_centre"]
        if code == "1490":   # allowance is rebuilt from contract-level ECL below
            continue
        key = (code, stage) if (code, stage) in SPLITS else (code, bl) if (code, bl) in SPLITS else (code, "")
        if key in SPLITS and (key[1] in ("", stage, bl)):
            for prod, amt_m in SPLITS[key]:
                sign = 1 if amt > 0 else -1
                backed.append(("001", acct, bl, prod, STAGE[stage], Decimal(amt_m) * M * sign))
            assert sum(Decimal(a) for _, a in SPLITS[key]) * M == abs(amt), (code, stage)
        elif (code, bl) in PL_SPLIT:
            pl_pending.append(("001", acct, bl, PL_SPLIT[(code, bl)], amt))
        else:
            gl_add("001", acct, bl, None, "NA", cc, amt)
allowance_total = -tb_total_by_target["13900"]   # positive USD

# SYNINS: a fictional insurer (USD m). Retained earnings is the balancing figure.
INS_GL = [
    ("11100", None, "80"), ("12100", "BOND_FVOCI", "1500"), ("18100", "REINS_HELD", "120"),
    ("24100", "TERM_LIFE", "-450"), ("24100", "UNIV_LIFE", "-250"), ("24100", "ANNUITY", "-400"),
    ("24100", "GRP_HEALTH", "-100"), ("24100", "MOTOR", "-70"), ("24100", "PROPERTY", "-50"),
    ("24100", "REINS_ASSUMED", "-30"), ("31000", None, "-250"),
    ("45100", "TERM_LIFE", "-110"), ("45100", "UNIV_LIFE", "-60"), ("45100", "ANNUITY", "-70"),
    ("45100", "GRP_HEALTH", "-140"), ("45100", "MOTOR", "-80"), ("45100", "PROPERTY", "-50"),
    ("45100", "REINS_ASSUMED", "-10"),
    ("55100", "TERM_LIFE", "95"), ("55100", "UNIV_LIFE", "45"), ("55100", "ANNUITY", "60"),
    ("55100", "GRP_HEALTH", "120"), ("55100", "MOTOR", "60"), ("55100", "PROPERTY", "40"),
    ("55100", "REINS_ASSUMED", "10"), ("55200", "REINS_HELD", "15"),
    ("41200", "BOND_FVOCI", "-60"), ("56100", "TERM_LIFE", "15"), ("56100", "UNIV_LIFE", "10"),
    ("56100", "ANNUITY", "15"), ("80000", None, "25"),
]
ins_net = sum(Decimal(a) for *_, a in INS_GL)
INS_GL.append(("32000", None, str(-ins_net)))
for acct, prod, a in INS_GL:
    amt = Decimal(a) * M
    if acct == "12100":
        backed.append(("002", acct, "Insurance", prod, "NA", amt))
    elif acct in ("24100", "18100"):
        pass   # tied through IFRS 17 groups; GL line added when groups are built
    else:
        gl_add("002", acct, "Insurance", prod, "NA", None, amt)
INS_LIAB = {prod: -Decimal(a) * M for acct, prod, a in INS_GL if acct == "24100"}
INS_REV = {prod: -Decimal(a) * M for acct, prod, a in INS_GL if acct == "45100"}
INS_ISE = {prod: Decimal(a) * M for acct, prod, a in INS_GL if acct == "55100"}
INS_FIN = {prod: Decimal(a) * M for acct, prod, a in INS_GL if acct == "56100"}
RIH_TOTAL = Decimal(120) * M

# --------------------------------------------------------------------------------------------------------------
# Parties
# --------------------------------------------------------------------------------------------------------------
PARTY_POOL: dict[str, list[int]] = {}


def party(kind: str, name: str, ptype: str, segment: str, country="US", industry=None) -> int:
    sk = nxt("party")
    lei = None if ptype == "INDIVIDUAL" else f"SYN{sk:017d}"
    add("fsi_d_party", n_party_sk=sk, v_party_id=f"P{sk:06d}", v_source_system="SYN_CIF", v_party_type=ptype,
        v_legal_name=name, v_lei=lei, v_country_code=country, v_industry_code=industry,
        d_birth_or_incorp=date(1950 + sk % 50, 1 + sk % 12, 1 + sk % 28), v_segment=segment,
        v_kyc_risk_rating=["LOW", "MEDIUM", "HIGH"][sk % 3 if sk % 7 else 2], f_pep="N",
        f_related_party="N", d_eff_start=EFF)
    PARTY_POOL.setdefault(kind, []).append(sk)
    if ptype in ("CORPORATE", "BANK", "INSURER", "SOVEREIGN"):
        rt = ["AA", "A", "BBB", "BB", "B"][sk % 5]
        pd = {"AA": "0.0002", "A": "0.0006", "BBB": "0.0020", "BB": "0.0110", "B": "0.0450"}[rt]
        add("fsi_d_party_rating", n_party_sk=sk, v_rating_source="INTERNAL", v_rating_type="ISSUER", v_rating=rt,
            n_pd_12m=Decimal(pd), d_rating_date=date(2026, 6, 30))
    return sk


for i in range(1, 161):
    party("retail", f"Retail Customer {i:04d}", "INDIVIDUAL", "RETAIL")
for i in range(1, 51):
    party("corporate", f"Synthetic Corp {i:03d} Ltd", "CORPORATE", ["SME", "CORPORATE"][i % 2],
          industry=["522110", "236220", "445110", "541511", "484121"][i % 5])
for i in range(1, 11):
    party("bank", f"Counterparty Bank {i:02d}", "BANK", "FI", ["US", "CA", "GB", "DE"][i % 4], "522110")
for i in range(1, 6):
    party("issuer", f"Synthetic Issuer {i:02d}", ["SOVEREIGN", "CORPORATE"][i % 2], "ISSUER", "US")
for i in range(1, 4):
    party("reinsurer", f"Synthetic Re {i:02d}", "INSURER", "REINSURER", ["GB", "DE", "US"][i - 1], "524130")
for i in range(1, 4):
    party("broker", f"Synthetic Brokers {i:02d}", "CORPORATE", "BROKER", "US", "524210")
ccp = party("ccp", "Synthetic Clearing House", "CORPORATE", "CCP", "US", "522320")
# Group structure: corporates 2..5 belong to corporate 1
for child in PARTY_POOL["corporate"][1:5]:
    add("fsi_d_party_relationship", n_party_sk=child, n_related_party_sk=PARTY_POOL["corporate"][0],
        v_relationship="PARENT", n_ownership_pct=Decimal("100"), d_eff_start=EFF)


def pick(kind: str) -> int:
    return rng.choice(PARTY_POOL[kind])


# --------------------------------------------------------------------------------------------------------------
# Contracts
# --------------------------------------------------------------------------------------------------------------
COUNTS = {"RES_MTG": 40, "COMM_LOAN": 20, "EQUIP_LEASE": 8, "BUS_OD": 8, "CREDIT_CARD": 30, "NOSTRO": 4,
          "REV_REPO": 3, "REPO": 3, "BOND_FVOCI": 12, "BOND_AC": 8, "EQUITY_HFT": 6, "IRS": 6, "FX_FWD": 6,
          "CDS": 4, "CURR_ACCT": 25, "SAVINGS": 30, "TERM_DEP": 20, "INTERBANK": 4, "ISSUED_BOND": 4,
          "SUB_DEBT": 2}
STAGE_SHARE = {"1": 1.0, "2": 0.3, "3": 0.2, "NA": 1.0}
BOOK_PARTY = {"RES_MTG": "retail", "CREDIT_CARD": "retail", "CURR_ACCT": "retail", "SAVINGS": "retail",
              "TERM_DEP": "retail", "COMM_LOAN": "corporate", "EQUIP_LEASE": "corporate", "BUS_OD": "corporate",
              "REVOLVER": "corporate", "LC": "corporate", "GUARANTEE": "corporate", "NOSTRO": "bank",
              "REV_REPO": "bank", "REPO": "bank", "INTERBANK": "bank", "IRS": "bank", "FX_FWD": "bank",
              "CDS": "bank", "ISSUED_BOND": "bank", "SUB_DEBT": "bank", "BOND_FVOCI": "issuer",
              "BOND_AC": "issuer", "EQUITY_HFT": "issuer"}
ROLE = {"retail": "BORROWER", "corporate": "BORROWER", "bank": "COUNTERPARTY", "issuer": "ISSUER"}
contracts: list[dict] = []   # in-memory view for later steps


def contract(prod: str, ent: str, bl: str, start: date, maturity: date | None, status="ACTIVE",
             alf: str = "A", book="BANKING_BOOK") -> dict:
    sk = nxt("contract")
    cls, fam, treat, rate = PINFO[prod]
    c = add("fsi_d_contract", n_contract_sk=sk, v_contract_id=f"{PROD[prod]:02d}-{sk:06d}",
            v_source_system="SYN_INS" if cls == "INSURANCE" else "SYN_CORE", v_business_class=cls,
            v_contract_family=fam, n_product_sk=PROD[prod], n_org_sk=ENTITY[ent], n_mgmt_org_sk=ORG[bl],
            v_ccy_code=CCY, d_origination=start, d_start=start, d_maturity=maturity, v_status=status,
            v_book=book, v_asset_liab_flag=alf, v_channel=rng.choice(["BRANCH", "DIGITAL", "BROKER"]))
    contracts.append({"sk": sk, "prod": prod, "ent": ent, "bl": bl, "rate": rate, "alf": alf})
    return c


def days_ago(lo, hi) -> date:
    return AS_OF - timedelta(days=rng.randint(lo, hi))


def years_ahead(lo, hi) -> date:
    return AS_OF + timedelta(days=rng.randint(int(lo * 365), int(hi * 365)))


positions: dict[int, dict] = {}


def position(sk: int, **vals):
    p = add("fct_position", fic_mis_date=AS_OF, n_contract_sk=sk, v_ledger=LEDGER, v_ccy_code=CCY, f_poci="N",
            **vals)
    if p.get("n_carrying_amt") is not None:
        p["n_carrying_amt_rpt"] = p["n_carrying_amt"]
    positions[sk] = p
    return p


instruments: dict[str, int] = {}


def instrument(itype: str, issuer: int, coupon: Decimal | None, maturity: date | None, hqla: str) -> int:
    sk = nxt("instrument")
    add("fsi_d_instrument", n_instrument_sk=sk, v_isin=f"ZZ{sk:010d}", v_instrument_name=f"Synthetic {itype} {sk}",
        v_instrument_type=itype, n_issuer_party_sk=issuer, v_ccy_code=CCY, n_coupon_rate=coupon,
        v_coupon_type="FIXED" if coupon else None, v_coupon_freq="SEMI" if coupon else None,
        d_issue=date(2021, 1, 15), d_maturity=maturity, v_seniority="SENIOR", f_listed="Y", v_hqla_level=hqla)
    price = Decimal("100") if itype == "EQUITY" else q(Decimal(rng.uniform(94, 104)))
    add("fct_market_price", fic_mis_date=AS_OF, n_instrument_sk=sk, n_price=price, v_price_source="SYN_VENDOR",
        v_fv_level="1" if itype in ("GOVT_BOND", "EQUITY") else "2")
    return sk


credit_contracts: list[tuple[int, str, str, Decimal]] = []   # sk, product, stage, carrying (for ECL)

for ent, acct, bl, prod, stage, amt in backed:
    cls, fam, treat, rate = PINFO[prod]
    if fam == "DERIVATIVE":
        continue   # built in the next pass
    n = max(1, round(COUNTS[prod] * STAGE_SHARE[stage]))
    for part in split(abs(amt), n):
        if fam in ("LOAN", "MORTGAGE", "LEASE", "OVERDRAFT", "CARD"):
            mat = None if fam in ("CARD", "OVERDRAFT") else years_ahead(1, 25 if fam == "MORTGAGE" else 7)
            c = contract(prod, ent, bl, days_ago(200, 3000), mat)
            sk = c["n_contract_sk"]
            accrued = q(part * rate / 24)
            dpd = {"1": 0, "2": rng.randint(31, 89), "3": rng.randint(91, 400)}[stage]
            position(sk, n_principal_bal=part - accrued, n_accrued_interest=accrued, n_carrying_amt=part,
                     n_days_past_due=dpd, n_ifrs9_stage=int(stage), v_measure_class="AC")
            credit_contracts.append((sk, prod, stage, part))
            if fam == "CARD":
                add("fsi_d_card_contract", n_contract_sk=sk, v_card_type="CREDIT", v_network="SYNPAY",
                    n_credit_limit=q(part * Decimal("1.6")), n_purchase_apr=rate, n_cash_apr=rate + Decimal("0.03"),
                    n_min_payment_pct=Decimal("0.03"), n_statement_day=rng.randint(1, 28),
                    n_annual_fee=Decimal("120"), v_rewards_program="POINTS", n_rewards_liab_amt=q(part * Decimal("0.004")))
                positions[sk]["n_undrawn_amt"] = q(part * Decimal("0.6"))
            else:
                ltype = {"MORTGAGE": "MORTGAGE", "LEASE": "LEASE", "OVERDRAFT": "OVERDRAFT"}.get(fam, "CORPORATE")
                orig = q(part * Decimal(rng.uniform(1.05, 1.4)))
                add("fsi_d_loan_contract", n_contract_sk=sk, v_loan_type=ltype, n_original_amt=orig,
                    n_term_months=None if fam == "OVERDRAFT" else rng.choice([36, 60, 84, 300]),
                    v_rate_type="FIXED" if fam in ("MORTGAGE", "LEASE") else "FLOATING", n_interest_rate=rate,
                    v_rate_index=None if fam in ("MORTGAGE", "LEASE") else "SOFR",
                    n_spread=None if fam in ("MORTGAGE", "LEASE") else rate - Decimal("0.043"),
                    v_repay_type={"MORTGAGE": "ANNUITY", "LEASE": "ANNUITY", "OVERDRAFT": "INTEREST_ONLY"}.get(
                        fam, "LINEAR"), v_payment_freq="MONTHLY", d_first_payment=date(2024, 1, 1),
                    n_ltv_origination=q(Decimal(rng.uniform(55, 80))) / 100 if fam == "MORTGAGE" else None,
                    v_purpose={"MORTGAGE": "HOME_PURCHASE", "LEASE": "EQUIPMENT"}.get(fam, "WORKING_CAPITAL"),
                    f_secured="Y" if fam in ("MORTGAGE", "LEASE") or rng.random() < 0.5 else "N",
                    f_syndicated="Y" if prod == "COMM_LOAN" and rng.random() < 0.15 else "N",
                    n_origination_fee=q(orig * Decimal("0.005")))
                if fam in ("MORTGAGE", "LOAN") and (fam == "MORTGAGE" or rng.random() < 0.5):
                    csk = nxt("collateral")
                    ctype = "RESIDENTIAL_RE" if fam == "MORTGAGE" else "COMMERCIAL_RE"
                    mv = q(part / Decimal(rng.uniform(0.5, 0.8)))
                    add("fsi_d_collateral", n_collateral_sk=csk, v_collateral_id=f"COL{csk:06d}", v_collateral_type=ctype,
                        n_owner_party_sk=None, v_ccy_code=CCY, n_market_value=mv, d_valuation=date(2026, 3, 31),
                        n_haircut_pct=Decimal("0.2"), n_lien_rank=1, v_country_code="US")
                    add("fsi_d_contract_collateral", n_contract_sk=sk, n_collateral_sk=csk, n_allocated_amt=part,
                        n_allocation_pct=Decimal("1"))
                if stage in ("2", "3") and rng.random() < 0.4:
                    add("fsi_d_contract_modification", n_modification_sk=nxt("modification"), n_contract_sk=sk,
                        d_modification=days_ago(30, 300), v_modification_type="FORBEARANCE", f_substantial="N",
                        n_gain_loss_amt=-q(part * Decimal("0.002")))
        elif fam == "CASA":
            alf = "A" if prod == "NOSTRO" else "L"
            c = contract(prod, ent, bl, days_ago(300, 4000), None, alf=alf)
            sk = c["n_contract_sk"]
            position(sk, n_principal_bal=part, n_accrued_interest=Decimal(0), n_carrying_amt=part,
                     v_measure_class="AC")
            add("fsi_d_casa_contract", n_contract_sk=sk,
                v_account_type={"NOSTRO": "NOSTRO", "CURR_ACCT": "CURRENT", "SAVINGS": "SAVINGS"}[prod],
                n_interest_rate=rate, n_overdraft_limit=None, n_notice_days=0, v_interest_basis="ACT/365",
                v_stability_class=None if alf == "A" else ("STABLE" if bl == "Retail" else "LESS_STABLE"),
                f_insured="Y" if bl == "Retail" else "N")
        elif fam == "TERM_DEPOSIT":
            c = contract(prod, ent, bl, days_ago(30, 700), years_ahead(0.1, 3), alf="L")
            sk = c["n_contract_sk"]
            accrued = q(part * rate / 12)
            position(sk, n_principal_bal=part - accrued, n_accrued_interest=accrued, n_carrying_amt=part,
                     v_measure_class="AC")
            add("fsi_d_term_deposit", n_contract_sk=sk, n_principal_amt=part - accrued, n_interest_rate=rate,
                v_rate_type="FIXED", v_interest_basis="ACT/365", v_interest_pay_freq="MATURITY",
                f_auto_renew=rng.choice("YN"), f_early_withdrawal="N", n_penalty_pct=Decimal("0.01"))
        elif fam == "REPO_SBL":
            alf = "A" if prod == "REV_REPO" else "L"
            c = contract(prod, ent, bl, days_ago(1, 20), AS_OF + timedelta(days=rng.randint(1, 30)), alf=alf)
            sk = c["n_contract_sk"]
            position(sk, n_principal_bal=part, n_accrued_interest=Decimal(0), n_carrying_amt=part,
                     v_measure_class="AC")
            ins = instrument("GOVT_BOND", PARTY_POOL["issuer"][1], Decimal("0.035"), years_ahead(2, 10), "L1")
            add("fsi_d_repo_sbl", n_contract_sk=sk, v_txn_type=prod, n_cash_amt=part, n_repo_rate=rate,
                n_instrument_sk=ins, n_collateral_qty=q(part * Decimal("1.02")), n_haircut_pct=Decimal("0.02"),
                d_start=days_ago(1, 20), d_end=AS_OF + timedelta(days=30), f_open_term="N")
        elif fam == "INVESTMENT":
            c = contract(prod, ent, bl, days_ago(100, 1500), None if prod == "EQUITY_HFT" else years_ahead(1, 10),
                         book="TRADING_BOOK" if prod == "EQUITY_HFT" else
                         ("INSURANCE" if ent == "002" else "BANKING_BOOK"))
            sk = c["n_contract_sk"]
            itype = "EQUITY" if prod == "EQUITY_HFT" else rng.choice(["GOVT_BOND", "CORP_BOND", "COVERED_BOND"])
            ins = instrument(itype, pick("issuer"), None if itype == "EQUITY" else rate,
                             None if itype == "EQUITY" else years_ahead(1, 10),
                             "L1" if itype == "GOVT_BOND" else ("L2A" if itype == "COVERED_BOND" else "NONE"))
            cat = {"BOND_FVOCI": "FVOCI", "BOND_AC": "AC", "EQUITY_HFT": "HFT"}[prod]
            position(sk, n_principal_bal=part, n_carrying_amt=part,
                     n_fair_value=part if cat != "AC" else q(part * Decimal("0.985")),
                     v_measure_class={"FVOCI": "FVOCI", "AC": "AC", "HFT": "FVTPL"}[cat])
            add("fsi_d_investment_holding", n_contract_sk=sk, n_instrument_sk=ins, v_ifrs9_category=cat,
                v_portfolio="INS_GENERAL" if ent == "002" else ("TRADING" if cat == "HFT" else "LIQUIDITY"),
                n_face_amt=None if cat == "HFT" else part, n_units=q(part / 100) if cat == "HFT" else None,
                n_purchase_price=Decimal("100"), d_trade=days_ago(100, 1500), d_settlement=days_ago(98, 1498),
                n_eir=rate or None)
        elif fam == "BORROWING":
            c = contract(prod, ent, bl, days_ago(100, 2000), years_ahead(0.5, 10), alf="L")
            sk = c["n_contract_sk"]
            accrued = q(part * rate / 4)
            position(sk, n_principal_bal=part - accrued, n_accrued_interest=accrued, n_carrying_amt=part,
                     v_measure_class="AC")
            add("fsi_d_borrowing", n_contract_sk=sk,
                v_borrowing_type={"INTERBANK": "INTERBANK", "ISSUED_BOND": "ISSUED_BOND", "SUB_DEBT": "SUB_DEBT"}[prod],
                n_principal_amt=part - accrued, n_interest_rate=rate, v_rate_type="FIXED",
                v_isin=None if prod == "INTERBANK" else f"ZY{sk:010d}", f_callable="Y" if prod == "SUB_DEBT" else "N",
                d_first_call=date(2029, 9, 30) if prod == "SUB_DEBT" else None,
                v_capital_tier="T2" if prod == "SUB_DEBT" else "NONE")
        gl_add(ent, acct, bl, prod, stage, None, part if amt > 0 else -part)

# Derivatives: separate pass because each contract's fair value can land in either account.
deriv_fv: dict[str, tuple[Decimal, Decimal]] = {}
for ent, acct, bl, prod, stage, amt in backed:
    if PINFO[prod][1] == "DERIVATIVE":
        pos, neg = deriv_fv.get(prod, (Decimal(0), Decimal(0)))
        deriv_fv[prod] = (pos + amt, neg) if amt > 0 else (pos, neg + amt)
for prod, (pos_total, neg_total) in deriv_fv.items():
    n = COUNTS[prod]
    for sign, total in ((1, pos_total), (-1, neg_total)):
        for part in split(abs(total), n // 2):
            fv = part * sign
            c = contract(prod, "001", "Treasury", days_ago(30, 1500), years_ahead(0.2, 10), alf="A" if fv > 0 else "L",
                         book="TRADING_BOOK")
            sk = c["n_contract_sk"]
            notional = q(abs(fv) * Decimal(rng.randint(15, 40)))
            position(sk, n_fair_value=fv, v_measure_class="FVTPL")
            dtype = {"IRS": "IRS", "FX_FWD": "FX_FWD", "CDS": "CDS"}[prod]
            add("fsi_d_derivative", n_contract_sk=sk, v_deriv_type=dtype,
                v_asset_class={"IRS": "IR", "FX_FWD": "FX", "CDS": "CR"}[prod], n_notional_amt=notional,
                v_notional_ccy=CCY, d_trade=days_ago(30, 1500), d_effective=days_ago(28, 1498),
                v_cleared="CCP" if prod == "IRS" else "OTC", n_ccp_party_sk=ccp if prod == "IRS" else None,
                v_hedge_designation="FAIR_VALUE" if prod == "IRS" and rng.random() < 0.3 else "NONE")
            legs = {"IRS": [("P", "FIXED", CCY), ("R", "FLOAT", CCY)], "FX_FWD": [("P", "FX", "EUR"), ("R", "FX", CCY)],
                    "CDS": [("P", "PREMIUM", CCY), ("R", "PROTECTION", CCY)]}[prod]
            for i, (pr, lt, lccy) in enumerate(legs, 1):
                add("fsi_d_derivative_leg", n_contract_sk=sk, n_leg_no=i, v_pay_receive=pr, v_leg_type=lt,
                    v_ccy_code=lccy, n_notional_amt=notional, n_fixed_rate=Decimal("0.039") if lt == "FIXED" else None,
                    v_rate_index="SOFR" if lt == "FLOAT" else None, v_pay_freq="QUARTERLY", v_day_count="ACT/360")
            gl_add("001", "12400" if fv > 0 else "23100", "Treasury", prod, "NA", None, fv)

# Off-balance: facilities and trade finance (no GL balance; memo exposure only)
loans_for_draw = [c["sk"] for c in contracts if c["prod"] == "COMM_LOAN"]
for i in range(10):
    c = contract("REVOLVER", "001", "Commercial", days_ago(100, 1500), years_ahead(1, 5), alf="O")
    sk = c["n_contract_sk"]
    commit = q(Decimal(rng.uniform(20, 150)) * M)
    position(sk, n_carrying_amt=Decimal(0), n_undrawn_amt=commit, v_measure_class="AC")
    add("fsi_d_facility", n_contract_sk=sk, v_facility_type="REVOLVER", n_committed_amt=commit,
        f_unconditionally_cancellable="N", n_ccf=Decimal("0.4"), d_review=date(2027, 3, 31),
        n_commitment_fee=Decimal("0.0035"))
    add("fsi_d_contract_link", n_parent_contract_sk=sk, n_child_contract_sk=loans_for_draw[i],
        v_link_type="FACILITY_DRAW")
for i in range(10):
    prod = "LC" if i % 2 else "GUARANTEE"
    c = contract(prod, "001", "Commercial", days_ago(10, 300), years_ahead(0.2, 2), alf="O")
    sk = c["n_contract_sk"]
    face = q(Decimal(rng.uniform(2, 40)) * M)
    position(sk, n_carrying_amt=Decimal(0), n_undrawn_amt=face, v_measure_class="AC")
    add("fsi_d_trade_finance", n_contract_sk=sk, v_instrument_type="LC" if prod == "LC" else "GUARANTEE",
        v_direction="ISSUED", n_face_amt=face, n_beneficiary_party_sk=pick("corporate"), d_expiry=years_ahead(0.2, 2),
        v_guarantee_type=None if prod == "LC" else rng.choice(["PERFORMANCE", "FINANCIAL", "BID"]),
        n_ccf=Decimal("0.2") if prod == "LC" else Decimal("0.5"), n_commission_rate=Decimal("0.0125"))

# Hedge links: fair value hedges of issued bonds
hedges = [c for c in rows["fsi_d_derivative"] if c["v_hedge_designation"] == "FAIR_VALUE"]
bonds = [c["sk"] for c in contracts if c["prod"] == "ISSUED_BOND"]
for h, b in zip(hedges, bonds):
    add("fsi_d_contract_link", n_parent_contract_sk=h["n_contract_sk"], n_child_contract_sk=b, v_link_type="HEDGE")

# ECL and allowance: raw ECL from PD x LGD x EAD, scaled so the total equals the SYNBANK allowance
LGD = {"RES_MTG": 0.15, "COMM_LOAN": 0.40, "EQUIP_LEASE": 0.35, "BUS_OD": 0.55, "CREDIT_CARD": 0.65}
PD = {"1": 0.015, "2": 0.12, "3": 1.0}
raw = [Decimal(PD[s] * LGD[p]) * ead for _, p, s, ead in credit_contracts]
ecl = split_by(allowance_total, raw)
for (sk, prod, stage, ead), e in zip(credit_contracts, ecl):
    positions[sk]["n_impairment_allow"] = e
    pd12 = Decimal(str(PD[stage] if stage != "2" else 0.05))
    pdl = Decimal(str(PD[stage]))
    lgd = (e / (pdl * ead)).quantize(Decimal("0.00000001"))
    assert lgd <= 1, (prod, stage, lgd)
    add("fct_expected_loss", fic_mis_date=AS_OF, n_contract_sk=sk, v_scenario="WEIGHTED", n_ifrs9_stage=int(stage),
        n_pd_12m=pd12, n_pd_lifetime=pdl, n_lgd=lgd, n_ead=ead, n_ecl_12m=q(e * pd12 / pdl) if stage != "1" else e,
        n_ecl_lifetime=e if stage != "1" else q(e * Decimal("3.2")), n_ecl_booked=e, f_sicr="Y" if stage != "1" else "N",
        f_credit_impaired="Y" if stage == "3" else "N")
    c = next(x for x in contracts if x["sk"] == sk)
    gl_add("001", "13900", c["bl"], prod, stage, None, -e)

# Parties on bank contracts
for c in contracts:
    kind = BOOK_PARTY.get(c["prod"])
    if kind:
        add("fsi_d_contract_party", n_contract_sk=c["sk"], n_party_sk=pick(kind),
            v_role=ROLE.get(kind, "COUNTERPARTY") if c["alf"] != "L" or kind == "bank" else "DEPOSITOR",
            n_share_pct=Decimal("1"), d_eff_start=EFF)
        if c["prod"] == "COMM_LOAN" and rng.random() < 0.3:
            add("fsi_d_contract_party", n_contract_sk=c["sk"], n_party_sk=pick("corporate"), v_role="GUARANTOR",
                n_share_pct=Decimal("1"), d_eff_start=EFF)

# --------------------------------------------------------------------------------------------------------------
# Insurance: groups, policies, coverages, claims, reinsurance
# --------------------------------------------------------------------------------------------------------------
INS_COUNTS = {"TERM_LIFE": 25, "UNIV_LIFE": 15, "ANNUITY": 15, "GRP_HEALTH": 12, "MOTOR": 25, "PROPERTY": 12,
              "REINS_ASSUMED": 4}
LIC_SHARE = {"TERM_LIFE": "0.08", "UNIV_LIFE": "0.04", "ANNUITY": "0.03", "GRP_HEALTH": "0.45", "MOTOR": "0.55",
             "PROPERTY": "0.50", "REINS_ASSUMED": "0.35"}
LOB = {"LIFE": "LIFE", "ANNUITY": "ANNUITY", "HEALTH": "HEALTH", "PNC": "PNC", "REINS_ASSUMED": "REINS"}
groups: dict[tuple[str, int], int] = {}
group_policies: dict[int, list[int]] = {}
policy_info: dict[int, dict] = {}


def ins_group(prod: str, year: int, direction: str) -> int:
    sk = nxt("group")
    model = PINFO[prod][2].replace("IFRS17_", "")
    bucket = "ONEROUS" if (prod == "MOTOR" and year == 2026) else "OTHER"
    add("fsi_d_ins_group", n_group_sk=sk, v_group_id=f"G-{prod}-{year}", v_portfolio=prod, n_cohort_year=year,
        v_profit_bucket=bucket, v_measurement_model=model, v_direction=direction, n_org_sk=ENTITY["002"],
        n_product_sk=PROD[prod], v_ccy_code=CCY)
    groups[(prod, year)] = sk
    group_policies[sk] = []
    return sk


object_sk = 0
for prod, n in INS_COUNTS.items():
    fam = PINFO[prod][1]
    for year in (2025, 2026):
        ins_group(prod, year, "ISSUED")
    for i in range(n):
        year = 2025 if i % 2 == 0 else 2026
        gsk = groups[(prod, year)]
        incep = date(year, rng.randint(1, 9 if year == 2026 else 12), rng.randint(1, 28))
        expiry = (incep + timedelta(days=365)) if fam in ("PNC", "HEALTH", "REINS_ASSUMED") else \
            incep + timedelta(days=365 * rng.choice([10, 20, 30]))
        c = contract(prod, "002", "Insurance", incep, expiry, alf="L", book="INSURANCE")
        sk = c["n_contract_sk"]
        sum_ins = q(Decimal(rng.uniform(0.2, 2.0)) * M) if fam != "REINS_ASSUMED" else q(Decimal(rng.uniform(5, 20)) * M)
        if fam == "PNC" and prod == "PROPERTY":
            sum_ins *= 5
        prem_rate = {"LIFE": "0.004", "ANNUITY": "0.06", "HEALTH": "0.05", "PNC": "0.03", "REINS_ASSUMED": "0.02"}[fam]
        prem = q(sum_ins * Decimal(prem_rate)) if fam != "ANNUITY" else q(sum_ins * Decimal("0.06"))
        add("fsi_d_ins_policy", n_contract_sk=sk, v_line_of_business=LOB[fam], v_policy_status="IN_FORCE",
            d_inception=incep, d_expiry=expiry, d_issue=incep, v_premium_freq="ANNUAL" if fam != "ANNUITY" else "SINGLE",
            n_premium_amt=prem, n_sum_insured=sum_ins, n_underwriting_year=year,
            v_distribution="BROKER" if fam in ("PNC", "REINS_ASSUMED") else rng.choice(["AGENT", "BANCASSURANCE", "DIRECT"]),
            n_broker_party_sk=pick("broker") if fam in ("PNC", "REINS_ASSUMED") else None,
            f_participating="Y" if prod == "UNIV_LIFE" else "N", n_group_sk=gsk,
            v_underwriting_class=rng.choice(["STANDARD", "PREFERRED", "RATED"]),
            d_next_renewal=(incep + timedelta(days=365)) if fam in ("PNC", "HEALTH") else None)
        holder_kind = "corporate" if prod in ("GRP_HEALTH", "PROPERTY") else ("reinsurer" if fam == "REINS_ASSUMED" else "retail")
        add("fsi_d_contract_party", n_contract_sk=sk, n_party_sk=pick(holder_kind),
            v_role="CEDANT" if fam == "REINS_ASSUMED" else "POLICYHOLDER", n_share_pct=Decimal("1"), d_eff_start=EFF)
        if fam in ("LIFE", "ANNUITY"):
            add("fsi_d_contract_party", n_contract_sk=sk, n_party_sk=pick("retail"), v_role="BENEFICIARY",
                n_share_pct=Decimal("1"), d_eff_start=EFF)
        covs = {"LIFE": ["DEATH", "RIDER_TPD"], "ANNUITY": ["ANNUITY_PAYOUT"], "HEALTH": ["HOSPITAL", "DENTAL"],
                "PNC": ["COLLISION", "THEFT"] if prod == "MOTOR" else ["FIRE", "LIABILITY"],
                "REINS_ASSUMED": ["QUOTA_SHARE"]}[fam]
        cov_sks = []
        for j, cv in enumerate(covs):
            csk = nxt("coverage")
            cov_sks.append(csk)
            add("fsi_d_ins_coverage", n_coverage_sk=csk, n_contract_sk=sk, v_coverage_code=cv,
                f_rider="Y" if cv.startswith("RIDER") else "N", n_sum_insured=sum_ins if j == 0 else q(sum_ins / 2),
                n_deductible=Decimal("1000") if fam == "PNC" else None, n_limit_amt=sum_ins,
                n_coverage_premium=q(prem * (Decimal("0.8") if j == 0 else Decimal("0.2")) if len(covs) > 1 else prem),
                d_start=incep, d_end=expiry)
        if fam == "LIFE":
            add("fsi_d_ins_life", n_contract_sk=sk, v_plan_type="TERM" if prod == "TERM_LIFE" else "UNIVERSAL",
                n_policy_term_yrs=(expiry.year - incep.year), n_premium_term_yrs=(expiry.year - incep.year),
                n_guaranteed_rate=Decimal("0.02") if prod == "UNIV_LIFE" else None, v_mortality_table="SYN-2020",
                v_smoker_status=rng.choice(["NS", "S"]), v_fund_code="SYNBAL" if prod == "UNIV_LIFE" else None,
                f_with_profits="Y" if prod == "UNIV_LIFE" else "N")
        elif fam == "ANNUITY":
            add("fsi_d_ins_annuity", n_contract_sk=sk, v_annuity_type="DEFERRED", v_payout_phase="ACCUMULATION",
                n_annual_payout=q(sum_ins * Decimal("0.055")), n_guaranteed_period_yrs=10, v_payout_basis="LIFE",
                n_gmdb_amt=sum_ins, n_gmwb_amt=q(sum_ins * Decimal("0.05")), d_annuitisation=date(2040, 1, 1))
        elif fam == "HEALTH":
            add("fsi_d_ins_health", n_contract_sk=sk, v_plan_type="GROUP", v_network_type="PPO",
                n_annual_limit=sum_ins, n_copay_pct=Decimal("0.2"), n_waiting_days=30,
                n_members_covered=rng.randint(20, 400), f_renewable="Y")
        elif fam == "PNC":
            object_sk += 1
            add("fsi_d_ins_insured_object", n_object_sk=object_sk, v_object_type="VEHICLE" if prod == "MOTOR" else "BUILDING",
                v_object_ref=f"OBJ{object_sk:06d}", n_insured_value=sum_ins, v_ccy_code=CCY, v_country_code="US",
                v_location_risk_zone=rng.choice(["LOW", "MEDIUM", "FLOOD_ZONE_A"]), n_year_built=rng.randint(1970, 2025))
            add("fsi_d_ins_pnc", n_contract_sk=sk, v_pnc_class=prod, n_object_sk=object_sk, n_policy_limit=sum_ins,
                n_deductible=Decimal("1000"), n_expected_loss_ratio=Decimal("0.68"),
                f_cat_exposed="Y" if prod == "PROPERTY" and rng.random() < 0.4 else "N",
                n_no_claims_bonus_pct=Decimal("0.2") if prod == "MOTOR" else None)
        group_policies[gsk].append(sk)
        policy_info[sk] = {"prod": prod, "fam": fam, "prem": prem, "sum": sum_ins, "covs": cov_sks, "group": gsk,
                           "incep": incep}

# Reinsurance held: treaties, cessions and two REINS_HELD groups
treaties = []
for i, (ttype, share, lines) in enumerate([("QUOTA_SHARE", "0.30", ["TERM_LIFE", "UNIV_LIFE"]),
                                            ("SURPLUS", "0.20", ["GRP_HEALTH"]),
                                            ("XOL", None, ["PROPERTY", "MOTOR"])], 1):
    tsk = nxt("treaty")
    add("fsi_d_ins_reins_treaty", n_treaty_sk=tsk, v_treaty_id=f"T-2026-{i:02d}", v_direction="CEDED",
        v_treaty_type=ttype, n_reinsurer_party_sk=PARTY_POOL["reinsurer"][i - 1],
        n_share_pct=Decimal(share) if share else None, n_retention_amt=None if share else Decimal(5) * M,
        n_limit_amt=Decimal(50) * M, d_inception=date(2026, 1, 1), d_expiry=date(2026, 12, 31), v_ccy_code=CCY)
    treaties.append((tsk, share, lines))
ceded: dict[int, Decimal] = {}
for tsk, share, lines in treaties:
    for psk, info in policy_info.items():
        if info["prod"] in lines and (share or info["prod"] == "PROPERTY"):
            pct = Decimal(share) if share else Decimal("0.5")
            ceded[psk] = pct
            add("fsi_d_ins_reins_cession", n_treaty_sk=tsk, n_contract_sk=psk, n_ceded_share_pct=pct,
                n_ceded_sum_insured=q(info["sum"] * pct))
for year in (2025, 2026):
    ins_group("REINS_HELD", year, "REINS_HELD")

# Claims: generated per policy, then scaled so LIC per product hits its target share of the liability
claims: list[dict] = []
claimed_products: set[str] = set()
for psk, info in policy_info.items():
    p_claim = {"LIFE": 0.15, "ANNUITY": 0.1, "HEALTH": 0.9, "PNC": 0.6, "REINS_ASSUMED": 0.75}[info["fam"]]
    first = info["prod"] not in claimed_products   # every product gets at least one claim
    if first or rng.random() < p_claim:
        claimed_products.add(info["prod"])
        clsk = nxt("claim")
        loss = info["incep"] + timedelta(days=rng.randint(10, 250))
        loss = min(loss, AS_OF - timedelta(days=5))
        cat = info["prod"] == "PROPERTY" and rng.random() < 0.3
        add("fsi_d_ins_claim", n_claim_sk=clsk, v_claim_id=f"C{clsk:06d}", n_contract_sk=psk, n_coverage_sk=info["covs"][0],
            d_loss=loss, d_reported=loss + timedelta(days=3), d_closed=None, v_claim_status="OPEN",
            v_cause_code={"LIFE": "DEATH", "ANNUITY": "SURRENDER", "HEALTH": "HOSPITAL", "PNC": "COLLISION" if info["prod"] == "MOTOR" else "FIRE",
                          "REINS_ASSUMED": "CEDED_LOSS"}[info["fam"]],
            n_claimant_party_sk=pick("retail"), f_catastrophe="Y" if cat else "N",
            v_cat_event_code="CAT-2026-HAIL-01" if cat else None)
        claims.append({"sk": clsk, "policy": psk, "prod": info["prod"], "w": Decimal(rng.uniform(0.2, 1.0)),
                       "loss": loss})

prod_lic = {p: q(INS_LIAB[p] * Decimal(s)) for p, s in LIC_SHARE.items()}
group_lic: dict[int, Decimal] = {g: Decimal(0) for g in group_policies}
rih_lic_raw = Decimal(0)
for prod, lic in prod_lic.items():
    cl = [c for c in claims if c["prod"] == prod]
    assert cl, f"no claims generated for {prod}"
    reserves = split_by(lic, [c["w"] for c in cl])
    for c, reserve in zip(cl, reserves):
        case = q(reserve * Decimal("0.7"))
        ibnr = reserve - case
        paid = q(reserve * Decimal(rng.uniform(0.1, 0.8)))
        rec = q(reserve * ceded.get(c["policy"], Decimal(0)))
        rih_lic_raw += rec
        add("fct_ins_claim_financial", fic_mis_date=AS_OF, n_claim_sk=c["sk"], v_ccy_code=CCY,
            n_paid_indemnity=paid, n_paid_expense=q(paid * Decimal("0.05")), n_case_reserve=case, n_ibnr_alloc=ibnr,
            n_recovery_salvage=Decimal(0), n_reins_recoverable=rec)
        group_lic[policy_info[c["policy"]]["group"]] += reserve
        c.update(paid=paid)

# IFRS 17 measurement per group; LRC + LIC per product equals the GL liability
for prod in INS_COUNTS:
    gsks = [groups[(prod, y)] for y in (2025, 2026)]
    lrc_parts = split_by(INS_LIAB[prod] - sum(group_lic[g] for g in gsks), [Decimal(60), Decimal(40)])
    liab = [group_lic[g] + part for g, part in zip(gsks, lrc_parts)]
    rev = split_by(INS_REV[prod], [Decimal(55), Decimal(45)])
    ise = split_by(INS_ISE[prod], [Decimal(55), Decimal(45)])
    fin = split_by(INS_FIN.get(prod, Decimal(0)), [Decimal(60), Decimal(40)]) if prod in INS_FIN else [None, None]
    model = PINFO[prod][2].replace("IFRS17_", "")
    for gsk, total, r_, e_, f_ in zip(gsks, liab, rev, ise, fin):
        lic = group_lic[gsk]
        lrc = total - lic
        assert lrc > 0, (prod, gsk)
        onerous = (prod == "MOTOR" and gsk == groups[("MOTOR", 2026)])
        if model == "PAA":
            bel = ra = csm = None
            loss_comp = q(lrc * Decimal("0.05")) if onerous else Decimal(0)
        else:
            bel, ra = q(lrc * Decimal("0.78")), q(lrc * Decimal("0.05"))
            csm, loss_comp = lrc - bel - ra, Decimal(0)
        add("fct_ifrs17_measurement", fic_mis_date=AS_OF, n_group_sk=gsk, v_ccy_code=CCY, n_bel=bel,
            n_risk_adjustment=ra, n_csm=csm, n_loss_component=loss_comp, n_lrc=lrc, n_lic=lic,
            n_insurance_revenue=r_, n_insurance_service_expense=e_, n_finance_income_expense=f_,
            n_csm_release=q(csm * Decimal("0.08")) if csm else None,
            n_discount_rate=Decimal("0.0425") if model != "PAA" else None)
    gl_add("002", "24100", "Insurance", prod, "NA", None, -INS_LIAB[prod])
# Reinsurance held groups: LIC equals the recoverables on ceded claims; LRC is the rest of the asset
rih_liab = split_by(RIH_TOTAL, [Decimal(60), Decimal(40)])
rih_lic = split_by(rih_lic_raw, [Decimal(60), Decimal(40)])
rih_exp = split_by(Decimal(15) * M, [Decimal(60), Decimal(40)])
for year, total, lic, ex in zip((2025, 2026), rih_liab, rih_lic, rih_exp):
    lrc = total - lic
    assert lrc > 0
    bel, ra = q(lrc * Decimal("0.85")), q(lrc * Decimal("0.04"))
    add("fct_ifrs17_measurement", fic_mis_date=AS_OF, n_group_sk=groups[("REINS_HELD", year)], v_ccy_code=CCY,
        n_bel=bel, n_risk_adjustment=ra, n_csm=lrc - bel - ra, n_loss_component=Decimal(0), n_lrc=lrc, n_lic=lic,
        n_insurance_revenue=None, n_insurance_service_expense=ex, n_finance_income_expense=None,
        n_csm_release=q((lrc - bel - ra) * Decimal("0.08")), n_discount_rate=Decimal("0.0425"))
gl_add("002", "18100", "Insurance", "REINS_HELD", "NA", None, RIH_TOTAL)

# Policy positions and premiums: group LRC allocated to policies by premium
meas = {m["n_group_sk"]: m for m in rows["fct_ifrs17_measurement"]}
for gsk, psks in group_policies.items():
    if not psks:
        continue
    alloc = split_by(meas[gsk]["n_lrc"], [policy_info[p]["prem"] for p in psks])
    for psk, a in zip(psks, alloc):
        info = policy_info[psk]
        short = info["fam"] in ("PNC", "HEALTH", "REINS_ASSUMED")
        position(psk, n_gross_reserve=a, n_account_value=q(a * Decimal("0.9")) if info["prod"] == "UNIV_LIFE" else None,
                 n_unearned_premium=q(info["prem"] * Decimal("0.25")) if short else None)
        add("fct_ins_premium", fic_mis_date=AS_OF, n_contract_sk=psk, v_ccy_code=CCY, n_written_premium=info["prem"],
            n_earned_premium=q(info["prem"] * Decimal("0.75")) if short else info["prem"],
            n_unearned_premium=q(info["prem"] * Decimal("0.25")) if short else Decimal(0),
            n_ceded_premium=q(info["prem"] * ceded[psk]) if psk in ceded else Decimal(0),
            n_commission=q(info["prem"] * Decimal("0.12")), n_premium_receivable=q(info["prem"] * Decimal("0.05")))

# --------------------------------------------------------------------------------------------------------------
# P&L lines split by product, then GL balances
# --------------------------------------------------------------------------------------------------------------
for ent, acct, bl, prods, amt in pl_pending:
    w = [sum((positions[c["sk"]].get("n_carrying_amt") or 0) * c["rate"] for c in contracts
             if c["prod"] == p and c["bl"] == bl) or Decimal(1) for p in prods]
    for p, part in zip(prods, split_by(amt, w)):
        gl_add(ent, acct, bl, p, "NA", None, part)

for (ent, acct, bl, prod, stage, cc), amt in sorted(gl_lines.items()):
    if amt == 0:
        continue
    add("fct_gl_balance", fic_mis_date=AS_OF, v_ledger=LEDGER, n_gl_account_sk=GL[acct], n_org_sk=ENTITY[ent],
        n_cost_centre_sk=ORG[cc] if cc else -1, n_mgmt_org_sk=ORG[bl] if bl else -1,
        n_product_sk=PROD[prod] if prod else -1, v_credit_stage=stage, n_ic_org_sk=-1, v_ccy_code=CCY,
        n_balance=amt, n_balance_rpt=amt)
GL_COMBOS = {(r["n_gl_account_sk"], r["n_org_sk"], r["n_cost_centre_sk"], r["n_mgmt_org_sk"], r["n_product_sk"],
              r["v_credit_stage"], r["n_ic_org_sk"]) for r in rows["fct_gl_balance"]}

# --------------------------------------------------------------------------------------------------------------
# Events and journals (September), cashflows, market data
# --------------------------------------------------------------------------------------------------------------
ACCRUAL_PL = {"MORTGAGE": "41100", "LOAN": "41100", "LEASE": "41100", "OVERDRAFT": "41100", "CARD": "41100",
              "INVESTMENT": "41200", "CASA": "51100", "TERM_DEPOSIT": "51100", "BORROWING": "51200"}
BS_ACCOUNT = {p: a for p, rl in RULES.items() for bt, a, s in rl if bt == "CARRYING"}


def combo(acct, ent_sk, bl_sk, prod_sk, stage):
    return (GL[acct], ent_sk, -1, bl_sk, prod_sk, stage, -1)


def journal(event_sk, acct, ent_sk, bl_sk, prod_sk, stage, dr: Decimal, cr: Decimal, d: date):
    add("fct_journal", n_journal_sk=nxt("journal"), n_event_sk=event_sk, v_ledger=LEDGER, n_gl_account_sk=GL[acct],
        n_org_sk=ent_sk, n_cost_centre_sk=-1, n_mgmt_org_sk=bl_sk, n_product_sk=prod_sk, v_credit_stage=stage,
        n_ic_org_sk=-1, d_accounting=d, v_ccy_code=CCY, n_debit_amt=dr, n_credit_amt=cr, f_adjustment="N")


def event(csk, etype, amt, d, claim=None) -> int:
    esk = nxt("event")
    add("fct_event", n_event_sk=esk, n_contract_sk=csk, v_event_type=etype, d_effective=d, d_booking=d,
        v_ccy_code=CCY, n_amount=amt, n_claim_sk=claim, v_source_txn_id=f"TXN{esk:08d}")
    return esk


skipped_accruals = 0
for c in contracts:
    fam = PINFO[c["prod"]][1]
    p = positions.get(c["sk"])
    if fam not in ACCRUAL_PL or not p or not c["rate"] or not p.get("n_carrying_amt"):
        continue
    bs, pl = BS_ACCOUNT.get(c["prod"]), ACCRUAL_PL[fam]
    ent_sk, bl_sk, prod_sk = ENTITY[c["ent"]], ORG[c["bl"]], PROD[c["prod"]]
    stage = {1: "1", 2: "2", 3: "3"}.get(p.get("n_ifrs9_stage"), "NA")
    if combo(bs, ent_sk, bl_sk, prod_sk, stage) not in GL_COMBOS or combo(pl, ent_sk, bl_sk, prod_sk, "NA") not in GL_COMBOS:
        skipped_accruals += 1   # no P&L line for this product in the source trial balance
        continue
    amt = q(p["n_carrying_amt"] * c["rate"] / 12)
    esk = event(c["sk"], "ACCRUAL", amt, AS_OF)
    asset = c["alf"] == "A"
    journal(esk, bs, ent_sk, bl_sk, prod_sk, stage, amt if asset else 0, 0 if asset else amt, AS_OF)
    journal(esk, pl, ent_sk, bl_sk, prod_sk, "NA", 0 if asset else amt, amt if asset else 0, AS_OF)

ins_ent, ins_bl = ENTITY["002"], ORG["Insurance"]
for psk, info in policy_info.items():
    amt = q(info["prem"] / (12 if info["fam"] != "ANNUITY" else 1))
    esk = event(psk, "PREMIUM_DUE", amt, date(2026, 9, 1))
    journal(esk, "11100", ins_ent, ins_bl, -1, "NA", amt, 0, date(2026, 9, 1))
    journal(esk, "24100", ins_ent, ins_bl, PROD[info["prod"]], "NA", 0, amt, date(2026, 9, 1))
for c in claims:
    amt = q(c["paid"] / 3)
    esk = event(c["policy"], "CLAIM_PAID", amt, date(2026, 9, 20), claim=c["sk"])
    journal(esk, "24100", ins_ent, ins_bl, PROD[c["prod"]], "NA", amt, 0, date(2026, 9, 20))
    journal(esk, "11100", ins_ent, ins_bl, -1, "NA", 0, amt, date(2026, 9, 20))

for c in contracts:
    fam = PINFO[c["prod"]][1]
    p = positions.get(c["sk"])
    if fam in ("MORTGAGE", "LOAN", "LEASE", "TERM_DEPOSIT", "BORROWING") and p and p.get("n_carrying_amt"):
        sign = 1 if c["alf"] == "A" else -1
        for k in range(1, 4):
            d = date(2026 + (9 + k - 1) // 12, (9 + k - 1) % 12 + 1, 28)
            add("fct_cashflow", fic_mis_date=AS_OF, n_contract_sk=c["sk"], d_cashflow=d, v_flow_type="INTEREST",
                v_basis="CONTRACTUAL", v_ccy_code=CCY, n_amount=sign * q(p["n_carrying_amt"] * c["rate"] / 12))
            add("fct_cashflow", fic_mis_date=AS_OF, n_contract_sk=c["sk"], d_cashflow=d, v_flow_type="PRINCIPAL",
                v_basis="CONTRACTUAL", v_ccy_code=CCY, n_amount=sign * q(p["n_carrying_amt"] / 120))
for psk, info in policy_info.items():
    for k, d in enumerate([date(2026, 12, 31), date(2027, 3, 31)]):
        add("fct_cashflow", fic_mis_date=AS_OF, n_contract_sk=psk, d_cashflow=d, v_flow_type="PREMIUM",
            v_basis="EXPECTED", v_ccy_code=CCY, n_amount=q(info["prem"] / 4))
        add("fct_cashflow", fic_mis_date=AS_OF, n_contract_sk=psk, d_cashflow=d, v_flow_type="CLAIM",
            v_basis="EXPECTED", v_ccy_code=CCY, n_amount=-q(info["prem"] / 4 * Decimal("0.68")))

for frm, closing, avg in [("CAD", "0.7350", "0.7310"), ("EUR", "1.0820", "1.0790"), ("GBP", "1.2710", "1.2650")]:
    add("fct_fx_rate", fic_mis_date=AS_OF, v_from_ccy=frm, v_to_ccy="USD", v_rate_type="CLOSING", n_rate=Decimal(closing))
    add("fct_fx_rate", fic_mis_date=AS_OF, v_from_ccy=frm, v_to_ccy="USD", v_rate_type="AVERAGE", n_rate=Decimal(avg))
for curve, base in [("SOFR", 0.0430), ("USD_GOVT", 0.0405), ("INS_DISCOUNT_ILLIQ", 0.0455), ("FTP_BASE", 0.0440)]:
    for i, tenor in enumerate([30, 90, 180, 365, 730, 1825, 3650, 10950]):
        add("fct_rate_curve", fic_mis_date=AS_OF, v_curve_id=curve, n_tenor_days=tenor,
            n_rate=Decimal(str(round(base + 0.0006 * i - 0.0002 * (i > 4), 8))))

# Code lists
for cs, codes in {"CONTRACT_STATUS": ["ACTIVE", "CLOSED", "WRITTEN_OFF", "LAPSED", "MATURED", "CANCELLED"],
                  "PARTY_ROLE": ["BORROWER", "DEPOSITOR", "COUNTERPARTY", "ISSUER", "GUARANTOR", "POLICYHOLDER",
                                 "BENEFICIARY", "CEDANT"],
                  "CLAIM_STATUS": ["OPEN", "CLOSED", "REOPENED", "DENIED", "LITIGATED"]}.items():
    for c in codes:
        add("dim_code", v_code_set=cs, v_code=c, v_description=c.replace("_", " ").title(), f_active="Y")


# --------------------------------------------------------------------------------------------------------------
# Write
# --------------------------------------------------------------------------------------------------------------
def lit(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, date):
        return f"DATE '{v.isoformat()}'"
    if isinstance(v, (int, Decimal)):
        return str(v)
    if isinstance(v, float):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def main(out_path: Path = OUT) -> None:
    schema = SCHEMA.read_text()
    order = [t.lower() for t in re.findall(r"CREATE TABLE (\w+) \(", schema)]
    unknown = set(rows) - set(order)
    assert not unknown, unknown
    identity = re.findall(r"CREATE TABLE (\w+) \(\s*(\w+)\s+NUMBER\(18\)\s+GENERATED BY DEFAULT AS IDENTITY", schema)
    out = ["-- Synthetic FSDF data generated by make_synthetic.py. Do not edit by hand.",
           f"-- As of {AS_OF}, ledger {LEDGER}, {CCY}. Load after schema.sql; run its Section 9 checks after.",
           "-- Entities: 001 Synthetic Bank (volt-ledger synthetic TB on the target chart), 002 Synthetic Insurance Co.",
           ""]
    counts = []
    for t in order:
        rs = rows.get(t, [])
        if not rs:
            continue
        counts.append(f"--   {t}: {len(rs)}")
        cols = list(dict.fromkeys(k for r in rs for k in r))
        for r in rs:
            out.append(f"INSERT INTO {t} ({', '.join(cols)}) VALUES ({', '.join(lit(r.get(c)) for c in cols)});")
        out.append("")
    out.append("-- Restart identity columns above the loaded keys (Oracle 12c+).")
    for t, col in identity:
        out.append(f"ALTER TABLE {t} MODIFY ({col} GENERATED BY DEFAULT AS IDENTITY (START WITH LIMIT VALUE));")
    out.append("COMMIT;")
    out[3:3] = ["-- Row counts:", *counts, f"-- Accruals skipped (no P&L line in the source TB): {skipped_accruals}", ""]
    out_path.write_text("\n".join(out) + "\n")
    print(f"wrote {out_path} ({sum(len(v) for v in rows.values())} rows, {len(counts)} tables)")


if __name__ == "__main__":
    import sys
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else OUT)
