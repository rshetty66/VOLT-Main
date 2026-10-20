---
name: premium-to-gl-recon
description: "Premium-to-GL reconciliation is the process of matching insurance premium transactions from the core policy administration system (e.g., Guidewire PolicyCenter/BillingCenter) to the General Ledger entries that represent recognized premium revenue and accounts receivable."
disable-model-invocation: true
---

# Premium-to-GL Reconciliation — VOLT Skill Pack

## Domain Context

Premium-to-GL reconciliation is the process of matching insurance premium transactions from the core policy administration system (e.g., Guidewire PolicyCenter/BillingCenter) to the General Ledger entries that represent recognized premium revenue and accounts receivable.

In a P&C auto insurer such as the fictional Humongous Insurance (illustrative scale: 1M policyholders, $2B annual written premiums, 5,000 daily transactions), this process is critical for:
- Month-end close accuracy
- Revenue recognition compliance (IFRS 17)
- Premium leakage detection
- Regulatory reporting (insurance regulator filings)

## Common Break Patterns

| Pattern | Description | Resolution |
|---------|-------------|------------|
| Timing | Guidewire posts on bind date; GL posts on effective date | Auto-resolve if within tolerance window (3 days) |
| Aggregation | Guidewire per-policy; GL batch-posted by product line | Explode GL batch → match sum of source |
| Cancellation lag | Endorsement/cancellation reversals not in GL same period | Match reversal to pending GL journal queue |
| Installment vs. full-term | Payment plan splits vs. full premium recognition | Map installment schedule to recognition schedule |
| Multi-vehicle | Policies split differently in source vs. GL | Match at policy-level total, drill into vehicle split |
| Tax/levy bundling | Tax separated in one system, bundled in the other | Strip tax components before match, reconcile separately |

## Matching Strategies

### Level 1: Exact Match
- Policy number + amount + date (within tolerance)
- Confidence: 99%+ when all three align

### Level 2: Fuzzy Match
- Amount within $0.01 tolerance + date within 3 days + partial policy reference
- Handles timing and rounding differences

### Level 3: Many-to-Many
- Sum of N source records matches 1 GL batch entry (or vice versa)
- Used for aggregation pattern resolution

### Level 4: AI Pattern Match
- Historical break patterns trained on resolved exceptions
- Auto-classifies new breaks with confidence scoring
- Routes to appropriate resolution workflow

## Data Model

### Source (Guidewire)
```
policy_number, transaction_id, transaction_date, effective_date,
premium_amount, tax_amount, levy_amount, total_amount,
coverage_type, product_line, payment_plan_flag, installment_number,
vehicle_count, endorsement_flag, cancellation_flag
```

### Target (GL)
```
journal_entry_id, posting_date, account_code, cost_center,
debit_amount, credit_amount, reference, batch_id,
gl_account_description, period, fiscal_year
```

### Match Output
```
match_id, source_ids[], target_ids[], match_type (exact|fuzzy|many_to_many|ai),
confidence_score, match_date, status (matched|break|pending_review),
break_category, resolution_notes, resolved_by, resolved_date
```

## KPI Framework

| Metric | Illustrative Baseline (Manual) | Target (AI-Automated) |
|--------|-------------------|----------------------|
| Monthly recon hours | 320 hrs | 48 hrs (-85%) |
| Auto-match rate | 0% (all manual) | 85%+ |
| Break resolution (days) | 14 days | 2 days |
| Unreconciled items at close | 2,400+ | < 200 |
| False positive rate | N/A | < 3% |
| Month-end close contribution | Day 8-10 | Day 2-3 |

## Insurance-Specific Considerations

### IFRS 17 Alignment
- Premium revenue must be recognized over coverage period
- Unearned premium reserve (UPR) impacts GL timing
- Recon must handle earned vs. written premium distinction

### No-fault auto schemes
- No-fault models reduce litigation but add care-cost complexity
- Premium structures may simplify while transaction volume stays high
- A high share of monthly installment plans drives high transaction volume

### Regulatory
- Public (Crown) auto insurers are also subject to government oversight
- Regulatory filings require reconciled premium data
- SOX-equivalent internal controls for financial reporting

## Agent Configuration

### Recon Orchestrator Agent
- Role: Coordinate full recon cycle (ingest → match → break → resolve → certify)
- Skills: data_ingestion, matching_engine, exception_routing, certification
- Guardrails: Never auto-approve breaks > $10,000; escalate to human

### Break Analyst Agent
- Role: Classify breaks, suggest resolutions, learn from patterns
- Skills: pattern_recognition, root_cause_analysis, resolution_recommendation
- Guardrails: Confidence threshold 0.85 for auto-resolution; below → human queue

### Certification Agent
- Role: Generate month-end reconciliation certification package
- Skills: report_generation, variance_commentary, sign_off_workflow
- Guardrails: Always require human sign-off on final certification
