---
name: banking-loan-recon
description: >
  Loan portfolio reconciliation between GL and loan servicing system. Reconciles principal
  balances, accrued interest, and provision staging across product types (mortgage, commercial,
  consumer). Handles EIR amortization, IFRS 9 stage reclassification, and securitization
  derecognition. Activates for loan reconciliation, loan portfolio, accrued interest,
  loan servicing, IFRS 9 staging, or ECL reconciliation.
version: 1.0.0
metadata:
  category: Reconciliation
  industry: Banking
  rec_type: loan_portfolio
  complexity: High
disable-model-invocation: true
---

# Loan Portfolio Reconciliation

## Domain Context

Reconciles the General Ledger loan balances against the loan servicing/origination system
to ensure completeness and accuracy of the loan book.

- **GL Side:** GL 1200 (Loans & Advances) + GL 1210 (Accrued Interest) + GL 1220 (Deferred Fees)
- **Source Side:** Loan servicing system (principal balance + accrued interest per contract)
- **Frequency:** Monthly (aggregate), Quarterly (detailed by product/stage)
- **Volume:** 100K-5M loan contracts; reconcile at aggregate and segment level

---

## Matching Configuration

```yaml
tolerance:
  amount_abs: 1000         # $1,000 absolute
  amount_pct: 0.001        # 0.1% relative
  date_days: 0             # Same period (no date tolerance)
  aging_threshold: 30      # Monthly review cycle

match_keys:
  aggregate: [product_type, segment, period]
  detailed: [contract_id, principal_balance, accrued_interest]

aggregation_levels:
  - Total portfolio (GL 1200 = Sum of all contracts)
  - By product (mortgage, commercial, consumer, LOC)
  - By IFRS 9 stage (Stage 1, Stage 2, Stage 3, POCI)
  - By segment/LOB
```

---

## Common Exception Patterns

| Pattern | Description | Root Cause | Resolution |
|---------|-------------|------------|------------|
| Write-off timing | Approved write-off not yet posted to GL | Approval workflow delay | Post write-off JE |
| Fee amortization | EIR vs straight-line method difference | Policy mismatch | Adjust to EIR basis |
| Stage reclassification | IFRS 9 provision impact on gross balance | Stage migration not reflected in GL | Post reclassification |
| Securitization | Loan derecognized in servicing but still on GL | Failed sale treatment | Review derecognition criteria |
| Prepayment | Early principal repayment not posted | Interface lag | Post via next batch |
| Interest accrual | GL accrual ≠ system calculated accrual | Day count convention | Adjust accrual JE |

---

## IFRS 9 Stage Reconciliation

```
STAGE MIGRATION RECONCILIATION:
  GL Side:
    Stage 1: GL 1200A (Performing)
    Stage 2: GL 1200B (Underperforming)
    Stage 3: GL 1200C (Non-performing)
    POCI:    GL 1200D (Purchased credit-impaired)

  Source Side:
    Loan system stage assignments per contract
    ECL model output (12-month vs lifetime PD)

  RECONCILIATION:
    Sum(Stage 1 contracts) = GL 1200A ← must match
    Sum(Stage 2 contracts) = GL 1200B ← must match
    Sum(Stage 3 contracts) = GL 1200C ← must match
    Stage migrations this period = Reclassification journals posted

  COMMON BREAKS:
    • Loan cured (Stage 3→1) but GL still in Stage 3 (JE not posted)
    • Backstop trigger (30 DPD → Stage 2) applied in model but not GL
    • SICR indicator updated in credit system but not reflected in stage
```

---

## MCP Tool Invocations

| Step | Tool | Query/Action |
|------|------|-------------|
| GL balance | `oracle_erp.run_sql_query` | GL_BALANCES WHERE account IN ('1200%', '1210%', '1220%') |
| GL detail | `oracle_erp.run_sql_query` | GL_JE_LINES for loan accounts this period |
| Loan system extract | `oracle_erp.read_workbook` | Servicing system export (CSV/XLSX) |
| Stage data | `oracle_erp.run_sql_query` | IFRS 9 stage assignment table |
| Post adjustment | `oracle_erp.upload_fbdi` | Stage reclassification / accrual correction |

---

## Escalation Policy

| Condition | Action | SLA |
|-----------|--------|-----|
| Aggregate variance > $1M | Controller review | 2 business days |
| Stage mismatch > 100 contracts | Credit risk team + Finance | 5 business days |
| Write-off > $5M not in GL | CFO notification | 1 business day |
| Securitization accounting mismatch | Treasury + External audit | Immediate |

---

## Cross-References

- **matching-cascade-engine** — aggregate and segment-level matching
- **exception-classifier** — classifies loan-specific break types
- **break-trace** — traces contract-level mismatches to source
- **tolerance-config** — loan portfolio tolerance parameters
