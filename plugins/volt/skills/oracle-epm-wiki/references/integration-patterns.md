# Oracle EPM Cloud — Integration Patterns

Enterprise integration patterns for connecting Oracle EPM Cloud with ERP systems, data platforms, BI tools, and operational systems.

---

## Integration Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ENTERPRISE INTEGRATION LAYER                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SOURCE SYSTEMS              MIDDLEWARE              EPM CLOUD               │
│  ┌──────────────┐      ┌──────────────────┐      ┌───────────────────┐    │
│  │ Oracle ERP   │─────│                  │─────│ EPBCS (Planning)  │    │
│  │ SAP S/4HANA  │      │  • Azure Data    │      │ FCCS (Consol)     │    │
│  │ Workday      │      │    Factory       │      │ ARCS (Recon)      │    │
│  │ Core Banking │      │  • MuleSoft      │      │ TRCS (Tax)        │    │
│  │ HR/HCM       │      │  • Oracle IC     │      │ PCM (Allocation)  │    │
│  │ Treasury     │      │  • Informatica   │      │ EDM (Master Data) │    │
│  │ Data Lake    │      │  • Custom ETL    │      │ Narrative Report  │    │
│  └──────────────┘      └──────────────────┘      └───────────────────┘    │
│                                │                          │                 │
│                                │                                           │
│                                │                  ┌───────────────────┐    │
│                                │                  │ DOWNSTREAM / BI    │    │
│                                └─────────────────│ • Power BI        │    │
│                                                   │ • Tableau          │    │
│                                                   │ • OAC              │    │
│                                                   │ • Data Warehouse   │    │
│                                                   └───────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pattern 1: File-Based Integration (Most Common)

### Architecture

```
ERP/Source → Extract (scheduled) → CSV/TXT file → Upload to EPM inbox → Data Management load
```

### When to Use
- Simple, low-frequency loads (monthly close)
- Source system cannot expose API
- Quick implementation (lowest setup effort)
- Legacy systems with limited connectivity options

### Implementation

**Step 1: Source Extract**
```sql
-- Example: GL Trial Balance extract from Oracle ERP
SELECT
    gl.entity_code AS Entity,
    gl.account_code AS Account,
    TO_CHAR(gl.period_end_date, 'Mon-YY') AS Period,
    SUM(gl.net_amount) AS Amount,
    gl.currency_code AS Currency
FROM gl_balances gl
WHERE gl.period_name = 'JAN-26'
  AND gl.ledger_id = 1001
  AND gl.actual_flag = 'A'
GROUP BY gl.entity_code, gl.account_code, gl.period_end_date, gl.currency_code
```

**Step 2: File Format (CSV)**
```csv
Entity,Account,Period,Amount,Currency
CA01,110100,Jan-26,1542300.45,CAD
CA01,120100,Jan-26,2341000.00,CAD
CA01,410100,Jan-26,5600000.00,CAD
```

**Step 3: Upload & Load (EPM Automate)**
```batch
epmautomate login user pass url domain
epmautomate uploadfile "gl_balance.csv" "inbox/data"
epmautomate rundatarule "GL_Actuals" "Jan-26" "Jan-26" "REPLACE"
epmautomate logout
```

### Pros/Cons

| Pros | Cons |
|------|------|
| Simple to implement | Manual intervention risk |
| Works with any source system | No real-time capability |
| Easy to troubleshoot (file is auditable) | File transfer must be managed |
| Low infrastructure cost | Latency (batch-only) |

---

## Pattern 2: Oracle ERP Cloud Direct Connector

### Architecture

```
Oracle ERP Cloud → Pre-built Data Integration → EPM Cloud Data Management → Target Application
```

### When to Use
- Source is Oracle ERP Cloud (Fusion)
- Standard GL balance or subledger data
- Leveraging Oracle's pre-built integrations

### Pre-Built Integration Types

| Integration | Source | Target | Data |
|-------------|--------|--------|------|
| **GL Balances** | ERP General Ledger | FCCS, EPBCS | Trial balance by period |
| **AP Invoices** | ERP Payables | ARCS | AP subledger for reconciliation |
| **AR Receipts** | ERP Receivables | ARCS | AR subledger for reconciliation |
| **Fixed Assets** | ERP Assets | ARCS, EPBCS | Asset balances, depreciation |
| **Projects** | ERP Projects | EPBCS | Project costs and budgets |
| **Budgets** | EPBCS | ERP Budgetary Control | Approved budgets for checking |

### Configuration Steps
1. Navigate to Data Management → Data Integration
2. Select source: "Oracle ERP Cloud"
3. Configure ERP connection (URL, credentials, ledger, entity set)
4. Select data type (GL Balances, Journals, Subledger)
5. Map ERP segments to EPM dimensions
6. Schedule extraction frequency
7. Test with current period data

---

## Pattern 3: REST API Integration

### Architecture

```
Source System → Middleware (ADF/MuleSoft/custom) → EPM REST API → Target Application
```

### When to Use
- Need programmatic control over data flow
- Integration with modern cloud platforms
- Complex transformation logic
- Event-driven loads (not just scheduled batch)
- Multiple source systems consolidated before loading

### EPM Cloud REST API Endpoints

| Operation | Method | Endpoint | Use Case |
|-----------|--------|----------|----------|
| Import data slice | POST | `/HyperionPlanning/rest/v3/applications/{app}/plantypes/{plan}/importdataslice` | Load planning data |
| Export data slice | POST | `/HyperionPlanning/rest/v3/applications/{app}/plantypes/{plan}/exportdataslice` | Extract EPM data |
| Run business rule | POST | `/HyperionPlanning/rest/v3/applications/{app}/plantypes/{plan}/rules/{rule}` | Trigger calculations |
| Run DM data load | POST | `/aif/rest/V1/jobs` | Trigger Data Management rule |
| Run consolidation | POST | `/HyperionPlanning/rest/v3/applications/{app}/jobs` | Trigger FCCS consolidation |
| Get job status | GET | `/HyperionPlanning/rest/v3/applications/{app}/jobs/{jobId}` | Monitor job completion |
| List members | GET | `/HyperionPlanning/rest/v3/applications/{app}/dimensions/{dim}/members` | Validate members exist |
| Upload file | POST | `/interop/rest/11.1.2.3.600/applicationsnapshots/upload` | Upload file to inbox |

### Python Integration Example

```python
import requests
import time
import json

class OracleEPMClient:
    def __init__(self, base_url, username, password):
        self.base_url = base_url
        self.auth = (username, password)
        self.headers = {"Content-Type": "application/json"}

    def import_data_slice(self, app_name, plan_type, data_grid):
        """Load data directly into EPM via REST API"""
        url = f"{self.base_url}/HyperionPlanning/rest/v3/applications/{app_name}/plantypes/{plan_type}/importdataslice"
        payload = {
            "aggregateEssbaseData": False,
            "cellNotesOption": "Skip",
            "dataGrid": data_grid
        }
        response = requests.post(url, auth=self.auth, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def run_business_rule(self, app_name, plan_type, rule_name, parameters=None):
        """Execute a business rule with optional runtime prompts"""
        url = f"{self.base_url}/HyperionPlanning/rest/v3/applications/{app_name}/plantypes/{plan_type}/rules/{rule_name}"
        payload = {"parameters": parameters or {}}
        response = requests.post(url, auth=self.auth, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def run_data_load_rule(self, rule_name, start_period, end_period, import_mode="REPLACE"):
        """Trigger a Data Management load rule"""
        url = f"{self.base_url}/aif/rest/V1/jobs"
        payload = {
            "jobType": "DATARULE",
            "jobName": rule_name,
            "startPeriod": start_period,
            "endPeriod": end_period,
            "importMode": import_mode
        }
        response = requests.post(url, auth=self.auth, json=payload, headers=self.headers)
        response.raise_for_status()
        return response.json()

    def run_consolidation(self, app_name, year, period, scenario):
        """Trigger FCCS consolidation"""
        url = f"{self.base_url}/HyperionPlanning/rest/v3/applications/{app_name}/jobs"
        payload = {
            "jobType": "CONSOLIDATION",
            "jobName": "Consolidate_All",
            "parameters": {
                "year": year,
                "period": period,
                "scenario": scenario
            }
        }
        response = requests.post(url, auth=self.auth, json=payload, headers=self.headers)
        response.raise_for_status()
        job_id = response.json().get("jobId")
        return self._wait_for_job(app_name, job_id)

    def _wait_for_job(self, app_name, job_id, timeout=600):
        """Poll job status until completion"""
        url = f"{self.base_url}/HyperionPlanning/rest/v3/applications/{app_name}/jobs/{job_id}"
        start = time.time()
        while time.time() - start < timeout:
            response = requests.get(url, auth=self.auth)
            status = response.json().get("status")
            if status in ("COMPLETED", "SUCCEEDED"):
                return {"status": "success", "jobId": job_id}
            elif status in ("FAILED", "ERROR"):
                return {"status": "failed", "jobId": job_id, "details": response.json()}
            time.sleep(10)
        return {"status": "timeout", "jobId": job_id}


# Usage Example: Monthly Close Data Load
client = OracleEPMClient(
    base_url="https://epm-xxxx.oraclecloud.com",
    username="svc_integration@company.com",
    password="secure_password"
)

# Load actuals
result = client.run_data_load_rule("GL_Actuals_Load", "Jan-26", "Jan-26", "REPLACE")
print(f"Load status: {result}")

# Run allocation
result = client.run_business_rule("FinPlan", "Plan1", "Monthly_Allocation",
                                   {"Period": "Jan", "Scenario": "Actual"})
print(f"Allocation: {result}")

# Run consolidation
result = client.run_consolidation("FCCS_App", "FY26", "Jan", "Actual")
print(f"Consolidation: {result}")
```

---

## Pattern 4: Azure Data Factory Pipeline

### Architecture

```
Source Systems → ADF Extract → ADLS Staging → ADF Transform → EPM Cloud (REST API / File Upload)
```

### When to Use
- Azure-centric organization
- Multiple source systems feeding EPM
- Complex transformations needed before loading
- Centralized orchestration and monitoring required
- Need data lineage and governance (Purview integration)

### ADF Pipeline Design

```json
{
    "name": "PL_Monthly_EPM_Load",
    "activities": [
        {
            "name": "Extract_GL_from_ERP",
            "type": "Copy",
            "source": {"type": "OracleSource", "query": "SELECT..."},
            "sink": {"type": "DelimitedText", "path": "raw/gl/"}
        },
        {
            "name": "Transform_Map_Dimensions",
            "type": "DataFlow",
            "dependsOn": ["Extract_GL_from_ERP"],
            "dataflow": "DF_MapGLtoEPM"
        },
        {
            "name": "Generate_EPM_Load_File",
            "type": "Copy",
            "dependsOn": ["Transform_Map_Dimensions"],
            "sink": {"type": "DelimitedText", "path": "processed/epm_load.csv"}
        },
        {
            "name": "Upload_to_EPM_Inbox",
            "type": "WebActivity",
            "dependsOn": ["Generate_EPM_Load_File"],
            "method": "POST",
            "url": "https://epm.oraclecloud.com/interop/rest/.../upload",
            "body": "@pipeline().variables.fileContent"
        },
        {
            "name": "Trigger_Data_Load_Rule",
            "type": "WebActivity",
            "dependsOn": ["Upload_to_EPM_Inbox"],
            "method": "POST",
            "url": "https://epm.oraclecloud.com/aif/rest/V1/jobs",
            "body": {"jobType": "DATARULE", "jobName": "GL_Load"}
        },
        {
            "name": "Wait_For_Load_Completion",
            "type": "Until",
            "dependsOn": ["Trigger_Data_Load_Rule"],
            "expression": "@equals(activity('Check_Job_Status').output.status, 'COMPLETED')"
        },
        {
            "name": "Run_Consolidation",
            "type": "WebActivity",
            "dependsOn": ["Wait_For_Load_Completion"],
            "method": "POST",
            "url": "https://epm.oraclecloud.com/.../jobs",
            "body": {"jobType": "CONSOLIDATION"}
        }
    ]
}
```

### ADF Monitoring & Error Handling

| Pattern | Implementation |
|---------|---------------|
| **Retry on transient failure** | Set retry policy: 3 attempts, 30s intervals |
| **Alert on failure** | Logic App trigger → Teams/email notification |
| **Reconciliation check** | Compare source row count / totals with loaded totals |
| **Idempotency** | Use REPLACE mode; re-running same period is safe |
| **Logging** | Log to Azure Monitor / Log Analytics for audit |
| **Secrets management** | Azure Key Vault for EPM credentials (never in pipeline) |

---

## Pattern 5: EPM-to-BI (Outbound to Power BI / Tableau)

### Architecture Options

| Option | Method | Real-Time? | Complexity |
|--------|--------|------------|------------|
| **Smart View + Excel** | Smart View retrieval → Power BI Excel connector | No (manual refresh) | Low |
| **REST API extract** | Script pulls data via API → BI data source | Near-real-time | Medium |
| **Data Management export** | DM writeback to file/DB → BI connects to DB | Batch | Medium |
| **Oracle Analytics Cloud** | Native connection from OAC to EPM | Near-real-time | Low (if OAC) |
| **Azure Synapse staging** | API extract → Synapse → Power BI DirectQuery | Scheduled | High |

### Power BI Integration Pattern (Recommended)

```
EPM Cloud (REST API)

Scheduled Python Script (Azure Function / ADF)

Azure Synapse Analytics (Dedicated Pool)

Power BI (DirectQuery or Import mode)
```

**Python Extract for BI:**
```python
def extract_epm_data_for_bi(client, app, plan_type, scenario, year, periods, entities):
    """Extract EPM data and write to staging DB for BI consumption"""
    data_grid = {
        "pov": [scenario, year],
        "columns": [[p] for p in periods],
        "rows": [{"headers": [e]} for e in entities]
    }

    result = client.export_data_slice(app, plan_type, data_grid)

    # Write to Synapse staging table
    df = pd.DataFrame(result["data"])
    df.to_sql("fact_epm_actuals", engine, if_exists="replace", schema="staging")

    return len(df)
```

---

## Pattern 6: Writeback (EPM → ERP)

### Architecture

```
EPM Cloud (Approved Budget) → Data Management Export → Middleware → ERP (Budget Control)
```

### When to Use
- Push approved budgets from EPBCS to ERP for budgetary control
- Send allocated costs from PCM back to operational systems
- Export forecast data to supply chain/operations planning

### Implementation Steps
1. Create Data Management **export** rule (reverse of import)
2. Define target mapping (EPM dimensions → ERP segments)
3. Schedule export after budget approval workflow completes
4. Middleware picks up export file and loads to ERP via standard ERP integration
5. Validate: ERP budget totals = EPM approved budget totals

---

## Pattern 7: EDM-Driven Dimension Sync

### Architecture

```
EDM (Master Data) → Subscription → Target Applications (EPBCS, FCCS, ARCS, TRCS)
                  → Export File → Non-EPM Systems (ERP, BI)
```

### Flow

1. Change request submitted in EDM (e.g., new cost centre)
2. Data steward approves change
3. EDM commits change to dimension
4. Subscription auto-triggers export to target applications
5. EPM applications receive new member (available immediately)
6. Optional: EDM export file sent to ERP/BI for sync

### Timing Considerations

| Change Type | When to Sync | Risk if Delayed |
|-------------|-------------|-----------------|
| New entity | Before first data load for that entity | Data load rejects |
| New account | Before first posting | Unmapped in DM |
| Entity rename | Before next reporting cycle | Wrong labels in reports |
| Member retirement | After last data load for that member | Data loss if premature |
| Hierarchy change | Before next consolidation/reporting | Wrong roll-up |

---

## Integration Reconciliation Framework

### Control Totals Check

Every integration must validate that **source totals = target totals**:

| Check | Formula | Acceptable Variance |
|-------|---------|---------------------|
| Row count | Source rows - Target loaded rows = 0 | 0 (exact) |
| Amount total | Source sum - EPM sum = 0 | ±$1 (FX rounding) |
| Entity balance | Source TB per entity = EPM per entity | ±$1 |
| Account total | Source by account group = EPM by account group | ±$1 |
| Debit = Credit | Sum of all loaded amounts (journals) | $0 (must balance) |

### Reconciliation Automation

```python
def reconcile_load(source_totals, epm_totals, tolerance=1.00):
    """Compare source and target totals post-load"""
    exceptions = []

    for entity, source_total in source_totals.items():
        epm_total = epm_totals.get(entity, 0)
        variance = abs(source_total - epm_total)

        if variance > tolerance:
            exceptions.append({
                "entity": entity,
                "source": source_total,
                "target": epm_total,
                "variance": variance,
                "status": "FAIL"
            })

    if exceptions:
        send_alert(f"Reconciliation failed: {len(exceptions)} entities out of tolerance")
        return False

    return True
```

---

## Security & Compliance for Integrations

### Credential Management

| Approach | Security Level | Use Case |
|----------|---------------|----------|
| **Azure Key Vault** | High | Production integrations (ADF, Functions) |
| **Encrypted password file** | Medium | EPM Automate scripts |
| **OAuth 2.0 tokens** | High | REST API integrations |
| **Managed Identity** | Highest | Azure-native services connecting to APIs |
| **Plaintext in script** |  NEVER | — |

### Network Security

| Control | Implementation |
|---------|---------------|
| **IP whitelisting** | EPM Cloud allows IP restriction for API access |
| **Private endpoints** | Not available for EPM SaaS (public endpoint only) |
| **TLS 1.2+** | Enforced by Oracle Cloud |
| **Mutual TLS** | Not supported; use IP whitelist + strong auth |
| **VPN** | Not required (HTTPS outbound sufficient) |
| **Firewall rules** | Allow outbound 443 to `*.oraclecloud.com` |

### Audit & Compliance

| Requirement | How Addressed |
|-------------|---------------|
| **Who loaded what?** | Data Management audit log (user, timestamp, rule, record count) |
| **Data lineage** | DM drill-through from EPM cell to source record |
| **Change history** | EDM request log; LCM migration log |
| **SOX compliance** | Separation of duties: load ≠ approve ≠ close |
| **Retention** | Keep load files and logs for 7 years (configurable) |

---

## Integration Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|-----------------|
| Loading directly to Essbase (bypassing DM) | No mapping, no audit, no validation | Always use Data Management for governed loads |
| Hardcoding credentials in scripts | Security risk; password rotation breaks it | Use Key Vault or encrypted password files |
| No reconciliation check | Errors go undetected until reporting | Always reconcile source <-> target post-load |
| Loading one file per entity (100 entities = 100 files) | Slow, error-prone, hard to monitor | Consolidate into one file; DM handles entity mapping |
| Manual file upload for recurring loads | Human error; schedule dependency on person | Automate via EPM Automate + scheduler |
| Transforming data inside EPM (complex rules) | Hard to debug; performance risk | Transform before loading (in middleware/ETL) |
| Not handling monthly updates | API version or behavior changes break integration | Test integrations in TEST env after each update |
| Over-engineering for simple needs | File-based would suffice | Start with file-based; move to API only when needed |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| Data Integration Guide | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/` |
| REST API Reference | `docs.oracle.com/en/cloud/saas/epm-cloud/prest/` |
| EPM Automate | `docs.oracle.com/en/cloud/saas/epm-cloud/cepma/` |
| EPM Cloud Agent | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/epm_cloud_agent.html` |
| Oracle ERP Cloud Integration | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/erp_cloud_integration.html` |
| Data Maps & Smart Push | `docs.oracle.com/en/cloud/saas/epm-cloud/diadm/data_maps.html` |
| Security Administration | `docs.oracle.com/en/cloud/saas/epm-cloud/epmsc/` |
