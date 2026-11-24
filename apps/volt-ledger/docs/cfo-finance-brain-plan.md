# CFO Finance Brain: plan

Status: draft for Rakesh's approval. Date: 24 Nov 2026. No code, PRs or merges until the decisions in section 7 are made.

## 1. The goal in one paragraph

A CFO finance brain that arrives "pre-trained" for an industry, starting with financial services. It designs the
chart of accounts and ledger, works out the finance data the institution needs, and builds an end-to-end finance
information model with lineage from every GL balance down to the instruments behind it. It handles multi-GAAP
treatments (IFRS, US GAAP, local GAAP), allows adjustments at both instrument and GL level, and automates finance in
a controlled way. It is judged by four use cases: faster close, driver-based FP&A, segment finance and
profitability, and finance operations reporting.

Everything in this plan is tested against that paragraph. If a piece of work does not serve it, it goes.

## 2. Target architecture in plain language

Think of it as five layers, bottom to top.

| Layer | What it is | Who does the work |
|---|---|---|
| 1. Industry knowledge pack | The "pre-trained" content per industry: reference chart of accounts, canonical concepts with IFRS / US GAAP / local GAAP lines, reference data model, accounting treatment rules, driver trees, report catalogue, close task and control library, plus a test bank and an exam (section 5) | Curated by the team, versioned, reviewed like code |
| 2. Finance information model | One data spine: instrument, event, accounting rule, journal, GL balance, report line, with adjustment layers and lineage keys (section 4) | Built from the pack, filled from client data |
| 3. Deterministic engine | Posting, accounting rules (event to journal, per GAAP), reconciliation instrument to GL, allocation, driver calculations, statements. Code computes every number, to the cent | Code, fully tested |
| 4. The brain (Claude) | Diagnoses, designs, maps, drafts rules and adjustments, explains. It can only act through engine tools, and it only ever proposes | Claude, with prompts and pack examples |
| 5. Control layer and console | Review queue with maker and checker, approval states, hash-chained evidence, a lineage query, and the VOLT Console chat as the single front door | People approve; the system records |

**Controlled automation** means a ladder the client climbs one step at a time, per process:

| Level | The brain may | Example |
|---|---|---|
| 0 Advise | Explain and recommend | "This account mixes three products" |
| 1 Propose | Draft a design, rule, journal or adjustment; a person approves each one | Proposed CoA, proposed ECL overlay |
| 2 Execute approved rules | Run rules a person has already approved, within limits; exceptions go to a person | Monthly accruals from approved rules, recs within tolerance |
| 3 Monitor | Watch results and raise breaks, never change an approved rule by itself | Flux over threshold, unreconciled instrument balances |

v1 stays at levels 0 and 1, which is what is built today (the proposal ledger never posts to a client GL).

## 3. Honest audit of what is built

About 3,200 lines of Python in `apps/volt-ledger` (94 tests), 23 `ledger_*` tools in the console, a separate
TypeScript CoA app, the FSDF schema, about 60 peer PDFs, and seven spec documents.

### Keep (this is the foundation of controlled automation)

| Item | Why it stays |
|---|---|
| Money, ingest, posting, evidence, store | Integer cents, append-only double entry, one posting service, reversals, hash chain. Exactly what "controlled" needs |
| CoA design (`coa.py`: diagnose, check, propose, map, tie-out, decision log) | This is the heart of the vision. Keep and grow it into the pack |
| Mapping, policy gaps, review queue | The maker and checker spine every later use case reuses |
| FSDF schema and synthetic bank and insurer (`fsdf/`) | The right instrument-to-GL shape, already tied to the GL (checks 9.5, 9.6). Becomes the physical reference of the information model |
| Statements (`build_statement`) and `check_output` | Statements are a use case output; `check_output` stops unsupported numbers in narrative |
| Allocation (largest remainder) and drivers | The building blocks of segment profitability and FP&A |

### Rework

| Item | What changes |
|---|---|
| Ontology (`mvg-bank-v1`, `ext-insurance-v1`) | Becomes part of the knowledge pack. Add a treatment layer per GAAP and a local GAAP slot. XBRL names still unverified |
| FSDF schema | Wire it into the engine (today it is a SQL file plus a test only), add instrument-level and GL-level adjustment tables, add process-run ids |
| Ratios and metrics (`metrics-v1`, ratio catalogue) | Shrink to the KPIs the four use cases need (NIM, cost to income, segment RoE, close KPIs). Drop the peer comparison framing |
| Console `ledger_*` tools | Cut from 23 to about 17 by removing peer tools; group the rest by use case |
| Specs `phase2` to `phase5`, `spec.md` | Superseded by this plan once approved; archive, keep as history |

### Remove (garbage relative to the vision)

| Item | Why |
|---|---|
| Peer results search (`peers.py`, 555 lines, the biggest module), the three peer tools, `peers.json`, `peer-results-search-spec.md` | Benchmarking a bank against peers' public results is analyst work, not a CFO brain. It drove the most recent effort and none of the four use cases need it |
| Peer corpus in project files | Do not use in the product. Keep it read-only as internal reference for calibrating the pack's reference CoA and disclosure lists, or delete it (decision 1) |
| `apps/volt-coa` (separate CoA app) | Its checks are already ported into `volt-ledger`. Two CoA engines is duplication |
| Consulting-report-style outputs in the brain's path (long narrative reports, cover pages, APQC value cases) | The brain's outputs are designs, mappings, rules, journals, recs, data registers and statements, as tables and files. Narrative is a short explanation of those |

### Outside the brain, flagged only

The wider console (236 agents, 378 skills, 35 workflows, APQC analytics, templates) and `apps/gyan` (a second chat
client) are a separate consulting toolkit. They are not garbage in themselves, but they dilute the product. Decision 5
asks whether to hide them from the brain's experience.

### What is missing (the real gap)

1. No instrument data inside the engine, so no GL-to-instrument lineage yet.
2. No accounting rules engine (event to journal, by GAAP and rule version).
3. No multi-GAAP ledger design: one ledger only, no GAAP delta ledgers, no local GAAP.
4. No adjustment model at instrument or GL level beyond plain proposed journals.
5. No "finance data requirements" output: the brain does not yet work backwards from reports to data needs.
6. Nothing yet for close, FP&A or ops reporting beyond statements and one allocation.

## 4. Finance information model and lineage

### The chain

```text
Source record -> Instrument / contract -> Event -> Accounting rule (GAAP, version) -> Journal line
   -> GL balance (full segment grain, per ledger) -> Report line (statutory, management, segment, plan)
```

| Level | Holds | Built from |
|---|---|---|
| L0 Source | Contracts, positions, cash flows, market data, parties | FSDF tables (`fsi_d_*`, `fct_position`, `fct_cashflow`) |
| L1 Instrument accounting | Measurement per instrument per GAAP: amortised cost and EIR, fair value, ECL by stage, IFRS 17 group measures | Treatment rules in the pack |
| L1a Instrument adjustments | Overlays on one instrument or a pool: amount, measure, GAAP, reason, approver, reversal date | Person or brain proposes, person approves |
| L2 Journals | Every line carries instrument id, event id, rule id and version, process run id | Rules engine through the one posting service |
| L3 GL balances | Per ledger, at full segment grain (entity, natural account, cost centre, business line, product, stage, intercompany) | Sum of journals, never typed |
| L3a GL adjustments | Top-side journals, reclasses, eliminations: reason code, approver, and an optional push-down to segments or instruments by driver | Person or brain proposes, person approves |
| L4 Reporting | Statutory per GAAP, management, segment, plan | Concept mapping in the pack |

### The lineage rule

For any GL balance, the system can answer: which journals, which events, which instruments, which rule versions,
which process run, and which adjustments. The control that proves it is one reconciliation, already prototyped as
FSDF check 9.5:

```text
GL balance = sum of instrument balances (through the mapping rule) + instrument adjustments + GL adjustments
```

The difference must be zero, and every GL adjustment that is not pushed down is listed with its reason. Lineage that
stops at GL level is allowed, but it is visible and owned.

**Process lineage** comes from the process run id on every journal: which close task, rule run or approval produced
it, and who approved it.

### Multi-GAAP: primary ledger plus delta ledgers (recommended)

- The IFRS ledger is the primary book. US GAAP and local GAAP are delta ledgers that hold only the differences
  (for example CECL lifetime loss against IFRS 9 stage 1, LDTI against IFRS 17, hedge accounting differences).
- Each difference is a treatment rule in the pack, with its standard reference marked [UNVERIFIED] until checked.
- A US GAAP statement is the primary plus the US GAAP delta, and the delta reconciles by rule.
- The alternative, full parallel ledgers, is simpler to explain but doubles the data and the reconciliations
  (decision 2).

### Driving out finance data needs

The brain works backwards from what the CFO must produce:

```text
Report line -> concept -> GL account and segments -> mapping rule -> instrument balance type -> source attribute
```

The output is a **finance data requirements register**: each attribute, why it is needed, which reports use it, the
likely source system, and a data quality rule. This is a primary deliverable alongside the target CoA.

## 5. What "pre-trained" should mean

| Option | What it is | Verdict |
|---|---|---|
| Fine-tune a model | Train model weights on finance data | Not now. It needs thousands of approved examples we do not have, it cannot be audited line by line, it goes stale when standards change, and it is costly |
| Knowledge packs (recommended) | Versioned content the brain reads through tools, plus worked examples and an exam | Auditable, reviewable by a finance lead, updatable in a day, and it works with Claude today |

A **financial services knowledge pack v1 (bank)** contains:

1. Reference chart of accounts with segments, ranges and hierarchy (today's golden target chart, grown).
2. Canonical concepts with IFRS, US GAAP and one local GAAP line each.
3. Reference information model (the FSDF-derived schema) and balance-type mapping rules.
4. Treatment rules for the main multi-GAAP differences (ECL, fair value option, hedge accounting, leases).
5. Driver trees (NII, fees, cost, capital) and allocation templates (FTP, IT cost, cost to serve).
6. Report catalogue (statutory, management, segment) and the data requirements each one implies.
7. Close task and control library.
8. A test bank (synthetic bank) and an **exam**: questions with approved answers that score the brain on mapping
   accuracy, tie-outs and treatment choices. A pack version ships only if it passes.

The insurer pack (IFRS 17 and LDTI) follows the same template, then credit unions, pension funds and asset managers,
then other industries. Approved decisions from each engagement feed back into the pack, anonymised and reviewed.
Revisit fine-tuning only if exam scores plateau and there are thousands of approved mappings.

## 6. Roadmap, use case by use case

Each phase ends with a demo in the VOLT Console on synthetic data and Rakesh's sign-off before the next starts.

| Phase | Scope | Acceptance criteria |
|---|---|---|
| 0 Clean up | Remove peer search and tools, retire `apps/volt-coa`, archive superseded specs, regroup console tools | All tests pass; no peer tool in the console; tool list grouped by use case; nothing in section 3 "Remove" left in the product path |
| 1 Bank pack v1 and information model | Pack items 1 to 3 and 8; FSDF data wired into the engine; instrument and GL adjustment objects; lineage query; data requirements register | From any GL balance, lineage reaches the instruments and ties to the cent; one instrument adjustment and one GL adjustment each flow through and reverse cleanly; the register is generated from the target CoA; the exam runs and is scored |
| 2 Multi-GAAP | Rules engine (event to journal); IFRS primary plus US GAAP delta for ECL and one more difference | IFRS and US GAAP statements from the same instrument data; the delta reconciles rule by rule; every treatment cites its rule |
| 3 Faster close | Close task library, instrument-to-GL recs, flux with explanations, adjustment workflow | A synthetic month end runs start to finish; every rec passes or lists breaks with a cause; the close pack comes out with lineage on every number |
| 4 Segment finance and profitability | FTP, cost allocation, cost to serve, segment P&L and balance sheet | Segment P&L sums to entity P&L to the cent; every allocated amount traces to a driver and an approved rule |
| 5 Driver-based FP&A | Driver trees from the pack, plan built from drivers at segment grain, scenarios | Back-test: drivers set to actuals reproduce actuals exactly; each scenario difference is explained by driver |
| 6 Finance ops reporting | Report catalogue from the pack, scheduled packs, data quality dashboard | Each report line traces to GL and instrument; data quality rules from the register run and report |
| 7 Insurer pack | IFRS 17 and LDTI pack on the synthetic insurer, then the next FS segment | Same exam and tie-out bar as the bank pack |

Phase 0 is about a week. Phases 1 and 2 are the core of the brain; the use cases then reuse them, so each later
phase is smaller.

## 7. Decisions for Rakesh

Decided 24 Nov 2026: Rakesh approved all five recommendations below. Phase 0 starts as a draft PR; nothing merges
without his approval.

1. **Remove peer benchmarking and retire `apps/volt-coa`?** Recommended: yes. Keep the peer corpus read-only as
   internal reference for the pack, not in the product.
2. **Multi-GAAP design:** IFRS primary plus GAAP delta ledgers (recommended), or full parallel ledgers?
3. **"Pre-trained" means knowledge packs plus an exam, no fine-tuning for now?** Recommended: yes.
4. **Use-case order:** close, then segment profitability, then FP&A, then ops reporting (recommended, as above), or a
   different order?
5. **The wider console and Gyan:** hide them from the brain's experience so the console opens on the CFO brain
   (recommended), keep as is, or slim them down?
