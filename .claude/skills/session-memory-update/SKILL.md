---
name: session-memory-update
description: Update the repo memory files at the end of a session or before any compaction, so nothing depends on the conversation summary.
---

# Session memory update

## When to Use

Before a session ends, before any compaction, and whenever Rakesh asks to save state.

## How It Works

Inputs: the facts, preferences, decisions and deadlines Rakesh stated this session; the work done.

1. `memory/MEMORY.md`: update pointers only. Keep it a short index, not a dump.
2. `memory/open-loops.md`: add new unfinished items with today's date; mark finished ones `[x]` with the date.
   Never delete an open item without saying so.
3. `memory/decisions.md`: append each decision as `- <date>: <decision>. Reason: <one line>.`
4. `memory/log/<YYYY-MM-DD>.md`: a few lines on what was done, what changed, what is still open. Append if it exists.
5. Copy names, numbers and identifiers exactly (PR numbers, paths, function names, env var names).

Done criteria: every new decision, open loop and deadline from the session appears in a file; no loop vanished; no
secret, key, password or payment detail is in any file; `node scripts/ci/check-unicode-safety.js` passes.

## Examples

`- 2026-11-24: Cost work paused until the end. Reason: Rakesh wants the finance brain done first.`

## Pitfalls

- Turning MEMORY.md into a transcript.
- Paraphrasing an identifier instead of copying it.
- Writing a secret or a token into a log.

## Change log

- 2026-11-24: created.
