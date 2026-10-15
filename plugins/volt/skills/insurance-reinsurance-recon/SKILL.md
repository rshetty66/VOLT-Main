---
name: insurance-reinsurance-recon
description: >
  Reinsurance reconciliation between GL and reinsurance administration systems. Reconciles
  ceded premiums, recoverable assets, sliding scale commissions, and profit commissions
  against treaty terms and reinsurer statements. Handles quota share, excess of loss,
  facultative, and retrocession. Activates for reinsurance reconciliation, ceded premium,
  recoverable, treaty, bordereau, sliding scale, profit commission, or retrocession.
version: 1.0.0
metadata:
  category: Reconciliation
  industry: Insurance
  rec_type: reinsurance
  complexity: Expert
disable-model-invocation: true
---

# Reinsurance Reconciliation

## Domain Context

Reconciles reinsurance balances between GL, the reinsurance administration system, and
reinsurer statements to ensure accurate reflection of risk transfer and recoveries.

- **GL Side:**
  - GL 1350: Reinsurance Recoverable (asset — amounts due from reinsurers)
  - GL 2150: Ceded Reserves (reinsurer's share of outstanding claims)
  - GL 4500: Ceded Premium (premium paid to reinsurers)
  - GL 4510: Ceded Commission Income (commission received from reinsurers)
- **Source Side:** Reinsurance admin system + treaty terms + reinsurer statements
- **Frequency:** Monthly (ceded premium), Quarterly (recoverable/statements)
- **Volume:** 20-200 treaties; 10-50 reinsurer counterparties

---

## Reconciliation Components

### A. Ceded Premium Reconciliation

```
BY TREATY:
  GL 4500 (Ceded Premium per treaty) = Reinsurance admin system ceded premium

  CALCULATION:
    Quota Share: Ceded = Gross Premium × Cession %
    Excess of Loss: Ceded = XoL premium per treaty schedule
    Facultative: Ceded = Per-risk placement amount

  MATCHING:
    Sum(ceded by treaty) in admin system = GL 4500 balance
    Timing: Bordereau processing may lag by 30-60 days
```

### B. Reinsurance Recoverable

```
GL 1350 = Total amounts recoverable from reinsurers on paid + outstanding claims

RECONCILIATION:
  Paid claims recoverable: Claims paid × treaty cession %
  Outstanding claims recoverable: Case reserves × treaty cession % + IBNR ceded

  BY REINSURER:
    Sum(recoverable per reinsurer) = Reinsurer statement balance
    Differences investigate: bordereau timing, dispute, commutation
```

### C. Commission Reconciliation

```
SLIDING SCALE COMMISSION:
  Provisional rate applied at inception
  Final rate determined by loss ratio at treaty anniversary
  Adjustment = (Final rate - Provisional rate) × Ceded premium

  GL 4510 = Commission at provisional rate + accrual for expected adjustment
  Admin system = Same calculation
  Reinsurer = May differ if using different loss ratio cut-off date

PROFIT COMMISSION:
  Triggered when treaty loss ratio < threshold
  GL accrual = Expected profit commission based on current loss ratio
  Final = Calculated at treaty anniversary using actual results
```

---

## Common Exception Patterns

| Pattern | Description | Root Cause | Resolution |
|---------|-------------|------------|------------|
| Bordereau timing | Claims reported to reinsurer lag | Processing delay | Reconcile at next bordereau cycle |
| Sliding scale adj | Provisional vs final commission rate | Annual true-up pending | Accrue expected adjustment |
| Commutation | Treaty terminated; balances to be settled | Negotiation in progress | Hold; adjust on settlement |
| Dispute | Reinsurer disputes coverage on specific claims | Coverage interpretation | Escalate to reinsurance team |
| Bad debt provision | Reinsurer credit downgrade | Counterparty risk | Assess and provide if needed |
| Treaty restructure | Mid-year treaty changes | New terms effective | Update cession calculations |
| Reinstatement | XoL layer exhausted and reinstated | Additional premium due | Post reinstatement premium |

---

## Reinsurer Statement Reconciliation

```
QUARTERLY STATEMENT RECONCILIATION:

  Our Records (GL + Admin System):
    Ceded Premium (YTD)                    $50,000,000
    Less: Ceding Commission                ($7,500,000)
    Less: Paid Claims Recovered           ($12,000,000)
    Outstanding Claims Recoverable         $18,000,000
    Net Balance Due from Reinsurer          $8,500,000

  Reinsurer Statement:
    Premium Received                       $49,800,000  ← Difference: $200K
    Commission Paid                        ($7,470,000) ← Difference: $30K
    Claims Paid                           ($12,000,000) ← Matches
    Outstanding (per their estimate)       $17,500,000  ← Difference: $500K
    Net Balance                             $7,830,000  ← Total diff: $670K

  INVESTIGATE EACH LINE DIFFERENCE:
    Premium: Bordereau timing (1 month of business not yet processed)
    Commission: Sliding scale rate difference (our estimate vs theirs)
    Outstanding: Different IBNR estimate methodology
```

---

## Tolerance Configuration

```yaml
tolerance:
  ceded_premium_abs: 50000       # $50K absolute
  ceded_premium_pct: 0.01        # 1% relative
  recoverable_abs: 100000        # $100K (larger due to IBNR estimates)
  recoverable_pct: 0.02          # 2%
  commission_abs: 25000          # $25K
  aging_threshold: 90            # Quarterly cycle

counterparty_risk:
  monitor_ratings: true          # Track reinsurer credit ratings
  provision_trigger: "BBB-"      # Provide for recoverables below BBB-
  concentration_limit: 0.20      # Max 20% with single reinsurer
```

---

## MCP Tool Invocations

| Step | Tool | Query/Action |
|------|------|-------------|
| GL reinsurance balances | `oracle_erp.run_sql_query` | GL_BALANCES accounts 1350, 2150, 4500, 4510 |
| GL detail | `oracle_erp.run_sql_query` | GL_JE_LINES for reinsurance accounts |
| Admin system | `oracle_erp.read_workbook` | Reinsurance admin ceded/recoverable export |
| Reinsurer statement | `oracle_erp.read_workbook` | Quarterly reinsurer account statement |
| Treaty terms | `oracle_erp.read_workbook` | Treaty schedule (rates, limits, retention) |
| Post adjustment | `oracle_erp.upload_fbdi` | Commission true-up / bad debt provision |

---

## Escalation Policy

| Condition | Action | SLA |
|-----------|--------|-----|
| Recoverable mismatch > $500K | Reinsurance Manager + Controller | 10 business days |
| Reinsurer credit downgrade | CRO + CFO | Immediate assessment |
| Dispute > $1M | Legal + Reinsurance VP | 30 days |
| Commutation in progress | CFO + Board notification | Per negotiation timeline |
| Treaty renewal gap | Reinsurance broker + CRO | Before renewal date |

---

## Cross-References

- **insurance-claims-recon** — ceded reserves must track gross reserve movements
- **insurance-premium-recon** — ceded premium derives from gross written premium
- **exception-classifier** — classifies reinsurance-specific break types
- **tolerance-config** — reinsurance tolerance parameters
