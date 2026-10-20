# Oracle ERP Cloud GL — Pension Fund COA Design (Large Multi-Asset Fund)

Complete Chart of Accounts design for a large Canadian defined benefit pension fund operating on Oracle ERP Cloud GL. Worked examples use the fictional **Relecloud Pension Plan (RPP)**; replace entity names and values with the fund's own.

---

## 7-Segment COA Structure

```
[Fund/Plan]-[Account]-[Asset Class]-[Investment Pool]-[Geography]-[Member Class]-[Intercompany]
```

| # | Segment | Qualifier | Width | Values | Purpose |
|---|---------|-----------|-------|--------|---------|
| 1 | Fund/Plan | Balancing | 3 | 001-099 | Identifies the pension plan entity |
| 2 | Account | Natural Account | 4 | 1000-9999 | Standard GL account (asset, liability, income, expense) |
| 3 | Asset Class | — | 3 | PEQ, PRI, REA, CRD, FIX, ABS, CSH, N/A | Investment type classification |
| 4 | Investment Pool | — | 6 | ACTIVE, FACTOR, LIABHG, ILLIQD, RESERV, N/A | Strategy/portfolio grouping |
| 5 | Geography | — | 3 | NAM, EUR, APAC, EMG, GLB, N/A | Investment region |
| 6 | Member Class | — | 3 | ACT, DEF, PEN, SUR, ALL | Beneficiary category |
| 7 | Intercompany | Intercompany | 3 | 000, 001-099 | IC between fund entities |

---

## Segment 1: Fund/Plan (Balancing Segment)

| Value | Description | Use |
|-------|-------------|-----|
| 001 | RPP Main Fund | Main fund - core plan contributions |
| 002 | RPP Supplementary Plan | Supplementary / enhanced benefit tier |
| 003 | Fund Management Operations | Fund's operating (management) entity |
| 010 | Subsidiary - Private Equity LP | PE investment vehicle |
| 011 | Subsidiary - Infrastructure LP | Infrastructure vehicle |
| 012 | Subsidiary - Real Estate LP | Real estate vehicle |
| 099 | Elimination Entity | IC elimination entries |

---

## Segment 2: Account (Natural Account)

### Account Hierarchy

```
1000-1999: PLAN ASSETS (Investments)
  1000-1099: Cash & Cash Equivalents
    1000  Cash on Hand (Operating)
    1010  Cash - Custodian Account (CAD)
    1020  Cash - Custodian Account (USD)
    1030  Cash - Custodian Account (EUR)
    1040  Cash - Custodian Account (GBP)
    1050  Cash - Margin Deposits
    1060  Cash - Collateral Posted
    1080  Short-Term Deposits (<90 days)
    1090  Money Market Instruments

  1100-1199: Fixed Income
    1100  Government Bonds - Federal (Canada)
    1110  Government Bonds - Provincial
    1120  Government Bonds - Foreign Sovereign
    1130  Corporate Bonds - Investment Grade
    1140  Corporate Bonds - High Yield
    1150  Inflation-Linked Bonds (RRBs)
    1160  Mortgage-Backed Securities
    1170  Asset-Backed Securities
    1180  Private Debt / Direct Lending
    1190  Fixed Income - Other

  1200-1299: Public Equities
    1200  Canadian Equities - TSX
    1210  US Equities - Large Cap
    1220  US Equities - Small/Mid Cap
    1230  International Equities - Developed (EAFE)
    1240  Emerging Market Equities
    1250  Equity Index Derivatives (Synthetic)
    1260  Equity Long/Short Positions
    1290  Public Equities - Other

  1300-1399: Private Equity
    1300  Private Equity - Buyout
    1310  Private Equity - Growth
    1320  Private Equity - Venture Capital
    1330  Private Equity - Secondaries
    1340  Private Equity - Co-investments
    1350  Private Equity - Fund Commitments (Unfunded)
    1390  Private Equity - Other

  1400-1499: Real Assets
    1400  Real Estate - Direct (Core)
    1410  Real Estate - Value-Add
    1420  Real Estate - Development
    1430  Infrastructure - Operational
    1440  Infrastructure - Greenfield
    1450  Natural Resources / Timberland
    1460  Agriculture / Farmland
    1490  Real Assets - Other

  1500-1599: Credit Investments
    1500  Direct Lending (Bilateral)
    1510  Leveraged Loans
    1520  Distressed / Special Situations
    1530  Mezzanine Debt
    1540  Structured Credit (CLOs)
    1550  Trade Finance
    1590  Credit - Other

  1600-1699: Absolute Return Strategies
    1600  Macro Strategies
    1610  Relative Value
    1620  Event-Driven
    1630  Multi-Strategy Funds
    1690  Absolute Return - Other

  1700-1799: Derivatives (Overlay)
    1700  Interest Rate Swaps (IRS)
    1710  Cross-Currency Swaps
    1720  Total Return Swaps
    1730  Credit Default Swaps (CDS)
    1740  Options (Listed)
    1750  Options (OTC)
    1760  Futures Positions
    1770  FX Forwards
    1790  Derivatives - Other

  1800-1899: Receivables & Accruals
    1800  Accrued Investment Income
    1810  Dividends Receivable
    1820  Interest Receivable
    1830  Pending Trade Settlements (Buy)
    1840  Securities Lending Receivable
    1850  Tax Reclaims Receivable
    1860  Contributions Receivable
    1890  Other Receivables

  1900-1999: Other Assets
    1900  Prepaid Expenses
    1910  Capital Assets (Office/IT)
    1920  Right-of-Use Assets (IFRS 16)
    1990  Other Assets

2000-2999: OBLIGATIONS & LIABILITIES
  2000-2099: Investment Liabilities
    2000  Securities Sold Short
    2010  Repurchase Agreements (Repos)
    2020  Pending Trade Settlements (Sell)
    2030  Derivative Liabilities (Negative FV)
    2040  Investment Payables
    2050  Collateral Received (Return Obligation)
    2060  Securities Lending Collateral
    2090  Other Investment Liabilities

  2100-2199: Benefit Obligations
    2100  Defined Benefit Obligation (DBO)
    2110  Accrued Benefits Payable (Current)
    2120  Pensions Payable (Monthly)
    2130  Lump Sum Commutations Payable
    2140  Death Benefits Payable
    2150  Disability Benefits Payable
    2160  Division of Pension Credits (Divorce)
    2190  Other Benefit Liabilities

  2200-2299: Operating Liabilities
    2200  Accounts Payable (Trade)
    2210  Accrued Expenses
    2220  Investment Management Fees Payable
    2230  Performance Fees Payable
    2240  Custody Fees Payable
    2250  Lease Liabilities (IFRS 16)
    2260  Employee Compensation Payable
    2290  Other Operating Liabilities

  2300-2399: Debt & Financing
    2300  Credit Facility Drawings
    2310  Commercial Paper Issued
    2320  Term Debt
    2390  Other Financing Liabilities

3000-3999: NET ASSETS AVAILABLE FOR BENEFITS
  3000  Net Assets - Beginning of Year
  3100  Increase in Net Assets (Current Year)
  3200  Actuarial Reserve - Going Concern
  3300  Actuarial Reserve - Solvency
  3400  Contingency Reserve
  3500  Rate Stabilization Reserve
  3900  Accumulated Other Comprehensive Income (AOCI)

4000-4999: CONTRIBUTION REVENUE
  4000  Employer Contributions - Current Service
  4010  Employer Contributions - Special Payments (Deficit Funding)
  4020  Employer Contributions - Past Service
  4100  Employee Contributions - Current Service
  4110  Employee Contributions - Voluntary Additional
  4200  Transfers In (from Other Plans)
  4300  Government Contributions (where applicable)
  4900  Other Contribution Revenue

5000-5999: INVESTMENT INCOME
  5000-5099: Interest Income
    5000  Interest - Government Bonds
    5010  Interest - Corporate Bonds
    5020  Interest - Private Debt
    5030  Interest - Cash & Short-Term
    5040  Interest - Securities Lending
    5050  Interest - Derivatives (Net)
    5090  Interest - Other

  5100-5199: Equity & Alternative Returns
    5100  Dividends - Canadian Equities
    5110  Dividends - US Equities
    5120  Dividends - International Equities
    5130  Dividends - Emerging Market Equities
    5140  Private Equity - Distributions & Realizations
    5150  Infrastructure - Operating Income
    5160  Real Estate - Rental Income (Net)
    5170  Credit - Income
    5180  Absolute Return - Net Gains

  5200-5299: Realized Gains / Losses
    5200  Realized Gain/Loss - Fixed Income
    5210  Realized Gain/Loss - Public Equities
    5220  Realized Gain/Loss - Private Equity
    5230  Realized Gain/Loss - Real Assets
    5240  Realized Gain/Loss - Credit
    5250  Realized Gain/Loss - Derivatives
    5260  Realized Gain/Loss - FX (Trading)
    5290  Realized Gain/Loss - Other

  5300-5399: Unrealized Fair Value Changes
    5300  Unrealized FV Change - Fixed Income
    5310  Unrealized FV Change - Public Equities
    5320  Unrealized FV Change - Private Equity (Quarterly Mark)
    5330  Unrealized FV Change - Real Assets (Appraisal)
    5340  Unrealized FV Change - Credit
    5350  Unrealized FV Change - Derivatives
    5360  Unrealized FV Change - FX Translation
    5390  Unrealized FV Change - Other

  5400-5499: FX Gains / Losses
    5400  FX Gain/Loss - Hedged (Effective Portion)
    5410  FX Gain/Loss - Unhedged
    5420  FX Gain/Loss - Hedge Ineffectiveness
    5490  FX - Other

  5900  Total Investment Return (Summary)

6000-6999: BENEFIT PAYMENTS & DISBURSEMENTS
  6000  Pension Payments - Regular Monthly
  6010  Pension Payments - Indexed Increases
  6020  Commuted Value Payouts (Lump Sum)
  6030  Death Benefit Payments
  6040  Disability Benefit Payments
  6050  Refund of Contributions (Terminations <2yr vesting)
  6060  Division of Credits (Marriage Breakdown)
  6070  Transfers Out (to Other Plans)
  6090  Other Benefit Payments

7000-7999: ADMINISTRATIVE EXPENSES
  7000  Investment Management Fees - External
  7010  Investment Management Fees - Internal (Allocated)
  7020  Performance Fees / Carried Interest
  7030  Custody & Safekeeping Fees
  7040  Transaction Costs (Brokerage, Commission)
  7050  Legal Fees - Transactions
  7060  Valuation & Appraisal Fees
  7100  Pension Administration Expenses
  7110  Actuarial Fees
  7120  Audit Fees
  7130  Regulatory Filing Fees (OSFI, FSRA)
  7200  Staff Compensation (Fund Employees)
  7210  Benefits & Pension (Fund Staff)
  7220  Travel & Business Development
  7230  Technology & Systems
  7240  Office & Occupancy
  7250  Professional Services
  7300  Depreciation & Amortization
  7900  Total Administrative Expenses (Summary)

8000-8999: ACTUARIAL & REGULATORY ADJUSTMENTS
  8000  Actuarial Gain/Loss - Change in Discount Rate
  8010  Actuarial Gain/Loss - Change in Mortality
  8020  Actuarial Gain/Loss - Change in Salary Growth
  8030  Actuarial Gain/Loss - Experience Adjustments
  8040  Actuarial Gain/Loss - Plan Amendments
  8100  OCI - Remeasurement Gains/Losses (IAS 19 Employer)
  8200  Solvency Reserve Adjustment
  8210  Going-Concern Reserve Adjustment
  8300  Regulatory Capital Charge
  8900  Other Actuarial Adjustments

9000-9999: STATISTICAL ACCOUNTS (Non-Monetary)
  9000  NAV by Asset Class (STAT)
  9010  NAV by Investment Pool (STAT)
  9020  Unit Holdings by Pool (STAT)
  9100  Member Count - Active (STAT)
  9110  Member Count - Deferred (STAT)
  9120  Member Count - Pensioner (STAT)
  9130  Member Count - Survivor (STAT)
  9200  FTE Count by Department (STAT)
  9300  AUM by External Manager (STAT)
  9400  Transaction Count by Pool (STAT)
```

---

## Segment 3: Asset Class

| Value | Description | Used With Accounts |
|-------|-------------|-------------------|
| PEQ | Public Equities | 1200-1299, 5100-5130, 5210, 5310 |
| PRI | Private Equity | 1300-1399, 5140, 5220, 5320 |
| REA | Real Assets (RE + Infrastructure) | 1400-1499, 5150-5160, 5230, 5330 |
| CRD | Credit Investments | 1500-1599, 5170, 5240, 5340 |
| FIX | Fixed Income | 1100-1199, 5000-5010, 5200, 5300 |
| ABS | Absolute Return | 1600-1699, 5180 |
| CSH | Cash & Short-Term | 1000-1099, 5030 |
| DRV | Derivatives (Overlay) | 1700-1799, 5050, 5250, 5350 |
| N/A | Not Applicable (non-investment accounts) | 2xxx, 3xxx, 4xxx, 6xxx, 7xxx, 8xxx |

---

## Segment 4: Investment Pool

| Value | Description | Strategy |
|-------|-------------|----------|
| ACTIVE | Active Portfolio | Alpha-seeking, concentrated bets |
| FACTOR | Factor Portfolio | Systematic, rules-based exposure |
| LIABHG | Liability-Hedging Portfolio | Liability-matching, immunization |
| ILLIQD | Illiquid Portfolio | PE, Infra, RE (10yr+ horizon) |
| RESERV | Reserve Portfolio | Liquidity buffer, collateral |
| EXTERN | External Managers | Third-party managed funds |
| N/A | Not Applicable | Non-investment accounts |

---

## Segment 5: Geography

| Value | Description | Currencies |
|-------|-------------|-----------|
| NAM | North America (Canada + US) | CAD, USD |
| EUR | Europe | EUR, GBP, CHF |
| APAC | Asia-Pacific | JPY, AUD, HKD, SGD |
| EMG | Emerging Markets | BRL, INR, CNY, MXN |
| GLB | Global / Multi-Region | Multiple |
| N/A | Not Applicable | CAD (domestic non-investment) |

---

## Segment 6: Member Class

| Value | Description | Use |
|-------|-------------|-----|
| ACT | Active Members (currently contributing) | Contribution allocation, service cost |
| DEF | Deferred Members (vested, not yet receiving) | Deferred obligation tracking |
| PEN | Pensioners (currently receiving benefits) | Benefit payment allocation |
| SUR | Survivors (spouse/dependent benefits) | Survivor benefit tracking |
| ALL | All Member Classes (undifferentiated) | Total plan level entries |

---

## Cross-Validation Rules (CVRs)

| Rule Name | Condition | Purpose |
|-----------|-----------|---------|
| CVR_ASSET_CLASS_ACCOUNTS | If Account NOT in 1000-1799, Asset Class MUST be N/A | Non-investment accounts don't have asset class |
| CVR_GEOGRAPHY_DOMESTIC | If Account in 7000-7999, Geography MUST be N/A or NAM | Admin expenses are domestic |
| CVR_MEMBER_CONTRIBUTIONS | If Account in 4000-4199, Member Class MUST be ACT | Only active members contribute |
| CVR_MEMBER_BENEFITS | If Account in 6000-6099, Member Class MUST be PEN or SUR | Benefits paid to pensioners/survivors |
| CVR_POOL_INVESTMENTS | If Account NOT in 1000-1799, Investment Pool MUST be N/A | Only investments have pool assignment |
| CVR_STAT_ACCOUNTS | If Account in 9000-9999, Asset Class/Pool/Geo may be any | Stat accounts are flexible for driver loading |

---

## Secondary Ledger Configuration (Dual Basis)

### Primary Ledger: IAS 26 / IFRS Basis
- **Name**: `RPP Primary Ledger`
- **Currency**: CAD
- **Calendar**: Standard Calendar (Jan-Dec, monthly)
- **Accounting Method**: Standard Accrual
- **Purpose**: Financial statement preparation per IAS 26

### Secondary Ledger: Solvency Basis (OSFI)
- **Name**: `RPP Solvency Ledger`
- **Currency**: CAD
- **Calendar**: Same as primary
- **Accounting Method**: Custom (solvency-adjusted)
- **Purpose**: OSFI regulatory reporting, solvency reserve calculations

### Key Differences Between Ledgers

| Treatment | Primary (IAS 26) | Secondary (Solvency) |
|-----------|-------------------|---------------------|
| Asset valuation | Fair value (all assets) | Market value with smoothing (5-year avg for PE/RE) |
| Discount rate | Best estimate (market) | Prescribed solvency rate (OSFI Table) |
| Going-concern surplus | Reported as net assets | Separate funded ratio calc |
| Solvency deficit | Disclosed in notes | Triggers special payment schedule |
| Contingency reserve | Optional | Required if funded ratio <105% |

### Subledger Accounting Rules (Secondary Ledger)

For the solvency ledger, create custom SLA rules that:
- Apply smoothed valuations for PE/RE asset classes
- Use OSFI-prescribed discount rate instead of market rate
- Calculate solvency-specific provisions

Navigation: `Setup and Maintenance > Financials > General Ledger > Manage Accounting Methods`

---

## Employer Perspective COA (Corporate GL)

For the plan sponsor (employer) recording pension on their corporate books:

| Account | Description | Normal Balance |
|---------|-------------|---------------|
| 1850 | Pension Asset (funded status if surplus) | Debit |
| 2600 | Defined Benefit Obligation (funded status if deficit) | Credit |
| 7500 | Current Service Cost | Debit |
| 7510 | Net Interest Cost (IAS 19) / Interest Cost (ASC 715) | Debit |
| 7520 | Past Service Cost | Debit |
| 7530 | Expected Return on Plan Assets (ASC 715 only) | Credit |
| 7540 | Settlement/Curtailment Gain or Loss | Debit/Credit |
| 8100 | OCI - Actuarial Remeasurement (IAS 19) | Debit/Credit |
| 8110 | OCI - Accumulated Remeasurement | Debit/Credit |
| 8120 | OCI - Amortization of Prior Service Cost (ASC 715) | Debit/Credit |

### Employer Secondary Ledger (ASC 715 for US GAAP)

If the employer reports under both IFRS and US GAAP:
- **Primary Ledger**: IFRS (IAS 19 — remeasurement in OCI, no recycling)
- **Secondary Ledger**: US GAAP (ASC 715 — corridor amortization from AOCI to P&L)

Subledger Accounting rules differ on:
- Expected return on assets: recognized in secondary (ASC 715), not in primary (IAS 19)
- Amortization of OCI: happens in secondary (corridor method), never in primary
