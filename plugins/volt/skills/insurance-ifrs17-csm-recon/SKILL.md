---
name: insurance-ifrs17-csm-recon
description: >
  IFRS 17 Contractual Service Margin (CSM) reconciliation. Validates the CSM roll-forward
  between the IFRS 17 calculation engine and GL. Covers initial recognition, interest
  accretion, changes in estimates, coverage unit release, loss component, and risk
  adjustment. Activates for IFRS 17 reconciliation, CSM, contractual service margin,
  loss component, risk adjustment, coverage units, BBA, VFA, PAA, or insurance contract
  liability reconciliation.
version: 1.0.0
metadata:
  category: Reconciliation
  industry: Insurance
  rec_type: ifrs17_csm
  complexity: Expert
disable-model-invocation: true
---

# IFRS 17 CSM Reconciliation

## Domain Context

The Contractual Service Margin represents unearned profit in insurance contracts. This
reconciliation ensures the IFRS 17 calculation engine output matches GL carrying amounts
through the CSM roll-forward.

- **GL Side:**
  - GL 2500: Contractual Service Margin (CSM)
  - GL 2510: Loss Component (onerous contract losses)
  - GL 2520: Risk Adjustment for Non-Financial Risk
  - GL 4300: Insurance Revenue (released CSM + risk adjustment + expected claims)
- **Source Side:** IFRS 17 calculation engine (SAS, Willis Towers Watson, Moody's)
- **Frequency:** Quarterly (full roll-forward), Monthly (estimate/roll-forward proxy)
- **Measurement Models:** BBA (Building Block Approach), VFA (Variable Fee Approach), PAA (Premium Allocation Approach)

---

## CSM Roll-Forward Reconciliation

```
CSM ROLL-FORWARD (must reconcile GL 2500 opening to closing):

  Opening CSM                                              $500,000,000
  ─────────────────────────────────────────────────────────────────────
  + New business CSM (initial recognition of new contracts)  +$45,000,000
  + Interest accretion (locked-in discount rate × CSM)       +$12,500,000
  - CSM released to P&L (coverage units amortization)        -$38,000,000
  ± Changes in estimates relating to future service           +$8,000,000
  - Losses recognized immediately (onerous contracts)         -$3,500,000
  ± FX on CSM (foreign currency groups)                      -$2,000,000
  ─────────────────────────────────────────────────────────────────────
  = Closing CSM                                             $522,000,000

  GL 2500 closing balance MUST = $522,000,000
```

---

## Reconciliation Points

### 1. New Business CSM

```
IFRS 17 Engine: CSM at initial recognition per group of contracts
  = PV(future cash inflows) - PV(future cash outflows) - Risk Adjustment
  Must be positive (otherwise → loss component)

GL ENTRY at inception:
  DR: Insurance Contract Liability (fulfilment cash flows)
  CR: GL 2500 (CSM — new business)

RECONCILIATION:
  Sum of new business CSM (engine) = New business CSM credits in GL 2500
```

### 2. Interest Accretion

```
CSM accretes at the LOCKED-IN discount rate (rate at initial recognition)

IFRS 17 Engine: CSM × locked-in rate × period fraction
GL: Interest accretion journal (DR: GL 2500 / CR: GL 4300 or retained in CSM)

COMMON BREAK: Using current rate instead of locked-in rate
  Detection: Accretion amount differs by spread between locked-in and current
  Resolution: Use cohort-specific locked-in rates from inception
```

### 3. Coverage Unit Release

```
CSM released to P&L based on coverage units:
  Release = CSM × (Coverage units provided in period / Total expected coverage units)

Coverage unit methodology options:
  - Time-based (passage of time)
  - Claims-based (expected claims pattern)
  - Sum insured-based (exposure measure)
  - Premium-based (premium pattern)

COMMON BREAK: Methodology difference between engine and GL allocation
  Engine uses claims-based; GL journal uses time-based
  Resolution: Align to policy election documented in accounting manual
```

### 4. Changes in Estimates (Future Service)

```
Changes that relate to FUTURE service adjust CSM (not P&L):
  - Updated cash flow estimates (non-financial)
  - Experience adjustments on current period
  - Changes in discretionary cash flows (VFA)

Changes that relate to CURRENT/PAST service → P&L immediately

RECONCILIATION:
  IFRS 17 engine "CSM adjustment" = GL adjustment journals to GL 2500
  Sign: Favorable changes → increase CSM; Adverse → decrease CSM

  IF adverse change > remaining CSM → CSM goes to zero, excess → Loss Component (GL 2510)
```

### 5. Loss Component

```
GL 2510: Loss Component (onerous contracts)

RECONCILIATION:
  Opening Loss Component
  + New onerous groups identified (CSM would be negative)
  - Reversal of losses (if estimates improve)
  + Interest accretion on loss component
  ± Changes in fulfilment cash flows allocated to loss component
  = Closing Loss Component

  Allocation ratio: LC / (LC + CSM) applied to favorable changes
```

---

## Tolerance Configuration

```yaml
tolerance:
  csm_total_abs: 500000         # $500K on total CSM
  csm_total_pct: 0.01           # 1% relative
  csm_per_group_abs: 100000     # $100K per group of contracts
  loss_component_abs: 250000    # $250K
  risk_adjustment_abs: 200000   # $200K
  aging_threshold: 90           # Quarterly cycle

granularity:
  level: "group_of_contracts"   # Unit of account for IFRS 17
  aggregation: "portfolio → group → cohort (annual)"
  currency: "functional_currency_per_entity"
```

---

## Common Exception Patterns

| Pattern | Description | Root Cause | Resolution |
|---------|-------------|------------|------------|
| Coverage unit methodology | Engine vs GL use different allocation basis | Policy not consistently applied | Align to documented policy |
| Locked-in rate mismatch | Current rate used instead of inception rate | Rate table not maintained | Rebuild locked-in rate table |
| Group aggregation | Portfolio-level vs group-level CSM | Grouping criteria inconsistency | Match IFRS 17 group definition |
| Transition adjustment | Day-1 transition amounts still unwinding | Transition approach choice | Document and track unwind |
| VFA variable fee | Variable fee allocation differences | Underlying item return measurement | Align measurement date |
| Onerosity trigger | Group becomes onerous mid-period | Different timing of assessment | Run onerosity test at GL date |

---

## MCP Tool Invocations

| Step | Tool | Query/Action |
|------|------|-------------|
| GL CSM balances | `oracle_erp.run_sql_query` | GL_BALANCES accounts 2500, 2510, 2520, 4300 |
| GL movement | `oracle_erp.run_sql_query` | GL_JE_LINES for IFRS 17 accounts by journal source |
| IFRS 17 engine | `oracle_erp.read_workbook` | CSM roll-forward output by group |
| Risk adjustment | `oracle_erp.read_workbook` | RA calculation by portfolio |
| Coverage units | `oracle_erp.read_workbook` | Coverage unit allocation table |
| Post adjustment | `oracle_erp.upload_fbdi` | CSM correction / loss component journal |

---

## Escalation Policy

| Condition | Action | SLA |
|-----------|--------|-----|
| CSM variance > $1M | IFRS 17 Program Lead + Controller | Before quarter close |
| Loss component emergence | Chief Actuary + CFO | Immediate assessment |
| Coverage unit methodology change | Audit Committee notification | Quarter end |
| Locked-in rate error > 10bps | IFRS 17 team remediation | 5 business days |
| New onerous groups > 5% of portfolio | Board risk committee | Quarterly reporting |

---

## Cross-References

- **insurance-premium-recon** — premium recognition feeds into CSM initial recognition
- **insurance-claims-recon** — claims development impacts CSM estimates (future service)
- **exception-classifier** — classifies IFRS 17-specific break types
- **recon-certification** — IFRS 17 reconciliation required for regulatory filing sign-off
- **oracle-epm-wiki** (references/arcs-reconciliation.md) — ARCS integration for IFRS 17 close tasks
