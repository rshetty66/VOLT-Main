# Product boundaries and release verification

Use as a discovery matrix, not proof of an installed connector. Require edition/version, licence, enabled features,
authoritative documentation and environment evidence. Source IDs refer to [sources.md](sources.md).

| Product | Design treatment | Verify / avoid | Evidence |
|---|---|---|---|
| Oracle Fusion GL | COA structures/instances, segments/value sets, labels, cross-validation and ledgers | No prescribed six segments. Primary balancing/natural account are required labels; cost-center needs depend on modules such as Assets. Matching intercompany values does not itself perform elimination. | S01-S03 |
| Oracle secondary ledgers | Balance, journal, subledger or adjustment-only conversion; reporting currencies separately | Adjustment-only is incomplete alone and requires matching COA/calendar/period type/currency. Do not copy this feature taxonomy to other vendors. | S02 |
| Oracle Accounting Hub / SLA | Source application, event class/type, sources, attributes, journal line/account rules, mapping sets, descriptions, rule sets and methods | Verify event uniqueness, effective dates, registration, import and GL acknowledgement. A hub is not automatically a loan cash-flow/ECL model. | S04 |
| SAP S/4HANA | Operating COA, company code, account, profit center, segment, functional area, trading partner and Universal Journal | DDIC, CDS and API field IDs differ. Specify interface names; do not treat PRCTR as every API field. Country/group charts are legitimate options. | S05-S07 |
| SAP standard / extension ledgers | Leading/non-leading standard ledgers, groups, principles and delta extensions | Extensions inherit configuration; check currency/year variants, Asset Accounting, Universal Parallel Accounting and edition restrictions. | S06 |
| SAP Fioneer FPSL | Financial-products subledger / measurement and accounting integration candidate | Agree calculation and posting ownership, source/FSDM layer, products and licensed scope. Prevent duplicate loan measurement across core, FPSL and hub. | S08 |
| Workday Financial Management / FDM | Ledger accounts plus organizations/worktags and account posting/validation structures | No 200-500 account technical limit. Verify worktag requirements, company restrictions, alternate reporting and book/ledger behavior in tenant. | S09; tenant proof for FDM specifics |
| Workday Accounting Center | External business events, enrichment, detailed accounting, summarization and Workday journals | Verify Accounting Center/Prism prerequisites, worktag enrichment, batches and drill-through. Do not infer Oracle conversion levels. | S09 |
| NetSuite OneWorld | Common account list, subsidiaries, departments/classes/locations/custom segments and book mappings | Full Multi-Book has implementation prerequisites and mapping restrictions. Secondary books are not merely numbering fields. Verify elimination entities and subsidiary hierarchy. | S10 |
| Oracle Cloud EPM | FCCS, Planning/Planning Modules, Account Reconciliation, Enterprise Profitability and Cost Management, Narrative Reporting, Tax Reporting, EDM | Separate business processes, dimensions and licences. EDM governs metadata; FCCS consolidates; reconciliation is not source measurement. | S11 |
| SAP Group Reporting / Analytics Cloud | Consolidation/planning; distinguish ACDOCA actuals, ACDOCU consolidation and ACDOCP plan data as applicable | Verify release, financial-statement-item mappings, movements/subitems, consolidation units and interfaces. | S12 |
| OneStream | Consolidation and planning, workflow and governed dimensions | Verify cube grain, Flow/Origin/Scenario/View, UD dimensions and recalculation in application. | S13 |
| Anaplan | Planning and financial consolidation products as contracted | Current portfolio includes consolidation; avoid an outdated blanket exclusion. Verify exact product/application and accounting role. | S14 |
| Workday Adaptive Planning | Financial planning/forecasting and operational drivers | Define scenarios, member mappings and actuals; assess consolidation separately. | S15 |

Track adapter maturity as SPECIFIED, DOCUMENTATION_VERIFIED, SANDBOX_TESTED, UAT_ACCEPTED or PRODUCTION_SUPPORTED.
This package has no certified vendor connectors. For undecided estates, evaluate product fit, measurement complexity,
volumes, lineage, multi-basis needs, coexistence, operations, licences and exit path. ERP listing does not imply
Tier-1 banking suitability.
