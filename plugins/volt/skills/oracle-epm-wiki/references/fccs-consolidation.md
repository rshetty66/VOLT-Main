# Oracle FCCS — Financial Consolidation and Close Cloud Service

Complete implementation reference for Oracle Financial Consolidation and Close Cloud Service (FCCS).

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Financial Consolidation and Close Cloud Service |
| **Abbreviation** | FCCS |
| **Purpose** | Statutory & management consolidation, intercompany elimination, currency translation, close management |
| **Cube Engine** | Essbase Hybrid (multi-cube architecture) |
| **Key Users** | Corporate accounting, consolidation team, controllers, external reporting |
| **Typical Implementation** | 16-24 weeks (complex multi-entity); 10-14 weeks (simple <20 entities) |
| **Replaces (On-Prem)** | Hyperion Financial Management (HFM) |

---

## FCCS Application Types

FCCS offers two application types — choose at provisioning:

| Type | Use Case | Capabilities |
|------|----------|-------------|
| **Standard** | Multi-entity consolidation with all features | Full FCCS feature set (consolidation, ICO, journals, close manager) |
| **Enterprise** | Simple consolidation + planning in one app | Consolidation + basic planning (combines FCCS + EPBCS features) |

**When to choose Standard vs Enterprise:**
- **Standard**: >10 entities, complex ownership, statutory/regulatory requirements, dedicated consolidation team
- **Enterprise**: <10 entities, need basic planning + consolidation in one application, simpler deployments

---

## FCCS Dimension Architecture

### Required Dimensions (System-Managed)

| Dimension | Purpose | Key Members |
|-----------|---------|-------------|
| **Scenario** | Data categorization | Actual, Budget, Forecast (user-defined) |
| **Year** | Fiscal year | System-generated calendar |
| **Period** | Reporting period | Monthly (standard); supports weekly/quarterly |
| **Entity** | Legal entities + org hierarchy | Company codes; parent nodes for consolidation |
| **Account** | Financial accounts | P&L, BS, CF accounts; system accounts for consolidation |
| **Currency** | Reporting currencies | Entity currency + group reporting currency(ies) |
| **Consolidation** | Consolidation process dimension | Entity Input, Proportion, Elimination, Contribution (system-managed) |
| **Intercompany** | ICO partner tracking | ICP_None + entity members mirrored |
| **Movement** | Balance roll-forward | Opening, Additions, Disposals, Reclass, FX, Closing |
| **Data Source** | Data origin | Total Data Source, FCCS_Managed, Manual (system-managed) |
| **Multi-GAAP** | Reporting framework | IFRS, Local GAAP, US GAAP (if multi-framework) |

### Custom Dimensions (User-Defined)

| Typical Custom Dims | Purpose | Example |
|--------------------|---------|---------|
| **Product/Segment** | Segment reporting (IFRS 8) | Business segments for disclosure |
| **Function** | Functional reporting | Cost of Sales, Selling, Admin (for nature-to-function) |
| **Project** | Project tracking | Capital projects, restructuring |

---

## Consolidation Process

### Consolidation Steps (Executed in Order)

```
1. Data Load (Actuals from ERP)

2. Journals (Manual adjustments, top-side entries)

3. Intercompany Matching (ICO balances reconciliation)

4. Intercompany Elimination (Automated elimination entries)

5. Ownership Adjustments (Minority interest, equity method)

6. Currency Translation (Local → reporting currency)

7. Consolidation (Roll-up through entity hierarchy)

8. Validation & Review (Control totals, variance checks)

9. Close & Lock (Prevent further changes)
```

### Consolidation Methods

| Method | When Used | FCCS Configuration |
|--------|-----------|-------------------|
| **Full Consolidation** | >50% ownership (subsidiaries) | Ownership% applied; full elimination; NCI calculated |
| **Proportional Consolidation** | Joint ventures (rare under IFRS) | Line-by-line proportional inclusion |
| **Equity Method** | 20-50% ownership (associates) | Single-line equity pickup; no line-by-line |
| **Not Consolidated** | <20% ownership (investments) | Fair value or cost method; no consolidation |

### Ownership Management

FCCS manages **complex ownership structures** including:

| Feature | Description |
|---------|-------------|
| Direct ownership | Parent owns X% of subsidiary directly |
| Indirect ownership | Multi-tier: Parent → Sub → Sub-sub |
| Cross-ownership | Circular holdings (requires iterative calc) |
| Changes in ownership | Acquisition, disposal, step acquisition mid-period |
| Non-controlling interest (NCI) | Automatic minority interest calculation |
| Goodwill tracking | Acquisition cost vs fair value of net assets |

**Ownership Configuration:**
1. Create ownership entity hierarchy (mirrors legal structure)
2. Set ownership percentages per relationship
3. Define effective ownership date (for mid-period changes)
4. Set consolidation method per entity (Full/Proportional/Equity/None)
5. Configure NCI calculation (proportional vs fair value method)

---

## Intercompany (ICO) Processing

### ICO Matching Process

| Step | Action | System Behavior |
|------|--------|-----------------|
| 1 | Load ICO-tagged data (both sides) | Data lands with ICP dimension populated |
| 2 | Run ICO matching | System compares Entity A→Entity B with Entity B→Entity A |
| 3 | Review matching results | Dashboard shows matched, unmatched, threshold breaks |
| 4 | Resolve differences | Manual adjustment or automated by threshold rule |
| 5 | Run ICO elimination | Matched amounts eliminated in consolidation |

### ICO Elimination Rules

| Transaction Type | Debit Account (Elim) | Credit Account (Elim) | Condition |
|-----------------|---------------------|----------------------|-----------|
| Intercompany revenue/COGS | ICO Revenue | ICO Expense | Matched |
| Intercompany loan | ICO Loan Receivable | ICO Loan Payable | Matched |
| Intercompany dividend | ICO Dividend Income | ICO Dividend Paid | Matched |
| Intercompany investment | ICO Investment | ICO Equity | At consolidation |
| Unrealized profit on IC sale | ICO Revenue | Inventory/Fixed Assets | Downstream/upstream adjustment |

### ICO Configuration Best Practices

1. **Design ICO accounts in pairs** — Revenue/Expense, Receivable/Payable, Investment/Equity
2. **Set matching tolerance** — Typically ±$100 or ±0.01% for FX rounding
3. **Automate matching** — Use auto-match rules for amounts within tolerance
4. **Track unmatched items** — Dashboard alert for items exceeding threshold
5. **Timing differences** — Define handling for month-end cutoff differences (plug account)
6. **Multi-currency ICO** — Agree on which entity's rate to use for elimination

---

## Currency Translation

### Translation Methods (ASC 830 / IAS 21)

| Item Type | Method | Rate Used |
|-----------|--------|-----------|
| **Income statement** | Average rate | Period average exchange rate |
| **Balance sheet (monetary)** | Closing rate | Period-end exchange rate |
| **Balance sheet (non-monetary)** | Historical rate | Rate at acquisition/transaction date |
| **Equity** | Historical rate | Original contribution/retained rate |
| **CTA (Cumulative Translation Adj)** | Calculated | Balancing entry to equity |

### Rate Table Configuration

| Rate Type | Source | Frequency | Storage |
|-----------|--------|-----------|---------|
| **Closing Rate** | Treasury / Central bank | Monthly (period-end) | Entity=Rates, Period=current |
| **Average Rate** | Calculated or manual | Monthly | Can be simple average of opening+closing |
| **Historical Rate** | Fixed at event date | As-needed | Stored per equity/fixed asset acquisition |

**Rate Loading Example (flat file format):**
```csv
Scenario,Year,Period,Entity,Account,Currency,Amount
Actual,FY26,Jan,Rates,Rate_Closing,USD,1.3542
Actual,FY26,Jan,Rates,Rate_Average,USD,1.3498
Actual,FY26,Jan,Rates,Rate_Closing,GBP,1.7123
Actual,FY26,Jan,Rates,Rate_Average,GBP,1.7054
```

### Translation Configuration Steps

1. Define **functional currency** per entity (Entity Properties → Default Currency)
2. Define **reporting currency(ies)** (application-level; typically parent currency)
3. Configure rate table (Entity where rates are stored)
4. Assign translation method per account type (Income/Expense=Average, Asset/Liability=Closing, Equity=Historical)
5. Define CTA target account (Equity section)
6. Handle rate exceptions (certain BS items at historical — e.g., Fixed Assets, Goodwill)

---

## Close Management (Task Manager)

### Close Task Manager Features

| Feature | Description |
|---------|-------------|
| **Close calendar** | Visual calendar with all close tasks, dependencies, SLAs |
| **Task types** | System (automated), Manual, Review, Compliance |
| **Dependencies** | Predecessor/successor relationships between tasks |
| **Assignments** | Task owner, reviewer, backup; by role or named user |
| **Status tracking** | Not Started → In Progress → Completed → Approved → Closed |
| **SLA monitoring** | Due dates with warning (amber) and overdue (red) indicators |
| **Email notifications** | Automated reminders, escalations, completion alerts |
| **Dashboard** | Executive view: % complete, open items, blockers |
| **Templates** | Reusable close templates (copy from prior period) |

### Typical Close Task Sequence

| Day | Task Group | Key Activities |
|-----|-----------|----------------|
| Day 1 | **Preliminary** | Sub-ledger close, AP/AR cutoff verification |
| Day 2 | **Data Load** | GL trial balance load, validation, reconciliation to source |
| Day 3 | **Adjustments** | Manual journals, accruals, reclassifications |
| Day 3 | **ICO Matching** | Intercompany reconciliation, difference resolution |
| Day 4 | **Consolidation** | Run consolidation, ownership adjustments, eliminations |
| Day 4 | **Translation** | Currency translation, CTA verification |
| Day 5 | **Validation** | Control checks, variance analysis, flux analysis |
| Day 5 | **Reporting** | Generate statutory reports, board pack data, disclosures |
| Day 6 | **Review & Sign-off** | Controller review, CFO sign-off, lock period |

### Task Manager Configuration

```yaml
# Example close template structure
Template: Monthly_Close_Q1
Schedule: Repeating (Monthly, Business Day offset from period end)
Tasks:
  - name: "Load GL Trial Balance"
    type: System
    day_offset: +1
    owner_role: Data_Integration_Team
    dependency: None
    automation: EPM_Automate_Job "GL_Load_Rule"

  - name: "Validate Data Load"
    type: Manual
    day_offset: +2
    owner_role: Consolidation_Analyst
    dependency: "Load GL Trial Balance"
    instructions: "Run control total report. Compare FCCS totals to ERP TB."

  - name: "Post Manual Journals"
    type: Manual
    day_offset: +3
    owner_role: Corporate_Accounting
    dependency: "Validate Data Load"

  - name: "Run ICO Matching"
    type: System
    day_offset: +3
    owner_role: ICO_Analyst
    dependency: "Post Manual Journals"
    automation: EPM_Automate_Job "ICO_Match_Rule"

  - name: "Run Consolidation"
    type: System
    day_offset: +4
    owner_role: Consolidation_Manager
    dependency: "Run ICO Matching"
    automation: EPM_Automate_Job "Consolidate_All"

  - name: "CFO Review and Sign-off"
    type: Review
    day_offset: +6
    owner_role: CFO
    dependency: "Run Consolidation"
    sign_off_required: true
```

---

## Journals in FCCS

### Journal Types

| Type | Purpose | Approval Required? |
|------|---------|-------------------|
| **Regular** | Period adjustments, accruals | Per configuration |
| **Recurring** | Auto-post each period (e.g., amortization) | Set once; auto-posts |
| **Auto-reversal** | Reverse automatically in next period | Accruals that reverse |
| **Top-side** | Management adjustments at parent level | Always (audit sensitivity) |
| **Elimination** | Manual ICO elimination (if auto doesn't cover) | Always |
| **Reclassification** | Move amounts between accounts | Per configuration |

### Journal Configuration
1. Define journal templates (common journal patterns)
2. Set approval workflows (poster → reviewer → approver)
3. Configure period-based restrictions (no journals to closed periods)
4. Set up journal numbering scheme
5. Define balancing rules (journals must balance by entity, or allow cross-entity)
6. Configure audit trail (all journals logged with user, date, reason)

---

## Supplemental Data Manager

For collecting **non-financial data** (disclosures, commentary, compliance attestations) alongside consolidation:

| Feature | Description |
|---------|-------------|
| **Custom forms** | Design collection forms for any data type |
| **Workflow** | Submit → Review → Approve lifecycle per form |
| **Attachments** | Support documentation uploaded per submission |
| **Integration** | Data flows into Narrative Reporting for board packs |
| **Audit trail** | Full history of submissions, changes, approvals |
| **Templates** | Quarter-end disclosure checklists, compliance attestation |

---

## FCCS vs HFM Migration Considerations

| HFM Feature | FCCS Equivalent | Migration Impact |
|-------------|-----------------|-----------------|
| VB rules | Groovy rules or configurable rules | Complete rewrite for VB-heavy apps |
| Member lists | N/A (use substitution variables) | Redesign rule logic |
| Custom consolidation methods | Configurable consolidation | Usually available; test edge cases |
| Custom dimensions (10+) | Max ~8-12 custom dims | May need dimension consolidation |
| Data Audit (cell-level) | Audit trail + journals | Similar but different UX |
| Extended Analytics | FCCS Reporting + Narrative Reporting | Migration to new reporting framework |
| Process Control (close) | Close Manager (native) | Feature parity; migration path exists |
| Financial Reporting (FR) | FR Cloud or Narrative Reporting | Mostly automated migration |
| Intercompany Transactions | ICO Matching (native) | Enhanced capabilities in FCCS |
| Metadata load (HAL files) | REST API or import files | Different format; automated tools exist |

---

## Performance Optimization

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Slow consolidation | Too many entities with full calc | Use incremental consolidation (only changed entities) |
| Slow translation | All entities translated every run | Translate only entities with new/changed data |
| Slow ICO matching | Large volume of ICO transactions | Use auto-match rules with tolerance thresholds |
| Slow data load | Large file with full replace | Use incremental load (changes only); partition files |
| Slow reports | Complex member functions in FR | Pre-calculate totals; optimize member selections |
| Slow close manager load | Hundreds of tasks per period | Archive old periods; template only current quarter |

---

## Regulatory & Compliance Reporting

| Reporting Need | FCCS Capability |
|---------------|----------------|
| IFRS Consolidated FS | Standard consolidation with IFRS-compliant translation |
| US GAAP Reporting | Multi-GAAP dimension (run consolidation under each framework) |
| Segment Reporting (IFRS 8) | Custom dimension for segments; elimination at segment level |
| Related Party Disclosures | ICO data provides related-party transaction detail |
| EPS Calculation | Calculated accounts with share data |
| Cash Flow (Indirect) | Movement dimension with configurable CF mapping |
| Statutory Filings (local) | Per-entity reports in local GAAP with translation to group |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| FCCS Admin Guide | `docs.oracle.com/en/cloud/saas/financial-consolidation-cloud/agfcc/` |
| Consolidation Rules | `docs.oracle.com/en/cloud/saas/financial-consolidation-cloud/agfcc/working_with_consolidation.html` |
| ICO Processing | `docs.oracle.com/en/cloud/saas/financial-consolidation-cloud/agfcc/intercompany_transactions.html` |
| Currency Translation | `docs.oracle.com/en/cloud/saas/financial-consolidation-cloud/agfcc/currency_translation.html` |
| Close Manager | `docs.oracle.com/en/cloud/saas/financial-consolidation-cloud/agfcc/close_manager.html` |
| Journals | `docs.oracle.com/en/cloud/saas/financial-consolidation-cloud/agfcc/working_with_journals.html` |
| Ownership Management | `docs.oracle.com/en/cloud/saas/financial-consolidation-cloud/agfcc/ownership_management.html` |
| REST API | `docs.oracle.com/en/cloud/saas/financial-consolidation-cloud/fcapi/` |
| Migration from HFM | Oracle MOS Doc ID 2663862.1 |
