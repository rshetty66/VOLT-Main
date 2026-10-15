---
name: onestream-fpa-transformation
description: >
  This skill should be used when the user asks about "OneStream FP&A",
  "OneStream implementation", "cost allocation OneStream",
  "FP&A transformation OneStream", "driver-based planning OneStream",
  "expense allocation model", "headcount planning OneStream", "MBR reporting OneStream",
  "Monthly Business Review", "cost centre hierarchy design", "CTO operating model",
  or any task related to a OneStream FP&A transformation project.
  Also triggers for "OneStream dimension design", "OneStream cube architecture",
  "OneStream business rules", "OneStream MarketPlace", or "OneStream data migration".
version: 1.0.0
disable-model-invocation: true
---

# OneStream FP&A Transformation

Expert methodology for implementing OneStream XF as the Consolidation and Planning/Forecasting platform for a mid-market financial services organization, with a cloud ERP (illustrated here with Workday Financials) as the source of GL actuals. Covers consolidation, cost allocation, driver-based planning, MBR reporting, and full lifecycle from assessment through hypercare. Worked examples use the fictional organization **Proseware Finance**; replace them with the organization's own structures.

## Illustrative Scenario

| Field | Value |
|-------|-------|
| **Organization** | Proseware Finance (fictional) |
| **Industry** | Financial services (mid-market lender) |
| **ERP** | Workday Financials (GL, AP, AR, Procurement — source of truth for actuals) |
| **EPM** | OneStream XF (Consolidation, Planning & Forecasting) |
| **Scope** | FP&A Transformation — Consolidation, Planning, Cost Allocation, Reporting |
| **Typical Stakeholders** | CFO, VP Finance, FP&A Director, Cost Allocation Manager |

### Typical Current State Pain Points
- Spreadsheet-based expense allocation — manual, error-prone, no audit trail
- Headcount planning in spreadsheets — disconnected from the financial plan
- Fragmented MBR production — multiple sources, inconsistent formatting
- No driver-based planning — line-item budgets with limited scenario capability
- Manual hierarchy maintenance — no governance workflow

---

## OneStream Application Architecture

### Cube Design

| Cube | Purpose | Update Frequency |
|------|---------|-----------------|
| **Actuals** | GL-loaded actual results | Monthly (auto-load from the ERP) |
| **Budget** | Annual operating budget | Annual cycle + mid-year refresh |
| **Forecast** | Rolling 18-month forecast | Monthly |
| **Allocations** | Cost allocation outputs | Monthly (post-close) |
| **Scenarios** | What-if analysis | Ad hoc |

### Dimension Architecture

| Dimension | Hierarchy Depth | Source |
|-----------|-----------------|--------|
| **Entity** | 4 levels (Organization → Division → Department → Cost Centre) | Org hierarchy master |
| **Account** | 5 levels (P&L → Category → Sub-cat → Detail → Posting) | COA mapping from ERP |
| **Time** | Year → Quarter → Month | Standard calendar |
| **Scenario** | Flat (Actual, Budget, Forecast, Best, Worst, Stress) | Static |
| **Product** | 3 levels (Line of Business → Product Family → Product) | Business taxonomy |
| **Cost Driver** | Flat (FTE, Sq Ft, Revenue, Transactions, etc.) | Allocation model |
| **Version** | Flat (Working, Submitted, Approved) | Workflow states |

### Business Rules

| Rule | Type | Trigger | Purpose |
|------|------|---------|---------|
| **Allocation Engine** | Calculation | Post data-load | Step-down allocation using driver ratios |
| **FTE Roll-Forward** | Calculation | Forecast input | Headcount × avg comp → NIE projection |
| **Revenue Driver Calc** | Calculation | Planning input | Volume × rate → NII / NIR projection |
| **Variance Calc** | Calculation | Period close | Actual vs Budget/Forecast variance |
| **MBR Data Prep** | Data movement | Pre-report | Aggregate & format for MBR dashboards |
| **Consolidation** | Consolidation | Period close | Entity roll-up with IC elimination |

---

## Cost Allocation Methodology

### Allocation Model (3-Pass)

**Pass 1: Direct Costs**
- Costs with clear ownership → charged directly to owning cost centre
- Source: expense ledger mapped to cost centre

**Pass 2: Shared Services Allocation**
- Corporate functions (IT, HR, Facilities, Risk) → allocated to business lines
- Drivers: FTE count, square footage, transaction volume, revenue share

**Pass 3: Product-Level Allocation**
- Business line costs → allocated to product level
- Drivers: Product revenue, customer count, AUM

### Driver Table (illustrative)

| Cost Pool | Driver | Source | Update |
|-----------|--------|--------|--------|
| IT Infrastructure | FTE count | HR system | Monthly |
| Facilities & Real Estate | Square footage | Facilities DB | Quarterly |
| Risk & Compliance | Revenue share | GL actuals | Monthly |
| HR Services | FTE count | HR system | Monthly |
| Finance Operations | Transaction count | Core banking | Monthly |
| Marketing | Revenue share | GL actuals | Monthly |
| Executive Office | Revenue share | GL actuals | Monthly |

### OneStream Configuration for Allocations

Use OneStream's native **Allocation Engine** with:
1. **Source intersection**: Entity=SharedServices, Account=Expense line, Scenario=Actual
2. **Driver intersection**: Entity=Target, Dimension=CostDriver, stored driver ratios
3. **Target intersection**: Entity=BusinessLine, Account=Allocated expense
4. **Validation**: Source total = Sum of targets (zero-balance check)

---

## MBR (Monthly Business Review) Framework

### Report Package Structure

| Section | Content | Data Source (OneStream) |
|---------|---------|----------------------|
| Executive Summary | Key metrics, commentary | Dashboard widget |
| P&L Performance | Actual vs Budget vs Prior Year | `query_budget_vs_actual` |
| Variance Analysis | Price/Volume/Mix decomposition | `get_variance_analysis` |
| Expense Trending | NIE by category, cost centre | `get_data` (Actual cube) |
| Headcount Analysis | FTE by division, cost per FTE | Workforce Planning cube |
| Forecast Update | Rolling forecast with accuracy | `get_rolling_forecast` |
| Cost Allocation Summary | Allocated costs by recipient | Allocations cube |
| KPIs & Ratios | Efficiency ratio, cost/income | Calculated members |

### OneStream MCP Tools for MBR Generation

```
1. query_budget_vs_actual(entity="Corporate", period="all")
   → Monthly P&L with variance amounts and percentages

2. get_variance_analysis(entity="Corporate", period="Q2", account="Total Revenue")
   → Multi-level variance decomposition

3. get_rolling_forecast(entity="Corporate", account="Net Interest Income")
   → 18-month rolling forecast with actuals overlay

4. get_forecast_accuracy(entity="Corporate", lookback_months=12)
   → MAPE, bias, directional accuracy

5. get_driver_based_plan(entity="Retail Banking")
   → Driver inputs → P&L output relationships

6. get_planning_workflow_status(workflow_type="Planning")
   → Current planning cycle progress
```

---

## Delivery Phases & Key Deliverables

### Core Deliverables

| # | Deliverable | Description |
|---|------------|-------------|
| 1 | **Blueprint Design Document** | To-Be business process, technical design & architecture, data model fit-gap analysis |
| 2 | **Project Plan for Implementation** | Activities, dependencies, milestones, resources for OneStream planning, budgeting & forecasting |
| 3 | **SIT & UAT Scripts** | End-to-end data flow validation, cross-system test cases, integration defect resolution |
| 4 | **Training Materials** | Technical training guide (end-users) + Technical Design Document (TDD) for admin |
| 5 | **Cutover Plan** | System cutover execution guide and user access validation |

---

### Phase 1: Blueprint Design
**Agents:** onestream-specialist, si-finance-process-lead, coa-designer, si-data-architect

**Activities:**
- Perform detailed review of current FP&A processes (typically spreadsheet-based)
- Develop data and integration blueprint across source systems (ERP, HCM, data lake, vendor systems)
- Gather reporting requirements and align on management reporting strategy
- Perform fit/gap assessment against any existing OneStream footprint
- Document technical and functional business requirements
- Prioritize requirements and confirm scope for each release

**Deliverables Produced:**
- Blueprint Design Document
- Project Plan for Implementation

---

### Phase 2: Release 1 — Configure & Build (Headcount, Salary & Benefits, Expense)
**Agents:** onestream-specialist, financial-modeling-agent, coa-designer

**Activities:**
- Design scalable data model and cube architecture for planning, budgeting & forecasting
- Configure Headcount Planning module (position-level, cost-centre, avg salary, benefits, contractor rates, HR banding)
- Configure Salary & Benefits module (compensation modelling)
- Configure Expense Planning module (migrated from spreadsheet-based models)
- Build KPI calculations within OneStream
- Build product ingestion of forecasts
- Configure security model and workflows
- Execute unit testing of all configured components

**Work Products:**
- Workforce Planning Module (configured and unit-tested)
- Expense Planning Module (configured and unit-tested)
- Data Model & Cube Architecture (metadata, cubes, cube views, member formulas, business rules)

---

### Phase 3: Release 1 — Data Integration & Go-Live
**Agents:** si-data-architect, erp-data-migration-lead, onestream-specialist

**Activities:**
- Leverage and enhance existing data connections to source systems
- Configure inbound integrations (OneStream side) using Smart Integration Connector (SIC)
- Load the agreed history of actuals into OneStream
- Execute end-to-end integration/conversion testing
- Support System Integration Testing (SIT)
- Data validation via cube views and quick views
- Technical release to core team for early adoption and concept validation

**Work Products:**
- Inbound Integration Configuration (ERP, HCM, data lake)
- Release 1 Go-Live Checklist

---

### Phase 4: Release 2 — Configure & Build (Allocation, Reports)
**Agents:** onestream-specialist, financial-modeling-agent, creative-designer

**Activities:**
- Design and implement Expense Allocation model within OneStream
- Configure a BI connector (e.g., Power BI) where in scope
- Build product-level P&L reporting
- Configure multi-level dashboards (analytics, management, executive)
- Build drill-down capability and QuickViews
- Enable alternate hierarchy creation for users
- Configure Excel add-in for model interaction and data submission
- Support early user adoption and development of user-defined dashboards

**Work Products:**
- Expense Allocation Model
- Product-Level P&L Reports
- Executive Dashboards & QuickViews

---

### Phase 5: Testing (SIT & UAT)
**Agents:** erp-test-lead, fact-check-agent, onestream-specialist

**Activities:**
- Develop testing strategy and plan
- Provide sample test scripts for the client team to finalize and execute
- Validate end-to-end data flows across integrated systems (ERP, HCM, data lake → OneStream)
- Execute test cases for cross-system scenarios
- Verify interface logic and data transformations
- Identify and resolve integration defects
- Ensure all components function cohesively per business requirements

**Deliverable Produced:**
- SIT & UAT Scripts

---

### Phase 6: Training, Cutover & Hypercare
**Agents:** si-change-management-lead, onestream-specialist

**Activities:**
- Provide advice on training strategies and plan
- Develop training materials: quick reference guides, future-state process docs, end-user training guides
- Conduct train-the-trainer sessions
- Support end-user training sessions
- Develop cutover plan and guide migration to production
- Provide hypercare support after go-live: coach help desk/superusers, resolve defects

**Deliverables Produced:**
- Training Materials (technical training guide + TDD for admin)
- Cutover Plan

---

## OneStream-Specific Configuration Guidance

### MarketPlace Solutions to Deploy
- **People Planning** — Headcount, compensation, and workforce cost modeling
- **Account Reconciliation** — Balance sheet recs tied to close process
- **Financial Close** — Task management with dependencies and SLAs

### Key Integration Points
| Source System | Integration | Frequency | Method |
|--------------|-------------|-----------|--------|
| Workday Financials (ERP) | GL actuals, AP, AR, journal entries | Daily/Monthly | Workday RaaS → ADF → OneStream REST API |
| Workday HCM | Headcount, compensation, FTE | Monthly | Workday RaaS → ADF → OneStream |
| Facilities System | Square footage by location | Quarterly | File upload |
| Treasury System | Interest rates, FX, funding | Daily | REST API → ADF |

### Workday → OneStream Integration Architecture
```
Workday Financials (ERP)          Azure Data Factory           OneStream XF
┌──────────────────────┐     ┌────────────────────────┐     ┌──────────────────┐
│ • GL Journal Lines   │────│ • Workday RaaS Extract │────│ Actuals Cube     │
│ • Trial Balance      │     │ • COA Mapping          │     │ (Consolidation)  │
│ • AP Invoices        │     │ • Entity Mapping       │     │                  │
│ • AR Receipts        │     │ • Data Validation      │     │ Planning Cube    │
│ • Procurement        │     │ • Reconciliation       │     │ (Budget/Forecast)│
└──────────────────────┘     └────────────────────────┘     └──────────────────┘

Workday HCM                                                  OneStream XF
┌──────────────────────┐     ┌────────────────────────┐     ┌──────────────────┐
│ • Headcount Report   │────│ • FTE Aggregation      │────│ Workforce Cube   │
│ • Compensation Data  │     │ • Cost Centre Mapping  │     │ (People Planning)│
│ • Position Mgmt      │     │ • Driver Calculation   │     │                  │
│ • Org Hierarchy      │     │                        │     │ Assumptions Cube │
└──────────────────────┘     └────────────────────────┘     └──────────────────┘
```

### Governance & Controls
- **Version control:** Working → Submitted → Approved lifecycle
- **Audit trail:** All data changes logged with user, timestamp, reason
- **Approval workflow:** Department → Finance → CFO sign-off chain
- **Lock periods:** Closed periods locked after publication
- **Driver updates:** Require finance approval before allocation re-run

---

## Data Engineering & Azure Architecture

### Azure Data Platform Stack

| Layer | Service | Purpose |
|-------|---------|---------|
| **Ingestion** | Azure Data Factory (ADF) | Orchestrate ETL pipelines from ERP, HR, Core Banking |
| **Raw Storage** | Azure Data Lake Storage Gen2 | Land raw files (expense extracts, headcount extracts, GL extracts) |
| **Processing** | Azure Databricks / Synapse Spark | Transform, cleanse, reconcile source data |
| **Serving** | Azure Synapse Analytics (Dedicated Pool) | Dimensional model for reporting & OneStream staging |
| **Orchestration** | Azure Data Factory + Logic Apps | Pipeline scheduling, error handling, notifications |
| **Monitoring** | Azure Monitor + Log Analytics | Pipeline health, data quality alerts, SLA tracking |
| **Security** | Azure Key Vault + Managed Identity | Credential management, no secrets in code |
| **Governance** | Microsoft Purview | Data catalog, lineage, classification |

### Data Pipeline Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  WORKDAY        │────│  Azure Data  │────│   Databricks    │────│  ONESTREAM XF    │
│  (ERP + HCM)    │     │   Factory    │     │   Processing    │     │  (EPM)           │
│                  │     │              │     │                 │     │                  │
│ • GL Journals    │     │ • Workday    │     │ • Cleanse       │     │ • Consolidation  │
│ • Trial Balance  │     │   RaaS API  │     │ • COA Mapping   │     │ • Planning       │
│ • AP/AR          │     │ • Schedule   │     │ • Entity Map    │     │ • Forecasting    │
│ • Headcount      │     │ • Monitor    │     │ • Driver Calc   │     │ • Allocations    │
│ • Compensation   │     │ • Retry      │     │ • Reconcile     │     │ • Reporting      │
│ • Cost Centres   │     │              │     │                 │     │                  │
└─────────────────┘     └──────────────┘     └─────────────────┘     └──────────────────┘
        │                                             │
        │
        │  ┌─────────────────┐               ┌─────────────────┐
        │  │  Facilities     │──────────────│  Azure Synapse   │
        │  │  (Sqft/Leases)  │               │  Analytics       │
        │  └─────────────────┘               │                  │
        │                                     │ • Fact tables    │
        │  ┌─────────────────┐               │ • Dim tables     │
        └─│  Treasury       │──────────────│ • Reconciliation │
           │  (Rates/FX)     │               │ • Audit/lineage  │
           └─────────────────┘               └─────────────────┘
```

### ADF Pipeline Design (Key Pipelines)

| Pipeline | Schedule | Source | Target | SLA |
|----------|----------|--------|--------|-----|
| `PL_Ingest_Workday_GL` | Daily 6AM ET | Workday RaaS (GL Journal Lines) | ADLS/raw/workday_gl/ | 30 min |
| `PL_Ingest_Workday_TB` | Monthly Day 2 | Workday RaaS (Trial Balance) | ADLS/raw/workday_tb/ | 20 min |
| `PL_Ingest_Workday_HCM` | Monthly Day 3 | Workday RaaS (Headcount/Comp) | ADLS/raw/workday_hcm/ | 30 min |
| `PL_Ingest_Expense` | Monthly Day 2 | Legacy expense workbook export | ADLS/raw/expense/ | 15 min |
| `PL_Transform_Consol` | Monthly Day 4 | ADLS/raw/workday_* | Synapse/dbo.fact_gl_balance | 1 hour |
| `PL_Transform_Allocation` | Monthly Day 5 | Synapse fact tables + drivers | Synapse/dbo.fact_allocation | 2 hours |
| `PL_Load_OneStream` | Monthly Day 5 | Synapse staging tables | OneStream REST API (Consol + Plan cubes) | 1 hour |
| `PL_Reconcile_Workday_OS` | Monthly Day 6 | Workday TB vs OneStream totals | Reconciliation report | 30 min |

### Databricks Processing Notebooks

| Notebook | Purpose | Input | Output |
|----------|---------|-------|--------|
| `01_extract_workday_raas` | Pull GL + HCM data via Workday RaaS API | Workday RaaS endpoints | Raw parquet in ADLS |
| `02_cleanse_workday_gl` | Standardize GL data, validate COA codes, map to OneStream dims | Raw Workday GL | Curated GL parquet |
| `03_map_workday_to_onestream` | Map Workday cost centres/worktags → OneStream Entity/Account | Workday hierarchies + mapping | Dimension load files |
| `04_calculate_drivers` | Compute allocation driver ratios (FTE, sqft, revenue) | Workday HCM + facilities + GL | Driver ratio table |
| `05_run_allocations` | Execute 3-pass allocation model | Expense data + drivers | Allocated costs by entity/product |
| `06_prepare_onestream_load` | Format for OneStream REST API (Consol + Planning cubes) | Transformed data | OneStream-formatted JSON |
| `07_reconcile_workday_onestream` | Workday Trial Balance vs OneStream totals | Workday TB + OneStream extract | Reconciliation exceptions |

---

## API Integration Architecture

### OneStream REST API Integration

OneStream XF exposes a REST API for programmatic data management:

```
Base URL: https://{tenant}.onestream.com/api/v1/
Auth: OAuth 2.0 (Client Credentials flow)
```

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/data` | POST | Load data into cubes | ADF pipeline (monthly load) |
| `/data` | GET | Extract data for reconciliation | Databricks reconcile notebook |
| `/businessrules` | POST | Trigger allocation engine | ADF post-load step |
| `/workflows` | GET | Check planning cycle status | Monitoring dashboard |
| `/consolidation` | POST | Trigger consolidation run | Close process automation |
| `/members` | GET | Extract dimension members | Data governance sync |
| `/applications` | GET | List applications | Health check |

### API Integration Patterns

**Pattern 1: Bulk Data Load (ADF → OneStream)** (illustrative amounts)
```python
# ADF Web Activity configuration
POST https://{tenant}.onestream.com/api/v1/data
Headers: Authorization: Bearer {access_token}
Body: {
    "application": "FinPlanning",
    "cube": "Actuals",
    "data": [
        {"Entity": "RetailBanking", "Account": "NIE_Salary", "Period": "{period}", "Amount": 1000000},
        {"Entity": "RetailBanking", "Account": "NIE_Benefits", "Period": "{period}", "Amount": 250000}
    ]
}
```

**Pattern 2: Trigger Business Rule Post-Load**
```python
# After data load completes, trigger allocation engine
POST https://{tenant}.onestream.com/api/v1/businessrules
Body: {
    "application": "FinPlanning",
    "ruleName": "AllocationEngine_Monthly",
    "parameters": {"period": "{period}", "scenario": "Actual"}
}
```

**Pattern 3: Reconciliation Extract**
```python
# Pull loaded data back for reconciliation
GET https://{tenant}.onestream.com/api/v1/data
    ?application=FinPlanning
    &scenario=Actual
    &entity=Corporate
    &period={period}
```

### Azure API Management (APIM) Layer

| Policy | Purpose |
|--------|---------|
| **Rate limiting** | 100 calls/min to OneStream API (avoid throttling) |
| **Retry logic** | 3 retries with exponential backoff on 429/5xx |
| **Circuit breaker** | Open after 5 consecutive failures, half-open after 60s |
| **Request logging** | All API calls logged to Log Analytics for audit |
| **Token caching** | OAuth token cached until 5 min before expiry |
| **IP whitelisting** | Only ADF managed IR and Databricks cluster IPs allowed |

### Integration with VOLT MCP Server

The existing OneStream MCP server (`mcp_servers/onestream/server.py`) provides 20 tools that map to the API endpoints above. In production mode (ONESTREAM_MOCK_MODE=false):

```
Environment Variables:
  ONESTREAM_BASE_URL=https://{tenant}.onestream.com
  ONESTREAM_USERNAME={service-account}
  ONESTREAM_PASSWORD=(from Azure Key Vault)
  ONESTREAM_NAMESPACE={namespace}
  ONESTREAM_MOCK_MODE=false
```

### Data Quality Framework

| Check | Implementation | Threshold | Action on Failure |
|-------|---------------|-----------|-------------------|
| **Completeness** | Row count source vs target | 100% match | Block load, alert |
| **Accuracy** | Control totals (sum of amounts) | Variance < $1 | Block load, alert |
| **Timeliness** | Pipeline SLA monitoring | Within schedule | Alert, escalate |
| **Uniqueness** | Duplicate detection (entity+account+period) | 0 duplicates | Reject duplicates |
| **Validity** | COA code exists in OneStream dimension | 100% valid | Reject invalid rows |
| **Consistency** | Debits = Credits (journal entries) | Zero balance | Block, alert |

---

## Azure Skills & Team Capabilities Required

### Technical Skills Matrix

| Role | Azure Skills | OneStream Skills | Data Skills |
|------|-------------|-----------------|-------------|
| **Data Engineer** | ADF, Databricks, ADLS Gen2, Synapse, Key Vault | REST API integration, data adapter design | Python, PySpark, SQL, data modeling |
| **Integration Architect** | APIM, Logic Apps, Event Grid, Service Bus | OneStream API patterns, bulk load design | API design, error handling, idempotency |
| **Cloud Architect** | ARM/Bicep, Networking, RBAC, Private Link | Deployment topology, HA/DR | Infrastructure as Code, security |
| **DevOps Engineer** | Azure DevOps, GitHub Actions, Container Registry | CI/CD for OneStream configs | Terraform, Docker, pipeline automation |
| **Analytics Engineer** | Synapse, Power BI, Purview | OneStream reporting, cube design | dbt, dimensional modeling, DAX |

### Azure Certifications (Recommended)

- AZ-900: Azure Fundamentals (all team members)
- DP-203: Data Engineering on Azure (data engineers)
- AZ-204: Developing Solutions for Azure (integration developers)
- AZ-305: Azure Solutions Architect (cloud architect)
- DP-500: Azure Enterprise Data Analyst (analytics engineer)

## References

| Reference | Content |
|-----------|---------|
| [Financial Information Model](references/financial-information-model.md) | Illustrative end-to-end data model (source → staging → core → allocation → planning → OneStream) for the fictional Proseware Finance |
