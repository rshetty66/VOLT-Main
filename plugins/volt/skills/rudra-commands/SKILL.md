---
name: rudra-commands
description: Rudra's 100 slash commands for finance transformation work (/analyze, /compare, /recommend, /exec-summary, /fact-check, /workplan and more). Use when a request to Rudra or VOLT starts with a slash command such as "/compare SAP vs Oracle for a $2B insurer", or when the user asks which commands Rudra supports.
---

# Rudra commands

Shortcuts that tell Rudra, VOLT's orchestrator, exactly what kind of answer to produce. A request that starts with
`/<command>` runs that command; the text after it is the argument.

## When to Activate

- A message to Rudra or VOLT starts with a slash command, for example `/compare FCCS vs OneStream for a 40-entity group`.
- The user asks which commands exist, or types `/help` or `/commands`.
- Through `/volt:rudra` in Claude Code, or the Agent Console in the VOLT Console app.

## How It Works

1. Read [references/commands.md](references/commands.md) and find the row for the command.
2. If there is no such command, say so, suggest the closest two or three, and stop.
   For `/help` or `/commands`, list the 12 groups with three example commands each.
3. Do what the row says, applied to the argument and the client context so far. Everything else in Rudra's way of
   working still holds: route to VOLT specialists where the request needs them, load VOLT skill packs with the
   Skill Finder, and use VOLT's tools for benchmarks and financial maths instead of mental arithmetic.
4. Commands that set behaviour (`/focus`, `/context`, `/tone`, `/style`, `/length`, `/output-format`,
   `/preferences`) apply until the user changes them or runs `/reset` or `/clear`.
5. Commands can be chained in one message, in order: `/analyze then /recommend then /exec-summary`.

## Guardrails

- **Approval rows.** `/automate`, `/api`, `/integrate`, `/schedule`, `/trigger`, `/share`, `/email` and `/publish`
  produce designs and drafts only. Rudra never sends, publishes, schedules, connects to or changes an outside system
  unless the user explicitly approves that specific action in the conversation.
- **No invented facts.** Every figure, benchmark or regulatory reference needs a source or a tool result. Label
  estimates as estimates and show how they were derived.
- **Not Claude features.** These are Rudra's commands, defined in this skill. They are not built-in Claude or Claude
  Code commands, and they do not change Claude's own settings.

## Examples

- `/compare Oracle FCCS vs OneStream for a 40-entity insurer on IFRS 17` returns a scored comparison table on cost,
  fit, risk and time to value, then a one-line verdict.
- `/challenge` after a recommendation returns the CFO's and auditor's strongest objections and the evidence that
  would answer them.
- `/exec-summary` after a long analysis returns a one-page summary: answer first, three supporting points, the asks.
- `/email the steering committee with this week's status` returns a draft with subject and body, marked as a draft
  that Rudra will not send.
