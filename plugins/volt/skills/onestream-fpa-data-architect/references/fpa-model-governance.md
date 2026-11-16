# FP&A Model Governance, Controls and Testing

Tags: `[V]` cross-checked, `[D]` design recommendation, `[R]` regulation or standard to confirm for the jurisdiction and
date. This is design guidance, not legal or audit advice; the client's model risk, internal audit and external audit
functions decide what applies.

## 1. Regulatory and standards frame

| Reference | Relevance | Status |
|---|---|---|
| OSFI Guideline E-23, Model Risk Management | Enterprise-wide model risk for federally regulated financial institutions; broad model definition that includes AI and machine learning; third-party and vendor models handled under B-10. Final version published 11 September 2025, effective 1 May 2027 | `[V]` |
| OSFI B-10 (third-party risk) and B-13 (technology and cyber risk) | SaaS EPM, integration gateways and cloud data platforms | `[R]` confirm effective dates and scope |
| US Federal Reserve and OCC SR 11-7 (model risk management) | Model development, validation and governance in US banks | `[R]` |
| UK PRA SS1/23 | Model risk management principles for UK banks | `[R]` |
| SOX 404 and equivalents (ICFR) | Consolidation, close, manual journals and key reports used in financial reporting | `[R]` |
| FAST modelling standard and similar practice codes | Spreadsheet and model design discipline | `[R]` |
| ISAE 3402, SOC 1 and SOC 2 reports | Assurance over the SaaS provider's controls | `[R]` request from the vendor |

Check today's text and the client's regulator before citing any of these in a deliverable.

## 2. Scope: what is a model, what is ICFR

| Artefact | Treat as | Typical tier `[D]` |
|---|---|---|
| Driver-based P&L, balance sheet, capital forecast | Model | Medium to high (used for decisions and external guidance) |
| Stress scenario P&L and capital | Model | High (supervisory and board use) |
| Allocation rules and FTP | Model or methodology | Medium (decisions and pricing) |
| Statistical or ML forecast baseline | Model (AI or ML) | Per E-23 style tiering; high if material |
| Consolidation and translation logic | ICFR control environment, also a model of accounting policy | Key control; ITGC and application controls |
| Rule-based mappings and validations | Application control | Covered by change control and testing |
| Reports used in financial reporting | Information produced by the entity (IPE) | Key report; completeness and accuracy evidence |

Planning is usually not ICFR unless its outputs feed estimates in financial statements (impairment tests, deferred tax
recoverability, going concern, forward-looking ECL scenarios). Decide with controllership and the auditor.

## 3. Model inventory and tiering

Inventory fields `[D]`: model ID, name, purpose, business owner, developer, validator, platform, version, tier, inputs
and sources, outputs and consumers, assumptions, limitations, last validation date, next validation due, status.

Tiering criteria `[D]`: financial materiality, use in external or regulatory reporting, reliance by senior decisions,
complexity and opacity (ML raises it), data quality risk, rate of change, vendor dependency. Higher tiers get
independent validation before use, shorter review cycles and tighter change control.

## 4. Lifecycle mapped to the OneStream SDLC

| Stage | Model risk expectation | In practice |
|---|---|---|
| Design | Documented purpose, scope, methodology, alternatives considered | Blueprint and ADRs |
| Development | Standards followed, code reviewed, data validated | Rule standards, pull requests |
| Testing | Unit, integration, reconciliation, sensitivity, back-testing, performance | Test plan and evidence |
| Independent validation | Second line re-performance and challenge | Validation report with findings |
| Approval | Named approver accepts residual risk and limitations | Approval record |
| Implementation | Controlled release with rollback | Deployment checklist |
| Monitoring | Performance, drift and exceptions tracked | Dashboards and thresholds |
| Change | Material changes re-validated; minor changes logged | Change classification |
| Retirement | Archive documentation and results | Retention policy |

## 5. Documentation pack

Each model has a document, owned by the model owner and version controlled `[D]`:

1. Purpose, scope, users, decisions supported, out of scope.
2. Architecture: data flow, sources, dimensions, rules, schedules, interfaces.
3. Methodology: formulas, driver definitions, units and conventions, circularity treatment.
4. Assumptions: register entries, owners, sources and approvals.
5. Data: sources, quality checks, known issues, lineage.
6. Limitations and use restrictions.
7. Controls: preventive and detective, with evidence references.
8. Testing and validation: plan, results, open findings.
9. Monitoring: metrics, thresholds, escalation.
10. Change log and approvals.

## 6. Modelling standards (FAST-aligned) `[R]` `[D]`

| Principle | Application in OneStream |
|---|---|
| Flexible | Dimensions and drivers parameterised; no structure change needed for a new product or period |
| Appropriate | Grain and complexity match the decision; no spurious precision |
| Structured | Inputs, calculations and outputs separated; consistent formula pattern across periods and entities |
| Transparent | Rules readable, commented and traceable; every output walkable to inputs |
| No hard-coding | No literals in rules; drivers in tables with owners |
| Units and signs | Conventions page; automated sign and unit tests |
| Error checks | Integrity checks built in and visible |
| Version control | Everything extracted to Git; releases tagged |
| Single source | Each assumption entered once |
| Circularity | Avoided or controlled and documented |

## 7. Controls matrix `[D]`

| Objective | Control | Type | Frequency | Evidence | Owner |
|---|---|---|---|---|---|
| Only authorised users change data | Role-based access, entity and slice security, quarterly recertification | Preventive | Quarterly | Recertification record | Security admin |
| Changes are authorised and tested | Pull request, review, test evidence, release approval | Preventive | Per release | PR, test pack, approval | Release manager |
| Inputs are complete and accurate | Control totals, mapping coverage, intersection validation | Preventive and detective | Per load | Load log | Data owner |
| Calculations are correct | Reconciliation checks, roll-forward balance, zero-sum allocations | Detective | Per run | Checks dashboard | Model owner |
| Assumptions are approved | Assumption register with approval and expiry | Preventive | Per cycle | Register | Assumption owner |
| Overrides are controlled | Override log with reason, approver, expiry and report | Preventive and detective | Per cycle | Override report | FP&A lead |
| Outputs are reconciled | Plan actuals tie to the consolidation cube and to the ledger | Detective | Monthly | Reconciliation report | Controller |
| Periods are protected | Locks on closed periods and approved versions | Preventive | Continuous | Lock status | Application admin |
| Segregation of duties | Preparer, reviewer, approver and administrator separated | Preventive | Continuous | SoD matrix | Security |
| Vendor risk | Review of the vendor's assurance reports and complementary controls | Detective | Annual | Review file | Third-party risk |

## 8. Testing standards

| Test | Method |
|---|---|
| Independent re-performance | A second person or tool recomputes a sample (Python or Excel) from the same inputs and agrees to the cent |
| Back-testing | Run the model on a past period with actual drivers and compare to actual results |
| Sensitivity | Move one driver by a stated amount; direction and size of the result is explainable |
| Reverse stress | Find the driver values that breach a limit or buffer |
| Scenario reasonableness | Downside is worse than base on each key line; severe is worse than downside; exceptions explained |
| Stability | Small input changes do not cause large unexplained output changes |
| Edge cases | Zero balances, negative inputs, first period, year end, leap year, no data |
| Benchmark | Compare to an alternative method or external reference |
| Parallel run | New solution and legacy produce the same results for agreed cycles, with differences explained |
| Volume and performance | Production-scale data inside the time window |

## 9. Assumption register

Fields `[D]`: ID, description, value or table reference, unit, scenario, effective dates, owner, source, rationale,
sensitivity (impact of a standard move), approver, approval date, review date, status. The register is a governed
table in or beside the application; rules read from it.

## 10. Management overrides

Policy `[D]`: overrides are allowed only through a workflow state with a reason code; limits by amount and by line;
approver above the requester; automatic expiry; a standard report of overrides by owner and cycle; analysis of override
accuracy in the forecast accuracy review.

## 11. Monitoring metrics

| Metric | Why |
|---|---|
| Forecast accuracy and bias by line and horizon | Model performance and incentives |
| Driver drift versus history | Early sign of stale assumptions |
| Override frequency and size | Model credibility |
| Reconciliation exceptions and ageing | Data and process health |
| Data quality score by feed | Input reliability |
| Calculation runtime versus window | Operability |
| Access exceptions and failed logins | Security |

## 12. AI and machine learning in planning

- Treat ML forecasts as models: documentation, validation, monitoring, tiering `[R]`.
- Explainability appropriate to the use; feature importance or driver attribution available to reviewers.
- Drift and performance monitoring against a naive benchmark; retraining governed by change control.
- Human oversight: ML output is a baseline, owners decide, and overrides are logged.
- Large language models may draft commentary or explain variances; they must not post numbers or change data. Their
  output is reviewed by a named person, and confidential data goes only to approved environments. LLM output is not
  deterministic and must not be described as such.
- Vendor and hosted models fall under third-party risk management `[V]`.

## 13. Audit evidence pack

Assemble for each release and each cycle: the change tickets and approvals, test evidence, reconciliation results,
access recertification, override log, assumption register extract, certification sign-offs, lineage diagram, and the
vendor assurance report review. A reviewer should reach any key number's evidence in a few steps.
