---
name: si-functional-lead
description: >
  This skill activates when the user discusses ERP configuration, functional
  design, system setup, module configuration, Oracle ERP Cloud, SAP S/4HANA,
  Workday Financials, OneStream, EPM configuration, PBCS, EPBCS, FCCS,
  implementation, system build, testing, UAT, or functional requirements
  across enterprise platforms.
version: 1.0.0
---

# Functional Lead — SI Delivery Excellence

Expert-level guidance for leading functional workstreams in systems integration projects. Covers configuration, setup, and implementation across Oracle, SAP, Workday, OneStream, Anaplan, and other major platforms.

---

## 1. Functional Lead Responsibilities

### Core Responsibilities

| Area | Responsibility | Deliverables |
|------|----------------|--------------|
| **Requirements** | Gather and document functional requirements | BRD, configuration workbook |
| **Design** | Solution design and configuration approach | Design documents, fit-gap |
| **Build** | System configuration and setup | Configured system, unit testing |
| **Test** | UAT planning and support | Test scripts, defect management |
| **Deploy** | Cutover and go-live support | Migration validation, hypercare |
| **Knowledge Transfer** | Train client team | Training materials, documentation |

### Functional Lead vs. Technical Lead

| Aspect | Functional Lead | Technical Lead |
|--------|-----------------|----------------|
| Focus | Business process, configuration | Integration, customization, data |
| Language | Business terminology | Technical terminology |
| Deliverables | Config docs, test scripts | Tech specs, code |
| Client Interaction | Business users, process owners | IT, developers |
| Tools | ERP config, test tools | IDEs, integration tools |

---

## 2. Oracle ERP Cloud Functional Lead

### Module Coverage

| Module | Key Configuration Areas | Complexity |
|--------|------------------------|------------|
| **General Ledger** | COA, calendars, currencies, ledgers | High |
| **Payables** | Suppliers, invoices, payments, aging | Medium |
| **Receivables** | Customers, invoices, receipts, dunning | Medium |
| **Cash Management** | Bank accounts, reconciliation, forecasting | Medium |
| **Fixed Assets** | Asset categories, depreciation, retirement | Medium |
| **Expense** | Policies, approval rules, reimbursement | Low-Medium |
| **Procurement** | Catalogs, purchasing, receiving | Medium |
| **Project Financials** | Project types, costing, billing | High |

### GL Configuration Deep Dive

**Chart of Accounts Setup:**
```
Step 1: Value Sets
- Define each segment's values
- Validation type (Independent, Table, Dependent)
- Security rules

Step 2: Accounting Flexfield
- Segment order and labels
- Separator character
- Dynamic insertion

Step 3: Account Combinations
- Allow dynamic insertion vs. manual
- Cross-validation rules
- Security rules
```

**Key Configuration Decisions:**

| Decision | Options | Considerations |
|----------|---------|----------------|
| Primary Ledger | One or Many | Legal entity structure, GAAP |
| Secondary Ledgers | Reporting currency, GAAP | Translation, adjustment needs |
| Reporting Currencies | Balance, Journal, Subledger | Performance, reporting needs |
| Calendar | Monthly, 4-4-5, Custom | Industry, statutory |
| Budgetary Control | Absolute, Advisory, None | Control vs. flexibility |

**Journal Setup:**
- Journal categories (accrual, adjustment, reclassification)
- Journal sources (manual, subledger, allocations)
- Reversing journal templates
- AutoPosting vs. manual posting
- Approval rules

### Payables Configuration

**Supplier Model:**
- Supplier vs. Supplier Site
- Procurement vs. Payables sites
- Bank accounts and payment methods
- Tax reporting

**Invoice Processing:**
- Invoice types (Standard, Credit Memo, Prepayment)
- Matching options (2-way, 3-way, 4-way)
- Hold reasons and release rules
- Tolerances (quantity, price, tax)

**Payment Processing:**
- Payment methods (Check, ACH, Wire)
- Payment formats
- Payment process profiles
- Positive pay

### Receivables Configuration

**Customer Model:**
- Customer account vs. site
- Bill-to vs. Ship-to
- Payment terms
- Credit limits and review

**Revenue Recognition:**
- Revenue scheduling rules
- Contingency removal
- Revenue accounting rules
- Integration with Revenue Management Cloud

**Collections:**
- Aging buckets
- Dunning plans
- Collections strategies
- Scoring models

### EPM Cloud Functional Lead

**PBCS (Planning and Budgeting Cloud):**

| Component | Configuration Focus |
|-----------|---------------------|
| Dimensions | Account, Entity, Scenario, Version, Period |
| Forms | Data entry, workflow |
| Rules | Calculation, allocation |
| Approval | Workflow, notifications |
| Reports | Financial, operational |

**EPBCS (Enterprise Planning):**
- Workforce planning
- Capital planning
- Project planning
- Sales planning

**FCCS (Financial Consolidation and Close):**
- Hierarchy management
- Consolidation methods
- Elimination rules
- Translation methods
- Journals (consolidation adjustments)

**ARCS (Account Reconciliation):**
- Format design
- Auto-reconciliation rules
- Transaction matching
- Risk rating

---

## 3. SAP S/4HANA Functional Lead

### S/4HANA Key Differences from ECC

| Area | ECC | S/4HANA |
|------|-----|---------|
| Tables | Multiple (BKPF, BSEG) | Universal Journal (ACDOCA) |
| COEP | CO line items | Deprecated, use ACDOCA |
| Costing | Costing-based CO-PA | Account-based CO-PA (recommended) |
| AA | Multiple depreciation areas | Ledger approach |
| Cash Mgmt | Separate component | Embedded |
| Material Ledger | Optional | Required |

### Financial Accounting (FI) Configuration

**Global Settings:**
- Company codes
- Fiscal year variants
- Posting periods
- Currencies

**General Ledger:**
- Chart of accounts
- Account groups
- Field status groups
- Posting keys
- Document types
- Number ranges

**Accounts Payable:**
- Vendor master
- Payment terms
- Payment methods
- Automatic payment program
- Tolerances
- Down payments

**Accounts Receivable:**
- Customer master
- Credit management
- Dunning procedure
- Collection management
- Dispute management

**Asset Accounting:**
- Chart of depreciation
- Depreciation areas
- Asset classes
- Depreciation keys
- Asset under construction

### Management Accounting (CO) Configuration

**Controlling Area:**
- Assignment to company codes
- Currency and fiscal year
- Cost center standard hierarchy
- Profit center standard hierarchy

**Cost Center Accounting:**
- Standard hierarchy
- Cost center categories
- Activity types
- Statistical key figures

**Internal Orders:**
- Order types
- Settlement rules
- Budget management
- Availability control

**Profitability Analysis (CO-PA):**
- Operating concern
- Characteristics
- Value fields (costing-based)
- Accounts (account-based)

**Product Costing:**
- Costing variants
- Valuation variants
- Cost component structure
- Material ledger

### Central Finance

**Use Cases:**
- Consolidation hub
- S/4HANA migration path
- Real-time reporting

**Key Components:**
- SLT replication
- Mapping (MDG or custom)
- Central payment
- Central procurement

---

## 4. Workday Functional Lead

### Workday Finance Modules

| Module | Scope | Configuration Focus |
|--------|-------|---------------------|
| **Financial Accounting** | GL, AP, AR, Assets | Organizations, dimensions |
| **Procurement** | Requisitions, POs, receipts | Catalogs, suppliers |
| **Expense** | Expense reports | Policies, approvals |
| **Projects** | Project accounting | Project types, billing |
| **Cash Management** | Banking, reconciliation | Bank accounts, rules |
| **Consolidations** | Multi-entity, multi-GAAP | Hierarchies, methods |

### Workday-Specific Concepts

**Business Process Framework:**
- Business process definitions
- Approval chains
- Condition rules
- Notification rules

**Organizations:**
- Company
- Cost Center
- Region
- Custom organizations
- Hierarchies

**Dimensions:**
- Worktags (custom dimensions)
- Derived worktags
- Balancing worktags
- Optional worktags

**Calculations:**
- Calculation fields
- Condition rules
- Allocations

### Workday Configuration Approach

**1. Foundation Setup:**
- Tenant configuration
- Organizations
- Locations
- Currencies
- Calendars

**2. COA Design:**
- Account structure (natural accounts)
- Worktags (dimensions)
- Account sets
- Account posting rules

**3. Business Processes:**
- Define process steps
- Configure approvals
- Set up notifications
- Enable audit trail

**4. Security:**
- Domain security policies
- Business process security
- Report security
- Functional areas

---

## 5. OneStream Functional Lead

### OneStream Core Concepts

**Dimensions:**
- Account (required)
- Entity (required)
- Scenario (required)
- Time (required)
- Custom dimensions (up to 20)

**Cubes:**
- Data storage structure
- Multiple cubes for different purposes
- Cube views for reporting

**Workflow:**
- Import
- Validate
- Process (calculations)
- Consolidate
- Translate
- Promote

### OneStream Configuration Areas

**Consolidation Setup:**
- Entity hierarchy
- Consolidation methods
- Ownership management
- Elimination accounts

**Translation Setup:**
- Currencies
- Translation methods
- Rate types (Average, Ending, Historical)
- Override capabilities

**Intercompany:**
- Intercompany matching
- Auto-elimination
- Intercompany reports

**Journals:**
- Journal types
- Workflow approval
- Audit trail
- Attachments

**Extensibility:**
- Business rules (VB.NET)
- Dashboards
- Reports
- Excel add-in

---

## 6. Anaplan Functional Lead

### Anaplan Core Concepts

**Workspaces:**
- Container for models
- User access at workspace level

**Models:**
- Individual planning applications
- Multi-dimensional

**Dimensions:**
- Lists (custom dimensions)
- Time
- Versions

**Modules:**
- Data storage and calculations
- Line items (measures)
- Formulas

**Lists:**
- Hierarchical
- Flat
- Numbered

### Anaplan Configuration Areas

**Model Design:**
- Module structure
- Line item formulas
- Summary methods
- Time settings
- Version settings

**Data Integration:**
- Import actions
- Export actions
- Anaplan Connect
- CloudWorks
- APIs

**User Experience:**
- Dashboards
- New UX (Pages)
- Mobile
- Alerts

**Calculation Engine:**
- Formulas
- LOOKUP, SELECT, SUM
- Time functions
- Planning functions

---

## 7. Cross-Platform Functional Design

### Requirements Gathering

**Functional Requirements Document (FRD) Structure:**
```
1. Introduction
   - Scope
   - Objectives
   - Constraints

2. Current State
   - Pain points
   - Manual workarounds

3. Future State Requirements
   - By process area
   - By module

4. Integration Requirements
   - Inbound
   - Outbound

5. Reporting Requirements
   - Standard reports
   - Custom reports
   - Analytics

6. Security Requirements
   - Roles
   - Segregation of duties

7. Appendix
   - Data migration scope
   - Open items
```

### Fit-Gap Analysis

| Requirement | Fit/Gap | Standard/Config/Custom | Effort | Priority |
|-------------|---------|------------------------|--------|----------|
| Req 1 | Fit | Standard | Low | Must |
| Req 2 | Gap | Configuration | Medium | Must |
| Req 3 | Gap | Customization | High | Should |

### Configuration Management

**Configuration Workbook:**
- Environment tracking (DEV, TEST, PROD)
- Configuration item ID
- Description
- Values
- Owner
- Status
- Sign-off

**Configuration Documentation:**
- Screen captures
- Step-by-step instructions
- Business rationale
- Dependencies

---

## 8. Testing Strategy

### Testing Pyramid

```
        /\
       /  \  UAT (Business)
      /____\
     /      \  SIT (Integration)
    /________\
   /          \  Unit Testing (Functional)
  /____________\
```

### Test Script Template

```
Test Script: [ID]
Description: [What is being tested]
Pre-requisites: [Setup required]

Step | Action | Expected Result | Actual | Status | Notes
-----|--------|-----------------|--------|--------|-------
1    |        |                 |        |        |
2    |        |                 |        |        |

Test Data:
- [Specific values to use]

Approval:
- Tester:
- Date:
- Functional Lead:
```

### Defect Management

| Severity | Definition | Response Time |
|----------|------------|---------------|
| Critical | Showstopper, no workaround | 24 hours |
| High | Major functionality impacted | 48 hours |
| Medium | Workaround exists | 1 week |
| Low | Cosmetic | Next release |

---

## 9. Cutover & Go-Live

### Cutover Activities

**Pre-Cutover:**
- Final configuration freeze
- Open period configuration
- Security provisioning
- User training completion

**Cutover Weekend:**
- Final data extraction
- Data migration
- Reconciliation
- Smoke testing
- Go/no-go decision

**Post-Cutover:**
- Hypercare support
- Issue triage
- User assistance
- Performance monitoring

### Go-Live Readiness Checklist

- [ ] All configuration complete and tested
- [ ] Data migration validated
- [ ] UAT sign-off obtained
- [ ] User training completed
- [ ] Support team ready
- [ ] Rollback plan documented
- [ ] Go/no-go decision made

---

## Quick Reference: Platform Selection Matrix

| Requirement | Oracle | SAP | Workday | OneStream | Anaplan |
|-------------|--------|-----|---------|-----------|---------|
| Complex manufacturing |  |  |  | N/A | N/A |
| Services organization |  |  |  | N/A | N/A |
| Financial consolidation |  (FCCS) |  (Group) |  |  | N/A |
| Planning & budgeting |  (PBCS) |  (BPC) |  |  |  |
| Ease of use |  |  |  |  |  |
| Global scalability |  |  |  |  |  |
| Integration complexity |  |  |  |  |  |
