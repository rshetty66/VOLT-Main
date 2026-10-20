---
name: workday-financials
description: >-
  Workday Financial Management specialist — chart of accounts design, ledger configuration,
  financial reporting, intercompany accounting, revenue recognition (ASC 606), banking &
  settlements, business assets, and Workday financial reporting (composite reports, calculated
  fields, custom report types). Use when designing or implementing Workday Financials,
  migrating from legacy ERP, or advising on Workday Finance best practices.
disable-model-invocation: true
---

# Workday Financials — Implementation & Advisory Skill

## Core Modules

### Chart of Accounts & Ledger Design
- **Worktags:** Company, Cost Center, Revenue Category, Spend Category, Fund, Grant, Program, Project, Custom Orgs
- **Ledger Types:** Actuals, Budget, Plan, Commitment, Obligation, Encumbrance
- **Account Sets:** Standard (P&L, BS), Statistical, Memo
- **Design Principle:** Flat worktag model replaces traditional segment-based COA — use worktag hierarchies for rollups, not account string segments

### Financial Reporting
- **Report Types:** Composite (multi-section), Matrix (pivot), Tabular, Calculated Fields
- **Report Writer:** Workday Report Designer with prompts, filters, calculated fields, sub-reports
- **Key Reports:** Trial Balance, Income Statement, Balance Sheet, Cash Flow, Intercompany Reconciliation
- **PRISM Integration:** Financial data marts feed Prism Analytics for advanced BI

### Accounts Payable
- **Supplier Invoice Processing:** PO-backed, non-PO, recurring, credit memos
- **Three-Way Match:** PO → Receipt → Invoice auto-matching with tolerance rules
- **Payment Processing:** Payment runs, payment elections, banking setup, positive pay
- **1099 Reporting:** Withholding setup, year-end 1099-MISC/NEC generation

### Accounts Receivable
- **Customer Invoice Processing:** Manual invoices, recurring billing, credit memos
- **Revenue Recognition:** ASC 606 performance obligations, contract-based recognition, SSP allocation
- **Collections Management:** Aging buckets, dunning letters, write-off workflows
- **Cash Application:** Manual and auto-match for lockbox deposits

### Intercompany Accounting
- **Intercompany Transactions:** Auto-generated matching entries across companies
- **Intercompany Profiles:** Rules for automatic offset account determination
- **Elimination Entries:** Consolidation eliminations for group reporting
- **Transfer Pricing:** Markup rules, cost-plus, resale-minus configurations

### Banking & Settlements
- **Bank Account Setup:** Multiple banks, accounts, routing, formats (BAI2, MT940, ISO 20022)
- **Bank Statement Reconciliation:** Auto-reconciliation rules, manual matching
- **Payment Formats:** ACH, Wire, Check, SEPA, BACS, EFT by country
- **Cash Position:** Real-time cash visibility across all bank accounts

### Business Assets
- **Asset Categories:** Tangible, intangible, ROU (lease), construction-in-progress
- **Depreciation Methods:** Straight-line, declining balance, sum-of-years, units-of-production
- **Asset Lifecycle:** Acquisition → Depreciation → Impairment → Disposal/Transfer
- **Lease Accounting:** ASC 842 / IFRS 16 compliance, ROU asset and liability calculations

## Implementation Patterns

### Data Migration
1. **ERP Data Mapping:** Map legacy COA segments to Workday worktags
2. **Opening Balances:** Load via EIB (Enterprise Interface Builder) or Workday Integration Cloud
3. **Historical Data:** Determine cutover strategy — summary balances vs. detailed transactions
4. **Parallel Run:** Run legacy and Workday in parallel for 1-2 periods to validate

### Configuration Sequence
1. Organizations (Company, Cost Center hierarchy)
2. Worktag setup and hierarchies
3. Ledger accounts and account sets
4. Accounting rules (journal sources, default worktags)
5. Banking and payment setup
6. AP/AR configuration
7. Financial reporting
8. Security roles and business process policies

### Integration Touchpoints
- **Prism Analytics:** Financial data for advanced analytics
- **Workday Adaptive Planning:** Budget vs. Actuals integration
- **Accounting Center:** Subledger accounting for complex scenarios
- **HCM Payroll:** Payroll journal entries to GL
- **Procurement:** PO and receipt data for AP matching
- **External Banks:** ISO 20022, BAI2, SWIFT for banking connectivity

## Quality Checklist — Workday Financials Deliverables
- [ ] Chart of Accounts design follows Workday flat worktag model
- [ ] All ledger types defined (Actuals, Budget, Plan at minimum)
- [ ] Intercompany accounting rules handle all entity combinations
- [ ] Revenue recognition configured per ASC 606 / IFRS 15
- [ ] Bank formats match country-specific requirements
- [ ] Financial reports validated against legacy system outputs
- [ ] Security roles follow principle of least privilege
- [ ] Data migration validated with trial balance reconciliation
