# Future of Finance interactive pages: master prompt v2 (generic)

Rakesh's master prompt for the single-file *Future of Finance: Talent, Operations, Value, Taxonomy and Architecture*
page set, saved here on 2026-11-27 as the reference for VOLT's process taxonomy and reference architecture views. It
was written from an HTML deliverable (Generic_Future_of_Finance_Pages.html).

How VOLT uses it:

- Every finance transformation deliverable carries a process view (```process), the process taxonomy (```taxonomy,
  section 5.2 and Page 02 below), a business and a technology reference architecture (```architecture, section 7) and
  a product lifecycle view (```lifecycle). `apps/volt-console/server/deliverable.ts` and the `create_file` check
  enforce this.
- The technology reference architecture follows the layers of section 7.1 and 7.2: source systems, provisioning area,
  operational engines (accounting rules engine, general ledger, reconciliation and consolidation), analytical engines,
  analysis and reporting, under data governance and master data management.
- VOLT's own visual rules win where they differ from section 4's visual system: pure black background, small type,
  VOLT branding, no firm branding.
- Not yet built in VOLT: the 15-step animated walkthrough (section 7.3 and 7.4) and the explore modes (section 7.5).
  VOLT's architecture stack builds in layer by layer and lists every flow.

Symbols in the original (play, pause, back and restart glyphs) are written as words here, because the repository
allows no emoji.

---

**Purpose:** Rebuild, end to end, the single-file interactive HTML page set *Future of Finance: Talent, Operations,
Value, Taxonomy & Architecture* for any client. The page has three tabs plus an animated Reference Architecture
walkthrough that replays the click-by-click build of the Finance Reference Architecture PowerPoint.

**How to use:** Paste everything below the line into a fresh chat, attach the source decks, and fill in the INPUTS
block. One deliverable per run. This version is firm-neutral: no firm branding, logos or proprietary survey names
unless you add them in INPUTS.

---

## 1. ROLE

You are a senior finance transformation partner and a senior front-end designer working together. You turn finance
thought-leadership decks into a boardroom-quality, single-file interactive HTML experience. You write in a
management-consulting voice: answer first, quantified, declarative, with no filler.

## 2. GOAL

Deliver one self-contained HTML file with three tabbed pages. An executive should be able to (a) understand each
page's message in 10 seconds, (b) explore detail by clicking, and (c) watch the reference architecture build step by
step, as the presenter would in PowerPoint.

| Tab | Page | Core question it answers |
|---|---|---|
| 01 | Future of Finance: Talent, Operations, Value | Where must finance go, and what are the levers? |
| 02 | Finance Process Taxonomy (L1-L4 + GenAI impact) | What does finance do, and where does GenAI pay off? |
| 03 | Finance Reference Architecture (animated + explorable) | How should data, accounting and risk engines fit together? |

## 3. INPUTS (fill in)

```text
CLIENT / AUDIENCE:   {{e.g. "CFO & Finance LT, Tier-1 bank" | "Vendor-neutral point of view"}}
INDUSTRY:            {{Banking | Insurance | Public Sector | Corporate}}
PLATFORM CONTEXT:    {{Vendor-neutral | Oracle Fusion ERP/EPM + Accounting Hub | SAP S/4HANA | other}}
BRAND LABEL:         {{header text, e.g. "Finance Transformation" | your firm or practice name}}
SOURCE FILES:        {{Future of Finance point-of-view deck}}
                     {{GenAI in Finance deck with process impact maps}}
                     {{Finance Reference Architecture deck}}
                     {{any client-specific additions}}
CONFIDENTIALITY:     {{Internal | Client-ready | Draft}}
FILE NAME:           {{Client}}_Future_of_Finance_Pages.html
FOOTER TEXT:         {{page name only, e.g. "Future of Finance - Talent, Operations, Value, Taxonomy & Architecture"}}
```

## 4. CONTEXT AND GUARDRAILS

- **Facts only from sources.** Every number comes from a source file or is computed in code from the embedded data.
  Anything else is marked `[UNVERIFIED]` or left as a red placeholder such as `[Add metric]`.
- **Dated data:** flag survey statistics older than 24 months ("refresh before client use").
- **GenAI ratings** from the source impact maps are indicative. Carry the caveat "to be validated with the client's AI
  governance team" into the source line.
- **Architecture is vendor-neutral** unless PLATFORM CONTEXT names a platform. Never copy client-specific or internal
  system names from the architecture deck into a neutral or other-client version.
- **No firm branding.** Do not draw or imitate any firm's logo, wordmark or trademarked brand device. Use the BRAND
  LABEL text only.

**Visual system (neutral dark theme):**

- **Colours:** bg `#121212`; panels `#1C1C1C` / `#252525` / `#2F2F2F`; border `#3A3A3A`; text `#F2F2F2`; muted
  `#A9A9A9`; Primary accent `#D04A02`; Tangerine `#EB8C00`; Yellow `#FFB600`; Rose `#DB536A`; Red `#E0301E`; Grey
  `#7D7D7D`; Teal `#2C5F6E`; Thin-COA Green `#5F8A54`; Thick-COA Amber `#C99A2E`; Analytical Sand `#D9CFB0`; component
  slate `#41575D`. Swap the accent set if the client has its own palette.
- **Type:** Georgia serif for H1 action titles (34 px); Segoe UI for everything else.
- **Header:** sticky header with four skewed stripes (Yellow, Tangerine, Primary accent, Rose) + BRAND LABEL +
  numbered tabs (active tab solid Primary accent).
- **Every page, in order:** Tangerine uppercase eyebrow, full-sentence action-title H1, lede (45 words or fewer),
  6-tile KPI strip (3 px Primary-accent top rule), interactive core visual, "So what" callout (`#1E1712`, 4 px
  Primary-accent left border, implication + trade-off), source line (11.5 px, dim).
- **Footer:** page name only.

## 5. STEP 1: EXTRACT CONTENT FROM THE SOURCE DECKS

Read every slide's text, including grouped shapes and tables. Then extract the following. Slide titles below are
typical; match on meaning if the client deck words them differently.

### 5.1 Future of Finance deck, for Page 01

| Element | Typical source slide | What to capture |
|---|---|---|
| Six shifts | "Finance needs to pivot to insight" | Do more with less (automation); efficient service delivery channels; standardised data/reporting/processes; insightful data-driven analysis; predictive dynamic scenario planning; proactive not reactive |
| 7 levers in 3 pillars | "Future of Finance framework" | **Talent:** Finance Organisation & Structure; Finance Workforce & Capabilities. **Operations:** Process Excellence & Automation; Cloud ERP & Digital Platforms; Automated & Predictive Controls. **Value:** Advanced Analytics, Insights & Action; Strategic Finance Business Partnering. "Vision and Strategy" spans all three. Use the deck's descriptor text, compressed to 25 words or fewer. |
| Future organisation | "The future Finance organisation" | 4 quadrants with today-to-tomorrow size (read the circle sizes): Finance Operations shrinks; Centres of Excellence grows; Corporate Centre leaner; Business-located Finance rebalanced. Capture 3 bullets and the roles for each. |
| Talent | "New strategic Finance roles" | 5 personas (Problem solver, Technogeek, Treasure hunter, Dreamer, Controller); journey Up-Knowledge, Up-Skill, Up-Perform; competencies list |
| Operations | "Process standardisation and automation" | Analyse, Automate, Control cycle (4 steps each); automation spectrum Simple RPA, Advanced, Algorithmic, AI |
| Digital core | "Cloud ERP and digital platforms" | ERP spine + Connected Data, Automated Intelligence, Insight & Analytics; phased early-value delivery |
| Value | "Key elements of performance management" | Connected self-service data; ML-assisted insights; Visualisation & mobile; Real-time performance management |
| Lessons learned | "Transformations: lessons learned" | 6 domains x 3 bullets |

### 5.2 GenAI in Finance deck, for Page 01 KPIs + value pyramid, and the Page 02 taxonomy

- **KPIs** (CFO survey slide): the 6 statistics as stated in the deck, each with its survey name and year in the
  source line. If the deck has fewer than 6, fill the rest with `[Add metric]`.
- **Value pyramid:** Data, Information, Knowledge, Insight, Creation.
- **Taxonomy** (appendix impact maps, e.g. R2R, O2C, P2P, A2R, FP&A). Parse the shapes by fill colour and position,
  not by reading order:
  - red bar (theme accent) = L1 cycle
  - `#000000` black boxes = L2 process group
  - `#808080` grey boxes = L3 process
  - every other text box below an L3 header in the same column = L4 activity
  - activity fill `#FFE599` = GenAI High; `#FFF2CC` = GenAI Moderate; white/none = Limited
  - If the client deck uses other colours, read its legend and remap before parsing.
- Assign L3 to L2 by horizontal overlap with the nearest L2 above. Assign L4 to L3 by the activity's x-centre falling
  inside the L3 column and lying above the next L3 in that column.
- Exclude the legend boxes ("GenAI ... involvement use case").
- **Clean-ups:** merge "...con't" groups into their parent; where an L2 has activities but no grey L3, create an L3
  of the same name. Where a grey header reads like an activity (e.g. "Regulatory Reporting Policy & Guidelines"),
  rename the L3 to its process ("Regulatory Reporting") and insert the header text as its first activity.
- Merge continuation slides into one L1.
- **Sanity check:** print the counts (L1, L2, L3, L4, High, Moderate) before building. For the original reference
  decks the result was 5, 26, 65, 316, 57, 38 (about 30% GenAI). For a new deck, re-check parsing if any L3 has zero
  activities or any L4 lands outside its column.
- Store the result as JSON: `{L1: {L2: {L3: [[activity, "H"|"M"|""], ...]}}}`.

### 5.3 Reference Architecture deck, for Page 03

- **Full architecture slide:** layers, components, key principles, COA legend and both flows.
- **Key solution components slide:** 5 coloured overlays.
- **Animation timeline:** read `<p:timing>` from the architecture slides. Map each clickEffect (new step) and its
  withEffect siblings (same step) to shape IDs, then to shape text and geometry. Arrows and connectors are LINE
  shapes; COA swatches are small groups of 2-6 coloured rectangles. The storyboard in 7.3 is the result for the
  reference deck. Rebuild it from the timing XML if the client deck differs.

## 6. STEP 2: PAGE SPECIFICATIONS

### PAGE 01: Future of Finance (Talent, Operations, Value)

- **Eyebrow:** FUTURE OF FINANCE / TALENT / OPERATIONS / VALUE
- **H1:** "Finance must pivot from scorekeeper to insight-led partner, and seven levers across Talent, Operations and
  Value get it there"
- **KPI strip:** the 6 CFO survey statistics.
- **Section A: Six shifts:** 6 tiles with a Tangerine top rule.
- **Section B: Framework (interactive):** a grid with a vertical "Vision and Strategy" bar, a vertical "Lead with ..."
  label per row (Lead with Talent / Lead with Operations / Lead with Value), and lever buttons. Talent row: 2 levers
  (Rose `#C2405A`, Tangerine `#C77700`). Operations row: 3 levers (Accent `#B54002`, Grey `#5F5F5F`, Red `#C22A1A`).
  Value row: 2 levers (Charcoal `#3D3D3D`, Yellow `#B88400`). Clicking a lever fills a 4-column detail panel: Target
  state, Key roles (pills), GenAI accelerators, Indicative KPIs. Lever 01 is preselected. Keep lever data in a JS
  array `LEV[]`.
- **Section C: Three pillar columns:**
  - Talent (Rose rule): 4 org quadrants with direction badges + roles; 5 personas; chevron journey.
  - Operations (Accent rule): Analyse / Automate / Control tiles; 4-colour automation spectrum; ERP-spine 2x2.
  - Value (Yellow rule): 4 performance elements; GenAI value pyramid (narrowing bars: grey, Yellow, Tangerine, Accent,
    Rose).
- **Section D: Lessons learned:** 6 tiles.
- **"So what":** orchestrate all seven levers as one programme; technology without new roles and controls does not
  change decisions.
- **Source line:** Future of Finance deck; GenAI in Finance deck; survey names and years as cited (refresh flag).

### PAGE 02: Finance Process Taxonomy

- **Eyebrow:** FINANCE PROCESS TAXONOMY / L1 TO L4 / GENAI IMPACT
- **H1:** "A four-level finance process taxonomy shows where GenAI pays off: {{computed %}} of activities are GenAI
  candidates, concentrated in {{top 3 L3 areas by High count}}". The percentage and focus areas are computed from the
  data at runtime.
- **KPI strip (computed):** L1 count, L2 count, L3 count, L4 count, High, Moderate.
- **Level legend:** 4 tiles defining L1-L4 with an example each.
- **L1 selector:** one card per L1 showing counts, GenAI % and a stacked bar (High `#FFB600`, Moderate `#8A6D1A`).
- **Toolbar:** filter chips (All / High only / High + Moderate), live search (jumps to the L1 with the most matches),
  Expand all, legend.
- **Grid:** L2 columns (black header, 2 px Accent underline), L3 rows (chevron, activity count, high count, dot strip
  of ratings), expandable L4 list (left border coloured by rating). When a filter or search is active, non-matching L3
  rows dim to 35%.
- **"So what":** start where High activities cluster (computed top areas, e.g. variance commentary, intercompany,
  collections, policy documentation). Name any coverage gaps, e.g. Treasury, Tax and Regulatory Capital if not broken
  down in the source.
- **Source line:** GenAI impact maps; ratings "to be validated with the client's AI governance team".

### PAGE 03: Finance Reference Architecture (animated + explorable)

- **Eyebrow:** FINANCE REFERENCE ARCHITECTURE / ENTERPRISE FINANCE TRANSFORMATION
- **H1:** "Apply accounting rules once, at source-transaction level, to create balances that are reconciled by design
  and feed every downstream report"
- **Mode bar:** Play guided walkthrough (default on first visit), Full architecture, Accounting & financial reporting
  flow, Risk, performance & regulatory flow, Chart of accounts layers, Key solution components
- Full component inventory, tagging and detail text: 7.1-7.2. Animation: 7.3-7.4.
- **Below the diagram:** component detail panel (left) and Key Principles box (right; Teal background, key phrases in
  Yellow); 3 design-principle tiles (Thin GL / thick sub-ledger, Finance and risk on one data foundation, Governed end
  to end).
- **"So what":** removes downstream reconciliations and lowers the cost of close and regulatory reporting. Trade-off:
  up-front investment in a rules-driven accounting hub, data provisioning and master-data discipline before the GL is
  thinned.
- **Source line:** Finance Reference Architecture deck; vendor-neutral, map platforms per client.

## 7. ARCHITECTURE SPECIFICATION

### 7.1 Layout (CSS grid, left to right)

Source Systems (150px) | Provisioning Area (170px) | Engines (1fr) | Analysis & Reporting (230px) | Consumers (46px,
vertical) | E2E Management & SLAs (34px, vertical Teal). Below them, two full-width Teal bars: Data Governance &
Services Integration and Master Data Management.

### 7.2 Component inventory

Each component is a `<button class="cmp">` with these attributes:

- `data-i`: key into the `INFO` object (title, layer, 1-2 sentence role)
- `data-f`: flow membership: `a` = accounting, `r` = risk, `ar` = both
- `data-k`: COA layer: `t` = thin GL segment, `k` = thick sub-ledger dimension, `n` = analytical dimension
- `data-c`: solution component group 1-5 (see 7.5)
- `data-s`: the walkthrough step(s) in which it is highlighted, e.g. `"3 4"`

| Layer | Components (flow / COA / group) |
|---|---|
| Source Systems | Mortgages, Deposits, Securities, Derivatives, Credit Cards, Other Sources (ar); Market Data (r); Reference Data (ar); Capital Data (r); Customers (ar) |
| Provisioning Area | Customers (ar/n/1); Transactions (ar/k/1); Accounts (ar/k/1); Balances (ar/k/1); Enterprise Dimensions (ar/n/1); Data Verification (ar/1); Data Quality (ar/1); Reconciliation (a/1); Adjustments (a/1) |
| Operational Engines | Accounting Rules Engine: Accounting Rules, Detailed Balances (a/k/2); General Ledger: GL Balances, ADB (a/t/2); Reconciliation & Consolidation (a/t/3); Financial Adjustments (a/t/3); Cost Management (ar/n/2) |
| Analytical Engines | Risk Engines: Market, Credit, Liquidity; Stress Executions (r/1); Regulatory calcs: FTP/Basel (r/1), IFRS 9/IFRS 17 (ar/1); Financial Management: RAPM (r/n/1), Solvency II (r/1); Sandbox: Statistical, Corporate & Other engines (r/1) |
| Common Results Area | Pricing, Customer Insight, Product Profitability (ar/n/1); Reconciled Balances (ar/k/1). Shown as a Tangerine-bordered band across the engines. |
| Analysis & Reporting | Financial Close & Disclosure (a/3); Statutory Reporting (a/4); Regulatory Reporting & XBRL (r/5); Planning & Forecasting (ar/3); Financial Analytics (ar/4); Managerial & MIS Reports (ar/4); Corporate Dashboards (ar/4); Alerts & Exception Mgmt (r); Operational Risk & Compliance (r); Regulatory Compliance (AML/FinCrime) (r) |
| Consumers | Shareholders, Directors, Customers, Analysts, Regulators |
| Cross-cutting | Data Governance & Services Integration; Master Data Management; End-to-End Management & SLAs |

Adjust source systems and analytical engines to INDUSTRY (e.g. policies and claims for Insurance; appropriations and
programs for Public Sector).

### 7.3 Animation storyboard (derived from the reference PowerPoint timeline)

The reference deck builds the slide over 15 clicks. Reproduce each click as one step. Per step: highlight the listed
components (others dim to 25%), draw the listed connectors, attach the COA chips, and show the caption (title +
one-sentence narrative) in a caption bar.

| Step | PowerPoint click (shape IDs) | HTML behaviour | Caption title and narrative |
|---|---|---|---|
| 1 | Key Principles panel enters (771) | Full-width Teal overlay with the two principles; diagram hidden | Start with the principles: apply accounting rules once; enrich reconciled balances into one golden source. |
| 2 | Principles exit; legend (738) + all layer frames and boxes enter together | Layers fade in left to right with a 60 ms stagger (Sources, Provisioning, Operational, Analytical, Common Results, Reporting, Consumers, governance bars); COA legend appears top-right | The landscape: sources, provisioning, operational and analytical engines, reporting, all under common governance. |
| 3 | Arrow 753 (Sources to Provisioning, transactions row) | Draw arrow Source Systems to Provisioning Transactions | Ingest once: source transactions land in a single provisioning area, verified and conformed. |
| 4 | Arrow 719 + COA chip 724 (thick + thin) on Detailed Balances | Arrow Provisioning to Accounting Rules Engine; chip [thin/thick] on Detailed Balances | Apply rules once: the accounting rules engine creates detailed, thick-COA balances from each event. |
| 5 | COA chip 720 (thin) + arrow 743 | Arrow Detailed Balances to GL Balances; chip [thin] on GL | Thin the GL: only statutory COA segments reach the general ledger. |
| 6 | COA chip 746 + arrow 761 | Arrow GL to Financial Close & Disclosure; chip [thin/thick] on reporting | Close and disclose from a ledger that is already reconciled to its detail. |
| 7 | Connectors 700, 698, 699 + labels "Balances", "Balances", "Financial Adjustments" | Three connectors: Detailed Balances to RAPM / Financial Management; GL Balances to Financial Management; to Financial Adjustments; show the flow labels on the lines | Balances feed performance: the same balances drive financial management and governed adjustments. |
| 8 | Arrow 749 + COA chip 737 (analytical) | Second arrow Sources to Provisioning Accounts / Balances; chip [analytical] under Provisioning | Add analytical depth: account and balance feeds bring analytical dimensions. |
| 9 | COA chip group 730 | Full chip [thin/thick/analytical] under the Provisioning column | One enriched data set: provisioning now carries all three COA layers. |
| 10 | "Reconciliation" box (653) enters | Reveal Reconciliation in Provisioning with a pulse | Prove completeness: source-to-provisioning control totals. |
| 11 | Arrow 750 | Arrow Reconciliation to Analytical / Sandbox engines | Reconciled inputs flow to risk and analytical engines. |
| 12 | Fan-out lines 662, 683, 665, 751, 752 + chip 754 (6 segments) | Five connectors fanning out from the Common Results Area to MIS, Dashboards, Regulatory Reporting & XBRL, Alerts, Operational Risk & Compliance; chip [all layers] under Reporting | Report from the golden source: every report reads the same enriched results. |
| 13 | Red line 744 + chip 762 + line 770 | Red vertical connector from Common Results to GL (`#E0301E`, dashed) labelled "reconciled by design"; chip on Profitability; connector to consumers | Reconciled by design: risk and finance results tie back to the ledger without a separate reconciliation. |
| 14 | Two large flow arrows (768, 769) | Two translucent full-width band arrows: top amber "Accounting & Financial Reporting Flow"; bottom rose "Risk, Performance & Regulatory Reporting Flow" | Two flows, one foundation. |
| 15 | Flow arrows exit | Bands fade out; diagram returns to full, explorable state; caption shows "Explore any component" | Explore: click any box for detail, or switch view. |
| S4 | Solution components slide: five overlays enter together (893-897) | Available as the Key solution components mode: five translucent coloured regions with labels (see 7.5) | Key solution components. |

> Shape IDs and connector targets are from the reference deck and were inferred from shape geometry. Confirm them
> against the client deck in slideshow mode, and re-derive them from the timing XML if the deck differs.

### 7.4 Animation engine (implementation requirements)

- **Data-driven:** `const STEPS = [{n, title, text, on:[data-i...], arrows:[[fromId,toId,label,colour]],
  chips:[[targetId,"tkn"]], overlay:null|"principles"|"flows"}]`. The engine reads it and never hard-codes a step.
- **Connectors:** a single absolutely positioned `<svg>` over the architecture grid. Compute endpoints from
  `getBoundingClientRect()` of the source and target elements (right-edge midpoint to left-edge midpoint; vertical
  when stacked). Draw with a stroke-dasharray/dashoffset animation (0.6 s, ease-out) and an arrowhead `<marker>`.
  Default colour Rust `#C74634`; red link `#E0301E` dashed. Recompute on resize (ResizeObserver) and on tab switch.
- **COA chips:** small inline badges (12x10 px segments) in Green / Amber / Sand appended to the target component,
  popping in with a 150 ms scale.
- **Controls** (caption bar under the diagram): Restart, Back, Play/Pause (auto-advance every 4 s), Next, step dots
  (click to jump), "Step n / 15". Keyboard: Left / Right / Space / Home. Going back must fully restore the earlier
  state, so rebuild the state from step 1 to n rather than undoing.
- **Accessibility:** honour `prefers-reduced-motion` (no draw animation, instant states); captions use
  `aria-live="polite"`; all controls are `<button>`s.
- **Exit to explore:** any mode button stops playback and clears the connectors. Clicking a component during playback
  pauses and opens its detail.

### 7.5 Explore modes

- **Accounting flow** (`data-f*="a"`): recolour to amber `#B07A00`; others to 18% opacity. Show the flow ribbon:
  Source transactions, Provision & verify, Rules applied once, Detailed (thick) balances, Thin GL, Reconcile &
  consolidate, Adjust, Close & disclose, Statutory, MIS & analytics.
- **Risk flow** (`data-f*="r"`): recolour to rose `#9C2F45`. Ribbon: Source + market & capital data, Provision &
  verify, Risk, FTP/Basel, IFRS 9/17, Stress & RAPM, Common results, Reg reporting & XBRL, Dashboards, alerts,
  compliance.
- **COA layers** (`data-k`): `t` = `#5F8A54`, `k` = `#C99A2E`, `n` = `#D9CFB0`; others 25%; legend chips.
- **Key solution components** (`data-c`): 1 Data foundation, infrastructure, integration & analytical engines
  `#2C5F6E`; 2 Accounting hub, GL & cost management `#A63A02`; 3 Consolidation & close, reconciliation, planning
  `#8C6400`; 4 Statutory reporting & MIS `#9C2F45`; 5 Regulatory reporting `#4F6B2F`. Where PLATFORM CONTEXT names a
  platform, add the platform product under each group label (e.g. Oracle: Accounting Hub + Fusion GL;
  FCCS/ARCS/EPBCS; OFSAA; Analytics). Otherwise stay neutral.

## 8. STEP 3: BUILD RULES (technical)

- One `.html` file with inline `<style>` and one inline `<script>`. No external fonts, images, CSS, CDNs or network
  calls.
- No inline event handlers (`onclick=`); use `addEventListener`. No `javascript:` URLs. Escape all injected text.
- `<html lang="en" dir="ltr">`, `<meta name="color-scheme" content="dark">`, CSS variables for every colour, logical
  properties.
- All content in JS data objects: `LEV[]` (page 1), `TAX{}` (page 2), `INFO{}` and `STEPS[]` (page 3). Layout code is
  generic.
- Tabs switch in place (no cross-file links). Every page's default state is populated.
- Responsive at 1100 px (architecture stacks vertically, vertical labels turn horizontal, connectors recompute). Print
  stylesheet: all pages, one per printed page, walkthrough at its final step.
- Target size under 150 KB; hard cap 5 MB.

## 9. OUTPUT

- The file `{{Client}}_Future_of_Finance_Pages.html`.
- In chat: one bullet per page (what it shows); taxonomy counts as computed; the list of items to validate (dated
  stats, GenAI ratings, inferred connector targets, any placeholders).

## 10. VERIFIER (run before delivering; fix every failure)

- [ ] 3 tabs; each page follows eyebrow, action-title H1, lede, KPI strip, visual, "So what" with trade-off, source
  line.
- [ ] Pillars read Talent, Operations, Value everywhere (H1, eyebrow, framework rows, pillar columns, labels).
- [ ] Taxonomy counts are computed from `TAX` and printed; for the reference decks they fall within 5% of 5 / 26 / 65
  / 316 / 57 / 38.
- [ ] Walkthrough has 15 steps matching 7.3 (or the re-derived client timeline); Back/Next/Jump restore exact state;
  Play auto-advances and stops at the last step.
- [ ] Connectors attach to the correct boxes after resize and after switching tabs and back.
- [ ] Reduced-motion users get instant states.
- [ ] All four explore modes work and clear the walkthrough cleanly.
- [ ] Every component opens a detail panel with a title, layer and role.
- [ ] No external references, no inline handlers; the file opens offline in Edge and Chrome.
- [ ] No firm logos or branding beyond BRAND LABEL; no client-confidential names in a neutral or other-client version;
  dated data flagged; unverified items marked.
- [ ] The footer shows only the page name.

## 11. IF UNCERTAIN

State the assumption in one line, build with a clearly labelled placeholder, and ask one question at the end. Never
invent statistics, system names or client facts.

---

## Short-form variant (for a quick rebuild)

Using the attached Future of Finance, GenAI in Finance and Finance Reference Architecture decks, build one
self-contained dark-themed HTML file with three tabs and no firm branding: (1) Future of Finance: 6 CFO survey KPIs,
six shifts, a clickable 7-lever Talent/Operations/Value framework with a detail panel, pillar deep-dives, value pyramid
and lessons learned; (2) Finance Process Taxonomy: L1-L4 parsed from the GenAI impact maps by fill colour (#FFE599
High, #FFF2CC Moderate), with computed KPIs, L1 selector, filters, search and expandable activities; (3) Finance
Reference Architecture: an explorable layered diagram with four views (accounting flow, risk flow, COA layers,
solution components) plus a guided walkthrough that replays the PowerPoint click animation using an SVG connector
overlay, COA chips, captions and Play/Back/Next controls. Use an action-title H1, a "So what" with trade-off and a
source line on every page. No external assets; data in JS objects. Client: {{CLIENT}}. Platform: {{PLATFORM}}. Brand
label: {{BRAND LABEL}}.
