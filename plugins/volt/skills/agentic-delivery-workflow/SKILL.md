---
name: agentic-delivery-workflow
description: >
  Universal delivery workflow orchestration skill. Activates when generating deliverables
  across ANY ERP platform (Oracle ERP Cloud, Oracle EPM, Workday, OneStream, S4 HANA).
  Provides cross-deliverable consistency rules, platform-specific terminology injection,
  and quality standards aligned to a generic delivery checklist.
version: 1.0.0
disable-model-invocation: true
---

# Agentic Delivery Workflow — Universal Platform Skill

## Purpose

This skill governs how VOLT generates deliverables across ANY ERP platform. It ensures:
- Platform-specific terminology is used correctly
- Cross-deliverable consistency (references, decisions, dependencies)
- Consistent delivery quality standards
- Alignment to the delivery checklist

## Platform-Specific Generation Rules

### Oracle ERP Cloud
- Reference Oracle Fusion Cloud capabilities by their exact product names
- Data loading = FBDI (File-Based Data Import) templates via UCM
- Integration = Oracle Integration Cloud (OIC), REST APIs, SOAP services
- Testing = Prototype 1-4 iterative approach (P1 = Configure, P2 = Build, P3 = SIT, P4 = UAT)
- Chart of Accounts = Flexfield segments (Company, Cost Center, Natural Account, Intercompany, Future)
- Security = Data Access Sets, Custom Roles, SOD Rules
- Reporting = OTBI, BI Publisher, Financial Reporting Studio, Smart View

### Oracle EPM Cloud
- Modules: FCCS, ARCS, EDMCS, PBCS/EPBCS (use these acronyms)
- Close process = Close Tasks, Task Templates, Supplemental Data, Close Calendar
- Data loading = Data Management (DM) rules, Integration jobs, EPM Automate
- Reconciliation = Profiles, Formats, Auto-Certification Rules, Transaction Match Rules
- Security = Groups, Teams, Workflow-based, SOX segregation
- Testing = Close Calendar-driven (BD10→BD5 cycle validation)

### Workday Financials
- Core objects = Worktags (Company, Cost Center, Revenue Category, Spend Category)
- Data loading = EIBs (Enterprise Interface Builders), iLoads
- Integration = Workday Studio, Core Connector, RaaS (Report as a Service)
- Configuration = Business Process Definitions (BPDs), Condition Rules
- Security = Security Groups (Role-based, Segment-based, Intersection)
- Environment = Tenants (Sandbox → Implementation → Preview → Production)
- Reporting = Workday Reports, Prism Analytics, Composite Reports, Discovery Boards

### OneStream
- Dimensions = Entity, Account, Flow, Intercompany, UD1-UD8
- Data loading = Data Adapters + Stage Tables + Data Quality Rules
- Configuration = Business Rules (XFBR), Member Formulas, Data Management
- Reporting = Cube Views, Dashboard, Report Builder, Excel Add-In
- Security = Security Classes, Workflow Profiles, Task Manager
- Environment = Application environments (Development → QA → Production)
- Migration = Packages (metadata + data)

### Workday HR (HCM)
- Organizations = Supervisory, Cost Center, Company, Region hierarchies
- Data loading = EIBs (Worker, Organization, Compensation, Benefits)
- Integration = Workday Studio, Core Connector, PECI, Document Transformation
- Configuration = BPDs, Condition Rules, Eligibility Rules, Calculated Fields
- Security = Security Groups (Role-based, Job-based, Segment-based)
- Testing = Tenant-based + parallel payroll runs for validation

### SAP S/4HANA
- Modules = FI, CO, MM, SD, PP, PM, QM, PS (use standard abbreviations)
- Data loading = LTMC (Legacy Transfer Migration Cockpit), LSMW
- Integration = SAP BTP Integration Suite, CPI, RFC, IDOC, OData APIs
- Configuration = IMG (Implementation Guide), Customizing Requests, Transport Management
- Security = Roles & Authorization Objects (Transaction-level + Org-level)
- Methodology = SAP Activate (Discover → Prepare → Explore → Realize → Deploy → Run)
- Reporting = Fiori Analytical Apps, Embedded Analytics, SAP Analytics Cloud (SAC)
- UX = SAP Fiori, Launchpad, Tile Groups

## Cross-Deliverable Consistency Rules

When generating a deliverable in a sequence:

1. **Reference prior decisions** — If a KDD/KBD was decided in a previous deliverable, cite it by ID
2. **Use client terminology** — Extract specific names (systems, entities, personnel roles) from the project context
3. **Maintain scope boundaries** — Never include content about scope exclusions listed in the SOW
4. **Carry forward assumptions** — Assumptions from earlier deliverables remain valid unless explicitly overridden
5. **Dependency awareness** — If this deliverable depends on others, reference their outputs
6. **Consistent naming** — Use the same abbreviations and naming conventions across all deliverables

## Quality Standards

Every generated deliverable must:

- Be written at partner-level quality (authoritative, specific, implementation-ready)
- Include platform-specific details (not generic consulting language)
- Reference the client's actual system names, entity structures, and timelines
- Include actionable recommendations with clear owners and deadlines
- Use tables, matrices, and diagrams where they improve clarity
- Be ready for SteerCo presentation (executive summary quality)

## Delivery Checklist Alignment

When generating deliverables, ensure the output aligns with industry-standard delivery practices:

| Checklist Item | Quality Check |
|-----------|--------------|
| Program Charter | Must include governance structure, decision authority, meeting cadence |
| RAID | Risk probability/impact matrix, assumption validation dates, escalation paths |
| KBD/KDD Framework | Minimum 2 options per decision, platform-specific pros/cons, clear recommendation |
| Testing Strategy | Entry/exit criteria per phase, defect severity matrix, environment strategy |
| Data Conversion | Source-to-target mapping, validation rules, reconciliation approach |
| Integration Strategy | Context diagrams, error handling, retry logic, monitoring |
| Cutover Plan | Hour-by-hour timeline, rollback criteria, acceptance gates |
| Knowledge Transfer | Role-based matrix, shadowing schedule, competency verification |
| 100-Day Sustainability | Post go-live KPIs, continuous improvement backlog, support transition |

## Agent Behavior

When this skill is activated during deliverable generation:
- Inject platform terminology appropriate to the project's `erp_platform`
- Cross-reference any previously approved deliverables in the same run
- Apply the quality standards above as a self-check before completing each section
- Flag if a section would benefit from a workshop or client input (mark as [REQUIRES CLIENT INPUT])
