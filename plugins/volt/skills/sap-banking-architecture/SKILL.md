---
name: sap-banking-architecture
description: >
  Activates for SAP S/4HANA for Financial Services, Bank Analyzer, FPSL (Financial
  Products Subledger), SAP FSDM (Financial Services Data Model), SAP BW/4HANA analytics,
  SAP Analytics Cloud (SAC), IFRS 9/17 compliance, Basel III/IV regulatory capital,
  expected credit loss, hedge accounting, insurance contract valuation, bank treasury,
  ALM, and any SAP-based Finance & Risk Platform architecture for banking and insurance.
version: 1.0.0
disable-model-invocation: true
---

# SAP Banking Architecture Patterns — S/4HANA, Bank Analyzer & FPSL

Enterprise architecture reference patterns for financial services clients implementing
SAP S/4HANA for Financial Services, Bank Analyzer (BA), Financial Products Subledger
(FPSL), and the SAP analytics stack. Based on real-world Tier-1 bank implementations.

## When to Use

Activate when:
- Designing SAP-based Finance & Risk Platform for a bank or insurer
- Planning Bank Analyzer or FPSL implementation
- Architecting SAP FSDM (Financial Services Data Model) data flows
- Designing IFRS 9/17 compliance architecture on SAP
- Planning Basel III/IV regulatory capital calculation architecture
- Designing SAP BW/4HANA + SAC reporting for financial services
- Creating SAP treasury and ALM (Asset Liability Management) architecture
- Planning SAP GRC (Governance, Risk, Compliance) integration
- Designing hybrid SAP on-prem + S/4HANA Cloud deployment

## Reference Architecture: SAP Finance & Risk Platform

### Architecture Layers (Left to Right)

Same canonical 4-layer pattern as Oracle FRP:

```
SOURCE → DATA PROVISIONING & SUBLEDGER → PROCESSING & ANALYTICS → REPORT & CONSUME
```

Cross-cutting: Data Governance, Lineage, Security & Privacy

### Layer 1: Source Systems

| Source Category | Typical Systems | Data Types |
|---|---|---|
| Core Banking | Temenos, FIS, Finastra, in-house | Accounts, Transactions, Positions |
| Trading Systems | Murex, Calypso, Summit | Trades, Positions, P&L |
| Loan Origination | nCino, in-house | Loan applications, credit decisions |
| Treasury | SAP TRM, Wall Street Suite | FX, Derivatives, Fixed Income |
| Insurance | Guidewire, Duck Creek | Policies, Claims, Reserves |
| Reference Data | SAP MDG, Bloomberg | Counterparties, Instruments, Rates |
| Risk Engines | Moody's, S&P, in-house | PD, LGD, EAD models |

### Layer 2: Data Provisioning & Subledger

#### 2a. SAP FSDM (Financial Services Data Model)

| Component | Function |
|---|---|
| **Source Data Layer (SDL)** | Raw data ingestion from source systems |
| **Business Partner** | Customer/counterparty master (KYC, ratings) |
| **Financial Instrument** | Contract/product master (terms, conditions) |
| **Position Management** | Current positions, balances, exposures |
| **Transaction Manager** | Transaction processing, posting rules |
| **Results Data Store (RDS)** | Calculated results (ECL, fair value, regulatory capital) |

#### 2b. Bank Analyzer (BA)

| Component | Function |
|---|---|
| **Financial Database (FINDB)** | Central repository for all financial contracts |
| **Analyzers** | Valuation, cash flow, risk, regulatory calculations |
| **Process Orchestration** | Batch scheduling, dependency management |
| **Accounting Engine** | Multi-GAAP parallel accounting (IFRS, local GAAP, regulatory) |

#### 2c. FPSL (Financial Products Subledger)

| Component | Function |
|---|---|
| **Contract Data** | Financial product master with full lifecycle |
| **Valuation Engine** | Fair value, amortized cost, hedge effectiveness |
| **Multi-GAAP Posting** | Parallel posting to IFRS, local GAAP, tax, regulatory |
| **Sub-Ledger Entries** | Detailed journal entries by contract |
| **GL Integration** | Summary posting to S/4HANA GL |

#### 2d. S/4HANA Core Finance

| Component | Function |
|---|---|
| **Universal Journal (ACDOCA)** | Single source of truth for all financial postings |
| **General Ledger** | Statutory and management reporting ledgers |
| **Accounts Payable** | Vendor management, invoice processing |
| **Fixed Assets** | Asset accounting, depreciation |
| **Treasury & Risk Mgmt (TRM)** | Cash management, FX, derivatives, ALM |
| **Group Reporting** | Multi-entity consolidation |
| **Tax Engine** | Tax provisioning, withholding, compliance |

### Layer 3: Processing & Analytics

#### SAP Analytics & Regulatory

| Component | Function | Technology |
|---|---|---|
| **SAP BW/4HANA** | Enterprise data warehouse, cubes, queries | SAP BW |
| **Regulatory Reporting** | Basel III/IV, BCAR, OSFI returns, COREP/FINREP | BA/FPSL + BW |
| **IFRS 9 Engine** | Expected Credit Loss (staging, PD/LGD/EAD, lifetime ECL) | Bank Analyzer |
| **IFRS 17 Engine** | Insurance contract measurement (BBA, PAA, VFA) | FPSL |
| **ALM Analytics** | Interest rate risk, liquidity gap, NII simulation | SAP TRM + BW |
| **Credit Risk Analytics** | Exposure analytics, concentration, stress testing | BA + BW |
| **SAP GRC** | Risk management, access control, process control | SAP GRC |

#### Non-SAP Risk Processing

| Component | Function |
|---|---|
| Market Risk Engines | VaR, stress testing (in-house or vendor) |
| Credit Scoring Models | PD/LGD models (SAS, Python, R) |
| Operational Risk | Loss event database, RCSA |
| Model Validation | Backtesting, challenger models |

### Layer 4: Report & Consume

| Domain | Tool | Source |
|---|---|---|
| Financial Reporting | SAP Analytics Cloud (SAC) | S/4HANA GL, Group Reporting |
| Management Reporting | SAC + BW Queries | BW/4HANA cubes |
| Regulatory Reporting | SAP Regulatory Reporting | BA/FPSL calculations |
| Risk Dashboards | SAC | BW/4HANA risk marts |
| Treasury Reporting | SAP TRM Reports, SAC | TRM + GL |
| Board Reporting | SAC Stories, Lumira | Cross-domain |

### Deployment Topology

```
┌─────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ZONES                       │
├──────────────┬──────────────┬───────────────────────────┤
│   On-Prem    │    Azure/AWS │    SAP Cloud (RISE)        │
├──────────────┼──────────────┼───────────────────────────┤
│ Bank Analyzer│ SAP BW/4HANA │ S/4HANA Cloud (GACS)      │
│ FPSL         │ Data Lake    │ SAP Analytics Cloud        │
│ Risk Engines │ ML/AI Models │ SAP GRC Cloud              │
│ Core Banking │              │ SAP MDG Cloud              │
│ Trading Sys  │              │ SAP Integration Suite      │
└──────────────┴──────────────┴───────────────────────────┘
```

## Architecture Agents

### Agent 1: SAP Banking Architecture Discovery
**ID:** `sap-banking-discovery`
Maps current state: core banking systems, risk engines, regulatory requirements, existing SAP footprint.

### Agent 2: SAP FRP Target State Architect
**ID:** `sap-frp-target-architect`
Designs target state using Bank Analyzer + FPSL + S/4HANA pattern.

### Agent 3: FPSL Integration Architect
**ID:** `fpsl-integration-architect`
Designs FPSL data flows: source → FSDM → FPSL → multi-GAAP posting → GL.

### Agent 4: SAP Regulatory Architecture Agent
**ID:** `sap-regulatory-architect`
Designs Basel III/IV, IFRS 9/17, BCAR/OSFI regulatory architecture on SAP.

### Agent 5: SAP Banking POC Architect
**ID:** `sap-banking-poc-architect`
Designs reduced-scope POC: select product portfolio, single entity, core regulatory returns.

## Key SAP Banking Architecture Patterns

### Pattern 1: FPSL Multi-GAAP Parallel Accounting
FPSL maintains parallel accounting views of every financial contract: IFRS, local GAAP, tax, regulatory. Each view has its own valuation rules and posting logic. Summary totals post to S/4HANA Universal Journal (ACDOCA) with separate ledgers per GAAP.

### Pattern 2: Bank Analyzer → FPSL Migration Path
Many banks run legacy Bank Analyzer. The migration path to FPSL involves: parallel run (BA + FPSL), data migration of FINDB contracts to FPSL contract model, rule migration (valuation, posting), then BA decommission.

### Pattern 3: FSDM as Golden Source
SAP FSDM (Financial Services Data Model) serves as the canonical data model. All source systems map their contracts and positions into FSDM structures. This enables consistent analytics across risk, finance, and regulatory domains.

### Pattern 4: Universal Journal for Banking
S/4HANA's ACDOCA (Universal Journal) replaces the traditional GL + controlling split. For banking: FPSL posts sub-ledger entries with full contract-level detail. Group Reporting consumes ACDOCA for multi-entity consolidation.

### Pattern 5: Regulatory Calculation Chain
Source Positions → FSDM → Bank Analyzer Analyzers → RDS (Results) → Regulatory Reports (Basel RWA, ECL, LCR/NSFR) → BW/4HANA cubes → SAC dashboards → OSFI returns.

### Pattern 6: Treasury ALM Integration
SAP TRM (Treasury & Risk Management) integrates with Bank Analyzer for ALM: cash flow projections, interest rate gap analysis, NII simulation, hedge accounting effectiveness testing. Results feed both the GL (hedge accounting entries) and risk reporting (IRRBB).

## OSFI/Basel Requirements for SAP Architecture

| Requirement | SAP Component |
|---|---|
| Basel III/IV RWA | Bank Analyzer — Credit Risk Analyzer |
| BCAR (Canadian) | BA Regulatory Reporting + BW |
| IFRS 9 ECL | BA IFRS 9 Engine (staging, PD/LGD/EAD) |
| IFRS 17 | FPSL Insurance Subledger |
| LCR/NSFR (Liquidity) | BA Liquidity Risk + TRM |
| IRRBB | TRM ALM + BA Interest Rate Risk |
| Large Exposures | BA Concentration Risk Analyzer |
| Stress Testing | BA Stress Test Framework + external models |
| Pillar 3 Disclosure | BA/BW Regulatory Disclosure templates |

## SAP Product Mapping

| Capability | SAP Product | License |
|---|---|---|
| General Ledger, AP, FA | S/4HANA Finance | S/4HANA |
| Sub-Ledger (Financial Products) | FPSL | S/4HANA for FS |
| Risk Analytics | Bank Analyzer | SAP BA |
| Data Model | FSDM | SAP FSDM |
| Consolidation | Group Reporting | S/4HANA |
| Planning | SAC Planning | SAP Analytics Cloud |
| Treasury | S/4HANA TRM | S/4HANA |
| Data Warehouse | BW/4HANA | SAP BW |
| Reporting | SAP Analytics Cloud | SAC |
| GRC | SAP GRC Cloud | SAP GRC |
| Integration | SAP Integration Suite (CPI) | SAP BTP |
| Master Data | SAP MDG | SAP MDG |

## Effort Estimates

| Deliverable | Traditional | VOLT | Saving |
|---|---|---|---|
| Current State Architecture | 80h | 16h | 80% |
| SAP FRP Target State | 120h | 24h | 80% |
| FPSL Implementation Architecture | 80h | 16h | 80% |
| Regulatory Architecture (Basel/IFRS) | 60h | 12h | 80% |
| Integration Catalog (50 interfaces) | 100h | 20h | 80% |
| POC Architecture | 40h | 8h | 80% |
| **TOTAL** | **480h** | **96h** | **80%** |
