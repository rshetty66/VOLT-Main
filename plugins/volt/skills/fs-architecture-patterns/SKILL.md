---
name: fs-architecture-patterns
description: >
  Activates when designing enterprise architecture for financial services clients
  implementing Oracle ERP Cloud, OFSAA, EPM Cloud, or hybrid on-prem/cloud platforms.
  Covers Finance & Risk Platform patterns, data provisioning, FSDF staging, regulatory
  reporting (OSFI, Basel, BCAR/CCAR, IFRS), sub-ledger integration, financial crimes
  compliance (FCCM), and multi-domain data architecture. Produces target state diagrams,
  POC architecture, integration flow maps, and technology stack recommendations.
version: 1.0.0
disable-model-invocation: true
---

# Financial Services Architecture Patterns

Enterprise architecture reference patterns for financial services clients implementing
Oracle ERP Cloud, OFSAA (Oracle Financial Services Analytical Applications), EPM Cloud,
and hybrid on-prem/cloud data platforms. Reflects common large-bank implementation
patterns.

---

## When to Use This Skill

Activate when:
- Designing **Finance & Risk Platform (FRP)** architecture for a bank or insurer
- Creating **target state** or **POC architecture** diagrams for Oracle ERP Cloud
- Mapping data flows from **source systems** through **processing** to **reporting**
- Designing **OFSAA** integration (Risk, Finance, FCCM applications)
- Planning **regulatory reporting** architecture (OSFI, Basel, BCAR/CCAR, Dodd-Frank, IFRS)
- Designing **EPM Cloud** consolidation, planning, and allocation architectures
- Architecting **data integration hubs** and **FSDF staging** layers
- Planning **financial crimes & compliance (FCCM)** platform architecture
- Designing **hybrid** on-prem + Azure + Oracle Cloud deployments
- Creating architecture for **GL reconciliation**, **profitability**, or **data governance**

---

## Reference Architecture: Finance & Risk Platform (FRP)

### Architecture Layers (Left to Right)

A canonical FRP follows 4 horizontal layers:

```
SOURCE ──> DATA PROVISIONING & COMMON DATA ──> PROCESSING METHODS ──> REPORT & ANALYZE
```

Plus 3 cross-cutting concerns spanning all layers:
- **Lineage and Drill Down**
- **Governance (Policies, Process, and Control)**
- **Data Security & Privacy**

---

### Layer 1: Source Systems

| Source Category | Typical Systems | Data Types |
|---|---|---|
| Reference Data (Enterprise) | Enterprise MDM platform | Customer Master (Individual, Non-Individual) |
| Product Sources | Core banking (Retail, Commercial, Wholesale, Insurance) | Accounts, Transactions, Positions |
| On-Prem Data Stores | Raw Data Zone, ADLS G2, NAS, enterprise data platform | Flat files, staging tables |
| LOB Systems | Corporate Treasury, Securities, Wealth, Insurance | Trade data, loan data, investment data |

**Key Pattern:** Enterprise reference data (customers, products) flows into both OFSAA and ERP Cloud. Product sources feed the FSDF staging area. Results from risk engines flow back to the enterprise data foundation.

---

### Layer 2: Data Provisioning, Common Data & Results

This is the core data platform layer with 3 major components:

#### 2a. OFSAA (Risk, Finance, FCCM) — Oracle Cloud or On-Prem

| Component | Function |
|---|---|
| **FSDF Staging** | Financial Services Data Foundation — landing zone for transactions, positions, reference data |
| **Conformance** | Data quality checks, customer data validation |
| **Data Quality Framework** | Rules engine for data completeness, accuracy, consistency |
| **Calculations & Aggregations** | Risk calculations, regulatory capital, economic capital |
| **FSDF Results Data** | Dimensional, reconciled, optimized for reporting |

**FSDF Results include:**
- Accounting Balances (incl. pass-through)
- Regulatory Results (OSFI, OCC, FinTRAC, FinCEN)
- FP&A Results (Budget, Forecast, Product Pricing, Profitability)
- Risk Results (Exposures, PD, LGD, Regulatory Capital, Economic Capital)

#### 2b. Core Finance — Oracle Cloud

| Component | Function | Cloud Service |
|---|---|---|
| **ERP Cloud** | Core general accounting and control | Oracle ERP Cloud |
| GL (Thin) | Thin general ledger for statutory reporting | ERP Cloud |
| Accounting Engine | Events-based thick ledger for detailed posting | ERP Cloud |
| Sub Ledgers (AP, FA) | Accounts Payable, Fixed Assets | ERP Cloud |
| **EPM Cloud** | Enterprise Performance Management | Oracle EPM Cloud |
| Consolidated GL | Multi-entity consolidation | EPM Cloud (FCCS) |
| Strategic Planning & Forecasting | FP&A, budgeting, forecasting | EPM Cloud (EPBCS) |
| Allocations & Reconciliation | Cost allocations, intercompany recon | EPM Cloud |
| Disclosure Management | Regulatory disclosure preparation | EPM Cloud |
| Hierarchy Reference Data (EDMCS) | Hierarchy master data for Risk & Finance | Oracle EDMCS |
| Tax | Tax provisioning and compliance | ERP Cloud |
| Data Management (DM) | Data load, transformation, ETL | EPM Cloud / FDMEE |

#### 2c. Data Integration Hub (DIH)

Central integration layer connecting on-prem sources to Oracle Cloud:
- Manages bi-directional data flows
- Sub-ledger and hierarchy reference data pushed back to enterprise for consumption
- Orchestrates batch and near-real-time data movements

---

### Layer 3: Processing Methods

#### OFSAA Applications for Finance, Risk, FCCM

| Application | Domain | Key Functions |
|---|---|---|
| **GL Reconciliation** | Finance & Risk | Balance reconciliation, variance analysis |
| **Profitability** | Finance | Product/customer profitability, FTP |
| **Data Governance** | Risk | Data lineage, quality monitoring |
| **Financial Crimes & Compliance (FCCM)** | Compliance | AML transaction monitoring, sanctions screening |
| Transaction Monitoring | FCCM | Real-time transaction surveillance |
| CRR (Customer Risk Rating) | FCCM | Risk scoring for AML |
| Case Management | FCCM | Investigation workflow |
| Sanctions/PEP Screening | FCCM | OFAC, EU, UN sanctions lists |
| CTR/LCTR | FCCM | Currency transaction reporting |

#### Core Risk (non-Oracle)

| Component | Function |
|---|---|
| **Risk Engines** | Counterparty Risk, Facility Risk, ALCO, Model Lifecycle |
| **Risk Strategic Marts** | Retail, wholesale and commercial risk marts |
| **Regulatory** | Expected Credit Loss, IFRS 9/17, Basel, BCAR/CCAR, Dodd-Frank |
| **Specific Allowances** | Individual and portfolio allowances |
| **Modelling & Sandbox** | SAS Grid, R, Python for model development |

---

### Layer 4: Report and Analyze (Consume)

| Reporting Domain | Tool | Source |
|---|---|---|
| **Financial Reporting** | ERP Cloud OOTB Reports, OAC | Core Finance |
| **Management Reporting** | EPM Cloud OOTB Reports, OAC | EPM Cloud |
| **Regulatory Reporting** | OFSAA OOTB Reports | OFSAA Results |
| **Enterprise Risk** | Oracle Analytics Cloud (OAC) | Risk Engines + OFSAA |
| **Treasury** | OAC + custom dashboards | ALCO + Core Finance |
| **FP&A** | EPM Cloud Reports | EPM Cloud |
| **Insight & Data Discovery** | Oracle Analytics Cloud | Cross-domain |

---

### Deployment Topology

```
┌─────────────────────────────────────────────────────────┐
│                    DEPLOYMENT ZONES                       │
├──────────────┬──────────────┬───────────────────────────┤
│   On-Prem    │    Azure     │      Oracle Cloud          │
├──────────────┼──────────────┼───────────────────────────┤
│ MDM          │ Raw Data Zone│ OFSAA (Risk,Finance,FCCM) │
│ Data platform│ ADLS G2      │ ERP Cloud                 │
│ Risk Engines │ Analytics    │ EPM Cloud (FCCS/EPBCS)    │
│ SAS Grid     │              │ EDMCS (hierarchies)       │
│ Legacy Apps  │              │ Oracle Analytics Cloud     │
│              │              │ IDCS (Identity)            │
└──────────────┴──────────────┴───────────────────────────┘
```

---

## Architecture Generation Agents

### Agent 1: Architecture Discovery Agent
**ID:** `architecture-discovery-agent`
Interviews stakeholders and analyzes current state to identify:
- Source systems inventory (with data volumes, frequencies)
- Existing integration patterns
- Regulatory requirements by jurisdiction (OSFI, OCC, Basel, etc.)
- Cloud readiness assessment
Output: Current State Architecture Document, System Inventory, Integration Catalog

### Agent 2: Target State Architect
**ID:** `target-state-architect`
Designs the target state architecture using this reference pattern:
- Maps client systems to the 4-layer model
- Selects Oracle Cloud components (ERP, EPM, OFSAA, OAC)
- Designs FSDF staging strategy
- Plans hybrid deployment (on-prem vs cloud for each component)
Output: Target State Architecture Diagram (Mermaid/SVG), Component Selection Matrix

### Agent 3: Integration Architecture Agent
**ID:** `integration-architecture-agent`
Designs the data integration layer:
- DIH design (batch vs real-time, ETL vs ELT)
- FSDF-to-ERP data flows
- Sub-ledger posting patterns
- Reference data synchronization
- API vs file-based integration selection
Output: Integration Architecture Document, Interface Catalog, Data Flow Diagrams

### Agent 4: Regulatory Architecture Agent
**ID:** `regulatory-architecture-agent`
Designs the regulatory reporting architecture:
- OSFI regulatory returns (BCAR, Basel III/IV, IFRS 9/17)
- OCC requirements (US entities)
- AML/FCCM architecture (transaction monitoring, sanctions screening)
- Data lineage for regulatory audit trail
Output: Regulatory Architecture Document, OSFI Compliance Matrix

### Agent 5: POC Architecture Agent
**ID:** `poc-architecture-agent`
Designs a reduced-scope POC architecture:
- Selects representative source systems (2-3 LOBs)
- Minimal OFSAA configuration
- Core Finance subset (GL + 1 sub-ledger)
- Single EPM consolidation entity
- Risk engine stub or sandbox
Output: POC Architecture Diagram, POC Scope Document, POC Timeline

---

## Deliverable Templates

### 1. Target State Architecture Document
Sections:
1. Executive Summary
2. Architecture Principles & Constraints
3. Source Systems Landscape
4. Data Provisioning Layer (FSDF, DIH, Reference Data)
5. Core Finance Architecture (ERP Cloud, EPM Cloud, EDMCS)
6. Risk & Regulatory Architecture (OFSAA, Risk Engines, FCCM)
7. Reporting & Analytics Architecture (OAC, OOTB Reports)
8. Integration Architecture (DIH, APIs, File-Based)
9. Security & Data Privacy Architecture
10. Deployment Topology (On-Prem, Azure, Oracle Cloud)
11. Data Governance & Lineage Framework
12. Migration & Cutover Architecture
13. Non-Functional Requirements (Performance, Availability, DR)

### 2. POC Architecture Document
Sections:
1. POC Objectives & Success Criteria
2. Scope (In-Scope / Out-of-Scope components)
3. POC Architecture Diagram
4. Data Flow: Source → OFSAA → Core Finance → Reporting
5. Test Data Strategy
6. Infrastructure & Environment Setup
7. Timeline & Milestones
8. Risk & Mitigation

### 3. Integration Catalog
Per interface:
- Interface ID, Name, Description
- Source System, Target System
- Direction (Inbound/Outbound)
- Protocol (REST, SOAP, File/FBDI, ODI)
- Frequency (Real-time, Hourly, Daily, Monthly)
- Volume (Records/day)
- Error Handling Pattern
- SLA Requirements

---

## Key Financial Services Architecture Patterns

### Pattern 1: Thick Ledger + Thin GL
The ERP Cloud runs a "thin" GL for statutory reporting while the Accounting Engine
maintains a "thick" ledger with full event-level detail. OFSAA consumes from both.

### Pattern 2: FSDF as Single Source of Truth
All source data lands in the FSDF (Financial Services Data Foundation) staging area
before flowing to ERP Cloud or risk engines. This ensures consistency and enables
reconciliation between finance and risk views of the same data.

### Pattern 3: Sub-Ledger Push-Back
Sub-ledger data (AP, FA) and hierarchy reference data mastered in Oracle Cloud are pushed
back to the enterprise data platform for consumption by non-Oracle systems.

### Pattern 4: Regulatory Results Feedback Loop
OFSAA calculates regulatory capital, ECL provisions, and risk metrics. These results
flow back into the FSDF Results Data layer and are consumed by both regulatory
reporting (OSFI returns) and management reporting (OAC dashboards).

### Pattern 5: FCCM Parallel Processing
Financial Crimes & Compliance (FCCM) runs as a parallel processing domain alongside
Finance and Risk. It shares the same OFSAA infrastructure but has separate data flows
for transaction monitoring, sanctions screening, and case management.

### Pattern 6: Hybrid Cloud Deployment
Risk engines (SAS Grid, counterparty risk) remain on-prem due to latency and licensing.
Core Finance (ERP Cloud, EPM Cloud) runs in Oracle Cloud. Data staging (ADLS G2) may
run in Azure. The DIH orchestrates cross-cloud data movement.

---

## Oracle Product Mapping

| Business Capability | Oracle Product | License |
|---|---|---|
| General Ledger, AP, FA | ERP Cloud | Oracle ERP Cloud |
| Consolidation | EPM Cloud — FCCS | Oracle EPM Cloud |
| Planning & Forecasting | EPM Cloud — EPBCS | Oracle EPM Cloud |
| Allocations | EPM Cloud — ARCS | Oracle EPM Cloud |
| Disclosure Management | EPM Cloud — Narrative Reporting | Oracle EPM Cloud |
| Hierarchy Management | EDMCS | Oracle EDMCS |
| Risk Analytics | OFSAA — OFSDF, OFSECL | Oracle OFSAA |
| Regulatory Reporting | OFSAA — OFSRR | Oracle OFSAA |
| Profitability | OFSAA — OFSPM | Oracle OFSAA |
| AML/FCCM | OFSAA — OFSFCCM | Oracle OFSAA |
| Reporting & Analytics | Oracle Analytics Cloud (OAC) | Oracle OAC |
| Identity Management | IDCS | Oracle Cloud |
| Data Integration | ODI, DIH | Oracle Data Integrator |

---

## Effort Estimates

| Deliverable | Traditional | VOLT-Assisted | Saving |
|---|---|---|---|
| Current State Architecture | 80h | 16h | 80% |
| Target State Architecture | 120h | 24h | 80% |
| POC Architecture | 40h | 8h | 80% |
| Integration Catalog (50 interfaces) | 100h | 20h | 80% |
| Regulatory Architecture | 60h | 12h | 80% |
| Data Flow Diagrams | 40h | 8h | 80% |
| **TOTAL** | **440h** | **88h** | **80%** |
