# OneStream Delivery Playbook for a Systems Integrator

Tags: `[D]` design recommendation, `[I]` illustrative, `[R]` regulation or standard. Numbers in this file are planning
heuristics to calibrate against the firm's estimating model and recent actuals, not benchmarks. For governance,
RAID and steering-committee method load `program-management` and `delivery-excellence`; for change load
`change-management-adoption` and `si-change-management`.

## 1. Engagement shape and gates

| Phase | Purpose | Exit gate | Gate evidence |
|---|---|---|---|
| 0. Mobilise | Team, governance, environments, access, plan | G0 Mobilisation complete | Charter, governance, RAID, access granted, environments ready |
| 1. Discover and design (blueprint) | Requirements, current state, future state, architecture | G1 Blueprint approved | Signed blueprint, fit-gap, data and integration design, metadata workbook, test strategy |
| 2. Build (sprints) | Configure, code, integrate, unit test | G2 Build complete | Unit test evidence, code review records, demo sign-off |
| 3. Test | Integration, system, performance, security, UAT, parallel run | G3 SIT exit, G4 UAT exit | Test summary, defect thresholds met, parallel-run reconciliation |
| 4. Deploy | Cutover rehearsal, history load, go-live | G5 Go or no-go | Readiness checklist, rehearsal results, rollback plan |
| 5. Hypercare | Stabilise through at least one close and one forecast cycle | G6 Hypercare exit | Incident trend, KPIs, runbook, AMS handover |
| 6. Transition and optimise | BAU support, release 2 roadmap | Closure | Benefits baseline and plan, lessons learned |

Release strategy `[D]`: release 1 delivers the backbone (consolidation, core planning, essential reporting); release 2
adds depth (allocations, workforce, capital and stress, advanced reporting, solutions). Avoid a single big-bang for
global financial groups.

## 2. Deliverable catalogue

| Deliverable | Owner | Acceptance criteria |
|---|---|---|
| Current-state assessment | Functional lead | Process maps, pain points quantified, spreadsheet inventory, interviews cover all finance roles |
| Future-state process designs (close, plan, forecast, allocation, reporting) | Finance process lead | Mapped to a process taxonomy (see `apqc-benchmarks`), roles and controls identified |
| Requirements and traceability matrix | Business analyst | Every requirement has a source, owner, priority, design reference and test case |
| Fit-gap analysis | Solution architect | Each requirement fit, configure, extend or gap with a decision |
| Solution architecture | Solution architect | Logical and physical views, non-functional requirements, environments, ADRs approved |
| Metadata design workbook | OneStream architect | Dimensions, members, attributes, hierarchies, owners, sizing worksheet signed |
| Data architecture and integration design | Data architect | Source inventory, contracts, mappings, reconciliation design, lineage, DQ rules |
| Planning model specification | FP&A modeller | Driver trees, formulas, conventions, assumptions, scenarios, controls |
| Rule specifications | Developer lead | One per rule: purpose, inputs, logic, tests, performance budget |
| Security design | Security lead | Roles, groups, data access, SoD matrix, SSO, service accounts |
| Reporting and dashboard design | Reporting lead | Report catalogue, mock-ups, definitions, security, publication calendar |
| Test strategy and plan | Test lead | Levels, environments, data, entry and exit criteria, defect process |
| Data migration and history load plan | Data architect | Scope, reconciliation to audited figures, sign-off steps |
| Cutover and rollback plan | Delivery manager | Time-boxed steps, owners, go and no-go criteria, rollback |
| Training and adoption plan | Change lead | Personas, curriculum, materials, superusers, measures |
| Runbook and support model | Delivery manager | Daily, close and cycle tasks, incident process, escalation |
| Benefits tracking plan | Programme manager | Baselines, KPIs, owners, measurement dates (see `kpi-value-realization`) |

## 3. Estimating `[D]`

Method: bottom-up by object counts, cross-checked against a top-down percentage split, with an explicit risk
contingency.

| Object | Complexity tiers | Heuristic effort per object (design, build, test; person-days) |
|---|---|---|
| Interface (inbound or outbound) | Simple file, medium connector, complex with transformation and reconciliation | 5 to 10, 10 to 20, 20 to 40 |
| Custom rule | Simple, medium, complex (cross-entity, allocations, roll-forward) | 3 to 5, 5 to 10, 10 to 25 |
| Report or dashboard | Standard cube view, interactive dashboard, board pack | 1 to 3, 5 to 10, 10 to 20 |
| Hierarchy or dimension | Static, governed, integrated with an MDM | 3 to 5, 5 to 10, 10 to 20 |
| Persona or role (security, training) | Per persona | 3 to 6 |
| Entity group (consolidation set-up) | Per method type or currency group | Per design effort, not per entity |

Cross-check split `[D]`: discover and design 15 to 20 percent, build 30 to 35 percent, test 20 to 25 percent, deploy
and hypercare 10 to 15 percent, programme management and change 15 to 20 percent. Add contingency by uncertainty:
data readiness, integration landscape, scope clarity and stakeholder availability.

Indicative duration `[D]` (calibrate): consolidation and reporting for a mid-size group, 4 to 6 months; planning for
core P&L and headcount, 5 to 8 months; global financial group with consolidation, planning, close and reconciliations
delivered in two releases, 12 to 18 months. Duration is driven by data readiness and decision speed more than by build.

## 4. Team shape

| Role | Responsibility |
|---|---|
| Engagement partner and director | Client relationship, quality, commercial |
| Programme manager | Plan, RAID, governance, change control |
| Solution architect (OneStream) | End-to-end design, ADRs, performance |
| FP&A modeller and functional leads | Planning and close design, driver models, UAT scripts |
| Data architect | Data design, mappings, reconciliation, lineage |
| Integration and data engineers | Pipelines, connectors, orchestration |
| OneStream developers | Rules, cube views, dashboards, data management |
| Reporting and dashboard lead | Report catalogue and design |
| Security and controls lead | Roles, SoD, ICFR and ITGC alignment |
| Test lead | Test strategy and execution |
| Change and training lead | Adoption, training, communication |
| Client roles | Product owner (CFO delegate), data owners, hierarchy owners, SMEs, test participants, security admin |

Leverage `[D]`: partners and directors a small share, senior managers and managers a modest share, the majority
senior consultants, consultants and analysts. Avoid thin senior coverage on design: errors in dimension and data unit
design are the most expensive to fix after build.

## 5. Governance and quality `[D]`

- **Design authority**: weekly; approves ADRs, standards and exceptions.
- **Steering committee**: monthly; scope, risk, budget, decisions.
- **Change control**: every scope change has impact on time, cost, risk; approved before work starts.
- **Quality assurance**: independent review at G1, G3 and G5 by a person outside the team.
- **Code and metadata reviews**: pull requests; checklists in the checklists reference.
- **RAID** reviewed weekly; top risks to the steering committee.
- **Environment plan**: development, test, production; refresh rules; deployment calendar aligned to client close dates.

## 6. Test strategy `[D]`

| Level | Purpose | Data | Exit criteria |
|---|---|---|---|
| Unit | Rule and object behaviour | Synthetic and targeted | All branches covered, evidence stored |
| Integration | Interfaces end to end | Realistic masked data | Control totals tie; no open critical defects |
| SIT | Whole solution against requirements | Production-like volumes | Requirement coverage 100 percent; defect thresholds met |
| Performance | Close and cycle windows, concurrency | Production scale | Targets met with headroom |
| Security | Roles, SoD, data restriction | Role-based test users | No leakage; SoD conflicts cleared |
| UAT | Business acceptance by persona | Business-owned scenarios | Sign-off by process owners |
| Parallel run | Reconcile to legacy | Real cycles | Differences explained and within agreed tolerance for the agreed number of cycles |
| Cutover rehearsal | Timing and rollback | Full copy | Steps meet the window; rollback proven |
| Regression | Protect existing behaviour | Standing pack | Zero unexplained differences |

Defect severity definitions and exit thresholds are agreed in the test strategy (for example no open severity 1 or 2,
agreed cap on severity 3) and signed by the client.

## 7. Cutover `[D]`

1. Freeze windows for metadata, rules and mappings.
2. History load: scope, reconcile to audited figures, lock.
3. Opening balances and carry-forwards validated.
4. Hierarchy and mapping snapshot confirmed against sources.
5. Users, roles and SSO verified; access recertified.
6. Scheduled jobs and integrations enabled in sequence.
7. Go or no-go: defined criteria, named decision-maker, rollback triggers.
8. Communication plan to users and stakeholders.
9. Rollback: extracts and snapshots ready; decision deadline defined.

## 8. Hypercare and transition

- Duration: at least one full month-end close and one forecast cycle, commonly 4 to 8 weeks.
- Daily stand-up, triage by severity, a dashboard of incidents and ageing.
- Knowledge transfer: runbook walk-throughs, shadowing, reverse shadowing.
- Handover to application management services with agreed service levels.
- Benefits baseline captured before go-live and reviewed after two cycles.

## 9. Top risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| 1 | Data unit explosion from entity or scenario design | Sizing worksheet at G1; performance test at G2 |
| 2 | Late or poor-quality source data | Data readiness assessment in discovery; early profiling; contract SLAs |
| 3 | Unresolved hierarchy ownership | Name owners in blueprint; workflow before build |
| 4 | Scope creep to loan-level modelling | Fit test; separate analytics roadmap |
| 5 | Over-engineered dimensions and hard-coded rules | Design authority; rule standards; metadata-driven design |
| 6 | Reconciliation discovered late | Reconciliation design in blueprint; run from first load |
| 7 | Close-window performance failure | Production-scale tests; consolidation of impacted units only |
| 8 | Key-person dependency on rule developers | Pair development; documentation; reviews |
| 9 | Security and SSO delays | Start early; use client IAM calendar |
| 10 | Spreadsheet resistance | Excel add-in; superusers; retire list with dates |
| 11 | Model risk and audit surprises | Early engagement of model risk, internal audit and external audit |
| 12 | Regulatory timing clashes | Calendar alignment; no go-live in regulatory peaks |
| 13 | Platform upgrade during the project | Regression pack; upgrade rehearsal in the plan |
| 14 | Parallel-run differences unresolved | Agreed tolerance; difference log; named resolver |
| 15 | Benefits not measured | Baseline and owners in the plan |

## 10. Commercial structure `[D]`

- Fixed fee for blueprint, with a clear deliverable list and assumptions.
- Capped time-and-materials or milestone-based fixed fee for build, with change control tied to the requirements
  baseline.
- Explicit assumptions: client data availability, decision turnaround, environment availability, number of entities,
  interfaces, rules and reports in scope.
- Exclusions: historical data clean-up beyond the agreed scope, custom analytics outside the fit, third-party licences.
- Client responsibilities: product owner time, data owners, UAT participants, security administration.
- Acceptance: criteria per deliverable, deemed-acceptance window, warranty period after go-live.
- Independence: check auditor-independence restrictions before proposing financial-system design or implementation for
  an audit client; involve the firm's independence and risk functions `[R]`.

## 11. Benefits and value realisation

Baseline and track `[D]`: days to close, days to forecast, hours spent assembling versus analysing, forecast accuracy
and bias, number of spreadsheets retired, number of manual journals, reconciliation exceptions, audit findings, report
cycle time, user adoption. Link each benefit to an owner and a measurement date; load `kpi-value-realization` and
`business-case-builder` for the case.
