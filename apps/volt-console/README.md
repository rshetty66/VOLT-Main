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
| Finance Workbench | Six-step workbench over the `design-finance-architecture` skill, real data first. **Sources** finds an issuer's published statements (Claude web search), fetches and extracts the residential-mortgage figures, or takes an uploaded document; every figure is checked against its page (`verify_extraction.py`, 0 tokens) and confirmed by the maker. Journals are derived from confirmed figures; the synthetic golden case appears only after "Data not available: use illustrative example". Also: mapping prover (CSV), copyable evidence pack with source register, run-status chip, token meter. Two assistants side by side: an assistant-ui panel (questions, validation at 0 tokens) and, in live mode, a CopilotKit popup that operates the workbench's own buttons. Needs `python3` with `pypdf` on the server path (`VOLT_PYTHON` overrides) |
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

## Workbench copilot (CopilotKit)

In live mode the server mounts a self-hosted CopilotKit runtime at `/api/copilotkit` (`server/copilotkit.ts`): a built-in agent on
`claude-opus-5-5` using the same `ANTHROPIC_API_KEY`. No CopilotKit Cloud account is used. The browser registers the workbench's
actions as frontend tools (`find_filings`, `extract_figures`, `check_figures`, `validate_journals`, `go_to_step`) and shares the
workbench state; `confirm_figures` is human-in-the-loop, so only the person can accept a figure. The CopilotKit bundle is lazy-loaded
and never ships in demo mode.

- Telemetry to `telemetry.copilotkit.ai` is off by default (`COPILOTKIT_TELEMETRY_DISABLED=true`, set in `server/env.ts`).
- `package.json` `overrides` pin patched versions of transitive dependencies that CopilotKit 1.79.1 pulls in (`undici` 6.29.1,
  `@fastify/busboy` 3.2.3, `graphql-scalars` 2.0.1, `body-parser` 2.4.0, and every nested `zod` to the console's own 4.x), so
  `npm audit` reports no high or critical findings. Drop an override once CopilotKit ships the fixed version itself.
- The developer inspector is disabled (`enableInspector={false}`); it would otherwise fetch from `cdn.copilotkit.ai`.
- `web_fetch` (used to fetch a filing by URL) is refused by the API from network-restricted sandboxes; run the console on a normal
  host for that step. Web search and uploaded documents work everywhere.

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
