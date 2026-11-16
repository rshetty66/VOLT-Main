# Driver-Based FP&A Models for Financial Services

Tags: `[D]` design recommendation, `[I]` illustrative, `[R]` regulation or standard to confirm. Parameter values in
examples are illustrative, never client facts. Rule and metadata mechanics are in
[onestream-rules-and-integration.md](onestream-rules-and-integration.md) and
[onestream-fs-metadata-design.md](onestream-fs-metadata-design.md).

## 1. Model architecture principles `[D]`

1. **Layers.** Inputs and assumptions -> drivers -> calculations -> outputs -> reporting. A reviewer should be able to
   point at any output number and walk it back through calculations to inputs in under five minutes.
2. **Behaviour off-platform, assembly on-platform.** Behavioural models (prepayment, deposit run-off, PD and LGD,
   actuarial assumptions) and loan-level or policy-level engines stay with risk, ALM and actuarial. The planning model
   consumes their outputs under a data contract and assembles P&L, balance sheet, capital and liquidity.
3. **Grain.** Plan at the coarsest grain a decision-maker will own and review. A product x segment x entity grain is
   typical for balances and margins; cost centre x natural account for expense; position for headcount.
4. **Drivers, not plugs.** Owners change drivers (growth, rate, beta, attrition, coverage), not outputs. Overrides are
   explicit, owned and expire.
5. **Additive storage, ratio on read.** Store numerators and denominators; compute ratios dynamically.
6. **One assumption, one home.** An assumption (policy rate path, FX rate, inflation) is entered once and referenced
   everywhere, with an owner and an approval.
7. **Conventions first.** Sign, units, annual versus periodic rates, day-count basis and averaging rule are fixed in
   the conventions page before any formula is written.
8. **Integrity checks are part of the model**, not an afterthought: balance sheet balances, roll-forwards close,
   allocations zero-sum, ratios recompute.

## 2. Banking

### 2.1 Balance sheet roll-forward

```text
Closing balance = Opening + Originations - Scheduled repayments - Prepayments - Write-offs +/- FX +/- Transfers
Average balance (planning) = day-weighted if the source supplies it; else (Opening + Closing) / 2 with a documented caveat
```

| Component | Driver and source |
|---|---|
| Originations | Pipeline x conversion (bottom-up) or market growth x share (top-down); business owner |
| Scheduled repayments | Contractual amortisation profile by product; ALM or risk |
| Prepayments | Behavioural prepayment rate (for example a constant prepayment rate) by product and rate environment; ALM |
| Term loans and renewals | Maturity profile; renewal rate and retention at renewal (relevant for fixed-term mortgages) |
| Write-offs | Charge-off rate by stage; risk |
| Deposits | Growth by product and segment; migration between product types; pricing sensitivity; treasury and business |
| Wholesale funding | Balancing item subject to liquidity and funding limits; treasury |

**Circularity.** Funding plug -> interest expense -> net income -> equity -> funding plug. Break the loop by using
prior-period equity, by iterating to a stated tolerance in a rule with a convergence check, or by computing the
funding need on an opening-balance basis. State the choice.

### 2.2 Net interest income

```text
Interest (period) = Average balance x annual rate x days in period / day-count basis
Portfolio yield (roll)  Yield_t = (Balance_continuing x Yield_{t-1} + Balance_new_or_repriced x NewRate_t) / Balance_total
Floating rate           Rate_t  = Benchmark_t + Spread
Deposit rate            Rate_t  = Rate_{t-1} + Beta x (Benchmark_t - Benchmark_{t-1})   with lag L and a floor
NII = Interest income - Interest expense
```

Design points:

- Day-count basis (actual/365, actual/360, 30/360) differs by product; carry it as a driver.
- Betas differ by product, segment and direction (rising versus falling rates); the lag matters. Use the risk or
  ALM team's estimates and state the source.
- Mix migration (for example non-interest-bearing to term deposits) is a scenario driver that often moves NII more
  than the rate path does.
- Fixed-rate repricing needs the maturity or renewal profile; do not approximate with a single reprice rate unless the
  portfolio is short-dated.

### 2.3 Funds transfer pricing (FTP)

```text
Asset FTP charge    = ADB_asset x FTP_rate(behavioural tenor, currency, plus liquidity premium) x time
Liability FTP credit = ADB_liability x FTP_rate(behavioural tenor, currency, less liquidity credit) x time
Segment NII (net of FTP)  = customer interest income - FTP charge          (assets)
                          = FTP credit - customer interest expense          (liabilities)
Treasury NII = residual (mismatch, unallocated, hedging results)
Group NII = Sum of segment NII + Treasury NII      (FTP charges and credits net to zero across the group)
```

Controls `[D]`: FTP curve set versioned and approved by ALCO or equivalent; a check that FTP nets to zero at group
level; a policy for behavioural tenors; segment results reportable with and without FTP.

### 2.4 Non-interest revenue

| Line | Driver |
|---|---|
| Card interchange and fees | Purchase volume x interchange rate; annual fees x accounts |
| Payments and cash management | Transaction count x fee; balances x spread |
| Wealth and asset management | Average AUM x fee rate (see section 4) |
| Lending fees | Originations x fee rate; commitment fees on undrawn x rate |
| Trading and markets | Usually top-down by desk, with scenario sensitivities supplied by markets; do not model position-level here |
| Securities gains and other | Event-based, owned and approved individually |

### 2.5 Credit provisioning (IFRS 9 style)

```text
ECL (per scenario)  = PD x LGD x EAD (discounted at the effective interest rate); 12-month for stage 1, lifetime for stages 2 and 3
ECL (reported)      = Sum over scenarios of weight_s x ECL_s
PCL (P&L charge)    = Closing allowance - Opening allowance + Write-offs - Recoveries +/- other
Coverage ratio_stage = Allowance_stage / Gross balance_stage
```

Planning approaches, in order of preference `[D]`:

1. **Load** scenario-weighted ECL and stage balances from the risk engine for each planning scenario, with control
   totals; the planning model computes PCL from the allowance roll.
2. **Coverage-ratio method** when the engine cannot run for every cycle: stage balances from a migration matrix (supplied
   by risk) x coverage ratios by stage, with ratios stressed in downside scenarios.
3. Avoid computing PD and LGD in the planning tool.

US GAAP CECL uses lifetime expected losses for all in-scope assets; the allowance roll is similar but there is no
stage concept `[R]`. Provide stage (or vintage and risk-grade) dimensions only where the framework needs them.

### 2.6 Non-interest expense

```text
Personnel cost = Sum over positions (FTE x (base x (1 + merit from effective month) + variable accrual + benefits % + employer payroll taxes)) 
FTE_t = FTE_{t-1} + Hires_t - Attrition_t - Transfers_out_t + Transfers_in_t       (with hiring lag and vacancy factor)
Variable accrual = Target % x Base x Performance factor
Non-personnel = Contracted commitments (with indexation) + Run-rate x (1 + inflation) + Project spend
Capitalised software = Eligible project spend x capitalisation rate (per policy); amortisation starts when ready for use
Right-of-use depreciation and lease interest: from the lease sub-ledger, not recalculated here
```

Design points:

- Position-based planning: position ID, grade, cost centre, start and end dates, FTE percent, status. Compensation is
  restricted data; see the data architecture reference.
- Restructuring and one-off items have their own accounts and approval; excluded from run-rate analysis.
- Contractor and consultant rates are separate drivers from employees.
- Allocations are a separate step (see section 6.1).

### 2.7 Tax

Effective tax rate x pre-tax income, with permanent differences and jurisdiction mix supplied by tax; group minimum tax
top-up under Pillar Two needs tax team input and entity-level data `[R]`. Do not forecast deferred taxes from first
principles in the planning model.

### 2.8 Capital

```text
CET1 ratio       = CET1 capital / Total RWA
Total RWA        = Credit RWA + Market RWA + Operational RWA (+ other add-ons per the regime)
CET1 roll        = Opening CET1 + Net income attributable to common - Dividends - Buybacks +/- OCI in CET1 +/- Change in regulatory deductions +/- Other
Leverage ratio   = Tier 1 capital / Leverage exposure
Credit RWA (planning) = Exposure x average risk weight (density) by portfolio, from the regulatory reporting team
Return on RWA    = Net income / Average RWA
```

Capital allocation to segments (capital x allocation rate) supports ROE and risk-adjusted return by segment `[D]`.
The regulatory capital calculation is produced by regulatory reporting; the plan carries a documented approximation
with density assumptions and reconciles to the official ratio each close `[R]`.

### 2.9 Liquidity

```text
LCR  = Stock of high-quality liquid assets / Total net cash outflows over the next 30 days   (minimum 100 percent)
NSFR = Available stable funding / Required stable funding                                       (minimum 100 percent)
```

Planning consumes treasury's run-off rates, HQLA composition and funding profile and shows ratio headroom per
scenario `[R]`. Do not rebuild the full liquidity engine.

### 2.10 Banking KPI definitions

| KPI | Formula | Note |
|---|---|---|
| Net interest margin | NII (annualised) / Average interest-earning assets | Define "earning assets" once |
| Efficiency ratio | Non-interest expense / Total revenue | Revenue is net of interest expense; state treatment of insurance claims if relevant |
| Operating leverage | Revenue growth percent - Expense growth percent | Year on year |
| ROE | Net income attributable to common / Average common equity | Annualised |
| ROTCE | Net income attributable to common / Average tangible common equity | |
| PCL ratio | PCL (annualised) / Average net loans | In basis points |
| Net charge-off ratio | (Write-offs - Recoveries) / Average loans | |
| Cost of risk | PCL / Average gross loans | |
| Loan-to-deposit ratio | Loans / Deposits | |
| CET1, leverage, LCR, NSFR | See above | Regulatory definitions apply |

## 3. Insurance

### 3.1 Property and casualty

```text
Net written premium (NWP) = Gross written premium - Ceded premium
Net earned premium (NEP)  = NWP - Change in unearned premium reserve
Loss ratio     = Incurred claims (incl. catastrophe and prior-year development) / NEP
Expense ratio  = Underwriting expenses (acquisition and other) / NEP (state whether NEP or NWP is the denominator)
Combined ratio = Loss ratio + Expense ratio (+ policyholder dividends if applicable)
Reserve roll   = Opening reserve + Incurred - Paid +/- Development +/- FX = Closing reserve
Investment income = Average invested assets x portfolio yield
```

Catastrophe load as an explicit driver with a scenario (large event) overlay; reinsurance recoveries by treaty.

### 3.2 Life and long-term business (IFRS 17) `[R]`

```text
CSM roll (general model) = Opening CSM + New business + Interest accretion (locked-in rate)
                         + Changes in fulfilment cash flows relating to future service - Release to P&L (coverage units) +/- FX = Closing CSM
Insurance service result = Insurance revenue - Insurance service expenses
Insurance finance income or expense = Unwinding and rate effects on contract liabilities
```

The variable fee approach differs (CSM adjusts for the entity's share of underlying items). Actuarial systems produce
CSM, risk adjustment and fulfilment cash flows; the EPM receives them by group of contracts (portfolio, cohort,
profitability group), assembles the P&L and balance sheet, and reconciles to the actuarial reports. Capital
frameworks: LICAT for Canadian life, the minimum capital test for Canadian property and casualty, Solvency II SCR and
US risk-based capital `[R]`.

## 4. Asset and wealth management

```text
AUM roll        = Opening AUM + Gross sales - Redemptions +/- Market movement +/- FX +/- Acquisitions and disposals = Closing AUM
Net flows       = Gross sales - Redemptions
Management fee  = Average AUM x fee rate / periods per year        (fee rate net of rebates, by strategy and share class)
Blended fee rate = Fee revenue / Average AUM                        (dynamic calc, never summed)
Performance fee = Per fund terms (hurdle, high-water mark, crystallisation); recognised when not subject to significant reversal
Compensation ratio = Compensation expense / Net revenue
Operating margin = Operating income / Net revenue
```

Design points: average AUM from daily or month-end data per policy; market movement is a scenario driver (equity and
fixed-income return assumptions by asset class); distribution costs (trailer fees) follow AUM; advisor-level planning
for wealth uses advisor count, productivity (revenue per advisor) and attrition.

## 5. Payments and consumer lending

| Model | Core drivers and formulas |
|---|---|
| Payments | Total payment volume x take rate = gross revenue; less interchange and scheme fees = net revenue; transactions x processing cost; fraud and chargeback losses as a rate of volume |
| Consumer lending | Applications x approval rate x take-up = originations; vintage balance curves and loss curves by cohort; funding cost on warehouse and securitisation; gain on sale for sold portfolios |
| Buy-now-pay-later | Merchant discount rate, late fees, loss curves by cohort, funding cost |

Cohort (vintage) modelling stays in the data platform; plan on cohort aggregates by origination quarter and product.

## 6. Cross-cutting design

### 6.1 Allocations `[D]`

- Cost pools, drivers, targets and methods are rows in a governed rule table (see the rules reference, A5).
- Drivers: FTE, floor area, transaction volume, revenue, RWA or a usage metric; each with an owner and refresh.
- Two views: pre-allocation (direct cost by owner) and post-allocation (fully loaded by business). Report both.
- Management allocations differ from statutory transfer pricing; keep them separate and reconcile.
- Zero-sum check every run; traceability from recipient back to pool and driver.

### 6.2 Scenarios and stress `[D]`

| Layer | Design |
|---|---|
| Macro scenario table | Policy rate, long yield, unemployment, GDP, house prices, equity index, FX, commodity prices by period and scenario; owner economics or risk |
| Scenario set | Base, upside, downside, severe; regulatory scenarios (supervisory stress tests, ICAAP) as additional named scenarios |
| Sensitivities | Driver elasticities to macro variables (deposit beta, loss coverage, fee market sensitivity, AUM market beta) with owner and source |
| IFRS 9 weights | Scenario probability weights for ECL are set by risk; planning does not change them |
| Outputs | P&L, balance sheet, capital and liquidity ratios per scenario; headroom to limits and management buffers |

Regulatory exercises (for example US stress testing, OSFI and EBA stress tests) have prescribed scenarios and
templates; the EPM supplies data and run control, and the regulatory team owns the submission `[R]`.

### 6.3 Rolling forecast and plan cycle `[D]`

| Element | Standard |
|---|---|
| Horizon | 18 months rolling (or 12 plus 6); annual budget as a separate cycle |
| Actualisation | After close, copy actuals into the forecast, lock them, re-baseline the remaining periods |
| Cadence | Monthly for P&L and headcount; quarterly for capital and stress |
| Top-down and bottom-up | Targets set top-down by CFO; bottom-up submissions by owners; a gap-to-target view and a reconciliation step before approval |
| Workflow | Working, submitted, approved; reopen only under change control |
| Snapshots | Archive each approved version for prior-forecast variance |
| Timetable | Calendar set backward from the board date; integration SLAs aligned |

### 6.4 Variance analysis `[D]`

```text
Interest rate/volume:  Volume effect = (Bal_cur - Bal_prior) x Rate_prior
                       Rate effect   = (Rate_cur - Rate_prior) x Bal_prior
                       Mix/joint     = (Bal_cur - Bal_prior) x (Rate_cur - Rate_prior)    (show separately or add to rate; state which)
                       Sum = Interest_cur - Interest_prior

Price/volume/mix (revenue by product i, quantity Q, price P):
   Volume = (SumQ_cur - SumQ_prior) x Average price_prior (at prior mix)
   Mix    = Sum_i [ (Q_cur_i - SumQ_cur x share_prior_i) x P_prior_i ]
   Price  = Sum_i [ Q_cur_i x (P_cur_i - P_prior_i) ]
   Sum = Revenue_cur - Revenue_prior

Constant currency:     Result at prior-period (or budget) rates vs result at actual rates; difference = FX effect
Headcount:             Volume = (FTE_cur - FTE_prior) x Rate_prior; Rate = (Rate_cur - Rate_prior) x FTE_cur   (sum = cost_cur - cost_prior)
                       Use average FTE; analyse hiring timing as the gap between period-end and average FTE, shown beside, not inside, the sum
```

Always test that effects sum exactly to the total variance and show the check in the report.

### 6.5 Forecast accuracy `[D]`

```text
MAPE   = Mean of |Actual - Forecast| / |Actual|        (unstable when actuals are near zero)
WMAPE  = Sum |Actual - Forecast| / Sum |Actual|        (preferred for aggregates)
Bias   = Sum (Forecast - Actual) / Sum Actual          (positive means over-forecast)
Tracking signal = Cumulative error / Mean absolute deviation
Forecast value added = Accuracy of the human or driver forecast minus accuracy of a naive forecast (last actual or seasonal naive)
```

Measure by line, horizon (1, 3, 6, 12 months ahead) and owner. Publish quarterly; use it to retire low-value forecast
detail.

### 6.6 Statistical and machine-learning forecasts

Statistical or machine-learning forecasting (seasonality, trend, regression on macro variables) can supply baselines
for volumes, fee income and expense lines. Run it in an approved environment (OneStream's own ML solutions if licensed,
or an external platform), load results as a labelled baseline scenario, keep human overrides visible, and bring the
model under model risk management (see the governance reference).

## 7. Driver catalogue template

| Driver | Unit | Grain | Owner | Source | Refresh | Validation |
|---|---|---|---|---|---|---|
| Policy rate path | Percent, annual | Scenario x month | Economics | Approved macro set | Quarterly | Within published range; monotonic where defined |
| Deposit beta | Ratio | Product x segment x direction | ALM | ALM study | Semi-annual | Between 0 and 1 |
| Coverage ratio | Percent | Stage x portfolio x scenario | Risk | ECL engine | Quarterly | Stage 3 above stage 2 above stage 1 |
| FTE attrition | Percent, annual | Cost centre or grade | HR business partner | HRIS history | Cycle | Within historic range, explained exceptions |
| Fee rate | Basis points | Strategy x share class | Product control | Fee schedules | Monthly | Reconciles to billed fees |
| Day-count basis | Days | Product | Finance | Product terms | Static | One of the agreed conventions |
| Inflation | Percent | Cost category | Procurement and economics | Index plus contracts | Cycle | Linked to macro scenario |
