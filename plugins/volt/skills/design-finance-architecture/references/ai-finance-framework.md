# AI finance framework: the finance lens and the agentic platform view

Two views every finance transformation deliverable carries from 2026-11-28 (Rakesh's ask), alongside the process,
taxonomy, business and technology reference architecture, lifecycle and finance information model views. Adapted from
published industry "AI bank of the future" and agentic-architecture models, generalized for any FS client. Use no firm
branding and no firm names in the output.

Both views are drawn as ```architecture blocks (two to seven layers, one to four items per layer, each item new, keep
or retire). Put the client's own systems and agents in the items; the lists below are the menu, not a fixed set. Each
layer ends in a "so what" for the CFO; write it in the section text or the block's `note`.

## View 7: AI finance lens

Title the block `"AI finance lens: ..."`. Thesis: finance owns the data spine that AI value depends on. Layers from the
foundation up:

| Layer | Menu of items | So what |
|---|---|---|
| Finance operating model | AI control tower (agent inventory, accuracy, controls, sign-off); insight-led FP&A centre of excellence; finance + data + AI talent; agile delivery pods; value capture office | No control tower, no sign-off. Benefits are tracked by the value office, not just claimed. |
| Core finance technology and data | Platforms: accounting hub and subledger, ERP general ledger, EPM (plan, consolidate, reconcile), regulatory reporting engine. Data: contract-level finance data, retrieval over policies, accounting memos and close evidence, lineage and data quality (BCBS 239 where it applies), master data (COA and hierarchies). AI infrastructure: LLM gateway, MLOps and model monitoring, FinOps for AI spend, security and access tiers | AI is only as trusted as the finance data spine: no lineage, no regulator-ready AI. Start with recon and journal-entry agents on a clean finance data foundation; prove value in one close cycle, then scale. |
| AI-powered finance decisions | Agentic orchestration (copilots and autopilots run close, recon and reporting end to end); balance-sheet digital twin (NII, deposit behaviour, liquidity and capital under rate and credit scenarios). Finance agents with narrow domains: reconciliation matcher, journal entry reviewer, variance narrator, intercompany eliminator, IFRS 9 ECL analyst, regulatory filing checker (capital, liquidity), cost and FTP allocator, tax provision expert. Predictive models: NII and margin, credit loss (ECL), liquidity and cash, expense and headcount drivers, capital projection. Enablers: model risk framework (the local model-risk guideline, for example OSFI E-23 or SR 11-7), SOX-grade controls on AI outputs, reusable agent and prompt library | The biggest prize. Close, recon and regulatory reporting shift to review-by-exception. Hypothesis to validate with the client's own baseline, never a promised number: days off the close and less manual recon effort. |
| Stakeholder engagement | Ask-the-ledger copilot (CFO, CRO and business heads query P&L, NII and capital in plain language); self-serve insight (business lines, treasury and risk drill down without an analyst ticket); living board and ALCO packs (narrative auto-drafted, every number traced to source) | Executives get answers in minutes, not analyst cycles; fewer ad-hoc requests land on FP&A. |

## View 8: Agentic finance platform

Title the block `"Agentic finance platform: ..."`. Thesis: agents live inside finance platforms, governed by one
control plane. Seven layers from the foundation up:

| Layer | Menu of items |
|---|---|
| Enterprise systems and data | Core banking, treasury and ALM, risk systems, HR and procurement, BI and analytics; finance lakehouse, contract and position data, MDM (COA and hierarchies), knowledge (policies and memos) |
| Integration | APIs, events, connectors, tool catalog, MCP, API and MCP gateway |
| Core finance | GL and accounting hub, EPM (plan and consolidate), reconciliation and close, regulatory and management reporting, tax and treasury accounting, cost and FTP allocation |
| Agentic framework | Embedded agents, task orchestration, context grounding (COA, policies), tool invocation, agent runtime and state, human handoff and sign-off |
| Automation | Workflows, RPA, close task manager, low-code automation |
| Finance actors and experience | Controllers, FP&A, tax, LOB and treasury consumers, external AI agents via API or MCP; CFO and LOB copilots, close and reporting workbench, copilots embedded in ERP and EPM, conversational finance queries |
| Agentic governance | Agent control plane (register, permission, monitor and switch off every finance agent); agent IAM and SoD; AI asset registry (model inventory); agent observability; evaluations (accuracy against the ledger); guardrails (materiality and sign-off limits) |

So what: put finance agents where the ledger and controls already live. Bolt-on agents outside ERP and EPM are hard to
SOX-evidence. For a bank, governance is heavier than in a generic enterprise view: model risk, SoD and materiality
limits gate every autopilot before it posts.

Flows to draw: source data into the lakehouse; MCP and APIs between the agentic framework and enterprise systems;
agents to core finance (proposed journals, matches); core finance to the experience layer (answers, packs); the control
plane over every agent.

## Worked scenario (illustrative)

Use a fictional client (for example "Northwind Bank", personal banking) and label it ILLUSTRATIVE_EXAMPLE. A 25 bp
central bank rate cut hits a digital deposit platform:

1. Finance actors: treasury proposes a new savings rate; the CFO asks the copilot for the NIM impact.
2. Experience to twin: the copilot runs the balance-sheet twin (deposit runoff, segment NIM, LCR).
3. Integration (MCP): pulls balances from the core banking system and rates from treasury and ALM.
4. Finance agents: the accrual recon agent matches core banking to the GL; the journal entry reviewer flags breaks.
5. Allocation and narrative: the FTP allocator reprices the funding credit; the variance narrator drafts margin
   commentary; the controller signs off before posting.
6. Governance: the control plane checks accuracy and materiality.

So what: a same-day view of what the cut does to segment NIM, with deposit accruals closed by exception. Size the value
against the client's own close calendar before quoting numbers.

## Rules

- No invented figures: benefits are hypotheses until the client's baseline supports them.
- Agents propose; people approve. No agent posts a journal, files a return or changes a rate without sign-off under
  the control plane.
- Name a regulator or standard only where it applies to the client's jurisdiction.
