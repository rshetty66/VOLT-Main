---
name: sap-bank-analyzer
description: >-
  SAP Bank Analyzer specialist — analytical banking engine for loan portfolios,
  treasury instruments, deposits, securities, cash flow generation, valuation,
  risk analytics, and integration with FPSL for subledger accounting. Use when
  implementing SAP's banking analytical platform, designing IFRS 9 solutions,
  or advising on bank finance transformation with SAP.
disable-model-invocation: true
---

# SAP Bank Analyzer — Implementation & Advisory Skill

## Overview

SAP Bank Analyzer is the **analytical engine** for banking financial instruments. It handles deal capture, cash flow generation, valuation, and risk analytics — feeding results to FPSL for accounting treatment. Together, Bank Analyzer + FPSL form SAP's complete banking subledger.

## Core Modules

### Source Data Layer (SDL)
- **Financial Instrument Capture:** Loans, deposits, securities, derivatives, guarantees
- **Deal Attributes:** Notional, rate, tenor, payment schedule, collateral, covenants
- **Counterparty Data:** Customer master, credit ratings, PD/LGD parameters
- **Market Data:** Yield curves, FX rates, credit spreads, volatility surfaces

### Calculation Engine
- **Cash Flow Generation:** Contractual, expected, and behavioral cash flows
- **Effective Interest Rate:** IRR calculation with fees, costs, premium/discount amortization
- **Valuation:** Fair value (mark-to-model, mark-to-market), amortized cost, net present value
- **ECL Calculation:**
  - **Stage 1:** 12-month ECL for performing exposures
  - **Stage 2:** Lifetime ECL for significant credit deterioration
  - **Stage 3:** Lifetime ECL for credit-impaired
  - **Parameters:** PD term structures, LGD models, EAD profiles, forward-looking macroeconomic scenarios

### Risk Analytics
- **Credit Risk:** PD/LGD/EAD modeling, concentration analysis, stress testing
- **Market Risk:** Interest rate sensitivity, FX exposure, basis risk
- **Liquidity Risk:** Cash flow gap analysis, LCR/NSFR calculations
- **Counterparty Risk:** CVA/DVA adjustments, wrong-way risk

### Results Processing
- **Accounting Results → FPSL:** Multi-basis accounting entries
- **Risk Results → Regulatory:** COREP, FINREP, Basel III/IV capital
- **Management Results → Analytics:** Portfolio performance, profitability, ALM

## Banking Products

| Product | Key Calculations | IFRS Treatment |
|---------|-----------------|----------------|
| Term Loans | EIR, ECL stages, collateral haircuts | Amortized cost (AC) or FVOCI |
| Revolving Credit | Undrawn commitment ECL, utilization | AC with commitment fees |
| Mortgages | Prepayment modeling, LTV-driven LGD | AC with behavioral cash flows |
| Deposits | Transfer pricing, liquidity premium | AC (liability) |
| Bonds/Securities | Fair value hierarchy (L1/L2/L3) | AC, FVOCI, or FVTPL |
| Derivatives | CVA/DVA, hedge effectiveness | FVTPL (or hedge accounting) |
| Guarantees | Off-balance sheet ECL | Contingent liability |

## Integration Architecture

```
Core Banking System          Bank Analyzer              FPSL / GL
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Deal Capture     │───│ SDL (Source Data) │    │ Accounting Rules │
│ Payment Events   │    │ Cash Flows       │───│ Multi-Basis      │
│ Customer Data    │    │ Valuation        │    │ Journal Gen      │
│ Collateral       │    │ ECL/Risk         │    │ GL Posting       │
└──────────────────┘    └──────────────────┘    └──────────────────┘
                               │
                        ┌────────────┐
                        │ Regulatory  │
                        │ COREP/FINREP│
                        │ Basel III/IV│
                        │ OSFI/PRA    │
                        └─────────────┘
```

## Implementation Patterns

### Phase 1: Foundation
1. SDL configuration (financial instrument types, attributes)
2. Yield curve and market data setup
3. Basic cash flow generation for core products
4. EIR calculation validation

### Phase 2: IFRS 9 / ECL
1. ECL staging criteria configuration
2. PD/LGD/EAD parameter integration from risk models
3. Forward-looking scenario setup (base, upside, downside)
4. ECL calculation validation against independent model

### Phase 3: Valuation & Risk
1. Fair value hierarchy configuration
2. Hedge accounting setup and effectiveness testing
3. Stress testing scenarios
4. Regulatory capital calculations

### Phase 4: Integration & Production
1. FPSL integration (accounting results → journal entries)
2. Regulatory reporting integration (COREP, FINREP)
3. Performance optimization for nightly batch
4. Production cutover with parallel run

## Quality Checklist
- [ ] All financial instrument types captured in SDL
- [ ] Cash flow generation validated against deal terms
- [ ] EIR calculations match independent spreadsheet models
- [ ] ECL staging criteria produce expected results per IFRS 9
- [ ] PD/LGD/EAD parameters flow correctly from risk systems
- [ ] Forward-looking scenarios properly weighted in ECL
- [ ] Fair value hierarchy correctly applied (L1 market data priority)
- [ ] Bank Analyzer → FPSL integration produces balanced journals
- [ ] Regulatory reports reconcile to GL and risk systems
