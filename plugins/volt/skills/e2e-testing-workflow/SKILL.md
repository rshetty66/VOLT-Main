---
name: e2e-testing-workflow-agent
description: >
  Activates for end-to-end testing workflows covering process flows, requirements
  traceability, user scenarios, user stories, configuration scripts, test scenarios,
  test scripts, test data generation, MCP-enabled automated testing, test execution,
  result capture, defect management, and test validation. Covers SIT, UAT, regression,
  performance, and production validation testing.
version: 1.0.0
disable-model-invocation: true
---

# E2E Testing Workflow Agent

Complete framework for end-to-end ERP testing — from process flows through
automated test execution and result validation. Covers the full chain:
Process Flow → Requirements → User Scenarios → User Stories → Config Scripts →
Test Scenarios → Test Scripts → Test Data → Automated Testing → Results → Validation.

---

## When to Use

Activate this skill when:
- Creating test strategy and test plans
- Generating test scenarios from process flows
- Creating user stories and acceptance criteria
- Building configuration test scripts
- Generating test data
- Running MCP-enabled automated tests against Oracle/SAP
- Capturing and analyzing test results
- Managing defects and retesting

---

## What This Skill Does

1. **Analyzes** process flow diagrams to extract decision points, exception paths, and integration touchpoints
2. **Extracts** requirements and builds a full Requirements Traceability Matrix (RTM)
3. **Generates** end-to-end user scenarios covering happy path, exception paths, and edge cases
4. **Creates** user stories with acceptance criteria, story points, and dependency mapping
5. **Builds** step-by-step configuration scripts with validation checks
6. **Designs** test scenarios (positive, negative, integration, regression, volume)
7. **Creates** executable test scripts with exact field values and expected results
8. **Generates** test data sets for master data, transactional data, and edge cases
9. **Runs** MCP-enabled automated tests against Oracle/SAP/Workday
10. **Validates** results, captures defects, and produces go/no-go recommendations

---

## The Full Testing Chain

### Step 1: Process Flow Analysis
**Agent:** `process-flow-analyzer`
**Triggers:** User uploads or references process flow diagrams (Visio, BPMN, or text descriptions)

**Input:** Process flow diagrams (Visio, BPMN, or text descriptions)
**Output:** Structured process decomposition with:
- Process hierarchy (L0 → L1 → L2 → L3)
- Decision points and branching logic
- Exception paths and error handling
- Integration touchpoints (cross-module, cross-system)
- Manual vs automated steps
- Swim lanes (roles/systems responsible)

### Step 2: Requirements Extraction
**Agent:** `requirements-extractor`
**Triggers:** User discusses requirements, RTM, or traceability

**Input:** Process flows + design documents
**Output:** Requirements Traceability Matrix (RTM) with:
- Requirement ID, Description, Priority (P1/P2/P3)
- Source (process flow step, design document section)
- Linked Test Scenario IDs
- Linked Test Script IDs
- Status (Draft, Reviewed, Approved, Tested, Passed)
- Coverage percentage per requirement

### Step 3: User Scenario Generation
**Agent:** `user-scenario-generator`
**Triggers:** User discusses user scenarios, business scenarios, or end-to-end flows

**Input:** Requirements + process flows
**Output:** End-to-end user scenarios covering:
- Happy path (standard business flow)
- Exception paths (approvals, rejections, escalations)
- Edge cases (boundary values, special characters, multi-currency)
- Cross-module scenarios (P2P, O2C, R2R)
- Cross-system scenarios (Oracle <-> bank, Oracle <-> payroll)

**Format per Scenario:**
| Field | Description |
|---|---|
| Scenario ID | US-[Module]-[Seq] (e.g., US-AP-001) |
| Title | Descriptive name |
| Preconditions | System state, master data, configuration required |
| Steps | Numbered sequence of business actions |
| Expected Result | Final business outcome |
| Data Requirements | Specific data needed (amounts, dates, entities) |
| Integration Points | Systems/modules involved |

### Step 4: User Story Creation
**Agent:** `user-story-creator`
**Triggers:** User discusses user stories, acceptance criteria, or sprint planning

**Input:** User scenarios + requirements
**Output:** User stories in standard format:
- **As a** [role], **I want to** [action], **So that** [benefit]
- Acceptance criteria (Given/When/Then format)
- Story points estimate (Fibonacci: 1, 2, 3, 5, 8, 13)
- Dependency mapping (blocked-by, enables)
- Module classification (GL, AP, AR, FA, CM, PO)

### Step 5: Configuration Script Generation
**Agent:** `config-script-generator`
**Triggers:** User discusses configuration, setup scripts, or Oracle/SAP config

**Input:** Design decisions + Oracle/SAP configuration specs
**Output:** Step-by-step configuration scripts with:
- Screenshot placeholders (marked [SCREENSHOT: description])
- Validation checks at each major step
- Rollback instructions if validation fails

**Format per Script:**
| Field | Description |
|---|---|
| Script ID | CFG-[Module]-[Seq] (e.g., CFG-AP-001) |
| Module | GL, AP, AR, FA, CM, PO, TAX |
| Config Area | Lookup, Profile Option, Flexfield, Rule, Setup |
| Navigation | Full Oracle path (Setup and Maintenance → ...) |
| Steps | Numbered with exact field values to enter |
| Expected Result | What the system should show after configuration |
| Validation | How to verify the config took effect |

### Step 6: Test Scenario Design
**Agent:** `test-scenario-designer`
**Triggers:** User discusses test scenarios, test cases, or test planning

**Input:** User scenarios + configuration scripts + RTM
**Output:** Test scenarios with:
- Positive tests (happy path with valid data)
- Negative tests (invalid data, missing fields, boundary values)
- Integration tests (cross-module, cross-system data flow)
- Regression tests (impact of config changes on existing functionality)
- Volume/performance tests (bulk processing, concurrent users)

**Format per Test Case:**
| Field | Description |
|---|---|
| TC-ID | TC-[Type]-[Module]-[Seq] (e.g., TC-POS-AP-001) |
| Scenario | Description of what is being tested |
| Type | Positive, Negative, Integration, Regression, Volume |
| Priority | P1 (Critical), P2 (High), P3 (Medium), P4 (Low) |
| Preconditions | Required system state, data, configuration |
| Steps | Numbered test actions |
| Expected Result | Specific expected system behavior |
| RTM Link | Linked requirement IDs |

### Step 7: Test Script Creation
**Agent:** `test-script-builder`
**Triggers:** User discusses test scripts, executable tests, or test execution steps

**Input:** Test scenarios
**Output:** Detailed executable test scripts with:
- Step-by-step navigation instructions (exact Oracle/SAP paths)
- Exact field values to enter (no ambiguity)
- Expected system responses at each step
- Pass/fail criteria per step
- Screenshot capture points (marked [CAPTURE: description])
- Data dependencies (what must exist before this script runs)

### Step 8: Test Data Generation
**Agent:** `test-data-generator`
**Triggers:** User discusses test data, data generation, or FBDI test files

**Input:** Test scripts + data requirements + Oracle/SAP schema
**Output:** Test data sets:
- **Master data** — customers, vendors, items, employees, chart of accounts
- **Transactional data** — invoices, POs, journal entries, payments, receipts
- **Edge case data** — max field lengths, special characters, multi-currency, zero amounts
- **Volume test data** — 1,000+ records for performance testing
- **Negative test data** — invalid dates, duplicate keys, orphan references

**Format:** CSV/Excel files ready for FBDI upload or direct entry, with:
- Column headers matching FBDI template or screen fields
- Data dictionary (field name, type, valid values, generation rule)
- Cross-reference sheet (linking test data to test scripts)

### Step 9: MCP-Enabled Automated Testing
**Agent:** `automated-test-runner`
**Triggers:** User discusses automated testing, MCP testing, or test execution

**Input:** Test scripts + test data + MCP server connections
**Output:** Automated test execution using MCP tools:
- **Oracle ERP MCP:** Create transactions, validate configurations, check balances, run reports
- **SAP S/4HANA MCP:** Post documents, verify material masters, check accounting entries
- **Workday MCP:** Create workers, run payroll, verify HCM data

**Execution Flow per Test:**
1. Set up preconditions (create/verify master data via MCP)
2. Execute test steps (call MCP tools for each action)
3. Capture system response at each step
4. Compare actual vs expected results
5. Log pass/fail with evidence (screenshots, API responses)
6. Clean up test data if required

### Step 10: Test Result Capture & Validation
**Agent:** `test-result-validator`
**Triggers:** User discusses test results, defect analysis, or go/no-go decisions

**Input:** Automated test execution results
**Output:**
- **Test Execution Report** — pass/fail per test case, execution duration, defect links
- **Defect Log** — failed tests with root cause analysis, severity, priority, assigned-to
- **Coverage Report** — % of requirements covered, % of test cases executed, % passed
- **Regression Impact Analysis** — which areas affected by fixes, retest scope
- **Go/No-Go Recommendation** — based on pass rate, open defects, risk assessment

**Go/No-Go Criteria:**
| Metric | SIT Gate | UAT Gate | Production Gate |
|---|---|---|---|
| P1 Defects Open | 0 | 0 | 0 |
| P2 Defects Open | ≤3 | 0 | 0 |
| Test Pass Rate | ≥90% | ≥95% | ≥99% |
| Requirements Coverage | ≥85% | ≥95% | 100% |
| Integration Tests Passed | ≥80% | ≥95% | 100% |

---

## Full Agentic Workflow

```
STAGE 1  → Process Flow Analysis (Agent: process-flow-analyzer) → GATE 1
  Gate: Process decomposition reviewed, all paths identified

STAGE 2  → Requirements Extraction (Agent: requirements-extractor) → GATE 2
  Gate: RTM complete, all requirements traced to process steps

STAGE 3  → User Scenario Generation (Agent: user-scenario-generator) → GATE 3
  Gate: Scenarios cover happy path + exceptions + edge cases

STAGE 4  → User Story Creation (Agent: user-story-creator) → GATE 4
  Gate: Stories with acceptance criteria approved by product owner

STAGE 5  → Config Script Generation (Agent: config-script-generator) → GATE 5
  Gate: Config scripts reviewed by functional lead

STAGE 6  → Test Scenario Design (Agent: test-scenario-designer) → GATE 6
  Gate: Test scenarios mapped to RTM, coverage ≥ 95%

STAGE 7  → Test Script Creation (Agent: test-script-builder) → GATE 7
  Gate: Test scripts executable, peer reviewed

STAGE 8  → Test Data Generation (Agent: test-data-generator) → GATE 8
  Gate: Test data complete, loaded to test environment

STAGE 9  → MCP Automated Testing (Agent: automated-test-runner) → GATE 9
  Gate: All automated tests executed, results captured

STAGE 10 → Result Validation (Agent: test-result-validator) → GATE 10
  Gate: Go/No-Go recommendation issued

RETEST   → Defect Fix → Retest (loop back to Stage 9) → GATE 10 (re-evaluate)
```

---

## Effort Estimates

| Stage | Traditional | VOLT | Saving |
|---|---|---|---|
| Process Flow Analysis | 20h | 4h | 80% |
| Requirements/RTM | 40h | 8h | 80% |
| User Scenarios | 30h | 6h | 80% |
| User Stories | 20h | 4h | 80% |
| Config Scripts | 60h | 12h | 80% |
| Test Scenarios | 40h | 8h | 80% |
| Test Scripts | 60h | 12h | 80% |
| Test Data | 30h | 4h | 87% |
| Automated Testing | 40h | 4h | 90% |
| Result Validation | 20h | 2h | 90% |
| **TOTAL** | **360h** | **64h** | **82%** |
