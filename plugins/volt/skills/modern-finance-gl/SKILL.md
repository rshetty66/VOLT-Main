---
name: modern-finance-gl
description: >
  This skill activates when the user discusses General Ledger, Chart of Accounts,
  COA design, Accounting Hub, financial consolidation, multi-GAAP reporting,
  accounting standards (IFRS, GAAP), account hierarchies, financial dimensions,
  statutory reporting, management reporting, financial close, period end close,
  journal entries, subledger accounting, intercompany accounting, or modern
  finance architecture for large enterprises.
version: 1.0.0
---

# Modern Finance & General Ledger Excellence

Deep expertise in General Ledger architecture, Chart of Accounts design, and Accounting Hub concepts for large enterprises. This skill provides battle-tested guidance on designing finance systems that scale, comply, and deliver insight.

---

## 1. General Ledger Architecture for Large Enterprises

### Modern GL Design Principles

| Principle | Rationale | Implementation |
|-----------|-----------|----------------|
| **Single Source of Truth** | One GL for all reporting | Accounting Hub pattern with unified COA |
| **Dimensionality** | Flexible reporting without COA explosion | Separate dimensions from natural accounts |
| **Granularity** | Balance detail vs. performance | Natural account level; dimensions for analysis |
| **Standardization** | Consistent processes globally | Global COA backbone + local extensions |
| **Automation** | Reduce manual intervention | Subledger integration, auto-allocations |

### Enterprise GL Patterns

**Pattern 1: Centralized Single Instance**
- Best for: Tight integration, strong central control
- Challenges: Change control, local flexibility
- Example: Global manufacturer with unified SAP/Oracle

**Pattern 2: Accounting Hub with Multiple Ledgers**
- Best for: Diverse ERP landscape, phased consolidation
- Challenges: Hub complexity, latency
- Example: PE-backed conglomerate with acquired systems

**Pattern 3: Multi-Instance with Consolidation**
- Best for: Autonomous divisions, regulatory separation
- Challenges: Intercompany, standardization
- Example: Financial services with regulated entities

---

## 2. Chart of Accounts (COA) Design

### COA Design Principles

**The 80/20 Rule**: 20% of accounts drive 80% of reporting

**Structure Decision Framework:**

| Factor | Decision | Impact |
|--------|----------|--------|
| Account length | 6-10 digits optimal | Balance granularity with usability |
| Segments | Max 5-7 segments | Flexibility vs. complexity |
| Hierarchies | 3-4 levels typical | Roll-up capability vs. maintenance |
| Dynamic vs. Static | Dynamic for dimensions | Reduces COA bloat |

### Segment Design Patterns

**Recommended Segment Order:**
```
[Company] - [Cost Center] - [Natural Account] - [Product] - [Intercompany]
```

**Natural Account Structure (Example - 6 digits):**
```
1xxxxx - Assets
  11xxxx - Current Assets
    111xxx - Cash & Equivalents
    112xxx - Accounts Receivable
    113xxx - Inventory
  12xxxx - Non-Current Assets
2xxxxx - Liabilities
3xxxxx - Equity
4xxxxx - Revenue
5xxxxx - Cost of Sales
6xxxxx - Operating Expenses
7xxxxx - Other Income/Expense
8xxxxx - Statistical Accounts
```

### COA Governance Model

**Global vs. Local Decisions:**

| Element | Global (Corporate) | Local (Entity) |
|---------|-------------------|----------------|
| Natural account master |  Define all accounts |  Request additions |
| Account numbering |  Assign ranges |  No local numbering |
| Reporting hierarchies |  Standard roll-ups |  Custom roll-ups only in local reporting |
| Cost centers |  Guidance only |  Define locally within standards |
| Products/Projects |  |  Fully local |
| Intercompany accounts |  Standard accounts |  No local IC accounts |

### COA Optimization Patterns

**Pattern: Natural Account + Dimensions (Best Practice)**
```
Traditional COA (Problem):
  1100 - Cash - USD
  1101 - Cash - EUR
  1102 - Cash - GBP
  ... (explodes with currencies)

Modern COA (Solution):
  1100 - Cash (Natural Account)
  Currency = USD/EUR/GBP (Dimension)

  Result: 1 account + dimension vs. 50+ accounts
```

---

## 3. Accounting Hub Concept

### What is an Accounting Hub?

An Accounting Hub is a centralized finance data layer that:
- Accepts accounting events from multiple source systems
- Applies consistent accounting rules
- Produces standardized journal entries
- Feeds downstream reporting and consolidation

**The Hub Architecture:**
```
Source Systems          Accounting Hub              Downstream
├─ ERP A               ├─ Event Capture            ├─ Consolidation
├─ ERP B               ├─ Rules Engine             ├─ Planning
├─ Legacy System       ├─ Journal Generation       ├─ Reporting
├─ Subsidiary Systems  ├─ COA Mapping              ├─ Analytics
└─ External Systems    └─ Distribution             └─ Regulatory
```

### When to Implement an Accounting Hub

| Trigger | Hub Value |
|---------|-----------|
| Multiple ERP systems | Unified accounting view |
| Frequent acquisitions | Rapid integration of new entities |
| Complex multi-GAAP | Automated GAAP conversion |
| Real-time reporting | Stream of accounting events |
| Regulatory pressure | Audit trail, control |

### Hub Implementation Patterns

**Pattern 1: Oracle Accounting Hub Cloud (AHCS)**
- Best for: Oracle ecosystem, complex rules
- Features: Rule-based transformation, validation, enrichment
- Timeline: 6-9 months

**Pattern 2: SAP Central Finance**
- Best for: SAP landscape, S/4HANA migration
- Features: Real-time replication, unified journal
- Timeline: 9-12 months

**Pattern 3: Custom/ETL Hub**
- Best for: Unique requirements, tight budget
- Features: Flexible, custom logic
- Timeline: 4-6 months

---

## 4. Multi-GAAP & Statutory Reporting

### Multi-GAAP Design Patterns

**Pattern 1: Primary GAAP with Adjustment Ledgers**
```
Primary Ledger (US GAAP)

Secondary Ledger (Local GAAP)
  - Adjusting entries
  - Valuation differences
  - Recognition timing
```

**Pattern 2: Parallel Ledgers (Simultaneous)**
```
Transaction → US GAAP Ledger
          → IFRS Ledger
          → Local GAAP Ledger
```

**Pattern 3: Consolidation-Based (Post-GL)**
```
Local GAAP Ledgers → Consolidation System

                    US GAAP Adjustment
                    IFRS Adjustment
```

### Common GAAP Differences to Model

| Area | US GAAP | IFRS | Design Approach |
|------|---------|------|-----------------|
| Revenue recognition | ASC 606 | IFRS 15 | Generally aligned |
| Lease accounting | ASC 842 | IFRS 16 | Similar but not identical |
| Inventory | LIFO allowed | FIFO only | Separate valuation |
| Impairment | Two-step | One-step | Different triggers |
| R&D costs | Expensed | Capitalized if criteria met | Dual tracking |

### Statutory Reporting Framework

**Statutory Books Requirements:**
- Chart of Accounts per local requirements
- Local currency books
- Local GAAP adjustments
- Audit trail for local auditors
- Tax basis tracking

**Design Pattern:**
```
Operational Ledger (Transaction Currency)

Primary Ledger (Functional Currency, Corporate GAAP)

Statutory Ledger (Local Currency, Local GAAP)

Tax Ledger (Tax Basis)
```

---

## 5. Financial Dimensions & Hierarchies

### Dimension Strategy

**Core Dimensions (Every Enterprise):**
- Legal Entity (Company)
- Cost Center / Department
- Natural Account
- Intercompany

**Extended Dimensions (As Needed):**
- Product / Product Line
- Customer / Customer Group
- Project / Contract
- Region / Territory
- Channel

### Hierarchy Design Best Practices

**Principle 1: Separate Reporting from Operational Hierarchies**
- Operational: How business runs
- Reporting: How finance reports
- Mapping layer connects them

**Principle 2: Version Control**
- Hierarchies change over time
- Maintain history for comparative reporting
- Effective dating for all structures

**Principle 3: Balanced vs. Ragged**
- Balanced: Same levels throughout (easier for reporting)
- Ragged: Variable depth (more natural)
- Choose based on reporting tool capabilities

### Dynamic Dimension Example

```
Cost Center Structure:

Level 1: Function
  ├─ Finance
  ├─ Sales
  ├─ Operations
  └─ IT

Level 2: Department
  ├─ Finance
  │   ├─ Accounting
  │   ├─ FP&A
  │   └─ Treasury

Level 3: Team
  ├─ Accounting
  │   ├─ AP
  │   ├─ AR
  │   └─ GL

Reporting Flexibility:
  - Can roll up by Function
  - Can report by Department
  - Can analyze by Team
  - Can create cross-cutting views (e.g., all AP across company)
```

---

## 6. Intercompany Accounting

### Intercompany Elimination Strategy

**The IC Challenge:**
- Entity A sells to Entity B
- Both record transactions
- Consolidation must eliminate
- Discrepancies common (timing, currency, errors)

**Elimination Approaches:**

| Approach | Mechanism | Best For |
|----------|-----------|----------|
| **Systematic Matching** | IC accounts designed for auto-matching | Standard transactions |
| **Transaction ID** | Shared reference numbers | Complex transactions |
| **Netting** | Periodic netting of balances | High-volume trading |
| **Manual** | Accountant review and adjustment | Non-standard items |

### IC Account Design

**Standard IC Account Pattern:**
```
Intercompany Revenue:    4999xx
Intercompany COGS:       5999xx
Intercompany AR:         1299xx
Intercompany AP:         2299xx
Intercompany Investment: 17xxxx

Where xx = Counterparty entity code
```

### IC Governance

**Matching Tolerance:**
- Define acceptable variance (e.g., $1 or 0.1%)
- Auto-accept within tolerance
- Escalate outliers

**Reconciliation Cadence:**
- Daily: High-volume trading entities
- Weekly: Standard operations
- Monthly: All entities before close

---

## 7. Financial Close Optimization

### Close Process Design

**The 10-Day Close (Target):**

| Day | Activities |
|-----|------------|
| Day 0 | Period end, subledgers close |
| Day 1 | Preliminary close, top-side adjustments |
| Day 2 | Intercompany reconciliation, eliminations |
| Day 3 | Foreign currency translation |
| Day 4 | Preliminary consolidation |
| Day 5 | Management review, flux analysis |
| Day 6 | Top-side entries, accruals |
| Day 7 | Consolidation finalization |
| Day 8 | Reporting package preparation |
| Day 9 | Final review and sign-off |
| Day 10 | Board reporting complete |

### Close Automation Opportunities

**High ROI Automations:**
1. **Intercompany matching** - Auto-reconciliation
2. **Currency translation** - Automated rates and calc
3. **Elimination entries** - Rule-based eliminations
4. **Allocations** - Automated cost allocations
5. **Recurring journals** - System-generated entries
6. **Reconciliation** - Account rec auto-matching

**Close KPIs:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Calendar days to close | 5-7 days | Day 0 to Day final |
| System cut-off time | Day 0, 11:59 PM | When subledgers lock |
| Preliminary reports | Day 2 | First flash available |
| IC match rate | >95% | Auto-matched before manual |
| JE volume (manual) | <20% | Down from 60-80% |

---

## 8. Subledger Integration

### Subledger-to-GL Flow

**Standard Pattern:**
```
Subledger (AP/AR/FA/Inventory)

Create Accounting (Rules Engine)

Journal Entry (Draft)

Validation & Approval

Post to GL

Reporting
```

### Subledger Accounting Rules

**Design Principles:**
- Push complexity to subledger where possible
- Standard journal formats
- Consistent account derivation logic
- Audit trail preservation

**Common Integrations:**
| Subledger | Key Integration Points | Complexity |
|-----------|----------------------|------------|
| AP | Invoice coding, payment clearing | Medium |
| AR | Revenue recognition, cash application | High |
| FA | Depreciation, impairment, disposal | Medium |
| Inventory | COGS, revaluation, adjustments | High |
| Payroll | Allocation, accruals | Medium |
| Projects | WIP, capitalization, margin | High |

---

## 9. Modern Finance Architecture

### The Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │  Power   │ │  Tableau │ │  Custom  │ │  Mobile  │       │
│  │   BI     │ │          │ │   Apps   │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  ANALYTICS & REPORTING                       │
│         EPM (Planning, Consolidation, Reporting)             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              ACCOUNTING HUB / GL (Single Source)             │
│    ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│    │   Legal    │ │ Management │ │  Statutory │             │
│    │   Ledger   │ │  Reporting │ │   Ledger   │             │
│    └────────────┘ └────────────┘ └────────────┘             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     SUBLEDGERS                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│  │  AP  │ │  AR  │ │  FA  │ │  INV │ │  PRJ │ │  PAY │    │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    SOURCE SYSTEMS                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐   │
│  │  ERP   │ │  ERP   │ │Legacy  │ │External│ │  POC   │   │
│  │   A    │ │   B    │ │ System │ │ System │ │ System │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: COA Design Checklist

**Before Designing COA:**
- [ ] Document all reporting requirements (statutory, management, tax)
- [ ] Map current COA and identify bloat
- [ ] Define segment strategy
- [ ] Determine hierarchy depth
- [ ] Agree global vs. local governance

**During COA Design:**
- [ ] Natural account structure defined
- [ ] Segment order optimized for entry efficiency
- [ ] Hierarchies designed for reporting
- [ ] IC account structure defined
- [ ] Statistical accounts included
- [ ] GAAP variations mapped

**After COA Design:**
- [ ] Migration approach defined
- [ ] Historical data strategy confirmed
- [ ] Reporting mapping validated
- [ ] User acceptance testing complete
- [ ] Documentation and training ready

---

## Additional Resources

- `references/coa-design-patterns.md` — Industry-specific COA templates
- `references/accounting-hub-blueprints.md` — Hub implementation patterns
- `references/gl-optimization-playbook.md` — Performance tuning guide
- `references/multi-gaap-mapping.md` — GAAP difference matrices
