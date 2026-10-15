---
name: banking-intercompany-recon
description: >
  Intercompany reconciliation and elimination across 40+ legal entities. Zero-tolerance
  matching of bilateral balances, automated netting, and elimination journal generation
  for consolidated reporting. Activates for intercompany, ICO, elimination, interco,
  bilateral, related party, transfer pricing, or consolidation reconciliation.
version: 1.0.0
metadata:
  category: Reconciliation
  industry: Banking
  rec_type: intercompany
  complexity: High
disable-model-invocation: true
---

# Intercompany Reconciliation & Elimination

## Domain Context

Ensures all intercompany balances between legal entities within the group net to zero
and can be properly eliminated for consolidated financial statements.

- **GL Side:** ICO receivable (GL 1600) and ICO payable (GL 2600) per entity pair
- **Source Side:** Counterparty entity's corresponding balance (bilateral confirmation)
- **Frequency:** Monthly (close), Quarterly (full entity-pair confirmation)
- **Volume:** 40+ legal entities = potentially 1,600+ entity pairs; typically 200-400 active

---

## Matching Configuration

```yaml
tolerance:
  amount_abs: 0            # ZERO TOLERANCE — must match exactly
  amount_pct: 0            # No percentage allowance
  date_days: 0             # Same period
  aging_threshold: 30      # Must resolve within 30 days
  escalation_amount: 0     # Any mismatch escalates (zero tolerance)

match_keys:
  primary: [entity_from, entity_to, amount, currency, period]
  confirmation: [entity_from_balance, entity_to_balance]  # Must be equal and opposite

special_rules:
  bilateral_confirmation: true    # Both sides must agree
  fx_translation: true            # Handle multi-currency translation
  netting: true                   # Net multiple transactions between same pair
  elimination_journal_auto: true  # Auto-generate elimination entries
```

---

## Reconciliation Process

```
STEP 1: BILATERAL EXTRACTION
  For each entity pair (A→B):
    Entity A reports: "I owe B: $X" (GL 2600-B)
    Entity B reports: "A owes me: $X" (GL 1600-A)
    These MUST match exactly.

STEP 2: MATCH AND NET
  Scenario: A owes B $500K, B owes A $200K
    Net position: A owes B $300K
    Elimination: DR ICO Payable $300K / CR ICO Receivable $300K

STEP 3: IDENTIFY MISMATCHES
  Entity A says: "I owe B: $1,000,000"
  Entity B says: "A owes me: $950,000"
  Mismatch: $50,000 — must be investigated and resolved before elimination

STEP 4: GENERATE ELIMINATION JOURNALS
  For consolidated statements:
    DR: Intercompany Revenue (Entity A)  $X
    CR: Intercompany Expense (Entity B)  $X
    DR: Intercompany Payable (Entity A)  $Y
    CR: Intercompany Receivable (Entity B) $Y
```

---

## Common Exception Patterns

| Pattern | Description | Root Cause | Resolution |
|---------|-------------|------------|------------|
| Timing | One entity posted, counterparty hasn't yet | Month-end cutoff difference | Wait for counterparty close; if T+3 → escalate |
| FX translation | Same functional CCY amount, different reporting CCY | Different FX rates used | Agree rate source; adjust to group rate |
| Transfer pricing | One side using provisional TP, other using final | TP adjustment timing | Apply TP adjustment to both sides |
| Netting disagreement | Different transactions included in net | Missing invoices/settlements | Reconcile individual transactions first |
| Dividend/capital | Parent records dividend income, sub hasn't declared | Declaration vs payment timing | Confirm corporate action status |
| Service charges | Shared service allocations disputed | Methodology disagreement | Escalate to TP/Finance leadership |

---

## Multi-Currency Handling

```
SCENARIO: Entity A (CAD functional) transacts with Entity B (USD functional)

Entity A records: ICO Payable to B = CAD 1,350,000 (using spot rate 1.35)
Entity B records: ICO Receivable from A = USD 1,000,000

RECONCILIATION:
  1. Convert both to group reporting currency (CAD) using closing rate
  2. Compare: A's CAD 1,350,000 vs B's USD 1,000,000 × 1.35 = CAD 1,350,000
  3. If rates differ (A used 1.35, group rate is 1.34):
     Variance = CAD 10,000 (FX translation difference)
     → Not a "real" mismatch but creates elimination variance
     → Booking: DR/CR FX Translation Reserve in OCI
```

---

## Elimination Journal Generation

```json
{
  "elimination_type": "balance_sheet",
  "entity_pair": {"from": "BANK-CA-001", "to": "BANK-US-002"},
  "period": "2026-06",
  "entries": [
    {"dr": "2600", "cr": "1600", "amount": 5000000, "entity": "CONSOL",
     "description": "Eliminate ICO balance BANK-CA <-> BANK-US"},
    {"dr": "4800", "cr": "5800", "amount": 120000, "entity": "CONSOL",
     "description": "Eliminate ICO service revenue/expense"}
  ],
  "fx_variance": 15000,
  "fx_journal": {"dr": "3200", "cr": "1600", "amount": 15000,
                  "description": "ICO elimination FX translation variance to OCI"}
}
```

---

## OSFI / Regulatory Requirements

- **OSFI Guideline D-6:** Related party transactions must be at arm's length; reconciliation evidence required
- **Large Exposure Reporting:** ICO exposures impact consolidated large exposure limits
- **Capital Treatment:** Intragroup capital instruments must be eliminated for CET1 calculation
- **Transfer Pricing:** CRA/IRS scrutiny requires documented ICO pricing with reconciliation support

---

## Escalation Policy

| Condition | Action | SLA |
|-----------|--------|-----|
| Any mismatch (zero tolerance) | Both entity controllers notified | 2 business days |
| Mismatch > $1M | Group Controller + Treasury | 1 business day |
| Unresolved > 30 days | CFO/Group Finance Director | Immediate |
| Transfer pricing dispute | TP team + Tax | 10 business days |

---

## Cross-References

- **matching-cascade-engine** — bilateral matching with zero tolerance
- **consolidation** — elimination journals feed into consolidated close
- **break-trace** — traces entity-pair mismatches to source transactions
- **period-close** — ICO elimination is critical path for consolidated close
