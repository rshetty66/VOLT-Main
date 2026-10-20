---
name: oracle-ofsaa-wiki
description: >
  Oracle Financial Services Analytical Applications (OFSAA) implementation wiki and LLM knowledge
  base. Activates when users ask about "OFSAA", "Oracle Financial Services",
  "OFSDF", "Financial Services Data Foundation", "Oracle GAML", "Oracle AML",
  "Oracle anti-money laundering", "Oracle ECL", "OFSAA IFRS 9",
  "Oracle Basel", "Oracle capital adequacy", "OFSAA regulatory reporting",
  "OFSAA profitability", "Oracle FTP", "funds transfer pricing OFSAA",
  "OFSAA ALM", "asset liability management Oracle", "Oracle liquidity risk",
  "OFSAA market risk", "Oracle credit risk", "OFSAA stress testing",
  "Oracle operational risk", "OFSAA data model", "Oracle financial crimes",
  "Oracle compliance", "OFSAA CTR", "OFSAA SAR", "OFSAA KYC",
  "OFSAA watchlist", "OFSAA transaction monitoring", "OFSAA case management",
  "Oracle Enterprise Case Management", "Oracle Financial Crime",
  "OFSAA IFRS 17", "OFSAA insurance", "OFSAA hedge management",
  "Oracle regulatory capital", "OFSAA RWA", "OFSAA credit risk analytics",
  "OFSAA expected loss", "OFSAA PD LGD EAD", "OFSAA staging",
  "OSFI regulatory reporting", "BCAR reporting", "DFAST", "CCAR",
  or any Oracle OFSAA implementation, configuration, or support question.
version: 1.0.0
disable-model-invocation: true
---

# Oracle OFSAA — Financial Services Analytical Applications Wiki

Comprehensive implementation reference for Oracle Financial Services Analytical Applications (OFSAA)
covering Risk, Finance, Compliance, and Financial Crime across banking, insurance, and capital markets.

---

## OFSAA Platform Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         ORACLE OFSAA PLATFORM                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                    ANALYTICAL APPLICATIONS                               │   │
│  │                                                                         │   │
│  │  RISK                    FINANCE                  COMPLIANCE            │   │
│  │  ┌──────────────┐       ┌──────────────┐        ┌──────────────┐      │   │
│  │  │ Credit Risk  │       │ IFRS 9 (ECL) │        │ GAML (AML)   │      │   │
│  │  │ Market Risk  │       │ IFRS 17      │        │ KYC/CDD      │      │   │
│  │  │ ALM/Liquidity│       │ FTP          │        │ CTR/SAR      │      │   │
│  │  │ Op Risk      │       │ Profitability│        │ Watchlist    │      │   │
│  │  │ Basel (RWA)  │       │ Hedge Mgmt   │        │ Case Mgmt   │      │   │
│  │  │ Stress Test  │       │ Regulatory   │        │ Fraud       │      │   │
│  │  └──────────────┘       └──────────────┘        └──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │              FINANCIAL SERVICES DATA FOUNDATION (OFSDF)                  │   │
│  │                                                                         │   │
│  │  • Unified Data Model (1400+ tables, 90+ subject areas)                │   │
│  │  • Staging Area (STG tables) → Results Area (FSI tables)               │   │
│  │  • Data Quality Framework (T2T, SCD, Reconciliation)                   │   │
│  │  • Dimensional Data (Products, Customers, Accounts, Instruments)       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │              INFRASTRUCTURE LAYER                                        │   │
│  │                                                                         │   │
│  │  • Oracle Database (19c/21c/23ai)  • WebLogic Application Server       │   │
│  │  • OFS AAI (Analytics Application Infrastructure)                       │   │
│  │  • OBIEE / OAS (Reporting)  • Batch Processing (ICC Framework)         │   │
│  │  • OFSAA Admin Console  • Security (LDAP/AD integration)               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Deep-Dives

### 1. OFSDF — Financial Services Data Foundation

The data backbone for all OFSAA applications.

| Component | Purpose | Key Tables |
|-----------|---------|-----------|
| **Staging Area** | Land raw data from source systems | STG_* tables (e.g., STG_LOAN_CONTRACTS, STG_CUSTOMER_MASTER) |
| **Results Area** | Processed/calculated data | FSI_* tables (e.g., FSI_EXPECTED_LOSS, FSI_CAPITAL_CALC) |
| **Dimension Tables** | Reference data | DIM_* tables (DIM_PRODUCT, DIM_CUSTOMER, DIM_ORG_UNIT) |
| **Instrument Tables** | Financial instrument details | FSI_D_LOAN_CONTRACTS, FSI_D_CASA_CONTRACTS, FSI_D_INVESTMENTS |
| **T2T (Table-to-Table)** | ETL within OFSAA (staging → results) | Configured in AAI; SQL-based transforms |
| **SCD (Slowly Changing Dimensions)** | Dimension history tracking | Type 1/2/3 SCD processing |
| **Data Quality** | Validation rules, reconciliation | DQ rules framework in AAI |

#### Data Flow Pattern

```
SOURCE SYSTEMS (Core Banking, Treasury, Cards, Loans)
    │
     (ETL: Informatica, ODI, custom)
OFSDF STAGING TABLES (STG_*)
    │
     (T2T processing within OFSAA)
OFSDF RESULTS / INSTRUMENT TABLES (FSI_*)
    │
     (Application processing)
ANALYTICAL APPLICATION RESULTS
    │
     (Reporting)
OBIEE / OAS DASHBOARDS + REGULATORY REPORTS
```

### 2. IFRS 9 — Expected Credit Loss (ECL)

Oracle's IFRS 9 application automates the 3-stage ECL calculation.

| Feature | Description |
|---------|-------------|
| **Classification & Measurement** | Automate SPPI test, business model assessment |
| **ECL Engine** | Calculate 12-month and lifetime ECL using PD/LGD/EAD models |
| **SICR Detection** | Configure quantitative and qualitative SICR triggers |
| **Stage Allocation** | Automated staging (1→2→3) with override capability |
| **Scenario Weighting** | Multiple macro-economic scenarios with probability weighting |
| **Forward-Looking Adjustment** | Incorporate macro forecasts (GDP, unemployment, HPI) |
| **Collective vs Individual** | Group assessment for homogeneous pools; individual for large exposures |
| **Disclosure Reporting** | IFRS 7 disclosures (stage migration, vintage analysis, sensitivity) |

#### ECL Calculation in OFSAA

```
INPUT DATA (from OFSDF):
  • Loan contracts (balance, origination date, maturity, currency)
  • Customer data (credit score, industry, geography)
  • Collateral (type, value, LTV)
  • Historical default data (for PD model calibration)
  • Macro-economic forecasts (GDP, unemployment, rates)

PROCESSING:
  1. Segment portfolio into homogeneous pools
  2. Assign PD term structure (from model or rating agency)
  3. Calculate LGD (considering collateral, cure rates, recovery timelines)
  4. Calculate EAD (including undrawn commitments × CCF)
  5. Detect SICR → assign stage (1, 2, or 3)
  6. Apply forward-looking scenarios with probability weights
  7. Calculate ECL = Σ(PD × LGD × EAD × DF) per stage/horizon
  8. Apply management overlay (if configured)

OUTPUT:
  • ECL amount per account / segment / stage
  • Stage allocation results
  • Provision journal entries (for posting to GL)
  • Regulatory disclosures (IFRS 7)
```

### 3. Basel Capital Adequacy (RWA)

| Approach | Description | Banks Using |
|----------|-------------|-------------|
| **Standardized Approach (SA)** | Prescribed risk weights by asset class | Smaller banks, credit unions |
| **Foundation IRB (F-IRB)** | Bank estimates PD; supervisor LGD/EAD | Mid-size banks |
| **Advanced IRB (A-IRB)** | Bank estimates PD, LGD, EAD | D-SIBs (Big 6 Canadian banks) |
| **SA-CCR** | Standardized approach for counterparty credit risk | Derivatives portfolios |
| **FRTB** | Fundamental Review of the Trading Book (market risk) | Trading book |

#### OFSAA Basel Processing

```
EXPOSURE DATA (from OFSDF)
  → NETTING & COLLATERAL (credit risk mitigation)
    → RISK WEIGHT ASSIGNMENT (SA) or MODEL OUTPUT (IRB: PD, LGD, EAD)
      → RWA CALCULATION per asset class
        → CAPITAL RATIO = Capital / RWA
          → REGULATORY REPORT (OSFI BCAR, Basel Pillar 3)
```

### 4. GAML — Global Anti-Money Laundering

Oracle's AML solution within OFSAA:

| Module | Function |
|--------|---------|
| **Transaction Monitoring** | Rule-based + behavior-based detection (800+ scenarios) |
| **Watch List Filtering** | Real-time + batch screening against global sanctions lists |
| **KYC** | Customer risk scoring, periodic review, EDD triggers |
| **Currency Transaction Reporting** | Automated CTR/LCTR aggregation and filing |
| **Suspicious Activity Reporting** | SAR/STR workflow with narrative generation |
| **Enterprise Case Management** | Investigation workflow, evidence, timeline, disposition |
| **Network Analysis** | Hidden relationship detection across customers/accounts |
| **Fraud Detection** | Real-time/near-real-time fraud scoring and alerting |

### 5. ALM / Liquidity Risk

| Feature | Description |
|---------|-------------|
| **Repricing Gap** | Interest rate sensitivity analysis by time bucket |
| **Duration/Convexity** | Modified duration, key rate duration, PV01 |
| **NII Simulation** | Net Interest Income forecasting under rate scenarios |
| **EVE (Economic Value of Equity)** | Present value of assets minus liabilities |
| **Liquidity Coverage Ratio (LCR)** | HQLA / Net cash outflows (30-day stress) |
| **Net Stable Funding Ratio (NSFR)** | Available stable funding / Required stable funding |
| **Cash Flow Modeling** | Contractual + behavioral cash flows (prepayment, drawdown) |
| **FTP (Funds Transfer Pricing)** | Matched-maturity internal pricing for profitability |

### 6. Profitability Management

| Capability | Description |
|------------|-------------|
| **FTP Assignment** | Assign funding cost/credit to each account based on characteristics |
| **Cost Allocation** | Multi-step allocation of shared costs to products/segments |
| **Risk-Adjusted Return** | RAROC, RORAC, EVA calculations by segment |
| **Product Profitability** | Full P&L by product (NII - PCL - Cost - Capital Charge) |
| **Customer Profitability** | Revenue, cost, risk contribution per customer relationship |
| **Segment Reporting** | IFRS 8 compliant management reporting by business line |

---

## Implementation Methodology

### Typical OFSAA Implementation Timeline

| Phase | Duration | Key Activities |
|-------|----------|----------------|
| **Discover** | 4-6 weeks | Requirements, data assessment, gap analysis |
| **Design** | 6-8 weeks | Data model mapping, configuration design, rule design |
| **Build** | 10-14 weeks | Configure OFSDF, load data, configure applications, custom rules |
| **Test** | 6-8 weeks | SIT (data flows), UAT (business validation), parallel run |
| **Deploy** | 3-4 weeks | Production setup, cutover, go-live, hypercare |

### Critical Success Factors

1. **Data is 70% of the effort** — Source data quality determines OFSAA output quality
2. **Start data mapping in Week 1** — Don't wait for application configuration
3. **Engage business SMEs early** — ECL models, staging criteria, risk weights need business sign-off
4. **Parallel run minimum 3 periods** — Validate OFSAA output vs legacy calculation
5. **Performance tuning** — OFSAA batch processes can be resource-intensive; tune SQL and partitions
6. **Security model** — Map OFSAA application roles to bank's information security model

---

## Integration Points

| Source/Target | Direction | Method |
|---------------|-----------|--------|
| Core Banking → OFSAA | Inbound | ETL (Informatica/ODI) → STG tables |
| Treasury System → OFSAA | Inbound | ETL → STG_INVESTMENTS, STG_TREASURY |
| Cards System → OFSAA | Inbound | ETL → STG_CARDS_CONTRACTS |
| Credit Risk Models → OFSAA | Inbound | PD/LGD/EAD model outputs → FSI tables |
| OFSAA → Oracle ERP GL | Outbound | Provision journal entries (API or file) |
| OFSAA → EPM (FCCS) | Outbound | Capital/provision data for consolidation |
| OFSAA → Regulatory | Outbound | OSFI BCAR / DFAST / CCAR reports |
| OFSAA → BI/Reporting | Outbound | OBIEE/OAS dashboards, Excel downloads |

---

## OFSAA for Canadian Banks (OSFI Context)

### Key Regulatory Reports Generated from OFSAA

| Report | Regulator | Frequency | OFSAA Module |
|--------|-----------|-----------|-------------|
| BCAR (Basel Capital Adequacy) | OSFI | Quarterly | Basel Capital |
| LCR/NSFR | OSFI | Monthly/Quarterly | Liquidity Risk |
| Leverage Ratio | OSFI | Quarterly | Basel Capital |
| ECL Provision (IFRS 9) | OSFI | Quarterly | IFRS 9 ECL |
| Large Exposure | OSFI | Quarterly | Credit Risk |
| Stress Testing (ICAAP) | OSFI | Annual | Stress Testing |
| AML/ATF Reporting | FINTRAC | As needed | GAML |

---

## Agentic AI Integration

### MCP Server Design for OFSAA

| Tool | Function | Agent Use Case |
|------|----------|---------------|
| `query_ecl_results` | Pull ECL calculations by portfolio/stage | Variance agent: explain provision movement |
| `get_stage_migration` | Stage 1→2→3 transition data | Variance agent: PCL driver analysis |
| `get_rwa_breakdown` | RWA by asset class and approach | Reconciliation agent: capital vs GL |
| `get_aml_alerts` | Open AML alerts and status | KYC agent: triage and investigation |
| `get_ftp_rates` | Current FTP curve by tenor | Variance agent: NII decomposition |
| `run_ecl_calculation` | Trigger ECL batch run | Journal agent: post-model provision entry |
| `get_regulatory_report` | Extract formatted regulatory return | Report generation |

---

## Oracle Documentation Sources

| Resource | Content |
|----------|---------|
| Oracle OFSAA Documentation Library | Full product docs per application |
| Oracle Financial Services Data Model Reference | OFSDF table/column reference |
| OFSAA Installation Guide | Server setup, database, WebLogic configuration |
| OFS AAI Admin Guide | Infrastructure, batch framework, security |
| OFS IFRS 9 User Guide | ECL configuration, staging rules, scenario setup |
| OFS Basel User Guide | RWA configuration, regulatory reporting |
| OFS AML/GAML User Guide | Transaction monitoring, case management |
