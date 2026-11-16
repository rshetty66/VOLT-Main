# OneStream XF Platform Reference for Financial Services Design

Evidence tags: `[V]` cross-checked (see section 14), `[C]` confirm on the client's version, `[D]` design
recommendation, `[I]` illustrative. Behaviour changes between releases; confirm against the documentation for the
client's platform version before a statement goes into a signed deliverable.

## 1. Logical architecture

| Layer | What it is | Design consequence |
|---|---|---|
| Client | Browser web client, Windows application client and the Excel add-in (Spreadsheet, Quick Views, Cube Views) `[C]` | Plan user training and desktop standards for the Excel add-in; decide which personas use which client |
| Application servers | Execute calculation, consolidation, workflow, data management and business rules `[C]` | Concurrency at close is bounded by server capacity; schedule heavy jobs outside peak input windows |
| Databases | A framework database (security, application definitions) and an application database holding cube data and the Stage import area `[C]` | Stage volumes and cube record counts drive storage and performance, not file sizes |
| Hosting | OneStream-hosted cloud (Azure) or self-managed `[C]` | Cloud region drives data residency and third-party risk evidence; self-managed adds patching and DR scope |
| Connectivity | Smart Integration Connector (SIC) for on-premises sources, REST API for orchestration, BI Blend and a Power BI connector for outbound analytics `[V]` | See the integration part of the rules reference |

OneStream is a single platform for consolidation, close, planning and reporting. In financial services the design
question is not "can it do this" but "should the numbers at this grain live here". Section 13 gives the fit test.

## 2. Object model and dimensions

Application contains one or more **Cubes**; each cube references **Dimensions** (Entity, Account, Flow, Scenario,
Time and the user-defined dimensions among them) held in a dimension library `[C]`.

### 2.1 The dimensions

| Dimension | Role | Financial services design note |
|---|---|---|
| Cube | Container for a set of dimensions and data | One cube per distinct dimensionality (consolidation, planning, workforce); not one per process step |
| Entity | The organisational unit that owns the data | Legal entity for consolidation, or management unit for planning. See the metadata reference, section 2 |
| Parent | The parent in the entity relationship a value is viewed through | Matters for ownership, share and elimination; relationship-level data lives here `[V]` |
| Consolidation | Stage of the consolidation calculation: Local, Translated, Share, Elimination, OwnerPreAdj, OwnerPostAdj, Top | See section 3 |
| Scenario | Actual, budget, forecast, stress and so on; carries input frequency, workflow and processing properties | Each scenario is multiplied into data units; see section 2.3 |
| Time | Year, quarter, month (and finer if configured) per a time profile `[C]` | Set the fiscal calendar and the forecast horizon up front |
| View | Periodic, YTD and related views | Decide the stored view per account type; see metadata reference section 6 |
| Account | The financial and statistical measure | Account type drives sign, aggregation and translation |
| Flow | Movement or sub-ledger view of an account, used for roll-forwards | Use for balance, ECL, AUM and CSM movements |
| Origin | Where the data came from: Import, Forms, AdjInput, AdjConsolidated, Elimination, DirectElim; parents BeforeAdj, BeforeElim, Adjustments, Top | See section 3 `[V]` |
| IC | Intercompany counterparty | Drives automatic elimination; set only on IC accounts |
| UD1 to UD8 | Eight user-defined dimensions | Product, segment, geography, cost centre, stage and similar. Reserve at least one spare |

### 2.2 The data unit

A **data unit** is a unique combination of Cube, Entity, Parent, Consolidation, Scenario and Time `[V]`.
Account, Flow and the user-defined dimensions sit outside the data unit; their parent members are calculated
dynamically when read rather than stored `[V]`. The workflow data unit adds Account, and the workflow channel data
unit goes finer still by adding user-defined dimensions such as cost centre, so one cost centre can load, clear and
lock without affecting another `[V]`.

Why it matters:

- Calculations, clears, copies and consolidations run per data unit. Data unit size and count dominate runtime.
- Locking, workflow status and calculation status are tracked per data unit, so they set the granularity of control.
- Doubling a dimension that is inside the data unit (entities, scenarios, periods) doubles the count of units.
  Doubling a dimension outside it (products, segments) grows records per unit instead.

Cell addressing uses a member script, for example `E#Retail:C#Local:S#Actual:T#2026M3:V#Periodic:A#NII:F#None:O#Import:I#None:U1#Mortgage:U2#Prime` `[C]`.
The prefixes are E, P, C, S, T, V, A, F, O, I and U1 to U8.

### 2.3 Scenario, time and view

- Scenario members carry a type and properties such as input frequency and how workflow time is tracked `[C]`.
  Types distinguish actuals from plan-style scenarios so that different dimension variants can be assigned (see
  section 8).
- A forecast that rolls 18 months crosses fiscal years; build the Time dimension to cover the horizon.
- Decide, per account type, whether stored data is periodic or year-to-date. Mixed conventions are the commonest
  source of "the YTD does not tie" defects `[D]`.

## 3. Consolidation mechanics `[V]` unless noted

Consolidation members and what they hold:

| Member | Holds |
|---|---|
| Local | Entity data in its local currency |
| Translated | Local data translated to the parent's currency; behaves as a pointer to the currency |
| OwnerPreAdj | Journals applied before share and elimination; relationship-level |
| Share | (Translated + OwnerPreAdj) x percent consolidation; calculated on the fly by default, storable if configured |
| Elimination | Intercompany eliminations; by default placed on the first common parent unless custom logic overrides |
| OwnerPostAdj | Journals applied after share and elimination |
| Top | Share + Elimination + OwnerPostAdj; contributes to the parent's Local |

Origin members separate provenance: Import (loaded through workflow), Forms (entered), AdjInput (journals and
adjustments), AdjConsolidated (populated by the consolidation run), Elimination and DirectElim. BeforeAdj aggregates
Import and Forms; Top shows data after eliminations.

Design points:

- **Ownership and method.** Percent ownership and percent consolidation are held on the entity-parent relationship,
  with methods such as full, proportional, equity, holding and not-consolidated `[C]`. Financial groups with
  associates, joint ventures and funds need an explicit method per relationship, and a policy for non-controlling
  interest.
- **Organisation by period.** Relationships can vary over time and scenario `[C]`. Use this for acquisitions,
  disposals and reorganisations instead of building a new hierarchy per year.
- **Currency translation.** Assign a rate type per account type (average for income and expense, closing for assets
  and liabilities, historical for equity) and decide where the cumulative translation adjustment is plugged `[C]`.
  Net investment hedges and hyperinflationary entities need explicit design.
- **Intercompany.** Intercompany accounts are flagged, partners captured in the IC dimension, and differences
  routed to a plug account. Capital markets and treasury groups generate heavy intercompany: agree matching,
  tolerance and dispute handling before build.
- **Matrix consolidation.** Eliminations beyond the legal entity (for example by segment or business line) are
  supported through a documented matrix pattern `[C]`; confirm the pattern in the Financial Model Guides for the version.
- **Calculation status.** Data units carry status flags (for example OK, calculation needed, translation needed,
  consolidation needed, no data) `[C]`. Use them to consolidate only impacted data units during close.

## 4. Account dimension `[V]` for types, `[C]` otherwise

| Account type | Intended use | Financial services use |
|---|---|---|
| Revenue and Expense | Income statement; aggregate with opposite signs | Interest, fees, PCL, operating expense |
| Asset and Liability | Balance sheet; translated at closing rate by convention | Loans, securities, deposits, funding |
| Flow | Behaves like income statement with periodic and YTD values; does not translate | Movements that should not be retranslated |
| Balance and BalanceRecurring | Balance-style items; BalanceRecurring holds values that persist across periods | Opening balances, capital, limits. Confirm behaviour difference from Asset on the version |
| NonFinancial | Statistics such as headcount and floor area | FTE, ADB, RWA, HQLA, AUM when treated as statistics |
| DynamicCalc | Computed on read, no calculation run needed | Ratios and rates: NIM, efficiency ratio, blended fee rate |
| Group | Organising member, accumulates no data | Statement headings |

Other account properties to design deliberately `[C]`: formula pass (the ordering of calculations), allow input,
intercompany flag and plug account, rate type, and the text properties used to carry mapping and reporting
attributes. Do not use the NonFinancial type for amounts that must translate or eliminate.

Sign convention: Revenue aggregates positive and Expense negative in calculations `[V]`; sources often differ.
Decide once whether loaded and displayed values follow accounting sign, natural sign or report sign, document it, and
test it. Most sign defects are conversion defects at the load boundary.

## 5. Workflow `[C]` unless noted

Workflow profiles organise who does what for which entity and period: a cube-root profile, review profiles and
input children for import, forms and adjustments. Stages: import (parse source), validate (transformation and
intersection validation), load, process (calculate, translate, consolidate), confirm (confirmation rules) and certify
(sign-off questions).

- **Workflow channels** let data inside one entity be loaded, cleared and locked by a user-defined slice `[V]`.
  Use channels when one entity has several owners (for example cost-centre or product owners) so they do not
  overwrite each other.
- **Confirmation rules** are automated checks that must pass before certification: balance sheet balances,
  intercompany differences within tolerance, roll-forward integrity, sign checks.
- **Certification** captures an auditable sign-off per entity and period. It is the evidence layer for SOX or
  equivalent reviews.
- Locking: lock closed periods and published scenarios; define who can reopen and how late journals are handled.

## 6. Data management

Data management organises steps into sequences and jobs and runs them on a schedule, from workflow, from a button, or
from the REST API `[V]` (execute a sequence by name with parameters). Typical steps: clear data, calculate,
consolidate, translate, custom calculate, copy data, reset a scenario, export data, run a business rule, run another
sequence `[C]`.

Design rules `[D]`:

- One sequence per business event (monthly actuals close, weekly forecast refresh, annual budget kick-off), composed
  of reusable steps.
- Parameterise period, scenario and entity scope; no sequence edited per cycle.
- Every sequence ends with a check step that writes a pass/fail status someone can see.
- Schedule from the enterprise scheduler through REST when the cycle depends on upstream data arrival.

## 7. Business rules

Rule types `[V]`: Finance (cube calculations, member formulas), Parser (modify fields during import parsing),
Connector (talk to external systems, drill back), Derivative, Cube View Extender, Dashboard Data Set, Dashboard
Extender, Dashboard XFBR String, Extensibility (Extender rules and event handlers), Spreadsheet, and shared
Conditional rules. Event handlers fire inside platform processes such as data management, journals, save data and
workflow.

Calculation approaches `[D]`:

| Approach | Use when | Avoid when |
|---|---|---|
| Dynamic calc member formula | Ratios, rates, averages and anything non-additive that is cheap to compute | The calculation needs loops or cross-unit logic |
| Member formula run during calculate | A stored value derived from others in the same data unit, ordered by formula pass | Logic depends on other data units |
| Custom Calculate rule triggered from data management | Driver-based planning logic, cross-entity logic, allocations, roll-forwards | Simple ratios |
| Parser or connector rule | Data shaping and extraction at import | Business logic that belongs in the cube |

Full coding and testing standards are in the rules and integration reference.

## 8. Extensibility of dimensions and cubes `[C]`

OneStream supports extending a base dimension so that different cubes carry different detail on a common backbone,
and supports roll-up between cubes (the Extensible Dimensionality and Horizontal Extensibility guides). In financial
services this lets, for example, a corporate consolidation cube use a lean account and product structure while a
detailed planning cube adds product and driver detail, with the two tied at agreed aggregation points. Use it when:

- consolidation needs 10 to 20 percent of the planning detail, and
- carrying planning detail in the consolidation cube would inflate data units without a reporting need.

Do not use it to avoid agreeing a single enterprise hierarchy; extensibility multiplies governance work.

## 9. Reporting and consumption

| Capability | Use | Note |
|---|---|---|
| Cube Views and Quick Views | Governed grid reports and ad hoc analysis | Build from a catalogue of standard row and column sets |
| Dashboards | Guided analytics and data entry screens | Parameters and extender rules drive interactivity |
| Report books | Packaged PDF reporting for board and regulator packs | Agree the publication calendar |
| Excel add-in and Spreadsheet | Controlled Excel on live data | Replace unmanaged spreadsheets; keep a governed template library |
| BI Blend | Relational column-store tables derived from cube data for BI | Bulk loaded, not incremental; does not replicate the whole cube `[V]` |
| Power BI connector | Cube and relational access from Power BI | Per-call row limit applies (2 million rows at the time of review); mirror OneStream security in Power BI `[V]` |

Pattern: governed management reporting inside OneStream; enterprise analytics and regulatory packaging on the data
platform, fed by BI Blend or data management exports.

## 10. Security `[C]` unless noted

Layers to design:

1. **Authentication**: SSO through the client's identity provider. For REST, token-based access through an external
   provider (Okta, Azure AD, PingFederate) or personal access tokens on OneStream-hosted environments `[V]`.
2. **Authorisation**: groups and roles for application administration, data entry, data management and dashboards.
3. **Data access**: entity-level access, cube data access groups, data cell access and slice security by dimension
   member. Align to the segregation-of-duties model.
4. **Workflow security**: execution groups per workflow profile and channel.
5. **Audit**: task activity, logon activity, error log, data audit and journal history are available; define
   retention and who reviews them.

Financial services specifics `[D]`: compensation and personal data restricted by slice; a break-glass administrator
process; quarterly access recertification; a segregation-of-duties matrix covering preparer, reviewer, approver and
administrator; service accounts for integration with least privilege and secrets in a vault.

## 11. MarketPlace and Solution Exchange

OneStream publishes more than 50 solutions `[V]`. Names confirmed in OneStream material include Account
Reconciliations, Transaction Matching, Tax Provision and Lease Accounting, and earlier releases named People Planning
and Capital Planning `[V]`. The catalogue, versions and licensing change; confirm what the client is licensed for.

Decision rule `[D]`: adopt a solution when it covers at least about 70 percent of the requirement with configuration
and the client accepts its data model and upgrade path; build custom when the process is a differentiator or the
solution forces a structure the planning model cannot live with. Either way, treat a solution as application code:
version it, review it and test it.

Do not assume an out-of-the-box cost-allocation engine. Confirm whether the client's licence or a partner solution
covers allocation `[C]`; if not, design allocation as logic driven by a governed rule table (rules reference, A5).

## 12. Environments and SDLC `[D]`

| Practice | Standard |
|---|---|
| Environments | Development, QA or test, production; a refresh from production to test before each major release |
| Artifacts | Extract application objects (dimensions, rules, cube views, dashboards, data management, workflow) to files; commit to Git |
| Promotion | Pull request with code review, then deploy by loading extracts, with a checklist and rollback extract |
| Naming | Prefix by domain and type; no personal names; version in the rule header |
| Regression | A standing pack of cube views and checks that must tie before and after every release and platform upgrade |
| Upgrades | Platform releases arrive on the vendor cadence; reserve capacity for regression and a sandbox rehearsal |
| Break fixes | Hotfix process with retrospective review, not silent edits in production |

## 13. Fit test: should it live in OneStream?

| Strong fit | Weak fit (keep elsewhere, load results) |
|---|---|
| Multi-entity, multi-currency, multi-GAAP consolidation and close | Loan-level, policy-level or account-level simulation (ALM, ECL, actuarial engines) |
| Management reporting on actuals plus plan in one model | Transaction analytics and customer-level profitability at account grain (lakehouse) |
| Driver-based planning at product x segment x entity grain | The general ledger, subledgers and accounting hub (ERP, hub) |
| Workforce, expense and capital planning with workflow | Regulatory return production with prescribed templates and validations (regulatory reporting solution), fed by the EPM |
| Allocations at cost-pool grain with audit trail | High-frequency or real-time use cases |
| Capital and liquidity ratio planning on aggregated inputs | Master data mastering across the enterprise (MDM) |

When comparing with other EPM platforms (Oracle EPM, Anaplan, Workday Adaptive Planning, Planful, CCH Tagetik,
Board, Pigment, SAP Analytics Cloud) judge on: consolidation depth and multi-GAAP, planning modelling flexibility,
workflow and audit trail, performance at the client's data unit and record volumes, integration options, security
model, total cost of ownership, partner and talent availability, and fit with the client's ERP. Do not rank vendors
from memory; use `erp-epm-strategy` and `finance-transformation:erp-epm-select` for a scored selection.

## 14. Verification log

| Field | Value |
|---|---|
| Review date | 2026-11-16 |
| Method | Web search excerpts of OneStream documentation and OneStream Community articles. The OneStream documentation and community hosts were not reachable for full-page reads in that session. |
| Outcome | Items tagged `[V]` matched the excerpts. Items tagged `[C]` come from practitioner knowledge and were not matched. |

Confirmed `[V]`:

- Data unit made of Cube, Entity, Parent, Consolidation, Scenario and Time; Account, Flow and user-defined parents
  aggregate dynamically; workflow and workflow channel data unit definitions.
- Origin dimension members and their meaning.
- Consolidation members and the Share and Top formulas.
- Account types and their intended use.
- Business rule type list.
- REST endpoint `POST api/DataManagement/ExecuteSequence`, bearer-token authentication, OAuth 2.0 through Okta, Azure
  AD or PingFederate, personal access tokens on OneStream-hosted environments, and the consolidation of sequence and
  step execution into one endpoint with an asynchronous variant from version 7.2.0.
- SIC architecture: local gateway as a Windows service using an outbound connection over port 443 through Azure Relay,
  named connections referenced from business rules, member formulas and dashboard data adapters, and the gateway
  version needing to match the platform version.
- BI Blend behaviour and the Power BI connector row limit.
- More than 50 MarketPlace solutions and the names listed in section 11.
- Transformation rule types: One-to-One, Composite, Range, List and Mask (details in the integration reference).

Still to confirm on the client's version `[C]`: formula pass semantics and count; scenario property names; the
difference between Balance and Asset behaviour; exact data management step catalogue; text property count and use;
organisation-by-period behaviour; security group names; matrix consolidation pattern; extensibility semantics; the
current MarketPlace catalogue and licensing; the Business Rule API method signatures.
