# Illustrative Enterprise Financial Information Model (Proseware Finance)

> Full end-to-end data architecture from source systems through cost allocation, planning, and reporting consumption in OneStream XF.
>
> **Illustrative only.** Proseware Finance is a fictional mid-market lender. The hierarchy, cost-centre codes, account codes and allocation rules below are worked examples to adapt to the organization's own structures, not a real organization's model.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          ENTERPRISE FINANCIAL INFORMATION MODEL                       │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐   ┌─────────────────────┐   │
│  │   SOURCE    │──│   STAGING   │──│     CORE     │──│    CONSUMPTION      │   │
│  │   LAYER     │   │   LAYER     │   │    LAYER     │   │    LAYER            │   │
│  │             │   │             │   │              │   │                     │   │
│  │ • Core Bank │   │ • Cleansed  │   │ • Facts      │   │ • OneStream Cubes   │   │
│  │ • GL/ERP    │   │ • Standard  │   │ • Dimensions │   │ • MBR Dashboards    │   │
│  │ • HR        │   │ • Validated │   │ • Bridges    │   │ • Ad-hoc Reporting  │   │
│  │ • Facilities│   │ • Profiled  │   │              │   │ • Regulatory        │   │
│  │ • Treasury  │   │             │   │              │   │                     │   │
│  └─────────────┘   └─────────────┘   └──────────────┘   └─────────────────────┘   │
│                                              │                                       │
│                                                                                     │
│                                     ┌──────────────┐                                │
│                                     │  ALLOCATION  │                                │
│                                     │    LAYER     │                                │
│                                     │              │                                │
│                                     │ • Drivers    │                                │
│                                     │ • Rules      │                                │
│                                     │ • Results    │                                │
│                                     └──────────────┘                                │
│                                              │                                       │
│                                                                                     │
│                                     ┌──────────────┐                                │
│                                     │  PLANNING    │                                │
│                                     │    LAYER     │                                │
│                                     │              │                                │
│                                     │ • Budget     │                                │
│                                     │ • Forecast   │                                │
│                                     │ • Scenarios  │                                │
│                                     └──────────────┘                                │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. SOURCE LAYER — Operational Systems

### 1.1 ERP / General Ledger (illustrated with Workday Financials)

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **GL_Journal_Entry** | Individual journal postings | journal_id, posting_date, period, entity_code, account_code, debit_amt, credit_amt, currency, source_module, description, created_by |
| **GL_Balance** | Period-end trial balance | entity_code, account_code, period, scenario, opening_balance, period_activity, closing_balance, currency |
| **GL_Account** | Chart of accounts master | account_code, account_name, account_type (A/L/E/R/X), level_1..level_5, posting_allowed, status |
| **GL_Entity** | Legal entity / cost centre | entity_code, entity_name, entity_type (legal/mgmt/cost_centre), parent_code, division, region, status |
| **GL_Intercompany** | IC transaction pairs | ic_id, from_entity, to_entity, account, amount, currency, period, match_status |

### 1.2 Human Resources System

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **HR_Employee** | Active employee roster | employee_id, name, hire_date, term_date, status, job_code, grade, entity_code, manager_id |
| **HR_Position** | Position inventory | position_id, title, job_family, grade_band, entity_code, status, incumbent_id |
| **HR_Compensation** | Pay and benefits | employee_id, base_salary, bonus_target_pct, benefits_cost, total_comp, effective_date, currency |
| **HR_Headcount_Snapshot** | Monthly FTE snapshot | snapshot_date, entity_code, job_family, fte_count, avg_compensation, total_cost |
| **HR_Attrition** | Turnover events | employee_id, term_date, term_reason, entity_code, replacement_status |

### 1.3 Facilities & Real Estate

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **FAC_Location** | Physical locations | location_id, address, city, region, type (branch/office/data_centre), sqft, lease_expiry |
| **FAC_Space_Assignment** | Space allocated to entities | location_id, entity_code, assigned_sqft, floor, zone, effective_date |
| **FAC_Lease** | Lease obligations | lease_id, location_id, monthly_cost, start_date, end_date, escalation_pct, landlord |
| **FAC_Operating_Cost** | Building OpEx | location_id, period, cost_type (utilities/maintenance/security/tax), amount |

### 1.4 Treasury & Market Data

| Entity | Description | Key Attributes | Frequency |
|--------|-------------|----------------|-----------|
| **TRE_Interest_Rate** | Rate curves | rate_date, rate_type (overnight/prime/5yr_govt/term_deposit), rate_value, source | Daily |
| **TRE_FX_Rate** | Exchange rates | rate_date, from_currency, to_currency, spot_rate, fwd_rate_1m/3m/6m/12m | Daily |
| **TRE_Funding_Position** | Liquidity snapshot | as_of_date, instrument_type, notional, rate, maturity_date, entity_code | Daily |
| **TRE_Loan_Portfolio** | Lending book summary | as_of_date, product_type, entity_code, gross_balance, avg_rate, stage_1/2/3_balance | Monthly |
| **TRE_Deposit_Portfolio** | Deposit book summary | as_of_date, product_type, entity_code, balance, avg_rate, term_bucket | Monthly |

### 1.5 Expense Management (Legacy spreadsheet)

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **EXP_Transaction** | Individual expense items | expense_id, posting_date, vendor, cost_centre, gl_account, amount, tax, description, approver |
| **EXP_Budget_Line** | Annual budget by line | budget_year, cost_centre, gl_account, jan..dec, annual_total, status |
| **EXP_Vendor** | Vendor master | vendor_id, vendor_name, category, contract_value, payment_terms |

---

## 2. STAGING LAYER — Cleansed & Standardized

### 2.1 Design Principles

- **Naming:** `stg_{source}_{entity}` (e.g., `stg_gl_journal_entry`)
- **Deduplication:** Unique constraint on natural keys
- **Type standardization:** All amounts as DECIMAL(18,2), dates as DATE, codes as VARCHAR(50)
- **Null handling:** Required fields NOT NULL, optional fields nullable with defaults
- **Audit columns:** `_loaded_at`, `_source_file`, `_batch_id` on every table
- **Soft deletes:** `_is_deleted` flag, never physical delete

### 2.2 Staging Tables

| Table | Source | Grain | Refresh | Key Transformations |
|-------|--------|-------|---------|-------------------|
| `stg_gl_journal` | ERP | 1 row per journal line | Daily | Currency conversion to reporting currency, COA mapping |
| `stg_gl_balance` | ERP | Entity × Account × Period | Monthly | Validate debits = credits |
| `stg_hr_headcount` | HR System | Entity × Job Family × Month | Monthly | FTE calculation, annualize comp |
| `stg_hr_compensation` | HR System | Employee × Effective Date | Monthly | Total comp = base + bonus + benefits |
| `stg_fac_space` | Facilities | Entity × Location | Quarterly | Sqft aggregation by entity |
| `stg_fac_cost` | Facilities | Location × Cost Type × Period | Monthly | Normalize to monthly periods |
| `stg_tre_rates` | Treasury | Rate Type × Date | Daily | Average/spot selection |
| `stg_tre_portfolio` | Treasury | Product × Entity × Date | Monthly | Balance aggregation |
| `stg_exp_transaction` | Expense spreadsheet | Individual expense | Monthly | Tax extraction, GL mapping |
| `stg_exp_budget` | Expense spreadsheet | Cost Centre × Account × Month | Annual | Spread annual to monthly |

---

## 3. CORE LAYER — Dimensional Model

### 3.1 Entity-Relationship Diagram

```
                    ┌──────────────────┐
                    │   dim_time       │
                    │                  │
                    │ time_key (PK)    │
                    │ calendar_date    │
                    │ fiscal_year      │
                    │ fiscal_quarter   │
                    │ fiscal_month     │
                    │ month_name       │
                    │ is_closed        │
                    └────────┬─────────┘
                             │
    ┌───────────────┐        │        ┌──────────────────┐
    │ dim_entity    │        │        │  dim_account     │
    │               │        │        │                  │
    │ entity_key(PK)│        │        │ account_key (PK) │
    │ entity_code   │        │        │ account_code     │
    │ entity_name   │        │        │ account_name     │
    │ entity_type   │        │        │ account_type     │
    │ division      │        │        │ level_1_name     │
    │ department    │        │        │ level_2_name     │
    │ cost_centre   │        │        │ level_3_name     │
    │ parent_key    │        │        │ level_4_name     │
    │ hierarchy_lvl │        │        │ is_posting       │
    │ is_allocable  │        │        │ sign_convention  │
    └───────┬───────┘        │        └────────┬─────────┘
            │                │                 │
            │    ┌───────────┴─────────────┐   │
            │    │                          │   │

    ┌─────────────────────────────────────────────────────┐
    │                   FACT TABLES                         │
    │                                                      │
    │  ┌─────────────────┐  ┌──────────────────────────┐  │
    │  │ fact_gl_balance  │  │ fact_allocation_result   │  │
    │  │                  │  │                          │  │
    │  │ entity_key (FK)  │  │ source_entity_key (FK)   │  │
    │  │ account_key (FK) │  │ target_entity_key (FK)   │  │
    │  │ time_key (FK)    │  │ account_key (FK)         │  │
    │  │ scenario_key(FK) │  │ time_key (FK)            │  │
    │  │ amount           │  │ driver_key (FK)          │  │
    │  │ currency         │  │ allocated_amount         │  │
    │  └─────────────────┘  │ allocation_pass          │  │
    │                        │ driver_ratio             │  │
    │  ┌─────────────────┐  └──────────────────────────┘  │
    │  │ fact_plan        │                                │
    │  │                  │  ┌──────────────────────────┐  │
    │  │ entity_key (FK)  │  │ fact_headcount           │  │
    │  │ account_key (FK) │  │                          │  │
    │  │ time_key (FK)    │  │ entity_key (FK)          │  │
    │  │ scenario_key(FK) │  │ time_key (FK)            │  │
    │  │ version_key (FK) │  │ job_family_key (FK)      │  │
    │  │ amount           │  │ fte_count                │  │
    │  │ driver_key (FK)  │  │ avg_compensation         │  │
    │  │ assumption_ref   │  │ total_cost               │  │
    │  └─────────────────┘  │ vacancy_count            │  │
    │                        └──────────────────────────┘  │
    └─────────────────────────────────────────────────────┘

            │                          │
    ┌───────┴───────┐          ┌───────┴───────┐
    │ dim_scenario  │          │ dim_driver    │
    │               │          │               │
    │ scenario_key  │          │ driver_key    │
    │ scenario_name │          │ driver_code   │
    │ scenario_type │          │ driver_name   │
    │ is_locked     │          │ driver_type   │
    │ owner         │          │ unit_of_meas  │
    │ approved_date │          │ source_system │
    └───────────────┘          └───────────────┘
```

### 3.2 Dimension Tables — Detailed

#### dim_entity

| Column | Type | Description |
|--------|------|-------------|
| entity_key | INT (PK, surrogate) | Surrogate key |
| entity_code | VARCHAR(20) | Business key (e.g., "CC-A110") |
| entity_name | VARCHAR(100) | Display name |
| entity_type | VARCHAR(20) | "legal_entity", "division", "department", "cost_centre" |
| division | VARCHAR(50) | L1: business line |
| department | VARCHAR(50) | L2: within division |
| cost_centre | VARCHAR(50) | L3: operational unit |
| parent_entity_key | INT (FK self) | Hierarchy parent |
| hierarchy_level | INT | 0=top, 1=division, 2=dept, 3=cost_centre |
| is_allocable | BIT | Can receive allocated costs (1=yes) |
| is_shared_service | BIT | Provides shared services to be allocated out |
| consolidation_method | VARCHAR(20) | "full", "proportional", "equity" |
| ownership_pct | DECIMAL(5,2) | Ownership percentage |
| currency | VARCHAR(3) | Functional currency |
| effective_from | DATE | SCD Type 2 |
| effective_to | DATE | SCD Type 2 |
| is_current | BIT | Current version flag |

**Hierarchy Example (illustrative):**
```
Proseware Finance (Corporate)                 Level 0
├── Business Line A — Lending                 Level 1
│   ├── Lending Operations                    Level 2
│   │   ├── CC-A110 Region 1                  Level 3
│   │   └── CC-A120 Region 2                  Level 3
│   └── Lending Products                      Level 2
│       ├── CC-A210 Product Group 1           Level 3
│       └── CC-A220 Product Group 2           Level 3
├── Business Line B — Deposits & Payments     Level 1
│   ├── CC-B110 Deposit Products              Level 2
│   └── CC-B120 Payments                      Level 2
├── Shared Services (Allocation Source)       Level 1
│   ├── CC-S010 Information Technology        Level 2
│   ├── CC-S020 Human Resources               Level 2
│   ├── CC-S030 Finance Operations            Level 2
│   ├── CC-S040 Risk & Compliance             Level 2
│   └── CC-S050 Facilities & Real Estate      Level 2
└── Eliminations                              Level 1
    └── CC-E900 IC Eliminations               Level 2
```

#### dim_account

| Column | Type | Description |
|--------|------|-------------|
| account_key | INT (PK, surrogate) | Surrogate key |
| account_code | VARCHAR(20) | Business key (e.g., "4110") |
| account_name | VARCHAR(100) | Display name |
| account_type | VARCHAR(10) | "Asset", "Liability", "Equity", "Revenue", "Expense" |
| level_1_name | VARCHAR(50) | P&L category: "Net Interest Income", "Non-Interest Revenue", "PCL", "NIE" |
| level_2_name | VARCHAR(50) | Sub-category: "Salary & Wages", "Technology", "Occupancy" |
| level_3_name | VARCHAR(50) | Detail: "Base Salary", "Cloud Hosting", "Lease Payments" |
| level_4_name | VARCHAR(50) | Posting level (finest grain) |
| is_posting | BIT | Can receive journal postings |
| sign_convention | VARCHAR(10) | "natural" or "reversed" (expenses show positive) |
| is_allocable | BIT | Subject to cost allocation |
| allocation_pool | VARCHAR(50) | Which allocation pool this belongs to |
| financial_statement | VARCHAR(20) | "P&L", "Balance Sheet", "Cash Flow", "Off-BS" |
| bs_classification | VARCHAR(30) | For BS accounts: "Current", "Non-Current", etc. |

**Account Hierarchy (illustrative P&L structure for a lender):**
```
Total P&L
├── Net Interest Income (NII)
│   ├── Interest Income
│   │   ├── 4110 Loan Interest — Personal
│   │   ├── 4120 Loan Interest — Secured
│   │   └── 4140 Investment Income
│   └── Interest Expense
│       ├── 4210 Deposit Interest — Savings
│       ├── 4220 Deposit Interest — Term
│       └── 4230 Wholesale Funding Cost
├── Non-Interest Revenue (NIR)
│   ├── 4310 Service Fees & Charges
│   ├── 4320 Card Interchange Revenue
│   └── 4340 Insurance Commissions
├── Provision for Credit Losses (PCL)
│   ├── 4410 Stage 1 ECL (Performing)
│   ├── 4420 Stage 2 ECL (Underperforming)
│   ├── 4430 Stage 3 ECL (Impaired)
│   └── 4440 Recoveries
└── Non-Interest Expense (NIE)
    ├── Compensation & Benefits
    │   ├── 5110 Base Salary
    │   ├── 5120 Variable Compensation (Bonus)
    │   ├── 5130 Benefits
    │   └── 5140 Pension Contributions
    ├── Technology
    │   ├── 5210 Software Licenses
    │   ├── 5220 Cloud Hosting & Infrastructure
    │   └── 5230 IT Consulting & Contractors
    ├── Occupancy
    │   ├── 5310 Lease Payments (IFRS 16)
    │   ├── 5320 Utilities
    │   └── 5330 Maintenance & Repairs
    ├── Professional Fees
    │   ├── 5410 Audit & Assurance
    │   ├── 5420 Legal
    │   └── 5430 Consulting
    ├── Marketing & Communications
    │   ├── 5510 Advertising & Media
    │   └── 5530 Digital Marketing
    ├── Operations
    │   ├── 5610 Outsourced Services
    │   ├── 5630 Travel & Entertainment
    │   └── 5640 Training & Development
    └── Depreciation & Amortization
        ├── 5710 D&A — Tangible Assets
        ├── 5720 D&A — Right-of-Use Assets
        └── 5730 D&A — Intangible Assets (Software)
```

#### dim_time

| Column | Type | Description |
|--------|------|-------------|
| time_key | INT (PK) | YYYYMM format |
| calendar_date | DATE | First day of month |
| fiscal_year | INT | Fiscal year (aligned to the organization's fiscal calendar) |
| fiscal_quarter | VARCHAR(5) | "Q1-YY", "Q2-YY", etc. |
| fiscal_month | INT | 1-12 |
| month_name | VARCHAR(10) | "Jan-YY", "Feb-YY", etc. |
| quarter_num | INT | 1-4 |
| half_year | VARCHAR(5) | "H1-YY", "H2-YY" |
| ytd_flag | BIT | 1 if period is within current YTD |
| is_closed | BIT | Period has been closed (actuals locked) |
| is_forecast | BIT | Period is in forecast horizon |
| days_in_month | INT | 28-31 |

#### dim_scenario

| Column | Type | Description |
|--------|------|-------------|
| scenario_key | INT (PK) | Surrogate key |
| scenario_code | VARCHAR(20) | "ACT", "BUD", "FC", "BC", "WC", "STR" |
| scenario_name | VARCHAR(50) | "Actual", "Budget", "Latest Forecast", etc. |
| scenario_type | VARCHAR(20) | "Actual", "Budget", "Forecast", "Scenario", "Regulatory" |
| is_locked | BIT | Locked (no further edits) |
| owner | VARCHAR(50) | Responsible party |
| approved_date | DATE | Approval date (null if not yet approved) |
| submission_date | DATE | For regulatory scenarios |
| horizon_months | INT | How many months of data (12, 18, 36) |

#### dim_driver

| Column | Type | Description |
|--------|------|-------------|
| driver_key | INT (PK) | Surrogate key |
| driver_code | VARCHAR(20) | "FTE", "SQFT", "REV", "TXN", "AUM", etc. |
| driver_name | VARCHAR(100) | "Full-Time Equivalents", "Square Footage", etc. |
| driver_type | VARCHAR(20) | "headcount", "space", "revenue", "volume", "custom" |
| unit_of_measure | VARCHAR(20) | "FTE", "sq ft", "$M", "count" |
| source_system | VARCHAR(50) | Where driver values come from |
| update_frequency | VARCHAR(20) | "monthly", "quarterly", "annual" |
| allocation_pass | INT | Which pass uses this driver (1, 2, or 3) |

#### dim_product

| Column | Type | Description |
|--------|------|-------------|
| product_key | INT (PK) | Surrogate key |
| product_code | VARCHAR(20) | Business key |
| product_name | VARCHAR(100) | Display name |
| product_family | VARCHAR(50) | L1: e.g., Personal Lending, Deposits, Cards |
| product_line | VARCHAR(50) | L2: within family |
| line_of_business | VARCHAR(50) | Maps to entity division |
| is_active | BIT | Currently offered |
| risk_weight_pct | DECIMAL(5,2) | Regulatory risk weight |

#### dim_version

| Column | Type | Description |
|--------|------|-------------|
| version_key | INT (PK) | Surrogate key |
| version_code | VARCHAR(20) | "WRK", "SUB", "APR", "PUB" |
| version_name | VARCHAR(50) | "Working", "Submitted", "Approved", "Published" |
| is_editable | BIT | Can be modified |
| workflow_stage | INT | Sequential stage in approval workflow |

#### dim_job_family

| Column | Type | Description |
|--------|------|-------------|
| job_family_key | INT (PK) | Surrogate key |
| job_family_code | VARCHAR(20) | "TECH", "OPS", "RISK", "FIN", etc. |
| job_family_name | VARCHAR(100) | "Technology", "Operations", etc. |
| grade_band | VARCHAR(20) | "Executive", "Senior", "Mid", "Junior" |
| avg_base_salary | DECIMAL(12,2) | Benchmark for planning |
| avg_total_comp | DECIMAL(12,2) | Including benefits and bonus |

---

### 3.3 Fact Tables — Detailed

#### fact_gl_balance

| Column | Type | Description |
|--------|------|-------------|
| entity_key | INT (FK → dim_entity) | Entity dimension |
| account_key | INT (FK → dim_account) | Account dimension |
| time_key | INT (FK → dim_time) | Period dimension |
| scenario_key | INT (FK → dim_scenario) | Always "Actual" for GL |
| opening_balance | DECIMAL(18,2) | Start of period |
| period_activity | DECIMAL(18,2) | Movement during period |
| closing_balance | DECIMAL(18,2) | End of period = opening + activity |
| currency | VARCHAR(3) | Transaction currency |
| amount_reporting | DECIMAL(18,2) | Reporting-currency equivalent (translated) |
| journal_count | INT | Number of journals in period |

**Grain:** One row per Entity × Account × Period × Scenario
**Sizing:** entities × posting accounts per period (sparse)

#### fact_allocation_result

| Column | Type | Description |
|--------|------|-------------|
| allocation_key | BIGINT (PK, surrogate) | Surrogate key |
| source_entity_key | INT (FK → dim_entity) | Shared service cost centre |
| target_entity_key | INT (FK → dim_entity) | Receiving business line |
| account_key | INT (FK → dim_account) | Expense account being allocated |
| time_key | INT (FK → dim_time) | Period |
| scenario_key | INT (FK → dim_scenario) | Actual, Budget, Forecast |
| driver_key | INT (FK → dim_driver) | Driver used |
| product_key | INT (FK → dim_product) | Product (Pass 3 only) |
| allocation_pass | INT | 1=Direct, 2=Shared→BU, 3=BU→Product |
| source_amount | DECIMAL(18,2) | Original cost pool amount |
| driver_ratio | DECIMAL(10,6) | Target's share of driver (e.g., 0.25 = 25%) |
| allocated_amount | DECIMAL(18,2) | source_amount × driver_ratio |
| allocation_rule_id | VARCHAR(20) | Reference to allocation rule applied |
| run_id | VARCHAR(36) | UUID of allocation run (for audit) |
| run_timestamp | DATETIME | When allocation was executed |

**Grain:** One row per Source Entity × Target Entity × Account × Period × Driver × Pass
**Sizing:** shared-service pools × target cost centres × allocable accounts × passes per period

#### fact_plan

| Column | Type | Description |
|--------|------|-------------|
| entity_key | INT (FK → dim_entity) | Planning entity |
| account_key | INT (FK → dim_account) | P&L line |
| time_key | INT (FK → dim_time) | Planning period |
| scenario_key | INT (FK → dim_scenario) | Budget, Forecast, Scenario |
| version_key | INT (FK → dim_version) | Working, Submitted, Approved |
| driver_key | INT (FK → dim_driver) | Driver (if driver-based) |
| product_key | INT (FK → dim_product) | Product (if product-level plan) |
| amount | DECIMAL(18,2) | Planned amount (reporting currency) |
| assumption_ref | VARCHAR(100) | Reference to planning assumption used |
| input_method | VARCHAR(20) | "driver_based", "line_item", "spread", "manual" |
| submitted_by | VARCHAR(50) | User who submitted |
| submitted_date | DATETIME | Submission timestamp |
| comment | VARCHAR(500) | Business justification |

**Grain:** One row per Entity × Account × Period × Scenario × Version
**Sizing:** planning entities × plan lines × months, per scenario

#### fact_headcount

| Column | Type | Description |
|--------|------|-------------|
| entity_key | INT (FK → dim_entity) | Cost centre |
| time_key | INT (FK → dim_time) | Period |
| scenario_key | INT (FK → dim_scenario) | Actual or planned |
| job_family_key | INT (FK → dim_job_family) | Job family |
| version_key | INT (FK → dim_version) | Version |
| fte_count | DECIMAL(8,2) | Full-time equivalents |
| headcount | INT | Actual head count |
| avg_base_salary | DECIMAL(12,2) | Average base per FTE |
| avg_total_comp | DECIMAL(12,2) | Average total comp per FTE |
| total_compensation_cost | DECIMAL(18,2) | FTE × avg_total_comp |
| vacancy_count | INT | Unfilled positions |
| new_hires_planned | INT | Hires planned this period |
| attrition_planned | DECIMAL(5,2) | Expected attrition rate % |

**Grain:** One row per Entity × Period × Scenario × Job Family × Version
**Sizing:** cost centres × job families × months

#### fact_driver_value

| Column | Type | Description |
|--------|------|-------------|
| entity_key | INT (FK → dim_entity) | Entity the driver applies to |
| driver_key | INT (FK → dim_driver) | Driver type |
| time_key | INT (FK → dim_time) | Period |
| scenario_key | INT (FK → dim_scenario) | Actual or planned |
| driver_value | DECIMAL(18,4) | Raw driver value (e.g., FTE count, sq ft) |
| driver_ratio | DECIMAL(10,6) | Computed ratio (entity share / total) |
| total_pool_value | DECIMAL(18,4) | Sum of driver across all targets |
| source | VARCHAR(50) | Data source for this value |
| last_updated | DATETIME | When driver was refreshed |

**Grain:** One row per Entity × Driver × Period × Scenario
**Sizing:** entities × drivers × months

---

## 4. ALLOCATION LAYER — Cost Allocation Engine

### 4.1 Allocation Rule Definitions (illustrative)

| Rule ID | Source Pool | Driver | Target Set | Pass |
|---------|------------|--------|------------|------|
| ALLOC-IT-01 | CC-S010 IT | FTE Count | All business cost centres | 2 |
| ALLOC-HR-01 | CC-S020 HR | FTE Count | All business cost centres | 2 |
| ALLOC-FIN-01 | CC-S030 Finance Ops | Transaction Count | All business cost centres | 2 |
| ALLOC-RISK-01 | CC-S040 Risk & Compliance | Revenue Share | All business cost centres | 2 |
| ALLOC-FAC-01 | CC-S050 Facilities | Square Footage | All business cost centres | 2 |
| ALLOC-PROD-01 | Business Line A (total) | Product Revenue | Products within Business Line A | 3 |
| ALLOC-PROD-02 | Business Line B (total) | Product Balances | Products within Business Line B | 3 |

### 4.2 Allocation Execution Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MONTHLY ALLOCATION EXECUTION                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Step 1: REFRESH DRIVERS                                            │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Load latest driver values from source systems:                 │  │
│  │ • FTE from HR snapshot                                         │  │
│  │ • Sqft from Facilities                                         │  │
│  │ • Revenue from GL (YTD actual or full-year budget)             │  │
│  │ • Transactions from the ERP                                    │  │
│  │ Compute ratios: entity_value / SUM(all_target_values)          │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                                                                     │
│  Step 2: PASS 1 — DIRECT COSTS                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ No allocation needed — costs already in correct cost centre    │  │
│  │ Validate: All GL balances in non-shared-service entities       │  │
│  │ remain untouched                                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                                                                     │
│  Step 3: PASS 2 — SHARED SERVICES → BUSINESS LINES                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ FOR EACH shared_service_entity:                                │  │
│  │   FOR EACH expense_account in source:                          │  │
│  │     source_amount = GL balance (entity, account, period)       │  │
│  │     FOR EACH target_entity:                                    │  │
│  │       allocated = source_amount × driver_ratio[target]         │  │
│  │       INSERT into fact_allocation_result                       │  │
│  │   VALIDATE: SUM(allocated) = source_amount (zero residual)    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                                                                     │
│  Step 4: PASS 3 — BUSINESS LINE → PRODUCT                           │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ FOR EACH business_line_entity:                                 │  │
│  │   total_cost = direct_cost + pass_2_allocated_cost             │  │
│  │   FOR EACH product in entity:                                  │  │
│  │     allocated = total_cost × product_driver_ratio              │  │
│  │     INSERT into fact_allocation_result (pass=3)                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                                                                     │
│  Step 5: RECONCILE & PUBLISH                                         │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ • Total expenses before allocation = Total after allocation    │  │
│  │ • No orphan costs (all shared services fully allocated out)    │  │
│  │ • Shared service entities net to zero post-allocation          │  │
│  │ • Publish allocation results to OneStream via REST API         │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Allocation Validation Rules

| Check | Formula | Expected | Action |
|-------|---------|----------|--------|
| Zero balance | SUM(source) - SUM(allocated) | = 0 | Block, alert |
| Ratio sum | SUM(driver_ratio) for all targets | = 1.000 | Block, alert |
| No negative | All allocated_amount | >= 0 | Flag for review |
| Shared svc net | Post-allocation balance for shared-service cost centres | = 0 | Block, alert |
| Prior period | This month vs last month variance | Above an agreed threshold | Flag for review |

---

## 5. PLANNING LAYER — Budget, Forecast & Scenarios

### 5.1 Planning Model Relationships

```
┌──────────────────────────────────────────────────────────────────┐
│                     PLANNING MODEL ARCHITECTURE                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ASSUMPTIONS (dim_driver + planning_assumptions)                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Interest Rates   Growth Rates   Headcount   Credit   Macro  │ │
│  │ • Policy Rate    • Loan Vol     • FTE Plan  • PCL    • GDP  │ │
│  │ • Prime          • Deposit Vol  • Avg Comp  • Stage  • CPI  │ │
│  │ • NIM Spread     • Fee Growth   • Attrition • LGD   • FX   │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                             │                                     │
│                                                                  │
│  DRIVER-BASED CALCULATIONS (fact_plan + business rules)           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  NII = (Loan Balance × Lending Rate) - (Deposit Balance ×   │ │
│  │         Deposit Rate) + Investment Income                    │ │
│  │                                                              │ │
│  │  NIR = (Card Accounts × Avg Spend × Interchange Rate) +     │ │
│  │         Service Fees + Commissions                           │ │
│  │                                                              │ │
│  │  PCL = Gross Loans × Expected Loss Rate × (1 - Recovery)    │ │
│  │                                                              │ │
│  │  NIE = (FTE × Avg Total Comp) + Technology + Occupancy +    │ │
│  │         Professional Fees + Marketing + Operations + D&A     │ │
│  │                                                              │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
│                             │                                     │
│                                                                  │
│  OUTPUTS (fact_plan → OneStream cubes)                            │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ • Full P&L by entity × month × scenario                     │ │
│  │ • Efficiency Ratio = NIE / (NII + NIR)                       │ │
│  │ • ROE = Net Income / Equity                                  │ │
│  │ • PPPT = NII + NIR - PCL (Pre-Provision Pre-Tax)             │ │
│  │ • Cost per FTE = NIE / Total FTE                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Planning Scenarios (illustrative)

| Scenario | Type | Horizon | Key Assumptions | Owner |
|----------|------|---------|-----------------|-------|
| **Budget** | Budget | 12 months | Board-approved targets | CFO |
| **Latest Forecast** | Forecast | Remaining months of the year | Updated with year-to-date actuals + revised outlook | VP Finance |
| **Best Case** | Scenario | 12 months | Favourable rate, volume and credit assumptions | FP&A Director |
| **Worst Case** | Scenario | 12 months | Adverse rate, volume and credit assumptions | FP&A Director |
| **Regulatory Stress Test** | Regulatory | 36 months | Severe recession scenario as prescribed by the regulator | CRO |
| **M&A Integration** | Scenario | 24 months | Target acquisition, synergy realization curve | Corp Dev |

### 5.3 Planning Workflow States

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  DRAFT   │───│ SUBMITTED│───│  FINANCE │───│   CFO    │───│  LOCKED  │
│          │    │          │    │  REVIEW  │    │ APPROVAL │    │          │
│ Working  │    │ Version  │    │          │    │          │    │ Published│
│ editable │    │ frozen   │    │ Comments │    │ Sign-off │    │ Read-only│
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                    │
     │                               │
     └───────────── REJECT ──────────┘
                  (with comments)
```

---

## 6. CONSUMPTION LAYER — Reporting & OneStream

### 6.1 OneStream Cube Mapping

| Core Layer Table | OneStream Cube | Dimension Mapping |
|-----------------|----------------|-------------------|
| fact_gl_balance | Actuals | Entity=dim_entity, Account=dim_account, Time=dim_time |
| fact_plan (Budget) | Budget | Same + Scenario=Budget |
| fact_plan (Forecast) | Forecast | Same + Scenario=Latest Forecast |
| fact_allocation_result | Allocations | Source/Target entity, same dims |
| fact_headcount | Workforce | Entity, Time, JobFamily |
| fact_driver_value | Assumptions | Entity, Driver, Time |

### 6.2 MBR Report Data Flows

| MBR Section | Source Fact Table | Calculation |
|-------------|-------------------|-------------|
| P&L Summary | fact_gl_balance + fact_plan | Actual vs Budget vs PY variance |
| Variance Bridge | fact_gl_balance | Volume × Price × Mix × FX decomposition |
| Expense by Category | fact_gl_balance | Filter account_type = "Expense", group by level_2 |
| Allocation Summary | fact_allocation_result | Sum by target_entity, group by source |
| Headcount Tracker | fact_headcount | Actual FTE vs plan, by division |
| Rolling Forecast | fact_plan | 18-month view with actuals overlay |
| KPI Dashboard | Derived | Efficiency ratio, ROE, cost/FTE, PCL rate |

### 6.3 Data Lineage Summary

```
Source System → Staging → Core Fact → Allocation → Planning → OneStream Cube → MBR Dashboard
     │              │          │            │           │            │              │
  Raw data    Cleansed    Dimensional   Fully      Scenario    API Load      Executive
  (ERP/HR)    Validated   Star Schema   Allocated  Modeled     Published     Consumption
```

---

## 7. DATA GOVERNANCE & METADATA

### 7.1 Data Ownership Matrix

| Data Domain | Business Owner | Technical Owner | Steward |
|-------------|---------------|-----------------|---------|
| GL / Actuals | Controller | Data Engineer | Finance Ops |
| Cost Allocation | FP&A Director | Data Engineer | Allocation Analyst |
| Planning / Forecast | VP Finance | OneStream Admin | FP&A Manager |
| Headcount | CHRO | HR Systems | HR Business Partner |
| Market Data / Rates | Treasurer | Treasury Systems | Treasury Analyst |
| Reporting / MBR | CFO | BI/Analytics | FP&A Director |

### 7.2 Data Quality SLAs

| Domain | Completeness | Accuracy | Timeliness | Freshness |
|--------|-------------|----------|-----------|-----------|
| GL Actuals | 100% | ±$1 balance | Day 2 post-close | Monthly |
| Allocations | 100% zero-balance | ±$1 | Day 5 post-close | Monthly |
| Headcount | 100% of active FTE | ±1 FTE | Day 3 | Monthly |
| Planning | N/A (input) | N/A | By deadline | Per cycle |
| Rates | 100% business days | Source-matched | Same day | Daily |

### 7.3 Retention & Archival

| Data Type | Hot Storage | Warm Storage | Archive | Total |
|-----------|-------------|--------------|---------|-------|
| GL Detail (journals) | 24 months | 5 years | 7 years | 7 years |
| Balances & Plans | 36 months | 7 years | Indefinite | Indefinite |
| Allocation Results | 24 months | 5 years | 7 years | 7 years |
| Driver Values | 36 months | 5 years | 7 years | 7 years |
| Audit Logs | 12 months | 5 years | 7 years | 7 years |
