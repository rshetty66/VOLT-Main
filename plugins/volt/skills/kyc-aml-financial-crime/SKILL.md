---
name: kyc-aml-financial-crime
description: >
  KYC, Anti-Money Laundering, Financial Crime Compliance expertise for banking, insurance,
  credit unions, asset management, and pension funds. Activates when users ask about
  "KYC", "Know Your Customer", "CDD", "customer due diligence", "EDD", "enhanced due diligence",
  "AML", "anti-money laundering", "AMLATF", "PCMLTFA", "Proceeds of Crime",
  "FINTRAC", "FinCEN", "suspicious transaction", "STR", "SAR", "CTR",
  "currency transaction report", "terrorist financing", "sanctions screening",
  "OFAC", "PEP", "politically exposed person", "beneficial ownership",
  "UBO", "ultimate beneficial owner", "transaction monitoring",
  "typologies", "layering", "placement", "integration", "structuring", "smurfing",
  "trade-based money laundering", "TBML", "correspondent banking risk",
  "de-risking", "risk assessment", "inherent risk", "residual risk",
  "AML program", "compliance program", "BSA", "Bank Secrecy Act",
  "FATF", "mutual evaluation", "40 recommendations",
  "5AMLD", "6AMLD", "EU anti-money laundering", "MLD",
  "OSFI B-10", "OSFI Guideline", "risk-based approach",
  "customer risk rating", "country risk", "product risk",
  "wire transfer", "electronic funds transfer", "EFT",
  "large cash transaction", "LCTR", "casino reporting",
  "MSB", "money services business", "virtual currency", "VASP",
  "Oracle FCCM", "OFSAA anti-money laundering", "SAS AML",
  "Actimize", "NICE Actimize", "Verafin", "Featurespace",
  "fraud detection", "financial crime", "first-party fraud", "third-party fraud",
  "identity verification", "watchlist screening", "sanctions compliance",
  or any KYC/AML/financial crime compliance question.
version: 1.0.0
disable-model-invocation: true
---

# KYC, AML & Financial Crime Compliance

Deep expertise in Know Your Customer (KYC), Anti-Money Laundering (AML), Counter-Terrorist
Financing (CTF), Sanctions, and Financial Crime prevention across all financial services
sub-sectors. Covers regulatory frameworks, program design, transaction monitoring, reporting
obligations, and technology platforms (Oracle OFSAA FCCM, NICE Actimize, Verafin, SAS).

---

## Regulatory Framework

### Canadian Framework (PCMLTFA / FINTRAC)

| Regulation | Scope | Key Obligations |
|------------|-------|-----------------|
| **PCMLTFA** | Proceeds of Crime (Money Laundering) and Terrorist Financing Act | Reporting entities must report, keep records, verify ID, assess risk |
| **FINTRAC** | Financial Transactions and Reports Analysis Centre | Receives reports (STR, LCTR, EFT), analyzes, discloses to law enforcement |
| **OSFI B-10** | Guideline for FRFIs on AML/ATF | Risk assessment, governance, enhanced measures for higher risk |
| **CSA/OSC** | Securities regulators | KYC for dealer/advisor relationships, suitability |

### US Framework (BSA / FinCEN)

| Regulation | Scope | Key Obligations |
|------------|-------|-----------------|
| **BSA (Bank Secrecy Act)** | All US financial institutions | AML program, CTR ($10K+), SAR, recordkeeping |
| **USA PATRIOT Act** | Enhanced BSA requirements | CIP (Customer Identification Program), Section 314(a)/(b) |
| **FinCEN CDD Rule** | Customer Due Diligence | Identify and verify beneficial owners (25%+ ownership) |
| **AML Act of 2020** | Modernization | Beneficial ownership registry, whistleblower, innovation |
| **OFAC** | Office of Foreign Assets Control | Sanctions screening (SDN list, country programs) |

### International (FATF)

| Standard | Description |
|----------|-------------|
| **40 Recommendations** | Global AML/CTF standard-setting framework |
| **Risk-Based Approach** | Proportionate controls based on assessed risk |
| **Mutual Evaluations** | Country-level compliance assessments |
| **Travel Rule** | Originator/beneficiary info on wire transfers (Recommendation 16) |
| **Beneficial Ownership** | Transparency of legal entities and arrangements (Rec 24/25) |

---

## KYC Program Components

### Customer Due Diligence (CDD) Framework

```
LEVEL 1: SIMPLIFIED DUE DILIGENCE (SDD)
  └── Low-risk customers, regulated entities, government
  └── Basic identification, no enhanced measures

LEVEL 2: STANDARD DUE DILIGENCE (CDD)
  └── All customers by default
  └── Identity verification, beneficial ownership, purpose of relationship

LEVEL 3: ENHANCED DUE DILIGENCE (EDD)
  └── High-risk customers, PEPs, high-risk jurisdictions
  └── Source of wealth/funds, senior management approval, ongoing monitoring
```

### Customer Risk Rating Model

| Factor | Low Risk | Medium Risk | High Risk |
|--------|----------|-------------|-----------|
| **Customer Type** | Regulated FI, government | SME, established corporate | MSB, casino, shell company |
| **Geography** | Canada, US, EU (low-risk) | Developing markets | FATF grey/black list, sanctioned |
| **Product** | Savings account, GIC | Wire transfers, trade finance | Private banking, correspondent |
| **Transaction Pattern** | Consistent with profile | Some unusual activity | Structuring, rapid movement |
| **Channel** | In-person, verified digital | Online, remote | Third-party, anonymous |

### Beneficial Ownership Requirements

| Jurisdiction | Threshold | Requirement |
|-------------|-----------|-------------|
| Canada (PCMLTFA) | 25% ownership/control | Verify identity of all 25%+ owners |
| US (CDD Rule) | 25% ownership | Certify and verify; registry (2024+) |
| EU (6AMLD) | 25% (can go to 10% for higher risk) | Central beneficial ownership registers |
| UK (PSC) | 25% (persons with significant control) | Public register at Companies House |

---

## Transaction Monitoring

### Monitoring Scenarios (Common Typologies)

| Scenario | Detection Logic | Threshold Example |
|----------|----------------|-------------------|
| **Structuring** | Multiple deposits just below reporting threshold | >3 cash deposits of $8K-$9.9K within 5 days |
| **Rapid Movement** | Funds in and out within short period | >$50K in + out within 48 hours |
| **Round-Trip** | Funds sent to and received from same counterparty | Same amount ±5% within 30 days |
| **Layering** | Multiple transfers through intermediaries | >3 hops with no clear business purpose |
| **High-Risk Jurisdiction** | Transactions involving FATF grey/black list countries | Any transaction >$10K to high-risk country |
| **Unusual Cash** | Cash deposits inconsistent with customer profile | Cash deposits >200% of 12-month average |
| **Trade-Based ML** | Over/under invoicing in trade transactions | Invoice value >30% above market price |
| **Smurfing** | Multiple parties depositing to same account | >5 different depositors in 7 days |

### Alert Disposition Workflow

```
TRANSACTION → MONITORING RULES → ALERT GENERATED → L1 ANALYST REVIEW
                                                        │
                                            ┌───────────┴───────────┐
                                            │                       │
                                     FALSE POSITIVE             ESCALATE TO L2
                                     (Close with reason)             │
                                                            ┌───────┴───────┐
                                                            │               │
                                                     CLOSE (documented) FILE STR/SAR
                                                                         │
                                                                    SUBMIT TO
                                                                    FINTRAC/FinCEN
```

---

## Reporting Obligations

### Canadian Reporting (FINTRAC)

| Report | Trigger | Timeline |
|--------|---------|----------|
| **STR** (Suspicious Transaction Report) | Reasonable grounds to suspect ML/TF | Within 30 days of suspicion |
| **LCTR** (Large Cash Transaction) | Cash transaction ≥$10,000 | Within 15 days |
| **EFT** (Electronic Funds Transfer) | International EFT ≥$10,000 | Within 5 days |
| **Casino Disbursement** | Disbursement ≥$10,000 | Within 15 days |
| **Terrorist Property** | Property owned/controlled by listed entity | Immediately + within 5 days |

### US Reporting (FinCEN)

| Report | Trigger | Timeline |
|--------|---------|----------|
| **SAR** (Suspicious Activity Report) | Known/suspected criminal activity ≥$5K (banks) or $2K (MSBs) | Within 30 days (60 if no suspect identified) |
| **CTR** (Currency Transaction Report) | Cash transaction >$10,000 | Within 15 days |
| **CMIR** (Currency/Monetary Instrument Report) | Cross-border transport >$10,000 | At time of transport |
| **FBAR** (Foreign Bank Account Report) | US person with foreign account >$10K | Annually (April 15) |

---

## Technology Platforms

### Oracle OFSAA — FCCM (Anti-Money Laundering)

| Capability | Description |
|------------|-------------|
| **Transaction Monitoring** | Rule-based + ML-based detection across all channels |
| **Watch List Filtering** | Real-time screening against sanctions lists (OFAC, UN, EU) |
| **KYC/CDD** | Customer risk scoring, periodic review scheduling |
| **Case Management** | Alert investigation workflow, evidence collection, reporting |
| **Regulatory Reporting** | Auto-generate STR/SAR/CTR in jurisdiction-specific format |
| **Network Analysis** | Link analysis to identify hidden relationships between entities |
| **Currency Transaction Reporting** | Automated aggregation and filing |

### Other Platforms

| Platform | Strengths | Common Clients |
|----------|-----------|----------------|
| **NICE Actimize** | Market leader for large banks; X-Sight AI for detection | Tier 1 banks |
| **Verafin** (now Nasdaq) | Strong in credit unions and community banks | Credit unions, mid-tier banks |
| **SAS AML** | Advanced analytics, model governance | Large banks, regulators |
| **Featurespace** | Adaptive behavioral analytics (ARIC) | Cards, payments |
| **ComplyAdvantage** | AI-native; real-time risk database | Fintechs, neobanks |
| **LexisNexis Risk Solutions** | Identity verification, watchlist screening | Cross-industry |

---

## AML Program Design

### Five Pillars of an AML Program (US BSA)

| Pillar | Requirement | Key Deliverables |
|--------|-------------|-----------------|
| 1. Internal Policies & Procedures | Documented AML/KYC policies | Policy manual, procedures, desk guides |
| 2. Designated Compliance Officer | Named individual with authority | CAMLO/CCO appointment, reporting line |
| 3. Training | Risk-based training for all staff | Annual training, role-specific modules |
| 4. Independent Testing | Periodic audit of AML program | Internal audit plan, findings remediation |
| 5. Customer Due Diligence | Risk-based CDD program | CDD procedures, risk rating methodology |

### Risk Assessment Methodology

```
ENTERPRISE-WIDE AML RISK ASSESSMENT:

1. IDENTIFY inherent risks:
   - Products/Services risk
   - Customer/Entity risk
   - Geographic risk
   - Channel/Delivery risk

2. ASSESS inherent risk level (H/M/L) per category

3. EVALUATE mitigating controls:
   - KYC/CDD procedures
   - Transaction monitoring
   - Training effectiveness
   - Reporting timeliness

4. DETERMINE residual risk = Inherent Risk - Control Effectiveness

5. DOCUMENT risk appetite and tolerance thresholds

6. ACTION PLAN for risks exceeding appetite
```

---

## Industry-Specific AML Considerations

| Industry | Key Risks | Special Considerations |
|----------|-----------|----------------------|
| **Banking** | Correspondent banking, wire transfers, trade finance | De-risking pressure, nested accounts, payable-through |
| **Insurance** | Premium financing, early surrender, policy loans | Lower inherent risk but product-specific vulnerabilities |
| **Credit Unions** | Member-to-member transfers, shared branching | Community relationships may create bias; smaller compliance teams |
| **Asset Management** | Source of funds opacity, offshore structures | Complex ownership, fund-of-funds, nominee arrangements |
| **Pensions** | Contribution fraud, early withdrawal schemes | Lower risk generally; focus on employer contributions |

---

## Agentic AI for AML/KYC

### Agent Use Cases

| Agent | Function | MCP Integration |
|-------|----------|----------------|
| **Transaction Monitoring Agent** | Continuously monitor transactions against detection rules | OFSAA FCCM API / Actimize API |
| **Alert Triage Agent** | Auto-disposition low-risk alerts; escalate genuine suspicion | Case management API |
| **KYC Refresh Agent** | Identify customers due for periodic review; pull updated data | Core banking API + external data |
| **Sanctions Screening Agent** | Real-time watchlist screening on customer/transaction | OFAC/UN list API |
| **SAR/STR Drafting Agent** | Auto-draft suspicious activity report narrative from case data | Regulatory reporting API |
| **Risk Assessment Agent** | Continuously update customer risk scores based on behavior | Risk scoring engine API |

### Autonomous Workflow: Alert-to-Report

```
TRANSACTION EVENT → MONITORING RULES FIRE → ALERT CREATED
    │

TRIAGE AGENT: Gathers context (customer profile, history, account activity)
    │
    ├── LOW RISK (matches known false-positive pattern) → AUTO-CLOSE with reason code
    │
    └── ELEVATED RISK → INVESTIGATION AGENT:
         │  - Pulls 90-day transaction history
         │  - Checks peer group behavior
         │  - Identifies connected parties (network analysis)
         │  - Assesses against typology library
         │
         ├── NO SUSPICION (documented analysis) → CLOSE CASE
         │
         └── REASONABLE GROUNDS → SAR/STR DRAFTING AGENT:
              │  - Generates narrative from investigation findings
              │  - Populates regulatory form fields
              │  - Routes for compliance officer review
              │
              └── COMPLIANCE OFFICER APPROVES → FILE WITH FINTRAC/FinCEN
```
