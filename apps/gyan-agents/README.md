# Gyan Agents

VOLT's finance workflow studio. The Phase 1 contracts and catalog are joined by a project-scoped, **simulation-only** runtime and a visual editor inside VOLT Workflows. The three supported execution adapters perform bank/GL reconciliation, actual/budget variance and invoice/PO/receipt comparison. Other catalog profiles remain design references, not runnable adapters. Nothing posts a journal, releases a payment or writes back to an ERP. See [operating instructions and rollout gates](RUNTIME.md).

## One front door

VOLT Chat and Workflows remain the work surfaces. Reference contains the existing Agent Registry and Skill Finder. The new 20 finance manifests are execution profiles, not 20 new identities registered in VOLT. Each profile declares a canonical `volt_agent_id` validated against `plugins/volt/data/agents.json`, with the mapping in `plugins/volt/data/finance-workflow-bindings.json`. For example, cash application and collections reuse `accounts-receivable` with different evidence requirements and output contracts. The local database materializes versioned profiles so a saved workflow can pin a contract. It does not own the VOLT identity registry.

## Folder structure

```text
apps/gyan-agents/
  backend/
    pyproject.toml, uv.lock
    gyan_agents/
      api.py, __main__.py       # read-only API and operator CLI
      schemas.py               # Pydantic v2 contracts
      catalog.py, seeds/catalog.json
      db.py                    # six SQLAlchemy tables and audit protections
    tests/
  web/                         # Next.js 15 App Router foundation status page
  examples/custom-close.json   # hand-designed, non-executing workflow
  PLAN.md                      # phased integration and acceptance gates
```

## Run locally

From `apps/gyan-agents/backend`, with Python 3.12+ and `uv`:

```sh
uv sync --locked
uv run python -m gyan_agents init
uv run python -m gyan_agents save-draft ../examples/custom-close.json
uv run python -m gyan_agents get-draft controller_reconciliation_review 1
uv run pytest -q
uv run uvicorn gyan_agents.api:create_app --factory --port 8000 --host 127.0.0.1
```

From `apps/gyan-agents/web`, run `npm ci` and `npm run dev`. The server renders the readiness of the five domains from the API. It does not expose a second browsable agent registry. See `web/.env.example` for service URLs.

`GET /health`, `GET /agents`, `GET /contracts` and `POST /workflows/validate` are local foundation endpoints. Validation checks shape, unique IDs and inlets, legal endpoints, acyclicity and pinned agent versions. It **does not certify run readiness**: available data/resources, edge type compatibility, tool permissions, independent verification and approval policy are deployment-time gates in later phases.

## Database and boundaries

Default storage is a new, local `gyan-studio.db` in the backend working directory. Set `GYAN_DATABASE_URL` to a **dedicated Studio database** to use PostgreSQL with psycopg. Initialize once before starting multiple workers. Bootstrap creates missing tables and inserts only missing `(profile ID, version)` pairs; it never updates an existing version, drops tables or migrates VOLT chat data. To change a saved workflow, increment its version.

Tables store profile versions, workflow versions, MCP resource descriptors, runs, ordered trace events and audit events. Saving a local draft appends an audit record in the same transaction. Database triggers block ordinary updates and deletes of audit rows; this is not proof of SOX compliance or protection from a database administrator. A production release requires access controls, independent retention and backup, tenant separation and tested recovery. Keep this unauthenticated development API on loopback; do not expose it, connect production sources or put credentials in profiles.

Currency thresholds in the seed data are illustrative, not client accounting policy. A threshold never authorizes a write. MCP capability names are requirements, not evidence that a live server advertises them. The `file://` form identifies an uploaded dataset in a registry, not a host filesystem path.
