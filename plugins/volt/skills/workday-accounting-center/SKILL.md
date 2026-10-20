---
name: workday-accounting-center
description: >-
  Workday Accounting Center specialist — subledger accounting engine, accounting rules,
  journal generation, custom book codes, event-driven accounting, multi-GAAP support,
  and integration with Workday Financials GL. Use when implementing complex accounting
  requirements, multi-basis reporting (IFRS + US GAAP + statutory), or subledger designs
  that go beyond standard Workday Financials journal generation.
disable-model-invocation: true
---

# Workday Accounting Center — Implementation & Advisory Skill

## Overview

Workday Accounting Center is a **subledger accounting engine** that sits between source transactions and the General Ledger. It enables:
- Multi-GAAP / multi-basis accounting from a single transaction source
- Complex accounting rules that exceed standard Workday journal generation
- Event-driven journal creation with full auditability
- Custom book codes for regulatory, management, and statutory reporting

## Core Concepts

### Book Codes
- **Primary Book:** Matches main GL ledger (US GAAP or IFRS)
- **Secondary Books:** Statutory, tax, management, regulatory-specific
- **Book Code Rules:** Each book can have different accounting treatments for the same transaction
- **Example:** A lease transaction generates IFRS 16 entries in the IFRS book and ASC 842 entries in the US GAAP book simultaneously

### Accounting Rules Engine
- **Rule Structure:** Condition → Action (debit/credit account determination)
- **Condition Types:** Transaction type, amount thresholds, worktag values, business unit, currency
- **Action Types:** Account assignment, worktag derivation, amount calculation, intercompany generation
- **Rule Priority:** Specific rules override general rules; last-match-wins or priority-ordered

### Event-Driven Accounting
- **Source Events:** Invoice posted, payment processed, asset acquired, payroll run, expense approved
- **Event Processing:** Real-time or batch processing of source events through rules engine
- **Journal Output:** Subledger journals posted to GL with full source event traceability
- **Reconciliation:** Subledger-to-GL reconciliation reports for audit trail

### Multi-GAAP Support
| Standard | Key Differences | Book Code |
|----------|----------------|-----------|
| US GAAP (ASC) | Revenue (606), Leases (842), Credit Losses (326) | USGAAP |
| IFRS | Revenue (IFRS 15), Leases (IFRS 16), Financial Instruments (IFRS 9) | IFRS |
| Local GAAP | Country-specific statutory requirements | STAT-{country} |
| Tax Basis | Tax depreciation, deferred tax calculations | TAX |
| Management | Internal cost allocation, transfer pricing | MGMT |

## Integration with Accounting Policy Engine

Accounting Center works with the **Accounting Policy Engine** skill to ensure:
1. **Policy → Rule Translation:** Accounting policies (e.g., "capitalize leases > 12 months") become Accounting Center rules
2. **Policy Change Impact:** When IFRS/GAAP standards change, Accounting Policy Engine identifies affected rules in Accounting Center
3. **Consistency Validation:** Cross-checks journal outputs against accounting policy requirements
4. **Audit Trail:** Links every journal entry back to the governing accounting policy

### Interaction Pattern
```
Accounting Policy Engine                    Accounting Center
┌─────────────────────┐                    ┌─────────────────────┐
│ Policy Definition    │───translates──   │ Rule Configuration  │
│ Standard Mapping     │                   │ Book Code Setup     │
│ Impact Assessment    │──validates───    │ Journal Generation  │
│ Change Management    │                   │ Multi-GAAP Output   │
└─────────────────────┘                    └─────────────────────┘
```

## Implementation Patterns

### Phase 1: Foundation
1. Define book codes (primary + secondary reporting bases)
2. Map chart of accounts per book code
3. Configure base accounting rules for core transaction types
4. Set up journal generation templates

### Phase 2: Complex Scenarios
1. Multi-GAAP rules for divergent standards (lease, revenue, financial instruments)
2. Intercompany accounting rules with elimination logic
3. Currency revaluation and translation rules per book
4. Custom calculation rules for complex derivatives or hedging

### Phase 3: Automation & Governance
1. Event-driven processing configuration
2. Automated reconciliation between subledger and GL
3. Exception handling and error resolution workflows
4. Audit and compliance reporting

## Use Cases

### Insurance
- Premium recognition across IFRS 17 and local GAAP
- Claims provisioning with different bases
- Reinsurance accounting

### Banking
- Loan origination accounting (IFRS 9 vs US GAAP)
- Expected credit loss calculations
- Hedge accounting (fair value, cash flow, net investment)

### Manufacturing
- Inventory costing (standard, average, FIFO) across multiple books
- Revenue recognition for long-term contracts
- Intercompany transfer pricing

## Quality Checklist
- [ ] All required book codes defined and mapped to GL ledgers
- [ ] Accounting rules cover all material transaction types per book
- [ ] Multi-GAAP differences explicitly handled (not defaulted)
- [ ] Subledger-to-GL reconciliation reports validate within tolerance
- [ ] Event processing handles error scenarios (retry, skip, escalate)
- [ ] Audit trail complete: transaction → event → rule → journal → GL
- [ ] Integration with Accounting Policy Engine validated
