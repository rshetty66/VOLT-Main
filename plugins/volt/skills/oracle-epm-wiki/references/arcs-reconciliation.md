# Oracle ARCS — Account Reconciliation Cloud Service

Complete implementation reference for Oracle Account Reconciliation Cloud Service (ARCS).

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Account Reconciliation Cloud Service |
| **Abbreviation** | ARCS |
| **Purpose** | Balance sheet reconciliation, transaction matching, close certification, compliance |
| **Key Users** | Accountants, controllers, close managers, internal audit |
| **Typical Implementation** | 8-14 weeks |
| **Replaces (On-Prem)** | Hyperion Financial Close Management (HFCM) — Account Reconciliation module |

---

## ARCS Capabilities

| Capability | Description |
|------------|-------------|
| **Reconciliation Compliance** | Systematic balance sheet rec process with workflow, certification, and aging |
| **Transaction Matching** | Automated matching of sub-ledger to GL, bank to GL, system-to-system |
| **Variance Analysis** | Threshold-based variance alerting on rec balances |
| **Close Certification** | Attestation that all accounts are reconciled and reviewed |
| **Risk Rating** | Auto-risk classification (High/Medium/Low) driving rec frequency and review requirements |
| **Aging Analysis** | Track open items by age bucket; escalation for stale items |
| **Attachments & Commentary** | Supporting documentation, explanations stored per reconciliation |
| **Dashboards** | Executive view of close progress, open items, aging, compliance |

---

## Reconciliation Types

### Format Types

| Format | Purpose | When to Use |
|--------|---------|-------------|
| **Account Analysis** | Explain the balance by listing components | Accruals, provisions, deferred revenue — any account where you explain what makes up the total |
| **Balance Comparison** | Compare two sources (e.g., sub-ledger vs GL) | Intercompany, bank reconciliation, system-to-system |
| **Flux Analysis** | Period-over-period variance explanation | Revenue accounts, expense categories — explain changes |
| **Transaction Matching** | Line-by-line matching of two transaction sets | Bank rec (bank stmt vs GL), AP/AR detail vs GL summary |

### Frequency Configuration

| Frequency | Accounts | Risk Level |
|-----------|----------|------------|
| **Monthly** | All material accounts, high-risk accounts | High |
| **Quarterly** | Medium-risk accounts, less volatile balances | Medium |
| **Annually** | Low-risk, immaterial accounts, stable balances | Low |

**Risk-Based Reconciliation Strategy:**
- Assign risk rating per account (based on materiality, complexity, history of errors)
- High-risk: monthly reconciliation with manager review
- Medium-risk: quarterly reconciliation with peer review
- Low-risk: annual reconciliation with self-certification
- Adjust ratings annually based on error history

---

## Configuration Reference

### Profile Setup

A **profile** defines the reconciliation template for a group of accounts:

| Profile Component | Purpose |
|-------------------|---------|
| **Format** | Account Analysis, Balance Comparison, Flux, or Transaction Matching |
| **Frequency** | Monthly, Quarterly, or Annual |
| **Workflow** | Preparer → Reviewer (1 or 2 levels) |
| **Instructions** | Standard instructions for the preparer |
| **Attachments** | Required supporting documents |
| **Risk rating rules** | Auto-assign risk based on account attributes |
| **Threshold rules** | Acceptable variance thresholds (amount or %) |
| **Aging buckets** | Define aging periods for open items (0-30, 31-60, 61-90, 90+) |
| **Auto-reconcile rules** | Accounts that can be auto-certified if variance < threshold |

### Account Mapping (Organizational Structure)

```
Enterprise
├── Legal Entity A (CAD)
│   ├── 1100 - Cash and Cash Equivalents [Bank Rec - Transaction Matching]
│   ├── 1200 - Accounts Receivable [Balance Comparison - Sub-ledger vs GL]
│   ├── 1300 - Prepaid Expenses [Account Analysis - Itemize components]
│   ├── 1400 - Fixed Assets [Balance Comparison - FA Sub vs GL]
│   ├── 2100 - Accounts Payable [Balance Comparison - AP Sub vs GL]
│   ├── 2200 - Accrued Liabilities [Account Analysis - List accruals]
│   ├── 2300 - Deferred Revenue [Account Analysis - Schedule]
│   └── 3xxx - Equity [Flux Analysis - Changes in equity]
└── Legal Entity B (USD)
    └── (same structure, different entity)
```

### Data Load Sources

| Source | Data Type | Load Method | Frequency |
|--------|-----------|-------------|-----------|
| ERP General Ledger | GL trial balance (account balances) | Data Integration (flat file or API) | Monthly |
| Sub-ledger systems | Detail balances (AR, AP, FA) | Flat file or API | Monthly |
| Bank statements | Bank balance + transactions | BAI2/MT940 file or API | Daily or Monthly |
| Prior period data | Carry-forward balances | System-managed | Automatic |
| Budget/Forecast | Comparison data for flux | From EPBCS via data exchange | Monthly |

**GL Balance Load File Format:**
```csv
Account,Entity,Period,Year,Balance
1100-001,Entity_A,Jan,FY26,1542300.45
1100-002,Entity_A,Jan,FY26,876210.12
1200-000,Entity_A,Jan,FY26,2341000.00
1300-001,Entity_A,Jan,FY26,145000.00
```

---

## Transaction Matching

### How Transaction Matching Works

1. **Load source transactions** (e.g., bank statement lines)
2. **Load target transactions** (e.g., GL journal detail)
3. **Apply matching rules** (amount, date, reference number)
4. **Auto-match** where rules produce 1:1 or 1:many match
5. **Present unmatched** for manual matching or investigation
6. **Reconcile** when all items matched or explained

### Matching Rule Configuration

| Rule Type | Logic | Example |
|-----------|-------|---------|
| **Exact match** | Amount + Date + Reference all equal | Bank deposit = GL receipt (same amount, date, ref#) |
| **Tolerance match** | Amount within ±$X, Date within ±N days | Bank fee vs GL entry within $0.01 and ±2 days |
| **One-to-many** | One source line = sum of multiple target lines | One bank deposit = 5 individual AR receipts |
| **Many-to-one** | Multiple source lines = one target | Daily bank fees (multiple) = one monthly GL journal |
| **Many-to-many** | Group of source = group of target | Multiple invoices paid in one batch payment |

### Matching Rule Example (Bank Reconciliation)

```
Rule 1: Exact Match (Amount + Date)
  Source: Bank statement line (Amount, Date, Reference)
  Target: GL Cash receipts/payments (Amount, Date, Reference)
  Match Criteria:
    - Amount: Source.Amount = Target.Amount (exact)
    - Date: Source.Date = Target.Date (±2 business days tolerance)
    - Reference: Optional secondary confirmation
  Result: Auto-matched (no manual intervention)

Rule 2: Amount Tolerance Match
  Source: Bank fees, interest charges
  Target: GL bank fee accrual entries
  Match Criteria:
    - Amount: |Source.Amount - Target.Amount| ≤ $1.00
    - Date: Same month
  Result: Auto-matched with tolerance note

Rule 3: One-to-Many (Batch Deposits)
  Source: One bank deposit (lump sum)
  Target: Multiple GL AR receipt entries
  Match Criteria:
    - Amount: Source.Amount = SUM(Target.Amount) ±$0.01
    - Date: Source.Date within ±1 day of Target batch date
  Result: Group match (all target lines matched to one source)
```

---

## Workflow & Compliance

### Standard Reconciliation Workflow

```
OPEN ── IN PROGRESS ── SUBMITTED ── REVIEWED ── CLOSED
                                          │
                                     (Rejected) ── IN PROGRESS (returned to preparer)
```

| State | Who | Actions Available |
|-------|-----|-------------------|
| **Open** | System | Rec is created (from schedule); preparer assigned |
| **In Progress** | Preparer | Add data, match transactions, attach docs, add commentary |
| **Submitted** | Preparer | Submit for review (once all items explained) |
| **Reviewed/Approved** | Reviewer | Accept or reject; add review comments |
| **Closed** | System/Admin | Period closed; rec locked; audit trail preserved |

### Auto-Reconcile Rules

Accounts can be **auto-certified** if they meet criteria:

| Criterion | Example |
|-----------|---------|
| Variance below threshold | GL balance - Sub-ledger balance < $100 |
| No open items | All prior open items resolved |
| Account type | Low-risk, immaterial accounts |
| Period type | Only for quarterly/annual recs when monthly shows clean |
| Historical accuracy | Account has been clean for N consecutive periods |

### Close Certification Checklist

| Check | System Validation |
|-------|-------------------|
| All accounts reconciled | No recs in "Open" status |
| All high-risk recs reviewed | Review workflow complete for HR accounts |
| No unmatched items over threshold | Transaction matching exceptions resolved |
| No aging items over policy limit | Open items within N-day policy |
| All required attachments present | Attachment checklist satisfied |
| All required commentary provided | Explanation fields populated |
| Certification attestation signed | Preparer + Reviewer signed off |

---

## Dashboards & Reporting

### Standard ARCS Dashboards

| Dashboard | Audience | Key Metrics |
|-----------|----------|-------------|
| **Close Progress** | Controller | % complete by entity, by day, trend vs prior |
| **Aging Analysis** | Finance Director | Open items by age bucket, escalation items |
| **Risk Summary** | Internal Audit | High-risk rec status, overdue items, exceptions |
| **Compliance** | CFO | Certification status, policy compliance rate |
| **Preparer Workload** | Close Manager | Recs per preparer, completion rate, bottlenecks |
| **Transaction Matching** | Accounting | Match rate %, unmatched volume, oldest unmatched |

### Key Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Reconciliation completion rate | 100% by Day 5 | # completed / # required |
| Auto-match rate | >80% | # auto-matched / total transactions |
| Unmatched items (month-end) | <5% of total | # unmatched / total items |
| Aging >60 days | 0 items | Count of items open >60 days |
| Average prep time per rec | <30 min | Total prep time / # recs |
| Review cycle time | <24 hours | Submission to approval elapsed |
| Compliance rate | 100% | # fully compliant recs / total required |
| Rework/rejection rate | <5% | # rejected / # submitted |

---

## Integration with Other EPM Modules

| Integration | Direction | Purpose |
|-------------|-----------|---------|
| FCCS → ARCS | GL balances from consolidation | Consolidated balances feed reconciliation |
| ARCS → FCCS | Rec completion status | Close Manager shows rec progress |
| ARCS → Narrative Reporting | Compliance data | Board pack includes close compliance metrics |
| ERP GL → ARCS | Source GL balances | Monthly data load for reconciliation |
| Sub-ledgers → ARCS | Detail balances for comparison | AR, AP, FA sub-ledger balances |
| Bank feeds → ARCS | Bank statement data | Transaction matching source data |

---

## Implementation Best Practices

| Area | Best Practice |
|------|---------------|
| **Profile design** | Design profiles per account group (not per account) — reduces maintenance |
| **Risk assessment** | Conduct formal risk assessment before defining frequencies |
| **Template reuse** | Create standard templates per rec type; clone for new accounts |
| **Training** | Train preparers on their specific profile types only (don't overwhelm) |
| **Thresholds** | Set realistic thresholds based on historical variances; tune after 2-3 periods |
| **Auto-match tuning** | Start conservative (exact match only); relax rules as confidence grows |
| **Rollout** | Phase rollout: pilot with 1 entity → extend to all entities over 2-3 months |
| **Change management** | Preparers resist moving from Excel; show time savings from auto-match |
| **Audit trail** | Leverage ARCS audit trail for SOX compliance evidence |
| **Period lock** | Lock periods within 48 hours of close certification to prevent retroactive changes |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Data load fails | File format mismatch (delimiter, date format) | Validate file against ARCS import spec |
| Matching rate very low (<50%) | Rules too strict; data quality issues | Relax tolerance; clean source data |
| Preparer can't see accounts | Profile/role not assigned | Check Access Control provisioning |
| Rec shows wrong balance | Load data not for correct period | Verify period mapping in data import |
| Can't submit rec | Required fields empty or open items exist | Complete all mandatory sections |
| Reviewer can't approve | Assignment not configured correctly | Check workflow assignment settings |
| Aging items not escalating | Escalation rules not configured | Set up aging rules with notification actions |
| Dashboard shows 0% | No data loaded for current period | Verify data load schedule ran successfully |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| ARCS Admin Guide | `docs.oracle.com/en/cloud/saas/account-reconcile-cloud/suarc/` |
| Transaction Matching | `docs.oracle.com/en/cloud/saas/account-reconcile-cloud/suarc/transaction_matching.html` |
| Matching Rules | `docs.oracle.com/en/cloud/saas/account-reconcile-cloud/suarc/creating_match_rules.html` |
| Profiles | `docs.oracle.com/en/cloud/saas/account-reconcile-cloud/suarc/creating_profiles.html` |
| Data Loads | `docs.oracle.com/en/cloud/saas/account-reconcile-cloud/suarc/importing_data.html` |
| Dashboards | `docs.oracle.com/en/cloud/saas/account-reconcile-cloud/suarc/dashboards.html` |
| REST API | `docs.oracle.com/en/cloud/saas/account-reconcile-cloud/arapr/` |
