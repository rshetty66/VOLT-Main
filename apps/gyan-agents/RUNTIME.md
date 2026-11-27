# Gyan Studio: design and simulation

Open **Workflows → Gyan Agents**. There is no second Diagrams rail item. Use the canvas for authoring, Play diagram for a visual walkthrough, or Visual library for the existing freeform diagram designer and exports. None of these starts a finance run. Diagrams intentionally contain design labels, not source records; the export limit is 14 nodes per illustrated subsystem.

## Private setup

Run the service on a private network; do not expose its development API directly. Build from the repository root with `docker build -f apps/gyan-agents/Dockerfile -t gyan-studio .`. Provide a new writable volume at `/state`. The runtime uses one dedicated SQLite file per project, with no changes to existing VOLT chats or ledgers. One persistent instance is the supported deployment; do not horizontally scale local files.

Set `GYAN_INTERNAL_TOKEN` on the private service and console via the host's secret store (at least 32 characters). Configure `GYAN_INTERNAL_URL` on the console and a `GYAN_PROJECT_ROLES` JSON mapping, e.g. `{"general":{"builder-account":"designer","controller-account":"controller"}}`. Set up verified VOLT password accounts. Existing shared-token or username-only sign-ins are deliberately insufficient for private data, creating definitions, running or approving. If disconnected, visual editing and export remain available; the UI says simulation is unavailable.

The private service accepts only a trusted gateway token and server-issued project, actor and role. The console proxy never forwards user-supplied identity headers; it resolves the signed login and the server-owned access map. Provisioning a new service, changing sign-in, and connecting actual financial systems are separate operator actions.

On Render the repository Blueprint declares a single `volt-gyan-runtime` private Starter instance and a new 1 GB `/state` disk. Check the existing environment for an equivalent service before applying, review the new recurring charge, and do not create another instance if one already exists. `GYAN_INTERNAL_HOSTPORT` resolves the private address and the console references the runtime's generated secret; no secret needs to be copied into chat. `GYAN_INTERNAL_URL` still takes precedence for other deployments. This change does not assign any account or alter existing sign-in. After provisioning, verify private `/health` from the console, then use an independently approved password-mode rollout and per-project membership list to test the protected catalog and acceptance prompt. A `403` in username mode means access remains closed, not that simulation is ready.

## Data and verification

- Import a project Knowledge file or upload CSV, TSV, structured TXT, XLSX (separate visible sheets), or a text PDF. The API also accepts `widths` for fixed-width TXT, `delimiter`, or `text_mode:"notes"`. Formula workbooks, encrypted/image-only PDFs, ambiguous inputs, or oversized files are rejected without becoming usable snapshots. Free text is evidence, not a verified money table.
- Snapshots are content-addressed with schema hints, bounded samples and stable per-row locators. The three numerical adapters need `reference,amount,currency`; `amount` is an exact signed decimal with no more than two fractional digits. Duplicate reference/currency pairs are ambiguous and fail closed. Optional journal fields `journal_id,debit,credit` must prove a balanced journal by currency. Multi-currency amounts are not silently converted. One-to-many matching, PVM attribution, and live financial postings are outside these adapters.
- Synthetic templates deliberately contain one unmatched bank item, an actual/budget variance, and an overbilled invoice. Each number is generated in a fixed offline Python/SQLite process and reperformed from pinned rows in a separate critic process. No caller SQL, generated Python, or model math is executed.
- An operator may configure read-only MCP endpoints using a private JSON file named by `GYAN_MCP_CONFIG`. Each project has a mapping from server ID to transport settings, a `read_allowlist` and operator-fixed `queries`. For stdio set `command`, `args`, optional `env_allowlist`. For SSE set an `https` URL and `token_env`. Only the intersection of actual discovery and the allowlist is exposed. `POST /studio/remote-snapshot` currently expects tabular CSV text from the approved tool. No provider is connected by default.

## Author, run, and review

Start blank, use a pinned synthetic template, or optimize a brief and explicitly confirm a draft. Drag or keyboard-connect typed source, finance, branch and controller steps. Select a source sheet; choose a profile and an optional branch threshold; review the diagram. Saving checks pins, allowed ports, graph cycles, and source ownership. Reopen a version to make a new one, never overwrite history.

The default planner is deterministic. `GYAN_PLANNER=claude|openai|local` plus `GYAN_PLANNER_MODEL` opts into a structured planning adapter; use a secret-store `GYAN_PLANNER_KEY` as needed and `GYAN_LOCAL_BASE_URL` for a local OpenAI-compatible server. Only the confirmed brief is sent, not uploaded rows. These adapters select a supported contract; they are not financial calculators.

Running is a separate, explicitly confirmed operation. The browser streams typed node events and the terminal artifact. Immutable event replay is also available. The result is bound to the immutable workflow version, artifact hash and idempotency key. All simulation drafts need a different authenticated controller to approve or reject, even if the designer deletes the approval node. Repeating an approved job never posts anything. Production approval is not authorization for a later ERP posting.

## Definitions without copies

The creator searches the VOLT registry, aliases the 20 Gyan execution profiles back to their canonical agents, and searches private definitions in the active project. Search includes approximate names. Creation catches normalized ID/name collisions, existing profile aliases, and identical normalized instructions; database uniqueness prevents concurrent duplicate creates. Semantic paraphrases are suggestions for human review, not guaranteed duplicates.

Custom definitions are declarative. Selecting one stores an immutable reference on a node, not a new global VOLT identity. Built-ins are content-pinned; project definitions are pinned at v1. Each custom definition can require evidence, block unresolved exceptions, or require controller review. Free-form instructions document intent, not arbitrary executable code. References cannot increase tool permissions or bypass the independent reviewer.

## Release evidence

From `apps/gyan-agents/backend`, run `uv sync --locked && uv run pytest -q`. From `apps/volt-console`, run `npm ci && npm run build && npm test`. With Python Playwright and Chromium installed, run `python apps/gyan-agents/scripts/browser-smoke.py` from the root. It creates disposable verified accounts and databases only on loopback.

Verify hosted auth, persistence, independently assigned controller accounts and configured MCP/provider credentials before calling production ready. No live ERP or Databricks tenant is required for the simulation tests, and none is assumed to be verified.
