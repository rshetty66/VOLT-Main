# Oracle ERP Cloud GL — Allocation Rules Step-by-Step Setup

Complete configuration procedure for creating and managing GL allocation rules in Oracle ERP Cloud.

---

## Prerequisites

Before configuring allocation rules, ensure:

| Prerequisite | Verification |
|-------------|--------------|
| Primary Ledger configured | Setup > Financials > GL > Manage Primary Ledgers |
| Chart of Accounts active | All segment values active and combinations enabled |
| Accounting periods open | Period status = Open for target allocation period |
| Source balances posted | All subledger journals and manual journals posted |
| Statistical journals posted (if using stat drivers) | Stat currency enabled; stat account balances loaded |
| Security role assigned | User has "General Accounting Manager" role |

---

## Procedure 1: Create an Allocation Rule

### Navigation
`Setup and Maintenance > Financials > General Ledger > Manage Allocation Rules`

### Steps

**Step 1: Rule Header**

| Field | Action | Example Value |
|-------|--------|---------------|
| Rule Name | Enter unique name | `ALLOC_IT_OVERHEAD_BY_FTE` |
| Description | Describe purpose | "Allocate IT infrastructure costs to cost centers by FTE ratio" |
| Ledger | Select target ledger | `US Primary Ledger` |
| Category | Select journal category | `Allocation` |
| Rule Type | Choose Standard or Summary | `Standard` |
| Status | Defaults to Incomplete until validated | — |

**Rule Types:**
- **Standard**: Allocates from specific account/segment combinations
- **Summary**: Allocates from parent-level (summary) account balances

**Step 2: Point Tab (Source Pool)**

The Point defines WHICH balance to allocate.

| Field | Action | Example Value |
|-------|--------|---------------|
| Amount Type | Select from dropdown | `Actual` |
| Balance Type | Select accumulation | `Period-to-Date` |
| Currency | Ledger currency or Entered | `USD` |
| Rounding Account | Account for rounding differences | `7999-000-0000` |

**Segment Value Ranges (Point Lines):**

Click "+" to add segment value specifications:

| Segment | Low Value | High Value | Include/Exclude |
|---------|-----------|-----------|-----------------|
| Account (Natural Account) | `7100` | `7199` | Include |
| Cost Center | `1000` | `1000` | Include |
| Department | — | — | (all) |
| Entity | `100` | `100` | Include |

This reads: "Take the PTD actual balance of accounts 7100-7199 in Cost Center 1000, Entity 100"

**Step 3: Factor Tab (Allocation Basis)**

The Factor defines HOW to split the pool.

| Field | Action | Example Value |
|-------|--------|---------------|
| Factor Type | Select from dropdown | `Statistical Balance` |
| Amount Type | For stat balance factor | `Actual` |
| Balance Type | For stat balance factor | `Period-to-Date` |

**Factor Segment Values:**

| Segment | Low Value | High Value | Notes |
|---------|-----------|-----------|-------|
| Account | `9900` | `9900` | Statistical account: FTE Count |
| Cost Center | `5001` | `5010` | Target cost centers (factors read from these) |
| Entity | `100` | `100` | Same entity |

This reads: "Use the PTD balance of statistical account 9900 (FTE Count) across cost centers 5001-5010 as the weighting"

**How Factor Calculation Works:**

```
Total FTE across CC 5001-5010 = 150 (sum of stat account 9900)
  CC 5001: FTE = 45  → ratio = 45/150 = 30%
  CC 5002: FTE = 30  → ratio = 30/150 = 20%
  CC 5003: FTE = 25  → ratio = 25/150 = 16.7%
  CC 5005: FTE = 50  → ratio = 50/150 = 33.3%

Pool amount (Account 7100-7199, CC 1000) = $300,000

Allocation:
  CC 5001 receives: $300,000 × 30% = $90,000
  CC 5002 receives: $300,000 × 20% = $60,000
  CC 5003 receives: $300,000 × 16.7% = $50,000
  CC 5005 receives: $300,000 × 33.3% = $100,000
```

**Step 4: Target Tab (Receiving Accounts)**

The Target defines WHERE allocated amounts land.

| Field | Action | Example Value |
|-------|--------|---------------|
| Target Account | Same as point or override | `7100` (same natural account) |

**Target Segment Values:**

| Segment | Low Value | High Value | Notes |
|---------|-----------|-----------|-------|
| Account | `7100` | `7100` | Allocated IT Overhead |
| Cost Center | `5001` | `5010` | Receiving cost centers |
| Entity | `100` | `100` | Same entity |

The target segment range MUST match the factor segment range (same cost centers appear in both).

**Step 5: Offset Tab (Clearing Entry)**

The Offset creates the balancing credit (removes amount from source pool).

| Field | Action | Example Value |
|-------|--------|---------------|
| Offset Method | Same as Point, or Specific | `Specific` |
| Account | Clearing/offset account | `7199` |

**Offset Segment Values (if Specific):**

| Segment | Value | Notes |
|---------|-------|-------|
| Account | `7199` | IT Overhead Clearing |
| Cost Center | `1000` | Same as source CC |
| Entity | `100` | Same entity |

**Step 6: Validate Rule**

Click **Validate** button. Oracle checks:
- Segment value ranges are valid (exist in value sets)
- Account combinations are enabled (not end-dated or disabled)
- Factor segment range matches Target segment range
- No circular references (point and target overlap without offset clearing)

Status changes from `Incomplete` → `Valid` if all checks pass.

---

## Procedure 2: Create an Allocation Rule Set

### Navigation
`Setup and Maintenance > Financials > General Ledger > Manage Allocation Rule Sets`

### Steps

| Field | Action | Example Value |
|-------|--------|---------------|
| Rule Set Name | Enter unique name | `MONTHLY_OVERHEAD_ALLOCATION` |
| Description | Describe purpose | "Monthly overhead allocation - 3 pass step-down" |
| Ledger | Select target ledger | `US Primary Ledger` |

**Add Rules to Rule Set (sequencing):**

| Sequence | Rule Name | Description |
|----------|-----------|-------------|
| 10 | `ALLOC_CORPORATE_OVERHEAD` | Corporate costs to divisions |
| 20 | `ALLOC_IT_OVERHEAD_BY_FTE` | IT costs to cost centers by FTE |
| 30 | `ALLOC_HR_BY_HEADCOUNT` | HR costs to cost centers by headcount |
| 40 | `ALLOC_FACILITIES_BY_SQFT` | Facilities to cost centers by square footage |
| 50 | `ALLOC_SUPPORT_BY_REVENUE` | Support functions to products by revenue |

**Sequencing Rules:**
- Rules execute in sequence order (10, 20, 30...)
- Lower sequence = executes first
- Each rule's output is posted before next rule reads balances
- Gap between sequences (10, 20, 30) allows inserting new rules later

---

## Procedure 3: Run Generate Allocations

### Navigation
`Navigator > Tools > Scheduled Processes`

### Steps

1. Click **Schedule New Process**
2. Search for: `Generate Allocations`
3. Enter parameters:

| Parameter | Value | Notes |
|-----------|-------|-------|
| Ledger | `US Primary Ledger` | Required |
| Rule Set | `MONTHLY_OVERHEAD_ALLOCATION` | Select from LOV |
| Accounting Period | `Jun-26` | Must be Open status |
| Allocation Method | `Standard` | Standard or Summary |
| Amount Type | `Actual` | Actual, Budget, or Encumbrance |
| Balance Type | `Period-to-Date` | PTD, QTD, YTD, PJTD |
| Post Journals | `Yes` | Auto-post generated journals |

4. Click **Submit**
5. Monitor: `Navigator > Tools > Scheduled Processes` → check status

### ESS Job Output

Successful run produces:
- Journal batch with Source = "Allocations"
- Batch name format: `Allocations [Rule Set Name] [Period] [Timestamp]`
- Each rule creates journal lines within the batch
- Journal category = "Allocation"

### Rerun Behavior

If you rerun Generate Allocations for the same period and rule set:
1. Oracle automatically REVERSES the prior allocation journals
2. Creates NEW allocation journals with updated balances/factors
3. Net effect: only the latest allocation is active

This is safe to rerun — no manual reversal needed.

---

## Procedure 4: Load Statistical Journals (Driver Data)

### Purpose
Statistical journals provide non-financial driver data (FTE, sqft, workstations) used as allocation factors.

### Prerequisites
1. Statistical currency exists: `Setup > Financials > Currency > Manage Currencies` → Create currency code `STAT` (type = Statistical)
2. Statistical accounts exist in COA: dedicated account range (e.g., 9900-9999)

### Loading Statistical Data

**Option A: Manual Journal Entry**

`Navigator > General Accounting > Journals > Create Journal`

| Field | Value |
|-------|-------|
| Ledger | US Primary Ledger |
| Category | Statistical |
| Currency | STAT |
| Period | Jun-26 |
| Source | Manual |

Journal Lines:

| Line | Account | Cost Center | Debit (Stat) | Description |
|------|---------|-------------|--------------|-------------|
| 1 | 9900 | 5001 | 45 | FTE Count - Engineering |
| 2 | 9900 | 5002 | 30 | FTE Count - Marketing |
| 3 | 9900 | 5003 | 25 | FTE Count - Finance |
| 4 | 9900 | 5005 | 50 | FTE Count - Operations |
| 5 | 9901 | 5001 | 12000 | Square Footage - Engineering |
| 6 | 9901 | 5002 | 8000 | Square Footage - Marketing |
| 7 | 9901 | 5003 | 5000 | Square Footage - Finance |
| 8 | 9901 | 5005 | 15000 | Square Footage - Operations |

**Option B: FBDI Upload (for bulk data)**

File: `GlInterface.csv` with statistical amounts loaded via "Import Journals" ESS job.

**Option C: Recurring Journal Template**

If driver data is stable, create a recurring journal that auto-generates each period. Update only when drivers change (quarterly, annually).

### Posting Statistical Journals

Statistical journals MUST be posted before running Generate Allocations. The allocation Factor reads POSTED balances only.

---

## Procedure 5: Validate Allocation Results

### After Running Generate Allocations:

**Step 1: Check ESS Job Status**
- `Navigator > Tools > Scheduled Processes`
- Status should be "Succeeded"
- If "Error" or "Warning": click Output to view error details

**Step 2: Review Generated Journals**
- `Navigator > General Accounting > Journals`
- Filter: Source = "Allocations", Period = target period
- Verify: batch exists, journal lines match expected allocation

**Step 3: Verify Trial Balance Impact**
- `Navigator > General Accounting > Trial Balance`
- Check: source pool account balance reduced (offset posted)
- Check: target accounts received allocated amounts
- Check: total debits = total credits (allocation is balanced)

**Step 4: Run Account Analysis**
- `Navigator > General Accounting > Account Analysis`
- Drill into any target account to see allocation journal detail

---

## Configuration Tips

### Naming Conventions

| Object | Convention | Example |
|--------|-----------|---------|
| Rules | `ALLOC_[POOL]_BY_[DRIVER]` | `ALLOC_IT_OVERHEAD_BY_FTE` |
| Rule Sets | `[FREQUENCY]_[GROUP]_ALLOCATION` | `MONTHLY_OVERHEAD_ALLOCATION` |
| Stat Accounts | `99xx` range | `9900` = FTE, `9901` = SqFt |
| Offset Accounts | `[Pool range]99` | `7199` = IT Overhead Clearing |

### Performance Optimization

| Practice | Reason |
|----------|--------|
| Use narrow segment ranges in Point | Reduces balance scan |
| Post stat journals before allocation run | Factor reads posted balances only |
| Run rule sets in order (not all at once) | Each pass needs prior results posted |
| Use PTD (not YTD) when possible | Smaller balance amounts to process |
| Limit rules per rule set to 20 | Easier debugging; modular execution |

### Audit Trail

Oracle maintains full audit trail:
- Journal Source = "Allocations" (filterable)
- Journal Description includes rule name
- Original ESS job ID linked to journal batch
- Reversal journals reference original batch
