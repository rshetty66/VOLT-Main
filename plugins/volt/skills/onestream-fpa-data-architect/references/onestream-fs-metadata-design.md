# OneStream Metadata Design for Financial Services

Tags: `[V]` cross-checked, `[C]` confirm on version, `[D]` design recommendation, `[I]` illustrative. Platform
background is in [onestream-platform.md](onestream-platform.md).

## 1. Method: outputs first

1. List the 10 to 15 outputs that justify the application: board pack, segment P&L, NIM and efficiency ratio,
   capital and liquidity ratios, headcount and cost by cost centre, product profitability, IFRS 17 results, regulatory
   inputs. For each: audience, frequency, grain, currency, basis (IFRS, management), comparatives.
2. Derive the dimensions needed to produce each output. A dimension that no output needs is removed.
3. For each dimension decide: **dimension, member, attribute or separate cube**.

| Choose | When |
|---|---|
| Dimension | Users slice, filter, secure or load by it and it is needed at the intersection |
| Member in an existing dimension | A small, stable set of values |
| Attribute (text property) | Used to group or filter but never loaded or secured separately `[C]` |
| Separate cube | Different grain, different periodicity or different workflow; ties to others at agreed aggregation points |

4. Estimate data units and records (section 11) before the dimension plan is approved.
5. Write the conventions page: sign, units, rate basis, currencies, fiscal calendar, naming.

## 2. Entity dimension

The central conflict: **legal entities** (needed for consolidation, statutory reporting, ownership, intercompany) versus
**management units** (cost centres, departments, business lines, needed for planning, accountability and allocation).

| Option | Structure | Strengths | Weaknesses | Use when |
|---|---|---|---|---|
| A. Entity = legal entity; management units in UDs | Few entities (tens), cost centre and segment as UD dimensions | Small data unit count, clean consolidation, strong ownership logic | Workflow and security by cost centre need channels and slice security; UD cardinality grows records per unit | Consolidation cube; planning where owners are few |
| B. Entity = management unit; legal entity as a UD or attribute | Many entities (hundreds to thousands), hierarchy mirrors cost centres | Workflow, security and locking by owner are natural | Data unit count explodes; legal consolidation needs a mapping or an alternate hierarchy | Workforce and expense planning with many owners, modest periods and scenarios |
| C. Separate cubes | Consolidation cube with legal entities; planning cube with management entities; tied at agreed aggregation points through extensibility or data management | Each cube fits its job | Two entity hierarchies to govern; tie-out controls needed | Large banks and insurers (default recommendation `[D]`) |

Rules `[D]`:

- Count the data units for option B before choosing it: entities x periods x scenarios.
- Keep a mapping table cost centre -> legal entity as governed data, effective-dated.
- Entities carry currency, consolidation properties and text attributes (region, regulator, entity type, ledger
  basis). Do not encode attributes in member names.
- Alternate hierarchies serve regional, regulatory and management views; keep the primary hierarchy the consolidation
  path.
- Funds, SPVs and structured entities need an explicit consolidation method and an owner for judgement
  (IFRS 10 control assessment) `[R]`.

## 3. Account dimension

Separate three concerns and map between them; do not collapse them into one tree `[D]`:

| Tree | Purpose | Owner |
|---|---|---|
| Ledger accounts | What the ERP and subledgers post | Controllership |
| Reporting accounts | IFRS or GAAP statement lines and disclosure | Financial reporting |
| Management accounts | Planning drivers, KPIs, statistics, allocated lines | FP&A |

In OneStream one Account dimension usually carries reporting and management accounts, with the ledger-to-reporting
mapping done at load through transformation rules. Keep ledger-account detail out of the cube unless a report needs it.

### 3.1 Skeleton for a bank `[I]`

```text
Net income
  Total revenue
    Net interest income
      Interest income
        Loans (by product class through UD)
        Securities
        Deposits with banks
      Interest expense
        Deposits
        Wholesale funding
        Subordinated debt
      FTP charge and credit (management view only)
    Non-interest revenue
      Fees and commissions (cards, payments, wealth, lending fees)
      Trading and markets revenue
      Securities gains and other
  Provision for credit losses
    Stage 1, Stage 2, Stage 3 (charge)
  Non-interest expense
    Personnel (salary, variable, benefits, payroll taxes)
    Occupancy and equipment
    Technology and communications
    Professional fees
    Marketing
    Amortisation and depreciation
    Other
    Allocated expense in and out (management view only)
  Income tax
Balance sheet
  Cash and central bank, securities, loans (gross), ECL allowance, other assets
  Deposits, wholesale funding, other liabilities, equity
Statistics (NonFinancial or Balance types)
  Average daily balance, FTE, RWA, HQLA, net cash outflows, AUM
Drivers
  Yield, cost of funds, FTP rate, PD, LGD, coverage ratio, fee rate, merit increase
```

### 3.2 Rules `[D]`

- One account, one meaning. If two reports need different groupings, use hierarchy alternates, not duplicate accounts.
- Statistics and drivers get their own branch with clear account types; do not mix with financial accounts.
- Ratios and rates are dynamic calculations over stored numerators and denominators.
- Reserve a block of account codes for allocated lines so pre- and post-allocation views are both reportable.
- Document the sign rule per branch and test it in the sign-convention check (see the checklists reference).

## 4. Flow dimension: roll-forwards

Use Flow to hold movements so that opening plus movements equals closing and every movement is reportable `[D]`.

| Roll-forward | Flow members |
|---|---|
| Loan balance | Opening, New originations, Repayments, Prepayments, Write-offs, FX, Transfers, Other, Closing |
| ECL allowance | Opening, New originations, Derecognition, Stage transfers (1 to 2, 2 to 3, and back), Remeasurement, Write-offs, Recoveries, FX, Closing |
| AUM | Opening, Gross sales, Redemptions, Market movement, FX, Acquisitions and disposals, Closing |
| IFRS 17 CSM | Opening, New business, Interest accretion, Changes relating to future service, Release to P&L, FX, Closing |
| Regulatory capital | Opening, Net income, Dividends, Buybacks, OCI, Deductions, Other, Closing |
| Equity and cash flow | Per the statement of changes in equity and the cash flow statement |

Decide how the opening balance is derived (prior-period closing carried by rule or by flow processing `[C]`) and
test that it never drifts from the prior closing.

## 5. User-defined dimensions by institution type

Eight are available; use the fewest that outputs require, keep at least one spare `[D]`.

| UD | Bank `[I]` | Insurer `[I]` | Asset manager `[I]` | Payments or lender `[I]` |
|---|---|---|---|---|
| 1 | Product (class -> product -> sub-product) | Line of business | Strategy or fund family | Product |
| 2 | Segment (retail, commercial, wealth, markets, corporate centre) | Portfolio and IFRS 17 group (cohort, profitability group) | Asset class | Merchant or customer segment |
| 3 | Geography | Measurement model (GMM, PAA, VFA) | Client type | Geography or corridor |
| 4 | Cost centre (if not an Entity) | Channel | Distribution channel | Payment method |
| 5 | Original currency | Reinsurance (gross, ceded, net) | Share class or fee type | Original currency |
| 6 | Stage or risk rating, or tenor bucket | Underwriting year | Mandate type | Cohort or vintage |
| 7 | Project or initiative | Project or initiative | Project or initiative | Project or initiative |
| 8 | Reserved | Reserved | Reserved | Reserved |

Guardrails:

- Each dimension multiplies potential intersections. Use the sizing worksheet in section 11.
- Keep a dimension only if it is loaded, planned, secured or reported at its own level. If it is only a report
  filter, make it a text attribute on an existing member `[D]`.
- Hierarchies stay at five levels or fewer unless an output requires more.
- Never change a UD's meaning between cubes without a documented mapping.

## 6. Scenario, time and view

### 6.1 Scenarios `[D]`

| Pattern | Description | Trade-off |
|---|---|---|
| Fixed set | Actual, Budget, Forecast, Stress_Base, Stress_Down, Stress_Severe, Prior_Year | Few data units; snapshots needed for history |
| Per cycle | A new scenario for each forecast cycle | Full history but data units multiply every cycle |
| Rolling plus snapshots (recommended) | One live Forecast scenario; at lock, copy to an archive scenario (for example Fcst_Snap_YYYYMM) via data management | Prior-forecast variance available; controlled growth; prune after the retention window |

Scenario properties (type, input frequency, workflow time, number of input periods) are configured per scenario `[C]`.
Distinguish scenario types so plan-style scenarios can use planning dimension variants `[C]`.

### 6.2 Time

- Define the fiscal calendar explicitly (Canadian banks commonly close on 31 October `[I]`).
- Extend Time to cover the forecast horizon plus one year of buffer.
- Decide weekly or daily granularity only for a use case that needs it (for example liquidity forecasting).

### 6.3 View

Store plan inputs in the view that matches how users think: flows periodic, balances as period-end `[D]`. Document
the conversion for display so YTD and periodic reports tie. Test with a three-period scenario that includes a quarter
boundary.

## 7. Currency and FX

| Topic | Design |
|---|---|
| Currencies | Functional per entity, reporting currency for the group, optional presentation currencies |
| Rate types | Average for income and expense, closing for assets and liabilities, historical for equity `[C]`; additional rate types for constant-currency analysis |
| Rate source | Treasury or market data feed; one authoritative load with an owner and a cut-off time |
| Plan rates | Budget rates held separately from actual rates; a dedicated constant-currency scenario or recalculation isolates FX variance |
| CTA | Decide the plug account and who reviews the movement |
| Original currency | Capture the instrument's currency in a UD only if exposure reporting needs it |
| Hedge accounting | Net investment hedges and cash flow hedge reserves need explicit accounts, flows and ownership |
| Hyperinflation | IAS 29 entities need a policy and a separate treatment `[R]` |

## 8. Multi-basis (IFRS, US GAAP, local GAAP, regulatory, management)

| Option | Description | Strengths | Weaknesses |
|---|---|---|---|
| Journals into AdjInput | One base ledger, basis differences posted as journals under Origin AdjInput with a workflow | Few dimensions, auditable | Volume of adjustments; one primary basis |
| Scenario per basis | Actual_IFRS, Actual_Local | Clean separation, simple security | Scenarios multiply; comparatives per basis |
| Basis in a UD | UD holds the ledger basis | Both bases at same intersection; flexible reporting | Records double; every rule must be basis-aware |
| Separate cubes | One cube per basis | Isolation | Reconciliation across cubes; duplicated metadata |

Default `[D]`: journals into AdjInput for small differences; a basis UD only where both bases are needed at full detail
across most entities; document the reconciliation between bases as a standing control.

## 9. Naming standards `[D]`

| Item | Standard |
|---|---|
| Member name | Stable code, no spaces, no business meaning that can change; description carries the label |
| Prefixes | Short prefix by type for non-member objects (rules, cube views, dashboards, sequences): domain_type_purpose |
| Dimensions | Singular noun; no abbreviations clients cannot read |
| Parents | Suffix `_Total` or `_Group` only if reports depend on it |
| Rules | Domain, function, version in the header; no personal names |
| Retired members | Marked inactive and renamed with a retirement tag; never deleted while history exists |
| Attributes | Documented in a data dictionary: property, meaning, allowed values, owner |

Text properties on members carry attributes (mapping flags, report groups, regulator codes) `[C]`; the count and
length limits vary by version, so record them in the data dictionary.

## 10. Hierarchy governance `[D]`

| Control | Standard |
|---|---|
| System of record | Name one per hierarchy (ERP, MDM or EDM tool, finance-owned file) and state what is mastered in OneStream |
| Change process | Request, impact analysis (data units and reports affected), approval, effective date, deployment, verification |
| Cadence | Monthly metadata release aligned to the close calendar; emergency path with retrospective review |
| Effective dating | New parents effective from a period; restatement policy decided (as reported vs restated) |
| Orphans and duplicates | Automated checks on every load of metadata: orphan members, cycles, duplicate codes, members with two primary parents |
| Retirement | Retire, do not delete |
| Evidence | Change log with requester, approver, date, reason; reconciled to the source hierarchy |

Restatement design: choose before go-live whether history is restated on reorganisation (reload history to the new
hierarchy), preserved (alternate hierarchies), or both (as reported and as restated scenarios). State the cost and the
reporting consequence of each.

## 11. Sizing worksheet

Estimate before approving the dimension plan; adjust with measured benchmarks from the client's environment `[D]`.

| Step | Formula | Example `[I]` |
|---|---|---|
| Data units | entities x periods x scenarios (x cubes) | 50 x 36 x 3 = 5,400 |
| Potential intersections per data unit | accounts x flows x origins used x IC used x UD members used | 200 x 5 x 30 x 6 = 180,000 |
| Density | share of potential intersections that carry data (typical 1 to 10 percent; measure) | 5 percent |
| Records per data unit | potential x density | 9,000 |
| Total records | records per unit x data units | 48.6 million |
| Largest data unit | the unit consolidation or calculation must finish in the close window | Measure by test |

Use the platform's data unit statistics tooling `[C]` after the first load to replace estimates with measurements.
Set a performance budget from the largest data unit and the peak window: for example "full consolidation of the group
completes in X minutes with Y concurrent users". Do not borrow another client's thresholds.

Levers when the estimate is too high: remove a UD, convert a UD to an attribute, move detail to a separate cube,
reduce scenarios through snapshots and pruning, plan at a coarser product level, load fewer periods.

## 12. Illustrative design summary `[I]`

A mid-tier bank with 30 legal entities, 4 business segments and 800 cost centres.

| Cube | Entities | Dimensions of note | Scenarios | Purpose |
|---|---|---|---|---|
| Consol | 30 legal entities and intermediate parents | UD1 product class, UD2 segment, UD3 geography, IC | Actual, Prior_Year | Consolidation, close, statutory and management reporting |
| Plan | 800 cost centres, mapped to legal entities | UD1 product, UD2 segment, UD6 stage, FTE and driver accounts | Budget, Forecast, Fcst_Snap, three stress scenarios | Driver-based planning, forecast, stress |
| Workforce | Cost centres | Position and grade as UD, comp accounts | Budget, Forecast | Headcount and compensation planning with restricted access |

Tie-outs `[D]`: Plan Actual comparatives reconcile to Consol at agreed aggregation points; Workforce results reconcile
to Plan personnel expense; a standing report shows the three reconciliations each cycle.
