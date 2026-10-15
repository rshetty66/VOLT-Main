# Oracle PCM — Profitability and Cost Management Cloud

Complete implementation reference for Oracle Profitability and Cost Management Cloud (PCM).

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Profitability and Cost Management Cloud |
| **Abbreviation** | PCM |
| **Purpose** | Cost allocation, profitability analysis, activity-based costing, transfer pricing |
| **Key Users** | Management accountants, cost accountants, FP&A, business line controllers |
| **Typical Implementation** | 10-16 weeks |
| **Replaces (On-Prem)** | Hyperion Profitability and Cost Management (HPCM) |

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Cost Allocation** | Multi-step allocation of shared costs to business units, products, customers |
| **Profitability Analysis** | Full P&L by product, customer, channel, or any dimension |
| **Activity-Based Costing (ABC)** | Allocate costs based on activities and cost drivers |
| **Transfer Pricing** | Internal pricing for services between entities |
| **What-If Modeling** | Test different allocation methodologies and driver assumptions |
| **Traceability** | Full drill-path from allocated cost back to source |
| **Genealogy** | Visual lineage showing how each dollar flowed through allocation steps |
| **Multi-Pass Allocation** | Sequential allocation passes (direct → shared → reciprocal) |
| **Regulatory Costing** | Support funds transfer pricing, cost-to-serve (financial services) |
| **Management Reporting** | Fully allocated P&L at any granularity for decision-making |

---

## PCM Application Types

| Type | Description | Best For |
|------|-------------|----------|
| **Management Ledger** | Full management P&L with allocations | Enterprises needing allocated profitability |
| **Detailed Profitability** | Transaction-level or high-granularity allocation | Banks (customer/product-level profitability) |
| **Simple Allocation** | Basic step-down allocation model | Mid-size companies with straightforward cost pools |

---

## Allocation Methodology

### Allocation Model Design (Step-Down)

```
PASS 1: DIRECT COSTS
  Source: GL expense lines directly attributable to a cost centre/product
  Method: Direct assignment (no allocation needed)
  Result: Costs land on owning business unit

PASS 2: CORPORATE OVERHEAD ALLOCATION
  Source: Corporate cost pools (CEO office, Legal, Board costs)
  Drivers: Revenue share, FTE count, or equal split
  Target: Divisions / Business Lines
  Result: Divisions absorb corporate overhead

PASS 3: SHARED SERVICES ALLOCATION
  Source: IT, HR, Finance, Facilities, Risk & Compliance
  Drivers: FTE (HR), workstations (IT), sqft (Facilities), transactions (Finance)
  Target: Business Lines / Departments
  Result: BUs absorb shared services costs

PASS 4: SUPPORT FUNCTION ALLOCATION
  Source: Business line support functions (BU marketing, BU ops)
  Drivers: Product revenue, customer count, transaction volume
  Target: Products / Customer segments
  Result: Product/customer-level fully loaded costs

PASS 5: PRODUCT/CUSTOMER PROFITABILITY
  Result: Revenue - Direct Costs - Allocated Costs = Contribution Margin
          at product, customer, or channel level
```

### Allocation Methods

| Method | Description | When to Use |
|--------|-------------|-------------|
| **Direct Assignment** | Cost belongs 100% to one recipient | Clearly owned costs (rent for a dedicated floor) |
| **Driver-Based** | Allocate by ratio of a measurable driver | Most shared costs (FTE ratio, revenue ratio) |
| **Even Split** | Divide equally among N recipients | When no driver is meaningful (board costs) |
| **Tiered/Step-Down** | Allocate in sequence; prior step's output feeds next | Complex shared services with dependencies |
| **Reciprocal** | Simultaneous allocation between interdependent pools | IT charges HR, HR charges IT (iterative solve) |
| **Activity-Based (ABC)** | Cost → Activity → Activity Driver → Cost Object | When process complexity justifies granularity |
| **Funds Transfer Pricing (FTP)** | Internal rate for funds between treasury and BUs | Banks and financial institutions |

### Driver Table Design

| Cost Pool | Driver | Source System | Update Frequency | Allocation Target |
|-----------|--------|---------------|-----------------|-------------------|
| IT Infrastructure | # Workstations | ITSM/CMDB | Quarterly | Business Lines |
| IT Applications | # Users per app | IAM/License mgmt | Quarterly | Business Lines |
| Facilities | Square footage | Facilities DB | Quarterly | Departments |
| HR Services | # FTEs | HCM | Monthly | Departments |
| Finance Operations | # Transactions | Core banking/ERP | Monthly | Products |
| Risk & Compliance | Revenue share | GL | Monthly | Business Lines |
| Marketing (central) | Revenue share | GL | Monthly | Business Lines |
| Contact Centre | # Calls / Interactions | CTI system | Monthly | Products |
| Treasury (FTP) | Average balances | Core banking | Monthly | Products |

---

## PCM Configuration

### Dimension Design for PCM

| Dimension | Purpose | Example Members |
|-----------|---------|-----------------|
| **Entity** | Cost pool/recipient organization | Shared_IT, Shared_HR, Retail_Banking, Commercial |
| **Account** | Cost categories and P&L lines | Salary, Benefits, Rent, Depreciation, Revenue |
| **Product** | Cost objects (products/services) | Mortgages, Credit Cards, Deposits, Wealth |
| **Customer** | Customer segments | Retail, HNW, SME, Commercial, Institutional |
| **Channel** | Distribution channels | Branch, Digital, Call Centre, Broker |
| **Activity** | ABC activities (if using) | Process_Loan, Onboard_Customer, Handle_Call |
| **Cost Driver** | Allocation drivers | FTE, SqFt, Transactions, Revenue, Balances |
| **Allocation Step** | Pass/step identifier | Direct, Corp_Alloc, SS_Alloc, Product_Alloc |
| **Scenario** | Actual vs modeled | Actual, Budget, What-If_A, What-If_B |

### Rule Definition

PCM allocation rules define **source → driver → target**:

```yaml
Rule: Allocate_IT_Infrastructure
  Description: Allocate central IT infra costs to business lines by workstation count
  Source:
    Entity: Shared_IT
    Account: All_IT_Infra (children)
    Step: Direct (input data)
  Driver:
    Type: Statistical
    Dimension: Cost_Driver
    Member: Workstation_Count
    Source: Driver table (loaded monthly)
  Target:
    Entity: [Retail_Banking, Commercial_Banking, Wealth_Mgmt, Insurance]
    Account: Allocated_IT_Infra
    Step: SS_Allocation
  Options:
    - Allocate zeros: No (skip entities with zero driver)
    - Rounding: Allocate residual to largest recipient
    - Traceability: Enabled (drill back to source)
```

### Rule Execution Order

Rules execute in a defined sequence. **Order matters** because later rules consume output of earlier ones:

| Sequence | Rule Group | Description |
|----------|-----------|-------------|
| 100 | Direct Costs | Assign directly owned costs (no allocation) |
| 200 | Corporate Overhead | Allocate CEO/Board/Legal to divisions |
| 300 | Shared Services - IT | Allocate IT by workstation/user count |
| 310 | Shared Services - HR | Allocate HR by FTE count |
| 320 | Shared Services - Facilities | Allocate Facilities by sqft |
| 330 | Shared Services - Finance | Allocate Finance by transaction count |
| 340 | Shared Services - Risk | Allocate Risk by revenue share |
| 400 | BU Support Functions | Allocate BU-level support to products |
| 500 | Product Allocation | Final product-level cost assignment |
| 600 | FTP (if banking) | Funds transfer pricing credit/charge |
| 900 | Profitability Calculation | Revenue - All Costs = Margin |

---

## Funds Transfer Pricing (FTP) — Financial Services

### FTP Concept

FTP assigns an **internal cost of funds** to lending products and a **credit for funds** to deposit products:

```
DEPOSIT PRODUCTS                    TREASURY                    LENDING PRODUCTS
┌─────────────────┐            ┌──────────────┐            ┌─────────────────┐
│ Savings Account │──funds──  │              │──funds──  │ Mortgage        │
│ GIC/Term Deposit│            │   Central    │            │ Credit Card     │
│ Demand Deposits │            │   Treasury   │            │ Commercial Loan │
│                 │            │              │            │                 │
│ CREDIT: FTP     │──rate──── │  Transfer    │────rate── │ CHARGE: FTP     │
│ rate × balance  │            │   Rate       │            │ rate × balance  │
└─────────────────┘            └──────────────┘            └─────────────────┘

FTP Credit (Deposits) = Avg Balance × FTP Rate (matched maturity)
FTP Charge (Loans) = Avg Balance × FTP Rate (matched maturity)
Net Interest Margin = Customer Rate - FTP Rate (lending)
                    = FTP Rate - Customer Rate (deposits)
```

### FTP Rate Methods

| Method | Description | Complexity |
|--------|-------------|------------|
| **Single Pool Rate** | One rate for all products | Low (simple but inaccurate) |
| **Matched Maturity** | Rate based on product maturity profile | High (industry standard for banks) |
| **Duration-Based** | Rate based on duration of cash flows | High (most accurate for optionality) |
| **Marginal Cost** | Rate = current cost of new wholesale funding | Medium |

---

## Traceability & Genealogy

### Drill-Path Analysis

PCM provides full **cost traceability** — from a final allocated cost, trace back through every step:

```
Final: Product "Mortgage" received $2.4M allocated IT cost

Step 4: Retail Banking allocated $2.4M to Mortgages (driver: loan volume 60%)

Step 3: Shared IT allocated $4.0M to Retail Banking (driver: 800 workstations / 2000 total = 40%)

Step 2: No corporate overhead in IT line

Step 1: GL loaded $10.0M to Shared_IT (Account: IT Infrastructure)
```

### Genealogy Reports

| Report | Purpose | Users |
|--------|---------|-------|
| **Source-to-Target** | Trace forward: where did this cost go? | Cost pool owners |
| **Target-to-Source** | Trace backward: where did this cost come from? | Product managers |
| **Driver Analysis** | What drove the allocation? | FP&A |
| **Step Summary** | Total allocated per step | Management accountants |
| **Unallocated Residual** | Costs that didn't get allocated (errors) | Data quality team |

---

## Integration with Other EPM Modules

| Integration | Direction | Purpose |
|-------------|-----------|---------|
| **GL / ERP → PCM** | Inbound | Actual costs to be allocated (via Data Management) |
| **FCCS → PCM** | Inbound | Consolidated cost data as allocation source |
| **PCM → EPBCS** | Outbound | Allocated costs feed into planning/forecasting |
| **PCM → Narrative Reporting** | Outbound | Profitability data for management reports |
| **PCM → BI (Power BI / OAC)** | Outbound | Allocated data for interactive dashboards |
| **EPBCS → PCM** | Inbound | Budgeted drivers for budget-based allocations |
| **EDM → PCM** | Inbound | Dimension changes (new products, entities) |

---

## Performance Optimization

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Slow allocation run (>30 min) | Too many allocation steps or members | Reduce granularity; batch similar rules |
| Large data volume | Customer-level allocation with millions of customers | Use Detailed Profitability app type (columnar storage) |
| What-if scenarios slow | Full re-run for each scenario | Use sandboxes; only re-run changed steps |
| Driver data stale | Monthly driver not updated | Automate driver loads; add data quality checks |
| Unallocated residual | Missing driver data for some recipients | Add default/catch-all allocation for unmapped entities |
| Results don't balance | Rounding across many recipients | Use "allocate residual to largest" option |

---

## Implementation Best Practices

| Area | Best Practice |
|------|---------------|
| **Methodology first** | Design the allocation model on paper before configuring PCM |
| **Start simple** | Begin with 3-4 steps; add complexity after validating results |
| **Driver accuracy** | Drivers determine accuracy; invest in reliable driver sourcing |
| **Validate each pass** | Source total must equal sum of targets per step (zero-balance check) |
| **Business sign-off** | Get BU agreement on allocation methodology before build |
| **Document rules** | Each rule documented: source, driver, target, business rationale |
| **What-if first** | Run what-if scenarios before committing to production method |
| **Regular driver review** | Quarterly review of driver relevance and accuracy |
| **Traceability always on** | Never disable traceability — key for user acceptance |
| **Communication** | Allocated costs are sensitive — communicate methodology to recipients |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Allocation results unexpected | Driver ratios incorrect or stale | Validate driver table; check period alignment |
| Costs not fully allocated | Some target entities missing driver values | Add driver values or include catch-all rule |
| Circular allocation error | Rule A allocates to pool that Rule B allocates back | Use reciprocal method or break the cycle with sequencing |
| Performance degradation | Model grown too complex | Review and consolidate rules; reduce dimension members |
| Users dispute allocated costs | Methodology not transparent | Share driver tables and genealogy reports with BUs |
| Reconciliation breaks | Allocated totals ≠ source totals | Check rounding rules; verify no data filtered out |
| Historical comparisons invalid | Methodology changed mid-year | Version the model; run prior periods on prior method |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| PCM Admin Guide | `docs.oracle.com/en/cloud/saas/profitability-cost-management-cloud/pcmag/` |
| Allocation Rules | `docs.oracle.com/en/cloud/saas/profitability-cost-management-cloud/pcmag/allocation_rules.html` |
| Management Ledger | `docs.oracle.com/en/cloud/saas/profitability-cost-management-cloud/pcmag/management_ledger.html` |
| Traceability | `docs.oracle.com/en/cloud/saas/profitability-cost-management-cloud/pcmag/traceability.html` |
| Detailed Profitability | `docs.oracle.com/en/cloud/saas/profitability-cost-management-cloud/pcmag/detailed_profitability.html` |
| REST API | `docs.oracle.com/en/cloud/saas/profitability-cost-management-cloud/pcmra/` |
