# Oracle Narrative Reporting (EPRCS)

Complete implementation reference for Oracle Narrative Reporting.

---

## Module Overview

| Aspect | Detail |
|--------|--------|
| **Full Name** | Narrative Reporting (formerly Enterprise Performance Reporting Cloud Service) |
| **Abbreviation** | EPRCS / Narrative Reporting |
| **Purpose** | Collaborative management reporting, board packs, regulatory filings, integrated commentary |
| **Key Users** | Financial reporting, investor relations, board secretary, CFO office |
| **Typical Implementation** | 6-10 weeks |
| **Replaces (On-Prem)** | Disclosure Management, Financial Reporting (FR Studio for narrative) |

---

## Core Capabilities

| Capability | Description |
|------------|-------------|
| **Report Packages** | Multi-section collaborative documents combining data, text, and charts |
| **Doclets** | Individual document sections (Word, Excel, PowerPoint, PDF) authored by different owners |
| **Data Integration** | Pull live data from EPBCS, FCCS, ARCS, TRCS directly into reports |
| **Reference Doclets** | Reusable content blocks (logos, disclaimers, standard paragraphs) |
| **Workflow & Sign-off** | Author → Review → Approve workflow per doclet with full audit trail |
| **Versioning** | Full version history with compare and rollback |
| **XBRL Tagging** | iXBRL tagging for regulatory filing (SEC, ESEF, OSFI) |
| **Bursting** | Generate entity-specific versions from one template (entity-level board packs) |
| **Collaboration** | Comments, annotations, @mentions, due dates per section |
| **Formatting** | Professional formatting with templates, branding, table of contents |

---

## Report Package Architecture

### Structure

```
Report Package: "Q4 FY26 Board Pack"
├── Table of Contents (auto-generated)
├── Cover Page [Reference Doclet — standard branding]
├── Executive Summary [Word Doclet — CFO authors]
├── Financial Highlights [Excel Doclet — embedded from FCCS data]
├── P&L Commentary [Word Doclet — FP&A authors, EPBCS data embedded]
├── Balance Sheet Analysis [Word Doclet — Controller authors]
├── Cash Flow Statement [Excel Doclet — Treasury authors]
├── Segment Performance [Word Doclet — BU heads author their section]
│   ├── Retail Banking [BU1 Lead]
│   ├── Commercial Banking [BU2 Lead]
│   └── Wealth Management [BU3 Lead]
├── Risk & Compliance [Word Doclet — CRO authors]
├── Capital & Liquidity [Excel Doclet — Treasury]
├── Appendices [Excel Doclets — detailed schedules]
└── Certification Page [Reference Doclet — sign-off attestation]
```

### Doclet Types

| Type | Format | Best For |
|------|--------|----------|
| **Management Reporting** | Word (.docx) | Commentary, narratives, explanations |
| **Financial Data** | Excel (.xlsx) | Tables, schedules, calculations with live data |
| **Presentation** | PowerPoint (.pptx) | Visual summaries, charts for board meetings |
| **Reference** | Word/Excel/PPT | Reusable content (headers, footers, legal disclaimers) |
| **Supplemental** | PDF, any format | Supporting attachments (audit letters, external reports) |

---

## Data Source Integration

### Connecting to EPM Data Sources

| Source | Connection Type | Data Available |
|--------|----------------|---------------|
| **EPBCS** | Native EPM connection | Budget, forecast, actual, variance data |
| **FCCS** | Native EPM connection | Consolidated financials, ICO data, movement data |
| **ARCS** | Native EPM connection | Reconciliation status, compliance metrics |
| **TRCS** | Native EPM connection | Tax provision, ETR, deferred tax |
| **Oracle ERP Cloud** | OTBI/BI Publisher connection | Transactional detail, subledger data |
| **External** | Excel upload or REST API | Market data, competitor data, KPIs from other systems |

### Embedding Data in Doclets

**Excel Doclets with EPM Data:**
1. Open Excel doclet for editing
2. Use Smart View to connect to EPM application
3. Build data retrieval (ad-hoc or form-based)
4. Format as needed (tables, charts)
5. Mark "Available for Embedding" on specific ranges/charts
6. Reference these data points from Word doclets using "Insert → EPM Data Reference"

**Word Doclets with Dynamic Data:**
- Insert data references inline: "Revenue was $[EPBCS:Actual:Revenue:Q4:FY26] vs budget of $[EPBCS:Budget:Revenue:Q4:FY26]"
- Data refreshes automatically when report package is generated
- Supports conditional formatting (red/green on variance direction)

---

## Workflow & Collaboration

### Report Package Lifecycle

```
CREATE ── DEVELOP ── REVIEW ── SIGN-OFF ── PUBLISH ── ARCHIVE
  │           │           │          │            │
  │ Define    │ Authors    │ Reviewers │ Approvers  │ Distribute
  │ structure │ write      │ comment   │ certify    │ final PDF
  │ + assign  │ sections   │ + mark up │ + sign     │ + archive
```

### Phase Details

| Phase | Actions | Responsible |
|-------|---------|-------------|
| **Create** | Define report package structure, assign doclet owners, set due dates | Report coordinator |
| **Develop** | Check out doclets, author content, embed data, check in | Section authors |
| **Review** | Review content, add comments/annotations, request changes | Reviewers (peers + managers) |
| **Sign-Off** | Final approval, electronic certification, audit trail | CFO, Controller, Board Secretary |
| **Publish** | Generate final output (PDF/Word), distribute to stakeholders | Report coordinator |
| **Archive** | Lock package, preserve for audit/compliance, version history | System (automatic) |

### Collaboration Features

| Feature | Description |
|---------|-------------|
| **Check-out / Check-in** | Only one author edits a doclet at a time (prevents conflicts) |
| **Comments** | Inline comments with @mentions; resolve when addressed |
| **Status tracking** | Visual dashboard showing per-doclet completion status |
| **Due dates** | Per-doclet deadlines with email reminders |
| **Notifications** | Email alerts for assignments, reviews, overdue items |
| **Compare versions** | Track-changes view between doclet versions |
| **Delegation** | Authors can delegate to backup if unavailable |

---

## XBRL / iXBRL Reporting

### Supported Taxonomies

| Taxonomy | Jurisdiction | Use Case |
|----------|-------------|----------|
| **US GAAP** | United States (SEC) | 10-K, 10-Q, 8-K filings |
| **IFRS** | International | ESEF reporting (EU), other IFRS jurisdictions |
| **EDINET** | Japan | Japanese securities filings |
| **Custom** | Any | Custom taxonomy for internal or regulatory use |

### XBRL Tagging Process

1. Import taxonomy (US GAAP or IFRS) into Narrative Reporting
2. Open report package section containing financial statements
3. Tag individual data cells to taxonomy concepts
4. Define contexts (period, entity, segment)
5. Validate tagging completeness and accuracy
6. Generate iXBRL output (human-readable HTML with embedded XBRL tags)
7. Run XBRL validation tool before filing

### ESEF (European Single Electronic Format)

For EU-listed entities filing under ESEF:
- Annual financial reports must be in XHTML format with inline XBRL
- Primary financial statements: mandatory detailed tagging
- Notes: block-tagging (less granular)
- Narrative Reporting generates ESEF-compliant output natively

---

## Report Bursting

### Multi-Entity Report Generation

Bursting creates **entity-specific versions** of a report from a single template:

| Feature | Description |
|---------|-------------|
| **Template** | Single report package with POV variables (Entity, Period) |
| **Variable substitution** | Entity name, data, commentary replaced per burst entity |
| **Output** | Separate PDF per entity (e.g., one board pack per subsidiary) |
| **Distribution** | Route each burst output to entity-specific recipients |
| **Personalization** | Section visibility controlled by entity (show/hide sections) |

**Example: Monthly Business Review Burst**
- Template: MBR Report Package (structure, formatting, data references)
- Variables: Entity (Division A, Division B, Division C), Period (Jan FY26)
- Output: 3 separate MBR PDFs, each with entity-specific financial data
- Distribution: Each VP receives only their division's report

---

## Board Pack Production

### Typical Board Pack Structure (Financial Services)

| Section | Content | Data Source | Owner |
|---------|---------|-------------|-------|
| 1. Executive Dashboard | Key metrics, traffic lights, commentary | EPBCS + manual | CFO |
| 2. Financial Performance | Consolidated P&L, variance commentary | FCCS | Controller |
| 3. Balance Sheet & Capital | BS, capital ratios (CET1, Tier 1, Total) | FCCS + regulatory | Treasury |
| 4. Risk Report | Credit, market, operational risk metrics | Risk systems | CRO |
| 5. Business Line Reviews | Per-segment performance and outlook | EPBCS | BU Leaders |
| 6. Regulatory Update | OSFI/OFSI compliance, regulatory changes | Manual | Compliance |
| 7. Strategic Initiatives | Project status, transformation progress | Manual/PMO | Strategy |
| 8. Appendices | Detailed schedules, reconciliations | FCCS/EPBCS/ARCS | Finance |

### Production Timeline (Monthly)

| Day | Activity | Owner |
|-----|----------|-------|
| Close +3 | Data finalized in FCCS/EPBCS; auto-populated into report | System |
| Close +4 | Commentary sections opened for authoring | Section authors |
| Close +5-6 | Authors complete their doclets | Section authors |
| Close +7 | Review cycle opens | Reviewers |
| Close +8 | Review comments resolved, final edits | Authors |
| Close +9 | CFO review and sign-off | CFO |
| Close +10 | Board pack published and distributed | Board Secretary |

---

## Implementation Best Practices

| Area | Best Practice |
|------|---------------|
| **Template design** | Design once, reuse monthly — invest heavily in template quality |
| **Branding** | Use Reference Doclets for logos, headers, footers — change once, update everywhere |
| **Data integration** | Connect to EPM natively; avoid copy-paste from spreadsheets |
| **Ownership clarity** | One owner per doclet; avoid shared responsibility |
| **Due dates** | Set realistic deadlines; build 1-day buffer before final publish |
| **Review efficiency** | Use inline comments (not email) for all review feedback |
| **Version control** | Never work outside the system (no email attachments for review) |
| **Training** | Train section authors on their specific doclet type only |
| **Automation** | Auto-generate recurring data sections; manual only for commentary |
| **Archive policy** | Archive each published version for audit trail (7-year retention typical) |

---

## Common Issues & Troubleshooting

| Issue | Root Cause | Resolution |
|-------|-----------|------------|
| Data not refreshing | Connection to EPM source broken | Re-establish Smart View connection in Excel doclet |
| Doclet locked (can't edit) | Another user has it checked out | Contact user or admin force-unlock |
| Formatting lost on check-in | Word/Excel version incompatibility | Use supported Office version (check compatibility matrix) |
| XBRL validation errors | Missing tags or incorrect contexts | Review validation report; fix tagging |
| Report generation slow | Too many data references refreshing | Limit embedded data points; pre-calculate summaries |
| PDF output formatting broken | Page breaks not set correctly | Set explicit page breaks in source doclets |
| Comments not visible | Filter set to hide resolved comments | Clear comment filter in review panel |

---

## Oracle Documentation Links

| Topic | Oracle Doc Path |
|-------|-----------------|
| Narrative Reporting Admin Guide | `docs.oracle.com/en/cloud/saas/epm-cloud/nradm/` |
| Report Packages | `docs.oracle.com/en/cloud/saas/epm-cloud/nradm/report_packages.html` |
| Doclets | `docs.oracle.com/en/cloud/saas/epm-cloud/nradm/doclets.html` |
| Data Integration | `docs.oracle.com/en/cloud/saas/epm-cloud/nradm/data_sources.html` |
| XBRL | `docs.oracle.com/en/cloud/saas/epm-cloud/nradm/xbrl.html` |
| Bursting | `docs.oracle.com/en/cloud/saas/epm-cloud/nradm/bursting.html` |
| REST API | `docs.oracle.com/en/cloud/saas/epm-cloud/nrapi/` |
