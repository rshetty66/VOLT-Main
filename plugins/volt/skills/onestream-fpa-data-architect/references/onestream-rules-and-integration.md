# OneStream Business Rules and Integration

Tags: `[V]` cross-checked, `[C]` confirm on version, `[D]` design recommendation, `[I]` illustrative. Method and
rule-type list: see [onestream-platform.md](onestream-platform.md), sections 6 and 7.

## Part A. Calculation and rule design

### A1. Calculation architecture for a planning cycle `[D]`

Design the calculation as an ordered, restartable pipeline, one data management sequence, each step a named rule:

| Order | Step | Reads | Writes | Check after |
|---|---|---|---|---|
| 1 | Clear calculated data for the scope | scope parameters | removes prior calculated intersections only | Input data untouched |
| 2 | Resolve drivers | driver tables, macro scenario, assumptions | resolved driver accounts at base level | No missing drivers for populated intersections |
| 3 | Balance roll-forward | opening, volume drivers | movements and closing balances, average balances | Opening equals prior closing; closing equals opening plus movements |
| 4 | Interest and fees | average balances, rates, fee drivers | interest, fees, FTP | Rate x balance recomputed on a sample |
| 5 | Credit provisioning | stage balances, coverage or loaded ECL | PCL and allowance roll | Allowance roll balances |
| 6 | Personnel and non-personnel expense | positions, vendor drivers | expense lines | Headcount x rate reconciles to Workforce cube |
| 7 | Allocations | cost pools, driver table, rule table | allocated-in and allocated-out lines | Sum of allocations out equals sum in |
| 8 | Capital and liquidity | RWA drivers, income, deductions | ratios inputs and results | Capital roll balances |
| 9 | KPIs | stored numerators and denominators | dynamic calc members (no write) | KPI on a known case matches the hand calculation |
| 10 | Checks | all of the above | status flags on a checks scenario or Account | All checks pass or the sequence reports failure |

Principles:

- **Idempotent**: running a step twice gives the same result. Clear before write.
- **Scoped**: every step accepts entity, scenario and period scope and touches nothing else.
- **Ordered by dependency**, not by author convenience; use formula passes for in-unit ordering and data management for
  cross-unit ordering `[C]`.
- **Observable**: each step writes a status and a count that the checks dashboard shows.

### A2. Stored or dynamic

| Metric | Choice | Reason |
|---|---|---|
| Rates, yields, NIM, efficiency ratio, blended fee rate | Dynamic calc | Non-additive; correct at every aggregation level |
| Interest income, fees, expense | Stored | Additive; used in reports and allocations |
| Average balance | Stored for the base level; dynamic only if a defined average of period-end balances is acceptable | Day-weighted averages cannot be rebuilt from period-ends |
| Roll-forward closing | Stored | Feeds next period opening |
| KPIs for dashboards | Dynamic | Cheap, always consistent |
| Allocated costs | Stored | Needs an audit trail and pre/post views |

### A3. Rule coding standards `[D]`

| Area | Standard |
|---|---|
| Header | Purpose, owner, version, change log, parameters, assumptions, dependencies |
| Parameters | From arguments or a configuration table; no member names or numbers embedded in logic |
| Structure | One responsibility per rule; shared helpers in a shared rule; no copy-paste between rules |
| Error handling | Wrap in try and catch; log with context (entity, scenario, period, step); rethrow so data management fails visibly |
| Set-based first | Use the formula-string calculation for set operations; avoid reading one cell at a time in loops `[C]` |
| Scope | Restrict to the POV data unit and to populated intersections; never loop over all members |
| Idempotency | Clear target intersections before write; never accumulate into a target |
| Zero and no-data | Define behaviour for no-data and zero; do not create rows full of zeros |
| Performance | Measure on production-scale data; record timing in the checks dashboard |
| Testing | A test case for every branch and a reconciling check for every rule |
| Review | Pull request with a second developer and a finance reviewer for logic; checklist in the checklists reference |
| Security | No credentials or personal data in rule text; connection names, not secrets |

### A4. Illustrative Finance rule skeleton `[I]` `[C]`

The structure below is the usual shape of a Finance rule that data management calls as a Custom Calculate. Namespace,
type names and argument properties vary by version; take the exact template from the client's version
(new rule, type Finance) and keep the error-handling wrapper it provides.

```vb
Namespace OneStream.BusinessRule.Finance.PLAN_NII_Calc
    Public Class MainClass
        Public Function Main(ByVal si As SessionInfo, ByVal globals As BRGlobals, _
                             ByVal api As FinanceRulesApi, ByVal args As FinanceRulesArgs) As Object
            Try
                Select Case api.FunctionType
                    Case Is = FinanceFunctionType.CustomCalculate
                        Dim fn As String = args.CustomCalculateArgs.FunctionName
                        If fn.XFEqualsIgnoreCase("NII") Then
                            Me.CalculateInterest(si, api)
                        End If
                End Select
                Return Nothing
            Catch ex As Exception
                Throw ErrorHandler.LogWrite(si, New XFException(si, ex))
            End Try
        End Function

        Private Sub CalculateInterest(ByVal si As SessionInfo, ByVal api As FinanceRulesApi)
            ' Interest = average balance x annual rate x day-count factor.
            ' Rates are stored as annual decimals on a driver account; the day-count factor is a
            ' driver account loaded from the calendar. Confirm member-script syntax for the version.
            api.Data.Calculate("A#Int_Income_Loans = A#ADB_Loans * A#Yield_Loans * A#DayCountFactor")
            api.Data.Calculate("A#Int_Expense_Deposits = A#ADB_Deposits * A#Cost_Deposits * A#DayCountFactor")
        End Sub
    End Class
End Namespace
```

Points the skeleton illustrates: a single entry point per rule, a named function dispatched by data management
parameters, set-based calculation strings, drivers read from accounts rather than literals, and a logged rethrow.

### A5. Allocation design `[D]`

Unless the client's licence includes an allocation solution `[C]`, design allocation as a rule driven by a rule table.

Rule table (a governed relational table or a cube slice), one row per allocation:

| Column | Meaning |
|---|---|
| Rule ID, sequence | Identity and execution order |
| Source pool | Cost centres and accounts forming the pool |
| Driver | Driver account and the scope of its values |
| Targets | Entities, products or segments receiving cost |
| Method | Direct, step-down or reciprocal |
| Effective from, to | Dates, so history reruns reproduce |
| Approver, version | Governance |

Method choice: direct (simple, ignores service-to-service use), step-down (ordered, services allocated once, order
matters and must be documented), reciprocal (solves mutual allocation; iteration or algebra; needed when support
functions heavily serve each other). Whichever method: allocated-out equals allocated-in (zero-sum check), allocation
lines are separately identifiable (accounts or Flow members), pre- and post-allocation reports both exist, and drivers
are versioned. Provide a traceability report from a recipient's allocated cost back to the pool and driver.

### A6. Rolling-forecast mechanics `[D]`

1. At close, copy closed-period actuals into the Forecast scenario for the actuals periods (data management copy).
2. Lock the actuals periods in Forecast.
3. Roll the horizon forward one period and seed the new period from the driver rules.
4. Owners adjust drivers, not outputs, in workflow; submission and approval states advance.
5. Take a snapshot copy into the archive scenario at lock for prior-forecast variance.

### A7. Testing rules `[D]`

| Test | What it proves |
|---|---|
| Unit case | A hand-calculated example for each rule branch reproduces to the cent |
| Reconciliation checks | Roll-forwards balance, allocations zero-sum, balance sheet balances, sign convention holds |
| Boundary | First period, year end, leap year, no-data, zero driver, negative balance |
| Idempotency | Run twice; compare; no change |
| Scope | Run for one entity; confirm no other entity changed |
| Volume | Run on production-scale data in the close window; record duration and memory |
| Concurrency | Run while users enter data and while another sequence executes |
| Regression | Standing pack of cube views compared before and after the change |
| Security | Run as a restricted user; confirm no data visibility leak |

Evidence from each test is stored with the release; UAT scripts reference them.

---

## Part B. Integration

### B1. Pattern catalogue `[D]`

| # | Pattern | Mechanism | Use when | Watch for |
|---|---|---|---|---|
| P1 | File-based workflow import | Delimited or fixed file to a data source; transformation rules; workflow import, validate, load | Controlled finance-owned loads (trial balance, driver files) | Manual steps; file naming; reruns |
| P2 | Connector rule pulling from a governed view | Connector business rule queries SQL or an API; transformation rules apply `[V]` | Automated loads, drill-back | Query performance; network path; credentials |
| P3 | Scheduler-orchestrated data management | Enterprise scheduler calls the REST API to execute a sequence `[V]` | The cycle depends on upstream arrival and downstream consumers | Idempotent reruns; polling; token expiry |
| P4 | Direct or form load | Planning inputs through forms, Excel add-in or direct load | Driver and assumption entry | Validation at entry; ownership |
| P5 | Outbound analytics | BI Blend tables and the Power BI connector; export data steps to files for the lake `[V]` | Enterprise BI, regulatory data marts, data science | Bulk (not incremental) loads; row limits; mirrored security |
| P6 | Drill-back | Connector rule drills to GL or subledger detail | Audit and review | Only when a source can serve it; access control |

### B2. Staging contract `[D]`

Define a tall staging table or file contract per domain, produced by the data platform and owned by data engineering,
with finance as the business owner:

| Field | Notes |
|---|---|
| batch_id, source_system, extract_ts | Lineage and replay |
| ledger or basis | IFRS, local, management |
| entity_code, account_code | Source codes, not OneStream codes |
| cost_centre, product_code, segment_code, geography_code | Source codes |
| currency_code | Transaction or local, stated |
| period | Fiscal period in a fixed format |
| amount | Signed per the contract's sign rule; decimal, not float |
| debit_credit_flag | Optional, for validation |
| record_hash | For duplicate and tamper detection |
| control totals | Row count and sum per batch and per entity, sent alongside |

Mappings from source codes to OneStream members happen in transformation rules, not in the extract, so that mapping
is visible and owned by finance.

### B3. Transformation rules `[V]` for types

| Type | Behaviour |
|---|---|
| One-to-One | Explicit source value to target member |
| Composite | Matches across several dimensions; stops when a record matches, so order matters |
| Range | Source range with a tilde; compares character sets, not numbers, so equal-length codes are required |
| List | Several source values to one target, separated by semicolons |
| Mask | Wildcards for one character (?) or many (*) |

Processing order follows the rule-type order, with One-to-One first, then Composite, Range, List and Mask, and a record
mapped by an earlier type is not overwritten by a later one `[C]`. Confirm on the version.

Standards `[D]`:

- Prefer One-to-One for governed codes; use Range, List and Mask for families of codes with a documented pattern.
- Keep composite rules few and commented; they are the hardest to debug.
- A default mapping to a "ToBeMapped" member lets loads complete while exposing the gap in a dashboard; a validation
  gate stops certification while it holds a balance.
- Mapping tables are version controlled and owned by controllership; every change has a requester and approver.
- Mapping coverage test: every distinct source code in the last 13 periods of data maps to exactly one target for each
  dimension, and every target member exists and is a base member.
- Reuse rule groups across data sources; do not clone.

### B4. Load design

| Topic | Standard `[D]` |
|---|---|
| Load method | Replace within a scoped slice for actuals; append only for additive feeds with idempotency keys |
| Scope of clear | The data unit and, with workflow channels, the slice owned by the feed `[V]` |
| Late data and journals | A defined reload path; locked periods reopened under change control |
| Validation | Transformation validation (unmapped), intersection validation (invalid combinations), control totals vs source, confirmation rules before certification |
| Parallelism | Parallelise by entity or slice; avoid concurrent loads to the same data unit |
| History load | Load the agreed history once, reconcile to audited figures, then lock |
| Failures | Fail loudly with batch id and reason; no silent partial loads |

### B5. REST orchestration `[V]` for the endpoint and authentication model

Sequence of an automated cycle step:

1. Obtain an access token from the identity provider, or use a personal access token where the OneStream-hosted
   environment supports it; keep it in a vault, never in code or logs.
2. Call the sequence endpoint with the sequence name and parameters.
3. Poll or use the asynchronous variant `[V]` and read the task result.
4. Treat any non-success as a failure: alert, stop downstream steps, keep the batch id for replay.

```text
POST https://<host>/onestreamapi/api/DataManagement/ExecuteSequence?api-version=<version>
Authorization: Bearer <token from the identity provider or a personal access token>
Content-Type: application/json
Body: application, sequence name and parameters as defined in the REST API Implementation Guide for the version
```

From version 7.2.0 the sequence and step calls are consolidated into one endpoint with a parameter selecting which to
run, and an asynchronous endpoint returns immediately `[V]`. API versions differ across releases; use the guide for
the client's version.

Controls: least-privilege service account, allow-listed network source, request and response logging without secrets,
idempotent sequence design so a retry cannot double-load, and an alert on missed schedule.

### B6. Smart Integration Connector `[V]`

- A local gateway server runs as a Windows service inside the client's network and connects outbound on port 443
  through Azure Relay, with TLS.
- Data sources are defined as named connections in the gateway configuration utility (providers include SQL Server,
  Oracle, PostgreSQL, MySQL, ODBC and OleDb).
- Business rules, member formulas, data management objects and dashboard data adapters reference the named
  connection.
- The gateway version must match the OneStream platform version.

Design `[D]`: put read-only service accounts on views, not tables; plan gateway capacity and a second gateway for
resilience; include the gateway in third-party and cyber risk assessments (OSFI B-10 and B-13 or local equivalents
`[R]`); monitor gateway health; include gateway patching in the release calendar.

### B7. Outbound to analytics `[V]`

- **BI Blend** builds relational column-store tables from cube-style data, bulk refreshed rather than trickle-fed,
  driven from workflow definitions. It does not replicate a whole cube.
- **Power BI connector** reads cube and relational data, with a row limit per call at the time of review.
- Design the BI Blend model per business question (profitability, expense, headcount), not as a mirror of the cube.
- Mirror OneStream entity restrictions as row-level security in the BI tool.
- For regulatory and enterprise marts, export through data management to the lake on a schedule and treat the
  OneStream export as a governed source with a data contract.

### B8. Results from external engines `[D]`

ALM (rate sensitivity, FTP curves), ECL and risk engines, actuarial (IFRS 17) and credit-loss models stay outside.
Define a data contract for each: grain, measures, scenario names, versioning, delivery time, control totals,
owner and reconciliation to the engine's own report. Load the results as inputs or as locked reference scenarios;
do not copy the engine's logic into rules.

### B9. Metadata integration

| Step | Control |
|---|---|
| Source hierarchy snapshot | From the system of record, effective-dated |
| Generate metadata file | Deterministic, diffable, reviewed |
| Validate | Orphans, cycles, duplicates, members with two primary parents, base vs parent type, account type consistency |
| Approve | Named approver, impact analysis |
| Deploy | Load through the supported metadata import or an automated sequence `[C]`; backup extract first |
| Verify | Compare counts and a sample of paths between source and OneStream; run the regression pack |
| Retire | Retire members, do not delete |

### B10. Reconciliation `[D]`

| Level | Check | Tolerance |
|---|---|---|
| File | Row count and control total equal the extract's control record | Zero |
| Staging | Staged amounts equal file amounts by entity | Zero |
| Cube vs ledger | Trial balance by entity, account, currency and period equals the cube | Within a defined rounding tolerance per currency |
| Subledger | Subledger balances reconcile to GL control accounts | Per policy |
| Cross-cube | Plan actual comparatives equal Consol at agreed aggregation points | Zero or rounding |
| Statistical | Headcount, ADB and RWA agree to their source reports | Per policy |

Exceptions create a ticket with owner and ageing; unresolved exceptions block certification. Present the results in a
single reconciliation dashboard that auditors can walk.

### B11. Source-specific notes

| Source | Typical extract | Notes |
|---|---|---|
| ERP GL (Workday, SAP, Oracle) | Trial balance and journal lines by ledger | Load balances for reporting; journals for drill-back; see `workday-accounting-center` and `sap-fpsl` where relevant |
| Core banking and subledgers | Aggregated balances, ADB, rates by product, segment | Aggregate in the lake; do not load accounts |
| HCM | Positions, headcount, compensation | Anonymise or restrict; position-level IDs |
| Treasury and ALM | Rate curves, FTP, rate sensitivity | Version the curve set with the scenario |
| Risk and ECL | ECL, RWA, stage balances by scenario | Contract with risk; reconcile to the risk system |
| Facilities and procurement | Floor area, vendor commitments | Quarterly cadence; driver ownership |
