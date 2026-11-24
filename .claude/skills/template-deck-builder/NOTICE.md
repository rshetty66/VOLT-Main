# Template Deck Builder (third-party skill)

- Source: https://github.com/OneWave-AI/claude-skills, folder `template-deck-builder`, commit
  b2267d9171af4f56848d82992381b20b89b44056.
- Licence: MIT, copied unchanged in `LICENSE` beside this file.
- Copied unchanged: `SKILL.md`, `references/`, `scripts/` and `tests/` (plain Python, about 110 KB, no binaries).
- Read before adding: the scripts make no network calls. `qa_deck.py` starts LibreOffice (`soffice`) and
  `pdftoppm` through `subprocess` to render slides for its visual check, and nothing else. They need
  `python-pptx`. The scripts were not run when the skill was added.
- Why VOLT has it: it builds decks inside a client's own .pptx or .potx template (layouts, placeholders, theme
  fonts and colours), with action titles, a pyramid storyline and a rendered QA pass. No other skill in VOLT-Main
  covers binding to a client template.
