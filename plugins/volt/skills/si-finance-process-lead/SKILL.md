---
name: si-finance-process-lead
description: >
  This skill activates when the user discusses finance process design, process
  mapping, finance process optimization, record-to-report, order-to-cash,
  procure-to-pay, account-to-report, financial close, consolidation process,
  planning process, budgeting, forecasting, process standardization, process
  harmonization, R2R, O2C, P2P, A2R, or finance process transformation across
  Oracle, SAP, Workday, or other ERP platforms.
version: 1.0.0
---

# Finance Process Lead — SI Delivery Excellence

Expert-level guidance for leading finance process workstreams in systems integration projects. Covers end-to-end process design, standardization, and optimization across all major ERP platforms.

---

## 1. Core Finance Process Areas

### Record-to-Report (R2R) / Account-to-Report (A2R)

**Process Scope:**
```
Subledger Close → GL Close → Consolidation → Reporting → Analysis
```

**Key Activities:**
| Activity | Description | Success Metrics |
|----------|-------------|-----------------|
| Subledger Close | AP, AR, FA, INV period-end | Cut-off adherence |
| Journal Entry | Accruals, adjustments, allocations | Automation % |
| Account Reconciliation | Balance sheet recs | Days to complete |
| Intercompany | Matching, elimination | Match rate % |
| Currency Translation | FX revaluation, translation | Accuracy |
| Consolidation | Multi-entity, multi-GAAP | Cycle time |
| Management Reporting | Flash, board reports | Timeliness |

**Target State Benchmarks:**
| Metric | Median | Best-in-Class |
|--------|--------|---------------|
| Days to Close | 6-8 | 3-4 |
| Manual JEs | 60-80% | <20% |
| Rec Completion | 85% by Day 5 | 95% by Day 3 |
| IC Match Rate | 85% | >95% |

### Order-to-Cash (O2C)

**Process Scope:**
```
Customer Order → Credit Check → Fulfillment → Invoice → Cash Receipt → Apply → Reconcile
```

**Key Decision Points:**
- Credit limit automation vs. manual review
- Revenue recognition timing and rules
- Collection strategy (automated dunning vs. manual)
- Cash application (auto-match vs. manual)

**Platform-Specific Considerations:**

| Platform | O2C Strengths | Considerations |
|----------|--------------|----------------|
| **Oracle ERP Cloud** | Strong revenue management, advanced collections | Complex setup |
| **SAP S/4HANA** | Integrated FIORI workflows, real-time posting | Migration complexity |
| **Workday** | Modern UX, good for services organizations | Less mature for complex manufacturing |

### Procure-to-Pay (P2P)

**Process Scope:**
```
Requisition → Approval → PO → Receipt → Invoice Match → Pay → Reconcile
```

**Automation Opportunities:**
| Process Step | Automation Approach | Typical Impact |
|--------------|--------------------|----------------|
| Requisitioning | Catalog buying, guided buying | 80% catalog compliance |
| Approval | Workflow rules, delegation | 2-day approval cycle |
| Receipt | 3-way match automation | 90% auto-match |
| Invoice Processing | OCR, AI-based capture | 70% touchless |
| Payment | Payment batch optimization | Cash flow improvement |

### Plan-to-Perform (P2P) / Budgeting & Forecasting

**Process Components:**
- Annual budget preparation
- Rolling forecasts
- Driver-based planning
- Workforce planning
- Capital planning
- Scenario modeling

**Target State:**
| Element | Current State | Target State |
|---------|--------------|--------------|
| Cycles per year | 1 (annual) | 4+ (quarterly rolling) |
| Cycle duration | 12-16 weeks | 4-6 weeks |
| Contributors | Finance only | Business + Finance |
| Versions | Single budget | Multiple scenarios |

---

## 2. Process Design Methodology

### The 5-Level Process Framework

**Level 1: Process Category**
- Record-to-Report
- Order-to-Cash
- Procure-to-Pay
- Plan-to-Perform

**Level 2: Process Group**
- Example (R2R): General Accounting, Revenue Accounting, Cost Accounting

**Level 3: Process**
- Example: Journal Entry Processing

**Level 4: Activity**
- Example: Create Journal Entry, Approve Journal Entry, Post Journal Entry

**Level 5: Task**
- Example: Select account, Enter amount, Add description, Attach support

### Process Design Principles

**1. Standardize Before Automate**
- Document current state across all entities
- Identify commonalities and variations
- Design "Global Standard" + "Local Variants"
- Automate the standard

**2. Design for the 80% Rule**
- 80% of transactions should flow straight-through
- 20% may require manual intervention
- Don't over-design for edge cases

**3. Controls by Design**
- Segregation of duties built into workflow
- Automated validations and checks
- Audit trail by default
- Exception-based monitoring

### Current State Assessment Template

```
ENTITY: [Name]
PROCESS: [R2R/O2C/P2P/etc.]

Current Systems:
- ERP: [Platform and version]
- Supporting systems: [List]
- Manual tools: [Excel, Access, etc.]

Process Metrics:
- Cycle time: [X days]
- Manual effort: [FTE]
- Error rate: [%]
- Cost per transaction: [$]

Pain Points:
1.
2.
3.

Regulatory Requirements:
- SOX controls
- Local statutory requirements
- Industry-specific

Stakeholders:
- Process owner:
- Key users:
- IT support:
```

---

## 3. Platform-Specific Process Design

### Oracle ERP Cloud

**R2R Design Patterns:**

| Component | Oracle Cloud Approach | Key Configuration |
|-----------|----------------------|-------------------|
| Subledgers | Standard subledgers (AP, AR, CM, FA, INV) | Account rules, journal line rules |
| GL | Primary/secondary ledgers | COA, calendar, currency |
| Allocations | Allocation manager | Step-down or simultaneous |
| Consolidation | Financial Consolidation Close (FCCS) | Hierarchy, methods, eliminations |
| Reporting | Financial Reporting Studio | Reports, bursting |

**Key Configuration Decisions:**
1. **Ledger Architecture**: Primary + secondary vs. reporting currency
2. **COA Structure**: Account, cost center, product, intercompany, future
3. **Calendar**: Monthly, 4-4-5, or custom
4. **Currency**: Primary, reporting, transaction
5. **Allocation Rules**: Based on GL accounts, statistical accounts, or combinations

**O2C Design Patterns:**
- Revenue Management Cloud for complex revenue
- Advanced Collections for dunning
- Lockbox for cash application

**P2P Design Patterns:**
- Self-service procurement
- Supplier portal
- Touchless invoice processing

### SAP S/4HANA

**R2R Design Patterns:**

| Component | S/4HANA Approach | Key Configuration |
|-----------|-----------------|-------------------|
| Universal Journal | Single table (ACDOCA) for actuals | Real-time reporting |
| Group Reporting | Embedded consolidation | Real-time consolidation |
| Asset Accounting | Parallel accounting supported | Depreciation areas |
| Cash Management | Integrated cash position | Liquidity forecasting |

**Key Configuration Decisions:**
1. **Chart of Accounts**: Operative vs. group chart
2. **Controlling Area**: Cost center, internal order, WBS
3. **Posting Periods**: Open/close management
4. **Document Types**: Number ranges, field status
5. **Substitution/Validation**: Real-time rules

**Unique S/4HANA Capabilities:**
- Real-time financial reporting without reconciliation
- Embedded analytics
- Machine learning for automation
- Central Finance for consolidation

### Workday

**Finance Process Design:**

| Process | Workday Approach | Considerations |
|---------|-----------------|----------------|
| GL | Unified ledger, dimensional | Strong for services |
| AP | Supplier invoices, payments | Good workflow |
| AR | Customer invoices, receipts | Less mature than AR Oracle |
| Consolidation | Embedded consolidation | Simpler setups |
| Planning | Adaptive Planning integration | Strong FP&A |

**Key Design Principles:**
- Dimensions over rigid account structure
- Business process frameworks
- Configurable approval workflows
- Strong audit trail

**Limitations to Consider:**
- Less mature for complex manufacturing
- Inventory management lighter than Oracle/SAP
- Revenue recognition requires careful design

### OneStream

**Consolidation & Reporting Focus:**

| Capability | OneStream Approach |
|------------|-------------------|
| Consolidation | Unified platform for actuals and plan |
| Intercompany | Automated matching and elimination |
| Multi-GAAP | Multiple reporting standards |
| Cash Flow | Direct and indirect methods |
| Equity Pickup | Automated calculations |

**Integration Patterns:**
- Direct Connect for SAP
- GL Connect for Oracle
- Excel/Flat file for others

---

## 4. Process Standardization Strategy

### The Harmonization Framework

**Tier 1: Global Standard** (Must be common)
- Chart of accounts backbone
- Fiscal calendar
- Core accounting policies
- Key performance indicators

**Tier 2: Regional Standard** (Regional variations)
- Tax requirements
- Local reporting standards
- Regional approval hierarchies

**Tier 3: Local Autonomy** (Entity discretion)
- Local cost center structures
- Local product codes
- Local workflows

### Standardization by Process Area

| Process Area | Standardization Approach | Typical Variation |
|--------------|-------------------------|-------------------|
| Journal Entry | Global policy, local approval | Approval limits |
| Revenue Recognition | Global policy (ASC 606/IFRS 15) | Industry interpretation |
| Expense Reimbursement | Global policy | Local per diem rates |
| Intercompany | Strict global standard | None |
| Fixed Assets | Global policy, local tax | Tax depreciation |

---

## 5. Process Testing & Validation

### Process Testing Phases

**Unit Testing:**
- Individual process steps
- Configuration validation
- Data validation rules

**Integration Testing:**
- End-to-end process flows
- Handoffs between systems
- Exception handling

**UAT (User Acceptance Testing):**
- Business process scenarios
- Month-end simulation
- Parallel testing

### Process Test Scenarios

**R2R Test Scenarios:**
1. Standard journal entry (accrual)
2. Reversing journal
3. Journal with attachments
4. Intercompany journal
5. Allocation journal
6. Foreign currency journal
7. Journal reversal
8. Period close process

**O2C Test Scenarios:**
1. Standard sales order to cash
2. Credit hold and release
3. Partial shipment
4. Return and credit
5. Write-off
6. Dispute management

**P2P Test Scenarios:**
1. Catalog purchase
2. Non-catalog purchase
3. Emergency purchase
4. 2-way match (no PO)
5. 3-way match
6. Invoice hold and release

---

## 6. Process Documentation Standards

### Required Documentation

**1. Process Narratives**
```
Process: [Name]
Objective: [What this process accomplishes]

Trigger: [What starts the process]

Steps:
1. [Role] performs [activity] using [system]
   Input: [What is needed]
   Output: [What is produced]
   System: [Transaction code or navigation]

2. [Next step]

Controls:
- [Control point]: [How it works]

Escalations:
- [Condition]: [Action]
```

**2. RACI Matrices**
```
Activity | System | Central | Regional | Local | Comments
---------|--------|---------|----------|-------|----------
JE Entry | ERP | A | C | R | Regional reviews
JE Approve | ERP | I | A | R | >$10K to Regional
```

**3. Work Instructions**
- Step-by-step user guides
- Screenshots or videos
- Tips and troubleshooting
- FAQs

---

## 7. Process Governance

### Process Governance Framework

**Process Owners:**
- Global Process Owner: Sets standards, resolves conflicts
- Regional Process Owner: Regional compliance, local adaptations
- Local Process Owner: Day-to-day execution, feedback

**Process Metrics Dashboard:**
| Metric | Target | Frequency | Owner |
|--------|--------|-----------|-------|
| Days to Close | 5 days | Monthly | R2R Lead |
| Touchless Invoices | 80% | Weekly | P2P Lead |
| DSO | 35 days | Weekly | O2C Lead |
| Forecast Accuracy | ±5% | Monthly | Planning Lead |

### Continuous Improvement

**Process Review Cadence:**
- Monthly: Operational metrics review
- Quarterly: Process owner review
- Annually: Process optimization assessment

**Improvement Identification:**
- User feedback collection
- Metric trend analysis
- Benchmark comparison
- Technology enhancement opportunities

---

## Quick Reference: Process Design Checklist

**Before Design:**
- [ ] Current state documented for all entities
- [ ] Pain points and root causes identified
- [ ] Benchmark data gathered
- [ ] Regulatory requirements mapped
- [ ] Stakeholders identified

**During Design:**
- [ ] To-be process maps created
- [ ] System configuration documented
- [ ] Controls identified
- [ ] Roles and responsibilities defined
- [ ] Test scenarios identified

**After Design:**
- [ ] Process documentation complete
- [ ] Training materials developed
- [ ] UAT completed
- [ ] Go-live readiness confirmed
- [ ] Hypercare plan established
