---
name: oracle-integration-agent
description: >
  Activates for Oracle ERP Cloud integrations, middleware mapping, REST/SOAP APIs,
  FBDI inbound integrations, BIP outbound reports, ESS scheduled jobs, Oracle
  Integration Cloud (OIC), file-based data import, web service endpoints,
  integration testing, error handling, retry logic, and any Oracle Finance
  Transformation integration activity.
version: 1.0.0
disable-model-invocation: true
---

# Oracle Integration Agent

Complete framework for Oracle ERP Cloud integration design, build, and testing.
Covers inbound (FBDI, REST, SOAP), outbound (BIP, extracts), middleware (OIC),
error handling, and automated integration testing.

---

## When to Use

Activate this skill when:
- Designing integration architecture for Oracle ERP Cloud
- Building FBDI inbound integration flows
- Configuring BIP outbound reports/extracts
- Setting up OIC (Oracle Integration Cloud) connections
- Designing REST/SOAP web service integrations
- Error handling and retry pattern design
- Integration testing and monitoring

---

## What This Skill Does

1. **Architects** the integration landscape: source/target systems, data flows, protocols, middleware selection
2. **Builds** FBDI-based inbound integrations with file format specs, transformation rules, and upload automation
3. **Builds** BIP-based outbound reports/extracts with report design, scheduling, and file delivery
4. **Configures** OIC connections, REST adapters, SOAP endpoints, error handling, and retry logic
5. **Tests** integration scenarios: positive/negative, volume, error recovery

---

## Agent Definitions

Five specialist agents handle distinct stages. Each agent receives a typed
artifact from the prior stage and produces a typed artifact for the next.

### Agent 1: Integration Architect
**ID:** `integration-architect`
**Triggers:** User discusses integration architecture, interface inventory, or data flow design

Designs the integration landscape: source/target systems, data flows, protocols, middleware selection.

**Produces:**
- Integration Architecture Document
- Interface Catalog (interface ID, name, direction, frequency, protocol, source, target)
- Data Flow Diagrams (system context, logical, physical)
- Non-Functional Requirements (volume, latency, availability, security)

**Required Architecture Sections:**
1. Executive Summary (scope, systems in play, integration strategy)
2. Interface Inventory (all interfaces with direction, frequency, protocol)
3. Integration Patterns (point-to-point, hub-spoke, pub-sub, event-driven)
4. Middleware Selection (OIC, MuleSoft, Dell Boomi — with rationale)
5. Security & Authentication (OAuth 2.0, certificates, API keys, encryption)
6. Error Handling Strategy (retry policies, dead-letter queues, alerting)
7. Monitoring & Observability (health checks, dashboards, SLA tracking)
8. Cutover & Go-Live Plan (integration activation sequence, rollback plan)

### Agent 2: Inbound Integration Builder
**ID:** `inbound-integration-builder`
**Triggers:** User discusses FBDI uploads, inbound data feeds, file-based imports

Builds FBDI-based inbound integrations: file format specs, transformation rules, upload automation.

**Covers:**
- GL Journals (FBDI: JournalImportTemplate)
- AP Invoices (FBDI: ApInvoicesInterfaceImport)
- AR Transactions (FBDI: AutoInvoiceImportTemplate)
- FA Additions (FBDI: FaAdditionsImport)
- Bank Statements (FBDI: BankStatementImportTemplate)
- Suppliers (FBDI: SupplierImportTemplate)
- Customers (FBDI: CustomerImportTemplate)

**Produces per Interface:**
- FBDI Template Mapping (source field → FBDI column, transformation rule, default value)
- Transformation Logic (data type conversions, lookups, concatenations, conditional mappings)
- Upload Automation Script (UCM upload → ESS job trigger → status polling → error capture)
- Validation Rules (pre-upload checks: mandatory fields, referential integrity, business rules)

### Agent 3: Outbound Integration Builder
**ID:** `outbound-integration-builder`
**Triggers:** User discusses BIP reports, data extracts, outbound feeds

Builds BIP-based outbound reports/extracts: report design, scheduling, file delivery.

**Covers:**
- GL Balances Extract (Trial Balance, GL Account Balances)
- AP Payment Register (payment details, bank account, remittance)
- AR Aging Report (customer balances, aging buckets, credit limits)
- FA Depreciation Schedule (asset details, depreciation amounts, NBV)
- Trial Balance (consolidated, by ledger, by segment)
- Subledger Accounting Extract (journal lines, accounting events)

**Produces per Interface:**
- BIP Report Definition (data model, SQL query, parameters, output format)
- Scheduling Configuration (ESS job schedule, frequency, retry on failure)
- File Delivery Spec (format: CSV/XML/JSON, naming convention, delivery: SFTP/UCM/REST)
- Reconciliation Queries (source count/amount vs extract count/amount)

### Agent 4: Middleware Configurator
**ID:** `middleware-configurator`
**Triggers:** User discusses OIC, middleware, API endpoints, connection configuration

Configures OIC connections, REST adapters, SOAP endpoints, error handling, retry logic.

**Produces:**
- OIC Flow Designs (trigger → map → invoke → response → error handler)
- Connection Specifications (endpoint URL, authentication, timeout, retry count)
- Error Handling Matrix (error code → classification → action → notification)
- Retry Logic Configuration (max retries, backoff strategy, circuit breaker thresholds)
- Logging & Monitoring Config (payload logging, correlation IDs, alert rules)

**Error Classification:**
| Category | Examples | Action |
|---|---|---|
| Transient | Timeout, 503, network blip | Auto-retry with exponential backoff |
| Data Validation | Missing field, invalid format | Route to error queue, notify, manual fix |
| Authentication | 401, 403, expired token | Refresh token, re-authenticate, alert |
| Business Rule | Duplicate record, closed period | Log, notify functional team, manual review |
| System | 500, ORA-errors, memory | Alert ops team, circuit breaker, failover |

### Agent 5: Integration Test Agent
**ID:** `integration-test-agent`
**Triggers:** User discusses integration testing, smoke tests, volume testing, error recovery testing

Creates and executes integration test scenarios: positive/negative, volume, error recovery.

**Produces:**
- Test Scenarios (positive, negative, boundary, volume, error recovery)
- Test Data (per scenario, with expected results)
- Execution Results (pass/fail, response times, error messages)
- Defect Log (failed tests with root cause, severity, resolution)

**Test Categories:**
1. Connectivity Tests — verify endpoints, authentication, SSL
2. Positive Flow Tests — happy path with valid data
3. Negative Flow Tests — invalid data, missing fields, duplicate records
4. Boundary Tests — max field lengths, zero amounts, special characters
5. Volume Tests — 1K, 10K, 100K records, measure throughput
6. Error Recovery Tests — simulate failures, verify retry, verify alerts
7. End-to-End Tests — full chain: source → middleware → Oracle → validation

---

## Full Agentic Workflow

```
STAGE 1 → Integration Discovery & Architecture (Agent 1) → GATE 1
  Gate criteria: Interface catalog approved, architecture signed off

STAGE 2 → Interface Design (per interface, Agents 2+3 parallel) → GATE 2
  Gate criteria: All field mappings complete, transformation rules documented

STAGE 3 → Inbound Build (Agent 2) + Outbound Build (Agent 3) parallel → GATE 3
  Gate criteria: All FBDI templates validated, BIP reports tested in DEV

STAGE 4 → Middleware Configuration (Agent 4) → GATE 4
  Gate criteria: All OIC flows deployed, error handling verified

STAGE 5 → Integration Testing (Agent 5) → GATE 5
  Gate criteria: >95% test pass rate, all P1/P2 defects resolved

STAGE 6 → UAT + Production Deployment → GATE 6
  Gate criteria: UAT sign-off, cutover plan approved, monitoring in place
```

---

## Effort Estimates

| Stage | Traditional | VOLT | Saving |
|---|---|---|---|
| Integration Architecture | 40h | 8h | 80% |
| Interface Design (10 interfaces) | 80h | 16h | 80% |
| Inbound Build | 120h | 24h | 80% |
| Outbound Build | 80h | 16h | 80% |
| Middleware Config | 60h | 12h | 80% |
| Integration Testing | 80h | 16h | 80% |
| **TOTAL** | **460h** | **92h** | **80%** |
