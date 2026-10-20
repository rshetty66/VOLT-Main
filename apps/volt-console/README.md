# VOLT Console

A browser front end for the VOLT plugin: a React UI and a Node API that run VOLT's agents on the Claude API.
It reads `plugins/volt` directly, so the console and Claude Code use the same agents, workflows and skills.

```
React UI (Vite) --SSE--> Node API (Express) --> Claude Messages API (streaming tool loop)
  Console, Workflows       orchestrator.ts        Rudra -> consult_agent x N (parallel)
  Agents, Skill Finder     tools.ts                     -> find_agents / find_skills / load_skill
  Services, Analytics      catalog.ts  <-- plugins/volt (agents/*.md, skills/, data/*.json)
  Capability Health        analytics.ts (APQC benchmarks, maturity, NPV/IRR, value case)
```

## Views

| View | What it does |
|---|---|
| Agent Console | Rudra routes a request across the 236 agents, runs specialists in parallel and synthesises one deliverable. You can also chat with any single agent |
| Engagements | Client engagements with every run saved under them: reopen a run exactly as it streamed, download it as Markdown for review, or continue the conversation |
| Workflows | The 35 VOLT workflows with their intake questions. Phases run in order, agents in parallel within a phase, then Rudra synthesises |
| Skill Finder | Ranks the 378 VOLT skills against a task and opens any of them |
| Services | The 60-service catalogue with coverage ratings; each service launches its workflow |
| Analytics | APQC benchmark positioning and a finance transformation value case. Agents call the same deterministic tools for every figure |
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
- **Saved data.** Engagements, runs, their full event streams and lead-agent conversations are kept in an embedded
  Postgres (PGlite) in `VOLT_DATA_DIR` (default `apps/volt-console/.volt-data`, git-ignored). Runs survive restarts;
  a run cut off by a stopped server is marked as such on the next start. Delete the folder to start empty.
  Choose the current engagement in the top bar; new runs are filed under it.
- **Runs outlive the browser.** A run keeps going on the server, and is saved in full, if the tab is closed or
  refreshed or the laptop sleeps; reopen it from Engagements, where it updates while still running. Only the Stop
  button (`POST /api/runs/:id/stop`) halts a run.
- **Exports.** Every finished run downloads as a Word report (deliverable plus each specialist's output as an
  appendix), an Excel workbook (every table as a sheet, APQC benchmarks, and each value case the agents ran rebuilt
  with live formulas), a PowerPoint board deck (section, table and specialist slides, full text in the speaker
  notes) or Markdown: `GET /api/runs/:id/export/docx|xlsx|pptx`.
- **Output templates.** The Templates view holds a library of brand profiles: logo (PNG or JPEG, up to 1 MB),
  primary and accent colours, heading and body fonts, header organisation, footer text and a confidentiality label.
  Choose one per engagement (or when creating it); its Word, Excel and PowerPoint exports then use it. Engagements
  without a template, or whose template is deleted, use the built-in VOLT standard. Each template has sample
  Word, Excel and PowerPoint previews.
- **Sign-in.** The first time the console opens it asks for an admin account; that admin owns any engagements
  and runs saved before sign-in existed. The admin adds people under Users with one of three roles: **admin**
  (everything, including people and all engagements), **consultant** (creates engagements, and runs, resumes and
  exports in the ones they own or are added to) or **viewer** (reads and downloads the engagements they are added
  to). Owners add people to an engagement from its People panel. Passwords (10+ characters) are stored as scrypt
  hashes; sessions are HttpOnly cookies that last 14 days from last use; five wrong passwords lock an account for
  15 minutes. Accounts are disabled rather than deleted, and the Users view shows recent activity from the audit
  log. If nobody can sign in, stop the server and run `npm run reset-password -- <email>`.
- **Cost control.** Every model call is priced from a price table (Anthropic list prices by default; editable
  under Usage) and the run's estimated cost shows live in the console, on the engagement page and in the Usage view
  (spend this month by engagement and person, the costliest runs, six-month trend). Before a run the console shows an
  estimate: the median of recent finished runs of the same kind, or a rough figure until there are some. A run stops
  at the per-run limit (default $10) or when its owner reaches their monthly budget (default $100; admins can give a
  person their own), with a warning at 80%; a stopped workflow keeps its finished specialists for Resume. Admins set
  the limits, the specialist model and the specialist step limit under Usage. To spend less, each agent's
  conversation is prompt-cached, later workflow phases get each earlier specialist's short handoff summary rather
  than its full output, and Rudra's synthesis uses a prompt without the 236-agent roster. Costs are estimates, not
  an invoice; runs saved before this change are costed at Opus list prices without cache writes.
- **Resume.** A stopped or failed workflow run can be resumed from its saved page: specialists that finished are
  reused as they are, only the unfinished ones run again, then Rudra writes the synthesis. The resumed run is saved
  as a new run in the same engagement; the original is kept.

## Test

```bash
npm test            # catalog, routing, Skill Finder, analytics, tool schemas, and the live agent loop against a mocked Messages API
npm run typecheck
```
