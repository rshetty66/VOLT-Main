# PeopleSoft — Migration to Oracle Cloud

Assessment methodology and execution patterns for PeopleSoft-to-Cloud migration.

---

## Migration Decision Framework

### When to Migrate

| Trigger | Signal |
|---------|--------|
| End of support concern | Oracle extended PeopleSoft support through 2032+ but no new features |
| Technical debt | Heavy customizations making upgrades expensive |
| Cost pressure | On-prem infrastructure costs rising (hardware refresh, DBA) |
| Feature gap | Cloud features (AI, analytics, mobile) not available in PeopleSoft |
| M&A integration | Acquiring company on Cloud; need single platform |
| Talent shortage | Harder to find PeopleSoft developers and DBAs |

### When to STAY on PeopleSoft

| Factor | Rationale |
|--------|-----------|
| Heavy customizations working well | Cost of reimplementation may exceed benefit |
| Specialized industry processes | Cloud may not cover niche requirements |
| Recently upgraded (PT 8.59+) | Modernization already invested in |
| Regulatory constraint | Data sovereignty requiring on-prem (mitigated by OCI) |
| Payroll complexity | PeopleSoft NA Payroll may be more capable than Oracle Cloud in some scenarios |

---

## Assessment Phase

### Customization Inventory

| Classification | Description | Cloud Strategy |
|---------------|-------------|----------------|
| **Configuration** | Setup table changes, page personalizations | Usually direct equivalent in Cloud |
| **Bolt-On** | Custom pages/records extending delivered | Redesign as Cloud extension or drop |
| **Modification** | Changes to delivered objects | Must be redesigned (no mods in Cloud) |
| **Integration** | Inbound/outbound interfaces | Redesign using REST API / OIC / FBDI |
| **Report** | SQR, nVision, Crystal, PS Query | Redesign as OTBI / BI Publisher |
| **Workflow** | Approval workflow customizations | Redesign in AME / BPM |

### Data Migration Scope

| Data Category | Typical Decision | Rationale |
|---------------|-----------------|-----------|
| Master data (suppliers, customers, employees) | Migrate (active only) | Required for Day 1 operations |
| Open transactions (AP/AR/POs) | Migrate | Must continue processing |
| GL balances (current year) | Migrate | Starting point for new ledger |
| Historical transactions (1-3 years) | Sometimes migrate | Reporting continuity |
| Historical transactions (3+ years) | Leave in legacy/archive | Not worth the effort; legacy reporting |
| Attachments/documents | Selective | Critical docs only |
| Audit history | Leave in legacy | Compliance archive; read-only access |

---

## Execution Patterns

### Pattern 1: Reimplementation (Recommended for Most)

```
Month 1-3: Assessment + Design
Month 3-8: Cloud Configuration + Build
Month 6-10: Data Migration (3 mock cycles)
Month 8-12: Testing (SIT + UAT + Parallel)
Month 12-14: Training + Cutover + Hypercare
Month 14+: PeopleSoft Decommission
```

### Pattern 2: Lift-and-Shift to OCI

```
Month 1: Assess infrastructure requirements
Month 2-3: Provision OCI compute + database
Month 3-4: Install PeopleSoft on OCI (using DPK)
Month 4-5: Migrate data + test
Month 5-6: Cutover (DNS switch to OCI)
```

### Pattern 3: Coexistence (Phased Module Migration)

```
Phase 1: Cloud GL + AP + AR (Financials First)
  - PeopleSoft Payroll/HCM continues
  - Integration: PS Payroll → Cloud GL (journal feed)

Phase 2: Cloud Procurement + Projects
  - Replace PeopleSoft Purchasing/Projects
  - PeopleSoft HCM still running

Phase 3: Cloud HCM (Final Phase)
  - Replace PeopleSoft HCM with Oracle HCM Cloud
  - Decommission PeopleSoft entirely
```

---

## Key Mapping Decisions

### ChartField → Oracle Cloud COA

| PeopleSoft ChartField | Cloud Mapping Option |
|-----------------------|---------------------|
| Business Unit | Company segment (balancing) |
| Account | Natural Account segment |
| Department | Cost Center segment |
| Fund | Custom segment or value set |
| Program | Custom segment |
| Project | Project module (separate from COA) |
| Class | DFF or custom segment |
| Affiliate | Intercompany segment |

### Security Mapping

| PeopleSoft | Oracle Cloud |
|------------|-------------|
| Role | Job Role |
| Permission List | Duty Role |
| Page access | Privilege |
| Row-Level Security | Data Access Set |
| SetID-based access | Business Unit assignment |
| Process Groups | Scheduled Process privileges |
| Query Access Trees | OTBI subject area access |

---

## Common Migration Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Customization redesign underestimated | Schedule overrun | Thorough customization inventory + sizing |
| Data quality issues in PeopleSoft | Migration delays | Start data profiling in Month 1 |
| Payroll complexity in Cloud | Functional gap | Detailed payroll comparison early |
| User resistance | Low adoption | Start change management early |
| Integration rebuild effort | Budget overrun | Map all integrations; estimate individually |
| Reporting gap (nVision → OTBI) | User frustration | Build critical reports early; train on OTBI |
| Parallel run reveals gaps | Delayed go-live | Allocate 2+ month parallel minimum |
