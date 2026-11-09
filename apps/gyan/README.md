# Gyan — VOLT's chat-first AI workbench

Gyan is the live, chat-first web client for VOLT's specialist agent platform. One
prompt in; a live plan, an engaged agent squad, and streamed client-ready work
product out — architecture diagrams, financial models, close calendars, COA
designs, regulator-ready narratives.

## What it does

- **Chat-first orchestration** — plain REST `POST /api/chat` streaming NDJSON
  (`run` / `delta` / `done` / `error`). Hono + AI SDK `streamText`; the model id
  is resolved from the gateway's `listModels()` at runtime, never hardcoded.
- **Full specialist registry** — mirrors `plugins/volt/data/agents.json`
  (client-facing specialists across service lines; platform-internal agents are
  excluded at generation time). Generated data lives in `api/data/catalog.json`
  and `src/data/service_lines/` (chunked) — both produced from the same registry
  by one script so they cannot drift.
- **Dedicated model layer** — `api/data/models.json` defines the model registry
  (core orchestration model, dedicated Mistral fine-tunes for deep-domain topics
  such as OSFI/BCAR, COA design, SEC reporting, IFRS 9, ERP configuration, IFRS 17,
  revenue recognition, close/consolidation, tax, SOX, plus a retrieval-backed
  benchmark data service) and the agent→model backing map. The engaged squad's
  model is surfaced in the UI and in every streamed run event.
- **Marketplace** — every specialist browsable by service line, with triggers,
  tools, and the model each agent runs on.
- **Client-ready output** — streamed markdown with charts (Chart.js), Mermaid
  diagrams, and one-click export to Word/Excel/PDF/HTML/Markdown from chat and
  from the Studio view. Every answer follows the client-first contract: the
  polished deliverable leads (Decision Brief and verified deal perimeter first
  for named transactions), and all working evidence (squad plan, agent flow,
  assumptions/risk registers, decisions, data lineage, claim register) closes
  the answer under an Appendix. Word exports use real heading styles and an
  auto-updating table of contents.
- **Chat history** — conversations persist in `localStorage` (quota-safe,
  debounced, capped) so a refresh never loses work; when signed in they also
  sync to the per-user server history (`conversations` table, auto-provisioned
  on first use), so history follows the user across browsers and devices. The
  history panel labels which copy it is showing.

## Layout

```
api/                 Hono server (boot.ts), routes, AI orchestration
  ai/volt.ts         registry matcher, system prompt, verification contract
  ai/depth.ts        domain depth packs (banking M&A, R2R, IFRS 9, P2P, ERP, TP)
  data/              catalog.json, models.json (generated from the registry)
  builder/           VOLT Builder core — spec schema + G0 (spec.ts), isolated
                     workspace (workspace.ts), scaffolder (scaffold.ts),
                     spec compiler (compiler.ts), gate runner G0–G4 (gates.ts),
                     codegen agent loop with one-repair policy (codegen.ts),
                     per-user history persistence (store.ts), service endpoints
                     (routes.ts, /api/builder, authed; spec/build/gates/status/
                     sessions/preview); all vitest-covered
src/components/volt/BuilderView.tsx
                     Builder surface — spec review, live build ticker, gate
                     report, file browser, dist preview, Studio hand-off
src/                 React client (Vite + Tailwind + shadcn/ui)
  components/volt/   chat, run cards, marketplace, studio, charts, mermaid
  data/              service_lines/ (chunked), layers.json (generated)
contracts/           shared client/server types
scripts/e2e.mjs      end-to-end suite (Playwright, against the prod bundle)
```

## Running

```bash
npm install        # never upgrade the pinned ai / @ai-sdk/* packages
npm run build
PORT=3111 node dist/boot.js
```

Server-side env (never commit real values — see repo `.env.example` policy):

- `KIMI_AGENTGW_BASE_URL`, `KIMI_AGENTGW_API_KEY` — model gateway
- `PORT` — listen port

## Tests

```bash
npm run build && node scripts/e2e.mjs
```

Covers hero/marketplace claims, the dedicated-model layer (drawer + run cards),
chat streaming, persistence, Studio, and a console-error gate.

## Data flow for registry updates

`plugins/volt/data/agents.json` → generator → `api/data/catalog.json` +
`src/data/service_lines/` chunks (+ `api/data/models.json` backing map when the
model layer changes). Edit the registry, regenerate, rebuild — never hand-edit
the generated files.
