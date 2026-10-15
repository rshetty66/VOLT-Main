---
name: sap-bank-analyzer-fpsl-wiki
description: >
  SAP Bank Analyzer and SAP Fioneer FPSL (Financial Products Subledger) implementation wiki.
  Activates when users ask about "SAP Bank Analyzer", "SAP Banking", "SAP BA",
  "SAP FPSL", "SAP Fioneer", "Financial Products Subledger",
  "FSDP", "Financial Services Data Platform", "SAP Banking Analytics",
  "AFI", "Analyzer for Insurance", "SAP sub-ledger",
  "SAP IFRS 9", "SAP ECL", "SAP expected credit loss",
  "SAP IFRS 17", "SAP insurance accounting", "SAP hedge management",
  "SAP Basel", "SAP regulatory capital", "SAP RWA",
  "SAP ALM", "SAP asset liability management", "SAP liquidity",
  "SAP profitability banking", "SAP FTP banking",
  "BCA", "Bank Customer Accounts", "SAP core banking",
  "SAP payment engine", "SAP loans management",
  "SAP credit risk banking", "SAP market risk banking",
  "SAP operational risk", "SAP stress testing",
  "SAP regulatory reporting banking", "SAP COREP", "SAP FINREP",
  "multi-GAAP subledger", "parallel accounting SAP",
  "accounting principle", "valuation rule", "posting rule SAP",
  or any SAP Bank Analyzer, SAP Fioneer FPSL implementation question.
version: 1.0.0
disable-model-invocation: true
---

# SAP Bank Analyzer & SAP Fioneer FPSL — Implementation Wiki

Comprehensive reference for SAP's financial services subledger and analytics platform covering
banking risk, finance, and regulatory compliance.

---

## Platform Overview

### Evolution Path

```
SAP Bank Analyzer (BA)  ───  SAP S/4HANA for Financial Products Subledger (FPSL)
   (Classic, on-prem)              (S/4HANA native, Fioneer partnership)
         │                                    │
         └── Still in use at many banks ──────┘── Converging into SAP Fioneer platform
```

| Platform | Status | Best For |
|----------|--------|----------|
| **SAP Bank Analyzer (Classic)** | Maintenance mode (supported through 2027+) | Existing customers not yet migrated |
| **SAP FPSL (S/4HANA)** | Active development | New implementations, S/4HANA landscape |
| **SAP Fioneer** | Spin-off (cloud-native) | Cloud-first banks, insurance IFRS 17 |
| **SAP Banking (BCA/Loans/Payments)** | Active | Core banking operations |

---

## SAP Bank Analyzer — Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SAP BANK ANALYZER                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SOURCE DATA LAYER (SDL)                       │   │
│  │  • Financial transactions from core banking               │   │
│  │  • Position/contract data (loans, deposits, securities)   │   │
│  │  • Market data (rates, prices, FX)                        │   │
│  │  • Customer/counterparty data                             │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────┴───────────────────────────────┐   │
│  │              ANALYTICS LAYER                               │   │
│  │                                                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │ Credit   │  │ Market   │  │   ALM/   │  │Profitab-│ │   │
│  │  │  Risk    │  │  Risk    │  │Liquidity │  │  ility  │ │   │
│  │  │(PD/LGD/ │  │(VaR,ES, │  │(Gap,NII, │  │(FTP,    │ │   │
│  │  │ EAD,ECL)│  │ Greeks)  │  │ EVE,LCR) │  │ RAROC)  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────┴───────────────────────────────┐   │
│  │              RESULTS DATA LAYER (RDL)                      │   │
│  │  • Calculated risk measures stored for reporting          │   │
│  │  • Regulatory capital results (RWA, capital ratios)       │   │
│  │  • Accounting results (provisions, fair values)           │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                             │                                    │
│  ┌──────────────────────────┴───────────────────────────────┐   │
│  │              ACCOUNTING LAYER                              │   │
│  │  • Multi-GAAP parallel accounting (IFRS, local GAAP)      │   │
│  │  • Subledger journal generation                           │   │
│  │  • GL integration (posting to SAP FI)                     │   │
│  │  • Regulatory reporting (COREP, FINREP, BCAR)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## SAP FPSL (Financial Products Subledger)

### Core Concept: Multi-GAAP Subledger

FPSL is a **subledger** that sits between operational systems and the General Ledger, applying
multiple accounting principles simultaneously to the same financial transactions.

```
OPERATIONAL SYSTEM (Core Banking, Treasury, Insurance Admin)
    │
    │ Transaction/position data

FPSL SUBLEDGER
    │
    ├── ACCOUNTING PRINCIPLE 1 (IFRS) ──── Journals ──── GL Ledger (IFRS)
    │
    ├── ACCOUNTING PRINCIPLE 2 (Local GAAP) ── Journals ── GL Ledger (Local)
    │
    ├── ACCOUNTING PRINCIPLE 3 (Tax) ──── Journals ──── GL Ledger (Tax)
    │
    └── ACCOUNTING PRINCIPLE 4 (Regulatory) ── Journals ── Regulatory Reporting
```

### Key FPSL Concepts

| Concept | Description |
|---------|-------------|
| **Financial Transaction** | Atomic event (disbursement, payment, rate reset, maturity) |
| **Position** | Cumulative state of a financial product (loan balance, investment holding) |
| **Accounting Principle** | Set of rules for one GAAP (IFRS, HGB, US GAAP, Tax, Regulatory) |
| **Valuation Rule** | How to measure (amortized cost, fair value, ECL calculation) |
| **Posting Rule** | Which accounts to debit/credit for each event type |
| **Derivation Rule** | Logic to determine correct treatment based on product/event attributes |
| **Close Operation** | Period-end processing (accruals, revaluation, impairment) |

### FPSL for IFRS 9

| Feature | FPSL Capability |
|---------|----------------|
| **Classification** | Configure SPPI and business model rules per product type |
| **Effective Interest Rate** | EIR calculation and amortization engine |
| **ECL (3-stage)** | Configure SICR triggers, PD/LGD/EAD inputs, staging allocation |
| **Impairment** | Automated provision calculation and journal generation |
| **Hedge Accounting** | Hedge designation, effectiveness testing, fair value adjustment |
| **Derecognition** | Assess whether transfer qualifies for derecognition |
| **Modification** | Handle contractual modifications (gain/loss calculation) |

### FPSL for IFRS 17 (Insurance)

| Feature | FPSL Capability |
|---------|----------------|
| **Measurement Model Selection** | Configure GMM, VFA, or PAA per portfolio/group |
| **CSM Calculation** | Contractual Service Margin computation and amortization |
| **Risk Adjustment** | Risk adjustment calculation (confidence level / cost-of-capital) |
| **Discount Rate** | Bottom-up and top-down approaches configurable |
| **Insurance Revenue** | Release from liability = expected claims + RA + CSM |
| **Onerous Contract** | Identify and measure loss-making groups |
| **Reinsurance Held** | Mirror accounting for ceded contracts |

---

## Configuration Deep-Dive

### Accounting Principle Setup

```
ACCOUNTING PRINCIPLE: "IFRS"
├── VALUATION AREA: "IFRS_EIR"
│   └── Valuation Rule: Amortized Cost (EIR method)
│       - Applies to: Loans at amortized cost
│       - Events: Disbursement, Payment, Interest Accrual, Maturity
│
├── VALUATION AREA: "IFRS_FV"
│   └── Valuation Rule: Fair Value through P&L
│       - Applies to: Trading securities, derivatives
│       - Events: Initial recognition, Revaluation, Settlement
│
├── VALUATION AREA: "IFRS_ECL"
│   └── Valuation Rule: Expected Credit Loss
│       - Applies to: All AC and FVOCI debt instruments
│       - Events: Initial recognition, SICR trigger, Stage migration, Write-off
│
└── VALUATION AREA: "IFRS_HEDGE"
    └── Valuation Rule: Hedge Accounting
        - Applies to: Designated hedging relationships
        - Events: Designation, Effectiveness test, De-designation
```

### Posting Rules Example (Loan at Amortized Cost)

| Event | Debit Account | Credit Account | Accounting Principle |
|-------|---------------|----------------|---------------------|
| Disbursement | Loan Receivable | Cash/Nostro | IFRS + Local GAAP |
| Interest Accrual | Accrued Interest Receivable | Interest Income | IFRS (EIR) |
| Interest Accrual | Accrued Interest Receivable | Interest Income | Local (nominal rate) |
| Payment Received | Cash | Loan Receivable + Accrued Interest | Both |
| ECL Provision (increase) | Provision Expense (P&L) | Allowance (contra-asset) | IFRS only |
| Write-off | Allowance | Loan Receivable | IFRS + Local |
| EIR Fee Amortization | Deferred Fees | Interest Income | IFRS only |

---

## SAP Fioneer Cloud Platform

### Modules

| Module | Description | Key Use Case |
|--------|-------------|-------------|
| **FPSL Cloud** | Multi-GAAP subledger (cloud-native) | Banks migrating from on-prem FPSL |
| **Insurance Accounting** | IFRS 17 + multi-GAAP for insurers | IFRS 17 implementations |
| **Credit Lifecycle Management** | End-to-end credit process | Loan origination to servicing |
| **ESG & Climate Risk** | Climate scenario analysis, ESG scoring | Regulatory climate stress testing |
| **Engagement Banking** | Digital banking platform | Customer-facing banking services |

### FPSL Cloud vs On-Premise

| Aspect | On-Premise (S/4HANA FPSL) | Cloud (SAP Fioneer) |
|--------|--------------------------|---------------------|
| Deployment | Customer-managed S/4HANA | SaaS (Fioneer-managed) |
| Updates | Customer-controlled | Continuous delivery |
| Customization | ABAP extensions possible | Configuration-only (APIs for extension) |
| Integration | RFC, IDocs, BAPI | REST API, Events |
| Scaling | Manual (hardware) | Elastic (cloud-native) |
| Data Residency | Customer data center | Cloud regions (AWS/Azure/GCP) |

---

## Integration with SAP ERP

### Data Flow

```
SAP CORE BANKING (BCA/Loans/Deposits)
    │
    │ Financial transactions + position data

SAP FPSL (Subledger)
    │
    │ Multi-GAAP journal entries

SAP S/4HANA FI (General Ledger)
    │
    │ Consolidated financials

SAP GROUP REPORTING / SAP BPC (Consolidation + Planning)
    │
    │ Regulatory returns

REGULATORY AUTHORITIES (OSFI, APRA, BaFin, PRA, Fed)
```

---

## Implementation Considerations

### Typical FPSL Implementation

| Phase | Duration | Activities |
|-------|----------|-----------|
| Blueprint | 8-12 weeks | Requirements, accounting principle design, product mapping |
| Realization | 16-24 weeks | Configuration, derivation rules, posting rules, close operations |
| Testing | 8-12 weeks | Parallel accounting validation, regulatory report reconciliation |
| Go-Live | 4-6 weeks | Data migration, cutover, hypercare |

### Critical Decisions

1. **How many accounting principles?** (2-4 typical: IFRS + Local + Tax + Regulatory)
2. **Position management granularity?** (contract-level vs aggregated)
3. **ECL model integration approach?** (embedded in FPSL vs external model feeding results)
4. **Close operation scheduling?** (nightly vs on-demand vs event-driven)
5. **GL integration pattern?** (real-time posting vs periodic summarization)

---

## Agentic AI Integration

### MCP Server Design for SAP FPSL

| Tool | Function | Agent Use Case |
|------|----------|---------------|
| `get_subledger_balances` | Pull position balances by accounting principle | Reconciliation agent: FPSL vs GL |
| `get_ecl_results` | ECL provision amounts by stage/product | Variance agent: provision movement |
| `trigger_close_operation` | Execute period-end close processing | Journal agent: initiate close |
| `get_posting_journal` | Retrieve generated journal entries | Journal agent: validate before GL post |
| `get_hedge_effectiveness` | Hedge test results and ineffectiveness | Variance agent: P&L hedge impact |
| `compare_accounting_principles` | Delta between IFRS and local GAAP | Reconciliation agent: multi-GAAP rec |

---

## Cross-References

- **Oracle OFSAA** — Competing platform (analytics-first vs subledger-first approach)
- **Oracle EPM (FCCS)** — Consolidation layer consuming FPSL/OFSAA outputs
- **Accounting Policy Engine** — Policy decisions that drive FPSL configuration
- **SAP Banking Architecture** — `sap-banking-architecture` skill has the broader SAP FS reference architecture
