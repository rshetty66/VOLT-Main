---
name: matching-cascade-engine
description: >
  Five-priority matching cascade for reconciliation. Applies rules in priority order —
  exact match, reference match, amount match, one-to-many, many-to-many — until each item
  is matched or falls to the exception queue. Use when configuring or executing any
  reconciliation matching logic regardless of industry or rec type.
version: 1.0.0
metadata:
  category: Reconciliation
  type: cross-cutting
disable-model-invocation: true
---

# Matching Cascade Engine

## Purpose

A reusable, industry-agnostic matching engine that applies 5 priority levels in sequence.
Each item cascades through rules until matched or exhausted into the exception queue.

---

## Cascade Priority Rules

```
PRIORITY 1: EXACT MATCH
  Conditions:
    • Amount matches to the cent (or within FX rounding < $0.01)
    • Reference/transaction ID matches exactly
    • Date matches exactly (posting date or value date within 0 days)
  Result: Auto-matched — no human review needed
  Confidence: 99%+

PRIORITY 2: REFERENCE MATCH
  Conditions:
    • Same reference number / PO / invoice / policy number
    • Amount within configured $ or % tolerance
    • Date within configured day tolerance
  Result: Auto-matched with documentation trail
  Confidence: 95%+

PRIORITY 3: AMOUNT MATCH
  Conditions:
    • Exact amount match (to the cent)
    • Different or missing reference
    • Date within configured tolerance
  Result: Suggested match — requires analyst confirmation
  Confidence: 75-90%

PRIORITY 4: ONE-TO-MANY
  Conditions:
    • One GL entry = Sum of N source items (batch posting)
    • OR one source item = Sum of N GL entries (split posting)
    • Total within tolerance after aggregation
  Result: Suggested group match — requires review
  Confidence: 70-85%

PRIORITY 5: MANY-TO-MANY
  Conditions:
    • Multiple items on GL side net to zero against multiple source items
    • Clearing/netting/offset patterns
    • Requires combinatorial matching within tolerance
  Result: Complex match — requires senior review
  Confidence: 60-75%

UNMATCHED: Items failing all 5 priority levels → Exception Queue
```

---

## Configuration Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tolerance_abs` | float | 0.01 | Absolute $ tolerance for amount matching |
| `tolerance_pct` | float | 0.0 | Percentage tolerance (0.01 = 1%) |
| `date_tolerance_days` | int | 0 | Max days between posting dates |
| `match_keys` | list | ["amount", "reference", "date"] | Fields used for matching |
| `aggregation_keys` | list | [] | Fields for grouping in one-to-many |
| `max_combo_size` | int | 10 | Max items in many-to-many combination |
| `auto_match_threshold` | float | 0.90 | Min confidence for auto-match |
| `fx_rounding_tolerance` | float | 0.01 | FX rounding threshold |

---

## Matching Algorithm

```
FOR each GL item:
  1. Attempt Priority 1 (exact) against all unmatched source items
     IF match found → mark MATCHED, remove both from pool
  2. Attempt Priority 2 (reference) against remaining source items
     IF match found AND confidence > threshold → mark MATCHED
  3. Attempt Priority 3 (amount) against remaining source items
     IF match found → mark SUGGESTED, flag for review
  4. Attempt Priority 4 (one-to-many)
     Find combinations of source items summing to GL amount within tolerance
     IF found → mark SUGGESTED_GROUP, flag for review
  5. Attempt Priority 5 (many-to-many)
     Find netting combinations across both sides
     IF found → mark COMPLEX_MATCH, flag for senior review
  6. IF no match at any priority → mark EXCEPTION
```

---

## Output Schema

```json
{
  "matched": [
    {"gl_id": "...", "source_ids": ["..."], "priority": 1, "confidence": 0.99, "type": "exact"}
  ],
  "suggested": [
    {"gl_id": "...", "source_ids": ["..."], "priority": 3, "confidence": 0.82, "type": "amount", "review_required": true}
  ],
  "exceptions": [
    {"gl_id": "...", "amount": 150000, "priority_reached": 5, "reason": "no_match_found"}
  ],
  "summary": {
    "total_gl_items": 1500,
    "matched_count": 1420,
    "suggested_count": 45,
    "exception_count": 35,
    "match_rate": 0.947,
    "auto_match_rate": 0.893
  }
}
```

---

## Cross-References

- **tolerance-config** — provides the tolerance parameters per rec type
- **exception-classifier** — receives unmatched items for classification
- **gl-recon** — alternative skill for trade-level full-outer-join matching
- **recon-orchestrator** — invokes this engine with rec-type-specific configuration
