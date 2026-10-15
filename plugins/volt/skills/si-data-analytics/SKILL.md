---
name: si-data-analytics
description: >
  This skill activates when the user discusses business intelligence, BI,
  data analytics, reporting, dashboards, Power BI, Tableau, Looker, Qlik,
  financial reporting, management reporting, operational reporting, KPIs,
  metrics, data visualization, self-service analytics, semantic layer, or
  analytics across Oracle, SAP, Workday, Databricks, or enterprise platforms.
version: 1.0.0
---

# Data & Analytics Lead — SI Delivery Excellence

Expert-level guidance for business intelligence, analytics, and reporting in systems integration projects. Covers reporting strategy, dashboard design, self-service BI, and analytics platform implementation across all major enterprise systems.

---

## 1. Analytics Strategy Framework

### Analytics Maturity Model

```
Level 5: PREScriptive  → AI/ML, optimization, automation
Level 4: PREDictive   → Forecasting, what-if, trends
Level 3: DIAGNOSTIC   → Root cause, drill-down, analysis
Level 2: DESCRIPTIVE  → Standard reports, dashboards
Level 1: REACTIVE     → Ad-hoc queries, spreadsheets
```

**Target State by Function:**
| Function | Current | Target | Priority |
|----------|---------|--------|----------|
| Finance | Level 2 | Level 4 | High |
| Sales | Level 1 | Level 3 | Medium |
| Operations | Level 2 | Level 3 | High |

### Analytics Operating Model

**Centralized Model:**
- Pros: Consistency, control, standards
- Cons: Bottleneck, slower response
- Best for: Regulated industries

**Decentralized Model:**
- Pros: Speed, business ownership
- Cons: Inconsistency, duplication
- Best for: Agile organizations

**Hybrid (Hub-and-Spoke) Model:**
- Pros: Balance of consistency and agility
- Cons: Coordination overhead
- Best for: Most large organizations

### Analytics Governance

**Governance Domains:**
| Domain | Decisions |
|--------|-----------|
| **Data** | Definitions, quality, access |
| **Content** | Report standards, certification |
| **Platform** | Tools, infrastructure |
| **People** | Roles, skills, training |

---

## 2. Reporting Strategy

### Reporting Taxonomy

**By Consumer:**
| Type | Consumer | Frequency | Detail |
|------|----------|-----------|--------|
| **Board/Executive** | C-suite | Monthly/Quarterly | Summary |
| **Management** | Directors/Managers | Weekly/Monthly | Operational |
| **Analyst** | FP&A, Business Analysts | Daily/Weekly | Detailed |
| **Operational** | Process owners | Real-time/Daily | Transaction |

**By Purpose:**
| Purpose | Examples | Audience |
|---------|----------|----------|
| **Compliance** | Statutory reports, regulatory | External |
| **Financial** | P&L, Balance Sheet, Cash Flow | Finance |
| **Operational** | Sales reports, production metrics | Operations |
| **Strategic** | KPIs, scorecards, trends | Executive |

### Report Rationalization

**Current State Assessment:**
```
Total Reports: 500
├── Actively Used: 200 (40%)
├── Occasionally Used: 150 (30%)
├── Rarely/Never Used: 150 (30%)
└── Duplicates: 50

Target: 150 reports (70% reduction)
```

**Rationalization Criteria:**
| Criteria | Action |
|----------|--------|
| Not used in 12 months | Retire |
| Duplicates | Consolidate |
| Manual Excel workarounds | Automate |
| Low value | Challenge requirement |
| Similar to other reports | Merge |

### Report Design Principles

**The 30-Second Rule:**
A report should convey its main message in 30 seconds.

**Design Checklist:**
- [ ] Title is descriptive
- [ ] Date/context is clear
- [ ] Key metrics are prominent
- [ ] Comparisons are included (vs. budget, prior year)
- [ ] Trends are visible
- [ ] Exceptions are highlighted
- [ ] Actions are suggested

---

## 3. Dashboard Design

### Dashboard Types

| Type | Purpose | Update Frequency |
|------|---------|------------------|
| **Strategic** | KPIs, trends, goals | Monthly/Quarterly |
| **Operational** | Day-to-day metrics | Real-time/Daily |
| **Analytical** | Drill-down, exploration | On-demand |
| **Informational** | Status, awareness | Event-driven |

### Dashboard Layout Best Practices

**The Golden Zones:**
```
┌─────────────────────────────────────────┐
│           ZONE 1 (Primary)             │
│    Most important metrics              │
│    Top-left, largest visual            │
├─────────────────────────────────────────┤
│  ZONE 2    │    ZONE 3    │   ZONE 4   │
│ (Secondary)│ (Secondary)  │ (Tertiary) │
│  Trends    │  Breakdowns  │  Details   │
└─────────────────────────────────────────┘
```

### Visualization Selection Guide

| Data Relationship | Best Visualization | Example |
|-------------------|-------------------|---------|
| **Comparison** | Bar chart | Revenue by region |
| **Trend** | Line chart | Revenue over time |
| **Composition** | Pie/Donut (if <5 items) | Expense breakdown |
| **Distribution** | Histogram | Age distribution |
| **Correlation** | Scatter plot | Price vs. quantity |
| **Geographic** | Map | Sales by location |
| **Progress** | Bullet chart | KPI vs. target |
| **Status** | Traffic light | RAG indicators |

### Dashboard Design Checklist

**Visual Design:**
- [ ] Consistent color palette (use brand colors)
- [ ] Adequate white space
- [ ] Aligned elements
- [ ] Readable fonts (min 10pt)
- [ ] Clear hierarchy

**Data Design:**
- [ ] Appropriate chart types
- [ ] Accurate labels
- [ ] Clear units
- [ ] Proper scaling
- [ ] Data currency indicated

**Interactive Design:**
- [ ] Filters are intuitive
- [ ] Drill-down paths are logical
- [ ] Tooltips provide context
- [ ] Performance is acceptable (<5 sec load)

---

## 4. BI Platform Comparison

### Power BI

**Strengths:**
- Tight Microsoft integration
- Cost-effective licensing
- Strong DAX language
- Excellent sharing (Teams, SharePoint)
- Growing AI capabilities

**Considerations:**
- Performance with large datasets
- Limited data preparation vs. ETL tools

**Best For:**
- Microsoft-centric organizations
- Self-service BI
- Cost-conscious implementations

**Key Components:**
| Component | Purpose |
|-----------|---------|
| Power BI Desktop | Report development |
| Power BI Service | Publishing, sharing |
| Power BI Mobile | Mobile access |
| Power BI Report Server | On-premises option |
| Dataflows | Data preparation |
| Datamarts | Self-service data |

### Tableau

**Strengths:**
- Best-in-class visualization
- Intuitive drag-and-drop
- Strong analytics capabilities
- Large user community
- Robust data prep (Tableau Prep)

**Considerations:**
- Higher cost per user
- Steeper learning curve for advanced features

**Best For:**
- Data visualization priority
- Advanced analytics needs
- Mixed data source environments

**Key Components:**
| Component | Purpose |
|-----------|---------|
| Tableau Desktop | Report development |
| Tableau Server/Online | Publishing, sharing |
| Tableau Prep | Data preparation |
| Tableau Mobile | Mobile access |
| Tableau CRM (Einstein) | AI-powered analytics |

### Looker (Google Cloud)

**Strengths:**
- Semantic layer (LookML)
- Git-based development
- Embedded analytics
- Modern architecture
- Strong governance

**Considerations:**
- Requires LookML expertise
- Smaller ecosystem
- Google Cloud alignment

**Best For:**
- Modern data stack
- Embedded analytics
- Strong governance needs
- Development teams comfortable with code

**Key Concepts:**
| Concept | Purpose |
|---------|---------|
| LookML | Semantic modeling language |
| Explores | Pre-defined data models |
| Looks | Individual visualizations |
| Dashboards | Collections of Looks |
| Blocks | Pre-built content |

### Oracle Analytics Cloud (OAC)

**Strengths:**
- Deep Oracle integration
- Built-in ML capabilities
- Natural language query
- Data augmentation

**Considerations:**
- Oracle ecosystem focus
- Less mature visualization vs. Tableau/Power BI

**Best For:**
- Oracle Cloud customers
- Oracle ERP/EPM users
- ML-augmented analytics

### SAP Analytics Cloud (SAC)

**Strengths:**
- Deep SAP integration
- Planning + Analytics in one
- Embedded in SAP applications
- Predictive capabilities

**Considerations:**
- SAP-centric
- Less flexible for non-SAP data

**Best For:**
- SAP S/4HANA customers
- Integrated planning and analytics

---

## 5. Semantic Layer Design

### What is a Semantic Layer?

A business-friendly abstraction over raw data that provides:
- Consistent business definitions
- Reusable metrics
- Security and governance
- Self-service enablement

### Semantic Layer Components

| Component | Description | Example |
|-----------|-------------|---------|
| **Dimensions** | Descriptive attributes | Customer, Product, Date |
| **Measures** | Quantifiable metrics | Revenue, Quantity, Cost |
| **Hierarchies** | Roll-up structures | Date: Day → Month → Year |
| **Calculated Fields** | Derived metrics | Gross Margin % |
| **Filters** | Pre-defined subsets | Current Year, Active Customers |

### Metric Definitions Template

```
Metric: Gross Margin %
Formula: (Revenue - COGS) / Revenue * 100
Business Definition: Profitability before operating expenses
Data Source: ERP GL
Refresh: Daily
Owner: FP&A Director
Approved: Y/N
```

### Semantic Layer Governance

**Certification Process:**
1. Metric definition proposed
2. Data source validated
3. Formula verified
4. Business owner approves
5. Published to catalog
6. Monitored for accuracy

---

## 6. Self-Service BI Enablement

### Self-Service Maturity Levels

| Level | Description | Tools |
|-------|-------------|-------|
| **1. Curated** | IT creates, business consumes | Static reports |
| **2. Customizable** | IT creates, business customizes | Parameterized reports |
| **3. Exploratory** | Business explores IT datasets | Pivot, filter, drill |
| **4. Creative** | Business creates new content | Full authoring |
| **5. Advanced** | Business creates datasets | Data prep, blending |

### Self-Service Guardrails

**Data Access:**
- Row-level security
- Column-level security
- Data masking
- Usage auditing

**Content Governance:**
- Certified vs. user-created content
- Naming conventions
- Promotion process
- Retirement process

**Support Model:**
| Tier | Support | Response |
|------|---------|----------|
| 1 | Self-help, community | Immediate |
| 2 | Power users, super users | 1 day |
| 3 | BI team | 3 days |
| 4 | IT/Escalation | 1 week |

### Training for Self-Service

**Beginner Track:**
- Platform navigation
- consuming content
- Basic filtering
- Exporting data

**Intermediate Track:**
- Creating reports
- Basic calculations
- Sharing content
- Combining datasets

**Advanced Track:**
- Data modeling
- Advanced DAX/MDX
- Optimization
- Administration

---

## 7. Embedded Analytics

### Embedded Analytics Patterns

**Pattern 1: Iframe Embedding**
- Simple iframe in application
- Pros: Quick, secure
- Cons: Limited customization

**Pattern 2: JavaScript API**
- Programmatic control
- Pros: Flexible, seamless
- Cons: Development effort

**Pattern 3: APIs + Custom UI**
- Full custom build
- Pros: Maximum control
- Cons: High development

**Pattern 4: Headless BI**
- API-first approach
- Pros: Any frontend
- Cons: Complex architecture

### Use Cases for Embedded Analytics

| Use Case | Example | Benefit |
|----------|---------|---------|
| **Customer Portal** | Usage dashboards for clients | Value-add service |
| **Vendor Portal** | Performance scorecards | Supplier management |
| **Employee Portal** | Personal HR analytics | Engagement |
| **Product Integration** | Analytics in SaaS product | Product differentiation |

---

## 8. Analytics for Finance

### Financial Reporting Requirements

**Statutory Reporting:**
- GAAP-compliant statements
- Footnote schedules
- Supporting schedules
- Auditor requirements

**Management Reporting:**
- Flash reports
- Board packages
- Business unit P&L
- Variance analysis

**Regulatory Reporting:**
- SEC filings
- Tax reports
- Industry-specific

### FP&A Analytics

**Key Reports:**
| Report | Purpose | Frequency |
|--------|---------|-----------|
| **Actuals vs Budget** | Performance tracking | Monthly |
| **Forecast** | Forward-looking view | Rolling |
| **Variance Analysis** | Explain differences | Monthly |
| **KPI Dashboard** | Key metrics | Real-time |
| **Scenario Analysis** | What-if planning | Ad-hoc |

**Planning Integration:**
- Actuals from ERP
- Budget from EPM
- Forecast from planning models
- Reporting in BI tool

### Close Analytics

**Close Dashboard:**
```
┌─────────────────────────────────────────┐
│      FINANCIAL CLOSE TRACKER           │
├─────────────────────────────────────────┤
│ Day 3 of 5                              │
│ ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 60%│
├─────────────────────────────────────────┤
│ Subledgers:      Closed              │
│ Adjustments:     In Progress         │
│ IC Matching:     98% Matched         │
│ Consolidation:   Not Started         │
│ Reporting:       Not Started         │
├─────────────────────────────────────────┤
│  Issues (2)                           │
│ • IC variance: $12K (Entity 101 vs 201)│
│ • FX rate pending for 3 entities       │
└─────────────────────────────────────────┘
```

---

## 9. Implementation Approach

### Analytics Implementation Phases

**Phase 1: Foundation (Weeks 1-4)**
- Requirements gathering
- Data source assessment
- Platform selection
- Semantic layer design

**Phase 2: Build (Weeks 5-12)**
- Data connection
- Semantic model development
- Report/dashboard development
- Security implementation

**Phase 3: Pilot (Weeks 13-16)**
- Power user testing
- Feedback incorporation
- Performance tuning
- Training development

**Phase 4: Rollout (Weeks 17-20)**
- User training
- Content deployment
- Support activation
- Adoption monitoring

### Success Metrics

**Technical Metrics:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Report availability | >99.5% | Uptime |
| Report load time | <5 seconds | Performance testing |
| Data freshness | As required | SLA |

**Adoption Metrics:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Active users | >80% of licensed | Login tracking |
| Report usage | >70% of reports | Usage logs |
| Self-service ratio | >60% | Content created by users |
| User satisfaction | >4/5 | Survey |

---

## Quick Reference: BI Platform Selection

| Requirement | Recommended Platform | Rationale |
|-------------|---------------------|-----------|
| Microsoft ecosystem | Power BI | Native integration, cost |
| Best visualization | Tableau | Industry leader |
| Modern/embedded | Looker | Semantic layer, embedded |
| Oracle ERP | OAC | Pre-built content |
| SAP S/4HANA | SAC | Deep integration |
| Mixed sources, governed | Tableau/Power BI + dbt | Flexibility + governance |
| High-scale enterprise | MicroStrategy, ThoughtSpot | Enterprise features |
