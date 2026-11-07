# Mortgage lifecycle worked design

Scope: illustrative lender-side Canadian residential mortgage, initially IFRS 9 amortised cost, non-POCI, no hedge, no
sale designation or embedded unusual features. Apply approved business-model/SPPI assessment and applicable
amendments. Use separate US-GAAP policies where in scope. Entries below are role templates, not a universal posting
policy. Source IDs: S16-S21, S26-S30 in [sources.md](sources.md).

| Business event | Accounting event / decision | Illustrative accounting roles | Data and downstream effects |
|---|---|---|---|
| Application received / indicative approval | No loan recognition merely from application | Usually no loan journal; separately assess paid fees/costs | Application pipeline, probability-weighted originations plan; no funded balance |
| Binding commitment created | Assess commitment scope and impairment | If required, Dr impairment expense / Cr commitment provision; no funded principal merely from commitment | Undrawn amount, expiry, cancellability, insured status; capital/commitment reporting under separate rules |
| Funding / advance | Recognize loan and settlement | Dr mortgage principal / Cr cash or approved settlement payable | Contract, entity, product, currency, principal, insurance, collateral; origination movement and lending volume |
| Integral origination fee received | Include qualifying fee in EIR/carrying amount | Dr cash / Cr deferred fee contra-loan | Fee nature, amount, service obligations, EIR inputs; do not recognize all fees immediately as service revenue |
| Direct incremental origination cost paid | Include eligible cost in carrying amount | Dr deferred loan cost / Cr cash or payable | Eligibility evidence and cost nature; ordinary overhead excluded from this template |
| Separate servicing or other service fee | Assess distinct performance/service obligation | Dr cash/receivable / Cr service revenue or deferred service liability as earned | Apply relevant revenue policy; do not force every fee into EIR |
| Initial and subsequent ECL measurement | Record approved allowance output | Dr impairment expense / Cr loan allowance for increases; reverse for decreases | Model/version, measurement date, stage, exposure and approved amount; commitment provision separately |
| Daily/period-end interest accrual | EIR measurement and fee/cost amortization | Dr interest receivable and/or loan amortized-cost adjustment / Cr interest income | Approved EIR schedule and day count; reconcile contractual accrual and carrying-value components |
| Scheduled cash payment | Allocate receipt under contract/policy | Dr cash / Cr interest receivable and Cr principal; other roles only if justified | Payment waterfall, arrears, prepayment, amortization; principal versus interest cash flow |
| Partial prepayment / full discharge | Settle and reassess remaining carrying amount | Dr cash / Cr principal/interest; recognize residual fee/cost and gain/loss if policy requires | Contractual penalty treatment, break costs and settlement date; prepayment assumption calibration |
| Arrears / significant credit deterioration | Update risk and impairment inputs | Arrears flag alone need not generate a journal; post approved ECL change | Preserve distinct days-past-due, IFRS stage and regulatory-default definitions; N3/credit-risk attributes |
| Credit-impaired status | Assess interest basis and impairment | Apply relevant net-carrying interest treatment for qualifying IFRS cases; route approved measurement | Do not apply a universal US nonaccrual rule or map IFRS Stage 3 directly to regulatory default |
| Contractual rate reset | Recalculate schedule per contractual terms | Journal effect depends on approved measurement; no assumed modification loss | Index, spread, reset dates and cash flows; rate sensitivity and NII forecast |
| Renewal / refinancing / modification | Determine continuation versus derecognition/new instrument | If no derecognition, eligible IFRS modification difference goes to P&L with carrying-value adjustment; otherwise separate derecognition/new recognition | Contract rights, revised cash flows, original EIR and basis-specific policy; do not borrow financial-liability 10% test as an automatic asset rule |
| Sale / securitization / participation | Assess derecognition, continuing involvement and consolidation | Sale accounting only if criteria met; otherwise financing/other appropriate accounting | Transfer terms, recourse, servicing rights, retained interest and funding; capital relief assessed separately |
| Foreclosure / collateral realization | Assess recognition, valuation and asset classification | Require approved recovery/repossessed-asset measurement; do not blindly reclassify full loan balance | Legal title, valuation, realization costs and remaining claim; specialized cases blocked until reviewed |
| Write-off | Apply approved recoverability policy | Dr allowance / Cr loan for approved covered amount; handle shortfall under policy | Write-off authority, residual legal recovery rights and separate cash-recovery process |
| Recovery after write-off | Recognize cash recovery under approved presentation | Dr cash / Cr recovery/impairment role as policy determines | Original loan and write-off links; no automatic recreation of performing loan |
| Correction / backdate / reversal | Preserve original audit trail; controlled re-accounting | Linked reversal/replacement; route closed-period and restatement decisions | Original event/journal, dates, approved rule version, reason and downstream reload |

## Numerical origination golden case

Use synthetic CAD amounts: principal 500,000; qualifying integral fee received 3,000; qualifying direct incremental
cost paid 1,000. Assume funded and settled on the same date; ignore taxes and other transaction effects for this
example.

| Entry | Debit CAD | Credit CAD |
|---|---:|---:|
| Mortgage principal / Cash | 500,000 | 500,000 |
| Cash / Deferred origination fee (contra-loan) | 3,000 | 3,000 |
| Deferred eligible cost / Cash | 1,000 | 1,000 |
| Impairment expense / Loan allowance (IFRS example) | 2,000 | 2,000 |

Carrying amount before allowance = 500,000 - 3,000 + 1,000 = 498,000. Net after illustrative IFRS allowance 2,000 =
496,000. Net cash outflow = 498,000. Total debits = credits = 506,000. The validator proves entry balance and lineage
fields, not eligibility, EIR or ECL measurement. The fee/cost role structure is one defensible design; approved
measurement must support the actual configuration.

Assume a separately approved US-GAAP CECL allowance of 10,000 on the same 498,000 pre-allowance basis: net = 488,000.
In a full independent US book record the full 10,000 allowance. In a delta overlay on the IFRS representation, record
only the additional 8,000 (Dr impairment expense / Cr allowance). Do not post 10,000 on top of the IFRS 2,000. These
ECL numbers illustrate multi-basis mechanics; they are not model estimates or expected portfolio ratios. IFRS 9
commonly starts with 12-month ECL for qualifying Stage 1 exposures; CECL for in-scope amortized-cost loans uses
lifetime expected losses. Purchased credit-deteriorated/POCI and other exceptions require separate policies.

For an illustrative IFRS Stage 2 reassessment from allowance 2,000 to 8,000, the incremental journal is 6,000. Stage
labels do not determine the loss amount. Cash-flow, collateral, forward-looking scenarios and model outputs remain
independently governed.

## Regulatory and EPM crosswalk

| Consumer | Required design detail | Validation / owner |
|---|---|---|
| OSFI M4 balance sheet | Applicable loan, adjustment and allowance presentation, reporting perimeter/currency and as-of date | Reconcile signed loan carrying value to approved M4 taxonomy; regulatory reporting owner |
| OSFI E2 mortgage report | Mortgage categories and applicable insured/uninsured, product, location, amortization and other required attributes | Pin return/instructions/validation-rule version and exact cells; mortgage reporting owner |
| OSFI N3 arrears | Arrears/credit-impaired categories; gross, allowance and net mortgage data | N3 instructions require total net mortgage loans to agree with M4 Asset 3(b); implement the applicable released cross-return rules |
| OSFI CAR / capital return | Regulatory approach, exposure/default/collateral/insurance/LTV attributes and off-balance-sheet conversion where relevant | Approved capital engine and effective CAR edition; no invented weights or inference that accounting allowance equals regulatory expected loss |
| Consolidation | Loan asset, allowance, interest/impairment P&L; originations/repayment/write-off/FX movements, entity and intercompany | GL-to-consolidation tie-out, movement roll-forward and policy/consolidation adjustments |
| Planning / profitability | Opening loans + advances - principal repayments - write-offs +/- other movements = closing loans; average balance/yield, prepayments, impairment, funding/FTP and servicing costs | Driver provenance, scenario versions and observed actuals. Tax/FTP/RWA may be separate approved services. Do not sum end-of-month balances over months. |

Create a separate mapping record for every in-scope report cell with report ID/version, reporting perimeter, source
attribute, transformation, owner and test. The table identifies verified return families, not a finished regulatory
filing configuration. CAR 2026 page indicates validity through the reporting period ending January 31, 2027; pin the
edition applicable to each filing date and institution. IFRS classification/measurement amendments effective for
periods beginning on or after January 1, 2026 also need date-aware policy review (S17).
