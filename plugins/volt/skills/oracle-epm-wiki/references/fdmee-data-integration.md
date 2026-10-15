# Oracle Data Management (FDMEE) — Data Integration for EPM Cloud

Complete implementation reference for Oracle EPM Cloud Data Management (formerly FDMEE).

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Data Management (DM) / Financial Data Management Enterprise Edition |
| **Common Names** | Data Management, FDMEE, Data Integration |
| **Purpose** | Source system data extraction, transformation, mapping, loading into EPM applications |
| **Key Users** | EPM administrators, data integration team, finance systems team |
| **Typical Implementation** | Configured alongside each EPM module (not standalone) |
| **Replaces (On-Prem)** | FDM / FDMEE (on-premise Financial Data Management) |

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Source System Connectivity** | Connect to ERP, files, databases, cloud services |
| **Data Mapping** | Map source values to EPM target dimension members |
| **Data Transformation** | Transform, validate, and cleanse data during load |
| **Data Load Rules** | Define end-to-end load process (source → transform → target) |
| **Validation Rules** | Check data quality before loading to EPM |
| **Drill-Through** | From EPM data back to source system detail |
| **Writeback** | Push EPM data (budget) back to source systems |
| **Multi-Target** | Load to EPBCS, FCCS, ARCS, TRCS, PCM from single source |
| **Scheduling** | Automate via EPM Automate or REST API |
| **Audit Trail** | Full log of all loads — who, when, what, how much |
| **Error Handling** | Capture and report mapping failures, validation errors |

---

## Architecture

### Data Flow

```
SOURCE                    DATA MANAGEMENT                      TARGET (EPM)
┌──────────────┐     ┌──────────────────────────────┐     ┌──────────────────┐
│ File (CSV)   │────│                              │────│ EPBCS (Actuals)  │
│ Oracle ERP   │     │  1. IMPORT (extract/stage)   │     │ FCCS (Consol)    │
│ SAP          │     │  2. MAP (source→target dims) │     │ ARCS (Balances)  │
│ Workday      │     │  3. VALIDATE (quality rules) │     │ TRCS (Tax data)  │
│ Database     │     │  4. EXPORT (load to EPM app)  │     │ PCM (Cost data)  │
│ REST API     │     │                              │     │                  │
└──────────────┘     └──────────────────────────────┘     └──────────────────┘
                              │

                     ┌──────────────────┐
                     │  PROCESS LOG     │
                     │  Error report    │
                     │  Audit trail     │
                     │  Drill-through   │
                     └──────────────────┘
```

### Processing Stages

| Stage | Name | Action |
|-------|------|--------|
| 1 | **Import** | Extract data from source (file, API, connection) into staging |
| 2 | **Mapping** | Apply dimension member mappings (source code → EPM member) |
| 3 | **Validation** | Run validation rules; flag/reject invalid records |
| 4 | **Export** | Load validated data into target EPM application |

---

## Source System Connections

### Connection Types

| Source Type | Connection Method | Configuration |
|-------------|-------------------|---------------|
| **File (CSV/TXT)** | Upload to EPM inbox | EPM Automate `uploadfile` or manual upload |
| **Oracle ERP Cloud** | Pre-built connector | OTBI/BI Publisher extract → DM agent |
| **Oracle EBS** | EPM Agent (on-prem) | JDBC connection via EPM Cloud Agent |
| **SAP (any version)** | File-based or Agent | Extract via SAP BW/SE16 → file → DM |
| **Workday** | REST API or RaaS | Workday Report-as-a-Service → file or direct |
| **SQL Database** | EPM Agent | JDBC to on-prem or cloud DB |
| **REST API** | Direct integration | Custom REST source adapter |
| **Google Sheets** | REST API | Google Sheets API extract |
| **Azure SQL / Synapse** | EPM Agent or file | Agent-based or ADF pipeline → file |

### EPM Cloud Agent (Integration Agent)

For on-premise sources, Oracle provides the **EPM Cloud Agent** — a lightweight Java service deployed on-prem:

| Feature | Detail |
|---------|--------|
| **Purpose** | Bridge on-prem data sources to cloud Data Management |
| **Deployment** | Windows or Linux server with network access to source DBs |
| **Protocol** | HTTPS outbound to Oracle Cloud (no inbound firewall rules needed) |
| **Supported** | JDBC connections (Oracle, SQL Server, MySQL, PostgreSQL, DB2) |
| **Scalability** | Multiple agents for HA; load balanced |
| **Scheduling** | Triggered by EPM Automate or DM job scheduler |

**Agent Installation Steps:**
1. Download agent installer from EPM Cloud (Settings → Downloads)
2. Install on server with network access to source databases
3. Configure `agentparams.ini` with EPM Cloud URL and credentials
4. Register agent in EPM Cloud (Data Management → Agent)
5. Create data source connections using the registered agent
6. Test connectivity to each source database

---

## Mapping Configuration

### Mapping Types

| Type | Description | Example |
|------|-------------|---------|
| **Explicit** | One-to-one direct mapping | Source "DEPT-100" → Target "Finance_Dept" |
| **Between** | Range mapping | Source accounts "4000-4999" → Target "Revenue" |
| **In** | List mapping | Source entities "CA01, CA02, CA03" → Target "Canada" |
| **Like** | Wildcard pattern | Source "5*" → Target "Expenses" (all accounts starting with 5) |
| **Multi-dimensional** | Conditional mapping (depends on other dims) | Source "4001" → "NII" IF Entity=Banking, else "Other_Revenue" |
| **Default/Otherwise** | Catch-all for unmapped values | Any unmapped account → "Suspense_999" |

### Mapping Table Example

```
SOURCE DIMENSION: Account
┌─────────────────────────────────────────────────────────────────────┐
│ Type     │ Source Value           │ Target Member          │ Notes  │
├──────────┼────────────────────────┼────────────────────────┼────────┤
│ Explicit │ 110100                 │ Cash_Equivalents       │        │
│ Explicit │ 120100                 │ AR_Trade               │        │
│ Explicit │ 120200                 │ AR_Other               │        │
│ Between  │ 130000 - 139999       │ Prepaid_Expenses       │        │
│ Between  │ 140000 - 149999       │ Fixed_Assets_Net       │        │
│ Between  │ 200000 - 209999       │ AP_Trade               │        │
│ Between  │ 300000 - 399999       │ Equity_Total           │        │
│ Like     │ 41*                    │ Interest_Income        │        │
│ Like     │ 42*                    │ Interest_Expense       │        │
│ Like     │ 5*                     │ NIE_Total              │        │
│ In       │ 601000,602000,603000   │ Professional_Fees      │        │
│ Multi-dim│ 410100 [Entity=Bank]   │ NII_Loans              │ Cond.  │
│ Multi-dim│ 410100 [Entity=Other]  │ Investment_Income      │ Cond.  │
│ Default  │ *                      │ UNMAPPED_ACCOUNT       │ Error  │
└─────────────────────────────────────────────────────────────────────┘
```

### Mapping Best Practices

1. **Map by exception** — Use range/wildcard mappings for the majority; explicit for exceptions
2. **Always have a default** — Catch unmapped values to prevent silent data loss
3. **Use multi-dim sparingly** — Complex conditional mapping is hard to maintain
4. **Document the logic** — Add notes explaining why non-obvious mappings exist
5. **Version control** — Export mappings periodically as backup before changes
6. **Test with real data** — Validate mappings against a full period's data before go-live
7. **Monitor unmapped** — Set up alerts for any records hitting the default mapping

---

## Data Load Rules

### Rule Components

| Component | Purpose |
|-----------|---------|
| **Source** | Which source system/file to read from |
| **Target Application** | Which EPM app to load into (EPBCS, FCCS, etc.) |
| **Target Plan Type** | Which cube within the application |
| **Import Format** | File layout definition (column positions, delimiters) |
| **Location** | Organizational scope (e.g., which entity's data) |
| **Period Mapping** | How source date/period maps to target period dimension |
| **Category** | Target Scenario member (Actual, Budget, Forecast) |
| **Load Method** | Replace (clear + load) or Accumulate (add to existing) |
| **Data Load Mapping** | Which mapping tables to apply per dimension |

### Import Format Configuration

**Fixed-Width File:**
```
Column 1-6:    Entity Code
Column 7-16:   Account Code
Column 17-24:  Period (YYYY-MM)
Column 25-40:  Amount (decimal)
Column 41-50:  Currency Code
```

**Delimited File (CSV):**
```csv
Entity,Account,Period,Amount,Currency
CA01,110100,2026-01,1542300.45,CAD
CA01,120100,2026-01,2341000.00,CAD
CA01,410100,2026-01,5600000.00,CAD
```

**Import Format Definition:**
```yaml
Format: GL_Trial_Balance_CSV
  Delimiter: Comma
  Header Rows: 1
  Columns:
    1: Entity (Source dimension)
    2: Account (Source dimension)
    3: Period (Source Period mapping, format: YYYY-MM)
    4: Amount (Data column, numeric)
    5: Currency (Ignore or map to Currency dimension)
```

---

## Validation Rules

### Built-In Validations

| Validation | Description | Action on Failure |
|------------|-------------|-------------------|
| **Unmapped members** | Source value has no mapping | Reject record; flag in error report |
| **Invalid members** | Mapped target member doesn't exist in EPM app | Reject record |
| **Data type** | Amount field contains non-numeric | Reject record |
| **Duplicate check** | Same intersection loaded twice in one batch | Warn or reject (configurable) |
| **Cross-validation** | Invalid dimension combination | Reject if combo not valid in target app |

### Custom Validation Rules (Groovy)

```groovy
// Validation: Reject negative revenue
if (targetAccount.startsWith("Revenue") && amount < 0) {
    reject("Negative revenue not allowed: ${sourceAccount} = ${amount}")
}

// Validation: Entity-Currency alignment
def entityCurrency = getEntityCurrency(targetEntity)
if (sourceCurrency != entityCurrency) {
    reject("Currency mismatch: Entity ${targetEntity} expects ${entityCurrency}, got ${sourceCurrency}")
}

// Validation: Period must be open
def openPeriods = getOpenPeriods(targetApp)
if (!openPeriods.contains(targetPeriod)) {
    reject("Period ${targetPeriod} is closed. Cannot load data.")
}
```

---

## Data Load Methods

| Method | Behavior | Use When |
|--------|----------|----------|
| **Replace** | Clear existing data at intersection, then load | Monthly actuals (full period reload) |
| **Accumulate** | Add loaded amounts to existing data | Incremental loads (daily postings) |
| **Replace by Security** | Clear only data user has access to | Multi-user loads (each entity owner loads their data) |
| **No Replace** | Load new intersections only; skip existing | Initial data migration (don't overwrite corrections) |

---

## Drill-Through Configuration

### Drill-Through Types

| Type | Description | Setup |
|------|-------------|-------|
| **To Source Data** | From EPM cell → DM staging table (loaded data) | Automatic (enabled by default) |
| **To Source System** | From EPM cell → ERP/source system UI | URL template with dynamic parameters |
| **To File** | From EPM cell → original loaded file | File retention configured |
| **Custom** | From EPM cell → any web URL with context | Custom URL with dimension member substitution |

### Drill-Through to Oracle ERP Example

```
URL Template:
https://erp.company.com/fscmUI/faces/FndOverview
  ?fndGlobalItemNodeId=GL_JOURNALS
  &_ledgerId=300000001
  &_accountingPeriod={Period}
  &_accountSegment={Account}
  &_entitySegment={Entity}
```

---

## EPM Automate Integration

### Common DM Commands

```batch
REM Run a data load rule
epmautomate rundatarule "GL_Actuals_Monthly" "Jan-26" "Jan-26" "REPLACE"

REM Import a pre-uploaded file
epmautomate importdata "PlanningData" "inbox/budget_data.csv" "Budget_Load_Format"

REM Run data load with specific import file
epmautomate rundatarule "GL_Load_Rule" "Jan-26" "Jan-26" "REPLACE" "inbox/gl_jan26.csv"

REM Check data load status
epmautomate listjobs

REM Export data from EPM (for reconciliation)
epmautomate exportdata "ActualExport" "outbox/actual_extract.csv"

REM Download error file
epmautomate copyfilefrominstance "outbox/GL_Load_errors.csv" "C:\logs\errors.csv"
```

### Automated Monthly Load Script

```batch
@echo off
set MONTH=%1
set YEAR=%2
set FILE=gl_trial_balance_%YEAR%_%MONTH%.csv

echo === EPM Monthly Data Load: %MONTH%-%YEAR% ===

REM Login
epmautomate login %EPM_USER% %EPM_PASS% %EPM_URL% %EPM_DOMAIN%
if %ERRORLEVEL% neq 0 (echo LOGIN FAILED & exit /b 1)

REM Upload file
echo Uploading %FILE%...
epmautomate uploadfile "C:\data\%FILE%" "inbox/data"
if %ERRORLEVEL% neq 0 (echo UPLOAD FAILED & goto :error)

REM Run data load rule
echo Running GL load rule...
epmautomate rundatarule "GL_Actuals_Load" "%MONTH%-%YEAR%" "%MONTH%-%YEAR%" "REPLACE"
if %ERRORLEVEL% neq 0 (echo LOAD FAILED & goto :error)

REM Validate (check for unmapped)
echo Checking load results...
epmautomate listjobs > load_status.txt

REM Run consolidation (if FCCS)
echo Running consolidation...
epmautomate runconsolidation "%YEAR%" "%MONTH%" "Actual"
if %ERRORLEVEL% neq 0 (echo CONSOLIDATION FAILED & goto :error)

echo === LOAD COMPLETE ===
epmautomate logout
exit /b 0

:error
echo === ERROR — CHECK LOGS ===
epmautomate copyfilefrominstance "outbox/errors.csv" "C:\logs\load_errors_%MONTH%_%YEAR%.csv"
epmautomate logout
exit /b 1
```

---

## Data Maps & Smart Push

### Data Maps (Between EPM Applications)

Data Maps move data **between EPM applications** without going through file-based load:

| Source | Target | Use Case |
|--------|--------|----------|
| EPBCS → FCCS | Budget/Forecast data to consolidation | Monthly planning data shared with consolidation |
| FCCS → EPBCS | Actuals from consolidation to planning | Seed forecast with consolidated actuals |
| FCCS → TRCS | Consolidated data to tax provision | Pre-tax income feeds tax calculation |
| EPBCS → PCM | Budget drivers to allocation model | Budgeted FTE/revenue for plan-year allocations |
| PCM → EPBCS | Allocated costs to planning | Allocated shared costs feed BU budgets |

### Smart Push Configuration

Smart Push **automatically pushes data** from one plan type to another after form save:

| Setting | Purpose |
|---------|---------|
| Source plan type | Which cube data comes from |
| Target plan type | Which cube data goes to |
| Mapping | How source members map to target members (if different) |
| Trigger | On form save, on business rule completion, or manual |
| Scope | Which members/intersections to push |

---

## Error Handling & Monitoring

### Common Error Types

| Error | Cause | Resolution |
|-------|-------|------------|
| `UNMAPPED_MEMBER` | Source value has no mapping entry | Add mapping for this value |
| `INVALID_MEMBER` | Target member doesn't exist in EPM dimension | Add member in EDM/EPM or fix mapping |
| `DATA_TYPE_ERROR` | Non-numeric in amount column | Fix source data; add data cleansing |
| `PERIOD_CLOSED` | Target period locked | Open period or load to correct period |
| `CROSS_VALIDATION_FAIL` | Invalid dimension member combination | Fix mapping or add valid combination to app |
| `CONNECTION_TIMEOUT` | Source system unreachable | Check network/firewall; retry |
| `FILE_FORMAT_ERROR` | Wrong delimiter, encoding, or layout | Fix file format or update import format definition |
| `DUPLICATE_INTERSECTION` | Same data point loaded twice | Deduplicate source or use Replace mode |
| `SECURITY_VIOLATION` | User lacks access to target intersection | Check user provisioning in target app |

### Monitoring & Alerting

| Check | Method | Frequency |
|-------|--------|-----------|
| Load job status | EPM Automate `listjobs` | After every load |
| Error count | DM Process Details → Export errors | After every load |
| Data totals reconciliation | Compare source TB totals to EPM totals | After every load |
| Unmapped items trend | Track unmapped count over time | Monthly review |
| Load duration trend | Monitor for performance degradation | Monthly |

---

## Implementation Best Practices

| Area | Best Practice |
|------|---------------|
| **Mapping governance** | One person owns mappings per dimension; change control required |
| **Test with full volume** | Don't just test with 10 rows; use actual data volumes |
| **Error threshold** | Set max error % (e.g., reject entire batch if >1% unmapped) |
| **Reconciliation** | Always reconcile: source total must equal EPM loaded total |
| **Automation** | Automate all recurring loads via EPM Automate from Day 1 |
| **File naming convention** | Standardize: `{source}_{entity}_{period}_{timestamp}.csv` |
| **Retention policy** | Keep loaded files for 12 months (audit trail / drill-through) |
| **Multi-period load** | Load all periods in one file where possible (faster than one-per-period) |
| **Start date-based period mapping** | Map source dates to EPM periods (don't rely on filename) |
| **Separation of concerns** | DM handles mapping; source systems handle extraction/cleansing |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| Data Management Admin Guide | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/` |
| Data Load Rules | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/data_load_rules.html` |
| Mappings | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/mappings.html` |
| Agent Installation | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/epm_cloud_agent.html` |
| Drill-Through | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/drill_through.html` |
| Data Maps & Smart Push | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/data_maps.html` |
| REST API | `docs.oracle.com/en/cloud/saas/epm-cloud/prest/data_management_rest.html` |
| EPM Automate DM Commands | `docs.oracle.com/en/cloud/saas/epm-cloud/cepma/data_mgmt_commands.html` |
