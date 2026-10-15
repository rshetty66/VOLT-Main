# PeopleSoft FSCM — Financial Supply Chain Management

Implementation reference for PeopleSoft Financials (GL, AP, AR, AM, Billing, Expenses).

---

## Module Map

| Module | Purpose | Key Tables |
|--------|---------|-----------|
| **General Ledger** | Journal processing, chartfield management, allocations, consolidation | JRNL_HEADER, JRNL_LN, LEDGER |
| **Accounts Payable** | Voucher processing, payments, 1099/T4A | VOUCHER, PYMNT_HDR, VENDOR |
| **Accounts Receivable** | Invoicing, cash application, collections, aging | ITEM, DEPOSIT_CONTROL, CUSTOMER |
| **Asset Management** | Fixed asset lifecycle, depreciation, retirement | ASSET, BOOK, DEPR_SUMM |
| **Billing** | Customer billing, rate-based, milestone | BI_HDR, BI_LINE |
| **Expenses** | Employee expense reports, approvals, credit cards | EX_SHEET_HDR, EX_SHEET_LINE |
| **Treasury** | Cash management, bank reconciliation, deals | BANK_ACCT_VW, DEAL |
| **Commitment Control** | Budget checking, encumbrances | KK_BUDGET_HDR, KK_ACTIVITY_LOG |

---

## General Ledger

### ChartField Structure

PeopleSoft uses **ChartFields** (equivalent to Oracle's segments):

| ChartField | Purpose | Example |
|------------|---------|---------|
| Business Unit | Operating entity | CAN01, US001 |
| Account | Natural account | 101000 Cash |
| Department | Cost center | 10100 Finance |
| Fund | Funding source (public sector) | GEN, GRANT |
| Program | Program/initiative | OPEX, CAPEX |
| Project | Project tracking | PRJ-001 |
| Class | Secondary classification | Varies |
| Affiliate | Intercompany partner | CAN02 |

### Journal Processing

```
Journal Entry → Edit (ChartField validation) → Budget Check (if CC enabled) → Approval → Post
```

| Journal Source | Creation Method |
|---------------|----------------|
| Online | Manual entry via journal page |
| Spreadsheet | Excel upload via Journal Import |
| Allocations | Allocation process generates journals |
| Subsystems | AP, AR, AM create journals via accounting entries |
| Interface | External feed via JRNL_HEADER/JRNL_LN interface |

### nVision Reporting

nVision is PeopleSoft's **Excel-based GL reporting** tool:
- Layouts define row/column structure with PS Query or TreeNode references
- Scopes filter by Business Unit, ledger, fiscal year
- Reports run in Excel with live data retrieval from LEDGER table
- Supports drill-down to journal detail

---

## Accounts Payable

### Voucher Processing Flow

```
VOUCHER ENTRY → MATCHING → BUDGET CHECK → APPROVAL → ACCOUNTING → PAYMENT
     │              │           │             │           │           │
  Enter/Import  Match to PO  KK Check    Workflow    Create JE    Pay Cycle
```

### Payment Methods (Canadian)

| Method | Format | Use Case |
|--------|--------|----------|
| EFT (CPA 005) | Canadian Payments Association | Domestic electronic |
| Cheque | Print + mail | Legacy vendors |
| Wire (SWIFT) | International transfer | Foreign suppliers |
| Prenote | Zero-dollar test | New bank account validation |

### Key Tables

| Table | Purpose |
|-------|---------|
| VOUCHER | Voucher header |
| VCHR_ACCTG_LINE | Voucher accounting lines |
| PYMNT_HDR | Payment header |
| PYMNT_ACCTG_LINE | Payment accounting |
| VENDOR | Supplier master |
| VNDR_ADDR_SCROL | Supplier addresses |
| VNDR_BANK_ACCT | Supplier bank accounts |

---

## Accounts Receivable

### Item Processing

| Item Type | Description |
|-----------|-------------|
| Line Item | Standard AR invoice |
| Debit Memo | Additional charge |
| Credit Memo | Credit/adjustment |
| Prepayment | Advance payment |
| Write-off | Uncollectible debt |
| On-Account | Unapplied payment |

### Cash Application

```
DEPOSIT → PAYMENT → MATCH TO ITEM → APPLY → POST
   │         │          │               │       │
 Bank     Amount     Auto/Manual    Reduce     GL Journal
 Entry    received   matching       balance    DR Cash CR AR
```

---

## Asset Management

### Depreciation Methods (PeopleSoft)

| Method | Description |
|--------|-------------|
| STR_LN | Straight-line |
| DECL_BAL | Declining balance |
| SUM_YRS | Sum of years digits |
| UNITS | Units of production |
| CCA | Canadian Capital Cost Allowance |
| MACRS | US Modified Accelerated Cost Recovery |

### Asset Lifecycle

```
ADDITION → IN-SERVICE → DEPRECIATE → TRANSFER/ADJUST → RETIRE
    │          │            │              │               │
  Create    Start date   Monthly run    Move/revalue    Dispose/sell
```

---

## Commitment Control (Budget Checking)

PeopleSoft's **Commitment Control (KK)** module provides:
- Pre-encumbrance (requisition stage)
- Encumbrance (PO stage)
- Expenditure (voucher/expense stage)
- Budget checking at transaction entry
- Override capability with authorization

---

## Common PeopleSoft FSCM Issues

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Journal won't edit | ChartField combo invalid | Check combo edit rules; fix chartfield |
| Voucher won't post | Budget check failure | Check KK budget availability |
| Payment cycle no output | Payment criteria too restrictive | Broaden selection criteria |
| nVision report zeros | Scope/layout mismatch | Verify tree nodes align with data |
| Asset depreciation wrong | Book/profile setup incorrect | Check depreciation convention, life |
| AR item won't close | Partial payment remaining | Apply or write off remainder |
