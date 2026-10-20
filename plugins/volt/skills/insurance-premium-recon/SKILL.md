---
name: insurance-premium-recon
description: >
  Insurance premium-to-GL reconciliation. Matches written premium, earned premium, and
  unearned premium reserve between policy administration system and GL. Covers P&C and
  Life across the full premium lifecycle: binding → billing → collection → earning.
  Handles multi-vehicle policies, installment plans, endorsements, cancellations, and
  IFRS 17 revenue recognition. Activates for premium reconciliation, written premium,
  earned premium, UPR, unearned premium, policy admin, Guidewire, Duck Creek,
  premium leakage, or premium-to-GL.
version: 1.0.0
metadata:
  category: Reconciliation
  industry: Insurance
  rec_type: premium
  complexity: High
disable-model-invocation: true
---

# Insurance Premium-to-GL Reconciliation

## Domain Context

Reconciles the full premium lifecycle from policy administration system (Guidewire, Duck Creek,
Majesco) to General Ledger entries representing premium revenue and related balances.

- **GL Side:**
  - GL 4100: Written Premium (gross)
  - GL 4200: Earned Premium (net of UPR movement)
  - GL 1300: Premium Receivable (amounts due from policyholders)
  - GL 2050: Unearned Premium Reserve (liability for unexpired coverage)
- **Source Side:** Policy admin system (GWP, UPR schedule, billing, collection)
- **Frequency:** Monthly (close), Daily (cash reconciliation)
- **Volume:** 10K-100K policy transactions per month; $1B-$10B annual GWP

---

## Premium Lifecycle Reconciliation

```
WRITTEN PREMIUM (at binding):
  Policy Admin GWP (by product, month of binding) = GL 4100 Written Premium

UNEARNED PREMIUM RESERVE (coverage not yet provided):
  Policy Admin UPR schedule (1/365th daily or risk-adjusted) = GL 2050

EARNED PREMIUM (coverage provided):
  GL 4200 = GWP - ΔUPR (earning pattern validation)
  Policy Admin earned = GL earned (by cohort, product, treaty year)

PREMIUM RECEIVABLE (amounts billed but not collected):
  Policy Admin outstanding billing = GL 1300
  Aging: 0-30, 31-60, 61-90, 90+ days
```

---

## Matching Configuration

```yaml
tolerance:
  amount_abs: 5000         # $5,000 absolute
  amount_pct: 0.005        # 0.5% relative
  date_days: 5             # 5-day tolerance (endorsement processing)
  aging_threshold: 45      # 45-day resolution target

match_keys:
  policy_level: [policy_number, premium_amount, effective_date]
  aggregate: [product_line, month_written, sum_gwp]

matching_strategies:
  L1_exact: "Policy number + amount + date (within tolerance)"
  L2_fuzzy: "Amount within $0.01 + date within 3 days + partial policy ref"
  L3_many_to_many: "Sum of N source = 1 GL batch entry (aggregation)"
  L4_pattern: "Historical break patterns with confidence scoring"
```

---

## Common Exception Patterns

| Pattern | Description | Auto-Resolve? | Resolution |
|---------|-------------|---------------|------------|
| Timing (bind vs effective) | Policy admin posts on bind; GL on effective date | Yes (within 5 days) | Mark timing |
| Aggregation | Source per-policy; GL batch-posted by product | Yes (sum matches) | Group match |
| Cancellation lag | Mid-term cancellation not in GL same period | No | Post return premium JE |
| Installment split | Payment plan vs full premium recognition | No | Map installment to recognition |
| Multi-vehicle | Policy split differently in source vs GL | No | Match at policy total |
| Tax bundling | Tax separated in one system, bundled in other | Yes (strip tax) | Reconcile net of tax |
| Endorsement | Premium adjustment not reflected in GL | No | Post endorsement JE |
| Commission netting | Broker commission netted vs gross | No | Reconcile gross, verify net |

---

## IFRS 17 Alignment

```
IFRS 17 PREMIUM RECOGNITION:
  Premium Allocated to Coverage (PAA approach):
    Revenue recognized over coverage period based on passage of time
    (or risk pattern if significantly different)

  RECONCILIATION POINT:
    Insurance Revenue (IFRS 17) ≠ Earned Premium (IFRS 4)
    Difference = Risk adjustment release + Loss component changes

  GL MAPPING:
    GL 4300: Insurance Revenue (IFRS 17 basis)
    GL 4200: Earned Premium (may be retained for management reporting)
    Reconciliation between both required for dual-reporting period
```

---

## KPI Framework

| Metric | Manual Baseline | AI Target | Measurement |
|--------|-----------------|-----------|-------------|
| Monthly recon hours | 320 hrs | 48 hrs (-85%) | Analyst time tracked |
| Auto-match rate | 0% | 85%+ | Items matched without human |
| Break resolution time | 14 days | 2 days | Average days to close |
| Unreconciled at close | 2,400+ items | < 200 items | Open items at T+5 |
| False positive rate | N/A | < 3% | Incorrect auto-matches |
| Close contribution | Day 8-10 | Day 2-3 | When premium rec is certified |

---

## MCP Tool Invocations

| Step | Tool | Query/Action |
|------|------|-------------|
| GL premium balances | `oracle_erp.run_sql_query` | GL_BALANCES accounts 4100, 4200, 1300, 2050 |
| GL journal detail | `oracle_erp.run_sql_query` | GL_JE_LINES for premium accounts |
| Policy admin extract | `oracle_erp.read_workbook` | GWP/UPR/billing export from policy system |
| IFRS 17 data | `oracle_epm.get_reconciliation_status` | Insurance revenue per coverage group |
| Post adjustment | `oracle_erp.upload_fbdi` | Premium cutoff / cancellation journal |

---

## Escalation Policy

| Condition | Action | SLA |
|-----------|--------|-----|
| Premium leakage > $100K | Underwriting + Controller | 3 business days |
| UPR mismatch > 1% of reserves | Chief Actuary notification | 5 business days |
| Cancellation backlog > 500 policies | Operations + Finance | Weekly review |
| IFRS 17 variance > $1M | IFRS 17 team + Controller | Close deadline |

---

## Cross-References

- **premium-to-gl-recon** — complementary premium-to-GL reconciliation skill
- **matching-cascade-engine** — applies L1-L4 matching strategies
- **exception-classifier** — classifies premium-specific break types
- **insurance-ifrs17-csm-recon** — IFRS 17 CSM feeds into premium recognition
