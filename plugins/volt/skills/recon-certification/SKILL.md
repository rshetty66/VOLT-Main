---
name: recon-certification
description: >
  Reconciliation certification and sign-off package generation. Produces KPI dashboards,
  trend analysis, exception summaries, and sign-off workflows for month-end close.
  Activates for reconciliation certification, sign-off, rec status, close package,
  rec dashboard, or KPI reporting requests.
version: 1.0.0
metadata:
  category: Reconciliation
  type: cross-cutting
disable-model-invocation: true
---

# Reconciliation Certification

## Purpose

Generates the certification package that enables controllers and finance leaders to sign off
on reconciliation completeness, accuracy, and exception resolution before close.

---

## Certification Package Contents

### 1. Executive Summary

```
RECONCILIATION EXECUTIVE SUMMARY — [Entity] — [Period]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rec Types Completed:  8/8 (100%)
Overall Match Rate:   98.2% ($12.4B matched of $12.6B total)
Exceptions Open:      23 ($18.5M — 0.15% of total)
Critical Items:       0
Aged > 90 Days:       0
Auto-Resolution Rate: 84%
Status:               READY FOR SIGN-OFF
```

### 2. KPI Dashboard

| Metric | Target | Actual | Status | Trend |
|--------|--------|--------|--------|-------|
| Match Rate | >98% | 98.2% | PASS | +0.3% vs prior |
| Exception Value | <1% | 0.15% | PASS | -0.05% vs prior |
| Aged >90 Days | 0 | 0 | PASS | Maintained |
| Auto-Resolution | >80% | 84% | PASS | +2% vs prior |
| Completion by T+5 | 100% | 100% | PASS | On schedule |
| Critical Items | 0 | 0 | PASS | — |

### 3. Exception Detail

For each open exception at certification time:
- Exception ID, amount, type, severity
- Root cause statement
- Resolution action (proposed or in-progress)
- Owner and expected clear date
- Justification for carrying into certification (if applicable)

### 4. Trend Analysis

```
MATCH RATE TREND (12 months):
  Jul: 97.1% → Aug: 97.5% → Sep: 97.8% → Oct: 98.0% → Nov: 98.1% → Dec: 98.2%
   Consistently improving — target achieved and maintained since Oct

EXCEPTION COUNT TREND:
  Q1: 45 avg → Q2: 32 avg → Current: 23
   49% reduction YoY — auto-resolution driving improvement

RESOLUTION TIME TREND:
  Q1: 8.2 days avg → Q2: 4.1 days → Current: 2.3 days
   72% improvement — pattern learning effective
```

### 5. Sign-Off Workflow

```
CERTIFICATION SIGN-OFF CHAIN:

  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │  Preparer   │ ── │  Reviewer   │ ── │ Controller  │ ── │  VP Finance │
  │  (Analyst)  │     │  (Senior)   │     │             │     │  (if matl)  │
  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       T+3                 T+4                 T+5               T+5 (escalation)

  Each signer attests:
  • All reconciliations within scope are complete
  • Exceptions are classified and have resolution plans
  • No items exceed materiality without documented justification
  • Trends are understood and process improvements identified
```

---

## Certification Status Model

```
PENDING         — Reconciliation in progress, not ready for review
IN_REVIEW       — Matching complete, exceptions being classified
EXCEPTIONS_OPEN — Certified with documented open items (< materiality)
READY           — All criteria met, awaiting sign-off chain
CERTIFIED       — All signers have approved
REJECTED        — Signer identified issue, returned for rework
```

---

## Output Formats

| Format | Use Case | Contents |
|--------|----------|----------|
| JSON | API/system integration | Full structured data |
| DOCX | Formal audit trail | Formatted report with signatures |
| HTML/Streamlit | Interactive dashboard | Live KPIs with drill-down |
| XLSX | Working papers | Detail with pivot-ready structure |
| PDF | Board/committee reporting | Summarized with charts |

---

## Regulatory Compliance Checks

Before certification, verify:

| Check | Standard | Requirement |
|-------|----------|-------------|
| SOX/CSOX | Internal Controls | All material accounts reconciled; ICFR evidence retained |
| OSFI | Guideline E-23 | Prudential return data reconciled to GL |
| IFRS 17 | CSM/RA/LC | Roll-forward reconciles to GL 2500/2510/2520 |
| IFRS 9 | ECL Staging | Stage 1/2/3 balances reconcile to provision model |
| Basel III | Capital | RWA reconciles to GL (CET1 waterfall validated) |

---

## Cross-References

- **recon-orchestrator** — triggers certification after all resolutions complete
- **exception-classifier** — provides classified exception data for the package
- **recon-resolution-agent** — provides resolution status for open items
- **period-close** — certification feeds into overall close checklist
