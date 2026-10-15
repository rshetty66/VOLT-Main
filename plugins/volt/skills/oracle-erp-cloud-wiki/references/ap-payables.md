# Oracle ERP Cloud — Accounts Payable (AP)

Complete implementation reference for Oracle Cloud Payables.

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Oracle Payables Cloud |
| **Purpose** | Invoice processing, payment management, supplier management, expense accruals |
| **Key Users** | AP clerks, AP managers, procurement team, treasury |
| **Typical Implementation** | 8-12 weeks (as part of Financials) |

---

## AP Process Flows

### Procure-to-Pay (P2P) Lifecycle

```
REQUISITION → PURCHASE ORDER → RECEIPT → INVOICE → PAYMENT
     │              │              │          │          │
  Requester     Buyer/Proc     Warehouse    AP Team   Treasury
                                            (3-way    (Payment
                                             match)    batch)
```

### Invoice Processing

| Step | Process | Validation |
|------|---------|-----------|
| 1 | Invoice received (paper/email/EDI/supplier portal) | — |
| 2 | Invoice created in system (manual or auto-scan) | Duplicate check |
| 3 | Invoice validated | Matching tolerance, tax calc, accounting |
| 4 | Approval workflow (if configured) | Threshold-based approval |
| 5 | Accounting created (SLA rules fire) | DR Expense/Asset, CR AP Liability |
| 6 | Payment scheduled (payment terms drive due date) | Cash forecast |
| 7 | Payment executed (check, EFT, wire) | Bank account, format |
| 8 | Payment cleared (bank reconciliation) | Statement matching |

---

## Key Configuration

### Invoice Matching

| Matching Type | Description | Tolerance Setup |
|--------------|-------------|-----------------|
| **2-Way** | Invoice matches PO (price × qty) | Price variance %, quantity variance |
| **3-Way** | Invoice matches PO AND Receipt | Adds receipt quantity check |
| **4-Way** | Invoice matches PO + Receipt + Inspection | Adds quality inspection confirmation |

**Matching Tolerances:**

| Tolerance | Typical Setting | Action on Breach |
|-----------|----------------|-----------------|
| Price | ±5% or ±$10 | Hold for review |
| Quantity | ±10% or ±5 units | Hold for review |
| Amount | ±$100 | Hold for review |
| Tax | ±$1 | Auto-adjust or hold |

### Payment Terms

| Term | Description | Example |
|------|-------------|---------|
| Net 30 | Full amount due in 30 days | Standard supplier terms |
| 2/10 Net 30 | 2% discount if paid in 10 days | Discount opportunity |
| Net 45 EOM | Due 45 days after end of month | Month-end alignment |
| Immediate | Due upon receipt | Critical suppliers |
| Installments | Split across periods | Large invoices |

### Payment Methods

| Method | Use Case | Configuration |
|--------|----------|---------------|
| **EFT/ACH** | Domestic electronic payments | Bank account, format file (NACHA, CPA005) |
| **Wire Transfer** | International / large payments | SWIFT/BIC, beneficiary details |
| **Check** | Legacy vendors, backup | Check stock, sequence, positive pay file |
| **Credit Card** | Employee expenses | Corporate card programs |
| **Virtual Card** | Supplier payments with rebate | Card provider integration |

---

## Supplier Management

### Supplier Setup Components

| Component | Purpose | Key Fields |
|-----------|---------|-----------|
| **Supplier** | Legal entity record | Name, TIN/BN, classification, 1099/T4A |
| **Supplier Site** | Location/address | Remit-to address, payment method, bank account |
| **Supplier Contact** | Person at supplier | Name, email, phone, role |
| **Bank Account** | Payment destination | Bank, branch/transit, account #, currency |
| **Payment Terms** | When to pay | Standard terms assigned at site level |

### Supplier Data (FBDI Import)

Key FBDI templates for supplier setup:
- `ApSupplierImportTemplate.xlsm` — Supplier header
- `ApSupplierSiteImportTemplate.xlsm` — Supplier sites
- `ApSupplierContactImportTemplate.xlsm` — Contacts
- `IbyExternalPayeesImportTemplate.xlsm` — Bank accounts/payment instruments

---

## Holds & Approvals

### Invoice Holds

| Hold Type | Trigger | Resolution |
|-----------|---------|------------|
| **Matching Hold** | Price/qty variance exceeds tolerance | Adjust invoice or release hold |
| **Distribution Variance** | Distribution total ≠ invoice amount | Fix distributions |
| **Insufficient PO** | Invoice exceeds PO amount | Amend PO or get approval |
| **Tax Variance** | Calculated tax ≠ entered tax | Adjust tax or release |
| **Account Invalid** | GL account combination fails validation | Fix account coding |
| **Manual Hold** | User-applied (disputed, under review) | Manual release after resolution |

### Approval Workflow (AME)

Oracle Approval Management Engine (AME) drives AP invoice approval:
- Rules based on: amount, supplier, category, cost center, project
- Routing: sequential, parallel, or hierarchy-based
- Actions: approve, reject, additional info, reassign
- Notifications: email + in-app (BPM worklist)

---

## Payments Processing

### Payment Process Request (PPR)

```
1. SELECT invoices for payment
   - By supplier, due date, payment method, priority
   - Review and modify selection

2. BUILD payment batch
   - Group by bank account, payment method, currency
   - Apply payment grouping rules

3. FORMAT payment file
   - Generate bank file (EFT/ACH format)
   - Generate check print file
   - Positive pay file generation

4. TRANSMIT
   - Send to bank (manual or automated)
   - Mark as transmitted

5. CONFIRM
   - Bank confirms receipt/processing
   - Clear in cash management
```

### Payment File Formats (Canada/US)

| Format | Use | Standard |
|--------|-----|----------|
| CPA 005 | Canadian EFT (domestic) | Canadian Payments Association |
| NACHA/ACH | US electronic payments | National Automated Clearing House |
| SWIFT MT103 | International wire | ISO 20022 / SWIFT |
| ISO 20022 XML | Modern payment standard | pain.001 (credit transfer) |
| Positive Pay | Fraud prevention (check verification) | Bank-specific format |

---

## Tax Configuration

### Withholding Tax (1099 / T4A)

| Region | Reporting | Configuration |
|--------|-----------|---------------|
| US | IRS 1099-MISC/NEC | Supplier classification + income type |
| Canada | CRA T4A/NR4 | Supplier type + withholding rate |
| International | Country-specific WHT | Tax authority + rate + exemption certificates |

### Transaction Tax (Sales/Use Tax, GST/HST)

- Oracle Tax engine calculates tax on AP invoices
- Self-assessment for use tax (goods purchased without tax charged)
- Offset accounts for recoverable vs non-recoverable tax
- Tax reporting codes for regulatory returns

---

## FBDI Templates for AP

| Template | Purpose | Volume |
|----------|---------|--------|
| `ApInvoicesInterfaceTemplate.xlsm` | Invoice import (header + lines + distributions) | Batch loads |
| `ApSupplierImportTemplate.xlsm` | Supplier master data | Conversion & ongoing |
| `ApPaymentImportTemplate.xlsm` | Payment records (historical) | Conversion only |
| `ApPrepaymentImportTemplate.xlsm` | Prepayment/deposit imports | As needed |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Invoice stuck in validation | Missing or invalid GL account | Fix distribution account; re-validate |
| Payment file rejected by bank | Format error (wrong field length/content) | Check format template; validate file |
| Duplicate invoice detected | Same supplier + invoice # + amount | Review: true duplicate or different invoice |
| Matching hold won't release | Tolerance still exceeded | Adjust tolerance, amend PO, or override hold |
| 1099/T4A reporting incorrect | Supplier classification wrong | Fix supplier income type; regenerate |
| Cash discount not taken | Payment after discount date | Review payment scheduling; faster processing |
| Supplier bank account invalid | Routing # or account # wrong | Verify with supplier; update bank details |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| AP Implementation Guide | `docs.oracle.com/en/cloud/saas/financials/24d/fapay/` |
| Payments | `docs.oracle.com/en/cloud/saas/financials/24d/fapmt/` |
| Supplier Management | `docs.oracle.com/en/cloud/saas/procurement/24d/fapro/suppliers.html` |
| Tax Configuration | `docs.oracle.com/en/cloud/saas/financials/24d/fatax/` |
| FBDI Templates | `docs.oracle.com/en/cloud/saas/financials/24d/oefbf/` |
| REST API | `docs.oracle.com/en/cloud/saas/financials/24d/farfa/` |
