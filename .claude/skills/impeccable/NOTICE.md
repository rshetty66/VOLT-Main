# Impeccable (third-party skill)

- Source: https://github.com/pbakaus/impeccable (Paul Bakaus), version 4.10.0, commit
  b49177d32788f2dc585c42831d845dacf1ebed2c, folder `.claude/skills/impeccable`.
- Licence: Apache License 2.0, copied unchanged in `LICENSE` beside this file.
- Used in VOLT-Main as the front-end design standard for the VOLT console (charts, motion, HTML deliverables).

## What was copied

`SKILL.md` and `reference/` only.

## What was left out, and why

- `scripts/` (the `impeccable` launcher). It downloads and runs a binary on first use, which is not reviewed here.
  The skill handles this itself: without the launcher it follows its "Launcher unavailable" path and reads the
  project's files directly.
- The design hook and subagents from `npx impeccable install`. A hook runs outside model approval, so it needs its
  own decision.

## Changes made to the copied files

Emoji and two arrow glyphs were replaced with plain words (for example "Good:", "Bad:", "WARNING:", "<->"), because
VOLT-Main's `scripts/ci/check-unicode-safety.js` allows no emoji. No guidance was changed.

To update: copy the same two items from a newer release, repeat the emoji replacement, and update the commit above.
