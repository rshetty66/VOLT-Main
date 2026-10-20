---
name: exception-classifier
description: >
  AI-powered exception classification engine for reconciliation breaks. Classifies unmatched
  items by type (Timing, Error, Unrecorded, Cutoff, Reclassification, Stale), assigns severity
  (Critical/High/Medium/Low), and identifies auto-resolution patterns. Use after matching
  engine produces unmatched items.
version: 1.0.0
metadata:
  category: Reconciliation
  type: cross-cutting
disable-model-invocation: true
---

# Exception Classifier

## Purpose

Receives unmatched items from the matching cascade engine and classifies each by:
1. Exception type (what category of break)
2. Severity level (how urgent)
3. Auto-resolution eligibility (can it be resolved without human intervention)

---

## Exception Types (TEUCRS Framework)

| Code | Type | Definition | Typical Resolution |
|------|------|------------|-------------------|
| **T** | Timing | Transaction recorded in different periods; will self-clear | Monitor; auto-clear when counterpart posts |
| **E** | Error | Incorrect posting — wrong amount, account, or entity | Correcting journal entry |
| **U** | Unrecorded | Missing entry on one side (GL or source) | Post missing entry |
| **C** | Cutoff | Transaction in wrong accounting period | Period adjustment or deferral |
| **R** | Reclassification | Correct amount, wrong classification/account | Reclassification journal |
| **S** | Stale | Aged beyond policy threshold with no activity | Write-off or escalation |

---

## Severity Scoring

```
CRITICAL:
  • Amount > materiality threshold
  • OR regulatory impact (capital, solvency, liquidity ratio)
  • OR fraud indicator (unexpected large debit, unauthorized)
  → SLA: Immediate escalation, resolve within 4 hours

HIGH:
  • Amount > 50% of materiality
  • OR aged > 60 days
  • OR repeat exception (same pattern 3+ consecutive periods)
  → SLA: Resolve within 24 hours

MEDIUM:
  • Amount > 25% of materiality
  • OR aged > 30 days
  • OR first occurrence of a new pattern
  → SLA: Resolve within 5 business days

LOW:
  • Within tolerance but requires documentation
  • OR known timing difference with expected clear date
  • OR systematic (FX rounding, batch timing)
  → SLA: Document and clear by close deadline
```

---

## Classification Algorithm

```
FOR each unmatched item:

  1. CHECK timing indicators:
     - Is there a matching item in prior/next period? → T
     - Is the posting date offset consistent with known settlement patterns? → T
     - Does a reversal exist in the subsequent period? → T

  2. CHECK error indicators:
     - Does the same reference exist with a different amount? → E
     - Is there a sign flip (debit vs credit reversed)? → E
     - Is the entity code wrong but amount correct? → E (or R)

  3. CHECK unrecorded indicators:
     - Item exists only on one side with no partial match? → U
     - Source system shows pending/in-transit status? → U
     - GL batch was not posted (interface failure)? → U

  4. CHECK cutoff indicators:
     - Transaction date is last/first day of period? → C
     - Different date conventions (trade date vs settle date)? → C
     - Accrual/reversal timing mismatch? → C

  5. CHECK reclassification indicators:
     - Same amount appears in a different GL account? → R
     - Segment or cost center mismatch only? → R

  6. CHECK stale indicators:
     - No movement for > aging_threshold_days? → S
     - Previously classified as T but never cleared? → S
     - Carry-forward from prior period with no resolution? → S

  ASSIGN severity based on amount vs materiality + age + pattern history
```

---

## Auto-Resolution Patterns

| Pattern | Detection Logic | Resolution | Confidence |
|---------|----------------|------------|------------|
| Systematic 1-day timing | Same reference, T+1 offset, consistent pattern | Mark timing, auto-clear | 95% |
| Bank charges < threshold | Debit on statement, no GL match, recurring | Create expense journal | 90% |
| FX rounding < $10 | Amounts match in local CCY, differ in base | Create rounding adjustment | 98% |
| Month-end reversal | Accrual in M, reversal in M+1, net zero | Match to reversal | 85% |
| Batch total = sum | One side aggregated, other side detailed | Auto-match group | 92% |
| Duplicate posting | Same reference posted twice on one side | Flag for suppression | 88% |

---

## Output Schema

```json
{
  "exception_id": "EXC-2026-06-001",
  "gl_item_id": "JE-2026-06-1234",
  "amount": 850000,
  "type": "C",
  "type_description": "Cutoff — premium bound Mar 31, not earned until April",
  "severity": "Medium",
  "auto_resolvable": true,
  "auto_resolution": {
    "pattern": "period_cutoff",
    "confidence": 0.92,
    "proposed_action": "Defer to April earned premium"
  },
  "age_days": 12,
  "root_cause": "Policy system posts on bind date; GL recognizes on effective date",
  "owner": "accounting",
  "escalation_required": false
}
```

---

## Cross-References

- **matching-cascade-engine** — produces the unmatched items this skill classifies
- **break-trace** — performs detailed root-cause tracing on material exceptions
- **recon-resolution-agent** — receives classified exceptions for resolution proposals
- **tolerance-config** — provides materiality thresholds for severity scoring
