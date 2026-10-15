---
name: sap-fpsl
description: >-
  SAP Financial Products Subledger (FPSL) specialist — subledger accounting for financial
  services, IFRS 9/17 compliance, insurance contract accounting, banking loan portfolios,
  expected credit loss (ECL) calculations, and integration with SAP S/4HANA. Use when
  implementing FPSL for banks, insurers, or any financial services organization needing
  multi-GAAP subledger accounting with high-volume transaction processing.
disable-model-invocation: true
---

# SAP FPSL — Financial Products Subledger Skill

## Overview

SAP FPSL (Financial Products Subledger) is SAP's **industry-specific subledger** for financial services. It handles high-volume, multi-basis accounting for banks, insurers, and asset managers with full IFRS 9, IFRS 17, and local GAAP compliance.

## Core Capabilities

### Multi-Basis Accounting
- **Parallel Ledgers:** IFRS, US GAAP, Local GAAP, Tax, Management — all from single source
- **Accounting Principles:** Different measurement, recognition, and disclosure per basis
- **Reclassification:** Business model-driven classification (IFRS 9: amortized cost, FVOCI, FVTPL)
- **Reconciliation:** Cross-basis reconciliation and difference analysis

### Financial Instruments (IFRS 9)
- **Classification & Measurement:** SPPI test automation, business model assessment
- **Impairment (ECL):** 3-stage model (12-month, lifetime performing, lifetime credit-impaired)
- **Hedge Accounting:** Fair value, cash flow, net investment hedges with effectiveness testing
- **Derecognition:** Pass-through, continuing involvement, substantial modification tests
- **Day-1 P&L:** Fair value adjustments on initial recognition

### Insurance Contracts (IFRS 17)
- **Measurement Models:** General Model (BBA), Variable Fee Approach (VFA), Premium Allocation Approach (PAA)
- **CSM Calculation:** Contractual Service Margin amortization and unlocking
- **Risk Adjustment:** Confidence level, cost-of-capital, or other quantile-based approaches
- **Loss Components:** Onerous contract identification and loss component tracking
- **Cohort Grouping:** Annual cohorts, profitability groups, portfolio definitions

### Banking Portfolio Accounting
- **Loan Origination:** Initial recognition, effective interest rate, origination fees/costs
- **Amortization:** Effective interest method with recalculation triggers
- **Provision Calculation:** ECL staging, PD/LGD/EAD models, forward-looking scenarios
- **Write-off & Recovery:** Partial/full write-off, recovery accounting
- **Restructuring:** Modification gains/losses, substantial modification assessment

## Architecture

```
Source Systems              FPSL Engine                    Target
┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│ Core Banking  │────│ Data Ingestion       │     │ S/4HANA GL   │
│ Insurance     │     │ Rule Processing      │────│ Regulatory   │
│ Treasury      │     │ Multi-Basis Calc     │     │ Management   │
│ Risk          │     │ Journal Generation   │     │ Disclosure   │
└──────────────┘     └──────────────────────┘     └──────────────┘
```

### Integration with SAP Bank Analyzer
- FPSL receives calculated results from Bank Analyzer's analytical engine
- Bank Analyzer handles: deal capture, cash flow generation, valuation, risk analytics
- FPSL handles: accounting treatment, journal generation, multi-basis posting
- Together they form the complete banking subledger solution

## Implementation Patterns

### Phase 1: Foundation
1. FPSL technical installation and system configuration
2. Accounting principle setup (IFRS, local GAAP, management)
3. Chart of accounts mapping and derivation rules
4. Source system interface design

### Phase 2: Rule Configuration
1. Financial instrument classification rules
2. Measurement rules per accounting basis
3. ECL calculation configuration (stages, parameters, scenarios)
4. Journal generation rules and posting logic

### Phase 3: Migration & Parallel Run
1. Historical data migration (open positions, cumulative P&L)
2. Parallel run with legacy subledger
3. Reconciliation and difference analysis
4. Performance tuning for high-volume processing

### Phase 4: Regulatory Reporting
1. IFRS 7/9 disclosure generation
2. FINREP / COREP integration
3. Local regulatory reporting (OSFI, PRA, BaFin, etc.)
4. Management reporting and dashboards

## Quality Checklist
- [ ] All accounting principles configured and tested independently
- [ ] ECL staging logic validated against risk model outputs
- [ ] Effective interest rate calculations match legacy system within tolerance
- [ ] IFRS 17 CSM amortization validated for all measurement models
- [ ] High-volume processing meets SLA (batch window compliance)
- [ ] Cross-basis reconciliation reports balance
- [ ] Regulatory disclosure data complete and auditable
