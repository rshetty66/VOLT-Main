# Oracle ERP Cloud — FBDI & Data Migration

Implementation reference for File-Based Data Import and data conversion methodology.

---

## FBDI Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | File-Based Data Import (FBDI) |
| **Purpose** | Load data into Oracle Cloud using Excel templates that map to interface tables |
| **Format** | Excel (.xlsm) macro-enabled workbook → generates CSV → uploaded to UCM → processed by ESS job |
| **Use Cases** | Data conversion (go-live), ongoing batch interfaces, mass updates |

---

## FBDI Process Flow

```
1. Download template (.xlsm) from Oracle Help
2. Populate data in Excel (follow column specs exactly)
3. Click "Generate CSV File" macro button in Excel
4. Upload CSV to Oracle UCM (Universal Content Management)
5. Submit ESS job (e.g., "Import Journals", "Import Payables Invoices")
6. Monitor job status in Scheduled Processes
7. Review errors in output report / interface tables
8. Correct and re-submit failed records
```

---

## Key FBDI Templates by Module

### General Ledger

| Template | ESS Job | Purpose |
|----------|---------|---------|
| `GlInterfaceTemplate.xlsm` | Import Journals | Journal entry import |
| `GlBalancesTemplate.xlsm` | Import Account Beginning Balances | Opening balance migration |
| `GlDailyRatesTemplate.xlsm` | Import Daily Rates | Exchange rate load |

### Accounts Payable

| Template | ESS Job | Purpose |
|----------|---------|---------|
| `ApInvoicesInterfaceTemplate.xlsm` | Import Payables Invoices | Invoice import |
| `ApSupplierImportTemplate.xlsm` | Import Suppliers | Supplier master data |
| `IbyExternalPayeesImportTemplate.xlsm` | Import Supplier Bank Accounts | Payment instruments |

### Accounts Receivable

| Template | ESS Job | Purpose |
|----------|---------|---------|
| `RaInterfaceLinesAllTemplate.xlsm` | Import AutoInvoice | AR transaction import |
| `ArCustomerImportTemplate.xlsm` | Import Customers | Customer master data |
| `ArReceiptImportTemplate.xlsm` | Import AR Receipts | Receipt/payment import |

### Fixed Assets

| Template | ESS Job | Purpose |
|----------|---------|---------|
| `FaAssetAdditionsTemplate.xlsm` | Post Mass Additions | Asset data migration |
| `FaMassAdditionsTemplate.xlsm` | Create Mass Additions | Bulk additions |

### Procurement

| Template | ESS Job | Purpose |
|----------|---------|---------|
| `PoHeadersInterfaceTemplate.xlsm` | Import Purchase Orders | PO migration |
| `ReqHeadersInterfaceTemplate.xlsm` | Import Requisitions | Requisition import |

### Projects

| Template | ESS Job | Purpose |
|----------|---------|---------|
| `PjcProjectImportTemplate.xlsm` | Import Projects | Project master |
| `PjcTransactionImportTemplate.xlsm` | Import Project Costs | Historical costs |

---

## Data Migration Methodology

### Phases

```
ASSESS (Wk 1-3) → EXTRACT (Wk 3-6) → TRANSFORM (Wk 4-8) → LOAD (Wk 6-10) → VALIDATE (Wk 8-12)
       │                │                    │                   │                   │
   Source analysis   Legacy extract      Cleanse/Map         FBDI load          Reconcile
   Object inventory  Data profiling      Enrich/Default      Test cycles        source = target
   Scope decision    Quality assess      Format to template  Error resolution   Sign-off
```

### Migration Objects Priority

| Priority | Objects | Rationale |
|----------|---------|-----------|
| **1 (Must)** | COA, Suppliers, Customers, Items | Foundation data — everything depends on these |
| **2 (Must)** | Open AP Invoices, Open AR Invoices | Active transactions for operational continuity |
| **3 (Must)** | GL Balances (Opening) | Starting point for new system |
| **4 (Should)** | Fixed Assets (all active) | Asset register continuity for depreciation |
| **5 (Should)** | Open POs | Active procurement continuity |
| **6 (Nice)** | Historical transactions | Reporting only (often leave in legacy) |

### Mock Migration Cycles

| Cycle | Timing | Purpose | Data Scope |
|-------|--------|---------|-----------|
| Mock 1 | Build phase (Week 6-8) | Validate templates and mapping | Sample (100 records per object) |
| Mock 2 | Test phase (Week 10-12) | Full volume test; timing estimate | Full extraction |
| Mock 3 | Pre-cutover (Week 14-16) | Dress rehearsal; validate reconciliation | Full extraction (refreshed) |
| Production | Cutover weekend | Live migration | Final extraction + delta |

---

## Data Quality Rules

| Rule | Check | Action |
|------|-------|--------|
| **Completeness** | Required fields populated | Reject record |
| **Uniqueness** | No duplicate keys (supplier #, invoice #) | Deduplicate |
| **Referential** | FK references exist (supplier on invoice exists) | Load dependencies first |
| **Format** | Dates, amounts, codes in correct format | Transform/fix |
| **Range** | Amounts within reasonable range | Flag outliers |
| **Cross-field** | Logical consistency (debit = credit on journals) | Reject imbalanced |

---

## Reconciliation Framework

### Control Totals

| Level | Check | Tolerance |
|-------|-------|-----------|
| **Record Count** | Source rows = Target loaded rows | 0 (exact) |
| **Amount Total** | Sum of amounts in source = sum in target | ±$1 (rounding) |
| **By Segment** | Per entity, per account group | ±$1 |
| **Trial Balance** | Source TB = Oracle GL TB | $0 |

---

## Common FBDI Issues

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| "File rejected" on upload | Wrong file format or encoding | Regenerate CSV from macro; check UTF-8 |
| ESS job error — "invalid value" | Data doesn't match LOV/lookup | Verify values against Oracle setup |
| "No rows imported" | Header row mismatch or empty CSV | Check CSV has data rows; header matches template |
| "Duplicate record" | Record already exists in system | Deduplicate source; or use UPDATE mode |
| "Invalid account combination" | Account segments don't pass CVR | Create combination or fix mapping |
| Partial load (some rows fail) | Mix of good and bad records | Fix failed rows in error report; re-import |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| FBDI Templates (all modules) | `docs.oracle.com/en/cloud/saas/financials/24d/oefbf/` |
| Data Import Guide | `docs.oracle.com/en/cloud/saas/financials/24d/oefbf/introduction.html` |
| ESS Jobs Reference | `docs.oracle.com/en/cloud/saas/financials/24d/oefse/` |
| UCM File Upload | `docs.oracle.com/en/cloud/saas/financials/24d/oefbf/upload-files.html` |
