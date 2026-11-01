# Controls and validation boundaries

## Required control model

| Gate | Minimum acceptance evidence | Accountable owner |
|---|---|---|
| Scope/policy | Product/basis/jurisdiction coverage; approved policies; unresolved cases blocked | Controller + policy team |
| Data | Source population reconciliation; CDE quality; timestamps and lineage; PII minimization | Data owner |
| Accounting | Independently reviewed account/amount golden cases, rule applicability, EIR/ECL/FX model validation | Accounting policy + model owner |
| Platform | Sandbox imports and journal acknowledgements; dimensional validity; scale/failure tests | ERP/hub/EPM owners |
| Reporting | GL/EPM/return tie-outs, report validation rules, movement roll-forwards | Consolidation, FP&A, regulatory reporting |
| Security | Threat model, tenant isolation, RBAC/SoD, secrets, encryption/key management, incident/restore/exit tests | Security + third-party risk |
| Release | Signed evidence, no unresolved critical findings, rollback and operational ownership | Change authority |

Use configurable materiality for issue escalation, never as permission to hide unexplained reconciliation errors.
Monetary precision/tolerances must be explicit by currency and check type; retain and approve residuals. Source
completeness and reconciliation can fail even when journals balance.

## Included utility scope

`scripts/validate_journals.py` is an offline structural checker. It accepts a synthetic/controlled document with
tenant scope, open periods, currency decimal precision, approved rules and journal lines. It verifies finite
nonnegative fixed-point decimal strings, one-sided positive amounts, active approved rule intervals, currency
precision, required lineage, unique line IDs and balance within journal/entity/basis/ledger/period/currency groups. It
honors declared rule ledger/disposition. Monetary strings and mapping operands are bounded to 38 decimal digits;
explicit high-precision local contexts preserve exact supported arithmetic rather than ambient rounding. It rejects
duplicate event-version/basis occurrences across different journal IDs in this deliberately simplified
one-journal-per-event demo contract. Production events may legitimately create several journals: replace that check
with an accounting-event posting-group design and a durable idempotency store before extending the contract.

The utility does not calculate EIR/ECL/FX, check real user authorization, validate actual account intersections,
certify policy, enforce durable idempotency, verify source completeness, import to ERP, compare golden cases or prove
regulatory accuracy. Its report explicitly lists these checks as NOT_RUN.

`scripts/validate_mapping.py` accepts legacy signed balances, weighted account mappings and independently supplied
target signed balances. It checks unique source/target keys, account existence, positive split weights summing to one,
explicit zero-balance retirement, no unknown source mappings, same entity/basis/currency/period boundaries and exact
decimal preservation by target account. Ambiguous one-to-many mappings require explicit weights supported by source
evidence. Target data must not be generated from the same transformation and then called independent proof.

The mapping utility supports account mapping at one fixed grain; it does not derive missing product detail, migrate
open items, transform FX/bases, validate financial-statement signs, check EPM intersections or measure journal logic.
Transformations that change basis, currency, period or presentation require a separately specified and approved
reconciliation bridge, not silent changes inside the mapping file.

`scripts/self_test.py` runs the regression cases for both utilities and, when the `jsonschema` package is installed,
validates the example assets against the canonical schemas (reported NOT_RUN otherwise).

### Input contract (journal document)

Top level: `tenant_id`, `open_periods` (list of `YYYY-MM`), `currency_precision` (currency -> decimal places),
`rules` (each: `tenant_id`, `rule_id`, `version`, `status`, `basis`, `valid_from`, `valid_to`, optional `ledger`,
optional `disposition`), `lines`. Each line needs `tenant_id`, `line_id`, `journal_id`, `entity`, `basis`, `ledger`,
`period`, `currency`, `account`, `rule_id`, `rule_version`, `accounting_date`, `source_system`, `event_id`,
`event_version`, `measurement_ref`, `debit`, `credit`. A rule's `ledger`, when present, must match the line ledger; a
rule's `disposition`, when present, must be `JOURNAL`. Rules must be `APPROVED` and the accounting date must fall in
`valid_from`..`valid_to` inclusive.

### Input contract (mapping document)

Top level: `tenant_id`, `target_accounts`, `legacy` and `target` (rows of `entity`, `basis`, `currency`, `period`,
`account`, `balance`), and `mapping` (rows of `source` plus either `targets` with `account`/`weight`, or
`retire: true` for a source whose balances must all be zero).

### Output

Both utilities print one JSON object shaped like `assets/result.schema.json` (`checks` with PASS, FAIL or NOT_RUN,
and one `blockers` entry describing each failure; status VALIDATED_SCOPED or BLOCKED) and exit 0 only when no
executed check failed. Exit 1 means a check failed;
exit 2 means the document could not be read.

## Mandatory test scenarios for a bank pilot

1. Positive and negative recognition/no-journal outcomes; every in-scope lifecycle branch.
2. IFRS/US-GAAP divergence, delta/full-book consistency and complete basis reconstruction.
3. Eligible/ineligible fees, nonstandard contract, POCI/PCD isolation and missing-measurement quarantine.
4. Misclassified but balanced journals, duplicate accounts, orphan lines, offsets across entities/currencies and
   zero-weight/drop mappings.
5. Out-of-order, replay, reversal, partial failure, duplicate delivery, event correction and rule effective-date
   changes.
6. Closed period, fiscal calendar, backdate, restatement, FX precision/rates and translation/revaluation.
7. Population/control totals, loan roll-forward, hub/GL/EPM/movement ties and applicable regulatory validations.
8. Tenant leakage, malicious document instructions, unauthorized tool use, secret exposure and unauthorized release.
9. Client-agreed peak volumes/latency, recovery time/data-loss targets, restart and acknowledgement loss.
10. Upgrade regression using frozen inputs and approved outputs; measure citation errors and unsupported-accounting
    claims.

Set critical test coverage to 100% of the agreed in-scope cases, not an unsupported assertion about all banking
products. Treat coverage, accuracy and performance targets as pilot acceptance criteria, not achieved outcomes until
measured.
