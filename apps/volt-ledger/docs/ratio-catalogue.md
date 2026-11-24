# VOLT Ledger Brain: ratio and metric catalogue

Status: draft for approval, part of Phase 1. Date: 24 Nov 2026. Companion to `spec.md` (tool `compute_ratio`).

Scope: a bank (A1). Insurer, credit union, pension and asset manager catalogues are added when those client types
are added.

## How ratios work in the brain

- **Ratios are data, not code.** Each metric below is a row in a metric registry: an id, a formula written over
  canonical concepts (from the ontology) and driver inputs, a rounding rule, and a unit. Adding a ratio for a client
  means adding a row, not writing code. `compute_ratio` evaluates the formula in Decimal arithmetic.
- **Definitions vary by bank.** "Efficiency ratio", "NIM" and "ROTE" are defined slightly differently by each bank
  and regulator. The registry holds one default definition per metric; a client override is a new registry row with
  a reason, and both are shown side by side. Defaults here are marked [UNVERIFIED] until the engagement lead
  confirms them against the client's published definitions.
- **Where the inputs come from.** Each metric needs one or more of:
  - **GL:** balances from the trial balance, mapped through the ontology. Available from v1.
  - **Prior:** the same balances for an earlier period (a second trial balance upload). Needed for growth rates and
    averages.
  - **Plan:** budget or forecast figures (an uploaded plan file).
  - **Driver:** operational data such as FTEs, accounts or transactions (uploaded or typed in by a person).
  - **Reg:** regulatory figures such as RWA, CET1 capital, HQLA (uploaded from the client's regulatory returns).
  - **Market:** share count, share price, dividends per share (uploaded or typed in by a person).
- **Missing input means no number.** If an input is missing, `compute_ratio` returns `not_computable` with the list
  of missing inputs. The model may never estimate or fill in an input (spec section 5, prohibited operation 6).
- **Averages.** "Average" means the simple average of opening and closing balances unless the client supplies
  monthly balances, in which case it is the average of month-end balances. The method used is recorded in evidence.
- **Units.** Percentages are returned as decimal strings to 4 decimal places (`"0.5423"` = 54.23%); per-share
  values to 4 decimal places; multiples to 2. Annualised ratios state the annualisation factor used.

Audience key: **IR** = investors and investor relations, **CFO**, **FPA** = FP&A lead, **BL** = business-line
heads. Tier: **v1** = computed in the MVP demo from the synthetic data set; **v1.1** = computed as soon as the
non-GL input is uploaded (the engine supports it from v1, the demo data may not include it); **later** = needs data
or models out of v1 scope.

## 1. Earnings and income

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `nii` | Net interest income (NII) | Interest income - interest expense | GL | IR, CFO, FPA, BL | v1 |
| `non_interest_income` | Non-interest income | Fee and commission income + trading income + other operating income | GL | IR, CFO, FPA, BL | v1 |
| `total_operating_income` | Total operating income (revenue) | NII + non-interest income | GL | IR, CFO, FPA, BL | v1 |
| `fee_income_share` | Non-interest income share | Non-interest income / total operating income | GL | IR, CFO, BL | v1 |
| `ppop` | Pre-provision operating profit | Total operating income - operating expenses | GL | IR, CFO, FPA, BL | v1 |
| `net_income` | Net income attributable to shareholders | Profit after tax - non-controlling interests | GL | IR, CFO | v1 |
| `effective_tax_rate` | Effective tax rate | Income tax expense / profit before tax | GL | CFO | v1 |
| `revenue_growth` | Revenue growth | Total operating income / prior-period total operating income - 1 | GL, Prior | IR, CFO, FPA, BL | v1.1 |
| `nii_growth` | NII growth | NII / prior-period NII - 1 | GL, Prior | IR, CFO, FPA | v1.1 |

## 2. Margin and spread

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `nim` | Net interest margin | NII (annualised) / average interest-earning assets | GL, Prior | IR, CFO, FPA, BL | v1.1 |
| `asset_yield` | Yield on interest-earning assets | Interest income (annualised) / average interest-earning assets | GL, Prior | CFO, FPA | v1.1 |
| `cost_of_funds` | Cost of interest-bearing liabilities | Interest expense (annualised) / average interest-bearing liabilities | GL, Prior | CFO, FPA | v1.1 |
| `net_interest_spread` | Net interest spread | Asset yield - cost of funds | GL, Prior | CFO, FPA | v1.1 |
| `cost_of_deposits` | Cost of deposits | Interest expense on deposits (annualised) / average deposits | GL, Prior | CFO, BL | v1.1 |
| `nim_bridge` | NIM or NII bridge (volume, rate, mix) | Decomposition of NII change into volume and rate effects | GL, Prior, monthly balances | CFO, FPA | later |

## 3. Efficiency and cost

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `efficiency_ratio` | Efficiency ratio (cost-income ratio) | Operating expenses / total operating income [UNVERIFIED: some banks exclude amortisation of intangibles or one-off items] | GL | IR, CFO, FPA, BL | v1 |
| `adjusted_efficiency_ratio` | Adjusted efficiency ratio | (Operating expenses - items tagged as notable) / (total operating income - items tagged as notable) | GL, notable-item tags approved by a person | IR, CFO | v1.1 |
| `operating_leverage` | Operating leverage (jaws) | Revenue growth - operating expense growth | GL, Prior | IR, CFO, FPA | v1.1 |
| `opex_growth` | Operating expense growth | Operating expenses / prior-period operating expenses - 1 | GL, Prior | CFO, FPA | v1.1 |
| `opex_mix` | Operating expense mix | Each expense category / total operating expenses | GL | CFO, FPA | v1 |
| `staff_cost_ratio` | Staff cost ratio | Staff costs / total operating income | GL | CFO, FPA | v1 |
| `cost_per_fte` | Cost per FTE | Operating expenses / average FTEs | GL, Driver | CFO, FPA, BL | v1.1 |
| `revenue_per_fte` | Revenue per FTE | Total operating income / average FTEs | GL, Driver | CFO, FPA, BL | v1.1 |
| `cost_to_assets` | Cost to average assets | Operating expenses (annualised) / average total assets | GL, Prior | CFO | v1.1 |

## 4. Returns

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `roe` | Return on equity | Net income (annualised) / average shareholders' equity | GL, Prior | IR, CFO | v1.1 |
| `rote` | Return on tangible equity | Net income (annualised) / average (equity - goodwill - other intangibles) [UNVERIFIED: tax effect on intangibles varies] | GL, Prior | IR, CFO | v1.1 |
| `roa` | Return on assets | Net income (annualised) / average total assets | GL, Prior | IR, CFO | v1.1 |
| `rorwa` | Return on risk-weighted assets | Net income (annualised) / average RWA | GL, Reg | IR, CFO, BL | v1.1 |
| `roac` | Return on allocated capital | Business-line net income (annualised) / capital allocated to the business line | GL, Reg, allocation | CFO, BL | later |
| `raroc` | Risk-adjusted return on capital | (Revenue - cost - expected loss - tax) / economic capital | GL, risk models | CFO, BL | later |

## 5. Credit quality

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `cost_of_risk` | Cost of risk | Credit loss expense (annualised) / average gross loans | GL, Prior | IR, CFO, BL | v1.1 |
| `allowance_ratio` | Allowance to loans | Expected credit loss allowance / gross loans | GL | IR, CFO, BL | v1 |
| `npl_ratio` | Non-performing (stage 3) loan ratio | Stage 3 gross loans / gross loans | GL with IFRS 9 stage dimension | IR, CFO, BL | v1 |
| `npl_coverage` | NPL coverage | Stage 3 allowance / stage 3 gross loans | GL with stage dimension | IR, CFO | v1 |
| `stage_mix` | IFRS 9 stage mix | Stage 1, 2 and 3 gross loans / gross loans | GL with stage dimension | IR, CFO, BL | v1 |
| `net_charge_off_rate` | Net charge-off rate | (Write-offs - recoveries, annualised) / average gross loans | GL, Prior | IR, CFO | v1.1 |

## 6. Balance sheet, funding and liquidity

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `loan_to_deposit` | Loan-to-deposit ratio | Net loans / customer deposits | GL | IR, CFO, BL | v1 |
| `loan_growth` | Loan growth | Gross loans / prior-period gross loans - 1 | GL, Prior | IR, CFO, FPA, BL | v1.1 |
| `deposit_growth` | Deposit growth | Customer deposits / prior-period customer deposits - 1 | GL, Prior | IR, CFO, FPA, BL | v1.1 |
| `funding_mix` | Funding mix | Each funding source / total funding | GL | CFO | v1 |
| `equity_to_assets` | Equity to assets | Shareholders' equity / total assets | GL | IR, CFO | v1 |
| `lcr` | Liquidity coverage ratio | HQLA / 30-day net cash outflows | Reg | IR, CFO | v1.1 |
| `nsfr` | Net stable funding ratio | Available stable funding / required stable funding | Reg | IR, CFO | v1.1 |

## 7. Capital

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `cet1_ratio` | CET1 ratio | CET1 capital / RWA | Reg | IR, CFO | v1.1 |
| `tier1_ratio` | Tier 1 capital ratio | Tier 1 capital / RWA | Reg | IR, CFO | v1.1 |
| `total_capital_ratio` | Total capital ratio | Total capital / RWA | Reg | IR, CFO | v1.1 |
| `leverage_ratio` | Leverage ratio | Tier 1 capital / leverage exposure measure | Reg | IR, CFO | v1.1 |
| `rwa_density` | RWA density | RWA / total assets | GL, Reg | IR, CFO | v1.1 |
| `capital_generation` | Organic capital generation | Change in CET1 ratio from earnings net of dividends and RWA growth | Reg, Prior | IR, CFO | later |

The brain reports capital and liquidity ratios from figures the client uploads from its regulatory returns. It does
not calculate RWA, CET1 or HQLA itself (regulatory calculation is out of v1 scope).

## 8. Per share and valuation

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `eps_basic` | Basic earnings per share | Net income attributable to ordinary shareholders / weighted average shares outstanding | GL, Market | IR, CFO | v1.1 |
| `eps_diluted` | Diluted earnings per share | As basic, with diluted share count | GL, Market | IR, CFO | v1.1 |
| `bvps` | Book value per share | Ordinary shareholders' equity / shares outstanding at period end | GL, Market | IR, CFO | v1.1 |
| `tbvps` | Tangible book value per share | (Ordinary equity - goodwill - intangibles) / shares outstanding | GL, Market | IR, CFO | v1.1 |
| `dividend_payout` | Dividend payout ratio | Dividends declared / net income | GL, Market | IR, CFO | v1.1 |
| `price_to_book` | Price to book | Share price / BVPS | Market | IR | v1.1 |
| `price_to_tangible_book` | Price to tangible book | Share price / TBVPS | Market | IR | v1.1 |
| `pe_ratio` | Price to earnings | Share price / diluted EPS (trailing 12 months) | GL, Market | IR | v1.1 |

## 9. Planning and performance management (FP&A)

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `variance_to_plan` | Variance to budget or forecast | Actual - plan, and actual / plan - 1, for any metric or line | GL, Plan | CFO, FPA, BL | v1.1 |
| `forecast_accuracy` | Forecast accuracy | 1 - absolute(actual - forecast) / actual, per line and in total | GL, Plan | CFO, FPA | v1.1 |
| `run_rate` | Annualised run rate | Latest month or quarter x 12 or x 4 | GL (monthly) | CFO, FPA | v1.1 |
| `headcount_variance` | Headcount variance | Actual FTEs - planned FTEs | Driver, Plan | FPA, BL | v1.1 |
| `nii_sensitivity` | NII sensitivity to rates | Change in NII for a parallel rate shift | ALM model | CFO, FPA | later |

## 10. Business-line and product profitability

All business-line metrics use the same formulas as the group metrics above, filtered by the business-line
dimension, after `run_allocation` has allocated indirect costs. A business line's figures plus unallocated items
always add back to the group total; that is checked by code.

| Id | Metric | Default formula | Inputs | Audiences | Tier |
|---|---|---|---|---|---|
| `bl_operating_income` | Business-line operating income | Total operating income for the business line | GL with business-line dimension | BL, CFO, FPA | v1 |
| `bl_direct_contribution` | Direct contribution | Business-line income - direct costs | GL with dimension | BL, FPA | v1 |
| `bl_contribution_after_allocations` | Contribution after allocations | Direct contribution - allocated indirect costs | GL, allocation | BL, CFO, FPA | v1 |
| `bl_efficiency_ratio` | Business-line efficiency ratio | (Direct + allocated costs) / business-line operating income | GL, allocation | BL, CFO | v1 |
| `bl_cost_of_risk` | Business-line cost of risk | Business-line credit loss expense / business-line average loans | GL, Prior | BL, CFO | v1.1 |
| `bl_rorwa` | Business-line return on RWA | Business-line net income / business-line RWA | GL, Reg, allocation | BL, CFO | v1.1 |
| `cost_to_serve` | Cost to serve per customer or account | Business-line total cost / customers or accounts | GL, Driver | BL, FPA | v1.1 |
| `revenue_per_customer` | Revenue per customer | Business-line operating income / customers | GL, Driver | BL | v1.1 |
| `product_contribution` | Product contribution margin | Product income - direct costs - allocated costs | GL with product dimension, allocation | BL, FPA | v1.1 |
| `ftp_margin` | Funds-transfer-priced margin | Product interest income - FTP charge (assets), or FTP credit - interest expense (liabilities) | FTP rates | BL, CFO | later |

## 11. Default packs by audience

The console offers one-click packs. Each pack is just a list of metric ids from the tables above.

| Pack | Metrics |
|---|---|
| Investor and IR pack | nii, nim, total_operating_income, fee_income_share, efficiency_ratio, operating_leverage, ppop, roe, rote, roa, cost_of_risk, npl_ratio, npl_coverage, loan_to_deposit, cet1_ratio, leverage_ratio, lcr, nsfr, eps_diluted, bvps, tbvps, dividend_payout, price_to_tangible_book |
| CFO pack | IR pack + effective_tax_rate, asset_yield, cost_of_funds, net_interest_spread, opex_mix, cost_per_fte, rwa_density, funding_mix, stage_mix, adjusted_efficiency_ratio |
| FP&A pack | nii, non_interest_income, total_operating_income, ppop, efficiency_ratio, opex_growth, opex_mix, staff_cost_ratio, cost_per_fte, revenue_per_fte, variance_to_plan, forecast_accuracy, run_rate, headcount_variance, loan_growth, deposit_growth |
| Business-line pack | bl_operating_income, bl_direct_contribution, bl_contribution_after_allocations, bl_efficiency_ratio, bl_cost_of_risk, bl_rorwa, cost_to_serve, revenue_per_customer, product_contribution, loan_growth, deposit_growth |

## 12. What the v1 demo data must contain

To show at least the v1 tier, the synthetic data set (A2) includes: two trial balances (current and prior
period, so averages and growth work), an IFRS 9 stage dimension on loans and allowances, a business-line dimension
on income and direct costs, an IT cost pool with FTEs per business line, and one small "regulatory and market
inputs" file (RWA, CET1 capital, HQLA and net outflows, share count, share price, dividends) so the v1.1 tier can
also be shown in the demo.
