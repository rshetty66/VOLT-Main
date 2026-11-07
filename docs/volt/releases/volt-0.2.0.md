# VOLT 0.2.0: Finance Architecture and Accounting Events

This release adds a finance architecture skill with deterministic validators, and a Finance Workbench in the VOLT
Console that works from real documents first.

## What's new

### Skill: `design-finance-architecture` (methodology 2.0.0)

- A gated method from product lifecycle to accounting events, then to ledger, COA and dimensions, then to accounting
  hub, ERP, EPM and regulatory lineage.
- Eight reference modules: platform matrix, event method, mortgage lifecycle, controls and validation, interfaces,
  commercial model, industry overlays, and source register.
- JSON Schemas for events, rules and results.
- Real data first:
  - figures come from client documents or from public filings found with the `web-source-lookup` method;
  - synthetic `ILLUSTRATIVE_EXAMPLE` data is used only when the user says real data is not available.
- Deterministic validators (Python, standard library; `pypdf` for PDFs):
  - `validate_journals.py`: balance per journal, entity, basis, ledger, period and currency; approved rules within
    their effective dates; lineage; event identity.
  - `validate_mapping.py`: exact preservation of each balance from legacy to target account.
  - `verify_extraction.py`: every extracted figure's quote is on its cited page, its value is shown in that quote,
    and the totals tie (gross less allowance equals net, the allowance roll-forward, the stage split).
  - `self_test.py`: 94 regression cases.
- Checks a validator does not perform are reported as NOT_RUN, never as PASS.
- New command `/volt:design-finance-architecture`.

### VOLT Console: Finance Workbench

- **Sources:**
  - finds an issuer's published statements with Claude web search;
  - fetches a filing and extracts the residential-mortgage figures, or takes an uploaded document;
  - checks every figure against its page at zero model tokens;
  - the maker confirms each figure.
- **Journal simulator:** portfolio journals for provision, write-offs and recoveries, built only from confirmed
  figures. The posting rule stays a draft until a person is named as approver.
- **Mapping prover:** CSV upload of legacy balances, the mapping, and independent target balances.
- **Evidence pack:** source register, figures with page and quote, proofs, and maker and checker names. You can copy
  it.
- **Run-status chip and token meter:** model input, output and cache tokens, web searches and fetches, and validator
  runs at 0 tokens.
- **Two assistants:**
  - an assistant-ui panel for questions, with validation at 0 tokens;
  - in live mode, a self-hosted CopilotKit copilot that operates the workbench's own buttons. Confirming figures stays
    with the person. CopilotKit telemetry is off and its inspector is disabled.

### Security

- npm `overrides` pin patched versions of transitive dependencies (`undici`, `@fastify/busboy`, `graphql-scalars`,
  `body-parser`, `zod`).
- Console `npm audit`: 0 high and 0 critical. One moderate remains (`@hono/node-server` `serveStatic`, not used) plus
  seven low.

## Run it

```bash
cd apps/volt-console
npm install
cp .env.example .env   # add ANTHROPIC_API_KEY for live mode; leave empty for demo mode
npm run dev            # http://localhost:5173 -> Finance Workbench
```

The server needs `python3` with `pypdf` on its path (`pip install pypdf`).

## Known limits

- Fetching a filing straight from its URL uses Claude's `web_fetch`. The API refuses it from network-restricted
  sandboxes, so run the console on a normal host for that step. Search and uploads work everywhere.
- The source register (S01-S30) is marked UNVERIFIED until it is link-checked for an engagement.
- The behavioural evaluation of the skill (G6) is pending review.
- This is an advisory accelerator with offline checks. It is not a certified accounting engine, and it posts nothing
  to an ERP.

Merged in #15, #16, #17 and #18.
