# Review Checklists, Discovery Questions and Templates

Use the checklist that matches the artefact. A review produces findings in the format in section 6. Mark an item N/A
only with a reason. Tags: `[D]` design recommendation.

## 1. Design review checklist

| # | Area | Check |
|---|---|---|
| 1 | Scope | Outputs listed with audience, frequency, grain, currency and basis |
| 2 | Conventions | Sign, units, rate basis, day count, calendar, currency treatment documented |
| 3 | Fit | Each requirement tested against the fit test; off-platform items identified with data contracts |
| 4 | Dimensions | Every dimension justified by an output; dimension vs member vs attribute vs cube decisions recorded |
| 5 | Data units | Sizing worksheet complete; largest data unit and performance budget stated |
| 6 | Entity design | Legal vs management view resolved; mapping governed; security granularity matches ownership |
| 7 | Accounts | Ledger, reporting and management accounts separated; types correct; sign tested |
| 8 | Flows | Roll-forwards defined; opening balance method defined; closing equals opening plus movements tested |
| 9 | Scenarios and time | Pattern chosen; snapshot and pruning policy; horizon covered |
| 10 | Currency | Rate types, sources, plan rates, CTA, hedging, hyperinflation addressed |
| 11 | Consolidation | Methods, ownership, intercompany, eliminations, organisation by period handled |
| 12 | Multi-basis | Option chosen with reconciliation control |
| 13 | Workflow and controls | Stages, channels, confirmation rules, certification, locks designed |
| 14 | Security | SSO, roles, data access, SoD matrix, service accounts, retention of audit logs |
| 15 | Rules | Architecture ordered and idempotent; stored vs dynamic decisions; no hard-coding |
| 16 | Integration | Pattern per feed; staging contract; mappings governed; reconciliation designed |
| 17 | Reporting | Report catalogue, definitions and security; BI path |
| 18 | Governance | Hierarchy owners, change calendar, ADRs, assumption register |
| 19 | Model risk | Inventory entries, tiering, validation plan, documentation pack |
| 20 | SDLC | Environments, version control, promotion, regression pack, upgrade plan |
| 21 | Evidence | Every platform or regulatory claim tagged and, where needed, verified for the client's version |

## 2. Business rule code review checklist

| # | Check |
|---|---|
| 1 | Header complete: purpose, owner, version, parameters, assumptions |
| 2 | No literals for rates, thresholds, member lists; configuration from tables or arguments |
| 3 | Scope limited to the requested data unit; no loops over all members |
| 4 | Set-based calculation used where possible; no per-cell reads in loops |
| 5 | Idempotent: target cleared before write; rerun identical |
| 6 | Handles no-data, zero and negative values explicitly |
| 7 | Error handling logs context and rethrows so the sequence fails visibly |
| 8 | Formula pass or step order justified |
| 9 | Unit test cases for each branch with evidence |
| 10 | Reconciling check exists and is on the dashboard |
| 11 | Performance measured at production scale; within budget |
| 12 | No credentials, personal data or secrets |
| 13 | Naming and style follow the standard; no duplicate logic |
| 14 | Finance reviewer has approved the business logic |

## 3. Data load and integration checklist

| # | Check |
|---|---|
| 1 | Source, owner and refresh calendar documented; SLA fits the close calendar |
| 2 | Staging contract agreed; sign rule, currency, period format and decimal type stated |
| 3 | Control totals produced by the source and checked on arrival |
| 4 | Mapping coverage test on the last 13 periods passes; defaults reported |
| 5 | Intersection validation configured; invalid combinations blocked |
| 6 | Load method and clear scope defined; no unintended wipe of other owners' data |
| 7 | Reload and late-journal path defined |
| 8 | Reconciliation to ledger by entity, account, currency and period passes within tolerance |
| 9 | Idempotent: rerun does not double load |
| 10 | Failure alerts reach named owners; runbook exists |
| 11 | Service account least privilege; secrets in a vault; network allow-listing |
| 12 | Gateway, endpoint and API versions confirmed for the platform version |
| 13 | Lineage recorded from source field to cube member |
| 14 | Data quality scorecard defined for the feed |

## 4. Go-live readiness checklist

| # | Check |
|---|---|
| 1 | Open defects within the agreed thresholds; no open severity 1 or 2 |
| 2 | Requirement coverage 100 percent with evidence |
| 3 | Parallel run for agreed cycles reconciles; differences explained |
| 4 | Performance tests meet targets with headroom at peak concurrency |
| 5 | Security tests passed; SoD conflicts cleared; access recertified |
| 6 | History loaded and reconciled to audited figures |
| 7 | Hierarchies and mappings match source snapshots |
| 8 | Cutover rehearsed at least once; timing fits; rollback proven |
| 9 | Users trained; superusers named; support model live |
| 10 | Runbook, incident process and escalation approved |
| 11 | Model risk, internal audit and controllership sign-offs obtained |
| 12 | Vendor assurance and third-party risk records complete |
| 13 | Communication plan issued; go or no-go decision-maker named |
| 14 | Hypercare plan and exit criteria agreed |

## 5. Discovery questions by workstream

**Finance process and FP&A**: How many cycles per year (budget, forecast, stress)? Who owns each number? What is the
close and forecast calendar? Which spreadsheets matter, who maintains them, what do they feed? How are targets set and
how are overrides handled? Which decisions do the outputs support?

**Planning model**: Which drivers does management trust? Which behavioural models exist (ALM, ECL, actuarial) and
what do they output? What grain does each decision-maker review? What scenarios are required internally and by the
regulator? How are allocations and FTP set today?

**Consolidation and close**: How many legal entities, methods, currencies and GAAP bases? How frequent are acquisitions
and disposals? How is intercompany matched? What are the current close days and pain points?

**Data**: Which systems are the source of record for balances, drivers, headcount and rates? What is the data quality
today and who owns it? Where do hierarchies live and who approves changes? What is the data platform and the
orchestration tool? What are the reconciliation practices?

**Integration and platform**: Network constraints, SSO provider, cloud region constraints, middleware standards,
existing OneStream footprint, licences and solutions, environments available.

**Security and risk**: ICFR scope, model inventory and tiering, third-party risk requirements, residency, retention,
segregation of duties, privacy constraints on compensation and personal data.

**Reporting**: Board, management and regulatory outputs; formats; audiences; definitions; publication calendar; BI
tools.

**Change and adoption**: Finance team size and skills; appetite for Excel add-in versus web; training constraints;
superuser network; competing initiatives; peak periods to avoid.

## 6. Review findings format

| Field | Content |
|---|---|
| ID | Sequential |
| Area | From the checklist |
| Finding | What is wrong or missing, with the location |
| Evidence | Document, page, rule, query |
| Severity | Critical (blocks go-live or creates control failure), High (material risk), Medium, Low |
| Impact | Consequence in business or control terms |
| Recommendation | Specific fix |
| Owner and date | Proposed |

## 7. Templates

### 7.1 Dimension design workbook (one row per member or per rule of design)

| Dimension | Member code | Description | Parent | Type or property | Attributes | Source | Owner | Effective from | Status |
|---|---|---|---|---|---|---|---|---|---|

### 7.2 Data mapping specification

| Source system | Source field | Source value or pattern | Target dimension | Target member | Mapping type | Order | Rule group | Owner | Effective from | Tested on |
|---|---|---|---|---|---|---|---|---|---|---|

### 7.3 Rule specification

| Item | Content |
|---|---|
| Rule name and type | |
| Purpose and business owner | |
| Trigger (data management step, event) | |
| Scope parameters | |
| Inputs (accounts, drivers, tables) | |
| Logic (formulas, ordering, edge cases) | |
| Outputs and targets | |
| Idempotency and clear scope | |
| Checks produced | |
| Performance budget | |
| Test cases and evidence | |
| Dependencies and execution order | |
| Version and change log | |

### 7.4 Architecture decision record

| Item | Content |
|---|---|
| ID, title, date | |
| Context and constraints | |
| Options considered | At least two, with trade-offs |
| Decision | |
| Rationale | |
| Consequences and risks | |
| Evidence tags | |
| Approver and date | Named client owner; never the agent |

### 7.5 Data quality rule

| Rule ID | Dataset | Dimension (completeness, accuracy and so on) | Logic | Threshold | Severity (block, alert, observe) | Owner | Runbook | Last result |
|---|---|---|---|---|---|---|---|---|

### 7.6 Interface specification

| Item | Content |
|---|---|
| Interface ID, name, direction | |
| Pattern (from the catalogue) | |
| Source and target, owner each side | |
| Schedule, SLA, dependency | |
| Grain and contract (fields, types, sign, keys) | |
| Volume (rows, size, peak) | |
| Control totals and reconciliation | |
| Error handling and retry | |
| Security (identity, network, secrets) | |
| Monitoring and alerting | |
| Test evidence | |

### 7.7 Test case

| Test ID | Requirement | Level | Preconditions and data | Steps | Expected result | Evidence | Status | Defect |
|---|---|---|---|---|---|---|---|---|

### 7.8 Assumption register entry

| ID | Description | Value or table | Unit | Scenario | Effective dates | Owner | Source | Sensitivity | Approver | Review date | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|

### 7.9 Cutover step

| Step | Task | Owner | Start | Duration | Dependency | Verification | Rollback action |
|---|---|---|---|---|---|---|---|
