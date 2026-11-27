# Gyan Studio: design and simulation

Open **Diagrams** in the VOLT navigation for narrated business scenarios, playback and exports. For a custom diagram, enter the business decision, named systems and mandatory requirements; review the optimized prompt and its assumptions, then confirm. Diagram playback does not start a simulation.

Choose **Architecture** for a five-chapter visual tour of bank reconciliation, actual vs budget, or three-way matching. Each chapter explains the finance role, its control and the evidence passed forward. Use Play for timed captions, select a layer directly, or enable spoken narration if the browser offers a local English voice. No audio or finance data is sent to a speech provider.

## Local VOLT + Gyan (no Render service)

From the repository root on macOS/Linux, use Node 22.12+ and `uv` with Python 3.12–3.14:

```sh
(cd apps/gyan-agents/backend && uv sync --locked)
(cd apps/volt-console && npm ci && npm run build)
python3 apps/gyan-agents/scripts/local-studio.py
```

At first launch, choose a local designer password in the terminal. Open `http://127.0.0.1:8941`, sign in as `designer`, select General, and choose **Workflows → Gyan Agents → Simulations → Bank reconciliation → Run synthetic simulation**. Inspect the exception and its source references; reopen it from Project runs. Close the launcher with Ctrl+C. Existing data stays in `~/.volt-gyan-local`; neither sandbox nor hosted runs are imported. No controller is provisioned, no ERP postings are enabled, and no model key is required.

## Private setup

Run the service on a private network; do not expose its development API directly. Build from the repository root with `docker build -f apps/gyan-agents/Dockerfile -t gyan-studio .`. Provide a new writable volume at `/state`. The runtime uses one dedicated SQLite file per project, with no changes to existing VOLT chats or ledgers. One persistent instance is the supported deployment; do not horizontally scale local files.

Set `GYAN_INTERNAL_TOKEN` on the private service and console via the host's secret store (at least 32 characters). Configure `GYAN_INTERNAL_URL` on the console and a `GYAN_PROJECT_ROLES` JSON mapping, e.g. `{"general":{"builder-account":"designer","controller-account":"controller"}}`. Set up verified VOLT password accounts. Existing shared-token or username-only sign-ins are deliberately insufficient for private data, creating definitions, running or approving. If disconnected, visual editing and export remain available; the UI says simulation is unavailable.

The private service accepts only a trusted gateway token and server-issued project, actor and role. The console proxy never forwards user-supplied identity headers; it resolves the signed login and the server-owned access map. Provisioning a new service, changing sign-in, and connecting actual financial systems are separate operator actions.

## Data and verification

- Import a project Knowledge file or upload CSV, TSV, structured TXT, XLSX (separate visible sheets), or a text PDF. The API also accepts `widths` for fixed-width TXT, `delimiter`, or `text_mode:"notes"`. Formula workbooks, encrypted/image-only PDFs, ambiguous inputs, or oversized files are rejected without becoming usable snapshots. Free text is evidence, not a verified money table.
- Snapshots are content-addressed with schema hints, bounded samples and stable per-row locators. The three numerical adapters need `reference,amount,currency`; `amount` is an exact signed decimal with no more than two fractional digits. Duplicate reference/currency pairs are ambiguous and fail closed. Optional journal fields `journal_id,debit,credit` must prove a balanced journal by currency. Multi-currency amounts are not silently converted. One-to-many matching, PVM attribution, and live financial postings are outside these adapters.
- Synthetic templates deliberately contain one unmatched bank item, an actual/budget variance, and an overbilled invoice. Each number is generated in a fixed offline Python/SQLite process and reperformed from pinned rows in a separate critic process. No caller SQL, generated Python, or model math is executed.
- An operator may configure read-only MCP endpoints using a private JSON file named by `GYAN_MCP_CONFIG`. Each project has a mapping from server ID to transport settings, a `read_allowlist` and operator-fixed `queries`. For stdio set `command`, `args`, optional `env_allowlist`. For SSE set an `https` URL and `token_env`. Only the intersection of actual discovery and the allowlist is exposed. `POST /studio/remote-snapshot` currently expects tabular CSV text from the approved tool. No provider is connected by default.

## Run and review

The console runs prepared synthetic templates. The editable graph and agent/skill creator are retired. Existing drafts, definitions and backend compatibility APIs have not been deleted or migrated.

The default planner is deterministic. `GYAN_PLANNER=claude|openai|local` plus `GYAN_PLANNER_MODEL` opts into a structured planning adapter; use a secret-store `GYAN_PLANNER_KEY` as needed and `GYAN_LOCAL_BASE_URL` for a local OpenAI-compatible server. Only the confirmed brief is sent, not uploaded rows. These adapters select a supported contract; they are not financial calculators.

Running is a separate, explicit operation. The console displays the result and source references. The runtime retains the immutable event trace, workflow version, artifact hash and idempotency key. A different authenticated controller must approve or reject. Approval does not authorize ERP posting.

## Existing definitions (compatibility APIs only)

The legacy definitions API resolves registry aliases and project definitions. It is no longer exposed through a creator screen.

Custom definitions are declarative. Selecting one stores an immutable reference on a node, not a new global VOLT identity. Built-ins are content-pinned; project definitions are pinned at v1. Each custom definition can require evidence, block unresolved exceptions, or require controller review. Free-form instructions document intent, not arbitrary executable code. References cannot increase tool permissions or bypass the independent reviewer.

## Release evidence

From `apps/gyan-agents/backend`, run `uv sync --locked && uv run pytest -q`. From `apps/volt-console`, run `npm ci && npm run build && npm test`. With Python Playwright and Chromium installed, run `python apps/gyan-agents/scripts/browser-smoke.py` from the root. It creates disposable verified accounts and databases only on loopback.

Verify hosted auth, persistence, independently assigned controller accounts and configured MCP/provider credentials before calling production ready. No live ERP or Databricks tenant is required for the simulation tests, and none is assumed to be verified.
