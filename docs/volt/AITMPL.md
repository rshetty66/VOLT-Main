# aitmpl components in VOLT-Main

Components adopted from the [aitmpl.com](https://www.aitmpl.com) catalog after a source review. The source is the
community repository `davila7/claude-code-templates`, MIT licence (copy in
`.claude/hooks/LICENSE-claude-code-templates`), pinned at commit `5cc17cf267132cc690dee82239b80a99ec82e4f8`. Every
file below was read in full before it was added. Nothing was installed with `npx`.

## Adopted (14)

| Component | Where | Changed? |
|---|---|---|
| agents: ai-agent-audit-specialist, compliance-auditor, fact-checker, data-researcher, research-synthesizer, risk-manager, quant-analyst, fintech-engineer, data-engineer, data-analyst | `.claude/agents/` | Added a "VOLT rules" block and a source line after the frontmatter; body unchanged apart from whitespace |
| hooks/security/subagent-read-only-guard | `.claude/hooks/subagent-read-only-guard.py` | Unchanged; called through `scripts/volt/hooks/readonly-agents.js` |
| hooks/quality-gates/tdd-gate | `.claude/hooks/tdd-gate.sh` | Unchanged; runs only when `VOLT_TEAM=1` |
| hooks/quality-gates/scope-guard | `.claude/hooks/scope-guard.sh` | Unchanged; runs only when `VOLT_TEAM=1` |
| settings/hooks/subagent-lifecycle-logger | `scripts/volt/hooks/subagent-log.js` | Rewritten (see below) |
| settings/permissions/stripe-mcp-confirm-writes | `.claude/settings.json` `permissions.ask` | Unchanged rules |

## Why the changes

- **VOLT rules in each agent.** Each agent ships sample progress and delivery reports with invented results (for
  example "98% compliance score", "2.3 Sharpe ratio"). The rules tell the agent to cite a source for every figure, never
  to repeat the sample numbers, and never to write to an ERP, ledger or payment system.
- **Read-only guard, scoped.** As shipped it blocks writes for every subagent, which would stop VOLT agents that write
  deliverables and the agent-team builder. The wrapper applies it only to `code-auditor`, `ai-agent-audit-specialist`,
  `compliance-auditor` and `data-researcher`, or to the comma-separated list in `VOLT_READONLY_AGENTS`. For those agents
  it fails closed.
- **tdd-gate and scope-guard, team only.** tdd-gate keeps a session from finishing until the full suite passes, and
  this repo's full suite is slow; scope-guard searches the whole tree on every stop and keys off `.spec.md` files VOLT
  does not use. Both run only in agent-team sessions (`VOLT_TEAM=1`). Note that tdd-gate treats files under `scripts/`
  as non-production, so it gates code elsewhere (for example `apps/` and `src/`). Turn it off for a project with
  `.claude/tdd-gate.off`.
- **Lifecycle logger, rewritten.** The original reads `$CLAUDE_AGENT_NAME`, which Claude Code does not set, so every
  line would read "unknown". The rewrite records `agent_type`, `agent_id` and `session_id` from the hook input into
  `.claude/agent-log.jsonl` (git-ignored). It is not tamper-evident; hash chaining is a possible next step.
- **Stripe confirm-writes.** Inert until a Stripe MCP server named `stripe` is added. It is also the pattern to copy
  when VOLT gets journal-posting or ERP-write tools: list each write tool under `permissions.ask`.

## Not adopted (7)

| Component | Reason |
|---|---|
| skills/document-processing/xlsx-official | Anthropic's own skill under a proprietary licence; not redistributable. Already available here through the `document-skills` plugin |
| hooks/monitoring/langsmith-tracing | Sends full conversation traces, which can include client finance data, to an outside service |
| mcps/devtools/stripe | Needs a Stripe account and moves money |
| mcps/integration/alphai | Needs a paid account and key |
| mcps/database/dbhub | No database is configured for this repo |
| hooks/security/ai-bash-guard | Calls Claude on every Bash command (spend), and overlaps `scripts/volt/hooks/team-guard.js` |

## Tests

`node tests/volt/aitmpl-hooks.test.js` covers the read-only scoping and fail-closed path, the logger, the
`VOLT_TEAM` gating of tdd-gate and scope-guard through the exact commands in `.claude/settings.json`, and the Stripe
ask rules.
