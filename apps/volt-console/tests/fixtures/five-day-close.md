## The bank can close in 5 days, and a third of the gain needs no software

- **7 days removed by six levers.** Today's 12 days is in the APQC bottom quartile; the median is 6.5 and the top quartile 4 [S02].
- About 2.5 days come from re-sequencing bank-specific tasks (ECL, IPV, FTP) off the legal-entity close path. This is a policy and auditor decision, not a spend decision.
- Base case: USD 3.5M investment, NPV USD 1.58M, IRR 22.95%, payback 2.94 years [S06].
- The board approves a capacity plan, not a date. Below about 24% effort released, the case destroys value [S06].

Source: APQC via VOLT [S02]; VOLT value-case engine [S06]; client intake [S01].

## Every board KPI falls by 40% or more; days to close is the headline

```chart
{"type":"kpi","title":"Close KPIs: today vs target","note":"Only days to close is measured; the other three are baseline assumptions","labels":["Days to close","Manual journals / month","Late reconciliations %","FTE hours / close"],"series":[{"name":"Target","values":[5,900,2,3450]},{"name":"Today","values":[12,2400,18,6000]}],"better":"down","source":"Client intake [S01]; other values [ASSUMPTION]"}
```

Source: Client intake [S01]; benchmark [S02]; the other three KPIs are [ASSUMPTION] pending a two-close time survey.

## At 12 days the close is 5.5 days behind the median, and close, technology and data are the weakest dimensions

| Dimension | Current | Target | Priority |
|---|---|---|---|
| Close and Consolidation | 2.0 | 4.0 | High |
| Finance Technology | 2.0 | 4.0 | High |
| Data and Reporting | 2.0 | 4.0 | High |
| Controls and Compliance | 3.0 | 4.0 | Medium |
| Operating Model | 2.5 | 3.5 | Medium |
| Change Readiness | 2.5 | 3.5 | Medium |
| Planning and Forecasting | 2.5 | 3.5 | Low |
| Overall | 2.36 (Defined) | 3.79 | |

Source: VOLT maturity model [S05], scored on assumed evidence; APQC days to close [S02].

## Wrong sequencing and manual matching each cause 36% of the gap

| Root cause | Days [ESTIMATE] | Share | Fix |
|---|---|---|---|
| ECL, IPV and FTP sit on the close path | 2.5 | 36% | Policy and calendar |
| Manual reconciliations and intercompany | 2.5 | 36% | Tooling and policy |
| Sub-ledger breaks found late | 1.5 | 21% | Integration |
| Rework (repeat consolidation runs, commentary loops) | 0.5 | 7% | Governance |

Source: [Verify]. Estimated from bank close patterns; to be confirmed by a critical-path map.

## Six levers take the close from 12 days to 5

```chart
{"type":"waterfall","title":"Close duration bridge, business days","unit":"days","note":"Policy levers give 3 days in two quarters; tooling levers give the other 4","labels":["Current close","ECL & valuations pre-close","Sub-ledger feeds","Risk-tiered recs","Intercompany","FTP off close path","Single consol run","Target close"],"series":[{"name":"Days","values":[12,-2,-1.5,-1.5,-1,-0.5,-0.5,5]}],"target":{"value":5,"label":"Target 5 days"},"source":"[ESTIMATE]; baseline [S01]"}
```

Source: [ESTIMATE] lever sizing; baseline [S01]; benchmark [S02].

## Reconciliation releases 900 of the 2,550 monthly hours, more than any other phase

```chart
{"type":"stacked","title":"Close effort by phase, FTE hours per close","unit":"FTE hours","note":"6,000 to 3,450 hours, a 42% fall, equal to about 17 FTE","labels":["Before","After"],"series":[{"name":"Sub-ledger cut-off","values":[900,500]},{"name":"Reconciliation","values":[1800,900]},{"name":"Journals & accruals","values":[1200,700]},{"name":"Intercompany, consol and one further phase","values":[1300,800]},{"name":"Reporting & review","values":[800,550]}],"source":"[ASSUMPTION] illustrative baseline"}
```

Source: [ASSUMPTION]. Reconciliation hours: 1,500 accounts × 1.2 h today; tiered: 540 + 240 + 120 = 900 h.

## The reds cluster on Bank OpCo accruals, ECL and reconciliations, which sit on the critical path

```chart
{"type":"heatmap","scale":"rag","title":"Close task readiness by entity","note":"Fix Bank OpCo and Treasury first; Leasing reporting can wait for wave 2","labels":["Sub-ledger cut-off","Reconciliations","Accruals & ECL","Intercompany","Consol input","Reporting"],"series":[{"name":"Bank OpCo","values":[2,1,1,2,2,2]},{"name":"Mortgage Co","values":[2,2,1,3,3,3]},{"name":"Cards Co","values":[1,2,2,2,3,2]},{"name":"Treasury & Markets","values":[2,1,2,1,2,3]},{"name":"Wealth","values":[3,2,3,1,2,2]},{"name":"Leasing Co","values":[3,3,2,2,1,1]}],"source":"[ASSUMPTION] illustrative"}
```

Source: [ASSUMPTION]. Illustrative entity set; to be validated in controller interviews.

## In the target close, judgement happens before D1 and only six steps sit on the critical path

```process
{"title":"Target 5-day close: D-2 to D5"}
```

Source: [ESTIMATE] target design; systems are generic until the platform is confirmed.

## Option B, a close layer on the current GL, scores 4.35 and leads at every weighting tested

| Criterion (weight) | A: Process + tactical | B: Close layer | C: Re-platform |
|---|---|---|---|
| Close days delivered (30%) | 2 (about 9 days) | 4.5 (5–6 days) | 5 (4–5 days) |
| Time to value (20%) | 5 | 4 | 1 |
| Economics (20%) | 4 | 5 | 1.5 |
| Delivery risk (15%) | 5 | 4 | 2 |
| Optionality (15%) | 3 | 4 | 4.5 |
| Weighted score | 3.60 | 4.35 | 2.98 |
| One-time cost [ESTIMATE] | USD 0.8–1.5M | USD 2.5–5.0M | USD 8–18M |

Source: [ASSUMPTION] weights and scores; [ESTIMATE] costs, pending vendor quotes. A wins below USD 1.5M or if the GL is replaced within 24 months; C wins if the GL is out of support.

## USD 1.6M base NPV, but effort released swings it by about USD 4.9M

| Case | Effort released | Investment | NPV (USD) | IRR | Payback |
|---|---|---|---|---|---|
| Low | 20% | 5.0M | −2,393,243 | −9.87% | Not reached |
| Base | 30% (18 FTE) | 3.5M | 1,577,030 | 22.95% | 2.94 yrs |
| High | 40% | 2.5M | 5,047,304 | 60.94% | 1.73 yrs |

```chart
{"type":"bar","title":"NPV sensitivity, USD M (5 years, 9%)","unit":"USD M","note":"Break-even at about 24% effort released","labels":["Release 20%","Release 40%","Invest 5.0M","Invest 2.5M","Base"],"series":[{"name":"NPV","values":[-0.89,4.05,0.08,2.58,1.58]}],"source":"[S06]"}
```

Source: VOLT value-case engine [S06]. Inputs: 60 FTE, USD 120k loaded cost, USD 0.6M run cost a year, 9% discount rate, 5 years, 2-year ramp.

## Two risks decide success: whether the auditor accepts the design, and whether the freed capacity is redeployed

| Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|
| Auditor rejects soft-close estimates | Medium | High | Walkthrough 1–2 quarters before go-live; hard close at quarter-end | CFO |
| Capacity not redeployed, so NPV turns negative | High | High | Redeployment plan approved alongside funding | CFO / HR |
| D-2 ECL run materially wrong | Medium | High | Re-run threshold; daily report of loans moving into arrears | Head of Credit Risk Finance |
| Regulatory returns stop reconciling to the ledger | Medium | High | Regulatory-to-GL reconciliation control | Head of Regulatory Reporting |
| Poor sub-ledger data slows auto-match | Medium | Medium | Profile 3 months of data before the build | R2R Lead |

Source: [ESTIMATE] practitioner ratings.

## Three decisions in the next 30 days

1. Approve soft-close principles for an auditor walkthrough (CFO).
2. Commit to redeploying about 18 FTE of capacity, the condition for a positive NPV (CFO and HR).
3. Fund Option B discovery and tool selection (CFO and CIO).

| Window | Action | Owner |
|---|---|---|
| Days 1–30 | Close PMO, KPI baseline, time survey, ECL D-2 test | Financial Controller |
| Days 31–60 | Auditor walkthrough; FTP agreement; vendor quotes | CFO / R2R Lead |
| Days 61–90 | First close on the new calendar; tiering approved; tool contract | Financial Controller |

Source: [ESTIMATE]. Research depth: STANDARD. Only days to close is client data [S01].
