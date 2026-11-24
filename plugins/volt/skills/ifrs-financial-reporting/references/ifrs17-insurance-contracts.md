# IFRS 17 — Insurance Contracts (deep reference)

## Contents
1. Scope
2. Level of aggregation
3. Recognition
4. General Measurement Model (GMM)
5. Variable Fee Approach (VFA)
6. Premium Allocation Approach (PAA)
7. Onerous contracts
8. Reinsurance contracts held
9. Transition
10. Presentation and disclosures

---

## 1. Scope (IFRS 17 3–8)

Applies to: insurance contracts issued, reinsurance contracts held and issued, and **investment contracts with discretionary participation features (DPF)**. Out of scope: IFRS 9 financial instruments, fixed-fee service contracts (IFRS 15 where the entity does not bear significant insurance risk), warranty contracts within IAS 37/IFRS 15 scope, employers' assets/liabilities from employee benefits, residual value guarantees.

**Insurance contract**: contract under which the issuer accepts **significant insurance risk** (possibility of paying more than would be paid without the insured event) by agreeing to compensate the policyholder if a specified uncertain future event adversely affects the policyholder. Contracts transferring financial risk without significant insurance risk are within IFRS 9 (unless they have DPF → IFRS 17). Insurance risk includes longevity and expense risk, not just mortality/morbidity.

## 2. Level of aggregation (14–24, B61–B71)

- **Portfolio**: contracts subject to similar risks and managed together.
- **Group (unit of account)**: within each portfolio, group contracts by issue date into at least: (i) onerous at initial recognition; (ii) no significant possibility of becoming onerous; (iii) remaining contracts. Grouping considers profitability and homogeneous risk profiles.
- **Annual cohorts**: groups must contain only contracts issued **within one year** (B65–B71 detail the guidance; cohorts may not exceed twelve months from the start of issue date to the end).
- Onerousness assessed at group level at initial recognition; individual contracts within a group cannot be used to offset losses.

## 3. Recognition (25–28)

Recognise groups of contracts from the **earliest** of: coverage period begins, first payment from the policyholder becomes due, or the group is onerous. For contracts acquired in a business combination/transfer, recognise at acquisition.

## 4. General Measurement Model (GMM) (29–44)

**Liability for remaining coverage (LRC) = Fulfilment cash flows (FCF) + Contractual service margin (CSM)**

### Fulfilment cash flows (33–36)
- **Best-estimate, probability-weighted estimates** of future cash flows within the contract boundary;
- Discounted at **current** market-consistent rates reflecting time value of money and risks specific to the cash flows (top-down or bottom-up technique);
- Plus a **risk adjustment for non-financial risk** (degree of compensation required for bearing uncertainty — disclosed techniques: confidence levels, cost of capital, etc.);
- **Contract boundary**: premiums beyond the boundary are unrecognised. Boundary = enforceable rights/obligations; premiums are within boundary if the entity can compel the policyholder to pay or has a substantive right to terminate/reprice.

### Contractual service margin (37–44, B110–B118)
Represents unearned profit. At initial recognition CSM = −(FCF + any day-one cash flows), floored at **zero** (day-one gains → CSM; day-one losses → P&L immediately, onerous).
Subsequent measurement roll-forward:
1. Opening CSM
2. + CSM of new contracts added to the group
3. + interest accreted at **discount rate locked at initial recognition** (the "accretion rate")
4. + changes in FCF relating to future service (experience adjustments to premiums received that relate to future service, and changes in estimates of future cash flows — **unless onerous**)
5. − CSM **released to P&L** for services provided (systematically, based on **coverage units**)
6. + (GMM with OCI option) adjustment for rate-change effects
7. = Closing CSM (never negative; if FCF changes make it negative → fully release any CSM to zero and recognise loss as onerous)

**Coverage units** (B119–B124): quantity of benefits provided, e.g., expected benefits duration × expected in-force contracts, policy counts, or sum assured; fixed for the duration unless pattern changes.

**OCI option** (88): insurers may choose to recognise the effect of **changes in discount rates** in OCI (liability remeasured at current rates, with a separate "OCI reserve" accreted at the locked-in rate so total OCI change ties out). Must be consistent across all contracts and locked for all periods.

## 5. Variable Fee Approach (VFA) (45–53)

Simplified adaptation of GMM for contracts where the entity's share of the fair value of underlying items substantially determines the benefits; applies when the policyholder participates in a clearly identified pool of underlying items and the entity expects to pay policyholders a **substantial share** of the returns from the pool.

Mechanics: CSM is adjusted each period by (i) the entity's share of the **change in the fair value of underlying items** (mirroring), (ii) risk adjustment changes for non-financial risk relating to future coverage, (iii) experience adjustments on premiums relating to future service; releases to P&L over coverage as in GMM.
- Gains/losses on underlying items attributable to the policyholder go through the FCF; those attributable to the entity adjust the CSM.
- **Risk mitigation option** (49): when derivatives (or reinsurance/non-derivative financial instruments measured at FVTPL) mitigate financial risk and the entity uses them to mitigate the effect of financial variables on the entity's share, the insurer may elect to recognise less impact through CSM.
- Loss-recovery component and onerous assessments apply as in GMM.

## 6. Premium Allocation Approach (PAA) (53–59, B126–B136)

Eligibility: coverage period **≤ 1 year**, or the entity reasonably expects the PAA LRC measurement will not differ materially from GMM. Assessment at initial recognition for each group; PAA election per group; liability is like an **unearned premium reserve** plus a **liability for incurred claims** (best-estimate discounted FCF + risk adjustment; may use undiscounted if immaterial).

- Premiums allocated to revenue on a coverage basis (straight-line unless pattern justifies otherwise); acquisition cash flows amortised over coverage.
- No explicit CSM; no OCI choice for the LRC (the LRC uses the discount rate at the start of the coverage period).
- **Onerousness**: simplified — only when facts and circumstances indicate onerous; loss recognised immediately, reversal allowed.

## 7. Onerous contracts (16, 47–48)

If a group is onerous at inception (or becomes onerous subsequently): recognise a loss in P&L immediately and establish a **loss component** within the LRC. Subsequent measurement: the loss component absorbs, in order: (1) changes in estimates of future FCF, (2) experience differences; recovery only when facts and circumstances change. Losses cannot be offset against other groups' CSM.

For VFA, the CSM can absorb losses from adverse changes (unlike GMM) because the entity's share adjusts; but once onerous, the loss component mechanics apply similarly.

## 8. Reinsurance contracts held (60–70)

Measured as GMM/VFA modified: CSM represents **net cost or net gain** of reinsurance; the risk adjustment represents the transfer of risk.
- If net cost at inception → CSM (amortised over coverage).
- If **net gain** at inception (e.g., reinsurance purchased at favourable price) → **gain recognised immediately in P&L**, no CSM.
- The reinsurance asset is reduced for onerous groups of underlying contracts it covers (loss-recovery component): recognise the recovery of onerous losses through P&L, subject to constraints (B96–B100).
- Reinsurer accounts under the same GMM/VFA; no PAA for reinsurers (assess materiality instead).
- Presentation: reinsurance revenue is net presentation of reinsurance income minus reinsurance expense; ceded premium cash flows not shown as revenue.

## 9. Transition (Appendix C, C1–C24)

Full retrospective (FRA) applied unless impracticable; then modified retrospective (MRA); if not reasonable and supportable, **fair value approach (FVA)**:
- **FVA**: measure FCF and CSM such that no CSM arises on transition — i.e., identify the CSM as the difference between fair value of contracts and FCF at transition (and FCF may differ from GMM due to use of FVA simplifications).
- **MRA**: permitted simplifications (e.g., use of hindsight for groups, aggregate determination of groups, reasonable proxy for the locked-in rate) — must achieve the closest outcome to FRA.
- For annual cohorts, transition groups cannot exceed contracts issued within one year before transition; previously reported periods not restated (modified application to comparatives).
- Day-one CSM under FRA is retained; comparatives restated where practicable.

## 10. Presentation and disclosures (74–89, B120–B126)

**Statement of profit or loss**: present separately:
- **Insurance revenue**: expected claims and benefits + change in risk adjustment + CSM release + other (e.g., experience adjustments on premiums received) − **insurance acquisition cash flows amortised**; excludes investment components (amounts repayable in all circumstances) and excludes changes related to future service and finance.
- **Insurance service result** = insurance revenue + (insurance acquisition cash flows recovered) − incurred claims − change in LRC etc.
- **Insurance finance income or expenses**: change in carrying amount due to the time value of money and financial risk; effect of **discount-rate changes may be presented in OCI** (policy choice per portfolio, consistent). Rates are current.
- Income tax and discontinued operations presented separately (IFRS 18 categories do not change this).

Under IFRS 18, insurance revenue and insurance service expenses are in **operating**; insurance finance income/expense is in **investing**; income from assets backing insurance liabilities is in **investing**.

**Disclosures**: reconciliations of LRC and LIC between opening/closing; roll-forward of CSM (new business, interest accretion, changes in FCF relating to future service, CSM release, effect of contracts initially recognised in the year); transition amounts (CSM and loss component) by transition approach; methodology and inputs (discount rates, risk adjustment techniques, OCI option elections); effect of rates on the statement of financial position; product information and annual cohort disclosures.
