# Oracle ERP Cloud — Integration Patterns

Enterprise integration patterns for Oracle Cloud ERP.

---

## Integration Options Overview

| Method | Use Case | Real-Time? | Complexity |
|--------|----------|------------|------------|
| **FBDI (File-Based)** | Batch data loads, conversions | No (batch) | Low |
| **REST API** | CRUD operations, real-time | Yes | Medium |
| **SOAP Web Services** | Legacy integrations | Yes | Medium-High |
| **BI Publisher / OTBI** | Data extraction / reporting | No (scheduled) | Low |
| **Oracle Integration Cloud (OIC)** | Orchestrated flows, transformations | Near-real-time | Medium |
| **Business Events** | Event-driven notifications | Near-real-time | Medium |
| **ADFDi (Excel)** | Smart spreadsheet integration | Interactive | Low |

---

## REST API

### Base URL Pattern
```
https://{pod}.fa.{datacenter}.oraclecloud.com/fscmRestApi/resources/{version}/{resource}
```

### Key REST Resources

| Module | Resource | Operations |
|--------|----------|-----------|
| GL | `/journals` | Create, Get, Update |
| AP | `/invoices` | Create, Get, Update, Submit |
| AR | `/receivablesInvoices` | Create, Get |
| Procurement | `/purchaseOrders` | Create, Get, Update, Change |
| Projects | `/projects` | Create, Get, Update |
| Suppliers | `/suppliers` | Create, Get, Update |
| Customers | `/customerAccounts` | Create, Get, Update |

### Authentication

| Method | Use Case |
|--------|----------|
| **Basic Auth** | Simple integrations (user/pass) |
| **OAuth 2.0** | Production integrations (client credentials flow) |
| **JWT** | Service-to-service (assertion-based) |

---

## Oracle Integration Cloud (OIC)

### When to Use OIC

- Complex orchestration (multi-step, conditional logic)
- Transformation between formats
- Error handling with retry/recovery
- Monitoring and alerting dashboard
- Pre-built adapters for Oracle Cloud

### OIC Adapter for Oracle ERP Cloud

| Feature | Capability |
|---------|-----------|
| **Business Objects** | Direct access to ERP business objects (Invoice, PO, Supplier) |
| **Business Events** | Subscribe to ERP events (Invoice Approved, PO Created) |
| **Bulk Import** | Trigger FBDI loads via ERP adapter |
| **Callbacks** | Async operations with completion callback |
| **FBDI** | Generate and load FBDI files programmatically |

---

## Business Events (Outbound)

Oracle ERP Cloud publishes events that external systems can subscribe to:

| Event | Trigger | Use Case |
|-------|---------|----------|
| `oracle.apps.fin.ap.invoices.invoiceApproved` | Invoice approved | Notify downstream systems |
| `oracle.apps.prc.po.purchaseOrderApproved` | PO approved | Trigger supplier notification |
| `oracle.apps.fin.gl.journalPosted` | Journal posted | Update data warehouse |
| `oracle.apps.fin.ar.receiptApplied` | Receipt applied | Update CRM with payment |
| `oracle.apps.fin.fa.assetAdded` | Asset created | Notify insurance system |

### Consuming Business Events

```
Oracle ERP Cloud → Business Event Published
    → Oracle Integration Cloud (listener)
        → Transform payload
            → Route to target system (REST/File/Message)
```

---

## Common Integration Patterns

### Pattern 1: Inbound Data (External → Oracle ERP)

```
Source System → Extract Data → Transform to FBDI Format → Upload to UCM → Trigger ESS Job → Validate
```

### Pattern 2: Real-Time Inbound (via REST)

```
Source System → POST /fscmRestApi/resources/v1/{resource} → Oracle ERP → Response (201 Created)
```

### Pattern 3: Outbound Data (Oracle ERP → External)

```
Oracle ERP → BI Publisher Report (scheduled) → Output file → Download via UCM → Load to Target
```

### Pattern 4: Event-Driven (ERP → Middleware → Target)

```
Oracle ERP → Business Event → OIC Listener → Transform → Target System (Salesforce, ServiceNow, etc.)
```

---

## Security for Integrations

| Control | Implementation |
|---------|---------------|
| **Dedicated integration user** | Service account with only required roles |
| **Least privilege** | Assign minimum roles/duties for integration scope |
| **IP whitelisting** | Restrict API access by source IP (if supported) |
| **OAuth tokens** | Short-lived tokens; no stored passwords |
| **Audit logging** | All API calls logged for compliance |
| **Error masking** | Don't expose internal errors in API responses |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| REST API Reference | `docs.oracle.com/en/cloud/saas/financials/24d/farfa/` |
| SOAP Services | `docs.oracle.com/en/cloud/saas/financials/24d/oefsc/` |
| Business Events | `docs.oracle.com/en/cloud/saas/financials/24d/oefsb/` |
| OIC ERP Adapter | `docs.oracle.com/en/cloud/paas/integration-cloud/erp-adapter/` |
| FBDI Guide | `docs.oracle.com/en/cloud/saas/financials/24d/oefbf/` |
