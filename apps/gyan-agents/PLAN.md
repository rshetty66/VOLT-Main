# From a chat question to a Gyan Agents workflow

The user can bring a question, choose a proven template, or start with a blank canvas. All three paths produce the same editable, versioned workflow document. Nothing runs just because a prompt or a graph was generated.

| Phase | What ships | Gate before starting the next phase |
|---|---|---|
| 1. Foundation | Side-by-side FastAPI and Next.js scaffold, four typed contracts, 20 finance profiles bound to existing VOLT identities, versioned storage and one Reference destination. Local JSON design and round-trip save. | Validate every manifest against its schema and VOLT identity; reject cycles, missing nodes and unknown agent versions; initialize twice with no duplicate rows; reject audit mutations. |
| 2. Data and tools | `MCPGateway` discovers authenticated, allowlisted read tools from operator-configured stdio/SSE servers. Start with synthetic SAP GL/PO, Oracle actuals, Workday workforce and Salesforce pipeline; then Snowflake, Databricks and Postgres, and opt-in enterprise connections. Parse `.csv`, multi-sheet `.xlsx`, fixed-width/delimited/free-text `.txt`, and text `.pdf`; quarantine unsupported, encrypted, ambiguous or image-only input. Expose schema, sample and bounded dataset query tools. | A known file and a synthetic trial balance produce stable snapshot IDs, types, row counts and traceable samples. Reject unauthorized sources and oversized files. Demonstrate a reconciliation with governed Decimal/SQL tools, never model math. |
| 3. Execution | Resolve version pins, port types, source permissions and materiality rules; topologically execute nodes with SSE trace/replay. Structured provider adapters for Claude, OpenAI and a configured local model. Record model/tool/latency/usage evidence; preserve intermediate tables and deterministic results. Finance Critic verifies independently with source snapshots. Persist approval pause/resume, rejection and idempotency keys. | An unbalanced entry, unsupported number or missing source fails verification. A material or write-back action cannot bypass an authorized approver even if the canvas omits its gate. Restart and replay do not double-post. Test with mocks, not live financial writes. |
| 4. Integrated workflow builder | Add **Gyan Agents** inside VOLT Workflows, not a second main nav or agent directory. React Flow supports manual drag/connect, prompt-to-draft, templates, branch rules, step inspection, custom profile configuration and saved versions. Reuse existing uploads, work context and governed approval destinations through adapters. | A user can build a blank workflow, modify a template, and edit a generated workflow without code. All three pass identical policy checks. Verify desktop/mobile, keyboard authoring, permission isolation and approval audit before production rollout. |

## Prompt-to-workflow interaction

1. **Choose the task.** Ordinary chat continues to answer questions. “Design a workflow” selects the Studio path, preserving the original ask, project context and permitted sources.
2. **Refine, then confirm.** Reuse the executive prompt optimizer; display the decision, core questions, assumptions and proposed deliverable. Allow edit, original or cancel. Never hand off an unconfirmed prompt; if optimization fails, ask whether to use the original. This is a required integration gate, not a dependency on an automatic fallback.
3. **Propose a graph, not an execution.** The planner receives only the confirmed text, available source descriptors and canonical finance profiles. Produce a schema-validated DAG and explain each proposed agent. Show missing sources as unresolved requirements, not invented connections.
4. **Let the designer change it.** Swap an agent, map inputs, branch on a deterministic value, add an approval or remove a step. Save as a new version. A blank canvas and the three starter templates use this same path; a prompt is not mandatory for manual design.
5. **Verify, then run a simulation.** Show required sources and schemas, exact tool permissions, thresholds and reviewer identity. The user starts the run separately. Approval of the prompt, approval to simulate, and approval of a financial posting are three different decisions.

## First end-to-end workflows

- **Close and auto-reconciliation:** Bank CSV + SAP GL → multi-way reconciliation → journal draft → SOX monitor → independent critic → controller approval. First acceptance case: one unmatched bank item remains explicit and no journal is posted.
- **Executive variance pack:** Oracle actuals + budget workbook + Workday HCM → variance → workforce → CFO briefing. First acceptance case: each material variance reconciles to its source and driver bridge.
- **AP three-way match:** Invoice PDF + SAP PO/receipt → invoice matching → contract compliance → independent critic. First acceptance case: an overbilled rate is traced to the invoice line and contract; no payment is released.

## Rollout decisions

Keep the Studio services internal behind VOLT's authenticated project context. Do not treat a URL parameter, client-supplied user ID, or a confirmation timestamp as authorization. Bind approvals to a specific version and artifact hash. Register any new custom profile once and resolve it by ID everywhere; use version pins instead of copying prompts between Chat, Reference and Workflows. Do not migrate existing chats, files or ledgers without explicit owner approval.
