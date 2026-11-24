---
name: volt-change-validation
description: Validate any change to VOLT-Main before reporting it done or opening a PR, using the repo's own checks.
---

# VOLT change validation

## When to Use

After every change in this repo, before calling it done or pushing.

## How It Works

Inputs: the changed files (`git diff --stat`).

1. `node scripts/ci/check-unicode-safety.js` (no emoji or unsafe characters anywhere).
2. If anything under `plugins/volt/` changed: `node scripts/ci/validate-volt-plugin.js` and
   `claude plugin validate ./plugins/volt` (skip the second only when the CLI is not installed, and say so).
3. Markdown changed: `npx markdownlint-cli <changed .md files>`.
4. Scripts or hooks changed: `node tests/run-all.js`, or only the failing test files while fixing.
5. Generated paths (`plugins/volt/agents`, `commands/run-*.md`, `skills/`, `data/`, `THIRD_PARTY/`): change
   `plugins/volt/tools/import_volt.py` or the VOLT source, never the generated file.

Done criteria: each command that applies exits 0, and the report lists each command and its result.

## Examples

`node scripts/ci/check-unicode-safety.js` -> exit 0.

## Pitfalls

- Re-running the full test suite when only one file failed.
- Editing a generated skill by hand.

## Change log

- 2026-11-24: created.
