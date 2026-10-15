---
name: insurance-claims-recon
description: >
  Claims reserve reconciliation between GL and claims/actuarial systems. Reconciles case
  reserves, IBNR (Incurred But Not Reported), and ALAE (Allocated Loss Adjustment Expense)
  against claims system data and actuarial outputs. Critical for reserve adequacy and
  regulatory solvency reporting. Activates for claims reconciliation, case reserves, IBNR,
  ALAE, loss reserves, actuarial reconciliation, claims system, or reserve adequacy.
version: 1.0.0
metadata:
  category: Reconciliation
  industry: Insurance
  rec_type: claims_reserve
  complexity: Expert
disable-model-invocation: true
---

# Claims Reserve Reconciliation

## Domain Context

Reconciles the three components of insurance loss reserves between GL and their respective
source systems (claims administration + actuarial models).

- **GL Side:**
  - GL 2100: Case Reserves (individual claim estimates)
  - GL 2200: IBNR (actuarial estimate of unreported claims)
  - GL 2210: ALAE (allocated loss adjustment expenses)
- **Source Side:**
  - Claims system: individual case reserve estimates per claim
  - Actuarial model: IBNR triangles, ALAE factors, ultimate loss estimates
- **Frequency:** Monthly (case reserves), Quarterly (IBNR/ALAE full actuarial update)
- **Volume:** 10K-500K open claims; IBNR by accident year × LOB matrix

---

## Reconciliation Components

### A. Case Reserves (Monthly)

```
GL 2100 (Case Reserves) = Sum of all open claim case reserves in claims system

RECONCILIATION:
  Claims System: Sum(case_reserve) WHERE status = 'Open' GROUP BY LOB
  GL: Balance of GL 2100 sub-accounts by LOB

  MATCHING:
    Aggregate by LOB (must match exactly or within $10K tolerance)
    Detail: sample N claims for full trace-back (audit requirement)
```

### B. IBNR (Quarterly)

```
GL 2200 (IBNR) = Actuarial IBNR estimate from latest valuation

RECONCILIATION:
  Actuarial Output: IBNR by accident year × LOB from triangle analysis
  GL: Balance of GL 2200 (posted via actuarial adjustment journal)

  MOVEMENT:
    Opening IBNR
    + New accident year development
    - Claims reported (moved to case reserves)
    ± Prior year development (favorable/adverse)
    = Closing IBNR (must match GL 2200)

  COMMON BREAKS:
    • Actuarial valuation complete but GL journal not yet posted
    • Mid-quarter estimate vs full triangle analysis
    • Methodology change (chain-ladder → Bornhuetter-Ferguson)
```

### C. ALAE (Quarterly)

```
GL 2210 (ALAE) = Actuarial estimate of allocated loss adjustment expense

RECONCILIATION:
  Actuarial ALAE = f(case reserves, IBNR) using ALAE-to-loss ratio
  GL 2210 = Posted actuarial ALAE estimate

  VALIDATION:
    ALAE ratio should be consistent with historical experience
    Material changes require actuarial memo explanation
```

---

## Common Exception Patterns

| Pattern | Description | Root Cause | Resolution |
|---------|-------------|------------|------------|
| Stale reserves | No activity > 12 months on open claim | Adjuster oversight | Review; close or update |
| IBNR posting lag | Actuarial complete, GL not posted | Journal approval delay | Post actuarial JE |
| Bulk adjustment | Large reserve strengthening/release pending | Actuarial committee approval | Await approval; post |
| Reinsurance mismatch | Gross reserve updated, ceded not | Ceded reserve lag | Update ceded per treaty |
| Salvage/subrogation | Recovery receivable not updated | Timing of recovery | Post when recovery confirmed |
| ULAE vs ALAE | Expense classification mismatch | Definition boundary | Reclassify per policy |
| Reopened claims | Claim closed then reopened; reserve re-established | New information | Re-post reserve |

---

## Actuarial-to-GL Bridge

```
TOTAL LOSS RESERVE RECONCILIATION:

  Actuarial Ultimate Loss Estimate (by accident year)
  - Cumulative Paid Claims (actual payments to date)
  = Total Outstanding Reserve Estimate

  Breakdown:
    Case Reserves (known claims, individual estimates)     → GL 2100
    IBNR (unreported claims, statistical estimate)         → GL 2200
    ALAE (adjustment expenses allocated to claims)         → GL 2210
    ─────────────────────────────────────────────────
    Total must reconcile to GL 2100 + 2200 + 2210

  ADDITIONAL CHECKS:
    Paid-to-date (actuarial) = Cumulative claim payments (GL expense accounts)
    Development (actuarial) = Reserve movement journals posted
```

---

## Tolerance Configuration

```yaml
tolerance:
  case_reserves_abs: 10000      # $10K per LOB aggregate
  case_reserves_pct: 0.005      # 0.5% of total case reserves
  ibnr_abs: 50000               # $50K (quarterly actuarial estimate)
  ibnr_pct: 0.02                # 2% of IBNR balance
  alae_abs: 25000               # $25K
  aging_threshold: 90           # Quarterly cycle

materiality:
  overall: "±2% of net earned premium"
  individual_claim: 500000      # $500K claim-level materiality
  ibnr_by_accident_year: 1000000  # $1M per accident year
```

---

## MCP Tool Invocations

| Step | Tool | Query/Action |
|------|------|-------------|
| GL reserve balances | `oracle_erp.run_sql_query` | GL_BALANCES accounts 2100, 2200, 2210 |
| GL movement | `oracle_erp.run_sql_query` | GL_JE_LINES for reserve accounts this period |
| Claims system | `oracle_erp.read_workbook` | Open claims export with case reserves |
| Actuarial output | `oracle_erp.read_workbook` | IBNR/ALAE valuation results |
| Post adjustment | `oracle_erp.upload_fbdi` | Actuarial adjustment journal |

---

## Escalation Policy

| Condition | Action | SLA |
|-----------|--------|-----|
| Case reserve aggregate > 2% variance | Claims VP + Controller | 5 business days |
| IBNR > 5% variance from actuarial | Appointed Actuary + CFO | Before close |
| Stale reserves > 100 claims | Claims operations review | 30 days |
| Adverse development > $5M | Audit Committee notification | Quarterly |
| Reserve adequacy concern | Appointed Actuary sign-off | Before regulatory filing |

---

## Cross-References

- **insurance-reinsurance-recon** — ceded reserves must match gross reserve movements
- **insurance-ifrs17-csm-recon** — claims development impacts CSM/loss component
- **exception-classifier** — classifies claims-specific break types
- **matching-cascade-engine** — aggregate and LOB-level matching
