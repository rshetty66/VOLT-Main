# Oracle EDM — Enterprise Data Management Cloud

Complete implementation reference for Oracle Enterprise Data Management Cloud (EDM).

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Enterprise Data Management Cloud |
| **Abbreviation** | EDM |
| **Purpose** | Master data governance, hierarchy management, COA alignment, dimension lifecycle |
| **Key Users** | Data stewards, finance master data team, COA owners, hierarchy managers |
| **Typical Implementation** | 8-14 weeks |
| **Replaces (On-Prem)** | Data Relationship Management (DRM) |

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Hierarchy Management** | Create, maintain, and visualize hierarchies for any dimension |
| **Change Request Workflow** | Governed process for adding/modifying/retiring dimension members |
| **Multi-Application Governance** | Single source of truth for dimensions shared across EPBCS, FCCS, ARCS, TRCS |
| **Mapping & Crosswalk** | Map members between systems (ERP COA <-> EPM COA <-> Reporting COA) |
| **Version Control** | Track all changes with full audit history; compare versions |
| **Impact Analysis** | Before changing a member, see which applications and reports use it |
| **Validation Rules** | Business rules that prevent invalid hierarchy structures |
| **Subscription** | Target applications subscribe to EDM for automated dimension sync |
| **Data Lineage** | Trace how master data flows from source through EDM to targets |
| **Alternate Hierarchies** | Maintain multiple views of the same dimension (legal vs management) |

---

## EDM Architecture

### Conceptual Model

```
SOURCE SYSTEMS                    EDM CLOUD                     TARGET APPLICATIONS
┌──────────────┐            ┌─────────────────────┐           ┌──────────────────┐
│ Oracle ERP   │───────────│                     │──────────│ EPBCS (Planning) │
│ (COA, Entities)           │  DIMENSIONS         │           │                  │
├──────────────┤            │  ┌───────────────┐  │           ├──────────────────┤
│ Workday      │───────────│  │ Entity        │  │──────────│ FCCS (Consol)    │
│ (Cost Centres)│           │  │ Account       │  │           │                  │
├──────────────┤            │  │ Product       │  │           ├──────────────────┤
│ HR System    │───────────│  │ Project       │  │──────────│ ARCS (Recon)     │
│ (Departments) │           │  │ Department    │  │           │                  │
├──────────────┤            │  │ Cost Centre   │  │──────────├──────────────────┤
│ Manual       │───────────│  └───────────────┘  │           │ TRCS (Tax)       │
│ (Spreadsheet)│            │                     │           │                  │
└──────────────┘            │  GOVERNANCE         │           ├──────────────────┤
                            │  ┌───────────────┐  │           │ Oracle ERP Cloud │
                            │  │ Requests      │  │──────────│ (write-back)     │
                            │  │ Approvals     │  │           │                  │
                            │  │ Validations   │  │           ├──────────────────┤
                            │  │ Audit Trail   │  │           │ Power BI / BI    │
                            │  └───────────────┘  │──────────│ (reporting dims) │
                            └─────────────────────┘           └──────────────────┘
```

### Key Concepts

| Concept | Definition |
|---------|------------|
| **Dimension** | A master data domain (Entity, Account, Product, etc.) |
| **Hierarchy** | Ordered parent-child structure within a dimension |
| **Node** | Individual member within a hierarchy |
| **Node Type** | Classification of a node (Parent, Leaf, Shared, Rollup) |
| **Property** | Attribute attached to a node (alias, UDA, smart list, formula) |
| **View** | A specific representation/application perspective of the dimension |
| **Viewpoint** | A hierarchy filtered for a specific target system |
| **Request** | A change request (add, modify, move, retire a node) |
| **Subscription** | Link between EDM dimension and target application dimension |
| **Binding** | Mapping between EDM properties and target application properties |

---

## Dimension Governance Workflow

### Change Request Process

```
REQUEST ── VALIDATE ── APPROVE ── COMMIT ── EXPORT (to target apps)
   │            │           │          │            │
   │ Requestor  │ System    │ Approver │ System     │ Subscription
   │ submits    │ checks    │ reviews  │ applies    │ pushes to
   │ change     │ rules     │ + signs  │ change     │ EPM apps
```

### Request Types

| Request Type | Example | Typical Requestor |
|-------------|---------|-------------------|
| **Add member** | New cost centre for new department | HR / Finance Manager |
| **Modify member** | Change account description or alias | COA Manager |
| **Move member** | Restructure entity from one parent to another | Finance Director |
| **Retire member** | Close a cost centre (no new postings) | HR / Finance Manager |
| **Merge members** | Combine two entities after restructuring | M&A team |
| **Add hierarchy** | Create alternate hierarchy for management reporting | FP&A |
| **Property change** | Update consolidation method on entity | Consolidation team |

### Approval Configuration

| Level | Approver | Criteria |
|-------|----------|----------|
| Level 1 | Data Steward (dimension-specific) | All requests |
| Level 2 | Finance Controller | New entities, account structure changes |
| Level 3 | CFO | Major restructuring, new legal entities |
| Auto-approve | System | Low-risk changes (alias updates, description changes) |

---

## Configuration Reference

### Dimension Setup Example: Entity

```yaml
Dimension: Entity
Description: Legal and management organization structure
Properties:
  - Name (unique identifier, system-generated or manual)
  - Alias (display name for reports)
  - Currency (functional currency: CAD, USD, GBP)
  - Consolidation_Method (Full, Proportional, Equity, None)
  - Ownership_Pct (decimal: 0.00 to 1.00)
  - Data_Source (how actuals arrive: FDMEE, Manual, API)
  - Active_Flag (Y/N — retired entities set to N)
  - Effective_From (date member becomes active)
  - Effective_To (date member becomes inactive)
  - GL_Entity_Code (mapping to ERP entity/company code)
  - Jurisdiction (for tax reporting mapping)

Hierarchy:
  Total_Company [Parent]
  ├── Corporate [Parent]
  │   ├── Finance_Dept [Leaf]
  │   ├── HR_Dept [Leaf]
  │   └── IT_Dept [Leaf]
  ├── Retail_Banking [Parent]
  │   ├── Branch_Ontario [Leaf]
  │   ├── Branch_BC [Leaf]
  │   └── Branch_Alberta [Leaf]
  └── Commercial_Banking [Parent]
      ├── Mid_Market [Leaf]
      └── Large_Corporate [Leaf]

Views:
  - Legal View (statutory reporting structure)
  - Management View (management reporting structure)
  - Regulatory View (OSFI entity grouping)
```

### Dimension Setup Example: Account (COA)

```yaml
Dimension: Account
Description: Chart of Accounts — unified across ERP and EPM
Properties:
  - Account_Code (unique natural key: e.g., "4100-001")
  - Account_Name (descriptive name)
  - Account_Type (Asset, Liability, Equity, Revenue, Expense)
  - Time_Balance (Flow / Balance / Average)
  - Variance_Reporting (Expense / Non-Expense)
  - Exchange_Rate_Type (Average, Closing, Historical)
  - Data_Storage (Store / Dynamic_Calc / Label_Only)
  - Formula (member formula for calculated accounts)
  - UDA (User-Defined Attributes for filtering)
  - ERP_Account (mapping to source ERP account code)
  - Intercompany_Flag (Y/N — is this an ICO account)

Hierarchy:
  Total_P&L [Parent, Dynamic]
  ├── Revenue [Parent]
  │   ├── Net_Interest_Income [Parent]
  │   │   ├── Interest_Income [Parent]
  │   │   │   ├── 4100-001_Loan_Interest [Leaf, Store]
  │   │   │   └── 4100-002_Investment_Income [Leaf, Store]
  │   │   └── Interest_Expense [Parent]
  │   │       ├── 4200-001_Deposit_Interest [Leaf, Store]
  │   │       └── 4200-002_Borrowing_Cost [Leaf, Store]
  │   └── Non_Interest_Income [Parent]
  │       ├── 4300-001_Fee_Income [Leaf, Store]
  │       └── 4300-002_Trading_Income [Leaf, Store]
  └── Expenses [Parent]
      ├── Personnel [Parent]
      │   ├── 5100-001_Salaries [Leaf, Store]
      │   └── 5100-002_Benefits [Leaf, Store]
      └── Non_Personnel [Parent]
          ├── 5200-001_Occupancy [Leaf, Store]
          └── 5200-002_Technology [Leaf, Store]
```

---

## Validation Rules

### Common Validation Rules

| Rule | Purpose | Example |
|------|---------|---------|
| **Unique name** | Prevent duplicate member codes | No two entities can have the same code |
| **Parent constraint** | Restrict where members can be placed | Leaf entities can only sit under a Division parent |
| **Property required** | Mandatory properties must be filled | Currency is required for all leaf entities |
| **Format validation** | Enforce naming conventions | Account codes must match pattern "NNNN-NNN" |
| **Circular reference check** | Prevent cycles in hierarchy | Parent cannot be its own descendant |
| **Active parent** | Cannot add children to retired parent | Inactive parents reject new members |
| **Cross-dimension consistency** | Related dimensions must align | ICO accounts must have matching entity pairs |
| **Maximum depth** | Limit hierarchy depth for performance | Entity hierarchy max 5 levels |

### Validation Rule Example (Groovy)

```groovy
// Validation: New entity must have Currency property set
if (request.type == "ADD" && request.dimension == "Entity") {
    if (request.getProperty("Currency") == null || request.getProperty("Currency") == "") {
        reject("Currency is required for all new entities")
    }
}

// Validation: Account code must follow pattern
if (request.dimension == "Account") {
    def code = request.getProperty("Account_Code")
    if (!(code ==~ /\d{4}-\d{3}/)) {
        reject("Account code must follow format NNNN-NNN (e.g., 4100-001)")
    }
}
```

---

## Subscriptions & Export

### Subscription Configuration

A subscription links an EDM dimension to a target application:

| Subscription Component | Purpose |
|----------------------|---------|
| **Source viewpoint** | Which EDM view provides the data |
| **Target application** | Which EPM application receives the update (EPBCS, FCCS, etc.) |
| **Target dimension** | Which dimension in the target app |
| **Property binding** | Map EDM properties → target application dimension properties |
| **Filter** | Only export members meeting criteria (e.g., Active_Flag = Y) |
| **Schedule** | On-demand, after approval, or scheduled (via EPM Automate) |
| **Mode** | Full replace or incremental (add/modify only) |

### Subscription Example

```
Subscription: Entity_to_FCCS
  Source: EDM → Entity dimension → Legal View viewpoint
  Target: FCCS → Entity dimension
  Bindings:
    EDM.Name → FCCS.Member_Name
    EDM.Alias → FCCS.Alias_Default
    EDM.Currency → FCCS.Default_Currency
    EDM.Consolidation_Method → FCCS.Consolidation_Method
    EDM.Ownership_Pct → FCCS.Ownership_Percentage
    EDM.Parent → FCCS.Parent
  Filter: Active_Flag = "Y"
  Schedule: After approval (auto-export on commit)
  Mode: Incremental
```

### Export via EPM Automate

```batch
REM Export EDM dimension to target application
epmautomate login admin@co.com pass https://epm.oraclecloud.com domain
epmautomate runsubscription "Entity_to_FCCS"
epmautomate runsubscription "Account_to_EPBCS"
epmautomate runsubscription "Entity_to_TRCS"
epmautomate logout
```

---

## Mapping & Crosswalk

### Cross-System Mapping Use Case

When ERP and EPM use different COA structures:

```
ERP (Oracle Fusion)              EDM Mapping               EPM (FCCS/EPBCS)
┌────────────────┐          ┌─────────────────┐          ┌────────────────┐
│ 110100 Cash    │──────────│ Map: 110100 →   │──────────│ 1100 Cash      │
│ 120100 AR      │          │       1100      │          │ 1200 AR        │
│ 401000 Revenue │          │ Map: 120100 →   │          │ 4100 Revenue   │
│ 501000 COGS    │          │       1200      │          │ 5100 COGS      │
│ 601000 OpEx    │          │ Map: 401000 →   │          │ 6100 OpEx      │
└────────────────┘          │       4100      │          └────────────────┘
                            └─────────────────┘
```

### Mapping Types

| Mapping Type | Description | Example |
|-------------|-------------|---------|
| **One-to-one** | Single source → single target | ERP entity "1001" → EPM entity "CanadaCorp" |
| **Many-to-one** | Multiple source → one target | ERP accounts 601*, 602*, 603* → EPM "Other_OpEx" |
| **One-to-many** | One source → multiple targets (split) | ERP "Corporate" → EPM "Corp_Admin" + "Corp_Exec" (by rule) |
| **Conditional** | Mapping depends on other dimensions | ERP "401000" → EPM "NII" if segment=Banking, else "Fee_Income" |

---

## Implementation Best Practices

| Area | Best Practice |
|------|---------------|
| **Start with high-impact dims** | Entity and Account first — they drive everything else |
| **Define governance BEFORE tool** | Who approves what? Don't automate a broken process |
| **Keep it simple initially** | Start with basic approval workflow; add complexity after adoption |
| **Align with ERP MDM** | EDM should complement (not replace) ERP master data governance |
| **Automate subscriptions** | Never manually copy dimension changes to target apps |
| **Train data stewards** | They are the primary users; invest in their capability |
| **Regular housekeeping** | Quarterly review of retired members, unused hierarchies |
| **Document naming standards** | Enforce consistently from Day 1 (much harder to fix later) |
| **Plan for restructuring** | Organizations change; design hierarchy for easy reorganization |
| **Version before major changes** | Always create a version snapshot before structural changes |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Subscription export fails | Validation rule violation in target app | Check target app dimension constraints |
| Member not appearing in EPM | Filter in subscription excluding it | Review subscription filter criteria |
| Circular reference error | Member listed as both parent and child | Check hierarchy for cycles; fix parentage |
| Duplicate member error | Same code in multiple viewpoints | Ensure unique codes or use view-specific prefixes |
| Slow approval workflow | Too many approval levels | Simplify: auto-approve low-risk; 1 level for standard |
| Change history lost | Manual edits outside EDM | Enforce all changes through EDM requests (no direct edits in EPM) |
| Property mismatch on export | EDM property type doesn't match target | Verify binding data types (text, number, list) |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| EDM Admin Guide | `docs.oracle.com/en/cloud/saas/enterprise-data-management-cloud/dmcsa/` |
| Dimensions & Hierarchies | `docs.oracle.com/en/cloud/saas/enterprise-data-management-cloud/dmcsa/dimensions.html` |
| Requests & Governance | `docs.oracle.com/en/cloud/saas/enterprise-data-management-cloud/dmcsa/requests.html` |
| Subscriptions | `docs.oracle.com/en/cloud/saas/enterprise-data-management-cloud/dmcsa/subscriptions.html` |
| Validations | `docs.oracle.com/en/cloud/saas/enterprise-data-management-cloud/dmcsa/validations.html` |
| REST API | `docs.oracle.com/en/cloud/saas/enterprise-data-management-cloud/edmra/` |
| Migration from DRM | Oracle MOS Doc ID 2782541.1 |
