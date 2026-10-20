---
name: third-party-risk-management
description: >
  This skill should be used when the user asks about "third party risk",
  "TPRM", "vendor risk management", "VRM", "supplier risk", "third party
  due diligence", "third party governance", "fourth party risk",
  "concentration risk", "supply chain risk", "vendor assessment",
  "third party oversight", "OSFI B-10", "OCC third party", "DORA",
  "third party lifecycle", "inherent risk", "residual risk",
  "third party monitoring", "subcontracting risk", "outsourcing risk",
  "critical third party", "material outsourcing", "third party controls",
  or needs to design, assess, or implement a TPRM programme.
version: 1.0.0
disable-model-invocation: true
---

# Third Party Risk Management (TPRM) Methodology

Expert-level methodology for designing, implementing, and operating enterprise Third Party Risk Management programmes. Apply this knowledge to generate TPRM frameworks, risk assessments, governance structures, regulatory compliance evidence, and operational playbooks.

## The TPRM Imperative

Organizations increasingly depend on third parties for critical business services — from cloud infrastructure to payroll processing to customer-facing technology. This creates systemic risk: a third party failure can disrupt operations, expose sensitive data, trigger regulatory action, and destroy stakeholder trust.

Regulators worldwide are intensifying third-party oversight requirements:
- **OSFI B-10** (Canada) — Technology and Cyber Risk Management
- **OCC Bulletin 2023-17** (US) — Third-Party Relationships: Risk Management Guidance
- **DORA** (EU) — Digital Operational Resilience Act
- **FCA/PRA** (UK) — Operational Resilience and Critical Third Parties
- **APRA CPS 230** (Australia) — Operational Risk Management

## TPRM Framework Design

### Core Framework Components

| Component | Purpose | Key Outputs |
|-----------|---------|-------------|
| **Governance** | Oversight structure, policies, roles | TPRM policy, committee charter, RACI |
| **Risk Taxonomy** | Classification of third-party risks | Risk categories, assessment criteria |
| **Lifecycle Management** | End-to-end third-party lifecycle | Process maps, stage gates, templates |
| **Risk Assessment** | Inherent and residual risk evaluation | Risk ratings, tiering, heat maps |
| **Due Diligence** | Pre-contract and ongoing evaluation | DD questionnaires, evidence requirements |
| **Ongoing Monitoring** | Continuous risk surveillance | KRIs, alerts, dashboards, reassessment triggers |
| **Issue & Incident Mgmt** | Response to third-party events | Escalation matrix, incident playbook |
| **Reporting** | Board and regulatory reporting | Risk reports, regulatory submissions |

### TPRM Operating Model

| Model | Description | Best For |
|-------|-------------|----------|
| **Centralized** | Dedicated TPRM team manages all third parties | Regulated industries, consistent control |
| **Federated** | Central framework, business unit execution | Large, diverse organizations |
| **Hybrid** | Critical/high-risk = central; low-risk = business-led | Most common in practice |
| **Outsourced** | TPRM-as-a-Service (assessment, monitoring) | Capacity-constrained organizations |

## Third-Party Risk Lifecycle

### Seven-Stage Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│  1. PLANNING  →  2. DUE DILIGENCE  →  3. CONTRACTING  →  4. ONBOARDING │
│                                                                        │
│  7. OFFBOARDING  ←  6. ISSUE MGMT  ←  5. ONGOING MONITORING           │
└──────────────────────────────────────────────────────────────────────┘
```

**Stage 1: Planning & Identification**
- Business need assessment and alternatives analysis
- Inherent risk assessment (before controls)
- Third-party tiering (Critical / High / Medium / Low)
- Approval to proceed with engagement
- Concentration risk analysis

**Stage 2: Due Diligence**
- Scope DD based on risk tier and service type
- Financial viability assessment
- Information security assessment (SOC 2, ISO 27001, penetration testing)
- Business continuity and disaster recovery review
- Regulatory compliance verification
- ESG and reputational risk assessment
- Fourth-party (subcontractor) mapping
- Data privacy impact assessment (where applicable)

**Stage 3: Contracting**
- Risk-based contract terms (SLAs, KPIs, audit rights)
- Data protection clauses (GDPR, PIPEDA, CCPA)
- Business continuity obligations
- Subcontracting restrictions / approval requirements
- Exit and transition provisions
- Right to audit and regulatory access
- Incident notification requirements

**Stage 4: Onboarding & Integration**
- Access provisioning and controls setup
- Data sharing agreements execution
- Integration testing and validation
- Operational runbook development
- Contact and escalation matrix
- Initial KRI baseline establishment

**Stage 5: Ongoing Monitoring**
- Continuous monitoring (financial, cyber, ESG, news)
- Periodic reassessment (frequency based on tier)
- KRI dashboard maintenance
- SLA/KPI performance tracking
- Regulatory change impact assessment
- Annual attestation and certification refresh

**Stage 6: Issue & Incident Management**
- Issue identification and classification
- Root cause analysis
- Remediation planning and tracking
- Regulatory notification (where required)
- Escalation to governance committees
- Lessons learned and framework updates

**Stage 7: Offboarding & Exit**
- Exit planning and transition
- Data return/destruction verification
- Access revocation
- Knowledge transfer
- Post-exit monitoring period
- Relationship closure documentation

## Risk Assessment Methodology

### Inherent Risk Assessment (IRA)

Score each dimension 1-5 (1=Low, 5=Critical):

| Dimension | Assessment Criteria |
|-----------|-------------------|
| **Data Sensitivity** | Volume, type (PII, PHI, financial), cross-border transfers |
| **Business Criticality** | Revenue impact if service fails; recovery time objective |
| **Regulatory Exposure** | Regulated activity, reporting obligations, supervisory interest |
| **Replaceability** | Alternative providers, switching cost, transition complexity |
| **Integration Depth** | System connectivity, API access, network access |
| **Concentration** | Revenue dependency, geographic concentration, single points of failure |
| **Subcontracting** | Fourth-party dependencies, supply chain depth |

### Risk Tiering Matrix

| Tier | Inherent Risk Score | Due Diligence | Monitoring | Governance |
|------|-------------------|---------------|------------|-----------|
| **Critical** | 30-35 | Comprehensive (all dimensions) | Continuous + Quarterly review | Board/ExCo reporting |
| **High** | 20-29 | Enhanced (security + financial + BCP) | Monthly KRIs + Annual review | Senior management |
| **Medium** | 12-19 | Standard (questionnaire + key docs) | Quarterly KRIs + Biennial review | Functional management |
| **Low** | 7-11 | Simplified (self-certification) | Annual review | Business unit |

### Residual Risk Assessment

After controls evaluation:
- **Control Effectiveness** — Design adequacy + Operating effectiveness
- **Compensating Controls** — Where third-party controls are insufficient
- **Risk Acceptance** — Documented acceptance for residual risk above tolerance
- **Remediation Plans** — Tracked reduction of residual risk over time

## Regulatory Compliance

### OSFI B-10 Key Requirements (Canada)

| Requirement | Implementation |
|-------------|---------------|
| Technology risk governance | TPRM policy approved by Board; CRO oversight |
| Third-party risk assessment | Inherent + residual risk; tiering; concentration |
| Due diligence | Proportionate to risk; covers security, BCP, subcontracting |
| Contract provisions | Audit rights, data protection, incident notification, exit |
| Ongoing monitoring | Continuous for critical; periodic for others |
| Concentration risk | Limits, alternatives, contingency planning |
| Incident management | Notification to OSFI for material incidents |
| Board reporting | Quarterly risk profile; critical third-party inventory |

### OCC 2023-17 Key Requirements (US)

| Requirement | Implementation |
|-------------|---------------|
| Risk-based approach | Proportionate oversight to risk + complexity |
| Lifecycle management | Planning through termination |
| Independent risk management | Three lines model for TPRM |
| Concentration limits | Geographic, provider, service concentration |
| Subcontractor oversight | Know your fourth parties |
| Collaborative arrangements | Shared assessments, industry utilities |

### DORA Requirements (EU)

| Requirement | Implementation |
|-------------|---------------|
| ICT third-party risk framework | Comprehensive policy and governance |
| Preliminary assessment | Before contracting ICT services |
| Key contractual provisions | Mandatory clauses in ICT contracts |
| Oversight of critical ICT providers | Register of ICT contracts; direct oversight |
| Exit strategies | Documented, tested exit plans for critical services |
| Concentration risk | Identified, managed, reported |

## TPRM Technology Ecosystem

| Category | Tools | Purpose |
|----------|-------|---------|
| **GRC Platforms** | Archer, ServiceNow GRC, MetricStream | Integrated risk management |
| **TPRM Specialized** | Prevalent, OneTrust, Venminder, ProcessUnity | Purpose-built TPRM lifecycle |
| **Risk Intelligence** | BitSight, SecurityScorecard, RapidRatings | Continuous monitoring signals |
| **Contract Management** | Icertis, Agiloft, DocuSign CLM | Contract risk provisions |
| **Procurement** | Coupa Risk Assess, Ariba Supplier Risk | Integrated procurement risk |
| **Cyber Intelligence** | Recorded Future, CrowdStrike, Black Kite | Cyber threat monitoring |
| **Financial Health** | D&B, Moody's, CreditSafe | Financial viability signals |
| **ESG** | EcoVadis, Sustainalytics, ISS | Environmental/social risk |

## TPRM KPI Framework

| Category | KPI | Target |
|----------|-----|--------|
| Coverage | Critical third parties with current assessment (%) | 100% |
| Coverage | Total third parties in inventory (%) | 95%+ |
| Timeliness | Overdue assessments (count) | 0 for Critical/High |
| Timeliness | Average DD completion time (days) | <30 days |
| Quality | Issues identified / assessment (ratio) | Track trend |
| Quality | Remediation plan completion rate (%) | >90% |
| Risk | Third parties above risk appetite (count) | Decreasing trend |
| Risk | Concentration breaches (count) | 0 |
| Efficiency | Assessment cost per third party ($) | Decreasing |
| Maturity | TPRM maturity score (1-5) | ≥4 |

## Transformation Phases

**Phase 1: Assess (4-6 weeks)**
- Current-state TPRM maturity assessment
- Third-party inventory and classification
- Regulatory gap analysis (B-10, OCC, DORA)
- Concentration risk analysis
- Quick-win identification
- Business case for TPRM programme

**Phase 2: Design (6-12 weeks)**
- TPRM framework and policy development
- Risk taxonomy and assessment methodology
- Lifecycle process design (7 stages)
- Governance model and RACI
- Technology requirements and selection
- KRI and reporting framework

**Phase 3: Implement (12-24 weeks)**
- Technology platform deployment
- Assessment template and questionnaire build
- Historical third-party assessment (critical/high)
- Training and capability development
- Pilot with critical third parties
- Integration with procurement and contracts

**Phase 4: Operate (ongoing)**
- Steady-state assessment execution
- Continuous monitoring operationalization
- Regulatory reporting cadence
- Issue resolution and remediation tracking
- Annual framework review and update

## Deliverables Catalog

### ALIGN Phase
- TPRM Current-State Maturity Assessment
- Regulatory Gap Analysis (B-10 / OCC / DORA)
- Third-Party Inventory & Classification
- Concentration Risk Analysis
- TPRM Business Case
- Stakeholder Engagement Plan

### INNOVATE Phase
- TPRM Policy & Framework Document
- Risk Assessment Methodology (IRA + Residual)
- Third-Party Lifecycle Process Design
- Governance Model & Committee Charter
- Technology Solution Design
- Due Diligence Questionnaire Templates
- KRI & Reporting Framework

### RELEASE Phase
- Platform Configuration & Deployment Plan
- Assessment Execution Playbook
- Training Materials & Certification
- Critical Third-Party Assessment Results
- Regulatory Submission Package
- Go-Live Readiness & Hypercare Plan

### EVOLVE Phase
- TPRM Programme Effectiveness Report
- Maturity Progression Roadmap
- Advanced Analytics & AI Monitoring Strategy
- Regulatory Examination Preparation Package
- Continuous Improvement Backlog
- Annual Framework Review
