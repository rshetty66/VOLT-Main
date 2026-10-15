---
name: erp-epm-strategy
description: >
  This skill should be used when the user asks about "ERP strategy", "EPM strategy",
  "ERP selection", "EPM selection", "Oracle ERP Cloud", "Oracle EPM Cloud",
  "SAP S/4HANA", "Workday Financials", "OneStream", "Anaplan", "IBM TM1",
  "Planning Analytics", "PBCS", "EPBCS", "FCCS", "ARCS", "Narrative Reporting",
  "FDMEE", "Data Management", "ERP implementation", "EPM implementation",
  "system selection", "RFP design", "vendor evaluation", "solution architecture",
  "ERP business case", "EPM business case", "go-live", "cutover planning",
  "data migration", "UAT", "systems integration", "hypercare", "ERP roadmap",
  "EPM roadmap", "finance systems", or "technology-enabled transformation".
version: 1.0.0
---

# ERP and EPM Strategy, Selection, and Implementation

Expert-level methodology for ERP and EPM strategy, vendor selection, solution design, and end-to-end implementation in complex enterprise environments. Apply to generate selection frameworks, solution designs, implementation roadmaps, and board-ready technology business cases.

## ERP Strategy Foundations

### The ERP Decision Framework

Every ERP strategy decision must answer five questions in sequence:
1. **What is the business case?** Quantify value: efficiency gains, close acceleration, data quality, compliance reduction.
2. **What is the right scope?** Which modules, entities, and geographies? Phased or big-bang?
3. **Which vendor fits best?** Functional fit, total cost of ownership, implementation risk, ecosystem.
4. **What is the deployment model?** Cloud SaaS, private cloud, hybrid — and migration path from legacy.
5. **How do we manage change?** Organization impact, training, cutover risk, business continuity.

### ERP Vendor Landscape — Quick Reference

| Vendor | Flagship Product | Strengths | Best Fit |
|--------|----------------|-----------|----------|
| **Oracle** | ERP Cloud (Fusion) | Finance depth, regulatory reporting, EPM integration, FSI capabilities | Large enterprises, financial services, multi-entity global |
| **SAP** | S/4HANA | Engineering/manufacturing depth, global compliance, ecosystem richness | Industrial, manufacturing, large diversified multinationals |
| **Workday** | Financials | Unified Finance+HR, UX, cloud-native, rapid deployment | Mid-market, professional services, healthcare |
| **Microsoft** | Dynamics 365 F&O | Microsoft ecosystem integration, mid-market value | Mid-market, Microsoft-centric organizations |
| **Infor** | CloudSuite Financials | Industry-specific solutions | Healthcare, public sector, manufacturing |

### ERP Selection Scoring Model

Use a weighted scoring matrix. Recommended weight distribution:

| Criterion | Weight |
|-----------|--------|
| Functional fit (finance processes) | 25% |
| Total Cost of Ownership (5-year) | 20% |
| Implementation risk & complexity | 15% |
| Vendor viability & roadmap | 10% |
| Integration capabilities | 10% |
| Regulatory/compliance depth | 10% |
| Reference customers (same industry) | 5% |
| UX and adoption potential | 5% |

## Oracle EPM Cloud — Deep Expertise

### Module Architecture

Oracle EPM Cloud is a suite of integrated cloud modules. Know when to deploy each:

| Module | Acronym | Purpose |
|--------|---------|---------|
| **Planning and Budgeting Cloud** | PBCS | Budgeting, forecasting, workforce planning |
| **Enterprise Planning and Budgeting Cloud** | EPBCS | PBCS + Strategic Modeling + extended modules |
| **Financial Consolidation and Close** | FCCS | Legal/statutory consolidation, intercompany elimination, close management |
| **Account Reconciliation Cloud** | ARCS | Balance sheet reconciliation, close certification, transaction matching |
| **Tax Reporting Cloud** | TRCS | Global tax provision, deferred tax, country-by-country reporting |
| **Narrative Reporting** | EPRCS | Integrated management reporting, board packs, XBRL filing |
| **Enterprise Data Management** | EDM | Master data governance, chart of accounts alignment, hierarchy management |
| **Profitability and Cost Management** | PCM | Profitability analysis, cost allocation, management accounting |
| **Data Management / FDMEE** | DM/FDMEE | Data integration, transformation, mapping from ERP sources |

### EPBCS Module Design Principles

- **Driver-based planning**: Build assumptions-driven models — revenue drivers, headcount drivers, cost drivers — rather than manual line-item entry.
- **Rolling forecast**: Design for 12+ month rolling horizons, not just annual budget.
- **Workforce planning**: Use the native Workforce module for headcount and compensation modelling tied to HR systems.
- **Capital expenditure planning**: Use the Capital Asset Planning module for CapEx lifecycle, depreciation, and project-level tracking.
- **Dimension architecture**: Design SmartView-friendly dimension structures. Standard dimensions: Entity, Account, Scenario, Version, Period, Year. Extended: Product, Channel, Project, Customer.

### FCCS Configuration Essentials

- **Consolidation method**: Define equity/proportional/full consolidation by ownership tier.
- **Intercompany matching**: Build automated ICO matching rules before go-live.
- **Currency translation**: Configure multi-currency hierarchies; know the difference between translation and remeasurement (ASC 830 / IAS 21).
- **Journals**: Define automated vs manual journal categories; enforce approval workflows.
- **Close task manager**: Build the close calendar with dependencies, owners, and SLAs from Day 1.

## Implementation Methodology

### Implementation Phases — Detail

**Discovery and Design (Weeks 1–12)**
- Current state process documentation (L2/L3 process maps)
- Requirements gathering: functional, integration, reporting, security, compliance
- Solution architecture: module configuration, data model, integration topology
- Chart of accounts and dimension design (most critical early decision)
- Data migration strategy: source identification, cleansing rules, migration approach

**Build (Weeks 12–36)**
- System configuration and customization
- Integration build (ERP <-> EPM <-> data lake <-> BI tools)
- Data migration scripts and validation
- Security model: roles, data access rules, approval hierarchies
- Report and dashboard build

**Test (Weeks 30–44)**
- Unit testing: per-module configuration validation
- System Integration Testing (SIT): end-to-end scenarios
- User Acceptance Testing (UAT): business-led, scenario-based
- Performance testing: load test at 2× peak volume
- Parallel run: run new and legacy systems simultaneously (2–4 weeks minimum for close/consolidation)

**Deploy (Weeks 44–52)**
- Cutover planning: data freeze, migration execution, validation, go/no-go decision
- Go-live support: war room, issue tracker, escalation protocol
- Hypercare: 4–8 weeks post go-live dedicated support

### Data Migration — Critical Success Factors

1. **Start data assessment in Week 1**, not Week 20.
2. **Define data cleansing rules before extract** — do not migrate dirty data.
3. **Run at least three mock migrations** before production cutover.
4. **Validate by exception**: build automated reconciliation checks (source total = target total).
5. **Preserve data lineage**: every migrated record should be traceable to its source.

### Integration Architecture Patterns

| Pattern | When to Use | Tools |
|---------|-------------|-------|
| **API-first real-time** | Transactional data needing sub-second latency | REST/GraphQL, MuleSoft, Azure API Management |
| **Event-driven** | Near-real-time triggers (journal posting, approval completion) | Kafka, Azure Event Hub, AWS EventBridge |
| **Batch ETL/ELT** | Large volume, non-time-sensitive (GL balances, master data) | Oracle Data Integrator, Informatica, Azure Data Factory |
| **Pre-built connectors** | Standard ERP-to-EPM feeds | Oracle EPM Data Management (FDMEE), SAP BTP Integration Suite |

## Implementation Risk Register (Top 10)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Data quality issues discovered late | H | H | Start data profiling in Week 1 |
| Chart of accounts redesign scope creep | H | H | Lock CoA design by end of Week 8 |
| Integration complexity underestimated | H | H | Architect integrations before build starts |
| Business resource availability | M | H | Secure resource commitments in contract |
| Parallel run reveals reconciling items | M | H | Allocate 4+ weeks for parallel |
| Regulatory requirements changing in-flight | M | H | Build configuration flexibility, not hard-code |
| User adoption lower than expected | M | H | Start change management in Assess phase |
| Vendor product gaps vs promised capability | M | M | Conduct detailed PoC before final vendor selection |
| Cutover window too short | L | H | Plan cutover 16+ weeks before go-live |
| Post go-live performance degradation | L | H | Performance test at 2× peak load |

## Additional Reference Materials

- **`references/vendor-landscape.md`** — Full vendor comparison matrices, RFP scoring templates, TCO model
- **`references/implementation-patterns.md`** — Detailed integration patterns, data migration playbook, testing strategy templates
