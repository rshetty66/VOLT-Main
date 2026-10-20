---
name: banking-data-model
description: >
  Finance data model for banks and credit unions: the contract-level entity catalog, granularity
  and key design, GL-to-subledger lineage, and the common information model that Finance, Risk
  and Treasury share. Covers FSDM (Financial Services Data Foundation), FPSL/Bank Analyzer
  entity structures, Accounting Hub source model design, and chart-of-accounts vs dimensional
  design. Activates for data model, entity model, common information model, contract model,
  FSDM, FPSL, Bank Analyzer, subledger design, data foundation, source-to-target mapping,
  data lineage, granularity, chart of accounts, CCOA, dimension design, or reference data.
version: 1.0.0
metadata:
  category: Data Architecture
  industry: Banking
  complexity: High
disable-model-invocation: true
---

# Banking Finance Data Model

## Domain Context

In banking the general ledger is deliberately thin. A GL account holds a balance; the
economics live in the product subledgers — loans, deposits, securities, derivatives,
insurance contracts. Every finance data model decision follows from that: the model must
carry **contract-level** detail and prove it aggregates to the GL, rather than storing
GL balances and trying to explain them afterwards.

Three consequences shape the design:

- **Granularity is a one-way door.** A model built at product-and-currency level cannot
  later answer a customer-level or vintage-level question without a rebuild. Choose the
  grain before the platform.
- **The same contract is described three ways.** Finance needs amortised cost and
  provision, Risk needs exposure and rating, Treasury needs cashflow and rate reset. One
  entity, three attribute sets — not three entities.
- **Reference data is the failure point, not transaction data.** Product hierarchies,
  organisational hierarchies and the chart of accounts change more often than the contract
  structures, and uncontrolled change there breaks every downstream report silently.

---

## Core Entity Catalog

The minimum set for a bank finance data foundation. Names vary by platform; the grain does not.

| Entity | Grain | Carries | Notes |
|---|---|---|---|
| Party | One per legal person/entity | Identifiers, type, jurisdiction, relationship | Customer, counterparty and vendor are roles of Party, not separate entities |
| Contract / Account | One per financial contract | Product, currency, dates, status, party role | The spine. Loan, deposit, facility, security holding and derivative are subtypes |
| Position / Balance | Contract × date | Principal, accrued interest, amortised cost, carrying value | Daily for banking book; must tie to GL by construction |
| Cashflow | Contract × date × flow type | Amount, currency, contractual vs expected | Feeds Treasury and IFRS 9 measurement |
| Transaction / Event | One per business event | Event type, amount, effective and booking dates | The Accounting Hub input; drives event-based accounting |
| Journal | One per accounting entry | Ledger, account, dimensions, debit/credit | Output of the accounting engine, not a source |
| Product | One per product definition | Hierarchy, accounting treatment, rate basis | Reference data; version it |
| Organisation | One per legal/management unit | Legal entity, cost centre, business line, branch | Two hierarchies: legal for statutory, management for internal |
| Chart of Accounts | One per account | Natural account, type, sign, statutory mapping | See dimensional design below |
| Rate / Curve | Curve × tenor × date | FX, index, discount rates | Needed for revaluation and FTP; commonly missing from scope |

**Do not add a separate entity per product.** A loan and a deposit are the same Contract
entity with different subtype attributes. Institutions that model them separately end up
with per-product reconciliation, which is the problem the data foundation exists to remove.

---

## Granularity Decision

State the grain explicitly and get it signed off. The default that survives most
requirements is:

```
Position grain  = Contract × Business Date × Ledger
Cashflow grain  = Contract × Cashflow Date × Flow Type
Journal grain   = Event × Ledger × Account × Full dimension set
```

Test the proposed grain against these four questions before committing:

1. Can it produce the regulatory return at required breakdown without an external file?
2. Can it explain a movement between two dates at contract level?
3. Can it support multi-GAAP — the same contract measured on two bases in the same period?
4. Can it survive a re-organisation, i.e. is the management hierarchy a dimension rather
   than baked into the key?

A "no" to question 3 or 4 is the expensive one. Multi-GAAP retro-fitted requires a second
ledger and a full history restatement.

---

## Dimensional vs Chart-of-Accounts Design

The recurring argument is whether attributes belong in the account code or as dimensions.

| Put in the account code | Put in a dimension |
|---|---|
| Natural account (what it is) | Legal entity, cost centre, business line |
| Statement classification | Product, channel, geography |
| Anything a statutory filing requires by code | Anything used for internal analysis |

The rule: **the account code answers "what", dimensions answer "who/where/which".** A
segmented account string that encodes business line will be rebuilt at the next
re-organisation, and re-org financial statements are an explicit Operational Finance
capability, so a design that cannot restate history has failed a requirement.

Keep a Common Chart of Accounts (CCOA) with local mappings rather than local charts with
a consolidation mapping — the direction of the mapping determines who owns the break.

---

## GL-to-Subledger Lineage

Lineage is a capability, not documentation. Every reported figure must trace to contracts.

```
Contract → Position → Event → Journal → GL Balance → Report

        (reconciles by construction, not by a bridge file)
```

Design requirements for that to hold:

- **A journal carries the key of its source event**, and the event carries the contract id.
  Without this, lineage is reconstructed by matching amounts, which fails on netting.
- **The GL reconciliation is a control, not a process.** If positions aggregate to the GL by
  construction, the reconciliation reports zero and exceptions are genuine breaks. A
  reconciliation that routinely finds differences means the model is not the source.
- **Adjustments are entities too.** Manual and top-side adjustments must be modelled with
  the same dimensions as the entries they adjust, or they become the unexplained residual.

---

## Platform Notes

- **OFSAA / FSDM** — the Financial Services Data Foundation supplies a contract-centric
  model close to the catalog above. Adopt its grain; resist re-modelling. It is shared by
  Operational and Business Finance, which makes it the natural convergence layer.
- **SAP FPSL / Bank Analyzer** — a measurement and subledger engine over its own contract
  model. The mapping effort is dominated by *reference* data, not contracts.
- **Oracle Accounting Hub Cloud Service** — takes events and applies rules to produce
  journals. Its source model design *is* the Event entity above; get the event grain right
  and the rules are straightforward.
- **EPM / EDMCS** — owns hierarchy and reference-data mastering. If reference data is
  mastered in the reporting layer, hierarchy changes will not be reproducible.

---

## Common Failure Modes

| Failure | Symptom | Fix |
|---|---|---|
| Grain too coarse | Every new question needs a new extract | Rebuild at contract grain; no shortcut |
| Product-per-entity modelling | Per-product reconciliations proliferate | Collapse to Contract with subtypes |
| Reference data unversioned | Prior-period reports no longer reproduce | Effective-dated hierarchies, mastered once |
| Hierarchy in the key | Cannot restate after a re-org | Move to dimension |
| Adjustments outside the model | Unexplained residual at close | Model adjustments with full dimensions |
| No rate/curve entity | Revaluation and FTP done in spreadsheets | Add early; it is cheap upfront |

---

## Cross-References

- **banking-tom-design** — the operating model this data layer serves; see its
  `references/convergence-patterns.md` for why the model must be shared
- **references/cross-function-entities.md** — which entities Finance, Risk and Treasury
  each need, and the attribute overlap
- **si-data-architect** — implementation-side architecture and physical design
- **source-to-target-mapping** — mapping method once the target model is agreed
- **master-data-management** — reference-data governance and mastering
- **oracle-ofsaa-wiki** / **sap-fioneer-fpsl** — platform-specific model detail
