# Finance-Risk-Treasury Convergence Patterns

Reference for `banking-tom-design`. Loaded when a TOM engagement covers more than the
finance function alone — which is most of them above mid-size, because the three functions
contend for the same contract-level data.

## Why they diverged

Finance, Risk and Treasury each needed positions at contract level and each built its own
extract, on its own calendar, with its own adjustments. Nothing forced them together: they
report to different executives, answer to different regulators, and close on different
cycles. The result is three versions of the same balance sheet that reconcile only by
manual bridge, usually late in the close.

The symptom clients describe is "we spend the first week of close explaining why Risk's
number differs from Finance's". The cause is architectural, not behavioural.

## The four convergence patterns

Ordered by ambition. Most institutions land on 2 or 3; pattern 4 is a multi-year programme
and should not be promised inside a single TOM engagement.

### 1. Reconciliation-first (tactical)

Leave the three data flows in place; make the differences explainable and owned. Build a
standing bridge between Finance and Risk positions with a named owner per difference
category, and a tolerance policy that distinguishes timing from methodology from error.

- **Buys:** close-time reduction, audit defensibility, an evidence base for the business case.
- **Does not buy:** any reduction in duplicated effort or platform cost.
- **When:** the client cannot fund a data programme yet, or needs a quick credibility win.
- **Trap:** it is frequently mistaken for the end state. Say explicitly that it caps out.

### 2. Shared data foundation (the common case)

One contract-level data layer serves all three functions; each retains its own calculation
and reporting layer. Finance, Risk and Treasury draw the same positions and diverge only
where methodology genuinely requires it — and that divergence becomes visible and approved
rather than accidental.

- **Buys:** one version of position data, elimination of duplicate extracts, lineage from
  report to contract.
- **Retains:** three calculation engines, three sets of adjustments.
- **When:** the default recommendation for mid-size and above. Aligns with the OFSAA
  Financial Services Data Foundation being shared across Operational and Business Finance.
- **Prerequisite:** an agreed common information model. Without it this pattern becomes a
  landing zone with three views on top, which is pattern 1 with more infrastructure.

### 3. Shared sub-ledger / accounting engine

Add a common accounting and measurement engine over the shared foundation, so a single
event produces the finance entry, the risk position and the treasury view together. This
is what SAP FPSL and Oracle Accounting Hub are for.

- **Buys:** event-level consistency, IFRS 9 / IFRS 17 measurement done once, material
  close-time reduction.
- **Costs:** the largest change-management load of the four — it moves accounting rules out
  of spreadsheets and out of individual analysts' hands.
- **When:** a subledger replacement or Bank Analyzer decommission is already in flight.
  Do not initiate it purely for convergence; ride an existing programme.

### 4. Converged function

Organisational convergence, not just data: a single accountable owner for the integrated
balance sheet, shared teams for data management, methodology and control, with Finance,
Risk and Treasury retaining only their distinct decision support.

- **Buys:** removes the last duplicated layer; single point of accountability for the
  integrated view.
- **Costs:** executive-level org change, regulatory notification in some jurisdictions,
  and it fails outright without patterns 2 and 3 already in place.
- **When:** post-integration in a merger, or where a regulator has challenged the
  institution's ability to produce a consistent view.

## Sequencing

The patterns are cumulative — 3 without 2 produces a shared engine over inconsistent data,
and 4 without 3 is an org chart change with the same reconciliation underneath.

| Wave | Pattern | Typical duration | Gate to next |
|---|---|---|---|
| 1 | Reconciliation-first | 3–6 months | Differences categorised and owned; business case evidenced |
| 2 | Shared data foundation | 12–24 months | Common information model agreed and positions tie to GL |
| 3 | Shared accounting engine | 18–36 months | Measurement rules externalised and parallel-run clean |
| 4 | Converged function | 6–12 months after 3 | Board mandate and a single named owner |

## What to assess before recommending a pattern

1. **Do the three functions agree what a contract is?** If the definition of a facility or
   a position differs, that gap is the first deliverable, ahead of any platform choice.
2. **Where do adjustments live?** Adjustments held in spreadsheets after the extract are
   the real blocker; they must be traced before pattern 2 can be scoped.
3. **Whose calendar wins?** Convergence forces a shared close calendar. If Risk closes on
   T+10 and Finance on T+4, someone's process changes — decide before design, not during.
4. **Is there an existing platform programme?** Pattern 3 is affordable only as part of one.
5. **What has the regulator said?** A prior finding on data consistency changes both the
   funding conversation and the acceptable timeline.

## Cross-References

- **banking-tom-design** — the parent skill; convergence is its Phase 3 content
- **banking-data-model** — the common information model this depends on
- **sap-fioneer-fpsl** / **sap-bank-analyzer** — pattern 3 platform detail
- **oracle-ofsaa-wiki** — Financial Services Data Foundation for pattern 2
