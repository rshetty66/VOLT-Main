---
name: reconciliation-agent
description: >
  Autonomous Reconciliation Agent for financial services. Connects to Oracle ERP Cloud GL
  and subledgers via MCP to perform automated GL-to-subledger matching, flag exceptions,
  classify variances, and produce reconciliation reports with recommended actions.
  Activates when users ask about "reconciliation", "GL reconciliation", "account reconciliation",
  "subledger reconciliation", "bank reconciliation", "intercompany reconciliation",
  "balance sheet reconciliation", "nostro reconciliation", "vostro reconciliation",
  "suspense account", "clearing account", "exception management",
  "rec matching", "tolerance matching", "one-to-many matching",
  "Oracle ARCS", "Account Reconciliation Cloud", "reconciliation automation",
  "claims reconciliation", "premium reconciliation", "IFRS 17 reconciliation",
  "CSM reconciliation", "investment reconciliation", "custody reconciliation",
  "reinsurance reconciliation", "reserve reconciliation", "IBNR reconciliation",
  "loan reconciliation", "deposit reconciliation", "derivative reconciliation",
  "AUM reconciliation", "NAV reconciliation", "fund accounting reconciliation",
  "pension asset reconciliation", "actuarial liability reconciliation",
  "unreconciled items", "stale items", "aged exceptions",
  "reconciliation dashboard", "rec status", "close task",
  or any reconciliation, matching, exception, or close process question.
version: 1.0.0
---

# Reconciliation Agent — Autonomous GL-to-Source Matching Intelligence

## Agent Overview

An autonomous agent that connects to Oracle ERP Cloud GL and subledger systems via MCP protocol,
extracts balances from both sides, applies configurable matching rules, classifies exceptions,
recommends corrective actions, and produces reconciliation reports with sign-off workflows.

---

## Agent Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│              RECONCILIATION AGENT WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STEP 1: EXTRACT GL BALANCES                                         │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ oracle_erp MCP:                                             │     │
│  │   run_sql_query(GL trial balance: entity, account, period) │     │
│  │   run_sql_query(GL detail: journals posted to account)     │     │
│  │   browse_schema(GL_BALANCES, GL_JE_LINES)                  │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 2: EXTRACT SUBLEDGER / SOURCE BALANCES                         │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ oracle_erp MCP:                                             │     │
│  │   run_sql_query(AP subledger totals by vendor)             │     │
│  │   run_sql_query(AR subledger totals by customer)           │     │
│  │   run_sql_query(FA subledger net book value)               │     │
│  │   read_workbook(external source file if applicable)        │     │
│  │ oracle_epm MCP:                                             │     │
│  │   get_reconciliation_status(account, period)               │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 3: MATCH                                                       │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Apply matching rules (configurable per rec type):           │     │
│  │   Rule 1: Exact match (amount + entity + period)           │     │
│  │   Rule 2: Tolerance match (±$X threshold)                  │     │
│  │   Rule 3: One-to-many (batch/aggregate matching)           │     │
│  │   Rule 4: Many-to-many (clearing/netting)                  │     │
│  │   Rule 5: Pattern match (systematic differences)           │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 4: FLAG EXCEPTIONS                                             │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Unmatched items classified by severity:                     │     │
│  │   Critical: > Materiality threshold                        │     │
│  │   High: > 50% of materiality OR aged > 60 days            │     │
│  │   Medium: > 25% of materiality OR aged > 30 days          │     │
│  │   Low: Within tolerance but requires documentation         │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 5: CLASSIFY EXCEPTIONS                                         │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Exception Type:                                             │     │
│  │   T = Timing difference (will clear next period)           │     │
│  │   E = Error (incorrect posting, wrong account)             │     │
│  │   U = Unrecorded item (missing entry in GL or source)      │     │
│  │   C = Cutoff issue (transaction in wrong period)           │     │
│  │   R = Reclassification needed                              │     │
│  │   S = Stale item (aged > policy threshold, needs action)   │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 6: RECOMMEND ACTIONS                                           │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ For each exception:                                         │     │
│  │   • Proposed journal entry (account, amount, description)  │     │
│  │   • Write-off recommendation (if policy allows)            │     │
│  │   • Escalation to business owner                           │     │
│  │   • Documentation requirement for sign-off                 │     │
│  │   → Feeds into Journal Entry Agent for posting             │     │
│  └────────────────────────────────────────────────────────────┘     │
│                          │                                           │
│                                                                     │
│  STEP 7: REPORT                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │ Reconciliation output:                                      │     │
│  │   • Summary: Matched %, exception count, risk score        │     │
│  │   • Exception detail with classification + action          │     │
│  │   • Trend analysis (improving/worsening vs prior periods)  │     │
│  │   • Sign-off status and certification readiness            │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## MCP Tool Invocations

| Step | MCP Server | Tool | Parameters | Purpose |
|------|-----------|------|------------|---------|
| Extract GL | oracle_erp | `run_sql_query` | SQL: GL_BALANCES by entity/account/period | Get GL trial balance |
| Extract GL | oracle_erp | `run_sql_query` | SQL: GL_JE_LINES for detail transactions | Get journal line detail |
| Extract Sub | oracle_erp | `run_sql_query` | SQL: AP/AR/FA subledger aggregates | Get subledger totals |
| Extract Sub | oracle_erp | `browse_schema` | table_name for column discovery | Understand available data |
| Extract Ext | oracle_erp | `read_workbook` | path to external source file | Import non-ERP sources |
| Status | oracle_epm | `get_reconciliation_status` | account, entity, period | Check ARCS rec status |
| Validate | oracle_erp | `run_sql_query` | SQL: cross-entity elimination check | Verify ICO eliminations |
| Post Fix | oracle_erp | `upload_fbdi` | journal correction CSV | Post correcting entry |

---

## Industry-Specific Reconciliation Types

### 1. Banking Reconciliations

#### Nostro / Vostro (Correspondent Banking)

```
NOSTRO RECONCILIATION:
  GL Side: Nostro account balance (our record of our account at their bank)
  Source Side: Correspondent bank statement (their record of our account)

  MATCHING RULES:
    • Exact match: Transaction ref + amount + value date
    • Tolerance: ±$0.01 (FX rounding on multi-currency)
    • Pattern: Systematic 1-day timing on wire settlements

  COMMON EXCEPTIONS:
    • Unmatched debits on statement (bank charges not booked)
    • GL entries with no statement match (in-transit items)
    • Value date differences (T+0 vs T+1 settlement)

  RISK: Fraudulent transactions hidden in unreconciled balance
  POLICY: Must clear within 5 business days; >$1M escalate immediately
```

#### Loan Portfolio Reconciliation

```
LOAN RECONCILIATION:
  GL Side: GL 1200 (Loans and Advances to Customers) + GL 1210 (Accrued Interest)
  Source Side: Loan servicing system (principal balance + accrued interest)

  MATCHING RULES:
    • Aggregate match: Total GL balance = Sum of all loan contracts
    • Segment match: By product type (mortgage, commercial, consumer)
    • Interest accrual: GL accrued interest = System calculated accrual

  COMMON EXCEPTIONS:
    • Write-off timing (approved but not posted to GL)
    • Fee amortization difference (EIR vs straight-line)
    • Stage reclassification (IFRS 9 provision impact on gross balance)
    • Securitized loan derecognition (still on GL but should be off-book)
```

#### Derivative / Trading Book

```
DERIVATIVE RECONCILIATION:
  GL Side: GL 1400 (Derivative Assets) / GL 2400 (Derivative Liabilities)
  Source Side: Trading system (mark-to-market valuations)

  MATCHING RULES:
    • Trade-by-trade: MTM per deal ID
    • Aggregate: Total derivative asset/liability vs GL
    • Margin: Collateral posted vs variation margin calls

  COMMON EXCEPTIONS:
    • Valuation model differences (front office vs finance)
    • CSA threshold / netting agreement mismatch
    • Day-1 P&L on new trades (timing of GL recognition)
    • CVA/DVA/FVA adjustments not reflected in GL

  FREQUENCY: Daily (trading book), Weekly (banking book hedges)
```

### 2. Insurance Reconciliations

#### Premium Reconciliation

```
PREMIUM RECONCILIATION:
  GL Side: Written Premium (GL 4100) → Unearned Premium Reserve (GL 2050) → Earned Premium (GL 4200)
  Source Side: Policy administration system (GWP by policy, earning schedule)

  MATCHING RULES:
    • GWP: GL written premium = Policy system GWP (by product, by month of binding)
    • UPR: GL unearned reserve = Policy system UPR schedule (1/365th daily earning)
    • Earned: GL earned premium = GWP - ΔUPR (earning pattern validation)
    • Receivable: GL premium receivable = Policy system outstanding billing

  COMMON EXCEPTIONS:
    • Policy cancellation not reflected in GL (mid-term cancellation, return premium)
    • Earning pattern mismatch (even vs risk-adjusted earning)
    • Multi-year policies: allocation across accounting periods
    • Broker commission netting vs gross presentation
    • Premium tax accrual timing
```

#### Claims Reserve Reconciliation

```
CLAIMS RESERVE RECONCILIATION:
  GL Side: Case Reserves (GL 2100) + IBNR (GL 2200) + ALAE (GL 2210)
  Source Side: Claims system (case reserves by claim) + Actuarial (IBNR triangles)

  MATCHING RULES:
    • Case reserves: GL aggregate = Sum of open claim case reserves
    • IBNR: GL balance = Actuarial IBNR calculation (quarterly update)
    • ALAE: GL = Actuarial allocated loss adjustment expense estimate
    • Total: GL 2100+2200+2210 = Actuarial ultimate less paid-to-date

  COMMON EXCEPTIONS:
    • Stale case reserves (no activity > 12 months, needs review)
    • IBNR update timing (actuarial complete but GL not posted)
    • Bulk reserve adjustments pending approval
    • Reinsurance recoverable not updated to match gross
    • Salvage/subrogation receivable recognition timing

  FREQUENCY: Monthly (case), Quarterly (IBNR/ALAE)
  MATERIALITY: ±2% of net earned premium
```

#### Reinsurance Reconciliation

```
REINSURANCE RECONCILIATION:
  GL Side: Reinsurance Recoverable (GL 1350) + Ceded Reserves (GL 2150)
  Source Side: Reinsurance admin system + Treaty terms + Reinsurer statements

  MATCHING RULES:
    • By treaty: GL ceded balance per treaty = Treaty admin system balance
    • By reinsurer: Total recoverable per counterparty = Reinsurer statement
    • Sliding scale: Provisional vs final commission adjustment
    • Profit commission: Accrual vs actual (experience-rated treaties)

  COMMON EXCEPTIONS:
    • Treaty bordereau timing (claims reported to reinsurer)
    • Sliding scale commission adjustment (loss ratio driven)
    • Commutation or treaty restructuring
    • Bad debt provision on reinsurance recoverable
```

#### IFRS 17 CSM Reconciliation

```
CSM RECONCILIATION:
  GL Side: Contractual Service Margin (GL 2500) + Loss Component (GL 2510)
  Source Side: IFRS 17 calculation engine (CSM roll-forward output)

  ROLL-FORWARD RECONCILIATION:
    Opening CSM (GL)
    + New business CSM (initial recognition)
    - CSM released to P&L (coverage units amortization)
    + Interest accretion (locked-in discount rate)
    ± Changes in estimates relating to future service
    - Losses recognized immediately (onerous contracts)
    ± FX on CSM (foreign currency groups)
    = Closing CSM (must match GL 2500)

  COMMON EXCEPTIONS:
    • Coverage unit methodology difference (engine vs GL allocation)
    • Locked-in rate vs current rate discrepancy
    • Group aggregation level (portfolio → group → unit of account)
    • Transition adjustments still unwinding

  MATERIALITY: $500K per group of contracts
  FREQUENCY: Quarterly (full), Monthly (roll-forward estimate)
```

#### Investment Portfolio Reconciliation

```
INVESTMENT RECONCILIATION:
  GL Side: Investments at FV (GL 1500-1599) + Accrued Income (GL 1310) +
           FVOCI Reserve (GL 3200) + Impairment (GL 6200)
  Source Side: Investment system / Custodian (positions, market values, income)

  MATCHING RULES:
    • Position: GL units/par = Custodian units/par (by ISIN/CUSIP)
    • Market Value: GL carrying amount = Custodian NAV / market price
    • Accrued Income: GL accrual = System-calculated accrued coupon/dividend
    • FV Reserve: GL OCI = Cumulative unrealized gain/loss per accounting policy

  COMMON EXCEPTIONS:
    • Trade date vs settlement date (T+1/T+2 pending settlement)
    • Corporate action not processed (stock split, bonus, merger)
    • FX revaluation timing (spot rate difference)
    • Impairment trigger not yet reflected in GL
    • Fund NAV vs look-through valuation (level 3 fair value)

  FREQUENCY: Daily (liquid markets), Monthly (alternatives, PE, RE)
```

### 3. Credit Union Reconciliations

```
CREDIT UNION SPECIFIC:
  Member Deposit Reconciliation:
    GL 2010 (Member Deposits) = Core banking total member deposit balances
    Exception types: dormant account interest, term deposit maturity processing

  Member Loan Reconciliation:
    GL 1200 (Member Loans) = Loan system total outstanding principal
    Exception types: partial payment allocation, delinquency staging

  Shared Branching / ATM Network:
    GL 1150 (Due from Networks) = Network settlement reports
    Timing: T+1 or T+2 settlement creates systematic timing differences

  CUCO Central Deposits:
    GL 1100 (Deposits at Central) = Central CU confirmation
    Daily settlement, statutory liquidity requirement compliance
```

### 4. Asset Management Reconciliations

```
ASSET MANAGEMENT:
  NAV Reconciliation:
    GL Fund NAV = Fund accounting system NAV = Transfer agent NAV
    Tolerance: $0.001 per unit (penny rounding)

  AUM Reconciliation:
    Internal AUM tracking = Custodian reports = Client statements
    Differences from: pending trades, corporate actions, FX rates used

  Fee Reconciliation:
    GL Fee Revenue = Fee calculation engine output = Client billing
    Sources of difference: accrual methodology, performance fee crystallization timing

  Cash Reconciliation:
    GL Fund Cash = Custodian cash balance
    Common issues: dividend/coupon receipt timing, redemption payment timing
```

### 5. Pension Fund Reconciliations

```
PENSION FUND:
  Asset Reconciliation:
    GL Investment Assets = Custodian + Investment managers
    Special: Alternative assets (PE, RE) with lagged NAV (90 days)

  Liability Reconciliation:
    GL Pension Obligation = Actuarial valuation output
    Frequency: Annual (full actuarial), Quarterly (roll-forward)

  Contribution Reconciliation:
    GL Contributions Received = Employer remittance + Employee deductions
    Compliance: Must match payroll records within N days

  Benefit Payment Reconciliation:
    GL Benefits Paid = Pension payroll system
    Monthly payment run vs GL posting
```

---

## Matching Engine Configuration

### Rule Priority and Cascade

```
MATCHING CASCADE (applies rules in order until matched):

Priority 1: EXACT MATCH
  • Same amount (to the cent)
  • Same reference number / transaction ID
  • Same date (value date or posting date within 0 days)
  → Auto-matched, no review needed

Priority 2: REFERENCE MATCH
  • Same reference / PO / invoice number
  • Amount within tolerance (±$X or ±Y%)
  • Date within tolerance (±N days)
  → Auto-matched with documentation

Priority 3: AMOUNT MATCH
  • Same amount (exact) but different reference
  • Within date tolerance
  → Suggested match, requires analyst confirmation

Priority 4: ONE-TO-MANY
  • One GL entry = Sum of multiple source items
  • Batch posting vs individual transactions
  → Suggested group match, requires review

Priority 5: MANY-TO-MANY
  • Clearing/netting: Multiple items on both sides net to zero
  → Complex match, requires senior review

UNMATCHED: Items failing all priority levels → Exception queue
```

### Tolerance Configuration

| Rec Type | $ Tolerance | % Tolerance | Date Tolerance | Aging Threshold |
|----------|-------------|-------------|----------------|-----------------|
| Nostro/Vostro | $100 | 0.01% | 2 days | 5 days |
| Loan Portfolio | $1,000 | 0.1% | 0 days | 30 days |
| Premium (Insurance) | $5,000 | 0.5% | 5 days | 45 days |
| Claims Reserves | $10,000 | 2.0% | N/A (quarterly) | 90 days |
| IFRS 17 CSM | $500,000 | 1.0% | N/A (quarterly) | 90 days |
| Investment Portfolio | $1,000 | 0.01% | 2 days | 10 days |
| Intercompany | $0 | 0% | 0 days | 30 days |
| AP/AR | $500 | 0.5% | 3 days | 60 days |

---

## Exception Management

### Exception Lifecycle

```
EXCEPTION STATUS FLOW:
  NEW → ASSIGNED → IN PROGRESS → RESOLVED → CERTIFIED
                                     │
                                     ├── Resolution: Journal entry posted
                                     ├── Resolution: Timing — will clear
                                     ├── Resolution: Write-off (approved)
                                     └── Resolution: Documented explanation

ESCALATION:
  > 30 days open: Notify controller
  > 60 days open: Escalate to CFO
  > 90 days open: Audit committee visibility
  > Materiality: Immediate escalation regardless of age
```

### Automated Resolution Patterns

| Exception Pattern | Auto-Resolution | Confidence |
|-------------------|-----------------|------------|
| Systematic 1-day timing (nostro) | Mark as "timing, will clear T+1" | 95% |
| Bank charges under $100 | Auto-create expense journal | 90% |
| FX rounding < $10 | Auto-create rounding adjustment | 98% |
| Month-end accrual reversal | Match to reversal in next period | 85% |
| Batch posting total = sum of items | Auto-match one-to-many | 92% |
| Prior-period reclassification | Identify source and flag for review | 75% |

---

## Report Output

### Reconciliation Summary Dashboard

| Metric | Target | Calculation |
|--------|--------|------------|
| Match Rate | >98% | Matched items / Total items |
| Exception Value | <1% of balance | Total unmatched $ / Total balance |
| Aged Exceptions | 0 over 90 days | Count of items aged >90 days |
| Auto-Resolution Rate | >80% | Auto-resolved / Total exceptions |
| Certification Status | 100% by T+5 | Certified recs / Total recs |
| Trend | Improving | Current period vs prior 3 periods |

### Output Format

```json
{
  "reconciliation_id": "REC-2026-Q1-001",
  "rec_type": "Premium-to-GL",
  "entity": "CARRIER-Canada",
  "period": "2026-Q1",
  "gl_balance": 100000000,
  "source_balance": 99850000,
  "variance": 150000,
  "match_rate": 0.988,
  "exceptions": [
    {
      "id": "EXC-001",
      "type": "Cutoff",
      "severity": "Medium",
      "amount": 85000,
      "description": "Policy #POL-2026-4521 bound Mar 31, premium not earned until April",
      "recommended_action": "Defer to April earned premium",
      "journal_entry": {"dr": "4200", "cr": "2050", "amount": 85000},
      "confidence": 0.92
    }
  ],
  "status": "Exceptions_Pending",
  "certifier": null,
  "due_date": "2026-04-05"
}
```

---

## Configuration

### Agent Parameters

```json
{
  "agent_id": "reconciliation-agent",
  "mcp_servers": ["oracle_erp", "oracle_epm"],
  "parameters": {
    "matching_mode": "cascade",
    "auto_resolve_threshold": 0.90,
    "materiality_threshold": 500000,
    "aging_policy_days": [30, 60, 90],
    "escalation_enabled": true,
    "certification_required": true,
    "output_format": ["summary", "exceptions", "journal_proposals", "trend"],
    "integration": {
      "feeds_journal_entry_agent": true,
      "feeds_variance_agent": false,
      "receives_from_close_calendar": true
    }
  },
  "rec_types": {
    "banking": ["nostro", "loan_portfolio", "derivative", "intercompany", "suspense"],
    "insurance": ["premium", "claims_reserve", "reinsurance", "ifrs17_csm", "investment"],
    "credit_union": ["member_deposits", "member_loans", "shared_branching", "central"],
    "asset_management": ["nav", "aum", "fee", "cash", "custody"],
    "pension": ["assets", "liability", "contribution", "benefit_payment"]
  }
}
```

---

## Cross-References

- **Journal Entry Agent** — Receives exception journal proposals for validation and posting
- **Variance Analysis Agent** — Consumes confirmed reconciliation to ensure clean data before variance decomposition
- **Accounting Policy Engine** — Policy rules determine matching tolerances and write-off thresholds
- **Oracle ERP Wiki** — GL/SLA/subledger architecture reference
- **Oracle EPM Wiki** — ARCS (Account Reconciliation Cloud Service) integration
- **KYC/AML** — Nostro reconciliation critical for sanctions compliance (FATF Rec 16)