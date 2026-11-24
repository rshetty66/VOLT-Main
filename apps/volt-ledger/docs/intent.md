# VOLT Ledger Brain: intent

Status: draft for approval, Phase 1. Date: 24 Nov 2026. Owner: Rakesh.

## The problem

Financial institutions hand their advisors a trial balance and a set of financial statements and ask, in effect,
"what are our accounting policies really, where does our chart of accounts let us down, and what should the target
ledger look like?" Today a consultant answers that by hand: mapping hundreds of accounts to reporting lines,
reading policy notes, spotting gaps, and building allocation models in spreadsheets. It is slow, hard to review,
and every number is only as good as the person who typed it.

A generic finance chatbot makes this worse, not better: it produces confident numbers and citations that nobody can
trace. We need the opposite.

## What we are building

A policy-aware accounting brain inside the VOLT platform, used through the VOLT Console deployed on Render. A
client (or the engagement team on their behalf) uploads a trial balance and financial statements in the console
chat. The brain:

1. Maps every trial-balance line to a canonical, XBRL-labelled reporting concept, with a confidence score.
2. Reconstructs the client's accounting policies from the statements and flags policy gaps: places where the
   chart of accounts cannot support a required presentation without a policy decision.
3. Produces mapped IFRS statements, with a US GAAP view where the group needs one.
4. Proposes journals and cost allocations (for example IT costs to business lines) in its own proposal ledger,
   never in the client's general ledger.
5. Explains every result in plain language, where each figure comes from code and each claim cites a client
   document, a computed value, or a standard paragraph.

The language model reasons, maps and explains. Deterministic code computes every number.

## Who it is for

- **Engagement team** (finance transformation consultants, led by Rakesh): runs the diagnosis, reviews every
  output, and takes it to the client.
- **Client finance leadership** (controller, CFO office): reviews and signs off proposals before anything is used.
- First client profile: a mid-size bank reporting under IFRS, with a US GAAP view for its parent. Insurers, credit
  unions, pension funds and asset managers follow, one at a time.

## What success looks like for v1

A live demo in the VOLT Console on Render where, from a synthetic bank trial balance and statement set:

- Every trial-balance row is accounted for: mapped, or explicitly flagged as unmapped.
- Mapped IFRS statements tie exactly, to the cent, to the trial balance.
- At least the seeded policy gaps are flagged, each with the reason and the standard it relates to.
- One proposed journal balances, and its reversal restores the prior balances exactly.
- IT costs are allocated to business lines by FTE, and allocated totals equal the pool to the cent.
- Every number in the narrative traces to a tool result, and every policy claim cites a source or is marked
  [UNVERIFIED].
- Nothing reaches the client view before the engagement lead has reviewed it, and the client controller signs off.

## Out of scope for v1

- Posting to, or reading live from, any client ERP or general ledger (export of approved proposals comes later).
- Institution types other than a bank; regulatory reporting (regulator returns, capital calculations).
- Loading licensed IFRS or FASB standards text; v1 cites paragraph numbers only.
- XBRL or iXBRL filing ingestion, and the "company vision and outlook" questionnaire.
- Fine-tuning a model; v1 uses Claude with system prompts and few-shot examples.
- Full FASB or IFRS taxonomy ingestion; v1 holds only the elements the uploaded statements need.
- Multi-currency translation and consolidation eliminations.
