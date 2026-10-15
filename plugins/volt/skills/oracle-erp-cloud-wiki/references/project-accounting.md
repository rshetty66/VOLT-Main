# Oracle ERP Cloud — Project Accounting

Complete implementation reference for Oracle Cloud Project Financial Management.

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Oracle Project Financial Management Cloud (Project Costing, Project Billing, Project Performance) |
| **Purpose** | Project costing, billing, budgeting, revenue recognition, resource management |
| **Key Users** | Project managers, project accountants, billing specialists, PMO |
| **Typical Implementation** | 10-14 weeks |

---

## Project Lifecycle

```
CREATE → BUDGET → EXECUTE → COST → BILL → REVENUE → CLOSE
  │         │        │        │       │        │        │
Define    Approve  Timecards  Collect  Invoice  Recognize  Final
project   budget   expenses   costs   client   revenue    accounting
```

---

## Key Modules

| Module | Purpose |
|--------|---------|
| **Project Costing** | Collect and categorize project costs (labor, expenses, materials) |
| **Project Billing** | Generate invoices to customers based on contract terms |
| **Project Budgeting** | Establish and track project budgets with approvals |
| **Project Performance** | Compare actual vs budget/forecast; EVM metrics |
| **Grants Management** | Award tracking, compliance, reporting (public sector/academic) |

---

## Project Types

| Type | Revenue | Billing | Use Case |
|------|---------|---------|----------|
| **Time & Materials** | Actual cost + markup | Actual hours × rate | Consulting, professional services |
| **Fixed Price** | Over-time recognition (% complete) | Milestone-based | Construction, software delivery |
| **Cost Plus** | Cost + agreed fee/% | Cost passthrough + fee | Government, R&D |
| **Internal** | No revenue | No billing | Internal projects, CapEx |
| **Sponsored** | Grant/award funded | Grant draw-down | Research, public sector |

---

## Cost Collection

### Cost Sources

| Source | Mechanism | Examples |
|--------|-----------|---------|
| **Labor** | Timecards | Employee timecards charged to project/task |
| **Expenses** | Expense reports | Travel, materials, incidentals |
| **Supplier Costs** | AP invoices | Subcontractor invoices, materials purchases |
| **Material Issues** | Inventory transactions | Materials issued from inventory |
| **Burden/Overhead** | Calculated burden rates | Indirect cost allocation (overhead, fringe) |
| **Events** | Manual cost events | Adjustments, write-offs |

### Burden/Overhead Configuration

```
RAW COST (direct labor, direct expense)
    × BURDEN SCHEDULE (rates per cost category)
    = BURDENED COST

Example:
  Labor Rate: $100/hr (raw)
  + Fringe: 35% ($35)
  + Overhead: 25% ($25)
  + G&A: 10% ($10)
  = Burdened Rate: $170/hr
```

---

## Billing Configuration

### Contract Types

| Contract Element | Purpose |
|-----------------|---------|
| **Contract** | Master agreement with customer |
| **Contract Line** | Specific billing arrangement (project or set of projects) |
| **Bill Plan** | Rules for what to bill and when |
| **Revenue Plan** | Rules for revenue recognition timing |
| **Billing Cycle** | Frequency of invoice generation (monthly, milestone, etc.) |

### Billing Methods

| Method | When to Invoice | Rate Source |
|--------|----------------|-------------|
| **Time & Materials** | Periodic (monthly) based on actuals | Rate schedule (role × rate) |
| **Milestone** | Upon milestone completion | Fixed amount per milestone |
| **Percent Complete** | Based on % completion | % × contract value |
| **Events** | Upon specific event occurrence | Fixed per event |
| **Cost Plus** | Periodic based on cost incurred | Cost + fee (%, fixed, or cap) |

---

## Revenue Recognition

### ASC 606 / IFRS 15 in Projects

| Recognition Method | When | Calculation |
|-------------------|------|-------------|
| **As Incurred** | Point-in-time, with cost incurrence | Revenue = Burdened Cost × Revenue Rate |
| **Percent Complete (Cost)** | Over-time, input method | Revenue = % Cost Complete × Total Contract Price |
| **Percent Complete (Effort)** | Over-time, input method (hours) | Revenue = % Effort Complete × Total Contract Price |
| **Events/Milestones** | Point-in-time, upon event | Revenue = Milestone amount when achieved |
| **Completed Contract** | At completion only | Revenue = Contract value when project closed |

---

## Project Budgeting

### Budget Configuration

| Feature | Description |
|---------|-------------|
| **Budget Types** | Approved, Baseline, Forecast, Original, Current |
| **Budget Lines** | Resource class × task × period |
| **Approval Workflow** | Budget submission → PMO/Finance approval |
| **Budget Control** | Hard stop or warning when costs exceed budget |
| **Change Orders** | Amend budget with approval trail |
| **Forecast** | Rolling re-estimate (EAC: Estimate at Completion) |

### EVM (Earned Value Management)

| Metric | Formula | Meaning |
|--------|---------|---------|
| **PV** (Planned Value) | Budgeted cost of scheduled work | What should have been spent |
| **EV** (Earned Value) | Budgeted cost of completed work | Value of work done |
| **AC** (Actual Cost) | Actual cost of completed work | What was actually spent |
| **SV** (Schedule Variance) | EV - PV | Ahead/behind schedule |
| **CV** (Cost Variance) | EV - AC | Over/under budget |
| **SPI** (Schedule Performance Index) | EV / PV | >1 = ahead; <1 = behind |
| **CPI** (Cost Performance Index) | EV / AC | >1 = under budget; <1 = over |
| **EAC** (Estimate at Completion) | BAC / CPI | Projected final cost |

---

## Integration Points

| Integration | Direction | Data |
|-------------|-----------|------|
| GL ← Projects | Outbound | Cost and revenue journal entries (via SLA) |
| AP → Projects | Inbound | Supplier invoice costs charged to projects |
| AR ← Projects | Outbound | Project billing → AR invoices |
| Time & Labor → Projects | Inbound | Labor hours and costs |
| Expenses → Projects | Inbound | Employee expense charges |
| Procurement → Projects | Inbound | PO commitments against project budget |
| FA ← Projects | Outbound | Capitalized project costs → Fixed Assets |

---

## FBDI Templates for Projects

| Template | Purpose |
|----------|---------|
| `PjcProjectImportTemplate.xlsm` | Project master data import |
| `PjcTaskImportTemplate.xlsm` | Project tasks/WBS import |
| `PjcTransactionImportTemplate.xlsm` | Cost transactions (actuals) import |
| `PjcBudgetImportTemplate.xlsm` | Budget lines import |
| `PjcContractImportTemplate.xlsm` | Contract/billing setup import |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Costs not flowing to project | Expenditure type/org mismatch | Verify expenditure type classification |
| Revenue not generating | Revenue plan not assigned or milestone not achieved | Check bill/revenue plan configuration |
| Budget exceeded without warning | Budget control not enabled | Enable budgetary control on project type |
| Cross-charge not working | Transfer rule misconfigured | Review cross-charge override rules |
| Burdened cost wrong | Burden schedule rate incorrect | Update burden schedule; re-calculate |
| Project invoicing shows $0 | Bill plan not generating events | Check billing extension / generate billing events |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| Project Financial Management | `docs.oracle.com/en/cloud/saas/project-financial-management/24d/` |
| Project Costing | `docs.oracle.com/en/cloud/saas/project-financial-management/24d/fapfm/project-costing.html` |
| Project Billing | `docs.oracle.com/en/cloud/saas/project-financial-management/24d/fapfm/project-billing.html` |
| Grants Management | `docs.oracle.com/en/cloud/saas/project-financial-management/24d/fagrt/` |
| REST API | `docs.oracle.com/en/cloud/saas/project-financial-management/24d/fapra/` |
