---
name: industry-financial-services
description: >
  This skill activates when the user discusses banking, insurance, asset
  management, capital markets, wealth management, retail banking, commercial
  banking, investment banking, credit unions, FinTech, regulatory reporting,
  IFRS 9, IFRS 17, Basel IV, CECL, Solvency II, DORA, SR 11-7, OSFI, or
  finance transformation in financial services organizations.
version: 1.0.0
---

# Financial Services Industry Expert

Deep expertise in finance transformation for banking, insurance, asset management, and capital markets. Covers regulatory requirements, industry-specific KPIs, operating models, and technology considerations unique to financial services.

---

## 1. Financial Services Sub-Sectors

### Retail Banking
**Key Characteristics:**
- High transaction volumes
- Branch networks
- Digital transformation
- Customer experience focus
- Regulatory compliance

**Finance Function Focus:**
- Product profitability (checking, savings, lending)
- Branch profitability
- Customer lifetime value
- Cost per transaction
- Digital adoption metrics

**Key Regulations:**
- Basel III/IV (capital adequacy)
- CCAR/DFAST (stress testing)
- GDPR (data privacy)
- AML/KYC (anti-money laundering)

### Commercial Banking
**Key Characteristics:**
- Relationship-based
- Complex lending
- Treasury services
- International trade
- Industry specialization

**Finance Function Focus:**
- Relationship profitability
- Loan loss provisioning
- Treasury revenue
- Trade finance margins
- Risk-adjusted returns

### Investment Banking
**Key Characteristics:**
- Deal-driven revenue
- High compensation
- Regulatory scrutiny
- Global operations
- Complex accounting

**Finance Function Focus:**
- Deal profitability
- Compensation accruals
- Revenue recognition (complex)
- Cost allocation
- Legal entity reporting

### Insurance (P&C and Life)
**Key Characteristics:**
- Premium-based revenue
- Claims management
- Actuarial complexity
- Long-duration contracts
- Investment income

**Finance Function Focus:**
- IFRS 17 implementation
- Claims reserving
- Premium recognition
- Investment accounting
- Solvency reporting

**Key Regulations:**
- IFRS 17 (insurance contracts)
- Solvency II (EU)
- LDTI (US)
- OSFI guidelines (Canada)

### Asset Management
**Key Characteristics:**
- AUM-driven revenue
- Performance fees
- Distribution complexity
- Global funds
- Complex fee structures

**Finance Function Focus:**
- Management fee calculations
- Performance fee accruals
- Fund accounting
- Distribution cost analysis
- Benchmark tracking

### Wealth Management
**Key Characteristics:**
- High-net-worth clients
- Advisory fees
- Complex products
- Regulatory oversight
- Advisor compensation

**Finance Function Focus:**
- Advisor profitability
- Product margins
- Client segmentation
- Fee analysis
- Platform economics

---

## 2. Financial Services Finance Operating Model

### Typical Structure

```
Corporate Finance
├── CFO Office
│   ├── Investor Relations
│   ├── Strategy & Planning
│   └── Corporate Development
├── Financial Control
│   ├── GAAP/Statutory Reporting
│   ├── Regulatory Reporting
│   └── Accounting Policy
├── Management Accounting
│   ├── Business Unit Finance
│   ├── Product Finance
│   └── Pricing
├── Treasury
│   ├── Liquidity Management
│   ├── Capital Management
│   └── Funding
├── Tax
│   ├── Direct Tax
│   ├── Indirect Tax
│   └── Transfer Pricing
└── Finance Operations
    ├── Procure-to-Pay
    ├── Record-to-Report
    └── Financial Planning
```

### Finance Cost Benchmarks (Financial Services)

| Metric | Top Quartile | Median | Bottom Quartile |
|--------|--------------|--------|-----------------|
| **Finance cost % revenue** | 0.7% | 1.2% | 2.0% |
| **FTEs per $1B revenue** | 45 | 80 | 140 |
| **Cost per transaction** | $2.50 | $5.00 | $10.00 |
| **Days to close** | 4 | 6 | 10 |

---

## 3. Regulatory Reporting Requirements

### IFRS 9 - Financial Instruments

**Key Requirements:**
- Expected credit loss (ECL) modeling
- Classification and measurement
- Impairment calculations
- Stage allocation (1, 2, 3)

**Finance Impact:**
- Complex provisioning models
- Data requirements (vintage, PD, LGD)
- Forward-looking scenarios
- Significant increase in credit risk (SICR)

**Implementation Considerations:**
- ECL engine selection
- Data architecture
- Model governance
- Audit trail

### IFRS 17 - Insurance Contracts

**Key Requirements:**
- Building Block Approach (BBA)
- Variable Fee Approach (VFA)
- Premium Allocation Approach (PAA)
- Risk Adjustment
- Contractual Service Margin (CSM)

**Finance Impact:**
- New subledger requirements
- Actuarial-finance integration
- CSM tracking and amortization
- OCI vs P&L distinctions

**Implementation Considerations:**
- Subledger design
- Actuarial system integration
- Data requirements
- Parallel running

### Basel IV (Finalized Basel III)

**Key Requirements:**
- Output floor (72.5%)
- Revised credit risk approaches
- Operational risk standardized approach
- Leverage ratio

**Finance Impact:**
- RWA calculations
- Capital planning
- Cost of capital analysis
- Product pricing

### OSFI Guidelines (Canada)

**Key Guidelines:**
- **B-10**: Third-party risk management
- **B-13**: Technology and cyber risk
- **E-15**: Appointed actuary
- **E-19**: Own risk and solvency assessment (ORSA)

**Finance Implications:**
- Enhanced controls
- Technology risk assessment
- Capital adequacy reporting
- Stress testing

### DORA - Digital Operational Resilience Act (EU)

**Key Requirements:**
- ICT risk management
- Incident reporting
- Resilience testing
- Third-party risk management

**Finance Impact:**
- Technology investment
- Risk management
- Compliance costs
- Reporting requirements

---

## 4. Financial Services KPIs

### Universal Banking KPIs

| Category | KPI | Target | Calculation |
|----------|-----|--------|-------------|
| **Profitability** | ROE | >12% | Net income / Average equity |
| | ROA | >1.0% | Net income / Average assets |
| | Cost-to-income | <55% | Operating costs / Operating income |
| | NIM | >2.5% | Net interest income / Average earning assets |
| **Credit Quality** | NPL ratio | <3% | Non-performing loans / Total loans |
| | Provision coverage | >100% | Loan loss provisions / NPLs |
| | Cost of risk | <0.5% | Impairment charges / Average loans |
| **Capital** | CET1 ratio | >11% | CET1 capital / RWA |
| | Total capital | >14% | Total capital / RWA |
| | Leverage ratio | >4% | Tier 1 capital / Total exposure |
| **Liquidity** | LCR | >100% | HQLA / Net cash outflows |
| | NSFR | >100% | Available stable funding / Required stable funding |

### Insurance KPIs

| Category | KPI | Target | Calculation |
|----------|-----|--------|-------------|
| **Underwriting** | Combined ratio | <95% | (Claims + Expenses) / Premiums |
| | Loss ratio | <65% | Claims / Premiums |
| | Expense ratio | <30% | Expenses / Premiums |
| **Profitability** | ROE | >10% | Net income / Average equity |
| | Investment yield | >3% | Investment income / Average investments |
| **Capital** | MCT ratio (Canada) | >150% | Capital / Required capital |
| | Solvency II ratio (EU) | >100% | Own funds / SCR |
| **Growth** | Premium growth | >5% | YoY premium increase |
| | Policy persistency | >85% | Renewed policies / Total policies |

### Asset Management KPIs

| Category | KPI | Target | Calculation |
|----------|-----|--------|-------------|
| **Growth** | Net flows | Positive | Inflows - Outflows |
| | AUM growth | >8% | YoY AUM increase |
| **Performance** | Investment performance | vs benchmark | Fund return - Benchmark |
| | Alpha generation | Positive | Excess return over benchmark |
| **Profitability** | Revenue per AUM | 25-50bps | Revenue / Average AUM |
| | Operating margin | >30% | Operating income / Revenue |
| **Client** | Client retention | >90% | Retained clients / Total clients |
| | Net promoter score | >50 | Survey-based |

---

## 5. Financial Services Technology

### Core Banking Platforms
| Platform | Strengths | Best For |
|----------|-----------|----------|
| **Temenos T24** | Scalable, modern | Large banks, global |
| **Finacle** | Comprehensive | Universal banking |
| **FIS Profile** | Real-time processing | Large banks |
| **Fiserv DNA** | Flexible | Credit unions, community banks |
| **Temenos Infinity** | Digital-first | Digital transformation |

### Insurance Policy Administration
| Platform | Strengths | Best For |
|----------|-----------|----------|
| **Guidewire** | Market leader, comprehensive | P&C insurers |
| **Duck Creek** | Cloud-native, configurable | P&C insurers |
| **Sapiens** | Life and P&C | Global insurers |
| **EIS** | Modern, flexible | Life insurers |
| **Oracle Insurance** | Integrated suite | Large insurers |

### Asset Management Platforms
| Platform | Strengths | Best For |
|----------|-----------|----------|
| **SimCorp** | Comprehensive, front-to-back | Large asset managers |
| **Charles River** | Investment management | Buy-side firms |
| **Aladdin (BlackRock)** | Risk analytics | Institutional investors |
| **Eze Software** | Trade order management | Hedge funds |
| **SS&C Advent** | Portfolio accounting | Asset managers |

---

## 6. Canadian Financial Services Specifics

### Canadian Banking Landscape
**Big 6 Banks:**
- Royal Bank of Canada (RBC)
- Toronto-Dominion Bank (TD)
- Bank of Nova Scotia (Scotiabank)
- Bank of Montreal (BMO)
- Canadian Imperial Bank of Commerce (CIBC)
- National Bank of Canada

**Regulatory Environment:**
- **OSFI**: Office of the Superintendent of Financial Institutions
- **CDIC**: Canada Deposit Insurance Corporation
- **FCAC**: Financial Consumer Agency of Canada
- **MFDA**: Mutual Fund Dealers Association
- **IIROC**: Investment Industry Regulatory Organization (now CIRO)

### Canadian Insurance Landscape
**Major Players:**
- Manulife Financial
- Sun Life Financial
- Great-West Lifeco
- Intact Financial
- Fairfax Financial

**Regulatory:**
- OSFI for federal insurers
- Provincial regulators for P&C
- CLHIA (Canadian Life and Health Insurance Association)

### Canadian Tax Considerations
- Part I tax (corporate income tax)
- Part VI tax (financial institutions)
- Part VI.1 (large corporations)
- Provincial premium taxes (insurance)
- HST/GST implications

---

## 7. Financial Services Transformation Drivers

### Digital Transformation
- Mobile banking adoption
- Digital lending platforms
- Robo-advisors
- AI/ML for credit decisions
- Chatbots and virtual assistants

### Regulatory Transformation
- IFRS 9/17 implementation
- Basel IV compliance
- DORA compliance (EU)
- Open banking (CDR in Canada)
- Climate risk disclosure (TCFD)

### Operating Model Transformation
- Finance shared services
- GBS (Global Business Services)
- CoE (Centers of Excellence)
- Automation (RPA, AI)
- Cloud migration

---

## Quick Reference: Financial Services Checklist

**Industry Assessment:**
- [ ] Sub-sector identified (banking, insurance, asset management)
- [ ] Regulatory requirements mapped
- [ ] Key stakeholders identified (risk, compliance, actuarial)
- [ ] Current technology landscape documented
- [ ] Industry KPIs benchmarked

**Regulatory Considerations:**
- [ ] IFRS 9/17 impact assessed
- [ ] Basel requirements understood
- [ ] Local regulations identified
- [ ] Reporting timelines documented
- [ ] Audit requirements clarified

**Transformation Planning:**
- [ ] Business case validated with industry benchmarks
- [ ] Regulatory approval requirements identified
- [ ] Risk management integration planned
- [ ] Actuarial/finance alignment established
- [ ] Technology roadmap aligned with industry trends
