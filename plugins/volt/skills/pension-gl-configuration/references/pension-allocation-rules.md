# Oracle ERP Cloud GL — Pension Fund Allocation Rules

Detailed Oracle GL allocation rule configurations specific to large multi-asset pension fund operations. Worked examples use the fictional **Relecloud Pension Plan (RPP)** with round, illustrative figures. All rules use the native Oracle ERP Cloud GL allocation engine (Generate Allocations ESS job).

---

## Allocation Rules Overview

### Rule Sets for Pension Fund Monthly Close

| Rule Set | Execution Order | Purpose | # Rules |
|----------|----------------|---------|---------|
| `PEN_ALLOC_INV_RETURN` | 1st | Allocate investment returns to pools/classes | 8 |
| `PEN_ALLOC_ADMIN_EXP` | 2nd | Allocate administrative expenses to member classes | 5 |
| `PEN_ALLOC_MGMT_FEES` | 3rd | Allocate management fees to asset classes | 4 |
| `PEN_ALLOC_SOLVENCY` | 4th (quarterly) | Allocate to solvency/going-concern reserves | 3 |

### Statistical Journals Required (Load BEFORE Running Allocations)

| Stat Account | Description | Source | Frequency |
|-------------|-------------|--------|-----------|
| 9000 | NAV by Asset Class | Custodian feed | Monthly |
| 9010 | NAV by Investment Pool | Portfolio systems | Monthly |
| 9020 | Unit Holdings by Pool | Unit registry | Monthly |
| 9100-9130 | Member Counts by Class | Pension admin system | Monthly |
| 9200 | FTE Count by Department | HR system | Monthly |
| 9300 | AUM by External Manager | Mandate tracking | Monthly |

---

## Rule Set 1: Investment Return Allocation (`PEN_ALLOC_INV_RETURN`)

### Purpose
Total investment return (income + realized gains + unrealized FV changes) lands initially in aggregate accounts. These rules allocate returns to specific investment pools and geographies based on NAV-weighted proportions.

---

### Rule 1.1: `ALLOC_EQUITY_RETURN_BY_POOL`

**Allocates public equity investment return across investment pools (Active, Factor, Liability-Hedging)**

| Tab | Field | Value |
|-----|-------|-------|
| Header | Rule Name | ALLOC_EQUITY_RETURN_BY_POOL |
| Header | Ledger | RPP Primary Ledger |
| Header | Category | Allocation |
| Point | Amount Type | Actual |
| Point | Balance Type | Period-to-Date |
| Point | Account | 5100 to 5130 (Dividend income - all equity) |
| Point | Asset Class | PEQ |
| Point | Investment Pool | N/A (unallocated) |
| Factor | Factor Type | Statistical Balance |
| Factor | Account | 9010 (NAV by Investment Pool) |
| Factor | Asset Class | PEQ |
| Factor | Investment Pool | ACTIVE to RESERV (all pools) |
| Target | Account | 5100 to 5130 |
| Target | Asset Class | PEQ |
| Target | Investment Pool | ACTIVE to RESERV |
| Offset | Account | 5199 (Equity Return Clearing) |
| Offset | Asset Class | PEQ |
| Offset | Investment Pool | N/A |

**How it works:**
```
Total PEQ dividend income (unallocated) = $24,000,000

NAV by pool (from stat account 9010, Asset Class = PEQ):
  ACTIVE: $1.8B  → 60%
  FACTOR: $750M  → 25%
  LIABHG: $300M  → 10%
  RESERV: $150M  → 5%
  Total PEQ NAV: $3B

Allocation:
  ACTIVE: $24M × 60% = $14,400,000
  FACTOR: $24M × 25% = $6,000,000
  LIABHG: $24M × 10% = $2,400,000
  RESERV: $24M × 5%  = $1,200,000
```

---

### Rule 1.2: `ALLOC_EQUITY_REALIZED_GL_BY_POOL`

**Same pattern as 1.1 but for realized gains/losses (Account 5210)**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 5210 (Realized G/L - Public Equities) |
| Point | Asset Class | PEQ |
| Factor | Same as Rule 1.1 (NAV-weighted) |
| Target | Account 5210, Asset Class PEQ, Pool ACTIVE-RESERV |
| Offset | Account 5299 (Realized G/L Clearing) |

---

### Rule 1.3: `ALLOC_EQUITY_UNREALIZED_BY_POOL`

**Unrealized fair value changes (Account 5310) allocated by pool NAV**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 5310 (Unrealized FV Change - Public Equities) |
| Point | Asset Class | PEQ |
| Factor | Same NAV-weighted basis |
| Target | Account 5310, Pool ACTIVE-RESERV |
| Offset | Account 5399 (Unrealized FV Clearing) |

---

### Rule 1.4: `ALLOC_FI_RETURN_BY_POOL`

**Fixed income interest and returns allocated across pools by FI NAV**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 5000 to 5020 (Interest income - FI) |
| Point | Asset Class | FIX |
| Factor | Factor Type | Statistical Balance |
| Factor | Account | 9010 (NAV by Pool) |
| Factor | Asset Class | FIX |
| Target | Same accounts, Asset Class FIX, Pool range |
| Offset | Account 5099 (FI Return Clearing) |

---

### Rule 1.5: `ALLOC_PE_DISTRIBUTIONS_BY_GEO`

**Private equity distributions and realizations allocated by geography**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 5140 (PE Distributions & Realizations) |
| Point | Asset Class | PRI |
| Point | Geography | GLB (lands as global initially) |
| Factor | Factor Type | Statistical Balance |
| Factor | Account | 9000 (NAV by Asset Class) |
| Factor | Asset Class | PRI |
| Factor | Geography | NAM to EMG (all geographies) |
| Target | Account 5140, Asset Class PRI, Geography NAM-EMG |
| Offset | Account 5149 (PE Distribution Clearing), Geo GLB |

---

### Rule 1.6: `ALLOC_RE_INCOME_BY_GEO`

**Real estate rental income allocated by geography (based on property NAV)**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 5160 (Real Estate Rental Income Net) |
| Point | Asset Class | REA |
| Factor | Statistical Balance - NAV by geography (account 9000, class REA) |
| Target | Account 5160, Asset Class REA, Geography NAM-EMG |
| Offset | Account 5169 (RE Income Clearing) |

---

### Rule 1.7: `ALLOC_INFRA_INCOME_BY_GEO`

**Infrastructure operating income by geography**

Same pattern as Rule 1.6 using Account 5150 and infrastructure NAV weights.

---

### Rule 1.8: `ALLOC_FX_GAINS_BY_GEO`

**FX gains/losses allocated by geography based on non-CAD NAV exposure**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 5400 to 5420 (FX gains/losses) |
| Point | Geography | GLB (lands as global) |
| Factor | Statistical Balance |
| Factor | Account | 9000 (NAV) |
| Factor | Geography | EUR, APAC, EMG (non-CAD geographies only) |
| Target | Account 5400-5420, Geography EUR/APAC/EMG |
| Offset | Account 5499 (FX Clearing), Geography GLB |

---

## Rule Set 2: Administrative Expense Allocation (`PEN_ALLOC_ADMIN_EXP`)

### Purpose
Pension administration costs allocated to member classes (Active, Deferred, Pensioner, Survivor) based on member counts.

---

### Rule 2.1: `ALLOC_PENSION_ADMIN_BY_MEMBER`

**Pension administration expenses allocated by member count**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7100 to 7130 (Pension admin, actuarial, audit, regulatory) |
| Point | Member Class | ALL (undifferentiated) |
| Factor | Factor Type | Statistical Balance |
| Factor | Account | 9100 to 9130 (Member counts by class) |
| Factor | Member Class | ACT to SUR |
| Target | Account 7100-7130, Member Class ACT/DEF/PEN/SUR |
| Offset | Account 7199 (Admin Clearing), Member Class ALL |

**Calculation:**
```
Total pension admin expenses (Member Class = ALL) = $4,500,000

Member counts (from stat accounts):
  ACT (Active):    60,000 members → 60%
  DEF (Deferred):  15,000 members → 15%
  PEN (Pensioner): 20,000 members → 20%
  SUR (Survivor):   5,000 members → 5%
  Total:          100,000

Allocation:
  ACT: $4.5M × 60% = $2,700,000
  DEF: $4.5M × 15% = $675,000
  PEN: $4.5M × 20% = $900,000
  SUR: $4.5M × 5%  = $225,000
```

---

### Rule 2.2: `ALLOC_STAFF_COMP_BY_DEPT`

**Internal staff compensation allocated from cost pool to departments by FTE**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7200-7250 (Staff costs) |
| Point | Investment Pool | N/A (corporate cost center) |
| Factor | Statistical Balance (FTE by department, account 9200) |
| Target | Account 7200-7250, distributed across Investment Pool segments |
| Offset | Account 7299, Investment Pool N/A |

---

### Rule 2.3: `ALLOC_TECH_COSTS_BY_USAGE`

**Technology costs allocated by transaction count**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7230 (Technology & Systems) |
| Factor | Statistical Balance (Transaction count, account 9400) |
| Target | Account 7230 across pools |
| Offset | Account 7239 (Tech Clearing) |

---

### Rule 2.4: `ALLOC_OCCUPANCY_BY_FTE`

**Office costs allocated by FTE (same as corporate overhead allocation)**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7240 (Office & Occupancy) |
| Factor | Statistical Balance (FTE, account 9200) |
| Target | Distributed by department |
| Offset | Account 7249 (Occupancy Clearing) |

---

### Rule 2.5: `ALLOC_DEPR_AMORT_BY_USAGE`

**Depreciation allocated to investment vs administration**

Fixed ratio: 70% to investment activities, 30% to pension administration.

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7300 (Depreciation & Amortization) |
| Factor | Factor Type | Fixed Amount |
| Factor Lines | Investment = 70, Administration = 30 |
| Target | Account 7300 split by activity |
| Offset | Account 7399 (Depr Clearing) |

---

## Rule Set 3: Management Fee Allocation (`PEN_ALLOC_MGMT_FEES`)

### Purpose
External management fees and performance fees allocated to asset classes based on AUM per manager.

---

### Rule 3.1: `ALLOC_EXT_MGMT_FEES_BY_CLASS`

**External management fees allocated by AUM per asset class**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7000 (External Management Fees) |
| Point | Asset Class | N/A (unallocated) |
| Factor | Statistical Balance (AUM by manager, account 9300, mapped to asset class) |
| Target | Account 7000, Asset Class PEQ/PRI/REA/CRD/FIX/ABS |
| Offset | Account 7009 (Mgmt Fee Clearing), Asset Class N/A |

---

### Rule 3.2: `ALLOC_PERF_FEES_BY_CLASS`

**Performance fees / carried interest by asset class**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7020 (Performance Fees / Carried Interest) |
| Factor | Statistical Balance (AUM by asset class, account 9000) |
| Target | Account 7020 across asset classes |
| Offset | Account 7029 (Perf Fee Clearing) |

---

### Rule 3.3: `ALLOC_CUSTODY_FEES_BY_NAV`

**Custody fees allocated by total NAV per asset class**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7030 (Custody & Safekeeping) |
| Factor | Statistical Balance (NAV, account 9000) |
| Target | Account 7030 across asset classes |
| Offset | Account 7039 (Custody Clearing) |

---

### Rule 3.4: `ALLOC_TXN_COSTS_BY_VOLUME`

**Transaction costs (brokerage) allocated by transaction count per pool**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7040 (Transaction Costs) |
| Factor | Statistical Balance (Transaction count, account 9400) |
| Target | Account 7040 across pools |
| Offset | Account 7049 (Txn Cost Clearing) |

---

## Rule Set 4: Solvency Reserve Allocation (`PEN_ALLOC_SOLVENCY`)

### Purpose
Quarterly allocation of amounts to/from solvency and going-concern reserves based on funded status.

**Run frequency:** Quarterly (not monthly)

---

### Rule 4.1: `ALLOC_SOLVENCY_RESERVE`

**Transfer to solvency reserve based on deficit/surplus**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 3100 (Increase in Net Assets - Current Year) |
| Factor | Factor Type | Specific |
| Factor | Specific Amount | Calculated externally (actuary input) |
| Target | Account 3300 (Actuarial Reserve - Solvency) |
| Offset | Account 3100 (Net Assets adjustment) |

**Note:** The specific amount comes from the actuary's solvency calculation. This is loaded as a manual parameter or pre-determined before the allocation run. In practice, the plan's appointed actuary determines it from the quarterly solvency ratio.

---

### Rule 4.2: `ALLOC_GOING_CONCERN_RESERVE`

**Transfer to going-concern reserve**

Same structure as 4.1 but targets Account 3200 (Going-Concern Reserve).

---

### Rule 4.3: `ALLOC_RATE_STABILIZATION`

**Rate stabilization reserve allocation (smooths contribution rate volatility)**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 3100 |
| Factor | Factor Type | Specific |
| Factor | Amount | Per contribution rate stabilization policy |
| Target | Account 3500 (Rate Stabilization Reserve) |
| Offset | Account 3100 |

---

## Execution Procedure — Monthly Pension Fund Allocation Run

### Step-by-Step

| Step | Action | ESS Job | Timing |
|------|--------|---------|--------|
| 1 | Post all custodian investment feeds | N/A (FBDI import) | Day 1-2 |
| 2 | Post statistical journals (NAV, member counts, AUM, txn counts) | N/A (manual or interface) | Day 3 |
| 3 | Verify stat journal balances | Run Trial Balance (stat accounts) | Day 3 |
| 4 | Run investment return allocation | Generate Allocations: PEN_ALLOC_INV_RETURN | Day 3 |
| 5 | Verify: check investment income by pool/geo | Journal inquiry: Source=Allocations | Day 3 |
| 6 | Run admin expense allocation | Generate Allocations: PEN_ALLOC_ADMIN_EXP | Day 3 |
| 7 | Run management fee allocation | Generate Allocations: PEN_ALLOC_MGMT_FEES | Day 3 |
| 8 | Verify: all clearing accounts net to zero | Trial Balance: accounts ending x99/x09 | Day 3 |
| 9 | (Quarterly only) Run solvency allocation | Generate Allocations: PEN_ALLOC_SOLVENCY | Day 5 |
| 10 | Final trial balance review | Full TB report | Day 5 |

### Critical Validation After Allocation

| Check | Expected | Action if Failed |
|-------|----------|-----------------|
| All clearing accounts (xx99, xx09) | Net zero balance | Investigate: rule likely failed or partial execution |
| Total investment income | Unchanged (allocations are redistribution, not creation) | Check for missing rules or double-counting |
| Asset class breakdown | Matches custodian asset class totals | Verify stat journal NAV accuracy |
| Geography breakdown | Matches custodian geography report | Check geography segment assignments |
| Member class allocation | Matches headcount proportions | Verify member count stat journals |
