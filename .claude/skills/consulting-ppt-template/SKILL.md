---
name: consulting-ppt-template
description: Builds editable consulting-style PowerPoint decks (board packs, steering committee decks, business cases, finance transformation stories) on VOLT's consulting template, with takeaway titles, native charts, status tags and a rendered QA pass. Use when the user asks for a consulting-style, McKinsey-style or board-ready deck, says use the consulting PPT template, wants a VOLT deck re-laid out, or needs a slide rebuilt (architecture, roadmap, KPI, waterfall). Builds on template-deck-builder.
---

# Consulting PPT Template Builder

A layout library and design system for consulting decks, bound to VOLT's own template
(`assets/consulting-template.pptx`). The visual reference was a free SlidesCarnival consulting report template (see
`NOTICE.md`). No file, image or logo from it is used, and nothing here implies an affiliation with any firm.

This skill adds the layouts and the design system. Storyline, placeholder filling, charts and QA come from
`../template-deck-builder` (unchanged). VOLT's in-app export (`apps/volt-console/server/export/pptx.ts`) uses the same
colours, fonts, type scale and grid through `deckTheme.ts`, and a test fails if the two drift apart.

## When to Use

- "Use the consulting PPT template to build a 10-slide steering committee deck from these notes."
- "Turn this VOLT board pack into a consulting-style deck: keep every number, fix the layout."
- "Rebuild this architecture slide on the consulting template, with the status legend and the takeaway stats."
- A deck from VOLT needs re-laying out (too many slides, continuation slides, pictures where native charts fit).

Not for: a client's own branded template (use `template-deck-builder` with their file), or a non-PowerPoint output.

## Inputs

| Input | Required | If missing |
|---|---|---|
| Topic, objective, audience | Yes | Ask once |
| Decision the deck supports | Yes | Ask once; it shapes the last slide |
| Length | No | 10 to 14 slides |
| Source material (notes, data, an existing deck) | No | Use no numbers: label every figure "illustrative" |
| Branding | No | VOLT default (`assets/theme.json`) |

## How It Works

1. **Storyline.** Write the governing thought, then one takeaway title per slide: a full sentence that states the
   "so what", at most about 15 words and two lines. Topic labels ("Overview", "Roadmap") are not titles.
2. **Storyboard.** Pick a layout per slide from `references/layout-catalog.md` and write the storyboard JSON (format:
   `examples/demo-storyboard.json`). Show it to the user before building when the deck is new.
3. **Build.** `python3 scripts/build_deck.py <storyboard.json> -o <deck.pptx>` (defaults to the consulting template).
4. **QA.** `python3 ../template-deck-builder/scripts/qa_deck.py <deck.pptx> --storyboard <storyboard.json> --out-dir qa`
   renders every slide and writes `qa/contact_sheet.png`. Fix every ERROR; read every WARN; look at the contact sheet.
5. **Deliver** the .pptx and the contact sheet, with what was illustrative, estimated or changed.

To change the look, edit `assets/theme.json`, run `python3 scripts/build_template.py` (add `--potx` for a .potx), and
copy changed values into `apps/volt-console/server/export/deckTheme.ts`.

## Content rules

- Never invent results, figures, client facts or citations. With no data, write "Illustrative" on the slide and in
  the source line.
- Keep every number from the source exactly; when a label is completed or two items are merged, say so in the notes.
- One message per slide; a source line on every content slide; speaker notes say what the slide is for.
- Status tags only where the source states the status: `{built}`, `{mapped}`, `{new}` (or `{green}`, `{amber}`, `{red}`).
- No continuation slides for a source line alone. Fit, cut or merge before splitting.

## Storyboard additions over template-deck-builder

- `"cells"`: list of `{heading, bullets}`, mapped to placeholders 10+2k (heading) and 11+2k (body).
- Status tags in any text: `{new} General ledger` renders a coloured square before the text.
- Waterfall: `"chart": {"type": "waterfall", "categories": [...], "values": [...], "totals": [index], "number_format": "0.0"}`,
  built as a native stacked column (rises blue, falls pink, totals navy).
- Tables: `"status_fill": true` fills cells that are exactly a tag (for example `{red}`) with the status colour.

## Fonts

Headings use Cardo and body text uses Inter. If the viewer lacks them, PowerPoint substitutes and line breaks move.
Install both (free, Google Fonts) or set `fonts` in `theme.json` to Georgia and Arial and rebuild.

## Files

| Path | What |
|---|---|
| `assets/theme.json` | Design tokens: colours, fonts, type scale, grid, status colours |
| `assets/consulting-template.pptx` / `.potx` | The editable template: 17 layouts, one sample slide each |
| `scripts/build_template.py` | Builds the template from `theme.json`; checks colour contrast |
| `scripts/build_deck.py` | Builds a deck from a storyboard (wraps template-deck-builder) |
| `references/design-system.md` | Design audit of the reference and the resulting rules |
| `references/layout-catalog.md` | Every layout, its placeholders and content limits |
| `references/quality-checklist.md` | Pre-delivery checks |
| `examples/` | Example brief, demo storyboard and `sample-deck.pptx`, and the 5-day close storyboard |

## Change log

- 2026-11-25: First version. 17 layouts, waterfall and status tags, VOLT export aligned to the same design system.
