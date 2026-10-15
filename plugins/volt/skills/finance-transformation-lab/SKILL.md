---
name: finance-transformation-lab
description: >-
  Build or adapt the interactive "CFO / Finance Transformation Lab" HTML demo
  for a NON-insurance organisation's finance-transformation / agentic-AI demo —
  banks, credit unions, pension funds, Crown corporations, government / public
  sector / municipalities, healthcare & hospitals, higher education, utilities,
  mining, and transportation. Use when the user asks to "build the CFO
  transformation lab", "build the finance transformation demo", "make the
  finance / agentic-AI lab", or "adapt the lab" for any such sector or organisation.
  Produces a themeable interactive HTML app (Home, Dashboard, a sector-specific
  regulatory/financial hub, Reconciliations, SOP Automation, Agent Runtime, AI
  Assistant, Live Demos, North Star) from the organisation's REAL published
  financials. Do NOT use for insurance (use insurance-ft-lab), generic HTML
  (html), decks (pptx), or spreadsheets (xlsx).
cowork:
  category: analysis
  icon: BuildingMultiple
disable-model-invocation: true
---

# Finance Transformation Lab (multi-sector)

Build (or adapt) the CFO / Finance Transformation Lab — a single-file interactive HTML demo that shows finance transformation and agentic AI to a CFO/finance audience — for any of the covered sectors. Same app shell and methodology as the insurance lab; the difference per sector is the regulatory/financial hub tab, KPIs, systems, agent catalogue, and the source of the organisation's real financials.

## When to Use

- The user names a non-insurance organisation (bank, credit union, pension fund, Crown corp, government/municipality, hospital/health authority, university/college, utility, miner, transit/airport/rail) and wants the CFO/finance transformation demo or agentic-AI finance lab built or re-skinned for them.
- The user asks to adapt an existing lab for a new sector or organisation.

## When NOT to Use

- Insurance client → use `insurance-ft-lab` (IFRS 17 / MCT depth lives there).
- Generic HTML report / one-pager → `html`; deck → pptx; spreadsheet/model → xlsx; Word → docx.
- A real production reconciliation / ERP / regulatory-reporting build (this is a demo/prototype).

## What it produces

One self-contained interactive `output/<client>_FTDemo.html` — header + sidebar nav + ~10 tab panes, inline handlers, one inline `<script>`, Chart.js via CDN, Google Fonts, and an AI chat/SOP generator that calls the configured LLM endpoint (e.g. Bedrock) with an offline scenario fallback. Validate by parsing (html5lib), not the strict self-contained validator — inline handlers + CDN are intrinsic to the design.

**Tabs:** Home (hero + KPIs + live agent feed + charts) · Finance Dashboard · Sector Hub (replaces the insurance IFRS 17 / MCT hub — see matrix) · Reconciliations (flagship, AR/AP-led) · SOP Automation · Agent Runtime · AI Assistant · Live Demos · Process Taxonomy · North Star.

## Build workflow (shared with insurance-ft-lab)

1. **Start from the base template** — an existing generic `*_FTDemo.html` lab template in `input/` or `output/`, if the user provides one. It may be base64-wrapped (`document.write(atob("…"))`); decode with Python into `working/decoded.html` and read in chunks (~280-380 KB). If none exists, rebuild from this spec.

2. **Gather real client facts (never fabricate)** — in parallel `web_search` the client's latest annual report / financial statements / public accounts for headline figures, and confirm the oversight body, financial-reporting framework, KPIs, currency, fiscal year, and core systems. Use the sector matrix below to know what to look for.

3. **Transform, don't hand-retype** — adapt the 300 KB file via an ordered Python replace script + a few multi-line block replacements: branding & logo initials, palette (CSS vars + hex + rgba), currency, product/segment names, the sector hub tab, oversight/regulator framing, systems, and the numeric swaps that put the client's REAL figures into the hero, KPI cards, dashboard table, sector hub, and Chart.js data.

4. **Re-skin the Sector Hub, agents, and AI system prompt** to the sector (matrix below). Replace insurance-only concepts (IFRS 17 PAA, LRC/LIC, MCT) — they do NOT apply outside insurance.

5. **Insert the North Star tab** (target operating model) grounded in the SI reporting-&-analytics (`enterprise-reporting-analytics`) and ADKAR change-management (`erp-adoption-change`) frameworks.

6. **Tailor the Recon demo** to the client's real AR/AP and sub-ledger→GL pain; lead with it.

7. **Validate & deliver** (see Guardrails); save to `output/<client>_FTDemo.html`; Glob to confirm.

## Sector adaptation matrix

Framing is Canada-leaning; always confirm the specific entity's jurisdiction and public/private status — they change the regulator and standards. Replace the insurance IFRS 17/MCT hub with the sector hub named here.

| Sector | Oversight / regulator | Framework & headline KPIs | Sector Hub tab | Flagship agentic use case | Real-financials source |
|---|---|---|---|---|---|
| **Banks** | OSFI (+ Bank of Canada, CDIC, FCAC) | Basel III — CET1 / Tier 1 / Total capital, leverage, LCR/NSFR; IFRS 9 ECL. KPIs: CET1 ratio, ROE, efficiency (cost/income), NIM, PCL, NPL | Basel III Capital & IFRS 9 ECL Hub | ECL modelling + regulatory-return (BCAR/Basel) automation; AML/recon | Annual report / OSFI returns |
| **Credit unions** | Provincial (BCFSA, FSRA, etc.) or OSFI (federal CUs); provincial deposit insurance / CDIC | Capital adequacy (leverage/risk-weighted); IFRS 9. KPIs: capital ratio, ROA, efficiency, loan/deposit, member growth | Capital Adequacy & Member Reporting Hub | Member/loan reconciliations; capital & liquidity reporting | Annual report |
| **Pension funds** | OSFI (PBSA) / provincial pension regulators (FSRA…) | Funded status — going-concern & solvency valuations; IAS 19 (sponsor). KPIs: funded ratio, net investment return, discount rate, contribution rate, admin cost/member | Funding & Actuarial Valuation Hub | Funding-valuation + NAV/investment reconciliation automation | Annual report + actuarial valuation |
| **Crown corporations** | Sponsoring government / Treasury Board; Auditor General | PSAS, or IFRS for Government Business Enterprises. KPIs: net income, dividend/remittance to shareholder, ROE, service metrics, capital budget | Shareholder (Government) Reporting & Remittance | Consolidation into public accounts; grant/subsidy accounting; recon | Annual report / public accounts |
| **Government / public sector / municipalities** | Legislature or council; Auditor General; Ministry of Finance / Treasury Board | PSAS/PSAB (municipal PS 3150 tangible capital assets; fund accounting; Ontario FIR). KPIs: budget-vs-actual, annual surplus/deficit, net debt, accumulated surplus, reserves | Budget-to-Actual, Net Debt & PSAS Reporting | Budget-to-actual variance; grants management; procurement; consolidation | Public accounts / FIR / budget |
| **Healthcare & hospitals** | Ministry of Health / regional health authority | PSAS (PS 4200 restricted contributions) + MIS/OHRS/CIHI reporting. KPIs: total margin, cost per weighted case, days cash on hand, funding-vs-expense | MIS/OHRS Reporting, Case Costing & Funding | Case costing; funding reconciliation; supply-chain/AP; restricted funds | Annual report / MOH filings |
| **Higher education** | Provincial advanced-ed ministry; board of governors; Auditor General | PSAS + PS 4200 (restricted contributions, deferred capital contributions, endowments). KPIs: operating surplus/deficit, net assets, endowment return, tuition-vs-grant, research funding | Fund, Endowment & Restricted-Contribution Accounting | Research-grant & endowment/fund accounting; tuition revenue; recon | Annual financial statements |
| **Utilities** | Energy/utility commission (BCUC, AUC, OEB; FERC in US) | Rate-regulated — IFRS 14 regulatory deferral accounts / US GAAP ASC 980. KPIs: rate base, allowed ROE, revenue requirement, capex, SAIDI/SAIFI, deferral balances | Rate Base, Revenue Requirement & Regulatory Deferral | Rate-case/regulatory reporting; capital/asset accounting; recon | Annual report + rate applications |
| **Mining** | Securities regulators (disclosure); NI 43-101 for reserves | IFRS. KPIs: AISC (all-in sustaining cost), cash cost/tonne-oz, production, reserves & resources, EBITDA, DD&A, impairment, asset-retirement obligation (ARO)/reclamation | Cost-per-Tonne / AISC, Reserves & ARO | Cost accounting; fixed-asset/ARO; JV/partner accounting; recon | Annual report / MD&A / 43-101 |
| **Transportation (transit / airport / rail)** | Government / ministry / board; CTA (federal) | PSAS (public transit & airport authorities) or IFRS (private rail/air). KPIs: farebox recovery ratio, cost per revenue-hour, operating ratio, ridership, subsidy, capital program | Farebox Recovery, Subsidy & Capital Program | Grant/subsidy accounting; capital program; fare reconciliation; asset mgmt | Annual report |

## Per-client checklist (shared)

### Branding/theme
Company name + 2-letter mark; recolour `--accent`, highlight CSS vars, Chart.js hex, and rgba() tints (watch for a colour used as a JS sentinel).

### Real financials
Paste the client's actual headline figures from the source above into the hero, KPI cards, dashboard, and sector hub; add a data-provenance banner naming which figures are actuals and flagging operational metrics / illustrative splits. Anchor any illustrative roll-forward to real opening/closing balances so it ties.

### Currency
Convert the symbol and report in the client's functional currency.

### ERP / finance core
If unknown or a blank slate, use a generic "ERP" placeholder; fit AI tooling to the client's cloud of record (AWS/Bedrock, Azure, or GCP as applicable).

### North Star tab
Target operating model: current-state signals, current-vs-target architecture, a cloud-anchored Source-to-Report flow, a capability-layer table, a reporting-&-analytics operating model (semantic layer / single source of truth / self-service BI), an ADKAR adoption plan, and a 3-horizon roadmap; recommend starting with Recon.

### Agents & AI system prompt
Re-skin the agent catalogue, `SYSTEM_PROMPT`, pre-built scenarios, and quick-question buttons to the sector's framework, KPIs and systems.

## Output format

A single interactive `output/<client>_FTDemo.html`, plus a short chat summary of what's sector/client-specific (oversight, framework/KPIs, sector hub, systems, North Star, Recon) and two caveats: (1) needs connectivity for charts/fonts and the live AI chat (offline → scenario fallback); (2) every number is an actual or a clearly-labelled illustrative.

## Guardrails

- **Never fabricate** financials, KPIs, regulator names, or accounting-framework facts. Missing → clearly-marked placeholder or labelled illustrative; state the source for every real figure.
- **Get the framework right** — jurisdiction and public/private status change the regulator and the accounting standard (PSAS vs IFRS vs ASNPO vs US GAAP). Confirm before writing; do not assume from sector or country alone. Do NOT carry insurance concepts (IFRS 17 PAA, LRC/LIC, MCT) into these sectors.
- **Validate before claiming done** — parse with html5lib (must not raise); grep for leftover template/prior-sector tokens (template branding, prior regulator, prior framework, prior currency, prior KPIs) and any `§sentinel§` placeholders from the transform; fix all. Confirm via `Glob output/**/*.html`.
- **Demo, not production**; treat client discovery inputs as confidential; keep human-in-the-loop framing (judgement, capital/funding strategy, CFO sign-off stay human).
