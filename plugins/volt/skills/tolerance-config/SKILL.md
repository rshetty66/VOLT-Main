---
name: tolerance-config
description: >
  Configurable tolerance framework for reconciliation matching. Defines $ absolute,
  percentage, date window, and aging thresholds per reconciliation type, industry, and
  client. Use when setting up matching parameters, adjusting thresholds, or reviewing
  tolerance policy for any reconciliation.
version: 1.0.0
metadata:
  category: Reconciliation
  type: cross-cutting
disable-model-invocation: true
---

# Tolerance Configuration Framework

## Purpose

Provides industry-standard default tolerances per reconciliation type and a configuration
model for client-specific overrides. Tolerance settings drive the matching cascade engine
and exception severity scoring.

---

## Default Tolerance Matrix

### Banking

| Rec Type | $ Tolerance | % Tolerance | Date (days) | Aging Threshold | Clear Policy |
|----------|-------------|-------------|-------------|-----------------|--------------|
| Nostro/Vostro | $100 | 0.01% | 2 | 5 days | Must clear within 5 business days |
| Loan Portfolio | $1,000 | 0.1% | 0 | 30 days | Monthly review cycle |
| Derivative/Trading | $1,000 | 0.01% | 0 | 10 days | Daily MTM tolerance |
| Intercompany | $0 | 0% | 0 | 30 days | Zero tolerance, full elimination |
| Suspense/Clearing | $500 | 0.05% | 1 | 15 days | Clear within 2 weeks |
| Deposit Accounts | $100 | 0.01% | 1 | 30 days | Monthly cycle |

### Insurance

| Rec Type | $ Tolerance | % Tolerance | Date (days) | Aging Threshold | Clear Policy |
|----------|-------------|-------------|-------------|-----------------|--------------|
| Premium-to-GL | $5,000 | 0.5% | 5 | 45 days | Close by T+5 |
| Claims Reserve | $10,000 | 2.0% | N/A | 90 days | Quarterly actuarial update |
| IBNR | $50,000 | 2.0% | N/A | 90 days | Quarterly, Appointed Actuary sign-off |
| Reinsurance | $50,000 | 1.0% | N/A | 90 days | Treaty statement reconciliation |
| IFRS 17 CSM | $500,000 | 1.0% | N/A | 90 days | Quarterly roll-forward |
| Investment Portfolio | $1,000 | 0.01% | 2 | 10 days | Daily for liquid assets |

### Asset Management

| Rec Type | $ Tolerance | % Tolerance | Date (days) | Aging Threshold |
|----------|-------------|-------------|-------------|-----------------|
| NAV | $0.001/unit | 0.001% | 0 | 1 day |
| AUM | $10,000 | 0.01% | 1 | 5 days |
| Fee Revenue | $1,000 | 0.1% | 3 | 30 days |
| Cash/Custody | $100 | 0.01% | 1 | 3 days |

---

## Configuration Schema

```json
{
  "client_id": "BANK-001",
  "industry": "banking",
  "materiality_threshold": 500000,
  "tolerance_overrides": {
    "nostro": {
      "tolerance_abs": 100,
      "tolerance_pct": 0.0001,
      "date_tolerance_days": 2,
      "aging_threshold_days": 5,
      "clear_policy": "5 business days",
      "escalation_amount": 1000000
    }
  },
  "global_settings": {
    "fx_rounding_tolerance": 0.01,
    "batch_total_tolerance": 0.001,
    "systematic_timing_auto_clear": true,
    "auto_resolve_confidence_min": 0.90,
    "stale_item_threshold_days": 90
  }
}
```

---

## Tolerance Governance

### Change Control
- Tolerance changes require Controller approval
- Material threshold changes require CFO sign-off
- Changes logged in audit trail with effective date and rationale

### Periodic Review
- Quarterly: review auto-resolution rates; tighten if false-positive rate > 3%
- Annually: benchmark against industry standards and regulatory expectations
- Post-incident: adjust if tolerance allowed a material misstatement through

### Regulatory Expectations
- **OSFI (Canada):** Expects zero tolerance on intercompany; tight tolerances on capital-impacting items
- **IFRS 9 / IFRS 17:** Staging and CSM tolerances must be below actuarial materiality
- **SOX/CSOX:** Tolerance must be below financial statement materiality divided by coverage factor

---

## Cross-References

- **matching-cascade-engine** — consumes tolerance parameters for each priority level
- **exception-classifier** — uses aging thresholds for severity scoring
- **recon-orchestrator** — loads client-specific tolerance config at pipeline start
