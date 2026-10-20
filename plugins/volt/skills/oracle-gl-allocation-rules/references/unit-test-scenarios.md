# Oracle ERP Cloud GL Allocation Rules — Unit Test Scenarios

Eight complete test scenarios for validating GL allocation rule configuration. Each scenario specifies preconditions, configuration, inputs, expected outputs, and validation steps suitable for UAT execution.

---

## Scenario 1: Basic Overhead Allocation by FTE

### Precondition
- Ledger: `CA Primary Ledger` (CAD functional currency)
- COA: Company-Account-CostCenter-Department-Intercompany
- Statistical account 9900 (FTE Count) loaded for Jun-26
- IT Overhead balance exists in Account 7100, CC 1000

### Configuration

**Rule: `ALLOC_IT_BY_FTE`**

| Tab | Field | Value |
|-----|-------|-------|
| Header | Rule Name | ALLOC_IT_BY_FTE |
| Header | Ledger | CA Primary Ledger |
| Header | Category | Allocation |
| Point | Amount Type | Actual |
| Point | Balance Type | Period-to-Date |
| Point | Account | 7100 to 7100 |
| Point | Cost Center | 1000 to 1000 |
| Factor | Factor Type | Statistical Balance |
| Factor | Amount Type | Actual |
| Factor | Balance Type | Period-to-Date |
| Factor | Account | 9900 to 9900 |
| Factor | Cost Center | 5001 to 5004 |
| Target | Account | 7100 to 7100 |
| Target | Cost Center | 5001 to 5004 |
| Offset | Method | Specific |
| Offset | Account | 7199 |
| Offset | Cost Center | 1000 |

### Input (GL Balances Before Allocation)

| Account | Cost Center | PTD Balance | Description |
|---------|-------------|-------------|-------------|
| 7100 | 1000 | $500,000 DR | IT Infrastructure Overhead |
| 9900 (STAT) | 5001 | 45 | FTE - Engineering |
| 9900 (STAT) | 5002 | 30 | FTE - Marketing |
| 9900 (STAT) | 5003 | 15 | FTE - Finance |
| 9900 (STAT) | 5004 | 60 | FTE - Operations |

Total FTE = 150

### Action
- Run ESS: Generate Allocations
- Parameters: Ledger=CA Primary, Rule Set=MONTHLY_IT_ALLOC, Period=Jun-26, Amount Type=Actual, Balance Type=PTD, Post=Yes

### Expected Output (Journal Entry Created)

| Line | Account | Cost Center | Debit | Credit | Description |
|------|---------|-------------|-------|--------|-------------|
| 1 | 7100 | 5001 | $150,000 | | IT Alloc - Engineering (45/150 = 30%) |
| 2 | 7100 | 5002 | $100,000 | | IT Alloc - Marketing (30/150 = 20%) |
| 3 | 7100 | 5003 | $50,000 | | IT Alloc - Finance (15/150 = 10%) |
| 4 | 7100 | 5004 | $200,000 | | IT Alloc - Operations (60/150 = 40%) |
| 5 | 7199 | 1000 | | $500,000 | IT Overhead Clearing |

### Validation
- Journal Source = "Allocations"
- Total Debits ($500,000) = Total Credits ($500,000)
- Trial Balance: Account 7100 CC 1000 net PTD reduced by $500K offset
- Trial Balance: Account 7100 CC 5001 increased by $150K
- Account Analysis on 7100/5001 shows allocation journal

---

## Scenario 2: Revenue-Based Relative Amount Allocation

### Precondition
- Same ledger and COA as Scenario 1
- Revenue balances exist YTD in Account 4000 across entities
- Corporate overhead to allocate: Account 7000, Entity 001

### Configuration

**Rule: `ALLOC_CORP_BY_REVENUE`**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Amount Type | Actual |
| Point | Balance Type | Period-to-Date |
| Point | Account | 7000 to 7000 |
| Point | Entity | 001 to 001 |
| Factor | Factor Type | Relative Amount |
| Factor | Amount Type | Actual |
| Factor | Balance Type | Year-to-Date |
| Factor | Account | 4000 to 4999 |
| Factor | Entity | 100 to 105 |
| Target | Account | 7000 to 7000 |
| Target | Entity | 100 to 105 |
| Offset | Account | 7099 |
| Offset | Entity | 001 |

### Input

| Account | Entity | Balance | Description |
|---------|--------|---------|-------------|
| 7000 | 001 | $1,200,000 DR (PTD) | Corporate Overhead - June |
| 4000-4999 | 100 | $15,000,000 CR (YTD) | Revenue - Division A |
| 4000-4999 | 101 | $10,000,000 CR (YTD) | Revenue - Division B |
| 4000-4999 | 102 | $5,000,000 CR (YTD) | Revenue - Division C |
| 4000-4999 | 103 | $8,000,000 CR (YTD) | Revenue - Division D |
| 4000-4999 | 104 | $7,000,000 CR (YTD) | Revenue - Division E |
| 4000-4999 | 105 | $5,000,000 CR (YTD) | Revenue - Division F |

Total YTD Revenue = $50,000,000

### Expected Output

| Line | Account | Entity | Debit | Credit | Ratio |
|------|---------|--------|-------|--------|-------|
| 1 | 7000 | 100 | $360,000 | | 15M/50M = 30% |
| 2 | 7000 | 101 | $240,000 | | 10M/50M = 20% |
| 3 | 7000 | 102 | $120,000 | | 5M/50M = 10% |
| 4 | 7000 | 103 | $192,000 | | 8M/50M = 16% |
| 5 | 7000 | 104 | $168,000 | | 7M/50M = 14% |
| 6 | 7000 | 105 | $120,000 | | 5M/50M = 10% |
| 7 | 7099 | 001 | | $1,200,000 | Offset (clearing) |

### Validation
- Sum of allocations = $1,200,000 (matches pool)
- YTD revenue ratios correctly calculated
- Entity 001 has clearing entry (no longer holds overhead balance)

---

## Scenario 3: Fixed Ratio Allocation

### Precondition
- Board costs in Account 7010, CC 0001 = $300,000
- Management has directed: allocate equally to 3 major divisions

### Configuration

**Rule: `ALLOC_BOARD_EQUAL_SPLIT`**

| Tab | Field | Value |
|-----|-------|-------|
| Point | Account | 7010 to 7010, CC 0001 |
| Factor | Factor Type | Fixed Amount |
| Factor Lines | CC 2001 = 1, CC 2002 = 1, CC 2003 = 1 |
| Target | Account 7010, CC 2001-2003 |
| Offset | Account 7019, CC 0001 |

### Input

| Account | CC | PTD Balance |
|---------|-----|-------------|
| 7010 | 0001 | $300,000 DR |

### Expected Output

| Line | Account | CC | Debit | Credit |
|------|---------|-----|-------|--------|
| 1 | 7010 | 2001 | $100,000 | | Equal 1/3 |
| 2 | 7010 | 2002 | $100,000 | | Equal 1/3 |
| 3 | 7010 | 2003 | $100,000 | | Equal 1/3 |
| 4 | 7019 | 0001 | | $300,000 | Clearing |

### Validation
- Each division receives exactly 1/3
- No rounding difference (divisible by 3)
- Fixed ratios not affected by any balance changes

---

## Scenario 4: Multi-Step Allocation (Step-Down, 2 Passes)

### Precondition
- Pass 1 allocates corporate overhead to shared service centers
- Pass 2 allocates shared service costs (including received overhead) to business lines

### Configuration

**Rule Set: `ALLOC_STEPDOWN_Q2`** (Sequence: Rule 1 at seq 10, Rule 2 at seq 20)

**Rule 1: `ALLOC_CORP_TO_SHARED`** (Seq 10)
- Point: Account 7000, CC 0001 (Corporate) = $200,000
- Factor: Fixed (IT=40%, HR=30%, Finance=30%)
- Target: Account 7000, CC 1000/1001/1002
- Offset: Account 7099, CC 0001

**Rule 2: `ALLOC_SHARED_TO_BU`** (Seq 20)
- Point: Account 7000-7199, CC 1000-1002 (all shared service costs)
- Factor: Statistical Balance (FTE, account 9900, CC 5001-5004)
- Target: Account 7200, CC 5001-5004
- Offset: Account 7299, CC 1000-1002

### Input (Before Any Allocation)

| Account | CC | PTD Balance | Description |
|---------|-----|-------------|-------------|
| 7000 | 0001 | $200,000 DR | Corporate overhead |
| 7100 | 1000 | $400,000 DR | IT own costs |
| 7101 | 1001 | $250,000 DR | HR own costs |
| 7102 | 1002 | $180,000 DR | Finance own costs |
| 9900 (STAT) | 5001 | 50 | FTE count |
| 9900 (STAT) | 5002 | 30 | FTE count |
| 9900 (STAT) | 5003 | 20 | FTE count |
| 9900 (STAT) | 5004 | 100 | FTE count |

Total FTE = 200

### Expected Output — Pass 1 (Rule at Seq 10)

| Line | Account | CC | Debit | Credit |
|------|---------|-----|-------|--------|
| 1 | 7000 | 1000 | $80,000 | | Corp to IT (40%) |
| 2 | 7000 | 1001 | $60,000 | | Corp to HR (30%) |
| 3 | 7000 | 1002 | $60,000 | | Corp to Finance (30%) |
| 4 | 7099 | 0001 | | $200,000 | Clearing |

### After Pass 1 — Shared Services Balances:

| CC | Own Costs | + Allocated Corp | Total |
|----|-----------|-----------------|-------|
| 1000 (IT) | $400,000 | + $80,000 | $480,000 |
| 1001 (HR) | $250,000 | + $60,000 | $310,000 |
| 1002 (Finance) | $180,000 | + $60,000 | $240,000 |
| **TOTAL** | | | **$1,030,000** |

### Expected Output — Pass 2 (Rule at Seq 20)

Allocated by FTE: 50/200=25%, 30/200=15%, 20/200=10%, 100/200=50%

| Line | Account | CC | Debit | Credit |
|------|---------|-----|-------|--------|
| 1 | 7200 | 5001 | $257,500 | | 25% of $1,030,000 |
| 2 | 7200 | 5002 | $154,500 | | 15% of $1,030,000 |
| 3 | 7200 | 5003 | $103,000 | | 10% of $1,030,000 |
| 4 | 7200 | 5004 | $515,000 | | 50% of $1,030,000 |
| 5 | 7299 | 1000 | | $480,000 | Clear IT |
| 6 | 7299 | 1001 | | $310,000 | Clear HR |
| 7 | 7299 | 1002 | | $240,000 | Clear Finance |

### Validation
- Pass 2 pool ($1,030,000) = shared services own costs ($830K) + corporate allocation ($200K)
- Business lines receive fully loaded costs
- All clearing accounts net to zero

---

## Scenario 5: Period-to-Date vs Year-to-Date Comparison

### Precondition
- Same allocation rule run with PTD vs YTD Balance Type
- Demonstrates different outcomes

### Input

**Pool (Account 7100, CC 1000):**
- June PTD = $100,000
- June YTD (Jan-Jun cumulative) = $580,000

**Factor (Revenue, Account 4000):**
- June PTD: CC 5001 = $800K, CC 5002 = $200K (80/20)
- June YTD: CC 5001 = $3M, CC 5002 = $2.5M (55/45)

### Expected Output — PTD Run

| CC | Allocation | Ratio |
|----|-----------|-------|
| 5001 | $80,000 | 80% (June revenue dominance) |
| 5002 | $20,000 | 20% |

### Expected Output — YTD Run

| CC | Allocation | Ratio |
|----|-----------|-------|
| 5001 | $319,000 | 55% (smoothed over 6 months) |
| 5002 | $261,000 | 45% |

### Validation
- PTD reflects current-month volatility
- YTD smooths seasonal patterns
- Both are valid; choice depends on business policy

---

## Scenario 6: Allocation Rerun (Auto-Reversal)

### Precondition
- Scenario 1 was already run for Jun-26 (allocation journals posted)
- Statistical FTE data was corrected (CC 5001 changed from 45 to 55 FTE)
- Need to rerun with corrected data

### Action
1. Correct statistical journal: reverse line for CC 5001 (45), post new line (55)
2. Rerun Generate Allocations with same parameters

### Expected Output

**Step 1: Oracle auto-reverses prior allocation:**

| Line | Account | CC | Debit | Credit | Description |
|------|---------|-----|-------|--------|-------------|
| 1 | 7199 | 1000 | $500,000 | | Reverse prior offset |
| 2 | 7100 | 5001 | | $150,000 | Reverse prior alloc |
| 3 | 7100 | 5002 | | $100,000 | Reverse prior alloc |
| 4 | 7100 | 5003 | | $50,000 | Reverse prior alloc |
| 5 | 7100 | 5004 | | $200,000 | Reverse prior alloc |

**Step 2: Oracle creates new allocation with corrected FTE:**

New FTE: 55 + 30 + 15 + 60 = 160

| Line | Account | CC | Debit | Credit | Ratio |
|------|---------|-----|-------|--------|-------|
| 1 | 7100 | 5001 | $171,875 | | 55/160 = 34.4% |
| 2 | 7100 | 5002 | $93,750 | | 30/160 = 18.75% |
| 3 | 7100 | 5003 | $46,875 | | 15/160 = 9.375% |
| 4 | 7100 | 5004 | $187,500 | | 60/160 = 37.5% |
| 5 | 7199 | 1000 | | $500,000 | New offset |

### Validation
- Net effect: only corrected allocation remains
- Two journal batches visible: reversal + new
- Trial balance reflects corrected amounts
- No manual reversal needed

---

## Scenario 7: Error Scenario — Invalid Target Combination

### Precondition
- Cross-Validation Rule (CVR) exists: "Account 7100 cannot be used with CC 9000"
- Allocation rule targets include CC 9000

### Configuration

**Rule: `ALLOC_IT_WITH_INVALID_CC`**
- Point: Account 7100, CC 1000
- Factor: Fixed (CC 5001=50%, CC 9000=50%)
- Target: Account 7100, CC 5001 and CC 9000
- Offset: Account 7199, CC 1000

### Action
- Validate Rule → Click Validate button

### Expected Error
```
Error: ORA-XXXXX: Account combination 7100-9000 is not valid.
Cross-validation rule "CVR_IT_ACCOUNTS" prevents this combination.
Status remains: Incomplete
```

### Resolution
1. Remove CC 9000 from target/factor range, OR
2. Modify CVR to allow the combination, OR
3. Use a different target account that IS valid with CC 9000

### Validation
- Rule cannot be set to "Valid" status until error resolved
- Rule set containing invalid rule will skip it during execution (with warning in ESS log)

---

## Scenario 8: Full Monthly Close — End-to-End Allocation Run

### Precondition
- All subledger journals posted for Jun-26
- All manual adjusting entries posted
- Statistical journals (FTE, sqft, transactions) posted for Jun-26
- Three rule sets configured:
  - `ALLOC_PASS1_CORPORATE` (3 rules, seq 10-30)
  - `ALLOC_PASS2_SHARED_SVCS` (4 rules, seq 10-40)
  - `ALLOC_PASS3_PRODUCTS` (2 rules, seq 10-20)

### Action Sequence

| Step | Action | Expected Duration |
|------|--------|-------------------|
| 1 | Verify all source journals posted | Manual check |
| 2 | Verify statistical journals posted | Check stat account balances |
| 3 | Run Generate Allocations: PASS1 | ~2-5 minutes |
| 4 | Verify PASS1 journals posted | Check journal inquiry |
| 5 | Run Generate Allocations: PASS2 | ~5-10 minutes |
| 6 | Verify PASS2 journals posted | Check journal inquiry |
| 7 | Run Generate Allocations: PASS3 | ~3-7 minutes |
| 8 | Verify PASS3 journals posted | Check journal inquiry |
| 9 | Run Trial Balance report | Verify all allocations landed |
| 10 | Run Allocation Summary report | Cross-check totals |

### Expected Outcomes After Full Run

| Check | Expected Result |
|-------|----------------|
| Corporate overhead accounts (CC 0001) | Net zero (fully allocated out) |
| Shared service accounts (CC 1000-1003) | Net zero (fully allocated out) |
| Business line accounts (CC 5001-5010) | Contain fully loaded costs |
| All clearing accounts (x099, x199, x299) | Net zero |
| Total company P&L | Unchanged (allocations are zero-sum within entity) |
| Journal Source filter = "Allocations" | Shows all allocation batches |

### Final Validation Report

Run: `Navigator > General Accounting > Trial Balance`
- Filter by Journal Source = "Allocations"
- Verify: Debit total = Credit total for all allocation journals
- Verify: No open/unposted allocation journals remaining

Run: `Navigator > General Accounting > Account Analysis`
- Drill into any corporate CC account → should show offset clearing it
- Drill into any business line CC → should show received allocations

---

## Scenario Execution Checklist

| # | Scenario | Tests | Status |
|---|----------|-------|--------|
| 1 | Basic FTE allocation | Single rule, statistical factor |  |
| 2 | Revenue-based relative | Relative amount factor, YTD |  |
| 3 | Fixed ratio equal split | Fixed amount factor |  |
| 4 | Multi-step step-down | Sequential passes, cumulative |  |
| 5 | PTD vs YTD comparison | Balance type impact |  |
| 6 | Rerun auto-reversal | Correction handling |  |
| 7 | Invalid combination error | CVR blocking, error handling |  |
| 8 | Full monthly close | End-to-end production run |  |
