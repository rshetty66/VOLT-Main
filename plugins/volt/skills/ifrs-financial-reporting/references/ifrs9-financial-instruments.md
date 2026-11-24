# IFRS 9 — Financial Instruments (deep reference)

## Contents
1. Scope and definitions
2. Classification of financial assets (business model + SPPI)
3. Classification of financial liabilities and the fair value option
4. Embedded derivatives
5. Impairment — expected credit loss (ECL) model
6. Modification of contractual cash flows and derecognition
7. Hedge accounting
8. Presentation and interaction with IFRS 18
9. Key disclosures (IFRS 7)

---

## 1. Scope and definitions

IFRS 9 applies to all financial instruments except listed exclusions (own equity, leases under IFRS 16, insurance contracts under IFRS 17, loan commitments within IFRS 17 scope, etc.).

Key definitions (IFRS 9 Appendix A):
- **Financial asset**: cash, equity of another entity, contractual right to receive cash/another financial asset, contract settled in own equity (non-derivative), derivative settled other than own equity.
- **Effective interest rate (EIR)**: rate that exactly discounts estimated future cash payments/receipts through expected life to gross carrying amount (IFRS 9 5.4.1).
- **Gross carrying amount**: amortised cost before adjusting for loss allowance.
- **Credit-impaired**: one or more events with detrimental impact on estimated future cash flows (default or past due 90+ days among the indicators) (IFRS 9 Appendix A).

## 2. Classification of financial assets (IFRS 9 4.1–4.1.5)

Two tests applied at initial recognition, in order:

### Test 1 — Business model (4.1.1, 4.1.2A)
How groups of financial assets are *managed together* to achieve an objective:
- **Hold to collect (HTC)**: hold assets to collect contractual cash flows.
- **Hold to collect and sell (HTC&S)**: both collecting cash flows and selling.
- **Other**: neither — measured at FVTPL.

Evidence is factual (sales frequency/value history, frequency and volume of sales, reasons for sales). Selling in response to increased credit risk does not taint HTC. Reclassify only on change of business model (4.1.4), applied prospectively from reclassification date.

### Test 2 — SPPI (solely payments of principal and interest) (4.1.1(b), B4.1.7–B4.1.26)
Contractual cash flows must be consistent with a *basic lending arrangement* — return of principal plus time value of money, credit risk, other basic lending risks (e.g., liquidity) and costs plus a reasonable profit margin. Fail SPPI → FVTPL.

Common SPPI-breakers: leveraged returns, returns linked to commodity/equity/currency values, non-recourse structures where cash flows depend on underlying assets, EIR-linked terms with leverage (e.g., 2× LIBOR), terms that modify time value in a way that is not "unleveraged" (B4.1.9B–B4.1.9E assessment), contingent features unrelated to basic lending.

| Category | Criteria | Accounting |
|---|---|---|
| Amortised cost (AC) | HTC + SPPI | EIR method; interest in P&L; FV option if eliminates or reduces measurement/recognition mismatch (4.1.5) |
| FVOCI (debt) | HTC&S + SPPI | AC for P&L (interest, FX, ECL) + FV through OCI; recycling to P&L on derecognition |
| FVTPL | Residual (fail either test, or FV option) | FV through P&L; transaction costs expensed |
| Equity FVOCI election | Irrevocable per-instrument election (5.7.5) | FV through OCI; **no recycling** — only dividends in P&L; gains/losses stay in OCI (transferred within equity) |

Hybrid contracts with host debt: split embedded derivative if not SPPI-compliant unless the whole hybrid is FVTPL.

## 3. Financial liabilities (4.2–4.3)

- Default: amortised cost via EIR (4.2.1).
- **FVTPL** if held for trading, a derivative, or designated under the fair value option (4.2.2).
- **Own credit**: for FVTPL-designated liabilities, the amount of change attributable to own credit risk goes to OCI (5.7.7); only the remainder of the FV change hits P&L. No recycling on derecognition.
- Contingent consideration from a business combination (IFRS 3) is always FVTPL.

## 4. Embedded derivatives

Assess hybrid contracts with non-financial host separately (4.3.2–4.3.7): if the embedded derivative's economic risks are not closely related to the host, and a stand-alone derivative with the same terms would meet the derivative definition, separate it — unless the whole contract is FVTPL, or the host is a financial asset (SPPI test governs instead).

## 5. Impairment — ECL model (5.5, B5.5)

Scope: amortised cost and FVOCI debt assets, lease receivables, loan commitments and financial guarantee contracts not in IFRS 17 scope, contract assets under IFRS 15 (with receivables).

### Three-stage model

| Stage | Trigger | Loss allowance | Interest income |
|---|---|---|---|
| 1 — Performing | No significant increase in credit risk (SICR) since initial recognition | **12-month ECL** (portion of lifetime ECL from default events within next 12 months) | On gross carrying amount |
| 2 — Underperforming | SICR since initial recognition | **Lifetime ECL** | On gross carrying amount |
| 3 — Non-performing | Credit-impaired (default/past due 90+ days among indicators) | Lifetime ECL | On **net** carrying amount (i.e., after allowance) |

- Compare credit risk at reporting date with risk at **initial recognition** (5.5.3), not with the previous reporting date.
- **SICR indicators** (B5.5.17–B5.5.21): significant changes in external/internal ratings, delinquency, watch list, restructuring terms, expected bankruptcy, shifts in market credit spreads, early-warning data.
- **Rebuttable presumption**: more than 30 days past due → SICR (B5.5.35–B5.5.36) unless rebutted with reasonable support.
- **Low credit risk simplification** (B5.5.25): if low credit risk at reporting date (e.g., investment grade), may assume SICR has not occurred.
- **Purchased or originated credit-impaired (POCI)** (5.4.3, B5.5.44): measured at purchase price; interest always on net carrying amount; ECL changes taken to P&L rather than the loss allowance; day-1 "discount" never accreted through the allowance.
- **Forward-looking**: incorporate forecasts of future conditions (multiple scenarios when non-linear), without "unjustifiable cost or effort". Assess collectively when individual assessment is impracticable — groupings must reflect shared credit risk characteristics (B5.5.3).
- **Practical expedient (trade receivables, contract assets, lease receivables)** (5.5.15, B5.5.35): lifetime ECL always (no stage distinction), including simplified provision matrices based on historical loss rates adjusted for current conditions and forecasts.
- Modelling: PD × LGD × EAD, discounted at the original EIR (or an approximation). Lifetime = max expected life considering extension/prepayment options (B5.5.29–B5.5.30).
- Write-off: when no reasonable expectation of recovery (B5.5.59–B5.5.60) — reduced from gross carrying amount, not a reversal through P&L presentation.

## 6. Modification and derecognition

### Modification without derecognition (B5.4.6)
When contractual cash flows are renegotiated/modified but the asset is **not** derecognised, recalculate the gross carrying amount using the **modified contractual cash flows discounted at the original EIR**; recognise the difference immediately in P&L (a "modification gain or loss"). Fees/expenses adjust the gross carrying amount and EIR.

### Derecognition (3.2.3–3.2.15)
1. Determine whether the contractual rights to cash flows **expired** → derecognise.
2. **Transfer**: if the entity has transferred the rights to receive cash flows, or retains them but assumes an obligation to pay them and meets "pass-through" conditions (3.2.5–3.2.6).
3. **Risks and rewards analysis**: if substantially all transferred → derecognise; if substantially all retained → keep and treat the proceeds as a financing. The **10% test** (B3.2.16) is a practical application aid, not a bright line in the standard.
4. If in between → assess **control** (practical ability to sell unilaterally); control lost → derecognise; control retained → recognise continuing involvement asset/liability (3.2.15).
- Note: "substantially all" is an indicator-based judgment (compare PV of cash flows before/after and credit risk exposure).

## 7. Hedge accounting (6.2–6.6)

**Eligibility**: risk management objective; identifiable hedged item (highly probable forecast transaction, firm commitment, net investment in foreign operation, hedged risk component — e.g., benchmark interest rate, must be separately identifiable and reliably measurable, 6.3.7); hedging instrument that is a derivative (or non-derivative FVTPL except FX risk on foreign currency debt) with no net written options unless designated to offset purchased options (6.2.4).

**Effectiveness criteria** (6.4.1(c)): (i) economic relationship between hedged item and instrument; (ii) credit risk does not dominate value changes; (iii) hedge ratio equals the ratio actually used for risk management. Retrospective "bright-line" tests are gone — but design must target an effectiveness outcome of 80–125% in practice (indicative, not in the standard).

**Hedge types**:
- **Fair value hedge**: hedged item adjusted for FV change attributable to hedged risk (including non-financial item layer/risk component); hedging instrument FV through P&L.
- **Cash flow hedge**: effective portion of instrument FV to **OCI** (cash flow hedge reserve), recycled to P&L when hedged item affects P&L; ineffective portion immediately in P&L; forecast transaction no longer expected → recycle immediately; option/time-value and forward-element exclusions ("cost of hedging") may go to a separate OCI reserve (6.5.15).
- **Net investment hedge**: accounted like a cash flow hedge; recycled on disposal of the foreign operation.

**Ongoing**: monitor effectiveness; **rebalance** the hedge ratio without discontinuation when the ratio drifts (6.5.6); **discontinue** hedge accounting prospectively when risk objective no longer met, hedged item/instrument no longer exists, or effectiveness criteria fail (6.5.6).

## 8. Presentation and interaction with IFRS 18

- Under IFRS 18, FVTPL investments and investment-purpose financial assets are classified in the **investing** category; assets backing customer financing may be operating for entities with that main business activity; the entity's classification policy is disclosed. Debt investments at FVOCI within HTC&S business model remain investing unless held for financing customers.
- Interest income/expense on financial instruments classified AC/FVOCI follows the category of the underlying activity.
- Interest income on credit-impaired assets is presented on a net basis (interest revenue net of ECL adjustments for Stage 3).

## 9. Key disclosures (IFRS 7)

- Significance of financial instruments; accounting policy and risk management objectives.
- Classes of financial assets/liabilities by measurement category.
- **Impairment**: reconciliation of loss allowance by stage; explanation of ECL inputs and forward-looking information; credit-risk quality analysis (internal/external ratings); collateral.
- **Fair value**: hierarchy levels 1–3, transfers, level 3 roll-forward and sensitivity.
- **Hedge accounting**: risk management strategy, hedge types, notional amounts, maturity analysis, hedge ineffectiveness (P&L effect).
- **Derecognition**: continuing involvement (qualitative + quantitative).
- Liquidity risk maturity analysis (with IFRS 7 39–B11C); market risk sensitivity (VaR or similar); offsetting (netting) disclosures.
