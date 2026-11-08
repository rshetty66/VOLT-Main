# CopilotKit in the VOLT Console

Developer handoff. This page says where CopilotKit lives in VOLT-Main, what it does today, what it does not do,
and how to run and change it.

Scope: everything below is on `main`. All CopilotKit code is under `apps/volt-console/`. Nothing under
`plugins/volt/` or the ECC harness uses it.

## What it is

The Finance Workbench tab of the VOLT Console has a chat popup, "Workbench copilot (CopilotKit)". The copilot
sees the workbench state and operates the workbench through the same buttons a person would use. It runs on
Claude through a self-hosted CopilotKit runtime. No CopilotKit Cloud account is used.

The popup loads only in live mode (a valid `ANTHROPIC_API_KEY` and the demo toggle off). In demo mode the
CopilotKit bundle is never downloaded.

## File map

| Path | Role |
|---|---|
| `apps/volt-console/server/copilotkit.ts` | Runtime. Defines the agent, its system prompt and model, and mounts `/api/copilotkit`. |
| `apps/volt-console/src/components/workbench/WorkbenchCopilot.tsx` | Browser side. Popup chat, shared state, frontend tools, figure confirmation. |
| `apps/volt-console/src/components/workbench/Workbench.tsx` | Loads the copilot lazily in live mode and provides the actions its tools call. |
| `apps/volt-console/server/index.ts` | Mounts the runtime in the Express API, before the JSON body parser. |
| `apps/volt-console/server/env.ts` | Turns CopilotKit telemetry off by default. |
| `apps/volt-console/tests/copilotkit.test.ts` | Tests for the runtime. |
| `apps/volt-console/package.json` | CopilotKit versions and the `overrides` that pin patched sub-packages. |
| `apps/volt-console/vite.config.ts` | Proxies `/api` to the API port so the popup reaches the runtime in development. |
| `apps/volt-console/README.md` | Section "Workbench copilot (CopilotKit)". |
| `docs/volt/releases/volt-0.2.0.md` | Release notes that mention it. |

Files that look similar but are about GitHub Copilot, a different product, and are unrelated:
`.github/copilot-instructions.md`, `.github/ISSUE_TEMPLATE/copilot-task.md`,
`scripts/lib/install-targets/copilot-project.js`, `scripts/lib/install/copilot-agent.js`,
`tests/docs/copilot-support.test.js`, `tests/lib/copilot-install-target.test.js`.

## Capabilities in use

| Capability | Behavior | Where |
|---|---|---|
| Self-hosted runtime | Runs inside the Express API at `/api/copilotkit`, live mode only. | `server/copilotkit.ts` |
| Built-in agent on Claude | One agent named `default`, model `claude-opus-5-5`, up to 8 steps and 8,000 output tokens. | `server/copilotkit.ts` |
| System prompt as guardrails | Never invent figures. Every number must come from a document the workbench has checked against its page. Never set an approver name or sign anything off. | `server/copilotkit.ts` |
| Popup chat | `CopilotPopup`, closed by default. | `WorkbenchCopilot.tsx` |
| Shared application context | `useAgentContext` gives the agent the workbench state: data mode, source document, figures with page and quote, proofs. | `WorkbenchCopilot.tsx` |
| Frontend tools | `go_to_step`, `find_filings`, `extract_figures`, `check_figures`, `validate_journals`. Each calls a workbench action. | `WorkbenchCopilot.tsx` |
| Human-in-the-loop | `confirm_figures`: the agent proposes figure ids, and only the person can accept them. | `WorkbenchCopilot.tsx` |
| Lazy loading | The CopilotKit bundle is split out and loaded only in live mode. | `Workbench.tsx` |
| Privacy settings | Telemetry off. Developer inspector off, because it would fetch from `cdn.copilotkit.ai`. | `server/env.ts`, `WorkbenchCopilot.tsx` |

## Offered by CopilotKit, not used here

- Other chat layouts: `CopilotChat` (full page) and `CopilotSidebar`.
- Components as tools (generative UI): the agent renders your own React components from its output.
- Threads Drawer for saved conversations. This needs CopilotKit Intelligence.
- CopilotKit Intelligence: hosted saved threads and live streaming, plus Automatic Learning. It needs a CopilotKit
  account and sends run data to CopilotKit servers. Not used on `main`.
- Inspector: a developer debugging panel. Disabled for privacy.
- Other agent frameworks, such as LangGraph, in place of the built-in agent.
- Headless UI: build a custom chat surface.

Only these topics were reviewed against CopilotKit documentation pages: React single-page app, runtime endpoints,
Intelligence, the Threads Drawer, tool-based generative UI, readables, the Inspector and Automatic Learning. Check
the current CopilotKit documentation before relying on anything beyond them.

## Run it locally

```bash
cd apps/volt-console
npm install
cp .env.example .env     # then set ANTHROPIC_API_KEY (use .env, not .env.txt)
npm run dev
```

Open `http://localhost:5173`, go to the **Finance Workbench** tab, and open the popup. The API log should print
`live mode`. Keep the demo toggle off.

Tests: `npm test` in `apps/volt-console`.

On Windows, make sure the file is named `.env`. Notepad often saves it as `.env.txt`, which the app ignores and
which the repository does not git-ignore.

## Known gaps and risks

- Version: the console pins CopilotKit 1.79.1. Version 1.84.1 was current when this page was written. Upgrading
  means revisiting the `overrides` in `package.json`.
- No audit trail: copilot conversations are not saved, so there is no durable record of who confirmed which figure.
  Intelligence threads would provide one, with the data-sharing trade-off above.
- No user identity: the runtime does not know who is calling it. Anyone who can reach the console can use the
  copilot, and each call spends the API key.
- Single surface: the copilot works only in the Finance Workbench. The other tabs do not use CopilotKit.
- Secrets: never commit `.env` or any `.env*.txt` file. An env file was once committed to `main` by accident, and
  any key it held must be treated as exposed.
