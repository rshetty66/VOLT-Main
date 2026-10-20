# Oracle ERP Cloud — Cash Management

Implementation reference for Oracle Cash Management Cloud.

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Oracle Cash Management Cloud |
| **Purpose** | Bank account management, bank statement reconciliation, cash positioning, cash forecasting |
| **Key Users** | Treasury, cash management, bank reconciliation team |

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Bank Account Management** | Configure bank accounts, signatories, access controls |
| **Bank Statement Processing** | Import and auto-reconcile bank statements (BAI2, SWIFT MT940, CAMT.053) |
| **Cash Positioning** | Real-time cash visibility across all bank accounts |
| **Cash Forecasting** | Project future cash flows from AR/AP/Payroll/Treasury |
| **Bank Transfers** | Internal transfers between accounts (manual or automated) |
| **Reconciliation** | Match system transactions to bank statement lines |

---

## Bank Statement Import

### Supported Formats

| Format | Standard | Region |
|--------|----------|--------|
| **BAI2** | Bank Administration Institute v2 | North America (primary) |
| **MT940** | SWIFT standard | International |
| **CAMT.053** | ISO 20022 | Europe / modern banks globally |
| **Custom (CSV/XML)** | Bank-specific | Map via transformation rule |

### Auto-Reconciliation Rules

| Rule Type | Matching Logic | Confidence |
|-----------|---------------|------------|
| **One-to-One** | Exact amount + reference # match | High |
| **One-to-Many** | Bank line = sum of system transactions | Medium |
| **Many-to-One** | Multiple bank lines = one system transaction | Medium |
| **Tolerance** | Amount within ±$X and date within ±N days | Configurable |
| **Manual** | Clerk manually matches unreconciled items | Last resort |

---

## Cash Positioning & Forecasting

### Cash Position Report

Real-time view: Opening Balance + Receipts - Payments = Closing Position per bank account.

### Cash Forecast Sources

| Source | Data | Timing |
|--------|------|--------|
| AR (Receivables) | Expected collections by due date | Based on payment terms |
| AP (Payables) | Scheduled payments by due date | Based on payment schedule |
| Payroll | Payroll runs by pay date | Payroll calendar |
| Treasury | Debt maturities, investment returns | Treasury calendar |
| Manual | Ad-hoc entries (tax, dividends, CapEx) | User-entered |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| Cash Management Guide | `docs.oracle.com/en/cloud/saas/financials/24d/facsh/` |
| Bank Reconciliation | `docs.oracle.com/en/cloud/saas/financials/24d/facsh/bank-reconciliation.html` |
| Cash Positioning | `docs.oracle.com/en/cloud/saas/financials/24d/facsh/cash-positioning.html` |
