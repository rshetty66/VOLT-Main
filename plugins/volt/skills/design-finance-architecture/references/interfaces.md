# Service, API and Claude Code packaging design

This file specifies a future service boundary. No running API/MCP server, cloud deployment or vendor connector is
supplied by this package. A skill is not automatically an MCP server. A separate adapter/service must implement
authentication, authorization, persistence, execution, transport and operations.

## Suggested tools

| Tool | Purpose / boundary |
|---|---|
| `intake_assess(payload)` | Workstream completeness and blocking decisions |
| `finance_architecture_design(payload)` | Architecture, ledger, COA, hub and EPM proposals |
| `business_accounting_map(payload)` | Product/lifecycle/basis decision matrix; no posting |
| `accounting_simulate(payload)` | Offline approved rules/measurement inputs and expected journals |
| `mapping_validate(payload)` | Scoped deterministic reconciliation evidence |
| `epm_crosswalk_design(payload)` | Member/movement/scenario mappings and driver lineage |
| `regulatory_lineage_design(payload)` | Return-version/cell/source traceability proposals |
| `scenario_model(payload)` | Assumption-based ROM/value model with uncertainty |

Use asynchronous jobs for long runs: authenticated request -> validate -> job ID -> status -> versioned artifacts and
evidence manifest. Proposed REST endpoints: `POST /v1/design-jobs`, `GET /v1/design-jobs/{id}`,
`GET /v1/design-jobs/{id}/artifacts`. Map the same business methods to MCP tools. Verify the supported MCP
specification/SDK and transports at implementation time; choose stdio for local trusted process integration or
authenticated Streamable HTTP for remote service deployment as appropriate. Pin protocol/client/server versions and
perform compatibility tests. Do not use ad hoc webhooks to bypass tenant/session authorization.

## Request envelope

Require schema_version, authenticated tenant identity, engagement ID, request ID, idempotency key, workstream/mode,
scoped evidence references/hashes, policy-set version, products/releases/features, jurisdictions/bases, as-of date,
and output contract version. Tenant from the body must match server-verified identity; never trust client-supplied
tenant as authorization. Require evidence-store authorization on every URI. Keep uploaded TB/PII outside prompts where
controlled processing suffices.

Use explicit decimal strings and ISO dates/currency; validate with pinned JSON Schema 2020-12 tooling plus semantic
checks. Reject unknown fields at governed object boundaries. Distinguish null/unknown/zero. Put extensibility only in
typed, versioned facts, not arbitrary executable expressions. Assets contain event/rule/result schemas; a complete
intake/job schema and API specification remain implementation work.

## Run-result envelope

Return run ID, status, methodology version, authenticated tenant, UTC start/finish, input manifest hash,
policy/rule/model/prompt/software versions, artifact references+hashes, decisions, blockers, exceptions, evidence
freshness, checks executed and NOT_RUN, limitations and human approvals. Use codes such as INPUT_INVALID,
POLICY_MISSING, EVIDENCE_STALE, RULE_AMBIGUOUS, MEASUREMENT_MISSING, RECONCILIATION_FAILED, UNSUPPORTED_CAPABILITY and
AUTHORIZATION_DENIED.

Implement bounded retries, cancellation/timeouts, per-tenant quotas, cost/latency budgets, dependency circuit
breakers, job leases, immutable append-only audit records, durable idempotency, replay controls and dead-letter
handling. Do not retry a potentially posted journal without querying durable posting state and ERP acknowledgement.

## Claude Code implementation

In VOLT this skill ships as `plugins/volt/skills/design-finance-architecture/` with its references, assets and
scripts, and the `/volt:design-finance-architecture` command runs it. The master instructions use progressive
disclosure and portable frontmatter. Delegation depends on description/context; there is no auto-activation-keywords
field or guaranteed keyword dispatch. For guaranteed routing, call the skill or command explicitly in the
orchestration layer.

Use the current Claude Agent SDK only after verifying the pinned version and supported APIs. Separate context is not
filesystem, credential, network or tenant isolation. Implement actual process/container/network and authorization
controls. Restrict write tools, use allowlists, and treat third-party MCP tool output as untrusted. Do not imply skill
files alone implement enterprise security. Sources: S24-S25; reverify SDK/MCP details before build.
