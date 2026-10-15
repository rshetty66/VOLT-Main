# Vendored skills — LLMQuant

8 market & credit research skills vendored into `fastapi_ft/skills/` from the open-source
**LLMQuant/skills** project (36 files: 8 `SKILL.md` + 28 `workflows/*.md`). They are
auto-discovered by the skill loader (`agents.py` → `iterdir()` over `skills/*/SKILL.md`)
exactly like the first-party skills.

- **Source:** https://github.com/LLMQuant/skills
- **Commit:** `1918237467c2dff4cc97a18ebc0892dfd46e8129` (branch `master`)
- **Vendored:** 2026-08-25
- **License:** MIT (© 2026 LLMQuant and contributors) — full notice below, per the license terms.

No name collided with an existing skill, so nothing first-party was overwritten. The upstream
repo has ~20 skills; only the FS-relevant subset was taken.

## Vendored skills (8) and their workflows (28)

| Skill | `volt_desk` | Workflows |
|---|---|---|
| llmquant-credit | `credit` | 3 |
| llmquant-data | `data` | 4 |
| llmquant-events | `events` | 3 |
| llmquant-macro | `macro` | 3 |
| llmquant-market-intelligence | `market_intel` | 3 |
| llmquant-portfolio | `portfolio` | 5 |
| llmquant-rates-fx | `rates_fx` | 3 |
| llmquant-risk | `risk` | 4 |

## Modifications from upstream

Workflow bodies (`workflows/*.md`) are **pristine** — byte-for-byte upstream, so a re-sync
is a clean overwrite. Only `SKILL.md` frontmatter was changed, in three ways:

1. **`description:` retuned for VOLT retrieval.** `api/graph/skill_index.py` embeds only
   `name + description + category`, and `agents.discover_all_skills()` truncates
   `description` to 200 characters. The upstream descriptions are written for a human
   browsing a catalog; these are written to be *retrieved* — the vocabulary a user would
   actually type ("credit spread", "maturity wall", "covenant headroom"). Every description
   is under the 200-char truncation limit, so none is silently cut.

2. **`input_data_source:` annotated.** Upstream reads `LLMQuant Data`. These skills were
   written against a market-data feed that is **not connected in VOLT**, so the value now
   reads `LLMQuant Data (NOT connected in VOLT - see evidence gate)`. Without this the model
   reads the frontmatter as a promise of live data.

3. **`volt_desk:` added.** The slug that groups skills into a research desk. Read by
   `api/graph/desks.py`; a skill with no `volt_desk` key simply has no desk.

## How the workflows actually reach the model

VOLT's skill loader only ever opens `SKILL.md`. These skills are *routers* — their SKILL.md
is a table of links to `workflows/*.md`. Vendored alone, the model would be told a procedure
exists and could never read it. Two mechanisms close that gap:

- `api/graph/desks.py` parses each workflow into (title, use-when, required data, steps) and
  the research-desk sub-graph inlines the matched one or two into the composed system prompt.
- The `read_skill_resource` tool (`api/graph/tools.py`) lets the agent open any other
  workflow or reference file on demand, path-jailed to the skill folder.

## Evidence gate

These desks require market prices, credit spreads, CDS, ratings, rates curves, macro
releases, ETF flows, and filings — **none of which this deployment has**. The
`evidence_gate` node in `api/graph/nodes/research_desk.py` classifies each workflow's
required inputs into available (Oracle ERP mock ledger data, uploaded reconciliation files,
supplied financial statements, SharePoint/KB documents) and missing, and the composed prompt
names the missing groups. The desk is expected to answer with method and thresholds and to
state its gaps — not to invent a spread level.

## MIT License

```text
MIT License

Copyright (c) 2026 LLMQuant and contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Re-syncing

```bash
gh api repos/LLMQuant/skills/contents/<skill>/SKILL.md --jq '.content' | base64 -d
```

Overwrite `workflows/*.md` freely. For `SKILL.md`, re-apply the three frontmatter changes
above — or the desks stop resolving (`volt_desk` gone) and retrieval quality drops back to
the catalog-style descriptions.
