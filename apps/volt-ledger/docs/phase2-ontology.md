# VOLT Ledger Brain: Phase 2 ontology spec

> Superseded on 24 Nov 2026 by [`cfo-finance-brain-plan.md`](cfo-finance-brain-plan.md). Kept as history: the engine
> rules it defines still apply where the code cites it.

Status: draft for approval. Date: 24 Nov 2026. Builds on `spec.md` sections 3.1 and 3.2 and on
`ratio-catalogue.md`.

The minimum viable graph for v1 is about 60 canonical concepts, 4 dimensions and their members, plus the client's
own accounts. It covers one bank's balance sheet, income statement and the inputs to the v1 ratios, and nothing
more. Every other concept is added only when an uploaded statement needs it.

## 1. The model in one picture

```
 client account                canonical concept                  GAAP presentation
 (element_type=account)        (element_type=concept)             (presentation arcs)

 4100 "Card fees" ---mapping---> canon:FeeAndCommissionIncome ---presentation[ifrs]----> IFRS income statement line
 4110 "Account fees" -mapping--/        |                    \---presentation[us-gaap]-> US GAAP noninterest income line
                                         | calculation (+1)
                                         v
                                 canon:NonInterestIncome ---calculation(+1)--> canon:TotalOperatingIncome
                                         ^
                                         | gap_of
                                 gap:MixedFeeRecognition  (policy_gap, needs a person's decision)
```

Four kinds of edge do all the work:

| Association type | From | To | Meaning |
|---|---|---|---|
| `mapping` | client account | canonical concept | This account's balance belongs to this concept. Exactly one active mapping per account |
| `calculation` | concept | parent concept | The child adds (+1) or subtracts (-1) into the parent. Used to build subtotals and check them |
| `presentation` | concept | statement line (concept) | How the concept is shown under one GAAP, with order. One concept can have different arcs per GAAP |
| `reconciliation_path` | concept under GAAP A | same concept under GAAP B | The two GAAP amounts differ for a known reason; the difference is carried by GAAP adjustment journals |
| `gap_of` | policy gap | account or concept | This account cannot be mapped or presented without a policy decision |
| `cites` | concept or gap | standard paragraph | The standard the concept or gap relates to |

## 2. Elements

### 2.1 Canonical concepts

A canonical concept is the economic idea, independent of GAAP. Its id is `canon:<Name>`. It carries the XBRL names
used for it in each taxonomy as traits, so the same economic event always lands on the same node.

```json
{
  "@context": {"canon": "https://volt.local/canon#", "ifrs-full": "https://xbrl.ifrs.org/taxonomy/ifrs-full#",
               "us-gaap": "http://fasb.org/us-gaap#"},
  "@id": "canon:FeeAndCommissionIncome",
  "element_type": "concept",
  "label": "Fee and commission income",
  "balance_type": "credit",
  "period_type": "duration",
  "traits": {
    "monetary": true,
    "xbrl": {
      "ifrs": "ifrs-full:FeeAndCommissionIncome",
      "us-gaap": "us-gaap:FeesAndCommissions"
    },
    "xbrl_verified": false
  },
  "provenance": {"source": "volt-ledger minimum viable graph v1", "added_by": "loader"}
}
```

`xbrl_verified` is false until the loader has checked the name against the official taxonomy package for that year.
Until then every XBRL name in this document is [UNVERIFIED]; the loader's first job (Phase 6 step 2) is to check
them and report any that do not exist.

### 2.2 Client accounts

Each trial-balance account becomes an `account` element, with its provenance pointing at the uploaded row:

```json
{
  "@id": "acct:CLIENT01:4100",
  "element_type": "account",
  "label": "Card fees",
  "balance_type": "credit",
  "traits": {"client_code": "4100"},
  "provenance": {"source": "client_tb", "doc_id": "D0001", "row": 87}
}
```

### 2.3 Dimensions and members

| Dimension (axis) | XBRL anchor [UNVERIFIED] | v1 members |
|---|---|---|
| `dim:BusinessLine` | `ifrs-full:SegmentsAxis`, `us-gaap:StatementBusinessSegmentsAxis` | Retail banking, Commercial banking, Wealth, Treasury, Corporate centre |
| `dim:CreditStage` | `ifrs-full:FinancialInstrumentsCreditImpairedAxis` style stage axis (exact name to be checked) | Stage 1, Stage 2, Stage 3, POCI |
| `dim:Product` | none standard; `traits.no_standard_term = true` | Mortgages, Cards, Personal loans, Commercial loans, Current accounts, Savings, Term deposits |
| `dim:CostCentre` | none standard | Client cost centres as uploaded |

Dimensions sit on journal lines and TB rows, not in account codes. That is the single biggest chart-of-accounts
redesign recommendation the brain will usually make: move product and business line out of the natural account.

### 2.4 Policy gap nodes

A policy gap is an element with `element_type = policy_gap`. It is created by `flag_policy_gap`, always goes to the
review queue, and links to the accounts or concepts it affects (`gap_of`) and to the standard it relates to
(`cites`).

```json
{
  "@id": "gap:CLIENT01:MixedFeeRecognition",
  "element_type": "policy_gap",
  "label": "Fees integral to the effective interest rate are booked with service fees",
  "traits": {
    "gap_type": "recognition_basis_mixed",
    "decision_needed": "Split account 4100 into EIR-integral fees (amortised in interest income) and service fees (recognised under IFRS 15 / ASC 606)",
    "blocks": ["presentation:ifrs", "presentation:us-gaap", "ratio:nim", "ratio:fee_income_share"]
  },
  "provenance": {"source": "model_proposal", "evidence_id": "E000214"}
}
```

## 3. One economic event, two GAAPs

The master prompt's example is revenue from a customer contract. For a bank the clearest case is **fee and
commission income from services** (card interchange, account fees, advisory fees). These are in scope of IFRS 15
and ASC 606, while fees that are part of a loan's yield are not: they belong in interest income under IFRS 9 and
the US GAAP loan-fee guidance (ASC 310-20). [UNVERIFIED: paragraph-level references below]

| | IFRS | US GAAP |
|---|---|---|
| Canonical concept | `canon:FeeAndCommissionIncome` | same node |
| Recognition standard | IFRS 15 (paras 31-38 on satisfying performance obligations) [UNVERIFIED] | ASC 606-10-25 [UNVERIFIED] |
| Exclusion to watch | Fees integral to the effective interest rate: IFRS 9 B5.4.1-B5.4.3 [UNVERIFIED] | ASC 310-20 [UNVERIFIED] |
| Presentation line | "Fee and commission income", usually shown gross with "Fee and commission expense", then "Net fee and commission income" | Within "Noninterest income", often broken into service charges, card fees, wealth fees |
| XBRL name | `ifrs-full:FeeAndCommissionIncome` [UNVERIFIED] | `us-gaap:FeesAndCommissions` or `us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax` [UNVERIFIED] |
| Amount | Same | Same (no measurement difference in the v1 data) |

As data, that is one concept and two presentation arcs:

```json
[
  {"association_type": "presentation", "from_element": "canon:FeeAndCommissionIncome",
   "to_element": "stmt:IFRS:IS:FeeAndCommissionIncome", "gaap": "ifrs", "order": 30},
  {"association_type": "presentation", "from_element": "canon:FeeAndCommissionIncome",
   "to_element": "stmt:USGAAP:IS:NoninterestIncome", "gaap": "us-gaap", "order": 10},
  {"association_type": "cites", "from_element": "canon:FeeAndCommissionIncome",
   "to_element": "std:IFRS15:31", "gaap": "ifrs"},
  {"association_type": "cites", "from_element": "canon:FeeAndCommissionIncome",
   "to_element": "std:ASC606-10-25", "gaap": "us-gaap"}
]
```

### When the amounts differ: reconciliation paths

Sometimes the same event has a different amount under each GAAP. For a bank the big one is the credit loss
allowance: IFRS 9 expected credit losses (12-month for stage 1, lifetime for stages 2 and 3) against US GAAP CECL
(lifetime for all loans) [UNVERIFIED]. The brain does **not** create two concepts. It keeps one concept,
`canon:CreditLossAllowance`, and:

1. The base ledger holds the client's primary-GAAP amount (IFRS in v1, A1).
2. The difference to US GAAP is a **GAAP adjustment journal** in the proposal ledger, tagged `gaap = us-gaap`.
   The difference amount must come from a client input (the US GAAP allowance), never from the model.
3. A `reconciliation_path` arc links the IFRS and US GAAP views of the concept and names the adjustment journals.
   So "why is US GAAP allowance higher?" is answered by following the arc to journals and their evidence.

v1 reconciliation paths: credit loss allowance (ECL vs CECL), leases (IFRS 16 single model vs ASC 842 operating
lease expense on one line) and capitalised software (IAS 38 vs ASC 350-40). Only credit loss allowance has demo
data; the other two exist as arcs so the gap report can show them.

## 4. The minimum viable graph for v1

About 60 concepts. Groupings and examples; the loader file lists them all.

| Area | Concepts (canonical ids, abbreviated) | Count |
|---|---|---|
| Assets | CashAndCentralBankBalances, DueFromBanks, InvestmentSecuritiesFVOCI, InvestmentSecuritiesAmortisedCost, TradingAssets, DerivativeAssets, LoansGross, CreditLossAllowance, LoansNet, PropertyAndEquipment, RightOfUseAssets, Goodwill, IntangibleAssets, DeferredTaxAssets, OtherAssets, TotalAssets | 16 |
| Liabilities | DueToBanks, CustomerDeposits (with Current, Savings, Term), DebtSecuritiesIssued, SubordinatedDebt, DerivativeLiabilities, LeaseLiabilities, CurrentTaxLiabilities, Provisions, OtherLiabilities, TotalLiabilities | 13 |
| Equity | ShareCapital, RetainedEarnings, OtherComprehensiveIncomeReserve, NonControllingInterests, TotalEquity | 5 |
| Income | InterestIncome, InterestExpense, NetInterestIncome, FeeAndCommissionIncome, FeeAndCommissionExpense, NetFeeIncome, TradingIncome, OtherOperatingIncome, NonInterestIncome, TotalOperatingIncome | 10 |
| Expense and profit | StaffCosts, ITCosts, PremisesCosts, DepreciationAndAmortisation, OtherOperatingExpenses, OperatingExpenses, PreProvisionOperatingProfit, CreditLossExpense, ProfitBeforeTax, IncomeTaxExpense, ProfitAfterTax, ProfitAttributableToShareholders | 12 |
| Ratio-only inputs | WriteOffs, Recoveries, DividendsDeclared, InterestEarningAssets, InterestBearingLiabilities | 5 |

Calculation arcs make every subtotal checkable: for example `NetInterestIncome = InterestIncome - InterestExpense`,
and `TotalAssets` = the sum of the asset concepts. The tie-out tool uses these arcs, so a missing or wrong mapping
shows up as a subtotal that does not tie.

Each ratio in `ratio-catalogue.md` is written over these concept ids, so every v1 ratio has a path back to TB rows.

## 5. Where a client chart of accounts usually cannot be mapped without a policy decision

These are the gap types the brain looks for. The synthetic chart (A2) is seeded with one of each, so the demo
proves the brain finds them.

| Gap type | Typical symptom in a bank chart | Why it is a policy decision | Standard [UNVERIFIED] |
|---|---|---|---|
| `recognition_basis_mixed` | One "loan fees" or "fees" account holds both origination fees and service fees | Origination fees integral to yield go to interest income over the loan's life; service fees go to fee income | IFRS 9 B5.4; IFRS 15; ASC 310-20; ASC 606 |
| `stage_not_captured` | One allowance account, no stage split | Stage 1, 2 and 3 disclosures and the NPL and coverage ratios need it | IFRS 9 5.5; IFRS 7 35H-35M |
| `catch_all_account` | "Other operating income" or "suspense" holds material balances | Cannot map to one concept; contents must be analysed and reclassified | IAS 1 presentation; materiality |
| `dimension_in_account` | Product or business line encoded in the account number (for example 4100-RETAIL, 4100-COMM) | Business-line reporting needs a dimension; the chart needs redesign, not a mapping | Management reporting choice; IFRS 8 segments |
| `lease_model_difference` | Rent expense account still used alongside right-of-use assets | IFRS 16 has one lessee model; US GAAP operating leases show a single lease cost | IFRS 16; ASC 842 |
| `capitalisation_policy` | Software development costs all expensed, or all capitalised | Capitalisation criteria differ and are a policy choice with GAAP differences | IAS 38; ASC 350-40 |
| `gross_vs_net` | Fee expense netted inside fee income | IFRS presentation usually shows gross and net; netting may need a principal or agent judgement | IFRS 15 B34-B38; ASC 606-10-55-36 |
| `unmappable_sign` | An account's balance has the opposite sign to its likely concept (for example a credit balance in an expense account) | Either a misposting or a contra account; a person decides | Data quality |

Every gap is flagged, not fixed: the brain proposes the split, reclass or redesign as a proposed journal or a
chart-of-accounts recommendation, and a person decides.

## 6. How mapping proposals become facts

1. `ingest_trial_balance` creates an `account` element per TB account.
2. The model reads the account name, code, balance sign and nearby accounts, calls `get_ontology_context`, and
   proposes one concept with a confidence and a rationale through `map_line_item_to_element`.
3. Mappings below 0.90 confidence, and all mappings in the first client run, go to the review queue (A9).
4. If no concept fits, or the account needs a policy decision, the model calls `flag_policy_gap` instead.
5. `tie_out` checks the mapped statements against the uploaded statements; any difference sends the affected
   mappings back to review.
6. When a person approves, the mapping is final for this engagement. A later change is a new mapping that
   supersedes it; the old one stays in history.

## 7. Reuse of the existing COA designer

`apps/volt-coa` already checks a chart for unique codes, type by code range, parent existence, cycles, parent
type and naming, and checks a legacy-to-new mapping for coverage, duplicates and posting targets. The ontology
uses the same ideas, ported to Python in the loader's validation (section 8), so both tools agree. The COA
designer stays the place where a person edits a proposed target chart; volt-ledger diagnoses and maps.

## 8. Validation checklist (Phase 2 acceptance)

- [ ] Every line item in the uploaded statements maps to at least one concept, or is listed as unmapped with a
      reason.
- [ ] Every TB account has exactly one active mapping, or a linked policy gap. Nothing is silently dropped.
- [ ] Unmapped items and policy gaps are flagged explicitly and appear in the review queue.
- [ ] Every concept with an XBRL equivalent carries its `ifrs-full` and `us-gaap` names, and the loader has checked
      each name against the taxonomy package (`xbrl_verified = true`), or the name is reported as missing.
- [ ] No two canonical concepts represent the same economic event (checked by a uniqueness rule on XBRL names per
      GAAP, and reviewed by a person for the v1 set).
- [ ] Every calculation arc set balances on the synthetic data: each subtotal equals the signed sum of its children
      to the cent.
- [ ] Every presentation arc is tagged with a GAAP, and each GAAP's statement shows every mapped concept exactly
      once.
- [ ] Every reconciliation path names the adjustment journals that carry the difference; no difference amount
      comes from the model.
- [ ] Each seeded gap type in section 5 is found on the synthetic chart.
- [ ] Every ratio in the v1 tier of `ratio-catalogue.md` resolves to concepts in this graph.
- [ ] Every standard reference is either backed by a `standard_paragraph` element or marked [UNVERIFIED].

## 9. Assumptions added in this phase

| Id | Assumption | Validate by |
|---|---|---|
| A12 | Business line, credit stage, product and cost centre are carried as dimensions on TB rows and journal lines, not in account codes | Phase 3 |
| A13 | The base ledger is in the client's primary GAAP (IFRS); other GAAP views are produced by GAAP adjustment journals | Phase 3 |
| A14 | The loader checks XBRL names against the IFRS and US GAAP taxonomy packages for the reporting year, downloaded once and stored with the app (both are published free of charge) [UNVERIFIED: licence terms for redistribution] | Phase 6 step 2 |
| A15 | The synthetic chart has about 120 accounts, seeded with one example of each gap type in section 5 | Phase 6 step 1 |
