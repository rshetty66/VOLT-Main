# Oracle ERP Cloud GL — Pension Fund Unit Test Scenarios

Ten complete test scenarios for validating pension fund GL configuration in Oracle ERP Cloud. Each scenario uses the fictional **Relecloud Pension Plan (RPP)** with round, illustrative figures, specific account numbers, segment values, and expected journal entries. Replace the figures with the fund's own data before use.

---

## COA Reference (Used Across All Scenarios)

```
Segments: [Fund]-[Account]-[Asset Class]-[Investment Pool]-[Geography]-[Member Class]-[IC]
Example:   001  -  5100   -    PEQ      -     ACTIVE      -    NAM    -    ALL       - 000
```

Currency: CAD (Primary Ledger)
Ledger: RPP Primary Ledger
Period: Jun-26

---

## Scenario 1: Employer Monthly Contribution Recording

### Precondition
- Employer contribution received per the plan's contribution schedule
- Bank account reconciled, funds confirmed received

### Input
- Monthly employer contribution amount: $50,000,000
- Received into custodian bank account (CAD)

### Configuration
- No allocation rule needed — direct journal entry
- Journal Source: Interface (from bank feed)
- Journal Category: Contributions

### Expected Journal Entry

| Line | Fund | Account | Asset Class | Pool | Geo | Member | Debit | Credit | Description |
|------|------|---------|-------------|------|-----|--------|-------|--------|-------------|
| 1 | 001 | 1010 | CSH | RESERV | NAM | ALL | $50,000,000 | | Cash - Custodian CAD |
| 2 | 001 | 4000 | N/A | N/A | N/A | ACT | | $40,000,000 | Employer Contributions - Current Service (80%) |
| 3 | 001 | 4010 | N/A | N/A | N/A | ACT | | $10,000,000 | Employer Contributions - Special Payments (20%) |

### Validation
- Cash balance increased by $50M
- Contribution revenue increased by $50M
- Member Class = ACT (only active members contribute)
- Cross-Validation Rule: CVR_MEMBER_CONTRIBUTIONS passes (Account 4000 + Member Class ACT)
- Bank reconciliation matches deposit record

---

## Scenario 2: Employee Bi-Weekly Contribution Recording

### Precondition
- Employee contributions deducted from payroll by participating employers
- Remitted bi-weekly by participating employers

### Input
- Bi-weekly employee contribution: $25,000,000

### Expected Journal Entry

| Line | Fund | Account | Asset Class | Pool | Geo | Member | Debit | Credit |
|------|------|---------|-------------|------|-----|--------|-------|--------|
| 1 | 001 | 1010 | CSH | RESERV | NAM | ALL | $25,000,000 | |
| 2 | 001 | 4100 | N/A | N/A | N/A | ACT | | $25,000,000 |

### Validation
- Account 4100 (Employee Contributions - Current Service) credited
- Member Class = ACT per CVR
- Matches employer remittance schedule

---

## Scenario 3: Monthly Pension Benefit Payments

### Precondition
- Monthly pension payments processed through pension admin system
- Payment file submitted to bank for disbursement

### Input
- Total monthly pension payments: $40,000,000
  - Regular monthly pensions: $35,000,000
  - Indexed increases (CPI adjustment): $3,000,000
  - Survivor benefits: $2,000,000

### Expected Journal Entry

| Line | Fund | Account | Asset Class | Pool | Geo | Member | Debit | Credit |
|------|------|---------|-------------|------|-----|--------|-------|--------|
| 1 | 001 | 6000 | N/A | N/A | N/A | PEN | $35,000,000 | | Regular pensions |
| 2 | 001 | 6010 | N/A | N/A | N/A | PEN | $3,000,000 | | Indexed increases |
| 3 | 001 | 6030 | N/A | N/A | N/A | SUR | $2,000,000 | | Survivor benefits |
| 4 | 001 | 1010 | CSH | RESERV | NAM | ALL | | $40,000,000 | Cash disbursement |

### Validation
- CVR_MEMBER_BENEFITS: Account 6000/6010 with Member Class PEN (pass)
- CVR_MEMBER_BENEFITS: Account 6030 with Member Class SUR (pass)
- Cash reduced by $40M
- Benefit payment expense increased by $40M
- Trial Balance: total benefits YTD accumulates correctly

---

## Scenario 4: Quarterly Private Equity Valuation Mark (Unrealized FV Change)

### Precondition
- Q2 valuation reports received from GP managers
- PE portfolio marked to fair value based on latest NAV statements
- Total PE portfolio: $5B across geographies

### Input
- Q2 unrealized FV increase for PE portfolio: $100,000,000
- Geographic breakdown (from valuation reports):
  - NAM: $50,000,000 (50%)
  - EUR: $25,000,000 (25%)
  - APAC: $15,000,000 (15%)
  - EMG: $10,000,000 (10%)

### Configuration — Two-Step Process

**Step A: Post aggregate PE valuation (initial journal):**

| Line | Fund | Account | Asset Class | Pool | Geo | Member | Debit | Credit |
|------|------|---------|-------------|------|-----|--------|-------|--------|
| 1 | 001 | 1300 | PRI | ILLIQD | GLB | ALL | $100,000,000 | | PE Assets - FV increase |
| 2 | 001 | 5320 | PRI | ILLIQD | GLB | ALL | | $100,000,000 | Unrealized FV Change - PE |

**Step B: Run allocation to distribute by geography:**

Rule: `ALLOC_PE_DISTRIBUTIONS_BY_GEO` (adjusted for unrealized via separate rule on account 5320)

Statistical journals pre-loaded: Account 9000, Asset Class PRI, by Geography:
- NAM: $2.5B NAV (50%)
- EUR: $1.25B NAV (25%)
- APAC: $0.75B NAV (15%)
- EMG: $0.5B NAV (10%)

### Expected Allocation Journal (Step B)

| Line | Fund | Account | Asset Class | Pool | Geo | Member | Debit | Credit |
|------|------|---------|-------------|------|-----|--------|-------|--------|
| 1 | 001 | 5320 | PRI | ILLIQD | NAM | ALL | | $50,000,000 | 50% |
| 2 | 001 | 5320 | PRI | ILLIQD | EUR | ALL | | $25,000,000 | 25% |
| 3 | 001 | 5320 | PRI | ILLIQD | APAC | ALL | | $15,000,000 | 15% |
| 4 | 001 | 5320 | PRI | ILLIQD | EMG | ALL | | $10,000,000 | 10% |
| 5 | 001 | 5399 | PRI | ILLIQD | GLB | ALL | $100,000,000 | | Clearing (from GLB) |

### Validation
- Post-allocation: Account 5320 with Geo=GLB should net to zero (cleared)
- Account 5320 by geography matches valuation report breakdown
- Total PE unrealized gain ($100M) unchanged, just redistributed by geography
- Trial Balance: PE asset account 1300 increased by $100M total

---

## Scenario 5: Investment Return Allocation — Public Equities by Pool

### Precondition
- Monthly custodian feed posted: total equity dividend income = $24,000,000
- Posted to Account 5100-5130, Asset Class PEQ, Investment Pool N/A (unallocated)
- Statistical journals loaded: NAV by Investment Pool for PEQ

### Input — Statistical Balances (Account 9010, Asset Class PEQ)

| Investment Pool | NAV (Stat Balance) | Proportion |
|-----------------|-------------------|-----------|
| ACTIVE | $1,800,000,000 | 60.0% |
| FACTOR | $750,000,000 | 25.0% |
| LIABHG | $300,000,000 | 10.0% |
| RESERV | $150,000,000 | 5.0% |
| **Total** | **$3,000,000,000** | **100%** |

### Action
- Run Generate Allocations: Rule Set = PEN_ALLOC_INV_RETURN, Period = Jun-26

### Expected Allocation Journal

| Line | Account | Asset Class | Pool | Debit | Credit | Notes |
|------|---------|-------------|------|-------|--------|-------|
| 1 | 5100 | PEQ | ACTIVE | | $14,400,000 | 60% of $24M |
| 2 | 5100 | PEQ | FACTOR | | $6,000,000 | 25% |
| 3 | 5100 | PEQ | LIABHG | | $2,400,000 | 10% |
| 4 | 5100 | PEQ | RESERV | | $1,200,000 | 5% |
| 5 | 5199 | PEQ | N/A | $24,000,000 | | Clearing |

### Validation
- Post-allocation: Account 5100, Pool=N/A nets to zero (cleared by offset)
- Total equity dividend income across all pools = $24M (unchanged)
- Each pool's proportion matches NAV weighting
- Factor statistical balance sum ($3B) matches actual NAV report from custodian

---

## Scenario 6: Administrative Expense Allocation by Member Class

### Precondition
- Month-end admin expenses posted: $4,500,000 in accounts 7100-7130
- Member Class = ALL (undifferentiated)
- Statistical member count journals posted

### Input — Statistical Balances (Accounts 9100-9130)

| Stat Account | Member Class | Count | Proportion |
|-------------|-------------|-------|-----------|
| 9100 | ACT (Active) | 60,000 | 60% |
| 9110 | DEF (Deferred) | 15,000 | 15% |
| 9120 | PEN (Pensioner) | 20,000 | 20% |
| 9130 | SUR (Survivor) | 5,000 | 5% |
| **Total** | | **100,000** | **100%** |

### Action
- Run Generate Allocations: Rule Set = PEN_ALLOC_ADMIN_EXP

### Expected Allocation Journal

| Line | Account | Member Class | Debit | Credit | Notes |
|------|---------|-------------|-------|--------|-------|
| 1 | 7100 | ACT | $2,700,000 | | 60% |
| 2 | 7100 | DEF | $675,000 | | 15% |
| 3 | 7100 | PEN | $900,000 | | 20% |
| 4 | 7100 | SUR | $225,000 | | 5% |
| 5 | 7199 | ALL | | $4,500,000 | Clearing |

### Validation
- Total allocated = $4,500,000 (matches pool)
- Member Class proportions match headcount ratios
- Clearing account 7199, Member Class ALL = zero after allocation
- Each member class now carries its share of admin costs for regulatory reporting

---

## Scenario 7: FX Revaluation — Foreign Currency Investments

### Precondition
- US equity portfolio (Account 1210, Geography NAM, Asset Class PEQ) = USD $850M
- EUR fixed income (Account 1100-1130, Geography EUR, Asset Class FIX) = EUR 450M
- Month-end rates changed vs CAD

### Input — FX Rate Changes (illustrative rates)

| Currency | Prior Rate | Current Rate | Change |
|----------|-----------|-------------|--------|
| USD/CAD | 1.3500 | 1.3600 | +0.74% |
| EUR/CAD | 1.5000 | 1.4800 | -1.33% |

### Expected Revaluation Journals (from ESS: Revalue Balances, NOT allocation)

**USD Equity Revaluation:**
- USD $850M × (1.3600 - 1.3500) = CAD $8,500,000 gain

| Line | Account | Asset Class | Geo | Debit | Credit |
|------|---------|-------------|-----|-------|--------|
| 1 | 1210 | PEQ | NAM | $8,500,000 | | Asset revaluation |
| 2 | 5360 | PEQ | NAM | | $8,500,000 | Unrealized FX gain |

**EUR Fixed Income Revaluation:**
- EUR 450M × (1.4800 - 1.5000) = CAD -$9,000,000 loss

| Line | Account | Asset Class | Geo | Debit | Credit |
|------|---------|-------------|-----|-------|--------|
| 1 | 5360 | FIX | EUR | $9,000,000 | | Unrealized FX loss |
| 2 | 1100 | FIX | EUR | | $9,000,000 | Asset revaluation |

### Validation
- Run ESS: "Revalue Balances" (NOT Generate Allocations — this is revaluation, not allocation)
- USD positions show FX gain, EUR positions show FX loss
- Account 5360 (Unrealized FV Change - FX Translation) captures the movement
- Geography segment correctly identifies the exposure currency
- Net FX impact: -$0.5M (loss on EUR > gain on USD)

---

## Scenario 8: Actuarial Remeasurement — IAS 19 Employer Perspective

### Precondition
- Annual actuarial valuation completed
- Actuary reports: discount rate changed from 4.5% to 4.2% (30bps decrease)
- Impact: DBO increases by $120,000,000 (higher obligation at lower rate)
- This is on the EMPLOYER'S books (not the fund's own GL)

### Input
- Employer Ledger: Corporate Primary Ledger (IAS 19 basis)
- Remeasurement loss due to financial assumption change: $120,000,000

### Expected Journal Entry (IAS 19 — OCI, No Recycling)

| Line | Account | Description | Debit | Credit |
|------|---------|-------------|-------|--------|
| 1 | 8100 | OCI - Remeasurement Loss | $120,000,000 | | Debit OCI (loss) |
| 2 | 2600 | Defined Benefit Obligation | | $120,000,000 | Credit DBO (obligation increased) |

### Validation
- P&L is NOT impacted (IAS 19 requires OCI treatment)
- DBO on balance sheet increases by $120M
- OCI component in equity shows the $120M loss
- This entry NEVER recycles to P&L under IAS 19

### Contrast — ASC 715 Secondary Ledger (if employer also reports US GAAP)

In the secondary (ASC 715) ledger, same $120M sits in AOCI but is subject to corridor amortization:
- 10% corridor = 10% × max(DBO, Plan Assets)
- If DBO = $1.8B, corridor = $180M
- $120M < $180M threshold → NO amortization this year (within corridor)
- If cumulative > $180M in future → excess amortized to P&L over average remaining service life

---

## Scenario 9: Infrastructure Investment Acquisition

### Precondition
- Relecloud Pension Plan acquires a minority stake in an Asia-Pacific infrastructure operator
- Purchase price: AUD $400,000,000
- Settlement through custodian
- AUD/CAD rate at settlement (illustrative): 0.9000

### Input
- CAD equivalent: AUD 400M × 0.9000 = CAD $360,000,000
- Funds from: Cash reserve pool (RESERV)
- Asset classification: Infrastructure (REA), Geography APAC, Pool ILLIQD

### Expected Journal Entry

| Line | Fund | Account | Asset Class | Pool | Geo | Member | Debit | Credit |
|------|------|---------|-------------|------|-----|--------|-------|--------|
| 1 | 011 | 1430 | REA | ILLIQD | APAC | ALL | $360,000,000 | | Infrastructure - Operational |
| 2 | 001 | 1010 | CSH | RESERV | NAM | ALL | | $360,000,000 | Cash - Custodian (CAD) |
| 3 | 001 | 2050 | N/A | N/A | N/A | ALL | | — | Intercompany (if via subsidiary) |

**If routed through Infrastructure LP (Fund 011):**

| Line | Fund | Account | Debit | Credit | Notes |
|------|------|---------|-------|--------|-------|
| 1 | 011 | 1430 | $360,000,000 | | Infra asset in subsidiary |
| 2 | 011 | 3000 | | $360,000,000 | LP equity from main fund |
| 3 | 001 | 1900 | $360,000,000 | | Investment in subsidiary |
| 4 | 001 | 1010 | | $360,000,000 | Cash outflow |

### Validation
- Asset Class = REA (Real Assets), Geography = APAC for the infrastructure asset
- Investment Pool = ILLIQD (infrastructure is illiquid, 10yr+ horizon)
- If via subsidiary (Fund 011): intercompany entries balance between Fund 001 and 011
- IC elimination at consolidation: Fund 099 entries
- FX exposure: AUD asset will be revalued monthly against CAD

---

## Scenario 10: Full Monthly Close — End-to-End Pension Fund

### Precondition
- All June 2026 transaction feeds received and posted
- All statistical journals loaded
- Ready for month-end allocation and close

### Step-by-Step Execution & Expected Outcomes

**Day 1-2: Transaction Processing**

| Step | Action | Expected GL Impact |
|------|--------|-------------------|
| 1 | Import custodian investment feed | Journal lines for trades, income, settlements |
| 2 | Post benefit payment file | $40M debit to benefit expense accounts |
| 3 | Post contribution receipts | $100M credit to contribution revenue (employer + two bi-weekly employee remittances) |
| 4 | Post investment manager trade confirmations | Verify vs custodian (no breaks) |

**Day 3: Statistical Journals & Allocations**

| Step | Action | Expected |
|------|--------|----------|
| 5 | Post stat journals: NAV by class/pool/geo | Accounts 9000-9020 updated |
| 6 | Post stat journals: member counts | Accounts 9100-9130 updated |
| 7 | Post stat journals: AUM by manager | Account 9300 updated |
| 8 | Run PEN_ALLOC_INV_RETURN | Investment income distributed to pools/geos |
| 9 | Verify: all return clearing accounts = 0 | Accounts 5099, 5199, 5299, 5399, 5499 |
| 10 | Run PEN_ALLOC_ADMIN_EXP | Admin expenses split by member class |
| 11 | Verify: admin clearing = 0 | Account 7199 |
| 12 | Run PEN_ALLOC_MGMT_FEES | Fees allocated to asset classes |
| 13 | Verify: fee clearing = 0 | Accounts 7009, 7029, 7039, 7049 |

**Day 4: FX & Adjustments**

| Step | Action | Expected |
|------|--------|----------|
| 14 | Run Revalue Balances (FX) | All non-CAD positions revalued |
| 15 | Verify FX journals created | Account 5360/5400 entries per geography |
| 16 | Post manual adjustments (if any) | Quarter-end PE marks, appraisals |
| 17 | Run intercompany reconciliation | Fund 001 vs 010/011/012 balances match |

**Day 5: Close**

| Step | Action | Expected |
|------|--------|----------|
| 18 | Run final trial balance | All segments balance; total debits = credits |
| 19 | Close period (Jun-26 → Closed) | Period status changes to Closed |
| 20 | Open next period (Jul-26 → Open) | Next period ready for transactions |

### Final Trial Balance Verification (Jun-26 Post-Close)

| Category | Expected | Validation |
|----------|----------|-----------|
| Total Plan Assets (1000-1999) | Prior month ± known movements | Matches custodian month-end statement within tolerance |
| Total Obligations (2000-2999) | Mainly trade and settlement liabilities | Matches pending settlement report |
| Net Assets (3000-3999) | Assets - Liabilities | Assets - Liabilities = Net Assets |
| Contributions YTD (4000-4999) | Sum of monthly receipts | Matches employer remittance schedule |
| Investment Income YTD (5000-5999) | Variable (market-dependent) | Matches custodian performance report |
| Benefit Payments YTD (6000-6999) | Sum of monthly payment files | Matches pension admin disbursement report |
| Admin Expenses YTD (7000-7999) | Within budget envelope | Matches approved budget |
| Clearing Accounts (xx99, xx09) | ALL ZERO | Critical — any non-zero = allocation failure |
| Statistical Accounts (9000-9999) | Updated for Jun-26 | Required for next month's allocation |

### Key Reconciliation Points

| System | Oracle GL Account | Must Match |
|--------|------------------|-----------|
| Custodian | 1000-1799 (all assets) | Custodian month-end statement |
| Pension administration provider | 6000-6090 (benefit payments) | Payment file totals |
| Participating employers | 4000-4300 (contributions) | Remittance schedule |
| Investment Managers | 9300 (AUM stat) | Manager quarterly reports |
| Plan actuary | 2100 (DBO) | Annual/quarterly valuation |

---

## Scenario Execution Checklist

| # | Scenario | Tests | Complexity | Status |
|---|----------|-------|-----------|--------|
| 1 | Employer contribution | Direct journal, CVR validation | Low |  |
| 2 | Employee contribution | Direct journal, remittance reconciliation | Low |  |
| 3 | Benefit payments | Multi-line, member class CVR | Medium |  |
| 4 | PE quarterly mark | Aggregate + allocation by geography | High |  |
| 5 | Equity return by pool | Statistical NAV-weighted allocation | High |  |
| 6 | Admin expense by member | Member count statistical allocation | Medium |  |
| 7 | FX revaluation | ESS revaluation (not allocation) | Medium |  |
| 8 | Actuarial remeasurement (employer) | IAS 19 OCI treatment, dual GAAP | High |  |
| 9 | Infrastructure acquisition | Subsidiary, IC, multi-segment | High |  |
| 10 | Full monthly close | End-to-end integration | Critical |  |
