---
name: banking-tom-design
description: >
  Target operating model design for a bank, credit union, trust company or other deposit-taking
  institution's finance function. Covers the three-area finance taxonomy (Operational, Business,
  Specialized Finance), Level 2 process decomposition, the retained/CoE/shared-service/outsourced
  sourcing split, org sizing by institution archetype, and Finance-Risk-Treasury convergence.
  Activates for target operating model, TOM, future state operating model, finance operating
  model, credit union, mid-size bank, D-SIB, org design, span of control, centre of excellence,
  shared services, retained finance, finance function redesign, service delivery model,
  RACI, or Finance-Risk-Treasury convergence.
version: 1.0.0
metadata:
  category: Operating Model
  industry: Banking
  complexity: High
disable-model-invocation: true
---

# Banking Finance Target Operating Model

## Domain Context

A banking finance TOM answers four questions in order: **what** the function does (process),
**who** does it (org and sourcing), **on what** (platform and data), and **how it is held to
account** (governance and metrics). Skipping to org charts is the most common failure — headcount
follows the process and sourcing decisions, it does not precede them.

Banks differ from corporates in three ways that shape every TOM:

- **Regulatory reporting is a finance process, not a compliance afterthought.** OSFI returns,
  BCAR/capital, liquidity (LCR/NSFR) and statutory reporting draw on the same ledger and
  subledger data as management reporting, so a TOM that treats them as separate teams
  reconciling to each other institutionalises the break.
- **Finance, Risk and Treasury contend for the same data.** All three need contract-level
  positions, and they historically built separate extracts. Convergence is the largest
  single value lever — see `references/convergence-patterns.md`.
- **The subledger is where the accounting happens.** In banking the GL is thin and the
  product subledgers (loans, deposits, securities, derivatives) carry the detail, so
  operating-model boundaries must be drawn around the subledger, not the GL.

---

## The Three Finance Areas

Use this taxonomy as the process spine. Sequence within an area is presentation order,
not priority.

| # | Operational Finance | Business Finance | Specialized Finance |
|---|---|---|---|
| 1 | General Accounting | Finance Management Reporting | Closed Balance Sheet |
| 2 | System Support | Budgeting | Project Admin |
| 3 | Accounting Policy & Advisory | P&F Guidelines & Policies | Ad-hoc Project Finance Education |
| 4 | Financial Governance & Controls | Business Financial Analysis | Regulatory Compliance |
| 5 | Accounts Payable | Strategic & Long Term Planning | Project Technical Support |
| 6 | Payroll & Benefits Accounting | Regulatory Reporting | Project Analysis Support |
| 7 | Cost Accounting & Allocation | Forecasting & Capital Planning | Cash Inventory Management |
| 8 | Fixed Assets Management | Statutory Reporting | Project Advisory Services |
| 9 | Product Costing & Pricing Support | Treasury Management Reporting | Project Accounting |
| 10 | Tax Accounting | — | Portfolio Advisory Support |

**Operational Finance** is the transaction engine — highest volume, most automatable, the
usual source of FTE reduction. **Business Finance** is the analytical layer and the one
clients most often want to grow. **Specialized Finance** is project and portfolio work,
frequently mis-sized because it sits outside the close calendar.

---

## Sourcing Decision

Assign every Level 2 process to exactly one model. The test is transaction volume against
judgement required, not seniority of the current owner.

| Model | Fits | Banking examples |
|---|---|---|
| Retained | Judgement, regulatory accountability, board-facing | Accounting Policy, Financial Governance & Controls, Regulatory Reporting sign-off |
| Centre of Excellence | Scarce specialist skill, cross-BU demand | Cost Allocation, Product Costing, FTP methodology, IFRS 17/9 technical |
| Shared Service | High volume, rules-based, measurable SLA | Accounts Payable, Payroll Accounting, Fixed Assets, standard journals |
| Outsourced / Managed | Commodity, no proprietary insight | Tax compliance prep, statutory filing mechanics, some System Support |

Two rules that survive contact with clients: never outsource a process whose exceptions you
cannot describe, and never put a regulatory sign-off in a shared service — the accountability
cannot be delegated even where the work can.

---

## Institution Archetypes

Sizing is archetype-dependent. These are planning ranges for a first-pass model, to be
replaced by client actuals; mark any figure carried into a deliverable `[Verify]`.

| Archetype | Typical finance FTE | TOM emphasis |
|---|---|---|
| Credit union / small bank (<$5B assets) | 15–40 | Automation before specialisation; one team spans Operational + Business Finance; regulatory reporting often 1–2 people and the key person risk |
| Mid-size bank / trust ($5–50B) | 40–150 | First real CoE split; shared service becomes viable; Finance-Risk-Treasury data contention starts to bite |
| Large bank / D-SIB (>$50B) | 150–1,000+ | Full three-area separation, multiple CoEs, dedicated regulatory reporting function, convergence programme mandatory |

A credit union TOM is not a scaled-down D-SIB TOM. Below roughly 40 finance FTE the CoE
layer costs more than it returns, and the right answer is usually platform automation plus
a managed service for the commodity tail.

---

## Capability Baseline

The target state must be able to do these. Treat as an assessment checklist — score
current/target, and let gaps drive the roadmap.

**Operational Finance (16):** Multi-Ledger Strategy, Automated Postings, CCOA & Hierarchy
Management, Multi-GAAP Ledgers, Event Based Accounting, Subledger Transaction Level Detail,
Account Reconciliation, Intercompany Posting, Real-Time vs Batch Ledger, Multi-Currency
Ledgers, Lineage/Traceability, Metadata Reporting, Re-Org Financial Statements,
Consolidations, Common Finance Information Model, Data Quality.

**Business Finance (12):** Data Quality, Common Data Foundation, Non-Financial Data
Integration, Data Governance, Multi-Dimensional Segment Reporting, Driver-Based Planning,
Rolling Forecasts, Funds Transfer Pricing, Data Foundation Reconciled to GL, Driver-Based
Allocations, Rules-Based Allocations, Profitability Reporting.

**Specialized Finance (3):** Automated Regulatory Compliance, Cash Management, Reconciliation.

**Data Quality is the only capability in two areas.** That is the sequencing argument:
Business Finance leads with four data capabilities before any analytical one, so a P&F
build ahead of the data foundation will be rebuilt.

---

## Platform Mapping (Oracle)

Where the client is on an Oracle stack, the platform question is largely settled by area:

- **Operational Finance** — OFSAA (Financial Services Data Foundation, GL Reconciliation,
  Data Integration Hub); ERP (Accounts Payable, Financial Accounting, General Ledger,
  Accounting Hub Cloud Service); EPM (Financial Consolidation, Enterprise Data Management,
  Analytics Cloud, Profitability & Cost Management).
- **Business Finance** — OFSAA (Data Foundation, GL Reconciliation, Data Integration Hub,
  Profitability); EPM (Planning & Budgeting, Analytics Cloud, Regulatory Reporting).
- **Specialized Finance** — EPM (Analytics Cloud); ERP (Project Accounting).

Note the asymmetry before repeating it as an error: the OFSAA data foundation trio is shared
by Operational and Business Finance; Profitability sits under OFSAA for Business Finance but
Profitability & Cost Management sits under EPM for Operational Finance.

---

## Deliverable Structure

A TOM engagement produces, in order:

1. **Process taxonomy** — Level 1/2 decomposition against the three areas, with current
   owner and volume per Level 2.
2. **Capability assessment** — current vs target score on the baseline above, gap-ranked.
3. **Sourcing model** — every Level 2 assigned retained/CoE/SSC/outsourced, with rationale.
4. **Org design** — structure, spans and layers, role profiles, FTE by area and location.
5. **Governance** — RACI at Level 2, decision rights, service levels, KPI set.
6. **Roadmap** — sequenced waves with the data foundation ahead of analytics.

---

## Cross-References

- **banking-data-model** — the entity and contract model the TOM's data layer assumes
- **finance-transformation-core** — generic FT method; this skill supplies the banking specifics
- **osfi-regulatory-expert** — regulatory reporting process content and OSFI return inventory
- **si-finance-process-lead** — process design execution during implementation
- **kpi-value-realization** — the KPI set and benefits case for the governance layer
