# Design system

## 1. Design audit of the reference

Reference: SlidesCarnival "McKinsey Consulting Report" (CC BY 4.0, see `../NOTICE.md`), inspected on 2026-11-24 from
its public page and its 8 preview slides. The source .pptx was not downloaded, so layout geometry is estimated.

| Property | Finding | Basis |
|---|---|---|
| Palette | Blue `#0B6AE9`, ink navy `#121A5D`, white `#FFFFFF` | Observed: stated on the template page |
| Dark panels | Deep navy, sampled about `#10193A` | Estimated: sampled from preview images |
| Background | Soft grey-to-white gradient, about `#E9E9E9` to white | Estimated: sampled |
| Title font | Cardo (serif) | Observed: stated on the template page |
| Body font | Inter (Light on the page) | Observed: stated; VOLT uses Inter Regular for legibility |
| Accent motif | Small solid blue squares (bullets, corner marks, a row of three on the cover) | Observed in previews |
| Slide types seen | Cover, agenda/numbered points, text with panel, donut chart, histogram/bar chart, timeline, resources/credits | Observed in previews |
| Title style | Sentence case, left aligned, serif, one or two lines | Observed |
| Margins, sizes, spacing | About 0.6in side margins, 26pt titles, 14pt body | Estimated from previews at 16:9 |

## 2. Rules taken from the audit

- **Colour.** One accent (blue). Navy for titles and dark panels. Status colours only for status:
  teal `#0097A7` (built, green, low), amber `#E3A92B` (mapped, amber, medium), pink `#D6457F` (new, red, high).
  Every text and fill pair passes WCAG 4.5:1, checked by `scripts/build_template.py`.
- **Type.** Cardo for titles (26pt), section and cover titles (40pt), panel titles (24pt) and stats (32pt).
  Inter for headings (18pt bold), body (14pt), small (12pt), dense tables (10pt), source lines (10pt), footer (9pt).
  Nothing below 10pt.
- **Grid.** 13.333 x 7.5in. Margin 0.6in, gutter 0.25in. Title band 0.4 to 1.4in, content 1.6 to 6.6in, source line
  at 6.7in, footer at 7.08in (VOLT wordmark left, slide number right).
- **Motif.** Square bullets in the accent; a blue square to open a dark panel; three squares on the cover.
- **Brand.** VOLT wordmark only. No reference-template logos, photos or firm names.

All values live in `../assets/theme.json`. Change them there, not in the scripts.
