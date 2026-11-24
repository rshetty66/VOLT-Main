# Accounting policy companion: banking, insurance, pensions (US GAAP and IFRS)

Appended to this skill from VOLT's `accounting-policy-banking-insurance` skill (v1.0.0, copied unchanged below this note).
Use it for the accounting POLICY layer around the four standards: how a financial-services entity states and applies its
policies, the journal-entry patterns, variance and reconciliation rules, and the US GAAP counterparts (CECL / ASC 326,
ASC 815, ASC 820, ASC 715). The IFRS technical references in this folder remain the authority for IFRS 9, 16, 17 and 18
mechanics; where the two differ on an IFRS point, follow the IFRS reference and mark the difference.
Policy text drafted from this file is a proposal: policy choices and elections must be made and approved by the entity.

---

# Financial Services Accounting Policy Engine
## Banking | Insurance | Credit Unions | Asset Management | Pensions

Deep US GAAP and IFRS accounting policy expertise for the full spectrum of Financial Services.
Provides authoritative guidance on accounting treatments, journal entry patterns, variance
decomposition, reconciliation rules, and agentic AI automation capabilities for autonomous
finance workflows connecting to ERP/EPM applications via MCP protocols.

---

## Industry Coverage (5 Sub-Sectors)

### Banking (Schedule I/II/III Banks, BHCs, Fintechs)

| Domain | IFRS | US GAAP | Key Standard |
|--------|------|---------|-------------|
| Loan Impairment | IFRS 9 ECL (3-stage) | ASC 326 CECL | Forward-looking, probability-weighted |
| Revenue (NII) | IAS 18 / IFRS 15 (EIR method) | ASC 310 / ASC 606 | Effective interest rate amortization |
| Financial Instruments | IFRS 9 (AC/FVOCI/FVTPL) | ASC 320/321/815/825 | Classification drives measurement |
| Derivatives & Hedging | IFRS 9 Chapter 6 | ASC 815 | Hedge effectiveness, documentation |
| Securitization | IFRS 10 / IFRS 9 (derecognition) | ASC 860 / ASC 810 (VIE) | On/off balance sheet determination |
| Regulatory Capital | Basel III/IV (OSFI BCAR, DSB) | Federal Reserve (BHC Act) | CET1, Tier 1, Total Capital ratios |
| Lease (Branches) | IFRS 16 | ASC 842 | ROU assets for branch network |

### Insurance (P&C, Life, Health, Reinsurance)

| Domain | IFRS | US GAAP | Key Standard |
|--------|------|---------|-------------|
| Insurance Contracts | IFRS 17 (GMM/VFA/PAA) | ASC 944 / LDTI | CSM amortization, risk adjustment |
| Investment Portfolio | IFRS 9 (assets backing liabilities) | ASC 320/321 | ALM-driven classification |
| Claims Reserves | IFRS 17 (liability for incurred claims) | ASC 944-40 (loss reserves) | IBNR, case reserves, development |
| Reinsurance | IFRS 17 (reinsurance held) | ASC 944-20 | Ceded premiums, recoverable assets |
| DAC (Acquisition Costs) | IFRS 17 (part of fulfillment CF) | ASC 944-30 | Amortization aligned with coverage |
| Regulatory Capital | Solvency II / LICAT / MCT | NAIC risk-based capital | Capital adequacy by risk category |

### Credit Unions (Cooperatives, Caisses Populaires)

| Domain | IFRS | US GAAP / ASPE | Key Standard |
|--------|------|---------------|-------------|
| Member Loans | IFRS 9 ECL (simplified for retail) | ASC 326 CECL | Collective assessment, PD/LGD models |
| Member Equity | IAS 32 (puttable instruments) | ASC 505 (equity classification) | Member shares: liability vs equity |
| NII & Fee Income | IFRS 15 / EIR method | ASC 310 / ASC 606 | Service charges, interchange |
| Liquidity Reserve | OSFI (federal) / DICO/CUDIC (provincial) | NCUA (US) | Statutory liquidity ratios |
| Capital Adequacy | Leverage ratio + risk-based | Net worth ratio (NCUA) | Retained earnings build strategy |
| Patronage Dividends | IAS 32/37 | ASC 505 | Distribution of surplus to members |

### Asset Management (Mutual Funds, ETFs, Hedge Funds, PE/VC)

| Domain | IFRS | US GAAP | Key Standard |
|--------|------|---------|-------------|
| Fund NAV Calculation | IFRS 13 (fair value) | ASC 820 (fair value) | Level 1/2/3 hierarchy, daily NAV |
| Management Fee Revenue | IFRS 15 (over time) | ASC 606 (over time) | AUM-based fee recognition |
| Performance Fee / Carried Interest | IFRS 15 (variable consideration) | ASC 606 + ASC 323 (equity method) | Constraint, clawback, waterfall |
| Fund Consolidation | IFRS 10 (control assessment) | ASC 810 (VIE analysis for GP) | GP as agent vs principal |
| Financial Instruments (Portfolio) | IFRS 9 (mostly FVTPL for funds) | ASC 321/ASC 820 | Mark-to-market, Level 3 valuation |
| Distribution / Dividends | IFRS 7/IAS 7 | ASC 946 (investment companies) | Income vs return of capital |
| Regulatory | OSC/CSA (Canada), SEC (US) | NI 81-102/106, 40 Act | AUM caps, leverage, liquidity |

### Pension Funds (DB, DC, Public Sector Pensions)

| Domain | IFRS | US GAAP | Key Standard |
|--------|------|---------|-------------|
| Defined Benefit Obligation | IAS 19 (projected unit credit) | ASC 715 (PBO, ABO) | Discount rate, mortality, salary growth |
| Plan Assets | IAS 19 (fair value) | ASC 715 (fair value) | Expected return, remeasurement |
| Actuarial Gains/Losses | IAS 19 (OCI, no recycling) | ASC 715 (OCI, amortization option) | Corridor vs immediate recognition |
| Net Interest | IAS 19 (single discount rate × net) | ASC 715 (expected return on assets) | Key P&L difference IFRS vs GAAP |
| Multi-Employer Plans | IAS 19 (contribution-based if data unavailable) | ASC 715-80 | MEPP withdrawal liability |
| Regulatory (Canada) | OSFI PBSA (federal) / FSRA (Ontario) | ERISA (US) / IRS minimum funding | Solvency, going-concern funding |
| Investment Accounting | IFRS 9 / IFRS 13 (fair value hierarchy) | ASC 820 | Real estate, infrastructure, PE at FV |

---

## Reference Files

- [IFRS 9 ECL — Banking](references/ifrs9-ecl-banking.md) — 3-stage model, PD/LGD/EAD, overlays, disclosures
- [IFRS 17 — Insurance Contracts](references/ifrs17-insurance.md) — GMM, VFA, PAA measurement models
- [Banking Journal Entry Patterns](references/banking-journal-patterns.md) — Standard month-end entries for a bank
- [Variance Decomposition — Banking](references/variance-drivers-banking.md) — P&L variance drivers (NIM, fee, NIE, PCL)
- [Reconciliation Rules — Banking](references/reconciliation-rules-banking.md) — GL-to-subledger matching rules

---

## IFRS 9 — Financial Instruments (Banking Focus)

### Classification & Measurement

| Category | Criteria | Measurement | P&L Impact |
|----------|----------|-------------|------------|
| **Amortized Cost (AC)** | Hold-to-collect + SPPI pass | Amortized cost (EIR method) | Interest income via EIR; impairment in P&L |
| **FVOCI (Debt)** | Hold-to-collect-and-sell + SPPI pass | Fair value on BS; EIR in P&L | Interest via EIR; FV changes in OCI; impairment in P&L |
| **FVTPL** | All others (or FVO designated) | Fair value | All changes in P&L |
| **FVOCI (Equity)** | Irrevocable election at recognition | Fair value on BS | Dividends in P&L; FV changes in OCI (no recycling) |

### SPPI Test (Solely Payments of Principal and Interest)

```
QUESTION 1: Is the contractual cash flow solely principal + interest?
  YES → Potentially AC or FVOCI
  NO  → Must be FVTPL

WHAT FAILS SPPI:
- Equity conversion features
- Inverse floaters
- Leverage features (2× LIBOR)
- Non-recourse (looks to asset performance, not borrower creditworthiness)

WHAT PASSES SPPI (with analysis):
- Prepayment options (if reasonable compensation)
- Interest rate resets (if just time-value update)
- Contractual modifications (if not significant)
```

### Business Model Assessment

| Model | Objective | Frequency of Sales | Typical Portfolio |
|-------|-----------|-------------------|-------------------|
| **Hold to Collect** | Collect contractual cash flows | Insignificant/infrequent | Mortgages, term loans |
| **Hold to Collect & Sell** | Both collect cash flows and sell | More than infrequent | Treasury bond portfolio, liquidity management |
| **Other (Trading)** | Fair value management, active trading | Frequent | Trading book, market-making |

---

## IFRS 9 — Expected Credit Loss (ECL) Model

### Three-Stage Model

```
STAGE 1: Performing (No SICR)           STAGE 2: Underperforming (SICR)        STAGE 3: Credit-Impaired
┌─────────────────────────┐             ┌─────────────────────────┐             ┌─────────────────────────┐
│ 12-month ECL            │  ──SICR──  │ Lifetime ECL            │  ──Default── │ Lifetime ECL            │
│ Interest on gross amount│             │ Interest on gross amount│             │ Interest on NET amount  │
│ (full carrying value)   │             │ (full carrying value)   │             │ (after allowance)       │
└─────────────────────────┘             └─────────────────────────┘             └─────────────────────────┘
         ──────────── Cure/Recovery ──────────────────── Cure ──────────────────┘
```

### SICR (Significant Increase in Credit Risk) Triggers

| Quantitative | Qualitative |
|-------------|-------------|
| PD increase > threshold (e.g., 2× or +100bps) | Watchlist placement |
| Credit score decline > X notches | Covenant breach |
| Days past due 30+ (rebuttable presumption) | Significant adverse change in borrower industry |
| Behavioral score below threshold | Regulatory intervention on borrower |
| | Restructuring / forbearance granted |

### ECL Calculation Formula

```
ECL = Σ (PD × LGD × EAD × Discount Factor) for each time period

Where:
  PD  = Probability of Default (point-in-time, forward-looking)
  LGD = Loss Given Default (1 - recovery rate, discounted)
  EAD = Exposure at Default (drawn + undrawn CCF)
  DF  = Discount factor at original effective interest rate

Stage 1: Sum over 12-month horizon
Stage 2/3: Sum over remaining lifetime of exposure
```

### Forward-Looking Information & Overlays

| Component | Description | Regulatory Expectation |
|-----------|-------------|----------------------|
| **Base Case** | Most likely economic scenario | Reflects current consensus forecasts |
| **Upside** | Better-than-expected scenario | Plausible positive deviation |
| **Downside** | Worse-than-expected scenario | Severe but plausible stress |
| **Probability Weighting** | Assign probability to each scenario | Must sum to 100%; document rationale |
| **Management Overlay** | Expert judgment adjustment | Must be temporary, documented, governed |

### ECL Journal Entries (Monthly Close)

```
PROVISION INCREASE (credit deterioration):
  DR  Provision for Credit Losses (P&L)     $X
    CR  Allowance for Credit Losses (BS)       $X

PROVISION DECREASE (credit improvement / cure):
  DR  Allowance for Credit Losses (BS)      $X
    CR  Provision for Credit Losses (P&L)      $X

WRITE-OFF (confirmed loss):
  DR  Allowance for Credit Losses (BS)      $X
    CR  Loans — Gross Carrying Amount (BS)     $X

RECOVERY (after write-off):
  DR  Cash / Loans (BS)                     $X
    CR  Provision for Credit Losses (P&L)      $X
```

---

## Banking P&L Structure & Variance Drivers

### Standard Bank P&L

```
NET INTEREST INCOME (NII)
  = Interest Income (loans, securities, deposits at central bank)
  - Interest Expense (deposits, borrowings, subordinated debt)

+ NON-INTEREST INCOME
  = Fee & Commission Income (advisory, cards, FX, trade finance)
  - Fee & Commission Expense (interchange, correspondent)
  + Trading Income (securities, FX, derivatives)
  + Insurance Income (if bancassurance)
  + Other Income (gains on disposal, dividends)

= TOTAL REVENUE (Operating Income)

- NON-INTEREST EXPENSE (NIE)
  = Personnel Expense (salaries, benefits, bonus, pension)
  + Occupancy (rent, depreciation, maintenance)
  + Technology (systems, amortization, cloud)
  + Professional Fees (audit, legal, consulting)
  + Other Operating Expense

= PRE-PROVISION OPERATING PROFIT (PPOP)

- PROVISION FOR CREDIT LOSSES (PCL)
  = Stage 1 ECL movement
  + Stage 2 ECL movement
  + Stage 3 ECL movement
  - Recoveries

= PRE-TAX PROFIT

- Income Tax Expense

= NET INCOME
```

### NII Variance Decomposition (Volume × Rate × Mix)

| Driver | Formula | Example |
|--------|---------|---------|
| **Volume effect** | (Avg Balance_actual - Avg Balance_budget) × Rate_budget | Loan growth drove +$5M NII |
| **Rate effect** | (Rate_actual - Rate_budget) × Avg Balance_budget | Margin compression drove -$3M NII |
| **Mix effect** | Residual (interaction of volume and rate) | Shift to lower-yielding mortgages -$1M |

### Fee Income Variance Decomposition

| Driver | Decomposition | Typical Variance Causes |
|--------|--------------|-------------------------|
| **Card fees** | Transaction volume × Average fee per transaction | Seasonality, new cards issued |
| **Advisory/Wealth** | AUM × Fee rate (bps) | Market movements, net flows |
| **FX revenue** | FX volume × Average spread | Corporate activity, travel |
| **Lending fees** | New originations × Fee % | Pipeline timing, competition |

### NIE Variance Decomposition

| Category | Primary Drivers | Budget Variance Causes |
|----------|----------------|----------------------|
| **Personnel** | Headcount × Avg comp × Benefits rate | Timing of hires, merit increases, attrition |
| **Occupancy** | Sqft × Rate + Utilities | Lease renewals, consolidation |
| **Technology** | Project spend + Run cost + Amortization | Project delays, cloud migration timing |
| **Professional fees** | Engagement count × Average fee | Regulatory projects, M&A advisory |

---

## Insurance-Specific Accounting

### IFRS 17 Measurement Models

| Model | Scope | Key Feature |
|-------|-------|-------------|
| **GMM (General Measurement Model)** | Default for all insurance contracts | CSM amortized over coverage period |
| **VFA (Variable Fee Approach)** | Direct participating contracts (unit-linked, with-profits) | CSM absorbs financial risk changes |
| **PAA (Premium Allocation Approach)** | Short-duration contracts (≤12 months or eligible) | Simplified — similar to current unearned premium |

### Insurance P&L Structure (IFRS 17)

```
INSURANCE REVENUE
  = Expected claims & expenses released from liability
  + Risk adjustment released
  + CSM amortization (profit recognition)
  - Experience adjustments (onerous contracts)

INSURANCE SERVICE EXPENSE
  = Incurred claims & expenses
  + Changes in onerous contract liability
  + Amortization of acquisition cash flows

= INSURANCE SERVICE RESULT

+ INVESTMENT INCOME (earned on assets backing liabilities)
- INSURANCE FINANCE INCOME/EXPENSE (unwinding discount on liabilities)

= NET FINANCE RESULT

= PROFIT BEFORE TAX
```

### Key Insurance Ratios

| Ratio | Formula | Benchmark (P&C) |
|-------|---------|-----------------|
| **Loss Ratio** | Incurred Claims / Earned Premium | 60-65% |
| **Expense Ratio** | Operating Expenses / Written Premium | 28-33% |
| **Combined Ratio** | Loss Ratio + Expense Ratio | <100% = underwriting profit |
| **Investment Yield** | Net Investment Income / Avg Invested Assets | 3-4% |

---

## Regulatory Capital — Banking

### Basel III/IV Capital Framework (OSFI BCAR for Canadian Banks)

| Capital Component | Definition | Minimum Ratio |
|-------------------|-----------|---------------|
| **CET1 (Common Equity Tier 1)** | Common shares + retained earnings - regulatory adjustments | 4.5% (OSFI: 7.0% + DSB 3.5% = 10.5%) |
| **Tier 1** | CET1 + Additional Tier 1 (AT1 instruments) | 6.0% (OSFI: 8.5% + DSB) |
| **Total Capital** | Tier 1 + Tier 2 (subordinated debt) | 8.0% (OSFI: 10.5% + DSB) |
| **Leverage Ratio** | Tier 1 / Total Exposure (non-risk-based) | 3.0% (OSFI: 3.5%) |

### RWA (Risk-Weighted Assets) Calculation

```
TOTAL RWA = Credit RWA + Market RWA + Operational RWA

CREDIT RWA (Standardized):
  = Σ (Exposure × Risk Weight)

  Risk Weights (selected):
    Sovereign (AAA-AA): 0%
    Banks (A rated): 20-50%
    Residential Mortgage (insured): 0% / (uninsured): 20-50%
    Corporate (rated): 20-150%
    Retail: 75%
    Past Due (>90 days): 100-150%

CREDIT RWA (IRB Advanced):
  = Σ (EAD × K × 12.5)
  Where K = f(PD, LGD, Maturity, Correlation)
```

---

## Hedge Accounting (Banking)

### Common Banking Hedges

| Hedge Type | Risk Hedged | Instrument | IFRS 9 Designation |
|-----------|-------------|-----------|-------------------|
| **Fair Value Hedge** | Interest rate risk on fixed-rate bond portfolio | IRS (pay fixed, receive float) | FV Hedge of portfolio |
| **Cash Flow Hedge** | Variable rate risk on floating loan portfolio | IRS (pay float, receive fixed) | CF Hedge |
| **Net Investment Hedge** | FX risk on foreign operations | FX forward or cross-currency swap | NI Hedge |
| **Macro Hedge (Portfolio)** | Overall interest rate gap (ALM) | IRS portfolio | Designated per IFRS 9 / IAS 39 carve-out |

### Hedge Accounting Journal Entries

```
FAIR VALUE HEDGE (quarterly revaluation):
  Hedged Item (bond portfolio):
    DR/CR  Bond Investment (BS)              $X
      CR/DR  Fair Value Hedge Gain/Loss (P&L)  $X

  Hedging Instrument (IRS):
    DR/CR  Derivative Asset/Liability (BS)   $Y
      CR/DR  Fair Value Hedge Gain/Loss (P&L)  $Y

  Ineffectiveness = $X - $Y recognized in P&L

CASH FLOW HEDGE:
  Hedging Instrument (IRS):
    DR/CR  Derivative Asset/Liability (BS)   $Z
      CR/DR  Cash Flow Hedge Reserve (OCI)     $Z (effective portion)
      CR/DR  Hedge Ineffectiveness (P&L)       $W (ineffective portion)

  Reclassification (when hedged cash flow affects P&L):
    DR/CR  Cash Flow Hedge Reserve (OCI)     $A
      CR/DR  Interest Income/Expense (P&L)     $A
```

---

## Reconciliation Rules — Banking

### Key GL-to-Subledger Reconciliation Points

| Account | GL Source | Subledger/Source System | Matching Rule |
|---------|-----------|------------------------|---------------|
| Loans — Gross | GL Account 1200 | Loan Management System | Total outstanding by product |
| Allowance (ECL) | GL Account 1201 | Credit Risk System (ECL model) | Stage 1+2+3 total |
| Customer Deposits | GL Account 2100 | Core Banking (DDA/Savings) | Balance by product type |
| Derivative Assets | GL Account 1500 | Trading/Treasury System | Mark-to-market by counterparty |
| Nostro Accounts | GL Account 1110 | Correspondent bank statements | Daily reconciliation |
| Vostro Accounts | GL Account 2110 | Internal records vs counterparty | Mirror of nostro at partner |
| Suspense / Clearing | GL Account 9999 | Should be zero at month-end | Aging analysis; clear within SLA |
| Intercompany | GL Accounts 15xx/25xx | IC balances at counterpart entity | Must net to zero on consolidation |

---

## Agentic AI Integration Points

### How These Policies Connect to the Autonomous Agents

| Agent | Policy Input Required | Decision Point |
|-------|----------------------|----------------|
| **Variance Analysis** | NII/Fee/NIE/PCL decomposition framework above | Determines WHAT drivers to decompose and HOW |
| **Reconciliation** | GL-to-subledger matching rules above | Determines WHICH accounts to reconcile and tolerance thresholds |
| **Journal Entry** | All journal patterns above + GAAP validation rules | Determines whether a proposed JE is policy-compliant |

### MCP Tool Mapping (ERP + EPM + OFSAA)

| Policy Domain | Oracle ERP MCP Tool | Oracle EPM MCP Tool | OFSAA / Specialized |
|---------------|--------------------|--------------------|---------------------|
| ECL Provision | `run_sql_query` (loan balances) | `run_business_rule` (ECL calc) | OFSAA IFRS 9 engine |
| NII Accrual | `run_sql_query` (GL interest accounts) | `export_data` (budget vs actual) | — |
| Reconciliation | `run_sql_query` (GL vs sub-ledger) | `get_reconciliation_status` | — |
| Journal Posting | `upload_fbdi` (journal CSV) | `load_data` (EPM adjustment) | — |
| Variance Report | `run_sql_query` (actuals) | `export_data` (budget + actual) | — |
| AML/KYC | `run_sql_query` (transaction data) | — | OFSAA FCCM (anti-money laundering) |
| Basel RWA | `run_sql_query` (exposure data) | — | OFSAA Basel / SAP Bank Analyzer |
| IFRS 17 (Insurance) | — | `run_business_rule` (CSM calc) | SAP Fioneer FPSL |
| Pension Obligation | `run_sql_query` (plan assets) | `export_data` (actuarial data) | — |
| Fund NAV | `run_sql_query` (portfolio positions) | — | — |

---

## Agentic AI Strategy — Enterprise Application Transformation

### The Agentic Shift in Financial Services

The financial services industry is at the forefront of the **agentic enterprise transformation** where
traditional applications (ERP, EPM, core banking) are being supplanted by autonomous AI agents that
interface directly with enterprise data and processes.

**Current State (2024-2025):** AI assistants and copilots embedded in Oracle, SAP, Workday — over 50%
of enterprise applications now embed some form of AI assistant. Oracle has deployed 50+ role-based
AI agents across Fusion Cloud Applications.

**Near-Term (2025-2027):** Agent-driven capabilities become dominant. Users interact with conversational
copilots that dispatch tasks to specialized domain agents (finance, risk, compliance). The three
VOLT autonomous agents (Variance Analysis, Reconciliation, Journal Entry) represent this paradigm.

**Mid-Term (2028-2030):** Full functional areas replaced by agent fleets. Instead of an "ARCS
application for reconciliation" — a Reconciliation Agent continuously monitors, matches, and
resolves exceptions autonomously with human-in-the-loop for policy decisions only.

**Long-Term (2030+):** Applications as we know them disappear. Logic is emergent from AI reasoning
over knowledge stores and data fabrics. The relational database becomes a back-end utility feeding
knowledge layers that agents reason over.

### Multi-Agent Architecture for Finance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    VOLT AGENT OPERATING SYSTEM                           │
│                                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │
│  │  VARIANCE     │  │ RECONCILIATION│  │  JOURNAL      │              │
│  │  ANALYSIS     │  │    AGENT      │  │  ENTRY        │              │
│  │  AGENT        │  │               │  │  AGENT        │              │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘              │
│          │                  │                   │                       │
│  ┌───────┴──────────────────┴───────────────────┴───────────────────┐ │
│  │              BLACKBOARD (SHARED KNOWLEDGE STATE)                   │ │
│  │  • GL balances  • Budget data  • Policy rules  • Exception log   │ │
│  │  • Reconciliation status  • Journal queue  • Audit trail         │ │
│  └──────────────────────────────┬────────────────────────────────────┘ │
│                                 │                                       │
│  ┌──────────────────────────────┴────────────────────────────────────┐ │
│  │              MCP PROTOCOL LAYER (TOOL INVOCATION)                  │ │
│  │                                                                    │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │ │
│  │  │Oracle ERP│  │Oracle EPM│  │  OFSAA   │  │SAP Bank Analyzer │ │ │
│  │  │  Cloud   │  │  Cloud   │  │(FCCM/ECL)│  │ / Fioneer FPSL   │ │ │
│  │  │ 11 tools │  │ 10 tools │  │  8 tools │  │    10 tools      │ │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Deployment Model for Client Pilots

| Component | Technology | Deployment |
|-----------|-----------|-----------|
| Agent Runtime | Claude API + VOLT orchestration | Docker container (client VPC) |
| MCP Servers | FastMCP (Python) | Sidecar containers per ERP/EPM connection |
| Knowledge Store | Vector DB + structured knowledge (this skill) | Embedded in container |
| Shared State (Blackboard) | Redis / JSON state file | In-memory per workflow run |
| Human-in-the-Loop | Streamlit approval UI | Web interface for approvals |
| Audit Trail | Structured JSON log | Persistent storage (compliance) |
| Monitoring | Agent OS dashboard | Real-time workflow status |

### Outcome-as-a-Service Model

Instead of selling software licenses or implementation hours, these agents deliver measurable outcomes:

| Pilot Use Case | Outcome Metric | Target |
|----------------|---------------|--------|
| Variance Analysis | Time from close → commentary delivered | <4 hours (from 3-5 days) |
| Reconciliation | Auto-match rate | >85% (from ~50% manual) |
| Reconciliation | Exception resolution time | <24 hours (from 5-7 days) |
| Journal Entry | Policy-compliant first-time-right rate | >95% (from ~70% manual) |
| Journal Entry | Posting cycle time | <1 hour (from 2-3 days) |
| Combined | Finance close elapsed days | -3 days (from 8 to 5) |
