---
name: insurance-ft-lab
description: >-
  Build or adapt the interactive single-file "CFO Transformation Lab" HTML demo
  for an insurance finance-transformation / agentic-AI demo. Use when
  the user asks to "build the CFO transformation lab", "create the finance
  transformation demo", "make the insurance FT lab", "adapt the existing lab
  for [insurer]", "build a finance / agentic-AI demo for [insurance company]",
  "spin up the CFO lab for [carrier]", or references the CFO Transformation Lab
  template. Produces a self-contained, themeable interactive HTML app (Home,
  Finance Dashboard, IFRS 17 (PAA) Hub, Reconciliations, SOP Automation, Agent
  Runtime, AI Assistant, Live Demos, Process Taxonomy, North Star) tailored to
  the client's brand, regulator, products and REAL annual-report financials,
  with an AR/AP-led Recon demo. Do NOT use for generic HTML reports / one-pagers
  (use the html skill), slide decks (pptx), spreadsheets (xlsx), non-insurance
  demos, or real production ERP/reconciliation builds.
cowork:
  category: analysis
  icon: BuildingBank
disable-model-invocation: true
---

# Insurance CFO Transformation Lab

Build (or adapt) the CFO Transformation Lab — a single-file, interactive HTML demo that shows insurance finance transformation and agentic AI to a CFO/finance audience. Every figure shown is either the insurer's real annual-report actual or a clearly-labelled illustrative.

## When to Use

- The user names an insurer and wants the CFO/finance transformation demo, agentic-AI finance lab, or "the lab" built or re-skinned for them.
- The user asks to re-skin an existing lab for a different carrier.
- The user points at an existing `*_FTDemo.html` lab file and wants a version for another insurer.

## When NOT to Use

- Generic HTML report, invoice, or one-pager → use the `html` skill.
- Slide deck / pitch deck → pptx; spreadsheet / model → xlsx; Word doc → docx.
- A real reconciliation, ERP, or IFRS 17 engine build (this is a demo/prototype, not production).
- Any non-insurance client → use `finance-transformation-lab`.

## What it produces

One self-contained `.html` file saved to `output/<client>_FTDemo.html`. It is an interactive app — a fixed header, left sidebar nav, and ~10 tab panes, driven by inline handlers and a single inline `<script>`. It uses Chart.js from a CDN and Google Fonts, and its AI chat / SOP generator call the configured LLM endpoint (e.g. Bedrock), falling back to pre-built scenario answers offline. Keep that parity — do not try to force the strict self-contained HTML validator on it; validate by parsing instead (html5lib).

**Tabs** (keep this structure): Home (hero + KPI cards + live agent feed + charts) · Finance Dashboard (segment KPIs + by-segment table) · IFRS 17 (PAA) Hub (LRC/LIC roll-forward + liabilities table + capital/MCT card) · Reconciliations (8-step agentic loop + worked examples — the flagship) · SOP Automation · Agent Runtime/Catalog · AI Assistant · Live Demos (8 scenarios) · Process Taxonomy · North Star (target operating model — replaces any M&A tab for non-acquisitive insurers).

## Build workflow

1. **Start from the base template.** Use an existing generic `*_FTDemo.html` lab template in `input/` or `output/`, if the user provides one. It may be base64-wrapped (one `document.write(atob("…"))`). Decode it first with Python (`re` to grab the blob, `base64.b64decode`) into `working/decoded.html`, then read it in chunks (it is ~280-380 KB / ~3.5k lines). If no template exists, build the structure from this spec.

2. **Gather real client facts (never fabricate).** In parallel: `web_search` the client's latest annual report for headline financials (net income/result, premiums, combined ratio, capital ratio) and confirm the regulator, product lines, currency, fiscal year, and tech/ERP stack. Prefer the insurer's own filings and the regulator's site.

3. **Transform, don't hand-retype.** For a 300 KB file, adapt via a Python script of ordered string/replace swaps + a few multi-line block replacements, then iterate. Cover: branding & logo initials, colour palette (CSS vars + literal hex + rgba()), currency symbol, product-line names, regulator framing, tech-stack names, and the numeric swaps that put the client's real figures into the hero, sidebar KPI-mini, KPI cards, dashboard table, IFRS 17 tables, capital card, and the Chart.js data arrays/labels/tooltips.

4. **Insert the North Star tab** (see below), grounded in the SI reporting-&-analytics and ADKAR change-management frameworks (`enterprise-reporting-analytics`, `erp-adoption-change`).

5. **Tailor the Recon demo** to the client's real AR/AP and sub-ledger→GL pain; lead with it.

6. **Validate & deliver** (see Validation). Save to `output/<client>_FTDemo.html`; Glob to confirm.

## Per-client adaptation checklist

### Branding / theme
Company name everywhere, 2-letter logo mark, brand palette. Recolour the `--accent` and highlight CSS variables, the literal hex in Chart.js configs, and rgba() tints. Watch for a colour used as a sentinel in JS (recolour the value, keep the variable name or rename it consistently). Logo text contrast: white on a dark brand colour.

### Currency
Convert the symbol and drop any dual-currency secondary values; report in the client's functional currency.

### Products / lines of business
Map the template's placeholder lines of business to the insurer's actual reporting segments, using the segment names from its own filings (e.g. personal vs commercial lines, or compulsory vs optional coverage for a public auto insurer).

### Regulator (the trickiest variable — get it right)
See the mapping table. Swap the badge, the capital card, SOP/agent steps, and the AI system-prompt accordingly.

### Financials
Paste the client's REAL headline numbers from their latest annual report into the hero, KPI cards, dashboard, capital card, and chart data. Put a data-provenance banner on Home stating which figures are actuals (with the source) and that operational metrics and line-level LRC/LIC splits are illustrative. Anchor illustrative roll-forwards to real opening/closing balances so they tie.

### ERP / finance core
If unknown or a blank slate (no entrenched Oracle/SAP), use a generic "ERP" placeholder — do not name a vendor. Fit AI tooling to the client's cloud of record (e.g. AWS/Bedrock if their core platforms already run on AWS).

### North Star tab
If the template has an M&A/Due-Diligence tab and the insurer is not acquisitive (e.g. a public monopoly insurer), replace it with a target-operating-model tab: current-state signals, current-vs-target architecture, an AWS/cloud-anchored Source-to-Report flow, a capability-layer table, a reporting-&-analytics operating model (semantic layer / single source of truth / self-service BI), an ADKAR adoption plan, and a 3-horizon roadmap. Recommend starting with Recon as the proof-of-value.

### Recon demo
Lead with the client's real reconciliation pain (often semi-manual AR/AP with Excel/manual GL bridges); cover premium, cash/bank, claims, reinsurance and sub-ledger→GL, each with a worked example and an automation-% target. Name the client's actual source systems.

### AI system prompt + scenarios
Rewrite the embedded `SYSTEM_PROMPT`, the pre-built `DEMO_SCENARIOS`, and the quick-question buttons to the insurer's facts and regulator.

## Regulator mapping (common cases)

| Client type | Rate/prudential regulator | Capital test | Filing / notes |
|---|---|---|---|
| Federal Canadian P&C insurer | OSFI | MCT | P&C-1 return, DCAT/FCT |
| Provincial public (Crown) auto insurer | Provincial rate regulator for compulsory coverage + provincial financial regulator (may adopt OSFI's MCT) | MCT, if adopted | Provincial capital-management requirements; typically no OSFI P&C-1 return |
| UK insurer | PRA / FCA | Solvency II SCR | Not MCT |
| US P&C insurer | State DOI + NAIC | NAIC risk-based capital | Not MCT |

Confirm the specific client's framework before writing; do not assume from country alone.

## Output format

A single interactive `output/<client>_FTDemo.html`, plus a short chat summary of what's client-specific (financials, regulator, products, tech, North Star, Recon) and the two caveats: (1) it needs connectivity for charts/fonts and the live AI chat (offline → scenario fallback); (2) every number is an actual or a clearly-labelled illustrative.

## Guardrails

- **Never fabricate** financials, names, or regulator facts. Missing → clearly-marked placeholder or labelled illustrative; state the source for every real figure.
- **Validate before claiming done**: parse the file with html5lib (it must not raise); then grep for leftover template tokens — template branding, prior regulator (OSFI/PRA/…), prior ERP (Oracle/SAP), prior currency, prior product lines, and any `§sentinel§` placeholders from the transform. Fix all before delivering. Confirm via `Glob output/**/*.html`.
- **Demo, not production** — this is a demo artifact; say so if asked to wire it to real systems.
- **Confidential** — treat discovery inputs as confidential; don't expose credentials or the LLM API key.
- **Keep human-in-the-loop framing** (actuarial judgement, capital strategy, CFO sign-off stay human; agents do the manual lifting) — it is core to the demo's credibility.
