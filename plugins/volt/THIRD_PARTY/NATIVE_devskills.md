# Native skills — engineering practice + credit risk modelling

7 skills written for this repository. **Nothing is vendored here** — no text was copied from
any external project.

- **Authored:** 2026-08-25
- **License:** same as this repository (first-party).

| Skill | Category | What it covers |
|---|---|---|
| `rfc` | Engineering Practice | When an RFC is warranted, the 8 required sections, and a VOLT-specific review table (streaming, degradation, checkpoints, egress, writes, token budget) |
| `adr` | Engineering Practice | Immutable dated decision records with an explicit **Ceiling** subsection; append-only + supersede rule; the 6 VOLT decisions that already deserve one |
| `changelog` | Engineering Practice | `- [scope] Imperative description (#PR)` entries, Keep-a-Changelog categories, cutting a release |
| `git-workflow` | Engineering Practice | Branch naming, conventional commits sharing the changelog scopes, agent permission boundaries, worktree gotchas, reflog recovery |
| `fastapi-crud-endpoint` | Engineering Practice | `APIRouter` conventions, Pydantic contracts, `DATA_ROOT` persistence, graceful degradation, async-vs-sync and SSE, registration in `api/main.py` |
| `recharts-chart` | Engineering Practice | The app's exact dark-slate palette, grid/axis/tooltip values, `ResponsiveContainer` sizing, the `ChartData` contract, empty-data and a11y handling |
| `credit-risk-modelling` | Financial Services | Building and validating a PD model or scorecard: target definition, leakage, WOE/IV, logistic baseline, AUC/KS/Gini, calibration, cut-off, strategy table |

## Why native rather than vendored

The prompt for this work pointed at
[pkiage/tool-credit-risk-modelling](https://github.com/pkiage/tool-credit-risk-modelling)
(specifically its `CLAUDE.md`) as the source for the dev-practice skills.

**That repository publishes no LICENSE file.** With no licence grant, copying its text into
this codebase would be a redistribution we have no permission for — and a client
deliverable is exactly the wrong place to carry unlicensed third-party text. So the six
engineering-practice skills were written from scratch against *this* codebase's real
conventions, which is the more useful outcome anyway: they cite `api/graph/build.py`,
`visual-outputs.tsx`, `DATA_ROOT`, and the SSE streaming constraint instead of generic
advice.

`credit-risk-modelling` covers the same subject matter as that repository's Streamlit app
(PD modelling, WOE/IV, scorecards, threshold selection) as domain knowledge, expressed
independently and pointed at this codebase's dependencies (`pandas`, `scikit-learn`, both
already in `requirements.txt` — no new dependency).

Facts about credit risk modelling — that WOE is `ln(bad_share/good_share)`, that Youden's J
maximises `TPR − FPR`, that Gini is `2·AUC − 1` — are not copyrightable and are standard
practice. The prose, structure, thresholds, and every VOLT-specific instruction are original.

## Differentiation from existing skills

Three existing skills sit near the new ones. Each new skill states its boundary in its own
body; in summary:

| Overlap | Resolution |
|---|---|
| `credit-analysis` (vendored, MIT) — assessing one borrower, credit memo, 5 Cs | `credit-risk-modelling` **builds the model**; `credit-analysis` **judges a borrower** |
| `ecl-computation` (vendored, MIT) — IFRS 9 / CECL provisions from PD/LGD/EAD, and its description mentions "credit risk modeling" | `ecl-computation` consumes a PD; `credit-risk-modelling` produces and validates one |
| `changelog-generator` (existing) — generating release notes from commit history | `changelog` is the **format and discipline** for the file: entry shape, scopes, when to add, how to cut a release |

## Reference files

Runnable or copy-paste starting points, not prose:

- `rfc/references/rfc-template.md`
- `adr/references/adr-template.md`
- `changelog/references/changelog-template.md`
- `fastapi-crud-endpoint/references/router-template.py`
- `recharts-chart/references/chart-template.tsx`
- `credit-risk-modelling/references/pd_model_scaffold.py` — runs end to end
  (`python skills/credit-risk-modelling/references/pd_model_scaffold.py`) and asserts the
  pipeline is sane: OOT AUC in a believable band, WOE coefficient signs all positive,
  predicted level within 2pp of the observed bad rate.

These are reachable to the agent at runtime through the `read_skill_resource` tool; the skill
loader itself only reads `SKILL.md`.
