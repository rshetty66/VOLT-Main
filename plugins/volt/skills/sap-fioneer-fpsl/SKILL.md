---
name: sap-fioneer-fpsl
description: >
  This skill should be used when the user asks about "SAP Fioneer",
  "FPSL", "Financial Product Sub Ledger", "SAP Bank Analyzer",
  "AFI", "Accounting for Financial Instruments", "Fioneer",
  "sub-ledger accounting", "IFRS 9 engine", "expected credit loss engine",
  "SAP banking", "financial product subledger", "SAP FPSL data model",
  "bank analyzer migration", "analytical banking", "SAP insurance analyzer",
  "hedge accounting engine", "regulatory reporting SAP", "SAP treasury risk",
  "FPSL implementation", "Fioneer roadmap", or needs expertise on SAP Fioneer
  platform capabilities, data model, implementation patterns, or migration
  from legacy SAP Bank Analyzer.
version: 1.0.0
disable-model-invocation: true
---

# SAP Fioneer Financial Product Sub Ledger (FPSL) — Expert Knowledge

Deep domain expertise on SAP Fioneer's Financial Product Sub Ledger platform, including architecture, data model, implementation patterns, regulatory compliance capabilities, and migration from SAP Bank Analyzer.

---

## 1. Platform Overview

### 1.1 What is SAP Fioneer FPSL?

SAP Fioneer FPSL is an enterprise sub-ledger platform purpose-built for financial institutions:

- **Single source of truth** for all financial product accounting across Finance, Risk, and Treasury
- **Multi-GAAP parallel accounting** (IFRS, Local GAAP, Management, Regulatory)
- **Real-time valuation and accounting event generation** for complex financial instruments
- **Native IFRS 9/17 compliance** with integrated ECL calculation and insurance contract measurement
- **Regulatory reporting foundation** meeting BCBS 239 requirements for data aggregation

### 1.2 Heritage and Evolution

```
SAP Bank Analyzer (2005) → SAP Banking Services (2012) → SAP Fioneer (2021 spin-off)

Current Platform:
├── FPSL (core sub-ledger — Accounting for Financial Instruments)
├── Insurance Analyzer (IFRS 17)
├── Treasury & Risk Management (TRM)
├── Regulatory Reporting
├── Credit Lifecycle Management
├── Results Data Layer (golden source analytics)
└── Profitability Analysis (FTP, segment P&L)
```

### 1.3 Core Modules

| Module | Function | Key Capability |
|--------|----------|---------------|
| **AFI** | Sub-ledger accounting for all financial products | Multi-GAAP valuation, amortized cost, fair value, EIR |
| **ECL Engine** | IFRS 9 impairment calculation | PD/LGD/EAD, staging (1/2/3), forward-looking scenarios |
| **Insurance Analyzer** | IFRS 17 measurement | BBA, VFA, PAA, CSM amortization, risk adjustment |
| **TRM** | Treasury front-to-back | Deal capture, position management, hedge accounting, liquidity |
| **Regulatory Reporting** | Automated regulatory returns | OSFI BCAR, Basel III/IV, LCR, NSFR, Leverage Ratio |
| **Results Data Layer** | Golden source analytical store | Pre-calculated results for all consumption |
| **Profitability Analysis** | Multi-dimensional profitability | FTP, cost allocation, segment P&L |

---

## 2. Architecture

### 2.1 Processing Sequence

1. **Ingestion:** Financial product data from core banking/treasury → FPSL Financial Product master
2. **Position Management:** Contracts create positions with balances, schedules, characteristics
3. **Market Data Application:** Interest rates, FX rates, credit spreads applied
4. **Valuation:** Amortized cost (EIR), fair value, ECL, hedge effectiveness calculated
5. **Accounting Event Generation:** Valuation results trigger accounting events per GAAP rules
6. **GL Posting:** Events posted to S/4HANA GL (multiple ledgers simultaneously)
7. **Results Storage:** All results stored in Results Data Layer
8. **Consumption:** Finance, Risk, Treasury, Regulatory consume from Results Data Layer

### 2.2 Multi-GAAP Ledger Structure

| Ledger | Standard | Valuation Basis | Use |
|--------|----------|----------------|-----|
| Leading (0L) | IFRS | Amortized cost / FVTPL / FVOCI | Primary statutory |
| Extension (2L) | Local GAAP | Local rules (e.g., Canadian ASPE) | Entity statutory |
| Extension (3L) | Management | Transfer pricing, allocated costs | Internal P&L |
| Extension (4L) | Regulatory | Basel III/IV rules | OSFI capital reporting |

---

## 3. FPSL Data Model (Core Entities)

| Entity | Description | Key Attributes |
|--------|-------------|---------------|
| **Financial Product** | Master product type definition | Product type, category, valuation method, accounting treatment |
| **Contract** | Instance of a product (specific loan/deposit) | Contract ID, product ref, business partner, origination, maturity |
| **Position** | Accounting view of contract at point-in-time | Position type, balance, currency, valuation class, IFRS 9 stage |
| **Business Partner** | Counterparty/customer | BP ID, rating, PD, sector, geography |
| **Valuation Result** | Valuation engine output | Amortized cost, fair value, EIR accrual, ECL, revaluation |
| **Accounting Event** | Triggered journal entry | Event type, debit/credit, GL account, amount, dates |
| **Cash Flow** | Contractual/expected flows | Flow type, amount, date, probability |
| **Collateral** | Security against exposure | Type, value, LTV, haircut |

### 3.1 IFRS 9 Objects

| Object | Purpose |
|--------|---------|
| **ECL Scenario** | Forward-looking macro scenario with probability weight |
| **Stage Assignment** | IFRS 9 stage (1/2/3) with trigger reason |
| **PD Term Structure** | Point-in-time PD by maturity tenor |
| **LGD Estimate** | Loss given default by collateral/product |
| **ECL Result** | 12-month or lifetime ECL by stage |

---

## 4. Implementation Patterns

### 4.1 Phased Approach (Recommended for Mid-Size FIs)

```
Phase 1 (6-9 mo): Foundation
├── FPSL core + Financial Product master
├── Loan portfolio (largest volume)
├── Basic GL integration (leading ledger)
└── Parallel run with legacy

Phase 2 (6-9 mo): Expansion
├── Treasury products (FX, MM, bonds)
├── ECL engine (IFRS 9)
├── Multi-GAAP (regulatory ledger)
└── Regulatory reporting (BCAR pilot)

Phase 3 (6-9 mo): Optimization
├── Derivatives + hedge accounting
├── Full regulatory suite
├── Profitability analysis (FTP)
├── Results Data Layer analytics
└── Legacy decommissioning
```

### 4.2 Migration from Bank Analyzer

| Aspect | Approach |
|--------|---------|
| Data | Extract positions → Transform to FPSL contract/position → Load with history |
| Config | BA product types → FPSL financial product master (requires rationalization) |
| Custom code | ABAP customizations assessed — many replaced by standard FPSL config |
| Parallel run | Minimum 3 months daily reconciliation |
| Cutover | Big-bang per product portfolio (not all at once) |

### 4.3 Integration Points

| Integration | Direction | Protocol | Frequency |
|------------|-----------|----------|-----------|
| Core Banking → FPSL | Inbound | SAP CPI / API | Real-time or daily batch |
| Market Data → FPSL | Inbound | File / API | Intraday (rates), daily (curves) |
| FPSL → S/4HANA GL | Outbound | Internal | Real-time or period-end |
| FPSL → Regulatory | Outbound | Results Data Layer | On-demand |
| FPSL → Risk Analytics | Outbound | Results Data Layer / API | Daily |
| FPSL → Treasury Dashboard | Outbound | Analytics Cloud | Real-time |

---

## 5. Regulatory Compliance

### 5.1 IFRS 9 Coverage

| Requirement | FPSL Capability |
|-------------|----------------|
| Classification (AC/FVTPL/FVOCI) | Automated via business model + SPPI test |
| ECL Impairment | Integrated engine: PD/LGD/EAD, staging, forward-looking |
| Hedge Accounting | Designation, effectiveness testing, P&L attribution |
| Derecognition | Automated triggers, substantial modification testing |
| Day-1 P&L | FV vs transaction price differential |

### 5.2 BCBS 239 Support

| Principle | FPSL Enablement |
|-----------|----------------|
| Accuracy | Single calculation engine — no manual reconciliation |
| Completeness | All products captured in unified sub-ledger |
| Timeliness | Intraday valuation, same-day reporting |
| Adaptability | Configurable scenario engine for ad-hoc stress |
| Reconciliation | Built-in Finance<->Risk recon at position level |

### 5.3 OSFI/Canadian Regulatory

| OSFI Guideline | FPSL Response |
|---------------|--------------|
| B-20 (Mortgages) | Scenario engine applies stress PDs, recalculates ECL |
| E-23 (Model Risk) | Model inventory integration, validation tracking, audit trail |
| BCAR (Capital) | RWA inputs from validated positions → regulatory returns |
| LCR/NSFR | Cash flow engine: contractual + behavioural flows |

---

## 6. Competitive Positioning

| Capability | SAP Fioneer FPSL | Oracle OFSAA | OneSumX | Moody's |
|-----------|-----------------|-------------|---------|---------|
| Sub-ledger accounting | Core | Bolt-on | No | No |
| ECL calculation | Integrated | Integrated | Integrated | Standalone |
| Multi-GAAP | Native (4+) | Config needed | Limited | No |
| Hedge accounting | Full | Limited | No | No |
| Regulatory reporting | Comprehensive | Comprehensive | Core strength | Limited |
| GL integration | Native (S/4) | Interface | Interface | Interface |
| Treasury front-office | Full TRM | No | No | No |
| Best for | Unified Finance-Risk-Treasury | Risk-focused | Regulatory-first | Risk analytics |

---

## 7. Known Adopters

| Institution | Region | Scope | Status |
|------------|--------|-------|--------|
| Deutsche Bank | Germany | Full FPSL | Production |
| Commerzbank | Germany | FPSL + Regulatory | Production |
| ING | Netherlands | BA → FPSL migration | In progress |
| Rabobank | Netherlands | FPSL (lending) | Production |
| ANZ | Australia | Bank Analyzer | Production |
| Standard Chartered | UK/Asia | BA → FPSL | In progress |

### Implementation Timelines

| Scope | Duration |
|-------|----------|
| Single portfolio (loans) | 9-12 months |
| Multi-product (loans + treasury) | 18-24 months |
| Full scope (all + regulatory) | 24-36 months |
| BA → FPSL migration | 12-18 months |

---

## 8. Critical Success Factors

1. **Data quality first** — Invest in cleansing before migration (FPSL amplifies data issues)
2. **Product rationalization** — Consolidate product definitions before FPSL load
3. **Finance-Risk alignment** — Unified sub-ledger requires agreed valuation methodology
4. **Parallel run discipline** — 3+ months daily reconciliation minimum
5. **Regulatory engagement** — Inform OSFI/ASFI of methodology changes before go-live
6. **Change management** — Spreadsheet→automated sub-ledger is a fundamental role change
7. **Integration prototype** — Core banking interface is highest-risk; prototype early