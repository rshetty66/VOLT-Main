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
- 2026-11-24: Files VOLT makes are built in the console with the existing writers (create_file returns the content, the chat shows a download card); no server file storage. Excel formulas are allow-listed (no HYPERLINK, WEBSERVICE, external links). PDF via print, no new dependency.
- 2026-11-24: Web research stays opt-in behind `VOLT_WEB_RESEARCH` (cost work paused). Web pages are cited only through the API's own citations, which the console maps to register keys, so a key always means a retrieved page. A soft cap of 20 billed searches per run (USD 10 per 1,000) applies. (PR #99)
- 2026-11-25: Consulting PPT Template Builder added as `.claude/skills/consulting-ppt-template` (17 layouts, design tokens in `assets/theme.json`), built on template-deck-builder (unchanged) rather than a new deck engine. VOLT's own PowerPoint export uses the same tokens via `server/export/deckTheme.ts`, with a test against theme.json. Visual reference: SlidesCarnival consulting report template (CC BY 4.0, credited in NOTICE.md); no McKinsey branding. Reason: Rakesh asked for the skill, then said VOLT's slide format was poor and wasted slides.
- 2026-11-25: VOLT PowerPoint export rule: no slide holds only a title and a source line; a source paragraph goes on its section's slides; short tables share a slide with the next chart; KPI tiles and RAG heatmaps are native; `checkPlan` validates every plan.
- 2026-11-25: Deck fonts are Georgia (headings) and Arial (body), not Cardo and Inter. Reason: Rakesh chose fonts every PC has, so slides render the same everywhere.
- 2026-11-25: VOLT's PowerPoint export draws every visual natively: waterfalls and process maps as shapes, target lines as dashed line series, highlights as one accented bar, combos with a second value axis. Pictures are only a fallback for a block that does not parse. Reason: Rakesh asked for editable charts (relayed by the coordinator).
