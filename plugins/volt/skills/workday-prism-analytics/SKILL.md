---
name: workday-prism-analytics
description: >-
  Workday Prism Analytics specialist — data hub design, dataset creation, Prism pipelines,
  discovery boards, composite reporting with Prism data, blending Workday and third-party data,
  and enterprise analytics strategy. Use when building analytics solutions on Workday Prism,
  designing data integration pipelines, or creating executive dashboards.
disable-model-invocation: true
---

# Workday Prism Analytics — Implementation & Advisory Skill

## Core Capabilities

### Data Hub Architecture
- **Workday Data Sources:** Financials, HCM, Payroll, Recruiting, Time Tracking, Procurement
- **External Data Sources:** CSV/Excel uploads, API ingestion, cloud storage (S3, Azure Blob, GCS)
- **Data Blending:** Combine Workday transactional data with external benchmarks, market data, industry KPIs
- **Data Security:** Inherits Workday security model — row-level security via organizations

### Dataset Types
- **Workday-Sourced Datasets:** Pre-built connectors to Workday business objects
- **External Datasets:** Uploaded or API-ingested third-party data
- **Blended Datasets:** Joins between Workday and external sources on common keys (worker ID, cost center, company)
- **Derived Datasets:** Calculated/transformed datasets from pipelines

### Prism Analytics Pipelines
- **Pipeline Components:** Source → Filter → Join → Group → Calculate → Output
- **Transformations:** Aggregation, lookups, conditional calculations, date math, string manipulation
- **Scheduling:** On-demand, scheduled (daily/weekly/monthly), event-triggered
- **Orchestration:** Pipeline dependencies, sequential execution, error handling

### Discovery Boards
- **Visualization Types:** Bar, Line, Pie, Scatter, Heat Map, Geographic Map, KPI Cards, Waterfall
- **Interactivity:** Click-through drill-down, filter prompts, dynamic date ranges
- **Dashboard Templates:** Executive Summary, Financial Performance, Workforce Analytics, Spend Analysis
- **Sharing:** Published to Workday homepage, role-based access, export to PDF/Excel

## Analytics Patterns by Domain

### Financial Analytics
| Use Case | Data Sources | Key Metrics |
|----------|-------------|-------------|
| Cash Flow Forecasting | GL actuals + AR aging + AP aging + external market data | Days Cash on Hand, Working Capital Ratio |
| Spend Analytics | PO + Invoice + Contract + External benchmarks | Spend by Category, Maverick Spend %, Savings Rate |
| Revenue Analytics | Customer invoices + contracts + external pipeline | Revenue by Product/Geo, Churn Rate, LTV |
| Budget vs Actuals | GL Actuals ledger + Budget ledger + Adaptive Planning | Variance %, Forecast Accuracy, Run Rate |

### HR & Workforce Analytics
| Use Case | Data Sources | Key Metrics |
|----------|-------------|-------------|
| Attrition Prediction | HCM tenure + compensation + performance + engagement survey | Flight Risk Score, Regrettable Attrition % |
| Compensation Benchmarking | Workday comp + external market data (Radford, Mercer) | Compa-Ratio, Pay Equity Gap, Total Rewards |
| Recruiting Funnel | Recruiting pipeline + offer + hire + external job market | Time to Fill, Cost per Hire, Source Effectiveness |

### Operational Analytics
| Use Case | Data Sources | Key Metrics |
|----------|-------------|-------------|
| Procurement Efficiency | PO cycle time + supplier performance + contract compliance | PO Cycle Time, Contract Utilization, Supplier Score |
| Project Profitability | Project costs + revenue allocation + timesheet + expenses | Project Margin, Resource Utilization, EAC |

## Implementation Patterns

### Phase 1: Foundation
1. Enable Prism Analytics tenant
2. Define data governance (owners, stewards, retention)
3. Build Workday-sourced datasets for core domains
4. Create baseline discovery boards

### Phase 2: External Data Integration
1. Design ingestion pipelines for external data
2. Map join keys between Workday and external sources
3. Build blended datasets
4. Create advanced analytics dashboards

### Phase 3: Advanced Analytics
1. Build predictive models (attrition, cash flow, demand)
2. Create automated alerting on KPI thresholds
3. Embed analytics in Workday homepage and workflows
4. Train business users on self-service analytics

## Quality Checklist
- [ ] Data governance model defined (owners, stewards, retention policies)
- [ ] Workday security model properly inherited in Prism datasets
- [ ] Pipeline scheduling aligned with data freshness requirements
- [ ] Discovery boards validated against source system reports
- [ ] External data quality checks in place (null handling, dedup, format validation)
- [ ] Performance tested with production-scale data volumes
