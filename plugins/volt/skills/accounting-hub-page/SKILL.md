---
name: accounting-hub-page
description: Accounting Hub, Financial Information Model and Master Accounting Flow page for any financial services client (bank, consumer lender, credit union, insurer, wealth or asset manager). Use when a client wants a target accounting hub or sub-ledger on a data platform, event-based accounting, a master accounting flow by product lifecycle, a financial information model, or a migration and parallel-run plan for retiring custom accounting logic, shown as one interactive five-tab page. Builds the page with the build_accounting_hub tool.
---

# Accounting Hub page

## When to Use

The client describes, in any words, accounting rules spread across systems, manual adjustment files, data paths
reconciled by hand, a sub-ledger or accounting hub decision, event-based accounting, a master accounting flow, or a
financial information model, and wants it laid out for a CFO, Controller or steering committee. The output is one
self-contained HTML page with five tabs: Today, Target Accounting Hub, Financial Information Model, Master Accounting
Flow, Migration and Parallel Run.

## How It Works

Work as a finance transformation partner and solution architect: answer first, quantified, facts separated from
opinion, every recommendation with its trade-off. The page is a draft for review, a controlled ideation and
architecture-review aid, not an implementation specification.

1. Collect the inputs below from the conversation, the scope and the files attached to this message. Use the
   knowledge base only when the request asks for it. Web research is allowed for public facts about the client
   (products, published results), cited, never for its internal systems.
2. If client name, client type, source systems, legacy accounting logic or the proof-of-concept product are missing,
   ask for them once, in one short message, and stop. If the client says to go ahead, proceed with labelled
   hypotheses.
3. Fill the content (fields below) and call `build_accounting_hub` with it as `content`.
4. The tool draws the page and runs the verifier. If it returns failures, fix every one and call it again. Same
   failure twice: stop and say what blocks it.
5. Reply in two or three lines, then list the review items (`confirm`) for the person to resolve before any
   client-facing use.

### Inputs

```
CLIENT_NAME, CLIENT_TYPE      consumer lender | retail bank | credit union | wealth / asset manager | insurer | other
BRANDING                      VOLT (default, dark) | client light: primary hex, secondary hex, logo text |
                              boardroom (ivory and navy, print-friendly; primary and secondary optional)
AUDIENCE, CONFIDENTIALITY     client CFO / Controller | internal team | steering committee; client draft | internal
SOURCE_SYSTEMS                name, products, how data leaves it (file / API / CDC), one per line
GL_PLATFORM                   name only this GL on the page
CLOSE_CONSOLIDATION_EPM       or none
LEGACY_ACCOUNTING_LOGIC       every place accounting rules run today
DATA_PLATFORM_TARGET          or vendor-neutral
REPORTING_CONSUMERS           e.g. securitization, BI, regulatory, ECL / risk, profitability
KEY_PAIN_POINTS               3 to 8, in the client's words
POC_PRODUCT, SECOND_PRODUCT   one product and source each
TARGET_DATE                   proof of concept date
EXCLUSIONS                    names, vendors or options never to mention
EVIDENCE                      attached diagrams, accounting policy, product or MAF documents, CoA, discovery notes
PRIOR_PROOF_APPROVED          yes only when the prior-delivery figures are approved for this audience
```

### Method

- Two design principles: (1) apply one governed rule framework once, to the source transactions, with controlled
  and explainable variations by accounting basis, legal entity, jurisdiction and effective date; (2) keep balances
  reconciled by design, with one golden source for all downstream reporting.
- Accounting and information layers (only the first is a chart of accounts): GL chart of accounts at the agreed
  posting grain; sub-ledger detail at contract and event level per accounting basis; analytical attributes kept in
  the FIM and never posted (FTP rate, ECL stage, PD / LGD, vintage, channel, investor code, series). Posting grain is
  a decision with criteria (reconciliation, audit, regulatory, platform volume), not an assumption.
- Golden thread: one key from the source transaction to the business event, hub journal line, GL line (memo or
  reference) and EPM drill-back.
- Master Accounting Flow: source and data contract; lifecycle event catalogue; accounting matrix; controls; journals
  and sub-ledger on the FIM; GL posting and close.
- Product lifecycle: walk each product start to end and list every business event per stage, including exception
  paths (failed, duplicate, late, corrected, reversed, backdated). Memo events update the FIM without a journal. One
  event may create a journal, a memo update, several accounting outputs (one per ledger) or none.
- Catalogue size is a workshop estimate, not a fact or committed scope (roughly 15 to 20 events for cards, 12 to 15
  for instalment loans, 10 to 14 for deposits or mortgages, 10 to 12 for funds). Build from supplied product and
  MAF documents first; otherwise mark events illustrative and the catalogue draft.
- Controls C1 to C17 are drawn by the tool (completeness, mapping, balancing, sub-ledger to source, GL to sub-ledger,
  cut-off, rule change, lineage, duplicates and idempotency, authorisation and SoD, late / corrected / replayed
  events, currency and rounding, suspense ageing, period close and reopen, rule deployment and rollback, interface
  failure and recovery, access and sensitive data). Give owner, threshold and escalation only where known.
- Options compared: keep the custom code, an accounting engine inside the GL platform, a data fabric accounting hub.

### Evidence, accounting integrity and implementation boundaries

1. Label each material statement Client-confirmed, Source-validated, Hypothesis, Illustrative or Decision required.
   Never present a hypothesis or synthetic example as client fact.
2. Source hierarchy: approved accounting policy and client documents first, confirmed interviews second, public
   material third, labelled hypotheses last. Cite source name, date and page or section in `evidence`; uncited
   facts are unverified. Show absent or conflicting evidence as unresolved.
3. Model business events, accounting events, journals, sub-ledger balances, GL postings and reports as a trace; do
   not assume one event maps to one journal.
4. For every accounting rule capture trigger, product variant, legal entity, jurisdiction, accounting basis,
   effective and accounting date, currency, debit and credit treatment, dimensions, rule version and approval,
   reversal, correction and exception handling. Unknowns stay "[to confirm]".
5. Show which component owns event intake, rule execution, journal creation, replay prevention, corrections,
   sub-ledger balances, GL posting, reconciliation and audit evidence. A data platform alone is not a controlled
   sub-ledger.
6. Treat posting grain, account design, ledger structure and accounting variations as decisions for Finance and
   Technology.
7. Controls carry owner, frequency, evidence, threshold and escalation.
8. Volumes, service levels, durations, savings and event counts stay "[to confirm]", "[to size]" or "[$ TBD]"
   unless evidenced. The value model separates evidenced current cost, one-time cost, ongoing cost, quantified and
   qualitative benefits; no headcount or cost reduction without a validated baseline.
9. Prior-delivery figures appear only when approved for the audience (`prior_proof_approved`); anonymisation is not
   permission. The prior client is only ever "a Canadian digital bank (client anonymised)".
10. From attachments take only what the page needs; never reproduce personal or confidential details; flag
    sensitive data in `confirm`. Raise a review item whenever an assumption affects accounting, regulatory
    treatment, security, data residency, architecture or the business case.

Never invent client systems, figures or dates. Without a current-state diagram, build tab 01 from the source
systems and legacy logic and leave `current_state_source` empty (the page then says "hypothesis of current state").
Respect exclusions everywhere. The page never names a consulting firm.

### Content fields (`build_accounting_hub` input `content`)

- `client` {name, short, type: consumer_lender | retail_bank | credit_union | wealth_asset_manager | insurer | other};
  `branding` {style: volt | client_light | boardroom, primary, secondary, logo_text}; `audience`; `confidentiality`
  (client_draft | internal); `gl_platform`; `epm`; `data_platform`; `current_state_source`; `accounts_illustrative`;
  `target_date`; `exclusions` []; `pain_points` []; `legacy_logic` [] (one item per component);
  `evidence` [{id S1.., name, date, section, kind: policy | client_document | interview | public | other}];
  `prior_proof_approved`.
- Each tab (`today`, `target`, `fim`, `maf`, `migration`) has `headline` (full-sentence action title), `lede`,
  `so_what` {text, trade_off}.
- `today`: `systems` [{id, name, sub, column: source | provisioning | engine | reporting | users, tags: accounting |
  product | custom_logic | manual | gap, role, issue, status, source}] (at most 8 per column); `flows` [{from, to,
  path: accounting | product | other}]; `platforms` []; `principles` [{principle, today}].
- `target`: `consumers` [] (3 to 6); `ownership` [{responsibility: intake | rules | replay | corrections | balances |
  posting | reconciliation | audit, component, record, status, source}]; `posting_grain` {proposal, criteria, status}.
- `fim`: optional `entities` [{name, attributes [], sourced, used_by}] (default by client type), `attributes` [].
- `maf`: `products` [{name, source, catalogue: draft | validated | in_scope, open_items [], stages [{name, events
  [{id, name, trigger, frequency, handled_today, manual, memo, exception, status, source, variant, dates, currency,
  rule_version, reversal, treatment, balance, report, lines [{ledger, side: Dr | Cr, account, gl_format, factor}],
  route, fim [], attributes [], controls [C1..C17]}]}]}] (proof-of-concept product first, at least one exception
  event each, each ledger's lines balance); `controls` [{id, owner, threshold, escalation}].
- `migration`: `waves` [{id W0.., name, scope, exit, duration}] (W0 is the proof of concept); `reconciliation`
  [{level: source_to_hub | hub_to_gl | gl_to_report, item, unit, legacy, hub, reason}] (synthetic); `exit_thresholds`
  [{measure, threshold, owner}]; `nfr` [{area: volumes | resilience | security | operations | ownership | release |
  audit, requirement, status, source}]; `value` [{item, kind, amount, evidence, confidence, owner}]; `legacy`
  [{component, disposition: Retire | Replace | Consolidate | Retain, target, note}] covering every legacy component
  plus close and consolidation.
- `confirm` [{area: accounting_policy | regulatory | security | data_residency | architecture | business_case |
  other, item}] (3 to 10).

Status values: client_confirmed, source_validated (both need a `source`), hypothesis, illustrative,
decision_required. Unknown figures are written "[to size]", "[to confirm]" or "[$ TBD]" and show in red.

### What the tool enforces

Balanced journals per ledger with a debit and a credit; memo events without lines; at least one exception event
per product; flows that name real systems; event, manual and exception counts in the text equal to the catalogue;
every legacy component dispositioned; validated statements cited; excluded names and consulting-firm names absent;
no external references, inline handlers or `javascript:` URLs. Layout, arrows, deep links (`#p1` to `#p5`,
`#p2-6`), keyboard use, focus states, reduced motion and text versions of the diagrams are built in.

## Examples

Short version, with the safeguards kept:

> Build the Accounting Hub page for [CLIENT] ([TYPE]). Sources [LIST], GL [GL], EPM [EPM], legacy accounting logic
> [LEGACY], pain points [PAIN POINTS], proof of concept [PRODUCT], second product [PRODUCT 2], target date [DATE],
> exclude [NAMES], evidence [ATTACHMENTS]. Label every statement by evidence status, keep unknowns in red as to
> confirm, model exception events and rule dimensions, name an owner for each hub responsibility, show prior-delivery
> figures only if approved, and list the review items before client use.

## Pitfalls

- A polished diagram read as approved architecture: keep statuses honest and the review list complete.
- One universal journal per event: use `ledger` on lines where bases differ.
- Event-count ranges quoted as industry facts.
- Prior-client details beyond the anonymised wording.
