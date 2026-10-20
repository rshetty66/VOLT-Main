---
name: banking-nostro-recon
description: >
  Nostro/Vostro reconciliation for correspondent banking. Matches internal GL nostro account
  balances against correspondent bank statements. Critical for fraud detection, sanctions
  compliance (FATF Rec 16), and liquidity management. Activates for nostro, vostro,
  correspondent banking, SWIFT statement, MT940, MT950, or bank statement reconciliation.
version: 1.0.0
metadata:
  category: Reconciliation
  industry: Banking
  rec_type: nostro
  complexity: High
disable-model-invocation: true
---

# Nostro/Vostro Reconciliation

## Domain Context

Nostro accounts ("our account at their bank") are reconciled against correspondent bank
statements to ensure all transactions are captured, no unauthorized debits exist, and
settlement is completing as expected.

- **GL Side:** Nostro account balance (GL 1100-1199 depending on correspondent)
- **Source Side:** Correspondent bank statement (SWIFT MT940/MT950 or proprietary format)
- **Frequency:** Daily (T+0 for critical corridors; T+1 for standard)
- **Volume:** 500-5,000 transactions/day per correspondent (large bank: 50+ correspondents)

---

## Matching Configuration

```yaml
tolerance:
  amount_abs: 100          # $100 absolute (covers FX rounding)
  amount_pct: 0.0001       # 0.01% relative
  date_days: 2             # Value date ±2 days (settlement timing)
  aging_threshold: 5       # Must clear within 5 business days
  escalation_amount: 1000000  # >$1M immediate escalation

match_keys:
  primary: [transaction_ref, amount, value_date]
  secondary: [amount, value_date]  # If ref missing (old SWIFT formats)

special_rules:
  fx_rounding: true          # Allow ±$0.01 per currency conversion
  systematic_timing: true    # Auto-detect T+1 settlement patterns
  bank_charges_auto: true    # Auto-expense charges < $100
```

---

## Common Exception Patterns

| Pattern | Description | Auto-Resolve? | Confidence |
|---------|-------------|---------------|------------|
| Bank charges | Debit on statement, no GL match, recurring monthly | Yes — create expense JE | 90% |
| In-transit | GL entry posted, not yet on statement | Yes — mark timing, monitor T+1 | 95% |
| Value date diff | Same tx, 1 day offset (T+0 vs T+1 settlement) | Yes — systematic timing | 95% |
| FX rounding | Local CCY matches, base CCY differs by < $10 | Yes — rounding adjustment | 98% |
| Unauthorized debit | Statement debit with no GL counterpart, unusual pattern | No — escalate immediately | — |
| Duplicate credit | Same credit appears twice on statement | No — confirm with correspondent | — |

---

## MCP Tool Invocations

| Step | Tool | Query/Action |
|------|------|-------------|
| Extract GL | `oracle_erp.run_sql_query` | GL_BALANCES WHERE account LIKE '11%' AND period = :period |
| Extract GL detail | `oracle_erp.run_sql_query` | GL_JE_LINES for nostro accounts with posting dates |
| Import statement | `oracle_erp.read_workbook` | Correspondent bank statement (MT940 parsed to CSV) |
| Post adjustment | `oracle_erp.upload_fbdi` | Correcting journal for bank charges/FX rounding |

---

## Risk & Compliance

- **Fraud risk:** Unauthorized debits hidden in unreconciled balances — daily recon is primary control
- **Sanctions (FATF Rec 16):** All transactions must be traceable; unreconciled items may indicate blocked/frozen transactions
- **Liquidity:** Nostro balance accuracy is critical for intraday liquidity management (BCBS 248)
- **OSFI:** Expects daily reconciliation of material nostro accounts with immediate escalation of anomalies

---

## Escalation Policy

| Condition | Action | SLA |
|-----------|--------|-----|
| Unmatched > $1M | Immediate escalation to Treasury + Compliance | 1 hour |
| Unmatched > 5 business days | Controller notification | Same day |
| Suspected fraud pattern | MLRO/Compliance alert | Immediate |
| Systematic failure (no statement received) | Ops escalation to correspondent | 2 hours |

---

## Cross-References

- **matching-cascade-engine** — applies the 5-priority cascade with nostro-specific config
- **break-trace** — traces root cause of material nostro breaks
- **journal-entry-agent** — posts auto-generated expense/rounding journals
- **tolerance-config** — provides the nostro tolerance parameters
