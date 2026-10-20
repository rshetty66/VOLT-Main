---
name: pension-gl-configuration
description: >
  Pension fund and defined benefit plan GL configuration in Oracle ERP Cloud — covering both
  fund administrator and employer perspectives at large multi-asset fund complexity.
  Activates when users ask about "pension GL configuration", "pension fund Oracle ERP",
  "defined benefit plan Oracle GL", "DB plan GL setup", "pension COA design",
  "pension allocation rules GL", "actuarial gain loss GL", "pension OCI entries",
  "plan asset accounting Oracle", "pension remeasurement Oracle", "pension expense allocation",
  "pension contribution recording", "benefit payment GL entries", "pension investment GL",
  "pension fund transfer pricing", "OSFI pension reporting GL", "FSRA pension GL",
  "pension service cost journal", "pension interest cost GL", "expected return plan assets",
  "pension curtailment journal", "pension settlement journal", "multi-class pension investment",
  "pension fund COA Oracle", "IAS 19 Oracle GL configuration", "ASC 715 Oracle GL setup",
  "pension corridor method Oracle", "pension journal entries Oracle ERP Cloud",
  "pension period close Oracle", "pension regulatory reporting GL",
  "employer contribution GL entries", "employee contribution GL", "pension benefit obligation GL",
  "pension fund administrator Oracle",
  "pension investment return allocation", "pension asset class tracking GL",
  "pension solvency reserve GL", "pension going concern funding GL",
  "pension fund close process", "pension custodian reconciliation",
  "pension NAV reconciliation GL", "pension FX translation",
  "pension private equity GL", "pension infrastructure investment GL",
  "pension real estate GL", "pension credit investments GL",
  or any pension-specific Oracle ERP Cloud GL configuration, journal entry, allocation,
  COA design, or reporting question.
version: 1.0.0
disable-model-invocation: true
---

# Oracle ERP Cloud GL — Pension Fund & Defined Benefit Plan Configuration

Comprehensive GL configuration reference for pension funds operating Oracle ERP Cloud. Covers both the **Fund Administrator perspective** (managing the fund's own GL for a large multi-asset portfolio) and the **Employer perspective** (recording pension expense/obligations on corporate books).

---

## Dual Perspective Overview

| Perspective | Who | GL Contains | Key Standards |
|-------------|-----|-------------|---------------|
| **Fund Administrator** | Pension fund or plan administrator | The pension fund's OWN assets, liabilities, income, expenses | IAS 26 (Retirement Benefit Plans), CPA Canada Handbook |
| **Employer** | Plan sponsor (bank, government, corporation) | Pension expense, DBO liability, plan asset (net), OCI | IAS 19 (Employee Benefits), ASC 715 (Compensation—Retirement) |

**This skill covers Oracle ERP Cloud GL configuration for BOTH.** The COA design, allocation rules, and test scenarios focus primarily on the Fund Administrator perspective, with a dedicated section for Employer entries. Worked examples use the fictional **Relecloud Pension Plan (RPP)** with round, illustrative figures.

---

## Architecture: Pension Fund GL in Oracle ERP Cloud

```
┌─────────────────────────────────────────────────────────────────────┐
│              PENSION FUND GL (FUND ADMINISTRATOR VIEW)                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ INVESTMENT PORTFOLIO (Plan Assets)                            │   │
│  │  Public Equities | Private Equity | Real Assets | Credit     │   │
│  │  Fixed Income | Absolute Return | Cash & Short-Term          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ OBLIGATIONS & LIABILITIES                                     │   │
│  │  Defined Benefit Obligation | Accrued Benefits | Due to       │   │
│  │  Members | Investment Payables | Pending Settlements          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ NET ASSETS (Fund Equity)                                      │   │
│  │  Available for Benefits | Solvency Reserve | Contingency      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ INCOME & EXPENSES                                             │   │
│  │  Investment Income | Contributions | Benefit Payments         │   │
│  │  Administrative Expenses | Actuarial Adjustments              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ ALLOCATION ENGINE (Oracle GL Allocation Rules)                │   │
│  │  Investment return → Asset Class → Pool → Geography           │   │
│  │  Admin expenses → Member Class                                │   │
│  │  Management fees → Strategy / External Manager                │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Navigation Paths (Oracle ERP Cloud 24D+)

| Task | Navigation |
|------|-----------|
| **Configure Pension COA** | Setup and Maintenance > Financials > General Ledger > Manage Chart of Accounts Structures |
| **Create Pension Value Sets** | Setup and Maintenance > Financials > General Ledger > Manage Chart of Accounts Value Sets |
| **Define Pension Segments** | Setup and Maintenance > Financials > General Ledger > Manage Chart of Accounts Structure Instances |
| **Create Cross-Validation Rules** | Setup and Maintenance > Financials > General Ledger > Manage Cross-Validation Rules |
| **Configure Allocation Rules** | Setup and Maintenance > Financials > General Ledger > Manage Allocation Rules |
| **Create Secondary Ledger (IFRS/GAAP)** | Setup and Maintenance > Financials > General Ledger > Manage Secondary Ledgers |
| **Post Pension Journals** | Navigator > General Accounting > Journals > Create Journal |
| **Run Allocations** | Navigator > Tools > Scheduled Processes > Generate Allocations |
| **Period Close** | Navigator > General Accounting > Close > Open and Close Periods |
| **Trial Balance** | Navigator > General Accounting > Trial Balance |

---

## COA Design Summary (Large Multi-Asset Fund)

**7-Segment Structure:**

```
[Fund/Plan]-[Account]-[Asset Class]-[Investment Pool]-[Geography]-[Member Class]-[Intercompany]
   001     -  1200   -     PE      -     ACTIVE      -    NAM    -    ACT       -     000
```

| Segment | Qualifier | Width | Purpose |
|---------|-----------|-------|---------|
| Fund/Plan | Balancing | 3 | Identifies pension plan (e.g., main fund, supplementary plan) |
| Account | Natural Account | 4 | Standard GL accounts (assets, liabilities, income, expense) |
| Asset Class | — | 3 | Investment type (PEQ, PRI, REA, CRD, FIX, ABS, CSH) |
| Investment Pool | — | 6 | Strategy/portfolio (ACTIVE, FACTOR, LIABHG, ILLIQD) |
| Geography | — | 3 | Investment region (NAM, EUR, APAC, EMG, GLB) |
| Member Class | — | 3 | Beneficiary type (ACT, DEF, PEN, SUR, ALL) |
| Intercompany | Intercompany | 3 | IC between fund entities |

See [Pension COA Design](references/pension-coa-design.md) for complete account hierarchy and value sets.

---

## Key Configuration Decisions

| Decision | Options | Recommendation for a Large Multi-Asset Fund |
|----------|---------|-------------------------------|
| Number of balancing segments | 1 (Fund only) vs 2 (Fund + IC) | 2 — enables intercompany elimination |
| Asset Class as segment vs attribute | Segment (in COA) vs Descriptive Flexfield | Segment — required for allocation rules |
| Secondary ledger | IFRS vs Canadian GAAP | Yes — Primary = IAS 26, Secondary = solvency basis |
| Statistical journals for drivers | NAV, unit holdings, member count | Yes — critical for investment return allocation |
| Allocation rule count | <20 vs 20-50 | 30-40 rules typical for a large multi-asset fund |

---

## IAS 19 vs ASC 715 — Employer Perspective (Quick Reference)

| Component | IAS 19 Treatment | ASC 715 Treatment |
|-----------|-----------------|-------------------|
| Current Service Cost | P&L (operating) | P&L (operating) |
| Net Interest on DBO | P&L (finance cost) | N/A — uses Expected Return concept |
| Expected Return on Assets | N/A (use net interest) | P&L (reduces pension expense) |
| Interest Cost on DBO | Part of net interest | P&L (finance cost) |
| Past Service Cost | P&L immediately | P&L immediately (post-ASU 2017-07) |
| Actuarial Remeasurement | OCI — NO recycling to P&L ever | OCI — amortization to P&L (corridor option) |
| Plan Amendments | P&L if vested; OCI if unvested | P&L immediately |
| Curtailment/Settlement | P&L (gain/loss recognized) | P&L (gain/loss recognized) |

For employer GL configuration, see Oracle secondary ledger setup in [Pension COA Design](references/pension-coa-design.md).

---

## Period Close Process — Pension Fund

| Step | Process | Timing | Oracle Action |
|------|---------|--------|---------------|
| 1 | Receive custodian investment feeds | Day 1 | Import via FBDI or interface |
| 2 | Post custodian transaction journals | Day 1-2 | Auto-post from interface |
| 3 | Reconcile NAV per custodian vs GL | Day 2 | Run reconciliation report |
| 4 | Post manual investment adjustments | Day 2-3 | Manual journals (FV adjustments, PE markings) |
| 5 | Load statistical journals (NAV by pool, member counts) | Day 3 | Statistical journal entry |
| 6 | **Run investment return allocation** | Day 3 | Generate Allocations: ALLOC_INV_RETURN |
| 7 | **Run admin expense allocation** | Day 3 | Generate Allocations: ALLOC_ADMIN_EXP |
| 8 | Post benefit payment journals | Day 4 | Interface from pension admin system |
| 9 | Post contribution receipts | Day 4 | Bank reconciliation + journal |
| 10 | Run FX revaluation (for non-CAD assets) | Day 4 | ESS: Revalue Balances |
| 11 | Run FX translation (for reporting currencies) | Day 5 | ESS: Translate Balances |
| 12 | Post actuarial adjustment (quarterly/annual) | Day 5 | Manual journal from actuary report |
| 13 | Run solvency reserve allocation | Day 5 | Generate Allocations: ALLOC_SOLVENCY |
| 14 | Final trial balance review | Day 5 | Trial Balance report |
| 15 | Close period | Day 5 | Close General Ledger |

---

## References

| Document | Content |
|----------|---------|
| [Pension COA Design](references/pension-coa-design.md) | Complete 7-segment COA, account hierarchy, value sets, CVRs, secondary ledger |
| [Pension Allocation Rules](references/pension-allocation-rules.md) | Fund-specific allocation rules using Oracle GL allocation engine |
| [Pension Unit Test Scenarios](references/pension-unit-test-scenarios.md) | 10 illustrative test scenarios (fictional Relecloud Pension Plan) with expected journal entries |

---

## Common Issues & Resolution

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Investment return not allocating | Statistical NAV journals not posted | Post NAV stat journals before allocation run |
| FX translation missing for PE assets | Private equity in Asset Class segment not mapped to currency | Ensure non-CAD geography segments have revaluation config |
| Benefit payment journal unbalanced | Member class segment mismatch between debit/credit | Verify both sides use same member class or use balancing segment |
| Solvency reserve over-allocated | Going-concern basis used instead of solvency basis | Switch allocation to secondary ledger (solvency basis) |
| Actuarial adjustment hitting P&L (should be OCI) | Wrong account used (expense vs OCI account) | IAS 19: use account 8xxx (OCI), not 7xxx (expense) |
| Custodian feed reconciliation break | Timing difference on pending settlements | Post pending settlement accrual; reverse next period |
| Multi-currency NAV mismatch | Unrealized FX on foreign investments not revalued | Run revaluation ESS for all foreign currency accounts |
