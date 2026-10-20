# Oracle EPBCS — Planning and Budgeting Cloud Service

Complete implementation reference for Oracle Enterprise Planning and Budgeting Cloud Service (EPBCS),
including PBCS (the subset without extended modules).

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Enterprise Planning and Budgeting Cloud Service |
| **Abbreviation** | EPBCS (includes PBCS capabilities) |
| **Purpose** | Financial planning, budgeting, forecasting, workforce planning, capital planning, strategic modeling |
| **Cube Engine** | Essbase Hybrid (BSO + ASO in one application) |
| **Key Users** | FP&A analysts, budget managers, CFO office, business partners |
| **Typical Implementation** | 12-20 weeks (core planning); 8-12 weeks per extended module |

---

## EPBCS Modules

### Core Planning (included in both PBCS & EPBCS)

| Capability | Description |
|------------|-------------|
| **Financials** | P&L, balance sheet, cash flow planning at any granularity |
| **Driver-based models** | Assumption-driven models linking operational drivers to financial outcomes |
| **Rolling forecasts** | Continuous 12-18 month forward view; drop closed periods, add new |
| **Scenario modeling** | What-if analysis with unlimited scenarios |
| **Approval workflows** | Multi-level planning unit promotion and sign-off |
| **Sandboxes** | Private workspaces for testing scenarios without affecting shared data |
| **Predictive Planning** | ML-based statistical forecasting using historical data patterns |

### Extended Modules (EPBCS only)

| Module | Purpose | Key Features |
|--------|---------|--------------|
| **Workforce** | Headcount and compensation planning | Position-level, merit increases, benefits loading, attrition modeling, new hire timing |
| **Capital** | CapEx planning and asset lifecycle | Asset categories, depreciation schedules, project tracking, ROI calculation |
| **Projects** | Project financial planning | Project-level revenue/cost, resource allocation, milestone tracking |
| **Financials (Extended)** | Advanced financial planning | Cash flow waterfall, balance sheet modeling, intercompany |
| **Strategic Modeling** | Long-range strategic planning | DCF, valuation, M&A modeling, debt scheduling, EVA |

---

## Application Architecture

### Plan Types (Cubes)

EPBCS supports **multiple plan types** within a single application:

| Plan Type | Block Storage | Purpose | Performance Profile |
|-----------|--------------|---------|---------------------|
| **Plan1** | Hybrid (default) | Primary planning cube — budget, forecast | Read/Write, moderate density |
| **Plan2** | Hybrid (optional) | Secondary cube — workforce, projects | Read/Write |
| **Plan3** | Hybrid (optional) | Tertiary cube — CapEx, scenarios | Read/Write |
| **Reporting** | ASO | Aggregation-only reporting | Read-only, fast aggregation |
| **Workforce** | Pre-built | Headcount and compensation | Module-managed |
| **Capital** | Pre-built | CapEx and asset management | Module-managed |

### Dimension Limits

| Constraint | Limit | Notes |
|------------|-------|-------|
| Maximum dimensions per cube | 14 | Includes all standard + custom |
| Maximum members per dimension | No hard limit | Practical: <50K for performance |
| Maximum dense dimensions | 3-4 recommended | Account and Period are always dense |
| Maximum alternate hierarchies | No limit | But each adds processing overhead |
| Maximum forms per application | No hard limit | Practical: <500 for manageability |
| Maximum business rules | No hard limit | But >200 becomes maintenance burden |

### Dense vs Sparse Assignment

**Critical for performance.** Dense dimensions form the Essbase data block; sparse dimensions form the index.

| Dimension | Typically Dense? | Reasoning |
|-----------|-----------------|-----------|
| Account |  Always dense | Every entity has most accounts |
| Period |  Always dense | Every intersection has all 12 months |
| Scenario | Depends (often dense) | Few members, all entities have Actual+Budget |
| Version | Depends (often dense) | Few members |
| Entity |  Sparse | Not all entities have all account/product combos |
| Product |  Sparse | Creates sparsity against Entity |
| Project |  Sparse | Creates sparsity against Entity |
| Custom dims |  Usually sparse | Case-by-case based on data density |

---

## Configuration Reference

### Substitution Variables

Substitution variables enable dynamic references in forms, rules, and reports without hardcoding periods/years.

| Variable | Purpose | Example Value | Update Frequency |
|----------|---------|---------------|-----------------|
| `CurYear` | Current fiscal year | `FY26` | Annual |
| `CurMonth` | Current period | `Jan` | Monthly |
| `PriorYear` | Comparison year | `FY25` | Annual |
| `PriorMonth` | Prior period | `Dec` | Monthly |
| `BudgetYear` | Budget target year | `FY27` | Annual (budget cycle start) |
| `FcstStartMonth` | Forecast start period | `Apr` | Monthly |
| `ActualMonth` | Last actual loaded | `Mar` | Monthly (after close) |
| `CurScenario` | Active planning scenario | `Budget` or `Forecast` | Per planning cycle |

**Update Script (EPM Automate):**
```batch
epmautomate setsubstvars "Plan1" "CurMonth=Apr" "ActualMonth=Mar" "FcstStartMonth=May"
```

### Form Design Patterns

**Pattern 1: Budget Input Form (P&L by Cost Centre)**
```
POV:       Scenario=Budget, Version=Working, Year=FY27, Currency=Local
Rows:      Account (children of Total_NIE)
Columns:   Period (Jan through Dec) + YearTotal
Page:      Entity (user-assigned cost centres)
```

**Pattern 2: Rolling Forecast Input**
```
POV:       Scenario=Forecast, Version=Working, Currency=Local
Rows:      Account (revenue drivers + expense lines)
Columns:   Period (dynamic: ActualMonth+1 through ActualMonth+18, cross-year)
Page:      Entity (user-assigned)
Properties: Read-only for actuals periods, editable for forecast periods
```

**Pattern 3: Variance Report (Actual vs Budget)**
```
POV:       Version=Final, Year=CurYear, Currency=CAD
Rows:      Account (P&L hierarchy expanded 2 levels)
Columns:   Period(CurMonth) × Scenario(Actual, Budget, Variance, Variance%)
Page:      Entity (management hierarchy)
Properties: Read-only; conditional formatting on variances
```

**Form Design Best Practices:**
1. **One process per form** — Don't combine revenue planning and expense planning
2. **Limit rows to <100** — Larger forms cause timeout; use composite forms for grouping
3. **Use dynamic member selections** — Substitution variables, not hardcoded members
4. **Pre-populate where possible** — Seed forecast from actuals or prior year to reduce data entry
5. **Add validation rules** — Prevent submission of incomplete or out-of-range data
6. **Design for Smart View** — Test every form in both web and Smart View
7. **Mobile-friendly** — Key executive dashboards should render on Oracle EPM mobile app

### Business Rule Patterns

**Pattern: Spreading Annual Target to Monthly**
```groovy
// Spread annual budget to months using seasonal profile
String entity = rtps.Entity
String scenario = "Budget"
String version = "Working"

def annualTarget = operation.grid.getCellValue(
    "Entity::${entity}", "Account::Revenue_Total",
    "Period::BegBalance", "Scenario::${scenario}", "Version::${version}"
)

// Seasonal weights (from assumptions cube)
def weights = [
    "Jan": 0.07, "Feb": 0.07, "Mar": 0.08, "Apr": 0.08,
    "May": 0.09, "Jun": 0.09, "Jul": 0.08, "Aug": 0.08,
    "Sep": 0.09, "Oct": 0.09, "Nov": 0.09, "Dec": 0.09
]

weights.each { period, weight ->
    operation.grid.setCellValue(
        annualTarget * weight,
        "Entity::${entity}", "Account::Revenue_Total",
        "Period::${period}", "Scenario::${scenario}", "Version::${version}"
    )
}
```

**Pattern: Copy Actuals to Forecast Seed**
```groovy
// Copy YTD actuals into forecast as seed (run at forecast cycle start)
def actualMonths = ["Jan", "Feb", "Mar"]  // Dynamically determine from SubstVar
def forecastMonths = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

operation.grid.dataCellIterator({DataCell cell ->
    cell.getScenarioName() == "Actual" &&
    actualMonths.contains(cell.getPeriodName())
}).each { cell ->
    // Write actual value to Forecast scenario at same intersection
    operation.grid.setCellValue(
        cell.data,
        cell.getMemberNames().collect { dim, member ->
            if (dim == "Scenario") return "Scenario::Forecast"
            return "${dim}::${member}"
        } as String[]
    )
}
```

**Pattern: Workforce Cost Calculation**
```groovy
// Calculate fully-loaded headcount cost from driver inputs
def entities = operation.grid.dataCellIterator("Account::FTE_Count").collect {
    it.getMemberName("Entity")
}.unique()

entities.each { entity ->
    def fteCount = operation.grid.getCellValue(
        "Entity::${entity}", "Account::FTE_Count", "Period::${rtps.Period}"
    )
    def avgSalary = operation.grid.getCellValue(
        "Entity::${entity}", "Account::Avg_Salary", "Period::${rtps.Period}"
    )
    def benefitsRate = 0.28  // 28% benefits loading

    def totalComp = fteCount * avgSalary * (1 + benefitsRate) / 12

    operation.grid.setCellValue(totalComp,
        "Entity::${entity}", "Account::NIE_Compensation",
        "Period::${rtps.Period}", "Scenario::${rtps.Scenario}", "Version::Working"
    )
}
```

---

## Predictive Planning (ML-Based Forecasting)

Oracle EPM Cloud includes **built-in machine learning** for forecast generation.

### How It Works
1. System analyzes 24+ months of historical actuals
2. Tests multiple time-series models (seasonal decomposition, Holt-Winters, ARIMA)
3. Selects best-fit model per account/entity combination
4. Generates 12-18 month forward projection with confidence intervals
5. User can accept, adjust, or override ML predictions

### Configuration Steps
1. Enable Predictive Planning on the application
2. Define historical data range (minimum 24 months recommended)
3. Select accounts and entities eligible for prediction
4. Set prediction horizon (months forward)
5. Configure seasonal adjustments if needed
6. Run prediction; review results in dedicated form

### Best Practices
- Works best for: revenue streams, volume metrics, stable expense categories
- Works poorly for: one-off items, new products (no history), lumpy CapEx
- Always provide user override capability — predictions are seeds, not final forecasts
- Re-run predictions monthly after new actuals are loaded

---

## Planning Workflow & Approvals

### Approval Unit Hierarchy

Planning units define **who owns which data** and follow an approval workflow:

```
Total Company (CFO)
├── Division A (VP Division A)
│   ├── Dept A1 (Director)
│   ├── Dept A2 (Director)
│   └── Dept A3 (Director)
├── Division B (VP Division B)
│   ├── Dept B1 (Manager)
│   └── Dept B2 (Manager)
└── Corporate Functions (VP Finance)
    ├── IT (CTO)
    ├── HR (CHRO)
    └── Finance (Controller)
```

### Workflow States

| State | Meaning | Who Acts |
|-------|---------|----------|
| **Not Started** | Planning unit not yet opened | System default |
| **First Pass** | Initial data entry in progress | Budget owner (Planner) |
| **Under Review** | Submitted for manager review | Reviewer (next level up) |
| **Approved** | Accepted by approver | Approver promotes to Final |
| **Distributed** | Top-down targets pushed down | Manager distributes to reports |
| **Sign Off** | Final executive sign-off | CFO/Finance Director |
| **Published** | Locked; published as official budget | System locks the version |

### Workflow Configuration
1. Define ownership by entity (who submits each cost centre)
2. Define approval hierarchy (who reviews, who approves)
3. Set email notifications for each state transition
4. Define validation rules that must pass before promotion
5. Configure auto-email reminders for overdue submissions
6. Set lock rules (approved planning units become read-only)

---

## Performance Optimization

### Common Performance Issues and Fixes

| Symptom | Root Cause | Fix |
|---------|-----------|-----|
| Slow form load (>10s) | Too many rows/columns expanded | Limit member selection; use page-level POV |
| Slow rule execution (>5 min) | FIX statement too broad | Narrow FIX to only affected intersections |
| Slow data retrieve in Smart View | Large ad-hoc query with no suppression | Enable "Suppress Missing Data" and "Suppress Zero" |
| Slow consolidation | Dynamic calc members in dense dim | Move complex calcs to stored members with on-demand calc |
| Cube refresh takes >1hr | Metadata too complex | Reduce unused members; clean up orphan artifacts |
| Smart View timeout | Network or query too large | Use Member Selection optimization; retrieve smaller slices |

### Essbase Hybrid Cube Optimization

| Technique | When to Apply | Impact |
|-----------|---------------|--------|
| Enable Hybrid mode | All new EPBCS apps | 3-10× aggregation improvement |
| Use dynamic calc on sparse dims | Ratios, percentages, derived metrics | Reduce stored data blocks |
| Stored calc on dense dims | Frequently-accessed totals (YTD, QTD) | Faster retrieval at cost of storage |
| Minimize cross-dim calcs | Rules that iterate across sparse dims | Faster rule execution |
| Use data maps instead of rules for data copy | Moving data between cubes | More efficient than Groovy for bulk copy |
| Partition large apps | >20K entity members | Better concurrency and performance |

---

## Integration Patterns

### Inbound Data (ERP → EPBCS)

| Data Type | Source | Frequency | Method |
|-----------|--------|-----------|--------|
| GL Actuals | Oracle ERP Cloud / SAP / Workday | Monthly (post-close) | Data Management (FDMEE) |
| Trial Balance | ERP GL | Monthly | Data Management or flat file |
| Headcount/FTE | HCM (Workday, Oracle HCM, SAP HCM) | Monthly | Data Management or REST API |
| Actuals for KPI | Operational systems | Monthly/Weekly | REST API or flat file |
| Exchange rates | Treasury system or market feed | Daily/Monthly | Flat file load via EPM Automate |
| Statistical data (volumes, metrics) | Data warehouse or BI tool | Monthly | REST API or flat file |

### Outbound Data (EPBCS → Downstream)

| Data Type | Target | Frequency | Method |
|-----------|--------|-----------|--------|
| Approved budget | ERP (for budget checking) | After approval | Data Management export or REST API |
| Forecast data | BI/reporting (Power BI, Tableau) | Monthly | REST API extract or Smart View RO connection |
| Headcount plan | HR system (for staffing) | After approval | Flat file export via EPM Automate |
| CapEx budget | Project system | After approval | REST API or flat file |
| Board reporting package | Narrative Reporting | Monthly | Native connection (same EPM instance) |

---

## Common Implementation Mistakes

| Mistake | Consequence | Prevention |
|---------|-------------|------------|
| Designing dimensions to match the org chart exactly | Restructures break the app | Design for stability; use alternate hierarchies for current structure |
| Building too many forms | Maintenance nightmare; user confusion | <30 forms for typical budget app; composite forms for related views |
| Over-engineering business rules | Slow performance; hard to debug | Start simple; add complexity only when needed |
| Skipping parallel run | Go-live issues discovered too late | Minimum 2 period parallel for planning apps |
| Not training power users | Dependency on consultants | Train at least 3 power users who can maintain forms/rules |
| Ignoring monthly updates | New features break custom work | Assign update review responsibility; maintain regression tests |
| Flat-file only integration | Manual, error-prone, no audit trail | Invest in Data Management rules from Day 1 |
| No sandbox strategy | Users afraid to experiment | Enable sandboxes; train users to create and merge |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| EPBCS Admin Guide | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/` |
| Dimension Design | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/designing_applications.html` |
| Form Design | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/managing_forms.html` |
| Business Rules | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/working_with_business_rules.html` |
| Groovy Reference | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/groov/` |
| Workforce Module | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/workforce_planning.html` |
| Capital Module | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/capital_planning.html` |
| Predictive Planning | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/pfusa/predictive_planning.html` |
| REST API Reference | `docs.oracle.com/en/cloud/saas/planning-budgeting-cloud/prest/` |
