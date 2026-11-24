# VOLT Ledger Brain: Phase 5 validation and acceptance plan

> Superseded on 24 Nov 2026 by [`cfo-finance-brain-plan.md`](cfo-finance-brain-plan.md). Kept as history: the engine
> rules it defines still apply where the code cites it.

Status: approved 24 Nov 2026 (A24 thresholds as written; A25 single reviewer for now). Used through the VOLT chat interface. Builds on all earlier phase documents.

The MVP is accepted only when every test in this plan passes. A phase is not called done on a "mostly". Where a
threshold is a judgement rather than a rule (mapping precision and recall), it is marked [ASSUMPTION] for Rakesh to
confirm or change.

## 1. Summary of pass and fail criteria

| # | Area | Test | Pass | Fail |
|---|---|---|---|---|
| V1 | Mapping | 50 trial-balance lines mapped by the model, scored against a blind human answer key | Precision >= 95% on mappings with confidence >= 0.90; overall recall >= 85%; every low-confidence mapping sent to review [ASSUMPTION A24] | Any threshold missed, or any mapping >= 0.90 that is wrong *and* was not reviewed on the first client run |
| V2 | Policy gaps | Seeded gaps on the synthetic chart | 8 of 8 seeded gap types found and flagged | Any seeded gap missed |
| V3 | Coverage | Every TB row accounted for | 100% of rows mapped or explicitly flagged | Any row silently dropped |
| V4 | Computation | Golden cases for posting, reversal, allocation and ratios | Exact equality to the cent (ratios to the stated 4 decimals) | Any difference, however small |
| V5 | Invariants | Property-based tests P1 to P10 (Phase 3) | All pass at 10,000 examples each | Any counterexample |
| V6 | Narrative | 20 policy determinations checked by a person, sentence by sentence | Zero uncited claims; zero numbers not produced by a tool | Any one uncited claim or untraceable number |
| V7 | Gates | Known-bad narratives fed to `check_output` | 100% of seeded violations caught | Any violation passed |
| V8 | Reconciliation | Statutory, management and US GAAP views tie back to the same journals | Every view ties to the same journal lines; differences fully explained by tagged journals | Any unexplained difference |
| V9 | Review flow | Items cannot reach the client without engagement-lead approval | 100% enforced | Any bypass |
| V10 | Deployment | The demo runs on Render through the VOLT Console | Demo script completes; ledger service not reachable from the internet | Any step fails |

## 2. V1: mapping validation

**Sample.** 50 lines from the synthetic trial balance (A15, about 120 accounts), chosen by stratified sampling:

| Stratum | Lines |
|---|---|
| Clear names, common concepts (for example "Customer deposits - savings") | 20 |
| Generic or ambiguous names (for example "Other income", "Sundry") | 10 |
| Accounts carrying a seeded gap (section 3) | 8 |
| Unusual sign or contra accounts | 6 |
| Dimension encoded in the account code | 6 |

**Answer key.** Before the model runs, the engagement lead (and a second reviewer for any line they are unsure of)
writes the correct concept, or "policy gap", for each of the 50 lines. The model's output is not shown to them
first, so the key is not anchored on the model's answer. Disagreements between the two reviewers are settled and
logged; the agreement rate is reported.

**Scoring.**

- A mapping is *correct* when the model's concept equals the answer key, or both say "policy gap".
- *Precision* = correct mappings / mappings the model made (gap flags count as answers).
- *Recall* = correct mappings / 50.
- Results are reported in two bands: confidence >= 0.90 and below 0.90. The >= 0.90 band is the one that can skip
  review after the first client run, so it must be the most precise.
- Calibration check: the error rate in the below-0.90 band should be higher than in the >= 0.90 band. If not, the
  confidence scores are not meaningful and the threshold cannot be used to skip review.

**Traceability.** For all 50, follow the mapping's evidence id to the source TB row. Pass = 50 of 50 trace.

## 3. V2 and V3: gaps and coverage

The synthetic chart is seeded with one account per gap type in `phase2-ontology.md` section 5: mixed fee
recognition, no stage split on the allowance, a material catch-all, business line in the account code, rent expense
beside right-of-use assets, software capitalisation, fees netted, and a wrong-sign balance.

- V2 pass: all 8 are flagged with the right gap type and linked to the right account.
- V3 pass: `ingest_trial_balance` reports stored + rejected = input rows, and every stored row has an active mapping
  or a linked gap. Checked by a query, not by reading.

## 4. V4 and V5: computational validation

Golden cases live in `tests/golden/` with the hand calculation recorded beside each (the spreadsheet file name and
who checked it). Each must match **exactly**.

| Case | What is checked |
|---|---|
| G-TB | Synthetic TB debits = credits; mapped IFRS balance sheet and income statement tie to the TB and to the synthetic statements with zero difference on every line |
| G-JNL | A three-line reclass journal changes the three balances by exactly its amounts |
| G-REV | Reclass plus its reversal returns every balance to the pre-reclass value |
| G-LOCK | Posting into a locked period is refused and writes nothing |
| G-ALLOC-1 | IT pool 100,000.00 over FTEs 120 / 45 / 35 gives 60,000.00 / 22,500.00 / 17,500.00 |
| G-ALLOC-2 | 100.00 over equal drivers 1 / 1 / 1 gives 33.34 / 33.33 / 33.33, the extra cent to the first target by id |
| G-ALLOC-3 | A pool with a negative balance (a credit in a cost pool) allocates with the sign kept and still sums exactly |
| G-RATIO | NII, efficiency ratio, fee income share, loan-to-deposit, allowance ratio, stage mix, equity to assets and the business-line contribution metrics on the synthetic data, each to 4 decimals |
| G-RATIO-NC | A ratio with a missing input (for example CET1 ratio with no RWA uploaded) returns `not_computable` listing RWA, and no number |

V5 runs the Phase 3 property tests at 10,000 examples each in CI. Any counterexample fails the build.

## 5. V6 and V7: narrative validation

**V6, human check.** The model produces 20 policy determinations on the synthetic statements (the three few-shot
areas excluded). For each, a reviewer marks every sentence as one of: cited to a client page, cited to a tool result,
cited to a standard reference (with [UNVERIFIED] where it should be), or uncited. And every number as: matches a tool
display string exactly, or does not.

- Pass: zero uncited claims, zero unmatched numbers, and every unbacked standard reference marked [UNVERIFIED].
- Reported, but not pass or fail: how many determinations the reviewer agreed with on substance. This feeds the
  fine-tuning dataset later.

**V7, gate test.** A fixed set of 30 deliberately bad narratives (a number off by one cent, a number with no cite, a
made-up paragraph without [UNVERIFIED], a cite key that does not exist, a percentage the model worked out itself, a
journal that does not balance). Pass: `check_output` catches all 30. The set grows every time a real miss is found.

## 6. V8: reconciliation validation

The point: the statutory view, the management view and the second-GAAP view are three ways of looking at **one**
set of journals, not three separate sets of numbers.

1. **Statutory to TB.** IFRS statement lines = TB through mappings and calculation arcs (G-TB).
2. **Management to statutory.** For each income statement concept: sum over business lines (including an explicit
   "Unassigned" member) of the management P&L = the statutory amount, after the allocation journals. Checked for
   every concept; difference must be zero.
3. **Allocation is neutral at group level.** Allocation journals net to zero per natural account at group level;
   they only move cost between business lines.
4. **US GAAP to IFRS.** US GAAP view = IFRS view + journals tagged `gaap = us-gaap`. Every difference between the
   two views is fully explained by those journals, and each is linked by a `reconciliation_path` arc. Test with the
   credit loss allowance (ECL to CECL) adjustment in the synthetic data, using a client-supplied US GAAP figure.
5. **Same journal lines.** For three sampled statement lines, `drilldown` in all three views reaches the same TB rows
   and journal line ids. Pass = identical leaf sets, apart from the explicitly tagged allocation or GAAP journals.

## 7. V9: review and approval flow

- An item with no engagement-lead approval is never returned by the client view API (tested for every item kind).
- `record_review_decision` at the client stage without a prior engagement-lead approval is refused.
- The model's tool list does not contain `record_review_decision`, `record_driver_values`, `lock_period` or
  `unlock_period` (checked against the console's registered tools).
- Every decision is an evidence record, and the hash chain verifies after the full demo run.

## 8. V10: deployment on Render

Run on the real Render deployment, following a written demo script:

1. The Render blueprint deploys both services; `volt-ledger` is a private service with its own disk.
2. From outside Render, the ledger service URL does not answer (it has no public address).
3. A call to the ledger without `VOLT_LEDGER_TOKEN` is refused.
4. In the VOLT Console: upload the synthetic TB and statements, run the chart-of-accounts diagnosis, review and
   approve mappings and gaps as engagement lead, propose and reverse one journal, run the IT allocation by FTE,
   compute the investor and IR pack, generate the narrative, approve as client.
5. Every step's output passes the gates; the research bundle download contains every `L` key with its evidence id.
6. After a service restart, all data is still there (the disk works) and the evidence chain still verifies.

## 9. Who does what

| Role | Responsibility |
|---|---|
| Claude (build partner) | Writes the tests, the synthetic data, the gate test set and the demo script; runs automated checks |
| Engagement lead (Rakesh) | Writes the V1 answer key, does the V6 review, approves the demo run |
| Additional reviewers (later) | Check the V1 lines the engagement lead is unsure of; agreement rate reported |

## 10. Exit criteria

The MVP is accepted when V1 to V10 all pass in one recorded run, the results are saved as a validation report in the
repo, and Rakesh signs it off. Any later change to the ontology, prompts or engine re-runs V3 to V10 automatically
and V1 and V6 before the next client release.

## 11. Assumptions added in this phase

| Id | Assumption | Validate by |
|---|---|---|
| A24 | Mapping thresholds: precision >= 95% in the >= 0.90 confidence band, overall recall >= 85% | Rakesh to confirm now |
| A25 | Single reviewer (the engagement lead) for the V1 answer key for now; more reviewers can be added later, and the agreement rate is reported once there are two | Approved 24 Nov 2026 |
| A26 | V1 and V6 run on synthetic data for the MVP; they are repeated on the first real client's data before any client release | First client |
