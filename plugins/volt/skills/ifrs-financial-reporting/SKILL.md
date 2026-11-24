---
name: ifrs-financial-reporting
description: Deep technical reference and workflow guide for IFRS 9 (Financial Instruments), IFRS 16 (Leases), IFRS 17 (Insurance Contracts) and IFRS 18 (Presentation and Disclosure in Financial Statements). Use for classification and measurement decisions (business model, SPPI, amortised cost/FVOCI/FVTPL), expected credit loss (ECL) staging and computation, hedge accounting design, loan modification and derecognition analysis, lease accounting (ROU asset, lease liability, lease term, discount rate, modifications, sale and leaseback, subleases), insurance contract measurement (GMM, VFA, PAA, CSM roll-forward, onerous contracts, reinsurance held, transition approaches), IFRS 18 statement structure (operating/investing/financing categories, MPMs, required subtotals, disaggregation in the notes), financial-statement disclosure preparation and checklists, transition/effective-date questions, or any accounting judgment or disclosure involving these four standards.
---

# IFRS 9 / 16 / 17 / 18 — Deep Technical Skill

Use this skill whenever the task involves a measurement, classification, presentation, or disclosure judgment under IFRS 9, 16, 17, or 18. It provides the standards' core mechanics, decision sequences, and judgment checkpoints.

## Reference map (read only the file(s) the task needs)

| Task | Read |
|---|---|
| Classify a financial asset/liability; SPPI or business model analysis; FVOCI equity election | [references/ifrs9-financial-instruments.md](references/ifrs9-financial-instruments.md) |
| Build or review an ECL allowance (staging, SICR, POCI, provision matrix) | [references/ifrs9-financial-instruments.md](references/ifrs9-financial-instruments.md) |
| Hedge accounting design/effectiveness; loan modification; derecognition (securitisation, factoring) | [references/ifrs9-financial-instruments.md](references/ifrs9-financial-instruments.md) |
| Lease identification, lease term, discount rate, ROU/liability roll-forward, lease modification | [references/ifrs16-leases.md](references/ifrs16-leases.md) |
| Lessor classification (finance vs operating); sale and leaseback; sublease | [references/ifrs16-leases.md](references/ifrs16-leases.md) |
| Choose GMM vs VFA vs PAA; CSM roll-forward; onerous contracts; reinsurance; IFRS 17 transition | [references/ifrs17-insurance-contracts.md](references/ifrs17-insurance-contracts.md) |
| Map P&L lines into IFRS 18 categories; define subtotals; MPM disclosure note | [references/ifrs18-presentation-disclosure.md](references/ifrs18-presentation-disclosure.md) |
| Effective dates, first-time adoption, standard-to-standard interactions, common pitfalls | [references/cross-cutting.md](references/cross-cutting.md) |
| Draft or review financial-statement notes / disclosure checklists | [references/disclosure-checklists.md](references/disclosure-checklists.md) |
| Write or review the accounting policy note; US GAAP counterparts (CECL, ASC 815/820/715); banking, insurance, credit union, asset management and pension policy, journal-entry patterns, variance and reconciliation rules | [references/accounting-policy.md](references/accounting-policy.md) |

## Core workflow for any IFRS judgment task

1. **Scope** — confirm the transaction is inside the standard's scope (each reference file starts with scope). Do not force-fit.
2. **Read the relevant reference file** for the standard's decision sequence and mechanics.
3. **Apply the decision sequence step-by-step** and document each judgment: fact → assessment → standard requirement (with paragraph reference) → conclusion. Never skip the fact stage.
4. **State effective date and transition status** — see the dates table in [references/cross-cutting.md](references/cross-cutting.md). IFRS 18 is not yet mandatory (periods beginning on or after 1 January 2027); flag any IFRS 18 advice as forward-looking if the reporting period precedes it.
5. **For disclosure work** — use [references/disclosure-checklists.md](references/disclosure-checklists.md) as the completeness base, then tailor to materiality. Worked disclosure drafting (notes, checklists in DOCX/XLSX) can be produced with the `xtt-corporate-finance-accounting:cfa-reporting-fpa` or `kimi-word`/`kimi-excel` skills.
6. **For accounting policy work** - draft policy wording from [references/accounting-policy.md](references/accounting-policy.md), separating rules, elections and judgments (see Quality rules), and keep it consistent with the IFRS reference for the standard concerned.
7. **For computations** (ECL staging, CSM roll-forward, lease amortisation) — show inputs, assumptions, and each mechanical step; label every assumption as an estimate, never as a standard requirement.

## Quality rules (non-negotiable)

- Cite IFRS paragraph numbers where they exist (each reference file includes them). If a paragraph number is not recalled with confidence, describe the requirement and mark it "verify against the standard text".
- Distinguish clearly between: **rules** (mandatory), **policy choices/elections** (OCI option, FVOCI equity election, revaluation model), and **estimates/judgments** (PD/LGD/EAD, coverage units, lease term).
- Never invent effective dates, thresholds (e.g., "substantially all of fair value", low-value lease ~USD 5,000) beyond the reference files without marking them as indicators.
- IFRS 18 supersedes IAS 1 but does not change recognition or measurement under the other standards — presentation questions about it never alter IFRS 9/16/17 accounting.
- Materiality (IAS 1 / IFRS 18) governs whether any disclosure is needed; the checklists assume a listed-entity, full-IFRS baseline.
