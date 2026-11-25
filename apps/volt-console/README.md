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
- **Live mode** uses adaptive thinking, streamed progress updates, prompt caching and server-side refusal fallback.
  Set `VOLT_FALLBACKS=off` behind a gateway, Bedrock or Vertex. Effort is `high` for Rudra and `medium` for
  specialists (`VOLT_ORCHESTRATOR_EFFORT`, `VOLT_SPECIALIST_EFFORT`).
- **Model routing** (`server/router.ts`) runs each step on the cheapest model that does it well. One short Haiku call
  triages each new request: Opus leads client deliverables (assessments, designs, business cases, roadmaps), Sonnet
  answers direct questions, and triage picks Opus when unsure. Triage runs on every message, so a chat that starts
  simple moves up to Opus when it turns into a deliverable; it never moves down. High-stakes finance work (chart of
  accounts, GAAP and IFRS, business or value cases, consolidation, CECL) skips triage and runs on Opus for the lead and
  every specialist. Otherwise quick files and calculations, specialists, workflow phases and single-agent chats run on
  Sonnet; workflow synthesis runs on Opus; images are read by Haiku. The **Opus** switch in the header puts every step
  on Opus. If triage fails, the deliverable rule decides. Every model call is priced at list price: the Token
  usage page shows the estimated cost per chat and per model, and the host log ends each run with
  `models: <model> calls= in= out= cache= usd=`. `VOLT_ROUTING=off` puts every step on the Opus-tier model;
  `VOLT_MODEL_HAIKU`, `VOLT_MODEL_SONNET` and `VOLT_MODEL_OPUS` (or `VOLT_MODEL`) change a tier's model.
- `VOLT_PLUGIN_DIR` points at a different copy of the plugin (default `../../plugins/volt`).
- `VOLT_TEMPLATE_DIR` is where uploaded templates and their profiles are kept (default `data/templates`, git-ignored).

## Research engine (URES v1)

Every deliverable is built to be audited, not just read. A run is classified Quick, Standard, Deep or Exhaustive from the request's wording, and the answer must stand on evidence the console can check.

- **Source register.** Each tool result the agents can rely on (an APQC benchmark, a calculation, a VOLT skill pack) is recorded with a key (`S01`, `S02`, ...) and returned to the model with that key. `S01` is always the client's own request. The model may cite only those keys; anything unsupported must be tagged `[INFERENCE]` or `[ASSUMPTION]`. The register is appended to every download from the record, not written by the model.
- **Confidence.** Findings carry `(Confidence: HIGH|MEDIUM|LOW, as of YYYY-MM)` from `0.40 evidence + 0.25 source quality + 0.20 recency + 0.15 agreement` (`shared/research.ts`).
- **Gates, checked by code** on every draft: G1 citation (no keys outside the register, few uncited figures), G2 source diversity, G3 contradictions, G4 confidence and residue, G5 method and gaps, G6 deliverable. A failed draft goes back once with the gate messages. The run header shows `tier, sources, gates passed`.
- **Output.** A sixth section, `## 6. Evidence and method` (scope and method, evidence map, contradictions, gaps, residue), and a **Research bundle (.zip)** download: query, full report, executive brief, contradictions, residue, `sources/registry.jsonl`, gate results and the search log.
- **Web sources** are opt-in: set `VOLT_WEB_RESEARCH=on` to give every agent Claude's `web_search` and `web_fetch`. Each page found or read joins the register with its URL, and when the answer cites a page through the API's own citations, the console adds that page's key after the sentence. A key therefore always points at a page that was retrieved; the model is told never to type a URL, and to search before marking anything `[Verify]`. Cost: USD 10 per 1,000 searches plus tokens (a fetch costs only tokens). `VOLT_WEB_MAX_SEARCHES` (default 20) is a soft cap per run, so about USD 0.20 of searches at most. The organisation's admin must also allow web search and web fetch in the Claude Console.

Not built: BUILD mode (generating a skill package), parallel retrieval by axis, the four adversarial critics, and per-domain source ladders. The gates and one review pass stand in for the critics.

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

## Access control

The API listens on `127.0.0.1` by default. To expose it (a Codespaces Public port, a shared host), set a token first:

| Variable | Effect |
|---|---|
| `VOLT_HOST` | Bind address. Anything other than loopback needs `VOLT_ACCESS_TOKEN`, or the server refuses to start. |
| `VOLT_ACCESS_TOKEN` | At least 16 characters. Every `/api` route except `/api/healthz` then needs `Authorization: Bearer <token>`, or the cookie that `GET /api/login?token=<token>` sets (open that URL once in the browser). |
| `VOLT_AUTH_MODE` | Default `token`. `username` switches the sign-in screen to a username with NO secret and lets a public bind start without a token. Anyone who can reach the URL can then use the Claude API key, so use it only where the host already restricts access. If `VOLT_ACCESS_TOKEN` is also set it still works as a Bearer token. |
| `VOLT_ALLOWED_USERS` | Optional, with `VOLT_AUTH_MODE=username`: comma-separated names allowed to sign in (case-insensitive). A guessable list, not a password. |
| `VOLT_ALLOWED_ORIGINS` | Comma-separated extra origins allowed to make write requests. Same-origin is always allowed. |
| `VOLT_RATE_LIMIT` | Requests per minute per client on the routes that spend Claude tokens (default 30). |

Conversation ids are issued by the server, expire after 6 hours idle, and only one run can use a conversation at a time.

## Test

```bash
npm test            # catalog, routing, Skill Finder, analytics, tool schemas, and the live agent loop against a mocked Messages API
npm run typecheck
```
