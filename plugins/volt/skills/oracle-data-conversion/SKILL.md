---
name: oracle-data-conversion-agent
description: >
  This skill activates when the user discusses Oracle ERP data conversion,
  FBDI workbook creation, data migration, data conversion strategy, data
  conversion specification, GL balance migration, open items migration,
  fixed assets migration, COA mapping, legacy data extraction, data profiling,
  mock conversion cycles, cutover data, conversion reconciliation, data
  validation, FBDI upload, ESS job monitoring, or any Oracle Finance
  Transformation data conversion activity. Also activates for Oracle
  Cloud, ERP go-live data readiness, and conversion mock cycle orchestration.
version: 2.0.0
disable-model-invocation: true
---

# Oracle Data Conversion Agent

A complete agentic framework for Oracle Finance Transformation data conversion.
Covers document validation, FBDI build, automated validation loops, mock cycle
orchestration, reconciliation, and continuous harness execution — from legacy
extract through production load.

---

## When to Use This Skill

Activate this skill when:
- Reviewing or creating a **Data Conversion Strategy Document**
- Reviewing or creating a **Data Conversion Specification Document**
- Building FBDI workbooks for GL Balances, Open AP, Open AR, or Fixed Assets
- Running validation on conversion workbooks
- Orchestrating Mock 1 / Mock 2-SIT / Mock 3-UAT / Production load cycles
- Reconciling source totals against Oracle-loaded balances
- Setting up automated nightly conversion validation runs
- Profiling legacy data extracts for quality and completeness

---

## What This Skill Does

1. **Validates** Data Conversion Strategy and Specification documents against a
   required-section checklist and cross-document consistency rules
2. **Profiles** legacy data extracts: row counts, null rates, format anomalies,
   unmapped values
3. **Builds** FBDI workbooks for all in-scope conversion objects in parallel
4. **Loops** the validate → auto-fix → re-validate cycle until error count = 0
5. **Orchestrates** 3 mock cycles with human checkpoints and issue logs
6. **Reconciles** source totals vs Oracle-loaded balances using SQL queries
7. **Runs continuously** via Claude Code harness hooks and cron schedules

---

## Agent Definitions

Six specialist agents handle distinct stages. Each agent receives a typed
artifact from the prior stage and produces a typed artifact for the next.

### Agent 1: Conversion Strategy Reviewer
**ID:** `conversion-strategy-reviewer`
**Triggers:** User uploads or references a Data Conversion Strategy document

Returns structured JSON validation with section_status, critical_gaps, warnings, overall_status.

**Required Document Sections Checklist:**
1. Executive Summary (purpose, scope, go-live date, risk statement)
2. Conversion Object Inventory (GL Balances, Open AP/AR, Fixed Assets, Customers, Suppliers)
3. Approach & Methodology (Big Bang vs Phased, extraction method, FBDI versions)
4. Cut-off Rules (accounting period, age threshold, currency translation, partial invoices)
5. Mock Cycle Plan (minimum 3 cycles, schedule, go/no-go criteria)
6. Roles & Responsibilities RACI
7. Data Quality Rules (mandatory fields, null thresholds, duplicates, numeric tolerance)
8. Reconciliation Approach (source-to-target, DR=CR, sub-ledger tie-out)
9. Cutover Dependency Map
10. Risks & Mitigation (minimum 5 risks)

### Agent 2: Conversion Spec Validator
**ID:** `conversion-spec-validator`
Per-object validation of field mappings, COA segment mapping, data types, FBDI compliance.

### Agent 3: Data Profiling Agent
**ID:** `data-profiling-agent`
Profiles every field: record_count, null_pct, distinct_count, format_sample, anomalies, fbdi_readiness.

### Agent 4: Validation Loop Agent
**ID:** `validation-loop-agent`
Automated validate → auto-fix → re-validate loop (max 3 iterations).
Auto-fix rules: MAX_LENGTH_EXCEEDED, DUPLICATE_KEY, MISSING_REQUIRED_FIELD, INVALID_NUMERIC, INVALID_DATE_FORMAT.
Never auto-fixes: wrong account code, wrong currency, negative balances, missing legal entity.

### Agents 5a-5d: FBDI Build Agents (Parallel)
- 5a: GL Balance FBDI (`oracle-gl-specialist`)
- 5b: Open AP FBDI (`oracle-ap-specialist`)
- 5c: Open AR FBDI (`oracle-ar-specialist`)
- 5d: Fixed Assets FBDI (`oracle-fa-specialist`)

### Agent 6: Mock Cycle Orchestrator
**ID:** `mock-cycle-orchestrator`
Manages Mock 1 → Mock 2/SIT → Mock 3/UAT → Production with gate criteria:
- Mock 1: >80% load success, <5% variance
- Mock 2: >95% load success, <1% variance
- Mock 3: >99% load success, <$100 variance
- Production: 100% success, $0 variance

### Agent 7: Reconciliation Agent
**ID:** `reconciliation-agent`
Post-load reconciliation: GL queries, DR=CR check, sub-ledger tie-out, sign-off report.

---

## Full Agentic Workflow

```
STAGE 1 → Document Validation (Agents 1+2 parallel) → GATE 1
STAGE 2 → Data Profiling (Agent 3) → GATE 2
STAGE 3 → COA Mapping → GATE 3
STAGE 4 → FBDI Build (Agents 5a-5d parallel)
STAGE 5 → Validation Loop (Agent 4, automated)
STAGE 6a → Mock 1 → GATE 4
STAGE 6b → Mock 2/SIT → GATE 5
STAGE 6c → Mock 3/UAT → GATE 6
STAGE 7 → Production Load + Reconciliation → GATE 7 (Controller sign-off)
```

## Effort Estimates

| Stage | Traditional | VOLT | Saving |
|---|---|---|---|
| Doc Validation | 16h | 1h | 94% |
| Data Profiling | 24h | 0.5h | 98% |
| COA Mapping | 60-80h | 8h | 87% |
| FBDI Build x4 | 80-120h | 2h | 97% |
| Validation Loop | 40h | 0h | 100% |
| Mock 1 | 40h | 4h | 90% |
| Mock 2/SIT | 40h | 3h | 93% |
| Mock 3/UAT | 40h | 3h | 93% |
| Reconciliation | 24h | 1h | 96% |
| **TOTAL** | **364-384h** | **~23h** | **~94%** |
