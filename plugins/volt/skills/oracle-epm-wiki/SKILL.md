---
name: oracle-epm-wiki
description: >
  Oracle EPM Cloud implementation wiki and LLM knowledge base. Activates when users ask about
  "Oracle EPM", "EPM Cloud", "PBCS", "EPBCS", "FCCS", "ARCS", "TRCS", "Narrative Reporting",
  "EDM", "PCM", "FDMEE", "Data Management EPM", "EPM configuration", "EPM setup",
  "EPM troubleshooting", "EPM integration", "EPM best practices", "EPM dimension design",
  "EPM business rules", "EPM SmartView", "EPM calculation scripts", "EPM forms",
  "EPM dashboards", "EPM security", "EPM data load", "EPM migration", "EPM REST API",
  "EPM Cloud administration", "EPM lifecycle management", "Planning Cloud", "Financial Close",
  "consolidation cloud", "account reconciliation cloud", "tax reporting cloud",
  "profitability cost management", "enterprise data management cloud", "EPM Automate",
  "Groovy EPM", "calc scripts", "member formulas", "EPM Smart View", "EPM reports",
  "EPM task manager", "close manager", "supplemental data manager", "EPM journals",
  "EPM currency translation", "EPM intercompany elimination", "EPM ownership management",
  "EPM data maps", "EPM smart push", "EPM sandbox", "EPM approvals", "EPM workforce planning",
  "EPM capital planning", "EPM strategic modeling", "Oracle Hyperion migration",
  "Hyperion to cloud", "on-prem to EPM Cloud", "EPM update policy", "monthly EPM updates",
  or any Oracle EPM Cloud implementation, configuration, or support question.
version: 1.0.0
disable-model-invocation: true
---

# Oracle EPM Cloud — Implementation Wiki & Knowledge Base

Comprehensive implementation reference for all 9 Oracle EPM Cloud modules. This wiki serves as the
authoritative knowledge base for consultants delivering Oracle EPM Cloud implementations —
covering configuration guidance, setup procedures, common issues, integration patterns, and
field-tested best practices from implementation experience.

---

## Module Map

| Module | Acronym | Primary Use | Reference |
|--------|---------|-------------|-----------|
| Planning and Budgeting Cloud Service | PBCS | Budgeting, forecasting, what-if | [epbcs-planning.md](references/epbcs-planning.md) |
| Enterprise Planning and Budgeting Cloud | EPBCS | PBCS + Strategic Modeling + modules | [epbcs-planning.md](references/epbcs-planning.md) |
| Financial Consolidation and Close Cloud | FCCS | Legal consolidation, close mgmt | [fccs-consolidation.md](references/fccs-consolidation.md) |
| Account Reconciliation Cloud Service | ARCS | Balance sheet recs, transaction matching | [arcs-reconciliation.md](references/arcs-reconciliation.md) |
| Tax Reporting Cloud Service | TRCS | Tax provision, deferred tax, CbCR | [trcs-tax-reporting.md](references/trcs-tax-reporting.md) |
| Narrative Reporting | EPRCS | Board packs, management reports, XBRL | [narrative-reporting.md](references/narrative-reporting.md) |
| Enterprise Data Management Cloud | EDM | Master data governance, hierarchies | [edm-data-management.md](references/edm-data-management.md) |
| Profitability and Cost Management Cloud | PCM | Allocations, profitability analysis | [pcm-profitability.md](references/pcm-profitability.md) |
| Data Management / FDMEE | DM/FDMEE | Data integration, mapping, loading | [fdmee-data-integration.md](references/fdmee-data-integration.md) |

**Cross-cutting references:**
- [Troubleshooting KB](references/troubleshooting-kb.md) — Common errors, resolution steps, SR patterns
- [Integration Patterns](references/integration-patterns.md) — ERP-to-EPM, EPM-to-BI, API patterns

---

## Oracle EPM Cloud Architecture Overview

### Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          ORACLE EPM CLOUD PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  EPBCS   │  │   FCCS   │  │   ARCS   │  │   TRCS   │  │ Narrative Report │ │
│  │Planning  │  │ Consol & │  │  Account │  │   Tax    │  │   Management     │ │
│  │Budgeting │  │  Close   │  │  Recon   │  │ Reporting│  │   Reporting      │ │
│  │Forecast  │  │          │  │          │  │          │  │                  │ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └────┬─────┘  └────────┬─────────┘ │
│        │              │              │             │                  │           │
│  ┌─────┴──────────────┴──────────────┴─────────────┴──────────────────┴───────┐ │
│  │                    SHARED SERVICES LAYER                                    │ │
│  │  ┌───────────┐  ┌───────────┐  ┌────────────┐  ┌───────────┐              │ │
│  │  │    EDM    │  │    PCM    │  │  DM/FDMEE  │  │ EPM Auto- │              │ │
│  │  │  Master   │  │Profitabil-│  │    Data    │  │   mate    │              │ │
│  │  │   Data    │  │ity & Cost │  │ Integration│  │  (CLI)    │              │ │
│  │  └───────────┘  └───────────┘  └────────────┘  └───────────┘              │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                    FOUNDATION LAYER                                         │ │
│  │  • Identity (IDCS/IAM)  • REST API  • Migration (LCM)  • Audit             │ │
│  │  • Smart View           • Groovy    • Calc Scripts      • Task Manager      │ │
│  │  • Inboxes/Dashboards   • Reports   • Jobs/Scheduler    • Connections       │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Deployment Model

Oracle EPM Cloud is **SaaS-only** (no private cloud or on-prem option for new deployments). Key characteristics:

| Aspect | Detail |
|--------|--------|
| **Hosting** | Oracle Cloud Infrastructure (OCI) Gen 2, multi-tenant |
| **Updates** | Monthly automatic updates (cannot defer more than 1 month) |
| **Environments** | Test + Production included; Dev available as add-on |
| **Data Residency** | Region selection at provisioning (US, EMEA, APAC data centers) |
| **SLA** | 99.5% availability; 4-hour maintenance windows (monthly) |
| **Backup** | Daily automated; 60-day retention; on-demand snapshot via LCM |
| **Scaling** | Elastic — Oracle manages compute/storage scaling |
| **Access** | Browser (Chrome, Edge, Firefox), Smart View (Excel), REST API, EPM Automate |

### Environment Strategy (Recommended)

```
DEV (optional)  ───LCM migrate───  TEST  ───LCM migrate───  PRODUCTION
  │                                   │                            │
  │ Build & unit test                 │ SIT & UAT                  │ Live operations
  │ Rapid iteration                   │ Data validation            │ Monthly close/plan
  │ Sandbox enabled                   │ Parallel run               │ Locked after close
  └───────────────────────────────────┴────────────────────────────┘
```

---

## Shared Platform Capabilities

### 1. EPM Automate (Command-Line Utility)

EPM Automate is the **primary automation tool** for Oracle EPM Cloud. It replaces manual admin tasks with scriptable commands.

**Installation:** Download from the EPM Cloud instance (Settings → Downloads → EPM Automate)

**Key Commands:**

| Command | Purpose | Example |
|---------|---------|---------|
| `login` | Authenticate to instance | `epmautomate login admin@co.com pass https://epm-xxxx.oraclecloud.com domain` |
| `importdata` | Load data file | `epmautomate importdata "PlanData" "data_file.csv" "DataLoadRule"` |
| `rundatarule` | Execute DM data load rule | `epmautomate rundatarule "GL_Load" "Jan-26" "Dec-26" "REPLACE"` |
| `runbusinessrule` | Execute calc/business rule | `epmautomate runbusinessrule "Allocate_Costs" "{"Period":"Jan-26"}` |
| `runconsolidation` | Trigger consolidation | `epmautomate runconsolidation "FY26" "Jan" "Actual"` |
| `exportdata` | Extract data | `epmautomate exportdata "ExportActuals" "export.csv"` |
| `exportsnapshot` | LCM export (backup) | `epmautomate exportsnapshot "Full_Backup" "Full_Backup.zip"` |
| `importsnapshot` | LCM import (restore/migrate) | `epmautomate importsnapshot "Full_Backup.zip"` |
| `refreshcube` | Rebuild Essbase cube | `epmautomate refreshcube "Plan1"` |
| `runcompliancereport` | ARCS compliance report | `epmautomate runcompliancereport "Q4_Close"` |
| `copyfilefrominstance` | Download file from outbox | `epmautomate copyfilefrominstance "report.pdf" "C:\local\report.pdf"` |
| `uploadfile` | Upload file to inbox | `epmautomate uploadfile "data.csv" "inbox/planning"` |
| `listfiles` | List inbox/outbox contents | `epmautomate listfiles` |

**Automation Pattern (Windows Batch):**
```batch
@echo off
set EPM_URL=https://epm-xxxx.oraclecloud.com
set EPM_USER=svc_epm_automation@company.com
set EPM_PASS=encrypted_password_file
set EPM_DOMAIN=CompanyIdentityDomain

REM Login
epmautomate login %EPM_USER% %EPM_PASS% %EPM_URL% %EPM_DOMAIN%
if %ERRORLEVEL% neq 0 (echo LOGIN FAILED & exit /b 1)

REM Upload data file
epmautomate uploadfile "C:\data\gl_actuals.csv" "inbox/data"

REM Run data load rule
epmautomate rundatarule "GL_Actuals_Load" "Jan-26" "Jan-26" "REPLACE"

REM Run allocation business rule
epmautomate runbusinessrule "Monthly_Allocation"

REM Run consolidation
epmautomate runconsolidation "FY26" "Jan" "Actual"

REM Download report
epmautomate runreport "Monthly_Package" "output/monthly.pdf"
epmautomate copyfilefrominstance "output/monthly.pdf" "C:\reports\monthly.pdf"

REM Logout
epmautomate logout
```

### 2. REST API

Oracle EPM Cloud exposes a comprehensive REST API for programmatic integration.

**Base URL:** `https://{epm-instance}.oraclecloud.com/HyperionPlanning/rest/v3/`

**Authentication:** Basic Auth or OAuth 2.0 (IDCS token)

**Key Endpoints:**

| Resource | Method | Path | Purpose |
|----------|--------|------|---------|
| Applications | GET | `/applications` | List all applications |
| Dimensions | GET | `/applications/{app}/dimensions` | List dimensions |
| Members | GET | `/applications/{app}/dimensions/{dim}/members` | Get dimension members |
| Data | POST | `/applications/{app}/plantypes/{plan}/importdataslice` | Import data slice |
| Data | POST | `/applications/{app}/plantypes/{plan}/exportdataslice` | Export data slice |
| Business Rules | POST | `/applications/{app}/plantypes/{plan}/rules/{rule}` | Launch business rule |
| Jobs | GET | `/applications/{app}/jobs` | List/monitor jobs |
| Jobs | POST | `/applications/{app}/jobs` | Launch job (consolidation, close, etc.) |
| Data Load | POST | `/aif/rest/V1/jobs` | Trigger Data Management load |
| LCM | POST | `/interop/rest/11.1.2.3.600/applicationsnapshots/` | Export/import snapshots |

**Example — Load Data via REST API (Python):**
```python
import requests
import json

EPM_URL = "https://epm-xxxx.oraclecloud.com"
AUTH = ("svc_user@company.com", "password")

# Import a data slice
payload = {
    "aggregateEssbaseData": False,
    "cellNotesOption": "Skip",
    "dateFormat": "MM/DD/YYYY",
    "dataGrid": {
        "pov": ["FY26", "Jan", "Working", "Local"],
        "columns": [["Account1"], ["Account2"], ["Account3"]],
        "rows": [
            {"headers": ["Entity1"], "data": ["1000", "2000", "3000"]},
            {"headers": ["Entity2"], "data": ["1500", "2500", "3500"]}
        ]
    }
}

response = requests.post(
    f"{EPM_URL}/HyperionPlanning/rest/v3/applications/FinPlan/plantypes/Plan1/importdataslice",
    auth=AUTH,
    json=payload,
    headers={"Content-Type": "application/json"}
)
print(response.status_code, response.json())
```

### 3. Smart View (Excel Add-in)

Smart View is the **primary end-user interface** for Oracle EPM Cloud data interaction.

**Key Capabilities:**
- Ad-hoc analysis and retrieval from Essbase cubes
- Data input forms rendered in Excel
- Function-based reporting (HsGetValue, HsSetValue)
- Multi-grid sheets (multiple POVs on one worksheet)
- VBA macro-driven automation

**Smart View Connection Setup:**
1. Download Smart View installer from EPM Cloud (Settings → Downloads)
2. Install Office add-in (requires local admin)
3. Add Shared Connection: `https://{instance}.oraclecloud.com/workspace/SmartViewProviders`
4. Expand tree: EPM Cloud → Application → Database (Plan Type)

**Common Smart View Issues:**

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| "Unable to connect" | Proxy/firewall blocking | Whitelist `*.oraclecloud.com` on ports 443 |
| Slow retrieval | Too many members in POV | Limit member selection; use substitution variables |
| "You do not have access" | Security role missing | Assign Planner/Viewer role in Access Control |
| Data not saving | Form locked or period closed | Check form properties; verify period is open |
| Excel crash on open | Smart View version mismatch | Update to latest Smart View matching EPM version |
| #NoData in cells | No data at intersection | Verify members exist and data has been loaded |

### 4. Groovy Business Rules

Groovy is the **modern scripting language** for EPM Cloud business rules (replacing legacy calc scripts for complex logic).

**When to Use Groovy vs Calc Scripts:**

| Use Case | Groovy | Calc Script |
|----------|--------|-------------|
| Complex conditional logic |  Preferred | Limited |
| REST API calls within rule |  Only option |  Not possible |
| Data movement between cubes |  Preferred |  Not possible |
| Simple aggregations | Either |  Faster execution |
| Allocation calculations |  Preferred | Possible but clunky |
| Cross-dimensional operations |  Preferred | Limited |
| Workforce/capital modules | Required |  Not supported |

**Groovy Template — Monthly Allocation:**
```groovy
/* Monthly Cost Allocation — Step-down method
   Allocates shared services costs to business lines using driver ratios */

// Define the runtime prompt variables
String period = rtps.Period
String scenario = rtps.Scenario
String version = rtps.Version

// Step 1: Get total shared services cost pool
def costPool = operation.grid.getCellValue(
    "Entity::SharedServices",
    "Account::Total_NIE",
    "Period::${period}",
    "Scenario::${scenario}",
    "Version::${version}"
)

// Step 2: Get driver ratios from assumptions cube
def drivers = operation.application.getSubstitutionVariable("AllocDrivers")

// Step 3: Allocate to each target entity
operation.grid.dataCellIterator("Entity::BU_*").each { cell ->
    def entityName = cell.getMemberName("Entity")
    def driverRatio = getDriverRatio(entityName, period)
    def allocatedAmount = costPool * driverRatio
    cell.data = allocatedAmount
}

// Helper function
def getDriverRatio(String entity, String period) {
    return operation.grid.getCellValue(
        "Entity::${entity}",
        "Account::FTE_Ratio",
        "Period::${period}",
        "Scenario::Actual",
        "Version::Final"
    )
}
```

### 5. Calculation Scripts (Essbase)

Calc scripts remain relevant for **performance-critical aggregations** and simple calculations.

**Template — Dense Member Calculation:**
```
/* Standard aggregation after data load */
SET UPDATECALC OFF;
SET AGGMISSG ON;

FIX(@RELATIVE("Scenario", 0), @RELATIVE("Version", 0), @RELATIVE("Period", 0))
  CALC DIM("Account", "Entity");
ENDFIX

/* Currency translation */
FIX("Actual", "Final", @RELATIVE("Period", 0))
  "USD"(
    @XREF("Rates", "Average_Rate") * "Local";
  )
ENDFIX
```

### 6. Lifecycle Management (LCM)

LCM is the **migration and backup mechanism** for EPM Cloud.

**What LCM Migrates:**

| Component | Included | Notes |
|-----------|----------|-------|
| Application metadata (dimensions, members) |  | Full dimension hierarchy |
| Business rules & calc scripts |  | Rule definitions + runtime prompts |
| Forms & dashboards |  | Layout, POV, formatting |
| Task lists |  | Task definitions, not instances |
| Security (Access Control) |  | Roles, provisioning (optional) |
| Data |  by default | Must explicitly export data separately |
| Substitution variables |  | Included in application snapshot |
| Smart View connections |  | Must be reconfigured per environment |
| Data Management (FDMEE) rules |  | Data load rules, mappings |
| Reports (Narrative/FR) |  | Report definitions |

**LCM Best Practices:**
1. **Always take a snapshot before monthly updates** — Oracle applies updates monthly; snapshot allows rollback
2. **Selective migration** — Don't migrate everything; select only artifacts that changed
3. **Test first** — Always migrate to TEST before PRODUCTION
4. **Document delta** — Maintain a migration manifest listing what was promoted and why
5. **Automate via EPM Automate** — Never rely on manual LCM exports for production

### 7. Security Model

Oracle EPM Cloud uses a **role-based security model** managed through Oracle Identity Cloud Service (IDCS) or OCI IAM.

**Predefined Roles:**

| Role | Access Level | Typical Assignment |
|------|-------------|-------------------|
| Service Administrator | Full system access, user management | EPM system admin (1-2 people) |
| Power User | Create artifacts, manage metadata | Finance super-users, FP&A managers |
| Planner | Data input, form submission, approvals | Budget holders, cost centre managers |
| Viewer | Read-only access to data and reports | Executives, auditors |
| Approver | Approve planning units in workflows | VP Finance, CFO |

**Data Access Security (Provisioning):**
- **Dimension-based security**: Grant Read/Write/None per dimension member
- **Intersection security**: Restrict access to specific data intersections
- **Form security**: Control which forms a user can see
- **Task list security**: Control which tasks appear for each user

### 8. Monthly Update Cadence

Oracle EPM Cloud receives **mandatory monthly updates**. This is non-negotiable — you cannot remain on an old version.

**Update Schedule:**
- **Test environment**: Updated first (typically 1st Friday of month)
- **Production environment**: Updated 1 week later (2nd Friday)
- **Maintenance window**: 1-4 hours (typically early morning local time)

**Update Readiness Checklist:**
1. Review Oracle monthly update documentation (released ~2 weeks before)
2. Test critical business processes in TEST after update applies
3. Validate Smart View connectivity post-update
4. Verify business rules still execute correctly
5. Check any REST API integrations (API versions occasionally change)
6. Confirm reports render correctly
7. Document any new features to leverage

---

## Implementation Methodology — Oracle EPM Cloud

### Phase Model (Typical 16-24 Week Implementation)

```
ASSESS (Wk 1-4)  →  DESIGN (Wk 4-10)  →  BUILD (Wk 8-16)  →  TEST (Wk 14-20)  →  DEPLOY (Wk 18-24)
     │                    │                     │                    │                     │

• Current state      • Dimension          • Configure app     • Unit test          • Cutover plan
• Requirements         architecture       • Build rules        • SIT                • Data migration
• Fit-gap            • Form design        • Build forms        • UAT                • Go-live
• Business case      • Rule logic         • Load data          • Parallel run       • Hypercare
• Roadmap            • Security model     • Build integrations • Performance test   • Knowledge transfer
                     • Report design      • Build reports
```

### Critical Success Factors

| Factor | Why It Matters | How to Ensure |
|--------|---------------|---------------|
| **Dimension design locked early** | Changes after build require full rebuild | Sign off dimensions by end of Design |
| **Form design based on process** | Forms drive user adoption | Map forms to actual business process steps |
| **Business rules well-documented** | Maintenance nightmare if not | Create rule documentation as part of build |
| **Security model planned upfront** | Retrofit is extremely painful | Design security in parallel with dimensions |
| **Integration tested end-to-end** | Data quality issues surface late | Begin integration testing in Build, not Test |
| **Change management starts Day 1** | EPM fails without adoption | Include change workstream from kickoff |
| **Monthly updates planned for** | Can break customizations | Build regression test suite; review release notes |

### Dimension Design — The Most Critical Decision

**Standard Dimensions (present in all EPM modules):**

| Dimension | Purpose | Design Guidance |
|-----------|---------|-----------------|
| **Scenario** | Data categorization | Actual, Budget, Forecast, What-If (keep flat, <10 members) |
| **Version** | Workflow states | Working, Submitted, Approved (keep flat, <5 members) |
| **Period** | Time | Monthly granularity standard; weekly optional for specific modules |
| **Year** | Fiscal year | 3-5 years typical (current + 2-3 forecast + 1 prior for comparison) |
| **Entity** | Organization structure | Mirror legal/management hierarchy; max 4-5 levels deep |
| **Account** | Financial accounts | COA-aligned; separate P&L from BS; driver accounts separate |
| **Currency** | Reporting currencies | Local + reporting currencies (CAD, USD typically) |

**Custom Dimensions (application-specific):**

| Dimension | When Needed | Example Members |
|-----------|-------------|-----------------|
| **Product** | Product-level P&L | Mortgages, Cards, Deposits, Wealth |
| **Channel** | Channel analysis | Branch, Online, Mobile, Partner |
| **Project** | CapEx or project tracking | Project codes with lifecycle stages |
| **Customer** | Customer profitability | Segments: Retail, Commercial, Institutional |
| **Cost Driver** | Allocation models | FTE, SqFt, Revenue, Transactions |
| **Movement** | BS roll-forward | Opening, Additions, Disposals, Closing |
| **Intercompany** | ICO elimination | Mirror of Entity dimension |

**Design Anti-Patterns:**

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|-----------------|
| >8 dimensions per cube | Extreme sparsity, slow performance | Consolidate related members into shared dims |
| Account dim >2000 members | Maintenance burden, slow forms | Use attribute dimensions for reporting views |
| Entity dim >5 levels deep | Consolidation performance | Flatten where possible; use alternate hierarchies |
| Putting reporting views in base dims | Cube explosion | Use dynamic members or reporting layer (BI tool) |
| Mixing driver/assumption with financial accounts | Confusion, security issues | Separate cube for assumptions and drivers |
| Hardcoding years in member names | Annual maintenance to extend | Use substitution variables (CurYear, PriorYear) |

---

## Hyperion-to-Cloud Migration Path

### Migration Assessment Checklist

| On-Prem Module | Cloud Equivalent | Migration Complexity |
|----------------|-----------------|---------------------|
| Hyperion Planning (HFP) | PBCS/EPBCS | Medium — dimension remap, rule conversion |
| Hyperion Financial Management (HFM) | FCCS | High — rule rewrite, consolidation method changes |
| Financial Data Quality Mgmt (FDQM/FDMEE) | Data Management (DM) | Medium — rule migration supported |
| Hyperion Financial Reporting (FR) | Financial Reporting (Cloud FR) | Low — mostly automated migration |
| Hyperion Smart View | Smart View (Cloud) | Low — reconnect to cloud URL |
| Essbase (on-prem) | Essbase Cloud or OAC | Medium — BSO to hybrid cube conversion |
| DRM (Data Relationship Mgmt) | EDM Cloud | High — governance workflow redesign |
| Hyperion Tax Provision | TRCS | High — complete reimplementation |
| Hyperion Profitability (HPCM) | PCM Cloud | Medium — model redesign recommended |

### Migration Steps (Hyperion Planning → EPBCS)

1. **Assessment (2-4 weeks):**
   - Inventory all applications, databases, dimensions, forms, rules, reports
   - Identify customizations (calc scripts, Java, MaxL, custom connectors)
   - Assess data volume and history requirements
   - Document integrations (FDMEE rules, API consumers, downstream)

2. **Architecture redesign (2-4 weeks):**
   - Map on-prem dimensions to cloud dimension limits
   - Convert BSO-only designs to hybrid (ASO+BSO) where beneficial
   - Redesign business rules that used unsupported on-prem features
   - Plan security model migration (Shared Services → IDCS/IAM)

3. **Build & configure (4-8 weeks):**
   - Create cloud application with redesigned metadata
   - Convert calc scripts to Groovy where needed
   - Rebuild forms and dashboards (cloud UI differs from on-prem)
   - Configure Data Management rules and mappings

4. **Data migration (2-4 weeks):**
   - Export historical data from on-prem (typically 3-5 years)
   - Transform data to match new dimension mappings
   - Load via Data Management or EPM Automate
   - Validate totals match source (control totals by entity/period)

5. **Testing & cutover (4-6 weeks):**
   - Parallel run (on-prem and cloud simultaneously for 1-3 periods)
   - User acceptance testing with actual business processes
   - Performance validation (retrieval times, rule execution)
   - Cutover execution (final data load, on-prem decommission)

### Key Differences: On-Prem vs Cloud

| Feature | On-Prem (Hyperion) | Cloud (EPM) |
|---------|-------------------|-------------|
| Updates | Customer-controlled (annual) | Oracle-forced (monthly) |
| Customization | Extensive (Java, custom servlets) | Limited (Groovy, REST, standard config) |
| Infrastructure | Customer-managed | Oracle-managed (SaaS) |
| MaxL | Full MaxL support | Not available (replaced by REST API + EPM Automate) |
| Essbase | BSO or ASO | Hybrid (BSO+ASO in one cube) |
| Shared Services | On-prem identity management | IDCS / OCI IAM |
| Batch scheduling | Custom (ODI, shell scripts) | EPM Automate + Job Scheduler |
| Report Server | Financial Reporting (on-prem) | FR Cloud or Narrative Reporting |
| High Availability | Customer-designed clustering | Oracle-managed (99.5% SLA) |

---

## Oracle Documentation Sources & Training

### Official Oracle Resources

| Resource | URL Pattern | Content |
|----------|-------------|---------|
| Oracle Help Center | `docs.oracle.com/en/cloud/saas/epm-cloud/` | Complete product documentation |
| EPM Cloud Operations Guide | `docs.oracle.com/en/cloud/saas/epm-cloud/csopc/` | Admin & operations |
| EPM Cloud REST API | `docs.oracle.com/en/cloud/saas/epm-cloud/prest/` | REST API reference |
| Readiness (monthly updates) | `docs.oracle.com/en/cloud/saas/epm-cloud/readiness.html` | Feature release notes |
| Smart View Guide | `docs.oracle.com/en/cloud/saas/epm-cloud/svpbc/` | Smart View user guide |
| EPM Automate | `docs.oracle.com/en/cloud/saas/epm-cloud/cepma/` | Automation command reference |
| My Oracle Support (MOS) | `support.oracle.com` | SRs, patches, known issues |
| Oracle University | Cloud Learning Subscriptions | Instructor-led & self-paced training |
| EPM Cloud Customer Connect | `community.oracle.com/tech/apps-user-experience` | Customer community forum |

### Certification Path

| Certification | Code | Covers |
|---------------|------|--------|
| Oracle EPM Cloud Implementation Specialist | 1Z0-1090 | PBCS/EPBCS implementation |
| Oracle Financials Cloud Implementation Specialist | 1Z0-1058 | GL + subledgers (ERP side) |
| Oracle EPM Financial Consolidation Specialist | 1Z0-1091 | FCCS implementation |

### Training Path for Implementation Teams

**Week 1-2 (Foundation):**
- Oracle EPM Cloud Fundamentals (self-paced, Oracle University)
- Smart View essentials
- EPM Automate CLI walkthrough
- Security and provisioning model

**Week 3-4 (Module Deep-Dive):**
- Module-specific training (EPBCS, FCCS, ARCS per project scope)
- Dimension and metadata design workshop
- Groovy scripting for EPM Cloud
- Data Management / integration configuration

**Week 5-6 (Advanced):**
- Performance optimization and cube design
- Complex business rule development
- REST API integration development
- LCM and DevOps for EPM

---

## Knowledge Base Training Guide

### How to Expand This Wiki

This wiki is designed for **progressive enrichment**. As your team encounters new patterns, issues, and solutions, add them to the appropriate reference file:

**Adding Oracle Help Center content:**
1. Navigate to the relevant Oracle documentation page
2. Extract the key configuration steps, parameters, and gotchas
3. Add to the module-specific reference file with Oracle doc reference
4. Tag with the Oracle release version (e.g., "24.05" for May 2024 update)

**Adding MOS knowledge articles:**
1. When resolving an SR or finding a useful MOS article, capture the pattern
2. Add to `troubleshooting-kb.md` with: Symptom → Root Cause → Resolution → MOS Reference
3. Do NOT copy MOS article text verbatim (copyright) — summarize the pattern

**Adding project experience:**
1. After each go-live, document lessons learned per module
2. Add configuration patterns that worked to the module reference
3. Add anti-patterns (things that failed) to the troubleshooting KB
4. Update dimension design guidance based on real performance data

**Tagging convention for entries:**
```
[SOURCE: Oracle-Docs] — from Oracle Help Center
[SOURCE: MOS-{article#}] — from My Oracle Support
[SOURCE: Project] — from implementation experience (never name the client)
[SOURCE: Training] — from Oracle University or certification prep
[SOURCE: Community] — from Customer Connect or forums
```

---

## Integration with VOLT Knowledge Base

This skill integrates with VOLT's knowledge systems at multiple levels:

### 1. Skill Context Injection
When any user query matches EPM keywords, the `route_to_agent()` function in `agents.py` routes to this skill. The `load_skill_context()` function injects the SKILL.md content (and referenced materials) into the LLM context.

### 2. Document Knowledge Base
Reference documents added to VOLT's reference library are discoverable by the `document_knowledge.py` scanner. When a project is active, these documents are indexed and searchable via the Knowledge Base page.

### 3. LLM Wiki Generation
The `llm_wiki.py` module uses this skill's content when generating wiki articles on EPM topics. The skill context is injected alongside research results and KB extractions.

### 4. Agent Knowledge (Persistent Memory)
The `agents_knowledge/oracle-epm-wiki.md` file provides persistent context that survives across all sessions and projects, ensuring every VOLT agent can reference Oracle EPM expertise.

### 5. Cross-Project Availability
This skill is available to ALL projects in VOLT — not project-scoped. Any project involving Oracle EPM Cloud, in any industry, can invoke this knowledge base.
