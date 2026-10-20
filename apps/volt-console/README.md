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

Production: `npm run build && npm start` compiles the server to `build/` and serves the built UI and the API
together on `PORT` (default 8787) with plain `node`, logging one JSON object per line.

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
  The deck and the workbook also chart the agents' tool results in the engagement's template colours: each APQC
  benchmark position (quartiles and the client) and each value case (net cash flow by year with the cumulative
  position). The deck shows Rudra's value cases first (up to three); the workbook's charts are bound to the live
  value-case cells, so they redraw when an input changes. Every plotted number comes from a tool result.
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
- **Restarts.** Runs execute inside the server, so a crash or restart interrupts them. On start, the server resumes
  each interrupted workflow run started in the last 12 hours as a new run, "(resumed after restart)", reusing the
  specialists that had finished; the owner's budget applies, and a chain of automatic resumes stops at three.
  Other runs are marked as stopped by the server. `VOLT_AUTO_RESUME=off` turns this off.
- **Resume.** A stopped or failed workflow run can be resumed from its saved page: specialists that finished are
  reused as they are, only the unfinished ones run again, then Rudra writes the synthesis. The resumed run is saved
  as a new run in the same engagement; the original is kept.
- **Settings check.** On start the server checks its settings (from the environment and `.env`) and stops with a
  clear list if one is wrong: a mistyped number, a model id with spaces, a key pasted with quotes, live mode
  without credentials, a data folder it cannot write. Names close to a real setting (`VOLT_RUN_BUDGET_UDS`) are
  warned about. `GET /api/readyz` reports the database, migrations, catalogue and credentials (503 if not ready);
  `GET /api/healthz` only says the process is up.
- **Protection.** Responses carry a Content Security Policy and the usual security headers (helmet). Requests that
  change data are refused (403) when the browser says they come from another site; list extra origins in
  `VOLT_ALLOWED_ORIGINS` if the console sits behind a different host name. Rate limits: 20 sign-in attempts a
  minute per address, `VOLT_RATE_LIMIT` API requests a minute per person (default 600), 20 runs and 60 uploads a
  minute per person. Behind a reverse proxy set `VOLT_TRUST_PROXY=1` so limits see client addresses.
- **Logs.** Readable lines in development, JSON lines in production (`VOLT_LOG_FORMAT=json|pretty`,
  `VOLT_LOG_LEVEL=debug|info|warn|error`). Every response has an `X-Request-Id`; changes and errors are logged with
  it, and each run logs its start and finish with its id, status, duration, tokens and cost. Prompts, file
  contents, keys and passwords are never logged.
- **Client data.** An engagement's owner or an admin can set how long its runs and client files are kept (30 days
  to 2 years, or until deleted); older ones are deleted at start and every six hours. They can also delete the
  engagement outright (typing the client name to confirm), which removes its runs, event streams, lead-agent
  conversations, client files and members. Spend from deleted runs still counts toward budgets. Threats and
  mitigations are in [docs/threat-model.md](docs/threat-model.md).

## Test

```bash
npm test            # unit and API tests, the live agent loop against a mocked Messages API, and a kill-and-restart check
npm run typecheck
npm run eval        # golden-prompt evals: every workflow against a mock Messages API (free, about 15 seconds)
npm run eval -- --live --workflow close-optimization --judge   # on Claude with your key, scored by Claude too
npx playwright install chromium   # once per machine, for the browser tests
npm run test:e2e    # the compiled console in a real browser, demo mode, on a temporary data folder
```

- **Evals.** `evals/golden.json` holds one fixed request per workflow, all for fictional clients. Each run goes through
  the console's own run pipeline on a throwaway database and is scored: it finished, every specialist finished, the
  deliverable has an executive summary, a recommendations table, risks and next steps, nothing printed `undefined`,
  plus (should) handoff summaries and the request's key terms. `--judge` adds a 1-to-5 Claude score on relevance,
  specificity, consistency and actionability (`VOLT_JUDGE_MODEL`, default `claude-sonnet-5-5`). Reports go to
  `evals/results/` and are compared with the previous run of the same mode; a failure or regression exits non-zero.
  Live runs cost about $2 each and need `--workflow` or `--all`.
