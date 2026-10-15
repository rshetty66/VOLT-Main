---
name: oracle-gl-allocation-rules
description: >
  Oracle ERP Cloud General Ledger native allocation rules engine — step-by-step configuration,
  formulas, and unit test scenarios. Activates when users ask about
  "GL allocations", "mass allocations", "allocation rules Oracle", "allocation rule sets",
  "allocation formulas GL", "allocation run groups", "step-down allocations GL",
  "Oracle GL allocation engine", "allocation point", "allocation factor",
  "allocation offset", "allocation target", "statistical journals for allocation",
  "driver-based allocation in GL", "recurring journal formulas", "period-end allocation",
  "Generate Allocations ESS", "Oracle GL allocation setup", "allocation basis",
  "allocation pool", "segment-based allocation", "cost allocation Oracle GL",
  "overhead allocation Oracle ERP Cloud", "Oracle allocation testing",
  "allocation journal entries", "allocation rule type", "allocation run",
  "Oracle ERP Cloud allocation configuration", "Manage Allocation Rules",
  "allocation rule validation", "multi-step allocation GL",
  "GL allocation troubleshooting", "allocation reversal",
  or any Oracle ERP Cloud GL allocation rules engine configuration, testing,
  or troubleshooting question. NOT for Oracle EPM Cloud Calculation Manager
  (EPBCS/FCCS business rules) — that is a different product.
version: 1.0.0
disable-model-invocation: true
---

# Oracle ERP Cloud — GL Allocation Rules Engine

Complete configuration reference for Oracle ERP Cloud General Ledger's **native allocation rules engine**. This is the GL-resident allocation capability accessed through General Accounting, NOT Oracle EPM Cloud's Calculation Manager.

---

## Critical Distinction

| Feature | Oracle ERP Cloud GL Allocations | Oracle EPM Cloud Calc Manager |
|---------|-------------------------------|-------------------------------|
| **Product** | Oracle ERP Cloud (Fusion Financials) | Oracle EPM Cloud (EPBCS/FCCS) |
| **Engine** | GL Allocation Rules Engine | Essbase Calculation Scripts + Groovy |
| **Access** | Navigator > General Accounting > Journals > Allocations | EPM Cloud workspace |
| **Setup** | Functional Setup Manager > Financials > GL | EPM Application setup |
| **Data** | GL balances (actual, budget, statistical) | Planning/consolidation cubes |
| **Output** | GL journal entries (posted to ledger) | Cube cell values |
| **Use Case** | Period-end cost allocation within GL | Planning calculations, consolidation |

**This skill covers the LEFT column only.**

---

## Architecture: Where Allocations Fit in GL Close

```
Period Close Sequence:
  Step 1: Subledger close (AP/AR/FA)
  Step 2: Create Accounting (SLA journals)
  Step 3: Transfer & Post subledger journals
  Step 4: Post recurring journals
  ─────────────────────────────────────────
  Step 5:  RUN ALLOCATIONS   ← THIS SKILL
  ─────────────────────────────────────────
  Step 6: Run revaluation
  Step 7: Run translation
  Step 8: Run consolidation
  Step 9: Final adjustments & close
```

Allocations run AFTER all source balances are posted and BEFORE revaluation/translation, ensuring allocated amounts are included in currency processing.

---

## Navigation Paths (Oracle ERP Cloud 24D+)

| Task | Navigation |
|------|-----------|
| **View/Generate allocations** | Navigator > General Accounting > Journals > Allocations |
| **Create/Edit allocation rules** | Setup and Maintenance > Financials > General Ledger > Manage Allocation Rules |
| **Create/Edit rule sets** | Setup and Maintenance > Financials > General Ledger > Manage Allocation Rule Sets |
| **Run Generate Allocations** | Navigator > Tools > Scheduled Processes > "Generate Allocations" |
| **Review allocation journals** | Navigator > General Accounting > Journals > search by Source = "Allocations" |

---

## Core Concepts

| Concept | Definition | Oracle UI Location |
|---------|-----------|-------------------|
| **Allocation Rule** | Single allocation instruction (one pool → one or more targets) | Manage Allocation Rules |
| **Rule Set** | Ordered group of rules executed together | Manage Allocation Rule Sets |
| **Point** | Source/pool — the balance being allocated (which accounts, which segments) | Rule > Point tab |
| **Factor** | Basis/driver — HOW to split the amount (ratio, statistical balance, fixed) | Rule > Factor tab |
| **Target** | Destination — WHERE allocated amounts land (target accounts/segments) | Rule > Target tab |
| **Offset** | Clearing entry — balances the allocation (usually contra to point) | Rule > Offset tab |
| **Generate Allocations** | ESS job that executes rule sets and creates journal entries | Scheduled Processes |

---

## Allocation Rule Components (Detail)

### Point (Source Pool)

Defines WHAT balance is being allocated:

| Field | Values | Description |
|-------|--------|-------------|
| Ledger | (your primary ledger) | Which ledger to read balances from |
| Amount Type | Actual, Budget, Encumbrance | Balance category |
| Balance Type | Period-to-Date, Quarter-to-Date, Year-to-Date, Project-to-Date | Accumulation period |
| Segment Values | Account range, Cost Center, etc. | Which segment combinations to include |
| Include/Exclude | Include ranges, Exclude specific values | Filter mechanism |

### Factor (Allocation Basis)

Defines HOW to split the pool:

| Factor Type | Description | Example |
|-------------|-------------|---------|
| **Relative Amount** | Target segment's own balance as proportion of total target balances | Allocate overhead by each CC's revenue share |
| **Statistical Balance** | Statistical journal balances as weights | Allocate IT costs by workstation count (stat journal) |
| **Fixed Amount** | Hard-coded ratios or amounts | 60/40 split between two entities |
| **Specific** | Explicit amount per target segment | $100K to CC-5001, $200K to CC-5002 |

### Target (Receiving Accounts)

Defines WHERE allocated amounts land:

| Field | Description |
|-------|-------------|
| Target Account | Natural account segment for allocated cost |
| Segment Overrides | Override specific segments (cost center, department) |
| Target Segment Values | Range of receiving segment values |

### Offset (Clearing Entry)

Defines the BALANCING entry (usually credits the source pool):

| Field | Description |
|-------|-------------|
| Offset Account | Account to credit (clears the pool) |
| Offset Method | Same as Point (mirror), or Specific account |

---

## Generate Allocations ESS Job

### Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| Ledger | Yes | Target ledger |
| Rule Set | Yes | Which rule set to execute |
| Period | Yes | Accounting period (e.g., "Jun-26") |
| Allocation Method | Yes | Standard or Summary |
| Amount Type | Yes | Actual, Budget, or Encumbrance |
| Balance Type | Yes | PTD, QTD, YTD, PJTD |
| Journal Batch Name | Optional | Custom batch name for output journals |
| Post Journals | Yes/No | Automatically post generated journals |

### Execution Behavior

- Creates one journal batch per rule set execution
- Each rule creates one or more journal lines within the batch
- Source = "Allocations" (searchable in journal inquiry)
- If rerun for same period: creates REVERSAL of prior run + new allocation (net effect = updated allocation)
- Failed rules within a rule set: remaining rules continue; failed rule logged in ESS output

### Security Requirements

| Role | Privilege | Grants |
|------|-----------|--------|
| General Accounting Manager | Manage Allocation Rules | Create/edit rules and rule sets |
| General Accounting Manager | Generate Allocations | Run ESS job |
| General Accountant | View Allocation Journals | Inquiry only |

---

## Multi-Step Allocation Pattern

For step-down allocations (Pass 1 → Pass 2 → Pass 3), create multiple rule sets and execute in sequence:

```
Rule Set: ALLOC_PASS1_CORPORATE
  Sequence 10: Rule ALLOC_CEO_OFFICE (by revenue share)
  Sequence 20: Rule ALLOC_LEGAL (by headcount)
  Sequence 30: Rule ALLOC_BOARD (equal split)

Rule Set: ALLOC_PASS2_SHARED_SERVICES
  Sequence 10: Rule ALLOC_IT_INFRA (by workstation count)
  Sequence 20: Rule ALLOC_HR (by FTE)
  Sequence 30: Rule ALLOC_FACILITIES (by sqft)

Rule Set: ALLOC_PASS3_SUPPORT
  Sequence 10: Rule ALLOC_BU_MARKETING (by product revenue)
  Sequence 20: Rule ALLOC_BU_OPS (by transaction volume)
```

Execute in order: PASS1 → PASS2 → PASS3. Each pass reads the balances INCLUDING results from prior passes (because prior journals are posted first).

---

## Statistical Journals for Drivers

To use non-financial drivers (FTE, sqft, workstations), load them as **statistical journals**:

1. Create statistical currency (e.g., "STAT") at `Setup > Financials > Currency > Manage Currencies`
2. Create statistical accounts in COA (e.g., Account 9900 = FTE Count, 9901 = Square Footage)
3. Post statistical journals each period with driver quantities
4. Reference statistical accounts in allocation rule Factor tab (Factor Type = Statistical Balance)

---

## References

| Document | Content |
|----------|---------|
| [Allocation Rules Setup](references/allocation-rules-setup.md) | Step-by-step configuration procedures with screenshots-equivalent detail |
| [Allocation Formulas & Syntax](references/allocation-formulas-syntax.md) | Formula types, balance type behavior, multi-step patterns |
| [Unit Test Scenarios](references/unit-test-scenarios.md) | 8 complete test scenarios with expected journal entries |

---

## Common Issues & Resolution

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| "No allocations generated" | Point segment values don't match any balances | Verify account/segment ranges against actual TB |
| Zero allocation amounts | Factor accounts have zero balance (stat journals not posted) | Post statistical journals before running allocation |
| Unbalanced allocation journal | Offset account in closed segment combination | Validate offset account combination is active |
| Allocation journals won't post | Period status not Open, or journal approval required | Check period status; approve journals if workflow enabled |
| Duplicate allocations | Rule set run twice without reversal | Rerun always reverses prior; check for duplicate ESS submissions |
| Wrong allocation ratios | Factor reading wrong period (PTD vs YTD) | Verify Balance Type on Factor matches intent |
| Cross-validation error on target | Target segment combination blocked by CVR | Add exception to CVR or correct target segment values |
