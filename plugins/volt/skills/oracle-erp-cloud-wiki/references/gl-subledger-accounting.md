# Oracle ERP Cloud — General Ledger & Subledger Accounting

Complete implementation reference for Oracle Cloud GL and Subledger Accounting (SLA).

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Oracle General Ledger Cloud + Subledger Accounting |
| **Purpose** | Financial recording, COA management, journal processing, period close, reporting, multi-GAAP |
| **Key Users** | GL accountants, controllers, financial reporting team |
| **Typical Implementation** | 10-16 weeks (GL alone); part of broader Financials implementation |

---

## General Ledger Architecture

### Chart of Accounts (COA) Structure

Oracle ERP Cloud uses a **flexible COA structure** with segments:

| Component | Purpose | Example |
|-----------|---------|---------|
| **Chart of Accounts** | The segment structure definition | "Corporate COA" |
| **Value Sets** | List of valid values per segment | "Entity Values", "Account Values" |
| **Account Combinations** | Valid intersections of segment values | "100-1100-000-0000" |
| **Cross-Validation Rules** | Rules preventing invalid combinations | "Entity 100 cannot use Account 9xxx" |
| **Segment Qualifiers** | Natural Account, Balancing, Cost Center, Intercompany | Each segment gets one qualifier |

**Standard Segment Design (6-segment):**

```
[Company]-[Account]-[Cost Center]-[Department]-[Project]-[Intercompany]
  100    -  1100   -    5001     -   MKTG     -  0000   -    000
```

| Segment | Qualifier | Width | Example Range |
|---------|-----------|-------|---------------|
| Company | Balancing | 3 | 100-999 |
| Account | Natural Account | 4-6 | 1000-9999 |
| Cost Center | Cost Center | 4-5 | 5001-5999 |
| Department | — | 4 | MKTG, FINA, OPER |
| Project | — | 4-8 | P00001-P99999 |
| Intercompany | Intercompany | 3 | 000 (none), 100-999 (IC entity) |

### Ledger Configuration

| Ledger Component | Description | Key Decision |
|-----------------|-------------|--------------|
| **Primary Ledger** | Main recording ledger (one per legal entity or group) | COA + Calendar + Currency + Accounting Method |
| **Secondary Ledger** | Alternative accounting (IFRS vs local GAAP) | Different accounting method, same transactions |
| **Reporting Currency** | Balance-level currency translation | Additional currency view of primary ledger |
| **Accounting Calendar** | Fiscal period definitions | Standard (Jan-Dec), 4-4-5, 4-5-4, custom |
| **Accounting Method** | Subledger Accounting rules | Standard Accrual, Cash, Custom |

### Multi-GAAP / Multi-Book Architecture

```
Transaction (AP Invoice, AR Receipt, FA Depreciation)
    │
    ├── Primary Ledger (IFRS) ──── Subledger Accounting Rules (IFRS)
    │
    │    Journal Entry (IFRS treatment)
    │
    └── Secondary Ledger (Local GAAP) ──── SLA Rules (Local GAAP)

         Journal Entry (Local treatment)
```

---

## Journal Processing

### Journal Types

| Type | Description | Creation Method |
|------|-------------|-----------------|
| **Subledger Journals** | Auto-created from AP/AR/FA/Projects | Subledger Accounting engine (Create Accounting) |
| **Manual Journals** | User-entered adjustments | Manual entry or spreadsheet upload |
| **Recurring Journals** | Repeat each period (amortization, allocations) | Journal template + generation |
| **Reversal Journals** | Auto-reverse next period (accruals) | Flagged at creation; auto-generated |
| **Statistical Journals** | Non-monetary (FTE, sqft, units) | Manual or interface |
| **Intercompany Journals** | Cross-entity with auto-balancing | Intercompany system or manual |

### Journal Approval Workflow

```
DRAFT ── SUBMITTED ── APPROVED ── POSTED
              │              │
         (Rejected)     (Rejected) ── Back to DRAFT
```

**Approval Rules:**
- Configurable by ledger, journal source, amount threshold, or category
- BPM workflow with email notifications
- Segregation of duties: poster ≠ approver

---

## Subledger Accounting (SLA)

### What SLA Does

SLA is the **accounting rules engine** that determines HOW transactions from subledgers (AP, AR, FA, Projects) create journal entries in GL.

| Concept | Purpose |
|---------|---------|
| **Application Accounting Definition** | Which rules apply to which subledger events |
| **Journal Line Rules** | Which accounts to debit/credit for each event |
| **Account Derivation Rules** | How to determine the GL account (conditions, priorities) |
| **Accounting Method** | Collection of all rules (Standard Accrual or Custom) |
| **Event Class** | Transaction lifecycle event (Invoice Validated, Payment Created, etc.) |
| **Event Type** | Specific event within a class (Standard Invoice, Credit Memo) |

### Key SLA Concepts

```
EVENT: AP Invoice Validated

EVENT CLASS: Invoices
EVENT TYPE: Standard Invoices

JOURNAL LINE RULE: "AP Invoice Accrual"
  Debit: Expense Account (from invoice distribution)
  Credit: AP Liability Account (from supplier setup)

ACCOUNT DERIVATION RULE:
  IF distribution_account exists THEN use it
  ELSE IF default_expense_account on supplier THEN use it
  ELSE use segment default from COA

GL JOURNAL ENTRY CREATED
```

### SLA Configuration Checklist

1. Review delivered (seeded) accounting rules per subledger
2. Identify where custom accounting treatment needed (e.g., multiple GAAP)
3. Create custom Journal Entry Rule Sets where needed
4. Create custom Account Derivation Rules for non-standard accounts
5. Assign rules to Accounting Method
6. Test with Create Accounting process (draft mode first)
7. Validate journals in GL; verify account accuracy
8. Enable final mode after validation

---

## Period Close Process

### GL Close Steps

| Step | Process | Timing |
|------|---------|--------|
| 1 | Run all subledger close processes (AP/AR/FA period close) | Day 1-2 |
| 2 | Create Accounting (generate subledger journals) | Day 2 |
| 3 | Transfer journals to GL (Import) | Day 2 |
| 4 | Post all imported journals | Day 2-3 |
| 5 | Run allocations (if configured) | Day 3 |
| 6 | Post recurring journals (amortization, etc.) | Day 3 |
| 7 | Run revaluation (foreign currency balances) | Day 3-4 |
| 8 | Run translation (for reporting currencies) | Day 4 |
| 9 | Run consolidation (if multi-entity in one instance) | Day 4 |
| 10 | Review trial balance, run variance analysis | Day 4-5 |
| 11 | Post final adjustments | Day 5 |
| 12 | Close period (prevent further posting) | Day 5 |

### Period Close Status

| Status | Meaning |
|--------|---------|
| **Not Opened** | Period cannot receive transactions |
| **Future Open** | Period open for AP/AR entry but not posting |
| **Open** | Period accepting postings |
| **Closed** | Normal transactions blocked; adjustments allowed |
| **Permanently Closed** | No changes permitted |

---

## Financial Reporting

### Reporting Options

| Tool | Use Case | Key Features |
|------|----------|--------------|
| **OTBI (Transactional BI)** | Real-time transactional reporting | Pre-built subject areas; real-time; ad-hoc |
| **Financial Reporting Studio** | Formatted financial statements | Multi-dimensional; formatted; book-style |
| **Smart View** | Excel-based analysis | Ad-hoc GL queries in Excel |
| **BI Publisher** | Operational reports / scheduled | Pixel-perfect; scheduled; batch distribution |
| **GL Account Analysis** | Drill-down from balances | Real-time; drill to subledger detail |

### Account Analysis and Drill-Down

```
Trial Balance (GL Balances)
    → Drill to Journal Lines
        → Drill to Subledger Journal Entry
            → Drill to Source Transaction (AP Invoice, AR Receipt, etc.)
```

---

## Intercompany Accounting

### Intercompany Framework

| Feature | Description |
|---------|-------------|
| **Intercompany Balancing** | Auto-balance journals that cross balancing segments |
| **Intercompany Receivable/Payable** | Auto-generated IC balances on cross-entity journals |
| **Intercompany Transactions** | Dedicated IC transaction processing and approval |
| **IC Matching** | Match and reconcile IC balances between entities |
| **IC Elimination** | Consolidation elimination entries (if using GL consolidation) |

### Configuration Steps

1. Enable Intercompany Balancing on the ledger
2. Define Intercompany organization (set of related entities)
3. Configure IC Receivable and IC Payable accounts
4. Set up IC transaction types and approval rules
5. Configure auto-generation rules for IC clearing entries

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| "No accounting created" | SLA rules don't match transaction | Check event class/type mapping in accounting method |
| Journal won't post | Period closed or account invalid | Check period status; validate account combination |
| Trial balance out of balance | Incomplete posting or suspense entries | Run "Unposted Items" report; check suspense account |
| Revaluation not running | Missing rate or configuration | Verify rate type and rate loaded for period end |
| Cross-validation blocking entry | Invalid segment combination | Review CVR rules; add exception if valid |
| SmartView shows zeros | Wrong ledger or period selected | Verify connection points to correct primary ledger |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| GL Admin Guide | `docs.oracle.com/en/cloud/saas/financials/24d/faggl/` |
| Subledger Accounting | `docs.oracle.com/en/cloud/saas/financials/24d/faasl/` |
| COA Setup | `docs.oracle.com/en/cloud/saas/financials/24d/faggl/chart-of-accounts.html` |
| Period Close | `docs.oracle.com/en/cloud/saas/financials/24d/faggl/close-general-ledger.html` |
| Intercompany | `docs.oracle.com/en/cloud/saas/financials/24d/faggl/intercompany.html` |
| REST API | `docs.oracle.com/en/cloud/saas/financials/24d/farfa/` |
