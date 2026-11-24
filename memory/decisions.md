# Decisions

Append only: date, decision, one-line reason.

- 2026-11-24: Peer search and the duplicate CoA app removed (PR 89). Reason: clutter; not part of the finance brain.
- 2026-11-24: IFRS is the primary ledger, with GAAP difference ledgers. Reason: multi-GAAP FS clients report on IFRS.
- 2026-11-24: Use-case order is close, segment profitability, FP&A, ops reports. Reason: Rakesh's priority.
- 2026-11-24: Knowledge packs are scored by an exam, not by fine-tuning. Reason: checkable quality without training cost.
- 2026-11-24: Cost work paused until the end. Reason: Rakesh wants the finance brain done first.
- 2026-11-24: The chat works from plain-word goals, not trigger words. Reason: Rakesh's instruction.
- 2026-11-24: Memory-first agent system adopted (planner, worker, verifier; repo `memory/`). Agent procedures go in
  `.claude/skills/`, not root `skills/`. Reason: root `skills/` is ECC's validated library and must stay unchanged.
- 2026-11-24: Impeccable (pbakaus/impeccable, Apache-2.0) installed as `.claude/skills/impeccable` (SKILL.md and reference only, no launcher or hook) and used as the front-end design standard for VOLT visuals. Reason: Rakesh asked for it.
- 2026-11-24: template-deck-builder (OneWave-AI/claude-skills, MIT) added as `.claude/skills/template-deck-builder`. Other suggested skill repos were not added: they duplicate VOLT skills (`mckinsey-visualization`, `storyline-builder`, `pptx-author`, `xlsx-author`) or Anthropic plugin skills, carry no licence, or are "All rights reserved". Reason: Rakesh asked for the skills without duplicates.
