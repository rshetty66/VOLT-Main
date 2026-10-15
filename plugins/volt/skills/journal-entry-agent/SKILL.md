---
name: journal-entry-agent
description: >
  Autonomous Journal Entry Agent for financial services. Validates journal entries against
  accounting policy (US GAAP + IFRS), checks segregation of duties, applies anomaly detection,
  and posts to Oracle ERP Cloud via MCP (FBDI upload or REST API).
  Activates when users ask about "journal entry", "manual journal", "JE", "journal posting",
  "adjusting entry", "correcting entry", "reclassification entry", "accrual entry",
  "reversal entry", "recurring journal", "allocation journal",
  "intercompany journal", "elimination journal", "consolidation journal",
  "topside entry", "management adjustment",
  "journal approval", "journal workflow", "SOD", "segregation of duties",
  "preparer approver", "dual control", "four-eyes principle",
  "journal validation", "journal anomaly", "unusual journal",
  "post journal", "upload FBDI", "Oracle GL journal",
  "period close journal", "close calendar", "subledger journal",
  "provision journal", "impairment journal", "ECL journal",
  "hedge journal", "FV adjustment journal", "revaluation journal",
  "insurance reserve journal", "CSM journal", "IFRS 17 journal",
  "NII accrual", "fee accrual", "tax provision journal",
  or any journal entry validation, posting, or compliance question.
version: 1.0.0
disable-model-invocation: true
---

# Journal Entry Agent — Autonomous Validation, Compliance & Posting Intelligence

## Agent Overview

An autonomous agent that receives journal entry requests (from humans or other agents),
validates against accounting policy and historical patterns, enforces segregation of duties,
tags with applicable standards, routes for approval, and posts to Oracle ERP Cloud GL
via MCP — maintaining a complete audit trail of all decisions.

---

## Agent Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│              JOURNAL ENTRY AGENT WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: RECEIVE                                                     │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Input sources:                                              │     │
│  │   • Manual request (user via Chat)                         │     │
│  │   • Reconciliation Agent (exception resolution entries)    │     │
│  │   • Variance Agent (correcting entries after analysis)     │     │
│  │   • Close Calendar (recurring/template entries)            │     │
│  │   • External (bulk upload from subledger or spreadsheet)   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 2: VALIDATE                                                    │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Validation checks:                                          │     │
│  │    Account validity (COA segment combination valid?)      │     │
│  │    Period status (is target period open for posting?)     │     │
│  │    Debit = Credit (balanced entry)                        │     │
│  │    Currency consistency (functional vs transaction)       │     │
│  │    Entity/legal entity valid for accounts used           │     │
│  │    Required fields complete (description, support ref)   │     │
│  │    Accounting standard compliance (IFRS/US GAAP)         │     │
│  │    Reasonableness (vs historical average ± 3σ)           │     │
│  │    Duplicate detection (same amount/account/date)        │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 3: SOD CHECK (Segregation of Duties)                           │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Enforce:                                                    │     │
│  │   • Preparer ≠ Approver ≠ Poster                          │     │
│  │   • Amount-based approval authority                        │     │
│  │   • Entity-specific delegation                             │     │
│  │   • Conflict-of-interest check (related parties)          │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 4: POLICY TAG                                                  │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Tag with applicable accounting standard:                    │     │
│  │   • IFRS 9 (ECL provision, FV adjustment, hedge)          │     │
│  │   • IFRS 17 (CSM release, RA release, onerous loss)       │     │
│  │   • IFRS 15 / ASC 606 (revenue recognition)              │     │
│  │   • IFRS 16 / ASC 842 (lease entries)                     │     │
│  │   • IAS 12 / ASC 740 (tax provision)                      │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 5: APPROVE ROUTING                                             │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Route based on amount and type:                             │     │
│  │   Amount < $100K → Team Lead                              │     │
│  │   Amount $100K-$1M → Controller                           │     │
│  │   Amount $1M-$10M → VP Finance                            │     │
│  │   Amount > $10M → CFO                                     │     │
│  │   Topside/Management adjustment → CFO always              │     │
│  │   Intercompany → Both entity controllers                  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 6: POST via MCP                                                │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ oracle_erp MCP:                                             │     │
│  │   upload_fbdi(journal_csv) — Bulk via FBDI interface       │     │
│  │   check_job_status(job_id) — Verify import success        │     │
│  │   run_sql_query(verify posted JE)                          │     │
│  │                                                             │     │
│  │ Pilot mode: Human approval gate before actual posting     │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 7: AUDIT TRAIL                                                 │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Immutable log:                                              │     │
│  │   • Timestamp + validation results                         │     │
│  │   • SOD verification + approval chain                      │     │
│  │   • Policy tag + standard reference                        │     │
│  │   • Posting confirmation (JE number, ledger, period)      │     │
│  │   • Source agent/human that initiated                      │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tool Invocations

| Step | MCP Server | Tool | Parameters | Purpose |
|------|-----------|------|------------|---------|
| Validate | oracle_erp | `run_sql_query` | COA validation, period status | Check account/period validity |
| Validate | oracle_erp | `browse_schema` | GL_CODE_COMBINATIONS | Discover valid segment combos |
| Anomaly | oracle_erp | `run_sql_query` | Historical JE amounts for account | Baseline for anomaly detection |
| Post | oracle_erp | `upload_fbdi` | GL_INTERFACE CSV payload | Upload journal for import |
| Confirm | oracle_erp | `check_job_status` | ESS job_id from upload | Verify import success/failure |
| Confirm | oracle_erp | `run_sql_query` | Query GL_JE_HEADERS/LINES | Confirm posted JE details |

---

## Industry Journal Entry Patterns

### Banking — Monthly Close Sequence

```
T+1: Automated entries
  1. NII accrual (Dr: Accrued Interest Receivable, Cr: Interest Income)
  2. Fee income accrual (Dr: Accrued Fees, Cr: Fee Income)
  3. FX revaluation (Dr/Cr: FX Gain/Loss vs Monetary items)
  4. Trading book MTM (Dr/Cr: Trading P&L vs Trading Assets/Liabilities)

T+2: Model-driven entries
  5. ECL provision — IFRS 9 (Dr: Provision Expense, Cr: Allowance)
  6. CVA/DVA adjustment (Dr/Cr: Credit Valuation Adjustment)
  7. FTP allocation (Dr: Business Unit Cost, Cr: Treasury)

T+3: Judgment entries
  8. Management overlay on ECL (Dr: Provision Expense, Cr: Allowance)
  9. Restructuring provisions (Dr: Restructuring Expense, Cr: Provision)
  10. Litigation provisions (Dr: Legal Expense, Cr: Provision)

T+4: Consolidation
  11. Intercompany eliminations (Dr: ICO Payable, Cr: ICO Receivable)
  12. Minority interest (Dr: NI, Cr: NCI Share)

T+5: Final
  13. Tax provision current + deferred (Dr: Tax Expense, Cr: Tax Payable/DTA/DTL)
  14. Topside adjustments (requires CFO approval)
```

### Insurance — Monthly Close Sequence

```
T+1: Premium & Claims
  1. Premium earning (Dr: Unearned Premium Reserve, Cr: Earned Premium)
  2. Claims incurred (Dr: Claims Expense, Cr: Claims Reserve)
  3. Claims paid (Dr: Claims Reserve, Cr: Cash)
  4. Salvage/subrogation (Dr: Salvage Receivable, Cr: Claims Expense)

T+2: Reserves & Reinsurance
  5. IBNR adjustment (Dr: Claims Expense, Cr: IBNR Reserve)
  6. Reinsurance ceded premium (Dr: Reinsurance Asset, Cr: Ceded Premium)
  7. Reinsurance recoverable (Dr: RI Recoverable, Cr: Ceded Claims)

T+3: IFRS 17 Entries
  8. CSM release (Dr: CSM Liability, Cr: Insurance Revenue)
  9. Risk adjustment release (Dr: RA Liability, Cr: Insurance Revenue)
  10. Loss component (Dr: Insurance Revenue, Cr: Loss Component)
  11. Interest accretion on CSM (Dr: Finance Expense, Cr: CSM)

T+4: Investments
  12. Investment income accrual (Dr: Accrued Income, Cr: Investment Income)
  13. FVOCI revaluation (Dr: Investment, Cr: OCI Reserve)
  14. Impairment (Dr: Impairment Expense, Cr: Investment)

T+5: Final
  15. DAC amortization (Dr: Amortization Expense, Cr: DAC)
  16. Tax provision (Dr: Tax Expense, Cr: Tax Payable)
  17. LICAT capital adjustments
```

---

## Validation Rules Engine

### Mandatory Checks

| Check | Rule | Fail Action |
|-------|------|-------------|
| Balanced | Sum(Debit) = Sum(Credit) | Reject |
| Valid Account | All segments exist in COA | Reject |
| Open Period | Target period status = "Open" | Reject |
| Required Fields | Description, category, source | Reject |
| Currency | Consistent with account setup | Reject |

### Policy Checks

| Check | Rule | Fail Action |
|-------|------|-------------|
| Reasonableness | Amount within ±3σ of 12-month history | Flag for review |
| Duplicate | Same account + amount + date within 5 days | Flag |
| Round Amount | Exact round number > $1M | Flag |
| Cross-Entity | ICO journal without matching pair | Reject |
| Prior Period | Posting to closed or prior period | Require Controller approval |

### Anomaly Detection Scoring

```
Score 0-30:  Normal → auto-approve if within delegation
Score 31-60: Elevated → additional reviewer required
Score 61-80: High → controller review required
Score 81-100: Critical → CFO + internal audit notification

High-score triggers:
  - "management override", "CEO request", "skip approval"
  - First-time account combination for this preparer
  - Amount > 10x typical for this journal category
  - Weekend/holiday posting
  - Reversal of entry < 7 days old
```

---

## SOD Matrix

```
DELEGATION AUTHORITY:
  < $100K:     Team Lead
  $100K-$1M:   Controller
  $1M-$10M:    VP Finance
  > $10M:      CFO
  Topside:     CFO (always, regardless of amount)
  Prior period: Controller + External Audit notification
  Intercompany: Both entity controllers

ENFORCEMENT:
  Preparer ≠ Approver ≠ Poster (three-way separation)
  Violation → Block posting, route to alternate approver
```

---

## FBDI Upload Format

### GL_INTERFACE CSV Structure

| Field | Example |
|-------|---------|
| Ledger | CA Primary Ledger |
| Accounting Date | 2026-03-31 |
| Journal Source | VOLT_JE_AGENT |
| Journal Category | Provision |
| Journal Name | ECL_2026_03_AUTO_001 |
| Currency | CAD |
| Line: Account Segments | 01.5100.001.100.000 |
| Line: Debit/Credit Amount | 5000000 / 0 |
| Line: Description | Monthly ECL provision — Stage 2 migration |

---

## Configuration

```json
{
  "agent_id": "journal-entry-agent",
  "mcp_servers": ["oracle_erp"],
  "parameters": {
    "mode": "pilot",
    "human_approval_gate": true,
    "auto_post_threshold": 100000,
    "anomaly_score_threshold": 60,
    "sod_enforcement": "strict",
    "posting_method": "fbdi",
    "ledger": "CA Primary Ledger",
    "source": "VOLT_JE_AGENT"
  },
  "integration": {
    "receives_from": ["reconciliation-agent", "variance-analysis-agent", "close_calendar"],
    "feeds_to": ["oracle_erp_gl", "variance-analysis-agent"]
  }
}
```

---

## Cross-References

- **Reconciliation Agent** — Primary source of exception-resolution journal entries
- **Variance Analysis Agent** — May trigger correcting entries; consumes posted entries
- **Accounting Policy Engine** — Rules for validation and policy tagging
- **Oracle ERP Wiki** — GL journal import (FBDI), REST API, approval workflow
- **Oracle EPM Wiki** — ARCS close tasks, FCCS consolidation journals