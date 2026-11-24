# FSDF-derived schema for banking and insurance products

Status: derived design, 2026-11-24. Files in this folder:

| File | What it is |
|---|---|
| [`schema.sql`](schema.sql) | Oracle 19c+ DDL: 51 tables, a staging generator and the Section 9 post-load checks |
| [`synthetic_data.sql`](synthetic_data.sql) | Synthetic data for every product family, tied to the GL (generated, do not edit) |
| [`make_synthetic.py`](make_synthetic.py) | The generator: `python fsdf/make_synthetic.py` from `apps/volt-ledger` |
| `../tests/unit/test_fsdf_synthetic.py` | Loads schema and data into SQLite and runs every Section 9 check |

## What this is and is not

- It is an Oracle (19c+) physical schema: 51 tables plus a staging generator and post-load checks. It covers every
  banking and insurance product family and follows Oracle FSDF conventions.
- It is **not** Oracle's licensed FSDF or OIDF physical model. That model has well over a thousand tables and is
  published as an erwin model to licensees. Where a site runs real OFSAA, use the crosswalk in section 4 to map
  this design onto the licensed tables.
- It has not been compiled against an Oracle instance. Checks run so far:
  - All 69 non-PL/SQL statements parse in the Oracle dialect of `sqlglot` 30.34, which is a lenient parser.
  - The schema and synthetic data load into SQLite with foreign keys enforced, and all seven Section 9 checks return
    no rows (section 7). SQLite proves the data and keys are consistent; it is not an Oracle compile.
  - A structural script confirmed several more things. Every foreign key points to a table created earlier, and to
    columns that exist. Every key and index column exists. Each column's prefix matches its type. No identifier is
    longer than 27 characters, and there are no duplicate constraint names.
  - The file is ASCII only.

## 1. Shape

```text
DIM_ (reference)          FSI_D_ (contracts, parties, instruments)            FCT_ (facts and results)
dim_product  ----------+   fsi_d_party --< fsi_d_contract_party >-- fsi_d_contract (spine, 1 row per contract)
dim_org_unit ----------+                                              |  1:1 subtype per family (section 2)
dim_gl_account --------+                                              +-- fct_position   (contract x date x ledger)
dim_currency/country --+                                              +-- fct_cashflow   (contractual / expected)
                                                                      +-- fct_event --> fct_journal --> fct_gl_balance
                                                                      +-- fct_expected_loss (IFRS 9)
                     fsi_d_ins_group (IFRS 17 portfolio/cohort/profitability) --> fct_ifrs17_measurement
```

Design rules (from the `banking-data-model` skill): one contract spine with products as subtypes, party as one
entity with roles, hierarchies as dimensions rather than keys, every journal carrying its source event, and one row
set serving Finance, Risk and Treasury.

## 2. Product coverage

| Business | Family code | Subtype table(s) | Products covered |
|---|---|---|---|
| Banking | LOAN, MORTGAGE, LEASE, OVERDRAFT | fsi_d_loan_contract | Personal, auto, student, mortgage, SME, corporate, syndicated, lease, overdraft, factoring |
| Banking | CASA | fsi_d_casa_contract | Current, savings, notice, MMDA, nostro, vostro |
| Banking | TERM_DEPOSIT | fsi_d_term_deposit | Term deposit, CD/GIC, structured deposit |
| Banking | CARD | fsi_d_card_contract | Credit, debit, prepaid, charge |
| Banking | FACILITY | fsi_d_facility | Revolver, term facility, credit line, commitment |
| Banking | TRADE_FINANCE | fsi_d_trade_finance | LC, standby LC, guarantee, banker's acceptance, bills |
| Banking | INVESTMENT | fsi_d_investment_holding + fsi_d_instrument | Govt/corp bonds, equity, funds, MBS, ABS, covered bonds, T-bills |
| Banking | DERIVATIVE | fsi_d_derivative + fsi_d_derivative_leg | IRS, CCS, FX forward, futures, options, swaptions, CDS, TRS |
| Banking | REPO_SBL | fsi_d_repo_sbl | Repo, reverse repo, securities lending and borrowing |
| Banking | BORROWING | fsi_d_borrowing | Issued and covered bonds, interbank, central bank, sub debt, AT1 |
| Insurance | LIFE | fsi_d_ins_policy + fsi_d_ins_life | Term, whole life, endowment, universal, unit-linked |
| Insurance | ANNUITY | fsi_d_ins_policy + fsi_d_ins_annuity | Immediate, deferred, fixed, variable, indexed (GMDB/GMWB) |
| Insurance | HEALTH | fsi_d_ins_policy + fsi_d_ins_health | Individual/group health, critical illness, disability, dental |
| Insurance | PNC | fsi_d_ins_policy + fsi_d_ins_pnc (+ insured object) | Motor, property, liability, marine, engineering, cyber, crop |
| Insurance | REINS_ASSUMED | fsi_d_ins_policy | Inward reinsurance written as a policy |
| Insurance | (not a family) | fsi_d_ins_reins_treaty + fsi_d_ins_reins_cession | Reinsurance held: quota share, surplus, XoL, stop loss, facultative |

Shared across both businesses: coverage and riders, claims and claim financials, collateral, cashflows, events,
journals, GL balances, ECL, and IFRS 17 measurement (BEL, RA, CSM, loss component, LRC, LIC) at group level.

## 3. Alignment with the VOLT Ledger chart-of-accounts brain

The schema has been lined up with `apps/volt-ledger` (target chart in `tests/golden/synbank_target_coa.json`,
ontology in `data/ontology/mvg-bank-v1.json`).

| volt-ledger segment | Schema column on `fct_journal` and `fct_gl_balance` | Dimension |
|---|---|---|
| Entity | n_org_sk | dim_org_unit (LEGAL, ENTITY) |
| NaturalAccount | n_gl_account_sk | dim_gl_account |
| CostCentre | n_cost_centre_sk | dim_org_unit (MGMT, COST_CENTRE) |
| BusinessLine | n_mgmt_org_sk | dim_org_unit (MGMT, BUSINESS_LINE) |
| Product | n_product_sk | dim_product |
| CreditStage | v_credit_stage | '1', '2', '3', 'POCI', 'NA' |
| Intercompany | n_ic_org_sk | dim_org_unit (LEGAL) |

- `dim_gl_account.v_concept_id` holds the canonical concept (`canon:<Name>`). Check 9.3 flags any account in use
  without one.
- `dim_gl_map_rule` says which GL account each balance type of each product posts to (carrying amount, ECL
  allowance, positive or negative fair value, IFRS 17 LRC + LIC). It is the brain's mapping output in FSDF form.
  Check 9.5 reconciles contract positions to the GL through it at full segment grain; check 9.6 does the same for
  IFRS 17 groups.
- Each dimension has a `v_segment_code` column for the segment value. The unassigned member is key -1, which
  matches the target chart's segment defaults.
- `fct_gl_balance` is held at the full segment grain. Check 9.4 confirms that every journal combination exists in
  the balances.
- This follows the brain's main redesign rule: product and business line go in dimensions, never in the natural
  account.

**Gap: insurance concepts.** `mvg-bank-v1` holds only banking concepts. Insurance accounts need new canonical ids
before check 9.3 can pass for an insurer. Proposed ids, not yet in the ontology:
`canon:InsuranceContractLiabilities`, `canon:InsuranceContractAssets`, `canon:ReinsuranceContractAssets`,
`canon:ReinsuranceContractLiabilities`, `canon:InsuranceRevenue`, `canon:InsuranceServiceExpense`,
`canon:NetExpenseFromReinsuranceHeld`, `canon:InsuranceFinanceIncomeExpense`, `canon:ContractualServiceMargin`,
`canon:RiskAdjustment`, `canon:InvestmentContractLiabilities`, `canon:SegregatedFundLiabilities`. This belongs to
the CoA brain thread to decide.

## 4. Crosswalk to licensed OFSAA table names

"Checked" means the name appeared verbatim in Oracle documentation pages read on 2026-11-24 (sources below). Every
other name is [UNVERIFIED] and needs checking against the site's erwin model.

| This schema | Nearest OFSAA table(s) | Status |
|---|---|---|
| fsi_d_loan_contract | STG_LOAN_CONTRACTS | Checked |
| fsi_d_casa_contract | STG_CASA | Checked |
| fsi_d_term_deposit | STG_TD_CONTRACTS | Checked |
| fsi_d_borrowing | STG_BORROWINGS | Checked |
| (deposit/borrowing summary) | FCT_DEPOSITS_BORROWINGS | Checked |
| fct_position | FCT_COMMON_ACCOUNT_SUMMARY | [UNVERIFIED], seen only in a summarised page section |
| fsi_d_card_contract | STG_CARDS | [UNVERIFIED] |
| fsi_d_investment_holding, fsi_d_instrument | STG_INVESTMENTS, STG_INSTRUMENT_CONTRACT_MASTER | [UNVERIFIED] |
| fsi_d_derivative (+ legs) | STG_SWAPS_CONTRACTS, STG_SWAP_ACCOUNT_LEG_DTLS, STG_OPTION_CONTRACTS, STG_FUTURES, STG_FX_CONTRACTS, STG_CREDIT_DERIVATIVES | [UNVERIFIED] |
| fsi_d_repo_sbl | STG_REPO_CONTRACTS | [UNVERIFIED] |
| fsi_d_trade_finance | STG_GUARANTEES, STG_LC_CONTRACTS, STG_BILLS_CONTRACTS | [UNVERIFIED] |
| fsi_d_facility | STG_COMMITMENT_CONTRACTS | [UNVERIFIED] |
| fsi_d_party (+ rating, relationship) | STG_PARTY_MASTER, STG_PARTY_RATING_DETAILS, STG_PARTY_PARTY_RELATIONSHIP | [UNVERIFIED] |
| fsi_d_collateral, fsi_d_contract_collateral | STG_MITIGANTS, STG_ACCOUNT_MITIGANT_MAP | [UNVERIFIED] |
| fct_gl_balance | STG_GL_DATA | [UNVERIFIED] |
| fct_fx_rate, fct_rate_curve, fct_market_price | STG_EXCHANGE_RATE_HIST, STG_IRC_RATE_HIST, STG_INSTRUMENT_MARKET_PRICES | [UNVERIFIED] |
| dim_product, dim_org_unit, dim_gl_account, dim_currency, dim_country | DIM_PRODUCT, DIM_ORG_UNIT, DIM_GL_ACCOUNT, DIM_CURRENCY, DIM_COUNTRY | [UNVERIFIED] |
| fsi_d_ins_life | STG_LIFE_INS_CONTRACTS | Checked |
| fsi_d_ins_annuity | STG_ANNUITY_CONTRACTS (also STG_RETIREMENT_ACCOUNTS) | Checked |
| fsi_d_ins_health | STG_HEALTH_INS_CONTRACTS | Checked |
| fsi_d_ins_pnc | STG_PROP_CASUALTY_CONTRACTS | Checked |
| fsi_d_ins_reins_treaty (held) | STG_REINSURANCE_CONTRACTS_HELD | Checked |
| REINS_ASSUMED policies | STG_REINSURANCE_CNTRCTS_ISSUED | Checked |
| fsi_d_ins_coverage | STG_POLICY_COVERAGES, FCT_POLICY_COVERAGES | Checked |
| fsi_d_ins_policy | DIM_POLICY | Checked |
| fsi_d_ins_claim | STG_CLAIM_DETAILS, FCT_CLAIM_DETAILS, DIM_CLAIM | Checked |
| fct_ins_claim_financial | STG_CLAIM_TXNS, FCT_CLAIM_TRANSACTION | Checked |
| fct_event (policy side) | STG_LIFE_INS_POLICY_TXNS, STG_PROP_CASU_POLICY_TXNS, FCT_POLICY_TRANSACTIONS | Checked |
| catastrophe event code | DIM_CATASTROPHE_EVENTS | Checked |
| fsi_d_ins_group, fct_ifrs17_measurement | OFSAA IFRS 17 application tables | [UNVERIFIED], not looked up |
| fct_expected_loss | IFRS 9 / CECL application result tables (the repo skill cites FSI_EXPECTED_LOSS) | [UNVERIFIED] |

Column conventions: Oracle's examples show `FIC_MIS_DATE`, `V_ACCOUNT_NUMBER`, `V_GAAP_CODE`, `N_EOP_BAL` and
`F_LATEST_LOAD_RUN_FLAG`, which supports the n_/v_/f_ prefixes. The `d_` date prefix is [UNVERIFIED].

## 5. Known deviations from OFSAA

1. **Grain.** OFSAA product-processor tables are daily snapshots keyed on `(FIC_MIS_DATE, V_ACCOUNT_NUMBER)`. In
   this schema the contract tables hold current terms, one row per contract, and values that change over time live in
   `fct_position`. Where OFSAA applications must read the data natively, rebuild the snapshot shape with views.
2. **Keys.** This schema uses surrogate keys (`n_*_sk`). OFSAA keys on business identifiers. The generated staging
   tables carry `v_contract_id` and `v_source_system` so the T2T step can look the surrogate up.
3. **Staging names.** Generated staging names (for example `STG_LOAN_CONTRACT`) do not match OFSAA's names (for
   example `STG_LOAN_CONTRACTS`). Use the crosswalk; do not assume the names are the same.

## 6. Open items

- Compile and load-test the DDL on Oracle 19c or 23ai.
- Add the insurance canonical concepts to the volt-ledger ontology (section 3).
- Verify the [UNVERIFIED] crosswalk rows against a licensed FSDF/OIDF erwin model.

## 7. Synthetic data

Two fictional entities, as of 2026-09-30, IFRS ledger, USD:

- **001 Synthetic Bank** is the volt-ledger synthetic bank. Its GL is `data/synthetic/tb_2026-09.csv` moved onto
  the target chart in `tests/golden/synbank_target_coa.json`, so totals by target account match the TB exactly
  (tested). Contract-backed lines are split by product (for example commercial loans into term loans, leases and
  overdrafts), and the generated contracts add up to those lines exactly.
- **002 Synthetic Insurance Co** is a small insurer added so the insurance families have a GL to tie to. It uses the
  proposed insurance concepts from section 3.

What ties, and which check proves it:

| Tie | Check |
|---|---|
| Every contract has its product subtype row | 9.1 |
| Journals balance per event | 9.2 |
| Every GL account in use has a canonical concept | 9.3 |
| Every journal segment combination exists in the GL | 9.4 |
| Contract positions equal GL balances by account, entity, business line, product and credit stage | 9.5 |
| IFRS 17 LRC + LIC per product equals the insurance and reinsurance contract balances in the GL | 9.6 |
| Each entity's trial balance nets to zero | 9.7 |
| ECL booked equals the position allowance; LIC equals claim reserves per group | pytest only |

One difference from the TB is intended. The TB holds the loan loss allowance (165m) on one line with no stage or
business line, which is one of the seeded gaps. The FSDF data rebuilds it from contract-level ECL, so the target
design carries it by business line, product and stage, with the same total.

Each synthetic contract stands for a pool of similar accounts, so amounts per contract are large. Accrual journals
are only generated where the TB has a matching P&L line, so 29 contracts (for example commercial current accounts)
have no September accrual.

## Sources

- [OIDF 8.1.2 Insurance Contracts Tables](https://docs.oracle.com/cd/E92918_01/PDF/8.1.x.x/8.1.2.0.0/OIDF_HTML/812/UG/19_Insurance_Contracts_Tables.htm)
- [OIDF 8.1.1 Insurance Claims Tables](https://docs.oracle.com/cd/E92918_01/PDF/8.1.x.x/8.1.1.0.0/OIDF_HTML/811/UG/30Insurance_Claims_Tables.htm)
- [OIDF 8.1 Transactions and Accounting Tables](https://docs.oracle.com/cd/E92918_01/PDF/8.1.x.x/8.1.0.0.0/OIDF_HTML/81/UG/29Transactions_and_Accounting_Tables.htm)
- [FSDF 8.1.2.5 Deposit Borrowings Summary Population](https://docs.oracle.com/en/industries/financial-services/ofs-analytical-applications/financial-services-data-foundation/81250/fsdf_ug/22.2overview-deposit-borrowings-summary-population.html)
- [FSDF 8.1.2.5 Complete Snapshot Load Example](https://docs.oracle.com/en/industries/financial-services/ofs-analytical-applications/financial-services-data-foundation/81250/fsdf_ug/15.4.1complete-snapshot-load-example.html)
