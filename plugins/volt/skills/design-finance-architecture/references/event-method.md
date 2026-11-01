# Business events to accounting events

Separate operational facts from accounting interpretation. An application need not create an asset. A binding
commitment can require off-balance-sheet data and an impairment provision depending on scope/policy. One modification
can create several basis-specific effects. Regulatory classification may change without a journal.

## Canonical chain

Product -> instrument -> business-event instance -> accounting decision -> measurement output -> accounting-event
instance -> journal -> GL -> consolidation / EPM / regulatory cells.

Use stable IDs and temporal relationships. Do not equate event type with one journal template.

| Object | Minimum specification |
|---|---|
| Product | Product/version, contractual features, currency, collateral, channel, geography, risk attributes and lifecycle state |
| Event | Tenant/source/event ID/version/type, schema, contract token, entity, occurrence/receipt/value/accounting dates, sequence, currency, typed facts and correction link |
| Policy | Basis/jurisdiction, classification, eligibility, recognition/measurement/display authority, approval, effective interval |
| Measurement | Calculation service/version, input hash, date, amount/currency, model/rate/scenario versions, approval and reconciliation |
| Accounting event | Class/type, basis, policy/rule version, disposition, posting owner, ledger/book and lineage |
| Journal | Debit/credit role, amount source/formula ID, account derivation, dimensions, rounding, period/currency, event references and reversal |
| Crosswalk | Report/taxonomy version, line/cell, scope, attributes, signed aggregation, unit, as-of date, evidence and owner |

Use decimal strings for money and a bank-approved currency precision table. Distinguish event version from duplicate
delivery. Durable identity includes tenant/source/event/version/basis. Make corrections linked new events/versions,
never silent overwrites of posted events.

Support NO_JOURNAL, JOURNAL, MEASUREMENT_REQUIRED, DISCLOSURE_OR_REGULATORY_ONLY and BLOCKED. Record reasons and
data/reporting effects. Do not create dummy zero journals. Allow several accounting events/journal groups for one
business event. Distinguish BASE from DELTA representations so a US-GAAP overlay does not duplicate IFRS postings.

Use decision tables by product, entity/jurisdiction, basis, classification, lifecycle state, effective interval and
required facts. Detect uncovered cases and overlapping equally applicable rules. Never resolve accounting ambiguity by
first-match selection. Retain business valid-time and system recorded-time.

Bind journal rules to approved measurements; specify zero/negative cash flows, rounding and reversals. Quarantine
missing derivation inputs. Preserve state sequencing; replay the original rule version unless an approved restatement
requests another. Durable deduplication, atomic commits and acknowledgement handling require service engineering.

Keep book accounting, management/FTP, prudential capital and disclosure/return views distinct. IFRS stage, regulatory
default and operational arrears are separately governed. Capital requirements do not automatically create
expenses/assets.

Use semantic golden tests: funding must hit the correct loan and settlement roles. Balance alone does not establish
correctness.
