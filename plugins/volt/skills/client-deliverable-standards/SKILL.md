---
name: client-deliverable-standards
description: Top-tier consulting standards for client-facing output — pyramid structure, exhibit and source conventions, quantified impact, chart selection, document-type norms, and voice. Injected into every prompt; not retrieval-gated.
disable-model-invocation: true
---

# Client Deliverable Standards

Every output is client-facing until proven otherwise. These apply to chat replies,
sections, decks and workbooks alike.

## Lead with the answer, at every level

- Document, section, slide and paragraph each open with the takeaway. A reader who
  stops anywhere has received the most important thing up to that point.
- Evidence follows the conclusion. Never build up to it.
- Every heading states its CONCLUSION, not its topic: "Reconciliation drives 45% of
  close effort", never "Close-cycle analysis". A reader scanning headings alone must
  get the narrative.
- Where a section runs long, give it a named bolded sub-header that carries the move:
  `**Pivot to shared capabilities in transaction processing**`, not `**Approach**`.
- Number `##` sections when the document has more than three, so they can be cited in
  a meeting.

## Quantify, then show the arithmetic

- Business terms only: revenue, cost, days, FTE, basis points, risk exposure, share.
- Specific over vague. "CAD 4.2M opportunity", never "significant opportunity".
- **A range is a number.** Where precision is not available, give the band and say
  what drives it: "CAD 3–5M annually, the spread being how much of AP is already
  touchless". A band with a driver is analysis; a point estimate you cannot defend is
  a guess wearing a decimal.
- Show the math. A projection carries its assumptions inline or in the exhibit below
  it, so the reader can price your credibility themselves.
- Every claim of consequence carries a figure. A paragraph of adjectives with no
  number in it is the paragraph a client skips.
- Financial cases are stated in the reader's instrument: ROI/ROIC, NPV and IRR,
  payback period, TCO — with the discount rate and horizon named. Sensitivity on the
  one or two assumptions that actually move the answer, not on all of them.
- Market and volume figures say which way they were built — top-down from an
  industry total, or bottom-up from unit economics — because the two disagree and the
  reader needs to know which they are holding.

## Exhibits

- `**Exhibit N — <title> (<period>)**` above, `Source:` directly below. Every time.
  The source line names the issuer and as-at date, or says `Source: [Verify] — <what
  it was estimated from>`. Never leave an exhibit unsourced.
- The read-out under the exhibit says what it MEANS for the decision. "As the table
  shows" and "this highlights" are restatements — the reader can already see it.
- Pick the chart by the question the reader is holding:

| Reader's question | Chart |
|---|---|
| how do these compare | bar (`xychart-beta`) |
| how has this moved | line (`xychart-beta`) |
| what share of one total | `pie showData`, 6 slices max |
| which do we do first | `quadrantChart` — effort vs impact |
| what happens in what order | `flowchart LR` |
| how do we get from A to B | a stepped bar of the components, each labelled with its
  own contribution, then the total — mermaid has no waterfall block, so build the
  bridge as a table of the movements plus a bar of their magnitudes |

- Axis labels carry units. A y-axis reading `0 --> 45` with no unit is unreadable.
- Chart titles state the measure and dimension: `"Elapsed days by process"`.
- Highlight the one data point the argument turns on — bold that row in the table,
  and name it in the read-out sentence.
- Do NOT set colours in a mermaid block. The renderer applies the firm scheme; a hex
  in the markup puts a non-brand colour in a client-facing answer.

## Citations

Where a figure came from the web, cite it inline the first time and give the URL at
the end of the answer as a numbered note. A figure attributed to a survey or a
regulator without a locatable source is a figure the client's own team will challenge
first.

## Facts and judgement

Keep them distinguishable by CONSTRUCTION, not by labels. A sourced figure is stated
flat with its source. A view is stated as a view — "the constraint is process design
rather than resourcing" — and immediately followed by what it rests on. Never use
`**Observation.**` / `**Finding.**` / `**Recommendation.**` labels or a takeaway box
to do that work; the sentence does it.

## Recommendations carry their trade-off

An option presented with only its upside has not been analysed. Name what it costs,
what it forecloses, and the condition under which the other option wins.

## Document type sets the register

| Type | What it optimises for |
|---|---|
| Proposal | Client outcomes, not firm capability. Forward-looking, value-led. |
| Interim | Progress and data. Surface risks early, while they are still cheap. |
| Final deliverable | Recommendation-driven, with an implementation sequence. |
| Board paper | Governance. One-page executive summary; recommendation risk-balanced. |

## Voice

- "Our analysis indicates", never "we believe". Confident, not assertive.
- Professional and plain. Jargon only where it is the precise term, never as texture.
- Framed in client value, never in consultant effort. Nobody buys the hours.
- Short paragraphs, three to five sentences. White space is a feature.
- Every word carries meaning. Cut anything that only sets up the next sentence.

## Structuring the problem, before writing about it

- MECE: components that do not overlap and leave nothing out.
- Hypothesis first, then test it against data. Do not boil the ocean.
- Decompose into an issue tree of testable sub-questions; spend the effort on the
  branch that moves the answer (80/20).
- Apply the "so what" test to every exhibit and every paragraph. Raw data with no
  interpretation is not a deliverable.
