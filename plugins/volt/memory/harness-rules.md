# Harness rules (VOLT, user memory)

Installed into `~/.claude/` by VOLT-Main's `scripts/volt/setup-stack`, so it applies in every project.
For a full harnessed run, use `/volt:harness <task>`.

## Plan

- Start non-trivial work in plan mode and agree on the plan before editing.
- Write each step with one output and one check, the files it reads and writes, and whether it can run in parallel.
- Write the checks before the work.

## Context and tools

- Load only the context a step needs. Give subagents the step, its inputs and its check; take back paths, verdicts
  and evidence, not raw logs.
- A rule that must hold every time (format, lint, type check, blocked path) belongs in a hook or script, not in an
  instruction. List the project's hooks and scripts in its CLAUDE.md.
- Keep edits inside the agreed scope. Ask before publishing, sending or spending. Keep a recoverable version before
  risky changes. Never let two sessions edit the same file.

## Verify and correct

- Prove each step with real signals: tests, builds, type checks, screenshots, the actual output. Confidence comes last.
- A failed check sends that step back with the reason and the evidence, "fix this step only", at most three attempts.
- Never weaken a check to get a pass. Report failures and missing evidence plainly.
- When a mistake is caught or a correction lands, add the reusable rule to the project's CLAUDE.md.

## Hand off

- For multi-stage work keep `plan.md`, `checks.md` (step | requirement | verdict | evidence) and `progress.md`
  (done, running, blocked; output paths; decisions; open issues; next action).
- On resuming, read CLAUDE.md, plan.md and progress.md first, then continue from the recorded next action.
