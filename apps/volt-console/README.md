# VOLT Console

A browser front end for the VOLT plugin: a React UI and a Node API that run VOLT's agents on the Claude API.
It reads `plugins/volt` directly, so the console and Claude Code use the same agents, workflows and skills.

```
React UI (Vite) --SSE--> Node API (Express) --> Claude Messages API (streaming tool loop)
  Console, Workflows       orchestrator.ts        Rudra -> consult_agent x N (parallel)
  Agents, Skill Finder     tools.ts                     -> find_agents / find_skills / load_skill
  Services, Analytics      catalog.ts  <-- plugins/volt (agents/*.md, skills/, data/*.json)
  Capability Health        analytics.ts (APQC benchmarks, maturity, NPV/IRR, value case)
  Templates                templates.ts (formatting extracted from uploaded Office templates)
```

## Views

| View | What it does |
|---|---|
| Agent Console | Rudra routes a request across the 236 agents, runs specialists in parallel and synthesises one deliverable. You can also chat with any single agent |
| Workflows | The 35 VOLT workflows with their intake questions. Phases run in order, agents in parallel within a phase, then Rudra synthesises |
| Skill Finder | Ranks the 378 VOLT skills against a task and opens any of them |
| Services | The 60-service catalogue with coverage ratings; each service launches its workflow |
| Analytics | APQC benchmark positioning and a finance transformation value case. Agents call the same deterministic tools for every figure |
| Templates | Upload a Word, Excel or PowerPoint template; VOLT extracts its theme colours and fonts, styles, page setup, slide layouts, cell styles and number formats into a formatting guide. Pick a template in the top bar and every agent in a run applies it |
| Finance Workbench | Six-step workbench over the `design-finance-architecture` skill. Phases 1 and 2 are built: run-status chip, token meter (measured model usage plus validator runs at 0 tokens), multi-journal simulator with a US CECL delta overlay, CSV mapping prover, and a copyable evidence pack with maker and checker names. An assistant-ui chat panel runs validation and the evidence pack locally at 0 tokens and sends other questions to the `accounting-hub-architect` agent. Intake, Event designer and Crosswalk arrive in phases 3 and 4. Needs `python3` on the server path (`VOLT_PYTHON` overrides) |
| Capability Health | What the registry references against what the plugin ships |

## Run it

```bash
cd apps/volt-console
npm install
cp .env.example .env   # set ANTHROPIC_API_KEY for live mode; leave it empty for demo mode
npm run dev            # API on :8787, UI on http://localhost:5173
```

Production: `npm run build && npm start` serves the built UI and the API together on `PORT` (default 8787).

- **Demo mode** (no credentials, or the *demo* toggle on) runs offline. Routing, the Skill Finder, benchmarks and
  workflow sequencing are real; agent prose is assembled from the registry and labelled as simulated.
- **Live mode** uses `claude-opus-5-5` with adaptive thinking, streamed progress updates, prompt caching and
  server-side refusal fallback. Set `VOLT_FALLBACKS=off` behind a gateway, Bedrock or Vertex. Effort is `high` for
  Rudra and `medium` for specialists (`VOLT_ORCHESTRATOR_EFFORT`, `VOLT_SPECIALIST_EFFORT`).
- `VOLT_PLUGIN_DIR` points at a different copy of the plugin (default `../../plugins/volt`).
- `VOLT_TEMPLATE_DIR` is where uploaded templates and their profiles are kept (default `data/templates`, git-ignored).

## Templates

Accepted: `.docx`, `.dotx`, `.xlsx`, `.xltx`, `.pptx`, `.potx`, up to 25 MB. Macro-enabled files are refused.

| Endpoint | Purpose |
|---|---|
| `POST /api/templates` | Upload: the file as the raw request body, its name in an `X-File-Name` header (URL-encoded) |
| `GET /api/templates` | List uploaded templates |
| `GET /api/templates/:id` | The formatting profile and its Markdown guide |
| `GET /api/templates/:id/original` | Download the uploaded file |
| `DELETE /api/templates/:id` | Remove a template |

A run request with `templateId` attaches that template's guide to the request every agent receives. Agents can also call
the `list_templates` and `get_template` tools. Uploads are untrusted: the package is read with a bounded ZIP reader
(no ZIP64 or encrypted parts, 20 MB per part, 64 MB in total), XML with a DOCTYPE is refused, entities are not expanded,
and macros and media are never read. The sample templates used by the tests are rebuilt with
`python3 tests/fixtures/make-templates.py`.

## Test

```bash
npm test            # catalog, routing, Skill Finder, analytics, tool schemas, and the live agent loop against a mocked Messages API
npm run typecheck
```
