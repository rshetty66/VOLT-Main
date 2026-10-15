# Oracle TRCS — Tax Reporting Cloud Service

Complete implementation reference for Oracle Tax Reporting Cloud Service (TRCS).

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Tax Reporting Cloud Service |
| **Abbreviation** | TRCS |
| **Purpose** | Global tax provision, deferred tax calculation, country-by-country reporting, tax rate reconciliation |
| **Key Users** | Tax directors, tax analysts, tax compliance teams, external auditors |
| **Typical Implementation** | 12-20 weeks (depending on jurisdiction count and complexity) |
| **Replaces (On-Prem)** | Hyperion Tax Provision (HTP) |

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Current Tax Provision** | Calculate current income tax expense by jurisdiction |
| **Deferred Tax** | Temporary differences, DTA/DTL calculation, valuation allowance |
| **Tax Rate Reconciliation** | Statutory-to-effective rate bridge (book vs tax differences) |
| **Return-to-Provision** | True-up adjustments when actual returns differ from provision estimates |
| **Country-by-Country Reporting (CbCR)** | OECD BEPS Pillar 1/2 compliance reporting |
| **Pillar Two (GloBE)** | Global minimum tax (15%) calculations per OECD framework |
| **Tax Account Roll-Forward** | Opening → P&L charge → payments → adjustments → closing |
| **Multi-GAAP Support** | IFRS (IAS 12), US GAAP (ASC 740), local GAAP simultaneous |
| **Tax Notes & Disclosures** | Automated generation of financial statement tax note data |
| **Interim Provision** | Quarterly estimated annual effective tax rate (EAETR) method |
| **State/Provincial Tax** | Multi-jurisdiction apportionment (US states, Canadian provinces) |

---

## TRCS Application Architecture

### Pre-Built Tax Dimensions

| Dimension | Purpose | Key Members |
|-----------|---------|-------------|
| **Scenario** | Provision type | Current Provision, Forecast, Budget, Return-to-Provision |
| **Year / Period** | Tax year and interim periods | FY + quarterly/monthly |
| **Entity** | Tax reporting entities | Legal entities (may differ from FCCS entities) |
| **Jurisdiction** | Tax jurisdictions | National + Sub-national (Federal, State/Province, Local) |
| **Account** | Tax accounts | Pre-built tax account hierarchy (current, deferred, rate rec) |
| **Data Source** | Origin of data | Automated, Manual, Override |
| **Tax Type** | Tax classification | Income Tax, Withholding, Capital Gains, Other |
| **Movement** | Roll-forward categories | Opening, P&L Charge, OCI, Payment, FX, Closing |

### Pre-Built Calculation Logic

TRCS comes with **pre-configured tax calculation engines** — unlike EPBCS/FCCS where you build from scratch:

| Calculation | Logic |
|-------------|-------|
| **Current tax** | (Pre-tax book income ± permanent differences ± timing differences) × statutory rate |
| **Deferred tax asset/liability** | Temporary difference balance × enacted future rate |
| **Valuation allowance** | DTA that is not "more likely than not" to be realized |
| **ETR Reconciliation** | Statutory rate → adjustments → effective rate (waterfall) |
| **CbCR revenue/profit** | Consolidated revenue and profit by jurisdiction |
| **Pillar Two top-up tax** | (15% - jurisdiction ETR) × excess profit |

---

## Tax Provision Workflow

### Annual Provision Process

```
1. PRE-TAX INCOME (from FCCS or GL)
   │
   ├── 2. PERMANENT DIFFERENCES
   │     • Non-deductible expenses (entertainment, fines, stock comp)
   │     • Tax-exempt income (dividends received deduction, muni interest)
   │     • Non-deductible goodwill impairment
   │
   ├── 3. TEMPORARY DIFFERENCES
   │     • Depreciation (book vs tax methods)
   │     • Revenue recognition timing
   │     • Accruals (warranty, bad debt, restructuring)
   │     • Pension/OPEB
   │     • Lease obligations (IFRS 16 / ASC 842)
   │     • Unrealized gains/losses
   │
   ├── 4. TAX RATE APPLICATION
   │     • Statutory rate × taxable income = Current tax
   │     • Future enacted rate × temp diff = Deferred tax
   │
   ├── 5. CREDITS & INCENTIVES
   │     • R&D tax credits (SR&ED in Canada)
   │     • Investment tax credits
   │     • Foreign tax credits
   │     • Manufacturing & processing deductions
   │
   └── 6. PROVISION RESULTS
         • Current tax expense/benefit
         • Deferred tax expense/benefit
         • Total income tax expense
         • Effective tax rate
         • Tax balance sheet (DTA/DTL net by jurisdiction)
```

### Interim (Quarterly) Provision — EAETR Method

| Step | Action |
|------|--------|
| 1 | Estimate full-year pre-tax income by jurisdiction |
| 2 | Calculate full-year provision (annual ETR) |
| 3 | Apply estimated annual ETR to YTD pre-tax income |
| 4 | Subtract prior quarter tax provisions = current quarter provision |
| 5 | Add/subtract discrete items (specific to this quarter) |
| 6 | Result = quarterly tax provision |

---

## Configuration Steps

### Step 1: Jurisdiction Setup

```
National Jurisdictions:
├── Canada (Federal) — Rate: 15%
│   ├── Ontario — Rate: 11.5%
│   ├── Alberta — Rate: 8%
│   ├── British Columbia — Rate: 12%
│   └── Quebec — Rate: 11.5%
├── United States (Federal) — Rate: 21%
│   ├── New York — Rate: 6.5%
│   ├── California — Rate: 8.84%
│   └── Delaware — Rate: 8.7%
└── United Kingdom — Rate: 25%
```

### Step 2: Tax Rate Configuration

| Rate Type | Purpose | Example |
|-----------|---------|---------|
| **Statutory rate** | Current year enacted rate | Canada Federal: 15% |
| **Future enacted rate** | Rate for deferred tax | UK increasing to 25% in FY24+ |
| **Combined rate** | National + sub-national | Ontario entity: 15% + 11.5% = 26.5% |
| **Capital gains rate** | Rate on capital disposals | Canada: 50% inclusion × 26.5% = 13.25% effective |
| **Withholding rate** | Cross-border payments | Canada-US treaty: 5% on dividends |

### Step 3: Permanent & Temporary Difference Setup

**Permanent Differences (common):**

| Difference | Treatment | Direction |
|------------|-----------|-----------|
| Non-deductible meals/entertainment | Add back | Increases taxable income |
| Tax-exempt intercorporate dividends | Deduction | Decreases taxable income |
| Non-deductible stock compensation | Add back | Increases taxable income |
| Non-deductible fines/penalties | Add back | Increases taxable income |
| Tax-exempt life insurance proceeds | Deduction | Decreases taxable income |
| SR&ED expenditures (super-deduction) | Deduction | Decreases taxable income |

**Temporary Differences (common):**

| Difference | Book Treatment | Tax Treatment | DTA or DTL? |
|------------|---------------|---------------|-------------|
| Depreciation (CCA vs accounting) | Straight-line | Declining balance (CCA) | DTL (tax faster) |
| Bad debt allowance | Estimate-based | Write-off when uncollectible | DTA (tax slower) |
| Warranty accrual | Estimated at sale | Deductible when paid | DTA (tax slower) |
| Revenue recognition | Over time (IFRS 15) | On receipt | DTL (tax earlier) |
| Lease ROU assets (IFRS 16) | ROU depreciation | Lease payments | DTA or DTL |
| Pension obligation | Actuarial estimate | Funding contributions | DTA (tax slower) |
| Loss carryforward | N/A | Offset future income | DTA |

### Step 4: Data Integration (FCCS → TRCS)

| Data | Source | Mapping |
|------|--------|---------|
| Pre-tax income by entity | FCCS consolidated data | Entity-to-Jurisdiction mapping |
| Book depreciation | Fixed asset sub-ledger | Account mapping |
| Accrual balances | GL or FCCS | Account → Temp diff category |
| Intercompany eliminations | FCCS ICO data | Transfer pricing adjustments |
| Equity movements (OCI) | FCCS equity roll-forward | Tax effects on OCI items |

---

## Pillar Two / GloBE (Global Minimum Tax)

### TRCS Pillar Two Module

Oracle added Pillar Two support to TRCS for the OECD GloBE rules (effective 2024+):

| Calculation | Formula |
|-------------|---------|
| **GloBE Income** | Financial accounting net income ± GloBE adjustments |
| **Covered Taxes** | Current tax + deferred tax (adjusted per GloBE rules) |
| **Jurisdictional ETR** | Covered Taxes / GloBE Income per jurisdiction |
| **Top-Up Tax** | (15% - Jurisdictional ETR) × Excess Profit |
| **Excess Profit** | GloBE Income - Substance-Based Carve-out |
| **Substance Carve-out** | (5% × tangible assets) + (5% × payroll costs) per jurisdiction |

### Configuration for Pillar Two
1. Enable Pillar Two module in TRCS
2. Define in-scope entities (revenue >€750M consolidated)
3. Map GloBE adjustments (stock comp, pension, revaluations)
4. Configure substance-based carve-out inputs
5. Set up Qualified Domestic Minimum Top-Up Tax (QDMTT) where applicable
6. Generate CbCR data for IIR/UTPR allocation

---

## Country-by-Country Reporting (CbCR)

### OECD CbCR Template (Table 1)

| Field | Source in TRCS |
|-------|---------------|
| Revenue — Unrelated Party | FCCS external revenue by jurisdiction |
| Revenue — Related Party | FCCS ICO revenue by jurisdiction |
| Profit (Loss) Before Tax | TRCS pre-tax income by jurisdiction |
| Income Tax Paid (Cash Basis) | TRCS current tax payments |
| Income Tax Accrued | TRCS current tax provision |
| Stated Capital | FCCS equity by entity |
| Accumulated Earnings | FCCS retained earnings by entity |
| Number of Employees | HR system headcount by jurisdiction |
| Tangible Assets | Fixed asset sub-ledger by jurisdiction |

---

## Return-to-Provision (RTP) True-Up

### Process Flow

```
Year N Provision Estimate (booked in FS)

Year N+1 Tax Return Filed (actual numbers)

Compare: Return amounts vs Provision estimates

Calculate RTP adjustment (over/under provided)

Book RTP journal entry in Year N+1

Adjust opening deferred tax balances
```

### RTP Configuration in TRCS
1. Set up RTP scenario (separate from current provision scenario)
2. Load actual return data (from tax return preparation software)
3. System calculates variance: Return - Provision = RTP adjustment
4. Classify adjustments: which relate to permanent vs temporary
5. Generate RTP journal for booking in GL/FCCS
6. Roll forward deferred tax balances to reflect actual return positions

---

## Tax Reporting Outputs

| Report | Purpose | Audience |
|--------|---------|----------|
| **Tax Provision Summary** | Current + deferred tax by jurisdiction | Tax Director, Auditors |
| **Effective Tax Rate Reconciliation** | Statutory → ETR waterfall | Board, Financial Statements |
| **Deferred Tax Roll-Forward** | Opening → movement → closing DTA/DTL | Auditors, Tax Notes |
| **Tax Balance Sheet** | Net DTA/DTL position by jurisdiction | Financial Statements |
| **CbCR Report** | OECD Table 1, 2, 3 | Tax Authority filing |
| **Pillar Two Computation** | GloBE income, ETR, top-up tax | Tax compliance |
| **Tax Account Reconciliation** | Tax payable/receivable movement | Controller, Close team |
| **Interim EAETR Calculation** | Quarterly ETR estimate and application | Quarterly reporting |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| ETR doesn't tie to P&L | Permanent diffs not captured | Review all non-deductible/exempt items |
| Deferred tax imbalanced | Missing temporary difference category | Ensure all BS items assessed for temp diffs |
| CbCR totals don't match FS | Elimination entries not excluded | Verify CbCR uses entity-level pre-elimination data |
| Rate change impact wrong | Future rate not updated | Update enacted rate table for all jurisdictions |
| RTP adjustment too large | Provision estimates were too aggressive | Improve provision accuracy; tighten estimation |
| Pillar Two carve-out incorrect | Tangible assets not correctly mapped | Verify fixed asset data feed by jurisdiction |
| Interim provision volatile | Discrete items not isolated | Properly classify discrete vs EAETR items |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| TRCS Admin Guide | `docs.oracle.com/en/cloud/saas/tax-reporting-cloud/agtrc/` |
| Tax Provision | `docs.oracle.com/en/cloud/saas/tax-reporting-cloud/agtrc/provision_overview.html` |
| CbCR Reporting | `docs.oracle.com/en/cloud/saas/tax-reporting-cloud/agtrc/cbcr.html` |
| Pillar Two | `docs.oracle.com/en/cloud/saas/tax-reporting-cloud/agtrc/pillar_two.html` |
| Data Integration | `docs.oracle.com/en/cloud/saas/tax-reporting-cloud/agtrc/data_integration.html` |
| REST API | `docs.oracle.com/en/cloud/saas/tax-reporting-cloud/trapi/` |
