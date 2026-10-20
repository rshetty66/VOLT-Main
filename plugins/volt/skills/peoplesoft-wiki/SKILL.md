---
name: peoplesoft-wiki
description: >
  Oracle PeopleSoft implementation wiki and LLM knowledge base. Activates when users ask about
  "PeopleSoft", "PeopleSoft Financials", "PeopleSoft HCM", "PeopleSoft FSCM",
  "PeopleSoft GL", "PeopleSoft AP", "PeopleSoft AR", "PeopleSoft AM",
  "PeopleSoft migration", "PeopleSoft to Cloud", "PeopleSoft upgrade",
  "PeopleTools", "PeopleCode", "nVision", "PS Query", "Application Engine",
  "Component Interface", "Integration Broker", "PeopleSoft Campus Solutions",
  "PeopleSoft 9.2", "PeopleSoft Image", "PIA", "PeopleSoft Fluid",
  "PeopleSoft security", "PeopleSoft roles", "permission lists",
  "PeopleSoft Payroll", "PeopleSoft Benefits", "PeopleSoft Time Labor",
  "PeopleSoft Recruiting", "PeopleSoft Talent", "PeopleSoft ePerformance",
  "PeopleSoft Billing", "PeopleSoft Projects", "PeopleSoft Procurement",
  "PeopleSoft Inventory", "PeopleSoft Expenses", "PeopleSoft Treasury",
  "Commitment Control", "ChartFields", "SQR", "PeopleSoft DPK",
  "Selective Adoption", "PeopleSoft coexistence", "PeopleSoft lift and shift",
  or any PeopleSoft implementation, configuration, migration, or support question.
version: 1.0.0
disable-model-invocation: true
---

# Oracle PeopleSoft — Implementation Wiki & Knowledge Base

Comprehensive implementation reference for Oracle PeopleSoft FSCM, HCM, and Campus Solutions. Covers configuration, PeopleTools development, integration patterns, security, and migration to Oracle Cloud.

---

## Module Map

### FSCM (Financial Supply Chain Management)

| Module | Purpose | Reference |
|--------|---------|-----------|
| General Ledger | ChartFields, journals, nVision, allocations, consolidation | [fscm-financials.md](references/fscm-financials.md) |
| Accounts Payable | Vouchers, payments, 1099/T4A, matching | [fscm-financials.md](references/fscm-financials.md) |
| Accounts Receivable | Items, deposits, cash application, collections | [fscm-financials.md](references/fscm-financials.md) |
| Asset Management | Asset lifecycle, depreciation, CCA | [fscm-financials.md](references/fscm-financials.md) |
| Billing | Customer billing, rate-based, milestone | [fscm-financials.md](references/fscm-financials.md) |
| Projects | Project costing, billing, budgets, grants | [fscm-financials.md](references/fscm-financials.md) |
| Procurement | Requisitions, POs, sourcing, receiving | [fscm-financials.md](references/fscm-financials.md) |
| Expenses | Employee expenses, travel, credit cards | [fscm-financials.md](references/fscm-financials.md) |
| Treasury | Cash management, deals, bank rec | [fscm-financials.md](references/fscm-financials.md) |

### HCM (Human Capital Management)

| Module | Purpose | Reference |
|--------|---------|-----------|
| Core HR | Employee records, positions, organizations | [hcm-human-capital.md](references/hcm-human-capital.md) |
| Benefits | Health, dental, life, RRSP, COBRA | [hcm-human-capital.md](references/hcm-human-capital.md) |
| Payroll (NA) | Canadian/US payroll, CPP/EI, T4/W2, ROE | [hcm-human-capital.md](references/hcm-human-capital.md) |
| Time & Labor | Time entry, approval, costing | [hcm-human-capital.md](references/hcm-human-capital.md) |
| Recruiting | Requisitions, applicants, hiring | [hcm-human-capital.md](references/hcm-human-capital.md) |
| Talent/ePerformance | Performance reviews, goals, succession | [hcm-human-capital.md](references/hcm-human-capital.md) |
| Compensation | Salary planning, merit, equity | [hcm-human-capital.md](references/hcm-human-capital.md) |

**Cross-cutting references:**
- [PeopleTools Development](references/peopletools-development.md)
- [Integration Broker](references/integration-broker.md)
- [Migration to Cloud](references/migration-to-cloud.md)
- [Troubleshooting KB](references/troubleshooting-kb.md)

---

## Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PEOPLESOFT ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      PIA (Web Tier)                              │   │
│  │  WebLogic / WebSphere  •  PeopleSoft Internet Architecture      │   │
│  │  Classic UI + Fluid UI  •  Mobile-responsive pages              │   │
│  └─────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────┴───────────────────────────────┐   │
│  │                   APPLICATION SERVER (Tuxedo)                    │   │
│  │  • PeopleCode execution  • Component Processor  • SQL access    │   │
│  │  • Integration Broker    • Security validation  • Cache mgmt    │   │
│  └─────────────────────────────────┬───────────────────────────────┘   │
│                                    │                                    │
│  ┌───────────────────┐  ┌─────────┴──────────┐  ┌─────────────────┐  │
│  │  PROCESS SCHEDULER │  │   DATABASE SERVER   │  │  ELASTIC SEARCH │  │
│  │  • SQR reports     │  │   (Oracle DB /      │  │  • Global Search│  │
│  │  • App Engine      │  │    SQL Server /     │  │  • Kibana       │  │
│  │  • nVision         │  │    DB2)             │  │                 │  │
│  │  • Crystal Reports │  │                     │  │                 │  │
│  └───────────────────┘  └─────────────────────┘  └─────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    INTEGRATION BROKER                            │   │
│  │  • Service Operations  • Pub/Sub messaging  • REST/SOAP         │   │
│  │  • Connectors (HTTP, FTP, JMS, SMTP)  • Transformations         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## PeopleTools Technology Stack

| Component | Purpose | Version |
|-----------|---------|---------|
| **PeopleTools** | Development platform and runtime | 8.59+ (current) |
| **PIA** | Web tier (PeopleSoft Internet Architecture) | Browser-based UI |
| **Application Designer** | IDE for building pages, records, PeopleCode | Windows client |
| **PeopleCode** | Proprietary scripting language | Object-oriented, event-driven |
| **Application Engine** | Batch processing framework | SQL + PeopleCode steps |
| **SQR** | Reporting language (legacy) | Structured Query Reporter |
| **nVision** | GL reporting in Excel | Excel-based with PS Query |
| **PS Query** | Ad-hoc query and reporting | Browser-based query builder |
| **Integration Broker** | Middleware (messaging, web services) | Pub/Sub + request/response |
| **Component Interface** | Programmatic access to pages | API wrapper around components |
| **Fluid UI** | Modern responsive interface | HTML5, mobile-optimized |
| **Kibana / Elastic Search** | Global search and analytics | PeopleTools 8.55+ |

---

## Security Model

### Role-Based Security

```
USER (OPRID)
  └── ROLE
       └── PERMISSION LIST
            ├── PAGE ACCESS (components/pages user can see)
            ├── PROCESS SECURITY (reports/processes user can run)
            ├── SIGN-ON TIMES (when user can access)
            └── ROW-LEVEL SECURITY (which data rows visible)
```

### Key Security Objects

| Object | Purpose | Example |
|--------|---------|---------|
| **Role** | Collection of permissions assigned to user | AP_CLERK, GL_MANAGER |
| **Permission List** | Access to pages, processes, data | FPAP1000 (AP Pages) |
| **Row-Level Security** | Restrict data by BU, Dept, SetID | See only your BU's data |
| **Query Security** | Which query tables/views accessible | Financial data trees |
| **Process Groups** | Which batch processes user can run | AP_PAYMENTS, GL_CLOSE |

---

## Deployment & Patching

### PeopleSoft Image / Selective Adoption

| Concept | Description |
|---------|-------------|
| **PeopleSoft Image** | Pre-built VM with latest PeopleSoft release (updated quarterly) |
| **Selective Adoption** | Choose which updates to apply (not forced like Cloud) |
| **DPK (Deployment Package)** | Puppet-based automated deployment scripts |
| **PUM (PeopleSoft Update Manager)** | Tool to compare, select, and apply updates |
| **Change Assistant** | Execute deployment steps in sequence |

### Upgrade Path

```
Current Version → Download Latest PeopleSoft Image
  → Compare using PUM (identify changes)
    → Select applicable updates
      → Apply via Change Assistant
        → Test in DEV/TEST
          → Promote to PRODUCTION
```

---

## PeopleSoft to Oracle Cloud Migration

### Migration Options

| Option | Description | Timeline | Effort |
|--------|-------------|----------|--------|
| **Reimplementation** | Greenfield Cloud build, PeopleSoft decommissioned | 12-24 months | High |
| **Lift-and-Shift** | Move PeopleSoft to OCI (IaaS), no functional change | 3-6 months | Low |
| **Coexistence** | Cloud + PeopleSoft run together (hybrid) | Phased (12-36 months) | Medium |
| **Module-by-Module** | Migrate one module at a time to Cloud | 18-36 months | Medium |

### Module Mapping (PeopleSoft → Oracle Cloud)

| PeopleSoft Module | Oracle Cloud Equivalent |
|-------------------|------------------------|
| GL | Oracle GL Cloud |
| AP | Oracle Payables Cloud |
| AR | Oracle Receivables Cloud |
| AM | Oracle Assets Cloud |
| Procurement | Oracle Procurement Cloud |
| Projects | Oracle Project Financial Management |
| Expenses | Oracle Expenses Cloud |
| Billing | Oracle Receivables / Subscription Management |
| Treasury | Oracle Cash Management Cloud |
| Core HR | Oracle HCM Cloud |
| Benefits | Oracle Benefits Cloud |
| Payroll | Oracle Payroll Cloud |
| Time & Labor | Oracle Time and Labor Cloud |
| Recruiting | Oracle Recruiting Cloud |
| Talent | Oracle Talent Management Cloud |

### Migration Assessment Checklist

1. Inventory all customizations (bolt-ons, PeopleCode mods, SQR reports)
2. Map custom fields to Cloud flexfields
3. Identify integrations and their Cloud equivalents
4. Assess data volume and historical data strategy
5. Map PeopleSoft security to Cloud RBAC
6. Identify process changes (what works differently in Cloud)
7. Plan change management and training
8. Build business case (TCO comparison over 5 years)

---

## Knowledge Base Training Guide

### How to Expand This Wiki

- Add PeopleCode patterns to `peopletools-development.md`
- Add Integration Broker configurations to `integration-broker.md`
- Document migration lessons learned in `migration-to-cloud.md`
- Add module-specific troubleshooting to `troubleshooting-kb.md`

**Tagging convention:**
```
[SOURCE: Oracle-Docs] — from PeopleSoft Online Help or PeopleBooks
[SOURCE: MOS-{article#}] — from My Oracle Support
[SOURCE: Project] — from implementation experience (never name the client)
[SOURCE: PUM-{image#}] — from PeopleSoft Image release notes
```
