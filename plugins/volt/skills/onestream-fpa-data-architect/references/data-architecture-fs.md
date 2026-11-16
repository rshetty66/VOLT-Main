# Financial Services Finance Data Architecture

Tags: `[V]` cross-checked, `[C]` confirm on version, `[D]` design recommendation, `[I]` illustrative, `[R]`
regulation or standard to confirm. The goal is one governed, reconciled, lineage-traceable finance dataset that serves
the EPM, regulatory reporting, BI and models without each rebuilding it. See also `si-data-architect` for general
migration and MDM method.

## 1. Principles `[D]`

1. **Finance-grade data**: reconciled to the ledger, explainable, and reproducible as of any date.
2. **Separate raw from trusted**: keep an immutable raw copy and build conformed layers above it.
3. **Conformed dimensions**: one definition of entity, account, product, segment, customer, calendar and currency.
4. **Grain declared** for every dataset.
5. **History is a feature**: bitemporal dimensions and snapshots enable restatement and "as it was reported".
6. **Controls built in**: control totals, reconciliations and data quality rules are pipeline steps, not afterthoughts.
7. **Least data**: personal data minimised and restricted; aggregates for planning.
8. **Contracts**: producers and consumers agree schema, semantics, timeliness and quality in a versioned data contract.

## 2. Reference architecture

```text
Sources                 Landing / raw          Conformed / standardised      Finance core model            Consumption
ERP GL, subledgers  ->  immutable, as-received -> typed, cleansed, keyed  ->  balances, journals, positions ->  OneStream (consol, plan)
Core banking, cards     batch id, hash, lineage    mapped to enterprise keys     drivers, headcount, rates      Regulatory returns
HCM, payroll            retention per policy       reference data applied        hierarchies (bitemporal)       BI and dashboards
Treasury, ALM, risk     per source                 DQ rules applied              allocations, scenarios         Models and ML
```

Medallion naming maps as: bronze = landing, silver = conformed, gold = finance core and data products `[D]`.

## 3. Canonical finance model (conceptual)

| Entity | Description | Key and grain `[D]` |
|---|---|---|
| Legal entity | Registered entity with ownership, currency, regulator | Entity key |
| Organisation unit | Cost centre, department, business line | Org key, effective-dated |
| Chart of accounts | Ledger accounts and reporting accounts, with mapping | Account key, effective-dated |
| Ledger or basis | IFRS, local GAAP, regulatory, management | Basis key |
| Product | Product taxonomy (class, product, sub-product) | Product key, effective-dated |
| Customer and counterparty | Segments and identifiers (restricted) | Party key |
| Contract or position | Loan, deposit, policy, security | Contract key; not loaded to EPM |
| Balance | Period-end and average balances by contract or aggregate | Contract x date, or aggregate grain |
| Journal and transaction | Journal lines and transactions | Journal id x line |
| Rate and curve | Interest, FTP and FX rates, curves | Curve x tenor x date x version |
| Driver | Planning drivers and statistics | Driver x grain x period x scenario |
| Position (HR) | Planned and filled positions | Position id x date |
| Scenario and version | Plan versions, stress scenarios | Scenario key |
| Allocation rule and result | Rules, drivers, outputs | Rule x period x target |
| Calendar | Fiscal and calendar periods, business days | Date |
| Hierarchy | Parent-child with effective dates | Node x parent x valid-from |

Keep contract- and transaction-level entities in the lakehouse; the EPM receives aggregates.

## 4. Keys, history and restatement

| Topic | Standard `[D]` |
|---|---|
| Keys | Surrogate keys in the platform; source natural keys retained; cross-reference table by source |
| Type 2 history | Slowly changing dimensions with valid-from and valid-to |
| Bitemporal | Valid time (when true in business terms) and recorded time (when we knew); needed for restatement and audit "as reported on" views |
| Restatement | Policy for reorganisations: restated history, as-reported history, or both; implemented with hierarchy versions and snapshots |
| Late data | Defined reload path with lineage of the original and the correction |
| Snapshots | Period-end snapshots of balances, hierarchies and mappings retained under policy |
| Reproducibility | Any published report can be regenerated from the snapshot set |

## 5. Hierarchies and master data

| Domain | System of record candidates | Notes |
|---|---|---|
| Legal entity hierarchy | Legal entity system or ERP | Ownership and method owned by controllership |
| Cost centre and organisation | ERP or HCM | Effective-dated; reorganisations are frequent |
| Chart of accounts | ERP and COA governance | Use `modern-finance-gl` and the COA designer for design |
| Product | Product catalogue | Align with risk and regulatory taxonomy |
| Segment and geography | Finance with business | Needs an owner and a change calendar |
| Customer and counterparty | CRM or party master | Restricted; EPM sees segments only |

MDM or an enterprise data management tool (for example Oracle EDM, Collibra, Informatica or a bespoke governed store)
holds hierarchies where there are several consumers; if there is only one consumer, a finance-owned governed table
with workflow is enough `[D]`. In every case: approval workflow, effective dating, audit trail, automated publication
to OneStream and downstream consumers, and a standing reconciliation of published versions.

## 6. Reconciliation architecture

Three-way tie-out at the grain loaded:

```text
Subledger / source  <->  General ledger  <->  EPM cube  <->  Reports
```

| Check | Grain | Frequency |
|---|---|---|
| Source extract control totals | Batch and entity | Each load |
| Trial balance to cube | Entity, account, currency, period | Each load |
| Subledger to GL control account | Control account, entity, period | Daily or monthly per policy |
| Cube to regulatory return inputs | Return line, entity, period | Each reporting cycle |
| Plan actuals to consolidation actuals | Aggregation points | Monthly |

Design: reconciliations are datasets with their own table (batch, check, expected, actual, difference, tolerance,
status, owner, resolution), shown in one dashboard, with exception workflow and ageing. Differences beyond tolerance
stop certification, not merely flag it.

## 7. Data quality

| Dimension | Example financial services rules `[D]` |
|---|---|
| Completeness | Every active entity and account in the prior period has a row or an explained absence; all expected feeds arrived |
| Accuracy | Control totals equal source; debits equal credits; roll-forward closes |
| Validity | Codes exist in reference data; combinations are allowed (account, product, segment) |
| Uniqueness | No duplicate keys; record hash not seen before |
| Consistency | Same measure agrees across systems within tolerance; sign rule holds |
| Timeliness | Feed delivered by the cut-off; latency measured against the close calendar |
| Reasonableness | Period-on-period movement within bands; exceptions explained |

Severity levels: block (stop load), alert (load and notify), observe (log). Each rule has an owner, a threshold and a
runbook. Publish a data quality scorecard per feed; track trends.

## 8. Lineage and regulatory data expectations

- **BCBS 239** principles for risk data aggregation and risk reporting: governance and infrastructure; data
  aggregation (accuracy and integrity, completeness, timeliness, adaptability); reporting practices (accuracy,
  comprehensiveness, clarity, frequency, distribution); supervisory review. Applied formally to global systemically
  important banks and in many jurisdictions to domestic systemically important banks; useful discipline for finance
  data in any bank `[R]`.
- **Lineage** from report cell to source field: column-level lineage in the data catalogue plus the OneStream mapping
  and rule documentation. Maintain a lineage diagram per key report.
- **Data dictionary**: business definition, owner, steward, source, transformation, quality rules, sensitivity class.
- **Regulatory return inputs**: a mapping from return cells to finance data elements, with reconciliation to the
  EPM view where both are used (see `osfi-regulatory-expert`, `regulatory-reporting`).

## 9. Security, privacy and residency

| Topic | Standard `[D]` |
|---|---|
| Classification | Public, internal, confidential, restricted; compensation and personal data restricted |
| Minimisation | Position and grade level in the EPM, not names; customer segments, not customers |
| Access | Role-based, attribute-based where needed; row-level and slice security mirrored in BI tools |
| Encryption | In transit and at rest; keys managed by the client or the provider under policy |
| Secrets | In a vault; service accounts with least privilege; rotation |
| Residency | Cloud region chosen to meet data residency obligations; confirm what the provider stores where `[C]` |
| Third-party risk | SaaS EPM, integration gateways and cloud platforms assessed under the client's third-party framework (OSFI B-10, DORA in the EU, outsourcing guidelines) `[R]` |
| Cyber | Controls consistent with the client's technology and cyber standard (OSFI B-13 and equivalents) `[R]` |
| Privacy | Data protection law (PIPEDA and provincial laws, GDPR, others) for employee and customer data; retention and erasure rules reconciled with financial record retention `[R]` |
| Audit | Immutable audit logs, retention per policy, review cadence |

## 10. Platform patterns

| Concern | Options | Guidance `[D]` |
|---|---|---|
| Storage and compute | Azure (ADLS, Synapse or Fabric, Databricks), AWS (S3, Redshift, Glue, Lake Formation), GCP (BigQuery), Snowflake, Databricks with Unity Catalog | Follow the client's strategic platform; design to open table formats where the client uses them |
| Transformation | dbt, Spark, SQL pipelines | Versioned, tested, reviewed; tests are the data quality rules |
| Orchestration | Azure Data Factory, Airflow, Control-M, platform-native | The close calendar is the master schedule; REST triggers into OneStream sequences |
| Catalogue and lineage | Purview, Collibra, Alation, Unity Catalog | Automated column-level lineage where available |
| Data contracts | Schema, semantics, SLA, quality, owner | Version them; break-glass change process |
| Observability | Freshness, volume, schema drift, DQ results | Alerts to the owners, not a shared inbox |
| Resilience | Replay from raw, idempotent pipelines, disaster recovery aligned to the close | Test a restore |

## 11. Integration decision matrix (to and from OneStream)

| Need | Pattern | Why |
|---|---|---|
| Monthly trial balance from ERP, finance-owned | File import with transformation rules | Simple, auditable, owned by finance |
| Daily or intraday-driven actuals, many sources | Connector rule to a governed view, orchestrated through REST | Automation and drill-back |
| On-premises database sources and cloud OneStream | Smart Integration Connector | Outbound-only connectivity pattern `[V]` |
| Planning inputs from business owners | Forms, Excel add-in, direct load | Ownership and workflow |
| Results to enterprise BI | BI Blend and the Power BI connector `[V]` | Governed relational output |
| Results to regulatory or data science stores | Data management export to the lake | Data contract and lineage |
| External engine results into the plan | Contracted dataset loaded as locked scenario or inputs | Separation of behaviour and assembly |

## 12. Multi-GAAP, multi-currency and COA change

- **Multi-GAAP**: one conformed ledger-basis dimension in the platform; the EPM chooses its option (see the metadata
  reference, section 8); reconciliation between bases is a control.
- **Currency**: store transaction, local and reporting amounts with the rate type and rate version used; rates have one
  authoritative source and a cut-off.
- **COA change**: maintain a crosswalk from old to new accounts with effective dates; restate history by crosswalk
  where the policy requires; validate totals before and after.
- **Reorganisation**: versioned hierarchies and a restatement run that is repeatable and reconciled.

## 13. Illustrative end-to-end flow `[I]`

1. ERP and subledgers land daily into the raw layer with control totals.
2. Conformed jobs apply keys, reference data and DQ rules; failures block or alert per severity.
3. The finance core model produces entity x account x currency x period balances, product x segment x entity
   aggregates, ADB, drivers and headcount aggregates.
4. A scheduler triggers OneStream sequences through REST when upstream checks pass; connector rules read the governed
   views; transformation rules map codes; validation and confirmation rules run.
5. Reconciliations publish to a dashboard; certification follows.
6. After consolidation, exports and BI Blend feed BI and the regulatory data mart; lineage links every output field to
   its sources.
7. Hierarchy and mapping changes flow the other way through the governed change process.
