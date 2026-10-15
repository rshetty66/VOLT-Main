# Oracle ERP Cloud — Accounts Receivable (AR)

Complete implementation reference for Oracle Cloud Receivables.

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Oracle Receivables Cloud |
| **Purpose** | Customer invoicing, revenue recognition, collections, cash application |
| **Key Users** | AR clerks, billing team, collections team, revenue accountants |
| **Typical Implementation** | 8-12 weeks (as part of Financials) |

---

## AR Process Flows

### Order-to-Cash (O2C) Lifecycle

```
SALES ORDER → FULFILLMENT → INVOICE → REVENUE RECOGNITION → RECEIPT → RECONCILIATION
     │              │            │              │                │           │
  Sales Team    Warehouse    Billing       Accounting       AR/Treasury   Controller
```

### Invoice Types

| Type | Description | Source |
|------|-------------|--------|
| **Standard Invoice** | Regular customer billing | Manual, Order Management, Projects |
| **Credit Memo** | Reduces customer balance | Manual or from return |
| **Debit Memo** | Increases customer balance (penalties, fees) | Manual |
| **Deposit** | Advance payment receipt | Manual |
| **Chargeback** | Disputed amount charged back | Collections |
| **On-Account** | Payment received without invoice reference | Cash application |

---

## Key Configuration

### Transaction Sources

| Source | Description | Auto-Numbering |
|--------|-------------|---------------|
| Manual | Entered directly in AR | Optional sequence |
| Order Management | From shipped sales orders | From order # |
| Projects | From project billing events | From project billing |
| Subscriptions | From subscription management | Subscription # |
| FBDI Import | Batch interface | User-defined or sequence |

### Payment Terms

Same payment terms framework shared with AP — configurable per customer/transaction type.

### Revenue Recognition (ASC 606 / IFRS 15)

Oracle Revenue Management Cloud handles the 5-step model:

| Step | Oracle Feature |
|------|----------------|
| 1. Identify the contract | Customer contracts and POs |
| 2. Identify performance obligations | Revenue lines on transactions |
| 3. Determine transaction price | Pricing (variable consideration, discounts) |
| 4. Allocate to performance obligations | Allocation engine (standalone selling price) |
| 5. Recognize when satisfied | Event-based recognition (point-in-time or over-time) |

---

## Collections Management

### Collections Framework

| Feature | Description |
|---------|-------------|
| **Aging Buckets** | Configure aging periods (Current, 1-30, 31-60, 61-90, 90+) |
| **Collectors** | Assign accounts to collection agents (by territory, risk, balance) |
| **Collection Strategies** | Automated dunning sequences (letter 1, 2, 3 + call + escalate) |
| **Scoring** | Customer risk scoring (payment history, balance, industry) |
| **Promises to Pay** | Track customer commitment to pay by date |
| **Disputes** | Track disputed amounts separately from collectible |
| **Write-off** | Policy-driven write-off with approval workflow |

### Dunning Configuration

```
Day 1 past due:  Email reminder (automated)
Day 15 past due: Formal dunning letter #1 (automated)
Day 30 past due: Dunning letter #2 + phone call task (collector action)
Day 60 past due: Escalate to collections manager + credit hold
Day 90 past due: Final demand + legal review
Day 120+ past due: Write-off assessment or external agency
```

---

## Cash Application (Receipts)

### Receipt Methods

| Method | Description | Automation |
|--------|-------------|-----------|
| **Manual** | Clerk applies receipt to invoice | Full manual |
| **AutoMatch** | System matches by invoice #, amount, customer | High automation |
| **Lockbox** | Bank file with remittance data | Bank file → auto-apply |
| **AutoCash** | Rule-based application from bank feed | Configurable rules |
| **On-Account** | Receipt without known invoice | Applied later |

### Lockbox Processing

```
Bank Statement (BAI2/CAMT.053)
    → Lockbox file received
        → Transmission imported
            → Receipts auto-created
                → AutoMatch applied to invoices
                    → Unapplied exceptions → manual queue
```

---

## Customer Management

### Customer Setup Components

| Component | Purpose | Key Fields |
|-----------|---------|-----------|
| **Party** | Person or Organization | Name, taxpayer ID, category |
| **Customer Account** | Billing relationship | Account #, profile class, payment terms |
| **Account Site** | Address/location | Bill-to, Ship-to, statement delivery |
| **Site Use** | Purpose of site | Bill-To Use, Ship-To Use, Paying Use |
| **Profile Class** | Collection/credit policy | Credit limit, payment terms, dunning |
| **Contact** | Person at customer | Name, role, email for dunning |

---

## Revenue Accounting

### Subledger Accounting for AR

| Event | Debit | Credit |
|-------|-------|--------|
| Invoice created | AR Receivable | Revenue (or Deferred Revenue) |
| Revenue recognized | Deferred Revenue | Revenue |
| Receipt applied | Cash/Bank | AR Receivable |
| Credit memo | Revenue / COGS Adjustment | AR Receivable |
| Write-off | Bad Debt Expense | AR Receivable |
| Adjustment | AR Receivable | Adjustment Revenue |

---

## FBDI Templates for AR

| Template | Purpose |
|----------|---------|
| `RaInterfaceLinesAllTemplate.xlsm` | AR transaction import (invoices, credit memos) |
| `ArCustomerImportTemplate.xlsm` | Customer master import |
| `ArReceiptImportTemplate.xlsm` | Receipt/payment import |
| `ArAdjustmentImportTemplate.xlsm` | Adjustment import |

---

## Key Reports

| Report | Purpose | Tool |
|--------|---------|------|
| Aging Report | Outstanding balances by aging bucket | OTBI / BI Publisher |
| Customer Statement | Balance summary sent to customer | BI Publisher |
| Revenue Recognition Schedule | Recognition events over time | OTBI |
| Collections Effectiveness Index | Collection performance metrics | OTBI |
| Cash Application Report | Receipt application summary | OTBI |
| DSO (Days Sales Outstanding) | Average collection period | OTBI calculated |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Invoice won't complete | Distribution account invalid or incomplete | Fix revenue account on transaction type |
| Receipt not applying (AutoMatch) | Invoice # format mismatch | Check matching rules; normalize reference |
| Revenue not recognized | Revenue contingency or recognition rule | Check revenue management configuration |
| Aging report shows negative | Credit memos not applied to invoices | Apply credits to specific invoices |
| Lockbox transmission errors | File format mismatch | Validate bank file format against template |
| Duplicate customer | Same customer created twice | Merge records; fix source data process |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| AR Implementation Guide | `docs.oracle.com/en/cloud/saas/financials/24d/faarx/` |
| Revenue Management | `docs.oracle.com/en/cloud/saas/financials/24d/farev/` |
| Collections | `docs.oracle.com/en/cloud/saas/financials/24d/facol/` |
| Customer Setup | `docs.oracle.com/en/cloud/saas/financials/24d/faarx/customers.html` |
| Cash Management | `docs.oracle.com/en/cloud/saas/financials/24d/facsh/` |
| FBDI Templates | `docs.oracle.com/en/cloud/saas/financials/24d/oefbf/` |
