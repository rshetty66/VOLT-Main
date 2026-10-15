# Oracle ERP Cloud GL — Allocation Formula Types & Syntax

Reference for all allocation factor types, balance type behavior, and multi-step allocation patterns in Oracle ERP Cloud General Ledger.

---

## Factor Types (Allocation Basis)

Oracle ERP Cloud GL supports four factor types for determining how to split an allocation pool:

### 1. Relative Amount

**How it works:** Each target segment's share is calculated as its OWN balance divided by the TOTAL balance across all target segments.

**When to use:** The target segments already have financial balances that represent their "fair share" (e.g., allocate corporate costs by each division's revenue).

**Configuration:**

| Factor Tab Field | Value |
|-----------------|-------|
| Factor Type | Relative Amount |
| Amount Type | Actual (or Budget) |
| Balance Type | Year-to-Date (typically) |
| Account | Revenue account range (e.g., 4000-4999) |
| Segments | Target cost centers or entities |

**Calculation Example:**

```
Pool: Corporate Overhead = $1,000,000 (Account 7000, CC 0001)

Factor: Revenue balances (YTD Actual, Account 4000-4999) per target CC:
  CC 5001 (Engineering):  Revenue = $5,000,000  → 50%
  CC 5002 (Marketing):    Revenue = $2,000,000  → 20%
  CC 5003 (Finance):      Revenue = $1,000,000  → 10%
  CC 5005 (Operations):   Revenue = $2,000,000  → 20%
  TOTAL:                             $10,000,000

Allocation:
  CC 5001: $1,000,000 × 50% = $500,000
  CC 5002: $1,000,000 × 20% = $200,000
  CC 5003: $1,000,000 × 10% = $100,000
  CC 5005: $1,000,000 × 20% = $200,000
```

---

### 2. Statistical Balance

**How it works:** Allocation ratios come from statistical journal balances (non-monetary quantities like FTE, sqft, transactions).

**When to use:** Financial balances don't represent fair share — need operational drivers.

**Configuration:**

| Factor Tab Field | Value |
|-----------------|-------|
| Factor Type | Statistical Balance |
| Amount Type | Actual |
| Balance Type | Period-to-Date |
| Account | Statistical account (e.g., 9900 = FTE Count) |
| Currency | STAT |
| Segments | Target cost centers |

**Calculation Example:**

```
Pool: IT Infrastructure = $600,000 (Account 7100, CC 1000)

Factor: Statistical account 9901 (Workstation Count), PTD:
  CC 5001: Workstations = 120  → 40%
  CC 5002: Workstations = 60   → 20%
  CC 5003: Workstations = 30   → 10%
  CC 5005: Workstations = 90   → 30%
  TOTAL:                   300

Allocation:
  CC 5001: $600,000 × 40% = $240,000
  CC 5002: $600,000 × 20% = $120,000
  CC 5003: $600,000 × 10% = $60,000
  CC 5005: $600,000 × 30% = $180,000
```

---

### 3. Fixed Amount

**How it works:** Predetermined ratios or fixed dollar amounts per target — not derived from any balance.

**When to use:** Allocation percentages are contractually defined or management-directed (not data-driven).

**Configuration:**

| Factor Tab Field | Value |
|-----------------|-------|
| Factor Type | Fixed Amount |

**Factor Lines (entered directly):**

| Target Segment Value | Fixed Amount/Ratio |
|---------------------|-------------------|
| CC 5001 | 40 |
| CC 5002 | 25 |
| CC 5003 | 15 |
| CC 5005 | 20 |
| TOTAL | 100 |

Ratios are treated as proportions (40/100 = 40%).

---

### 4. Specific

**How it works:** Explicit dollar amounts allocated to each target — no ratio calculation.

**When to use:** Management dictates exact amounts to each recipient (e.g., transfer pricing adjustments).

**Configuration:**

| Factor Tab Field | Value |
|-----------------|-------|
| Factor Type | Specific |

**Factor Lines:**

| Target Segment Value | Specific Amount |
|---------------------|----------------|
| CC 5001 | $250,000 |
| CC 5002 | $150,000 |
| CC 5003 | $100,000 |

Pool balance is NOT used — exact amounts are allocated regardless of pool size.

---

## Balance Type Behavior

The Balance Type determines what period range of data is read for both Point (pool) and Factor (basis):

| Balance Type | What It Reads | Typical Use |
|-------------|---------------|-------------|
| **Period-to-Date (PTD)** | Current period's net activity only | Monthly incremental allocations |
| **Quarter-to-Date (QTD)** | Cumulative from quarter start to current period | Quarterly true-up allocations |
| **Year-to-Date (YTD)** | Cumulative from fiscal year start to current period | Annual allocations, revenue-share basis |
| **Project-to-Date (PJTD)** | Cumulative since account inception | Lifetime allocations (rare in GL) |

### PTD vs YTD — Impact on Results

```
Example: Allocate IT costs by revenue share

SCENARIO A (PTD — June only):
  June Revenue: CC 5001 = $800K, CC 5002 = $200K → 80/20 split
  June IT Cost Pool = $100K
  Allocation: CC 5001 = $80K, CC 5002 = $20K

SCENARIO B (YTD — Jan through June):
  YTD Revenue: CC 5001 = $4M, CC 5002 = $3M → 57/43 split
  June IT Cost Pool (PTD) = $100K
  Allocation: CC 5001 = $57K, CC 5002 = $43K
```

**Key Difference:** YTD smooths seasonal volatility. PTD reflects current-period reality.

**Best Practice:** Use PTD for the Point (allocate only this period's costs) and YTD for the Factor (stable driver ratios over time). Oracle allows different balance types on Point vs Factor.

---

## Amount Type Behavior

| Amount Type | What It Reads | Use Case |
|-------------|---------------|----------|
| **Actual** | Posted actual journal balances | Standard month-end cost allocation |
| **Budget** | Budget journal balances | Allocate budgeted costs for planning |
| **Encumbrance** | Encumbrance (commitment) balances | Allocate committed but not yet spent |

Mixing: Point can be Actual while Factor reads Budget (e.g., allocate actual costs using budgeted proportions as drivers).

---

## Multi-Step Allocation Patterns

### Pattern 1: Three-Pass Step-Down (Corporate → Shared Services → Products)

```
PASS 1 — Corporate Overhead to Divisions
┌─────────────────────────────────────────────────────┐
│ Rule Set: ALLOC_PASS1_CORPORATE                      │
│                                                      │
│ Pool: Accounts 7000-7049 (CEO, Legal, Board)         │
│       in CC 0001 (Corporate)                         │
│                                                      │
│ Factor: YTD Revenue per Division (Relative Amount)   │
│                                                      │
│ Target: Same accounts, CC 2001-2005 (Divisions)      │
│ Offset: Account 7049, CC 0001 (Corp Clearing)        │
└─────────────────────────────────────────────────────┘
         │ POST journals from Pass 1

PASS 2 — Shared Services to Cost Centers
┌─────────────────────────────────────────────────────┐
│ Rule Set: ALLOC_PASS2_SHARED_SERVICES                │
│                                                      │
│ Rule 1: IT (CC 1000) → Target CCs by Workstations   │
│ Rule 2: HR (CC 1001) → Target CCs by FTE            │
│ Rule 3: Facilities (CC 1002) → Target CCs by SqFt   │
│ Rule 4: Finance (CC 1003) → Target CCs by Txn Count │
│                                                      │
│ (Each rule uses Statistical Balance factor)          │
└─────────────────────────────────────────────────────┘
         │ POST journals from Pass 2

PASS 3 — Support Functions to Products/Customers
┌─────────────────────────────────────────────────────┐
│ Rule Set: ALLOC_PASS3_PRODUCTS                       │
│                                                      │
│ Pool: All expenses in CC 5001-5010                   │
│       (now includes Pass 1 + Pass 2 allocated costs) │
│                                                      │
│ Factor: Product revenue (Relative Amount)            │
│                                                      │
│ Target: Same accounts, Product segment values        │
│ Offset: CC 5xxx Clearing accounts                    │
└─────────────────────────────────────────────────────┘
```

**Execution Order:**
1. Run `ALLOC_PASS1_CORPORATE` → Submit & Post
2. Run `ALLOC_PASS2_SHARED_SERVICES` → Submit & Post
3. Run `ALLOC_PASS3_PRODUCTS` → Submit & Post

Pass 3 reads balances that INCLUDE Pass 1 and Pass 2 results (fully loaded).

---

### Pattern 2: Reciprocal Allocation (IT <-> HR)

Oracle GL doesn't have native reciprocal (simultaneous equation) solving. Approximate with iterative passes:

```
PASS 1: Allocate IT to all CCs (including HR)
PASS 2: Allocate HR to all CCs (including IT)
PASS 3: Re-allocate IT (now includes HR's allocation back)
PASS 4: Re-allocate HR (now includes IT's re-allocation)
... (iterate until amounts are immaterial — usually 3-4 passes)
```

Each pass reduces the residual. After 4 iterations, remaining unallocated amounts are typically <0.1% of original pool.

---

### Pattern 3: Monthly Incremental + Quarterly True-Up

```
Monthly: Run PTD allocation (allocate only this month's costs)
Quarterly: Run YTD allocation with full reversal, then YTD reallocation

Quarter-end procedure:
  1. Reverse all 3 monthly PTD allocations for Q1 (Jan, Feb, Mar)
  2. Run single YTD allocation through Mar (captures full Q1)
  3. Difference = true-up adjustment

Oracle's auto-reversal on rerun handles this:
  - Rerun the YTD rule set for Mar period
  - It reverses prior and recalculates with full Q1 balances
```

---

## Rounding Handling

When allocation percentages don't divide evenly:

| Scenario | Behavior |
|----------|----------|
| Pool = $100, 3 targets at 33.33% each | Two targets get $33.33, one gets $33.34 |
| Rounding Account specified | Difference ($0.01) posts to rounding account |
| Rounding Account blank | Difference assigned to LAST target in sequence |

**Best Practice:** Always specify a Rounding Account on the Point tab (typically a miscellaneous expense account).

---

## Currency Handling

| Scenario | Behavior |
|----------|----------|
| Single-currency ledger | Straightforward — all in ledger currency |
| Multi-currency ledger (entered vs functional) | Allocation uses FUNCTIONAL currency balances |
| Reporting Currency attached | Allocation journals auto-translate to reporting currency |
| Statistical currency (STAT) | Factors read STAT balances; allocation creates functional currency journals |

Allocations always create journals in the **ledger's functional currency**. If source journals were entered in foreign currency, the allocation reads the translated (functional) amount.

---

## Validation Rules

Oracle validates allocation rules before allowing execution:

| Validation | What It Checks | Error If Failed |
|-----------|----------------|-----------------|
| Segment ranges exist | All Low-High values are valid in value sets | "Invalid segment value" |
| Combinations enabled | Target account combinations are not end-dated | "Account combination disabled" |
| Factor matches Target | Factor segment range aligns with Target range | "Factor/Target mismatch" |
| No circular reference | Point segments don't fully overlap Target without offset | "Circular allocation detected" |
| Ledger consistency | Rule ledger matches Rule Set ledger | "Ledger mismatch" |
| Period open | Target period is in Open status | "Period not open for posting" |
