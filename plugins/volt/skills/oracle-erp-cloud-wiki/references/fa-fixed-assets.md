# Oracle ERP Cloud — Fixed Assets (FA)

Complete implementation reference for Oracle Cloud Fixed Assets.

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Oracle Assets Cloud |
| **Purpose** | Asset lifecycle management, depreciation, capitalization, retirement, revaluation |
| **Key Users** | Fixed asset accountants, property managers, tax accountants |
| **Typical Implementation** | 6-10 weeks (as part of Financials) |

---

## Asset Lifecycle

```
ACQUISITION → CAPITALIZATION → DEPRECIATION → MAINTENANCE → RETIREMENT/DISPOSAL
     │              │                │              │               │
  Purchase/     Set up asset     Monthly calc    Adjustments    Sale/Write-off
  CIP/Transfer  assign book     post to GL      transfers       gain/loss calc
```

---

## Key Concepts

### Asset Books

| Book Type | Purpose | Tax Treatment |
|-----------|---------|--------------|
| **Corporate** | Financial reporting (IFRS/GAAP) | Accounting depreciation |
| **Tax** | Tax return reporting (CCA/MACRS) | Tax depreciation (CCA classes, MACRS rates) |
| **Budget** | Planning/budgeting | Projected depreciation |
| **Reporting** | Additional GAAP view | Secondary accounting method |

### Depreciation Methods

| Method | Description | Use Case |
|--------|-------------|----------|
| **Straight-Line** | Equal amount each period | Most assets (IFRS) |
| **Declining Balance** | % of net book value | Canadian CCA, accelerated |
| **Units of Production** | Based on usage/output | Manufacturing equipment |
| **Sum of Years Digits** | Accelerated straight-line | US tax (rare now) |
| **MACRS** | US IRS schedules | US tax depreciation |
| **CCA (Capital Cost Allowance)** | Canadian tax depreciation | Canadian tax books |

### Canadian CCA Classes (Common)

| CCA Class | Rate | Assets |
|-----------|------|--------|
| Class 1 | 4% | Buildings |
| Class 8 | 20% | Furniture, equipment |
| Class 10 | 30% | Vehicles, computer hardware |
| Class 12 | 100% | Software, small tools <$500 |
| Class 13 | Lease term | Leasehold improvements |
| Class 43 | 30% | Clean energy equipment |
| Class 50 | 55% | Computer equipment (post-2011) |
| Class 53 | 50% | Manufacturing equipment |
| Class 54 | 30%/50% | Zero-emission vehicles |

---

## Configuration

### Category Setup

| Category | Book Defaults | Account Defaults |
|----------|--------------|-----------------|
| Buildings | SL/40yr | 1500-BLDG |
| Furniture & Equipment | SL/7yr | 1510-EQUIP |
| Vehicles | SL/5yr or DB | 1520-VEHICLE |
| Computer Hardware | SL/3yr | 1530-HARDWARE |
| Software | SL/3yr or 100% | 1540-SOFTWARE |
| Leasehold Improvements | SL/lease term | 1550-LEASEHOLD |
| Land | No depreciation | 1560-LAND |
| CIP (Construction in Progress) | No depreciation | 1570-CIP |

### Account Assignments

| Account Type | Purpose | Example |
|-------------|---------|---------|
| Asset Cost | Capitalized cost on balance sheet | 1500 Fixed Assets |
| Accumulated Depreciation | Contra-asset (running total) | 1501 Accum Depreciation |
| Depreciation Expense | Period depreciation charge | 6100 Depreciation Expense |
| CIP Account | Costs accumulated pre-capitalization | 1570 CIP |
| Gain/Loss on Disposal | Retirement proceeds vs NBV | 7200 Gain/Loss Disposal |
| Revaluation Reserve | IFRS revaluation surplus | 3300 Revaluation Reserve |

---

## Key Processes

### Mass Additions (from AP/Projects)

When AP invoices or Project costs are capitalized, they flow to FA as Mass Additions:

```
AP Invoice (asset category on line) → Validated → Create Accounting
    → Mass Addition created in FA (status: NEW)
        → Review and assign details (life, method, location)
            → Post Mass Additions → Asset created
```

### CIP (Construction in Progress) to Capitalization

```
Costs accumulated in CIP account (via AP, Projects, Manual)
    → CIP Asset in FA tracks costs
        → Construction complete (business event)
            → Capitalize CIP → Convert to depreciable asset
                → Depreciation begins from in-service date
```

### Retirement/Disposal

| Retirement Type | Trigger | Accounting |
|----------------|---------|-----------|
| **Sale** | Asset sold | Proceeds - NBV = Gain/Loss |
| **Write-off** | Asset scrapped (no proceeds) | NBV → Loss on disposal |
| **Transfer** | Move to another entity | Remove from source, add to target |
| **Partial Retirement** | Retire portion of asset | Cost split proportionally |

---

## IFRS Considerations

| IFRS Standard | FA Impact | Configuration |
|---------------|-----------|---------------|
| **IAS 16** | Property, plant, equipment — cost or revaluation model | Revaluation book setup |
| **IAS 36** | Impairment testing | Manual impairment adjustment |
| **IAS 38** | Intangible assets (software, patents) | Separate category with finite/indefinite life |
| **IFRS 16** | Lease assets (Right-of-Use) | Separate book or integration with lease module |
| **IAS 40** | Investment property | Separate category, fair value model option |

---

## FBDI Templates for FA

| Template | Purpose |
|----------|---------|
| `FaAssetAdditionsTemplate.xlsm` | Add new assets (historical migration) |
| `FaMassAdditionsTemplate.xlsm` | Mass additions from external sources |
| `FaAssetRetirementTemplate.xlsm` | Retire assets in bulk |
| `FaAssetTransferTemplate.xlsm` | Transfer assets between locations/entities |
| `FaAssetAdjustmentTemplate.xlsm` | Adjust cost, life, depreciation method |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Depreciation not calculating | Asset not in "Active" status or prorate date issue | Check asset status and prorate convention |
| Mass Addition stuck in NEW | Missing required fields | Complete assignment (book, category, life) |
| CIP not capitalizable | No in-service date set | Set in-service date to trigger capitalization |
| Gain/Loss wrong on retirement | Proceeds or cost basis incorrect | Verify NBV and proceeds before retiring |
| Tax book out of sync | Tax rules changed mid-year | Adjust tax rates; re-run tax depreciation |
| Prior period adjustment needed | Error in closed period | Use "Unplanned Depreciation" or adjustment |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| Assets Implementation Guide | `docs.oracle.com/en/cloud/saas/financials/24d/faasr/` |
| Depreciation Methods | `docs.oracle.com/en/cloud/saas/financials/24d/faasr/depreciation.html` |
| Mass Additions | `docs.oracle.com/en/cloud/saas/financials/24d/faasr/mass-additions.html` |
| Retirements | `docs.oracle.com/en/cloud/saas/financials/24d/faasr/retirements.html` |
| FBDI Templates | `docs.oracle.com/en/cloud/saas/financials/24d/oefbf/` |
