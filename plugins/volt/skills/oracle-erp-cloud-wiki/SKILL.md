---
name: oracle-erp-cloud-wiki
description: >
  Oracle ERP Cloud (Fusion) implementation wiki and LLM knowledge base. Activates when users ask about
  "Oracle ERP Cloud", "Oracle Cloud Financials", "Oracle Fusion", "Oracle GL", "Oracle AP",
  "Oracle AR", "Oracle FA", "Oracle Procurement", "Oracle Projects", "Oracle Cash Management",
  "Oracle Inventory", "Oracle Order Management", "FBDI", "File-Based Data Import",
  "Oracle REST API", "OTBI", "BI Publisher", "ESS jobs", "Oracle flexfields",
  "Oracle lookups", "Oracle SOA", "Oracle Integration Cloud", "OIC",
  "Subledger Accounting", "SLA rules", "Oracle security roles", "Oracle duties",
  "Oracle privileges", "Oracle data access set", "Oracle quarterly update",
  "Oracle Cloud implementation", "Oracle Cloud migration", "EBS to Cloud",
  "E-Business Suite migration", "Oracle Fusion Middleware", "Oracle UCM",
  "Oracle Cloud setup", "Oracle Cloud configuration", "Oracle SOD",
  "Oracle AME", "Approval Management Engine", "Oracle BPM workflow",
  "Oracle Financials close", "Oracle period close", "Oracle consolidation",
  "Oracle intercompany", "Oracle tax engine", "Oracle withholding tax",
  "Oracle supplier management", "Oracle customer management", "Oracle receipts",
  "Oracle payments", "Oracle payment file", "Oracle EFT", "Oracle bank reconciliation",
  or any Oracle ERP Cloud (Fusion) implementation, configuration, or support question.
version: 1.0.0
disable-model-invocation: true
---

# Oracle ERP Cloud (Fusion) — Implementation Wiki & Knowledge Base

Comprehensive implementation reference for Oracle ERP Cloud (Fusion) Financials, Procurement, and Projects. This wiki serves as the authoritative knowledge base for consultants delivering Oracle Cloud ERP implementations.

---

## Module Map

| Module | Purpose | Reference |
|--------|---------|-----------|
| General Ledger (GL) | COA, journals, period close, reporting, consolidation | [gl-subledger-accounting.md](references/gl-subledger-accounting.md) |
| Accounts Payable (AP) | Invoice processing, payments, supplier management | [ap-payables.md](references/ap-payables.md) |
| Accounts Receivable (AR) | Customer invoicing, receipts, collections, revenue | [ar-receivables.md](references/ar-receivables.md) |
| Fixed Assets (FA) | Asset lifecycle, depreciation, CCA/MACRS | [fa-fixed-assets.md](references/fa-fixed-assets.md) |
| Cash Management | Bank statements, reconciliation, cash position | [cash-management.md](references/cash-management.md) |
| Procurement | Requisitions, POs, sourcing, receiving | [procurement-purchasing.md](references/procurement-purchasing.md) |
| Project Financial Management | Costing, billing, budgets, revenue recognition | [project-accounting.md](references/project-accounting.md) |

**Cross-cutting references:**
- [FBDI & Data Migration](references/fbdi-data-migration.md) — File-Based Data Import, conversion methodology
- [Integration Patterns](references/integration-patterns.md) — REST API, OIC, Business Events, SOAP
- [Troubleshooting KB](references/troubleshooting-kb.md) — Common errors, ESS failures, resolution patterns

---

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ORACLE ERP CLOUD (FUSION) PLATFORM                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┐  ┌──────────┐  ┌────────────┐  ┌───────────┐             │
│  │  General   │  │ Accounts │  │  Accounts  │  │   Fixed   │             │
│  │  Ledger    │  │ Payable  │  │ Receivable │  │  Assets   │             │
│  └─────┬──────┘  └────┬─────┘  └─────┬──────┘  └─────┬─────┘             │
│        │               │              │               │                    │
│  ┌─────┴──────┐  ┌────┴─────┐  ┌─────┴──────┐  ┌────┴──────┐            │
│  │   Cash     │  │Procure-  │  │  Projects  │  │ Inventory │            │
│  │ Management │  │  ment    │  │            │  │ & Order   │            │
│  └────────────┘  └──────────┘  └────────────┘  └───────────┘            │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED SERVICES LAYER                            │   │
│  │  • Subledger Accounting (SLA)  • Tax Engine  • Intercompany       │   │
│  │  • AME (Approvals)  • BPM Workflow  • Flexfields  • Lookups       │   │
│  │  • FBDI (File Import)  • ESS (Job Scheduler)  • UCM (Content)     │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                    INTEGRATION & REPORTING                          │   │
│  │  • REST API  • SOAP Services  • Business Events  • BI Publisher   │   │
│  │  • OTBI (Real-time BI)  • Financial Reporting  • Smart View       │   │
│  │  • Oracle Integration Cloud (OIC)  • SOA Composite                │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                    SECURITY & ADMINISTRATION                        │   │
│  │  • Roles → Duties → Privileges  • Data Access Sets                │   │
│  │  • SOD (Segregation of Duties)  • IDCS/IAM  • Audit Policies      │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Model

| Aspect | Detail |
|--------|--------|
| **Hosting** | Oracle Cloud Infrastructure (OCI), multi-tenant SaaS |
| **Updates** | Quarterly (Jan, Apr, Jul, Oct) — mandatory; cannot skip |
| **Environments** | Test + Production standard; DEV/UAT available as add-ons |
| **Data Residency** | Region selection at provisioning |
| **SLA** | 99.5% availability |
| **Maintenance** | Monthly patching window + quarterly feature update |
| **Access** | Browser (responsive UI), REST API, Smart View (Excel), FBDI |

### Environment Strategy

```
DEV (optional) ───Migrate── TEST ───Migrate── PRODUCTION
  │                           │                    │
  │ Config & build            │ SIT & UAT          │ Live operations
  │ Rapid iteration           │ Data validation    │ Period close
  │ Non-prod data             │ Parallel run       │ Locked config
```

---

## Quarterly Update Cadence

Oracle ERP Cloud receives **mandatory quarterly updates** with new features:

| Quarter | Update Month | Test Updated | Prod Updated |
|---------|-------------|--------------|--------------|
| 25A | January | Early Jan | Late Jan |
| 25B | April | Early Apr | Late Apr |
| 25C | July | Early Jul | Late Jul |
| 25D | October | Early Oct | Late Oct |

**Update Readiness Process:**
1. Review Feature Summary document (released ~6 weeks before)
2. Opt-in to features that require activation (some auto-enabled)
3. Test critical business processes in TEST after update
4. Validate integrations (REST API changes, FBDI format changes)
5. Train users on new features being activated
6. Document features deferred to future quarter

---

## Security Model

### Role-Based Access Control (RBAC)

```
USER
  └── ROLE (Job Role)
       └── DUTY ROLE (Business function)
            └── PRIVILEGE (Atomic action: View Invoice, Create PO)
```

### Key Security Concepts

| Concept | Purpose | Example |
|---------|---------|---------|
| **Job Role** | Assigned to user; represents a job function | Accounts Payable Manager |
| **Duty Role** | Collection of related privileges | AP Invoice Processing Duty |
| **Privilege** | Single atomic permission | Create Payables Invoice |
| **Data Role** | Adds data access (BU, ledger) | Access to BU "CAN" only |
| **Data Access Set** | Which ledgers/BUs user can access | Primary Ledger + CAN Business Unit |
| **SOD Rules** | Prevent conflicts (create + approve) | Creator cannot be approver |

### Segregation of Duties (SOD)

| Conflict | Why Risky | Control |
|----------|-----------|---------|
| Create Supplier + Create Payment | Fictitious vendor fraud | Separate roles |
| Create Invoice + Approve Invoice | Self-approval fraud | Approval workflow |
| Create Journal + Post Journal | Unauthorized posting | Approval + posting separation |
| Create PO + Receive Goods | Procurement fraud | Separate receipt role |
| Create Customer + Apply Receipt | Cash misappropriation | Separate roles |

---

## Implementation Methodology (OUM-Based)

### Phase Model (Typical 20-36 Week Implementation)

```
PLAN (Wk 1-4) → ANALYZE (Wk 3-10) → DESIGN (Wk 8-16) → BUILD (Wk 14-24) → TEST (Wk 20-30) → DEPLOY (Wk 28-36)
     │                │                   │                   │                  │                  │

• Project plan    • Current state     • Solution design   • Configure        • SIT/UAT          • Cutover
• Team setup      • Requirements      • Fit-gap analysis  • Data migration   • Performance      • Go-live
• Environments    • Process mapping   • Integration arch  • Integrations     • Parallel run     • Hypercare
• Governance      • Data assessment   • Security model    • Extensions       • User training    • KT
```

---

## Key Shared Platform Capabilities

### FBDI (File-Based Data Import)

Primary mechanism for bulk data loading. See [fbdi-data-migration.md](references/fbdi-data-migration.md).

### REST API

Primary integration method for real-time operations. See [integration-patterns.md](references/integration-patterns.md).

### Flexfields

| Type | Purpose | Example |
|------|---------|---------|
| **Descriptive Flexfield (DFF)** | Additional attributes on standard forms | Extra fields on Invoice header |
| **Extensible Flexfield (EFF)** | Complex multi-row attributes | Item categories, supplier attributes |
| **Key Flexfield (KFF)** | Account combinations (COA) | Chart of Accounts structure |

### ESS (Enterprise Scheduler Service)

All batch processing runs through ESS:
- Scheduled Processes (run reports, import data, run calculations)
- Job sets (chain multiple processes)
- Scheduling (once, recurring, event-based)
- Monitoring (output, log, status)

### Approval Management Engine (AME)

Configurable approval workflow engine:
- Rules based on transaction attributes (amount, category, org)
- Routing: hierarchy, position, job-level, named approver
- Actions: approve, reject, reassign, request info, FYI
- Integration with email and BPM worklist

---

## EBS-to-Cloud Migration Path

### Migration Assessment

| Area | Assessment Questions |
|------|---------------------|
| **Customizations** | How many? Can they be replaced with cloud features? |
| **Integrations** | How many? Which can use pre-built connectors? |
| **Data Volume** | How much history to migrate? What stays in legacy? |
| **Reports** | Which reports need rebuild? Which have OTBI equivalents? |
| **Processes** | Which processes change in cloud? Training impact? |
| **Security** | How does responsibility-based (EBS) map to role-based (Cloud)? |

### Migration Approaches

| Approach | Description | Timeline | Risk |
|----------|-------------|----------|------|
| **Big Bang** | Full cutover in one go | 12-18 months | High (all-or-nothing) |
| **Phased by Module** | GL first, then AP/AR, then Procurement | 18-30 months | Medium |
| **Phased by Entity** | One business unit at a time | 18-36 months | Lower per phase |
| **Coexistence** | Cloud + EBS run simultaneously | Ongoing | Complexity of dual-maintain |

### Key EBS-to-Cloud Differences

| Area | EBS (On-Prem) | Cloud (Fusion) |
|------|---------------|----------------|
| COA | Key Flexfield (rigid once set) | Value Sets + Account Combinations (more flexible) |
| Security | Responsibilities | Roles → Duties → Privileges |
| Reports | Oracle Reports, Discoverer | BI Publisher, OTBI, Financial Reporting |
| Workflows | AME + custom WF | BPM + AME (cloud-native) |
| Customizations | Forms personalization, CEMLI | Page Composer, extensible flexfields, limited |
| Integrations | Concurrent programs, PL/SQL APIs | REST API, FBDI, Business Events |
| Batch Jobs | Concurrent Manager | Enterprise Scheduler Service (ESS) |
| Upgrades | Customer-controlled (annual) | Oracle-controlled (quarterly, mandatory) |

---

## Oracle Documentation Sources

| Resource | URL Pattern | Content |
|----------|-------------|---------|
| ERP Cloud Help Center | `docs.oracle.com/en/cloud/saas/financials/` | Full product documentation |
| Implementation Guides | `docs.oracle.com/en/cloud/saas/financials/24d/` | Per-release guides |
| REST API Reference | `docs.oracle.com/en/cloud/saas/financials/24d/farfa/` | REST endpoint docs |
| FBDI Templates | `docs.oracle.com/en/cloud/saas/financials/24d/oefbf/` | Template downloads |
| Readiness (quarterly updates) | `docs.oracle.com/en/cloud/saas/financials/readiness.html` | Feature release notes |
| My Oracle Support | `support.oracle.com` | SRs, patches, known issues |

---

## Knowledge Base Training Guide

### How to Expand This Wiki

**Adding Oracle Help Center content:**
1. Extract key configuration steps and parameters
2. Add to the module-specific reference file
3. Tag with Oracle release version (e.g., "24D")

**Adding project experience:**
1. Document configuration patterns that worked
2. Add anti-patterns to troubleshooting KB
3. Update FBDI guidance based on real conversion issues

**Tagging convention:**
```
[SOURCE: Oracle-Docs] — from Oracle Help Center
[SOURCE: MOS-{article#}] — from My Oracle Support
[SOURCE: Project] — from implementation experience (never name the client)
[SOURCE: Training] — from Oracle University
```
