---
name: banking-synthetic-data
description: >
  This skill should be used when the user asks about "banking synthetic data",
  "generate test data for bank", "mock banking data", "synthetic transactions",
  "test data generation for financial services", "realistic bank data",
  "GL test data", "loan portfolio test data", "deposit test data",
  "payment test data", "AML test scenarios", "stress test data",
  "regulatory test data", "IFRS 9 test data", "ECL test data",
  "core banking test data", "card transaction test data",
  "synthetic customer data for bank", "KYC test data",
  "banking migration test data", or needs to generate realistic
  synthetic data for banking system testing, migration, or demos.
version: 1.0.0
disable-model-invocation: true
---

# Banking Synthetic Data Generation

Expert methodology for generating realistic synthetic banking data for testing, migration validation, demos, and regulatory scenario modeling. Covers all major banking domains with Canadian regulatory and market context.

## Design Principles

1. **Referential Integrity**: All generated data maintains FK relationships (Customer → Account → Transaction)
2. **Statistical Realism**: Distributions match real banking patterns (Pareto for balances, Poisson for transactions)
3. **Regulatory Compliance**: Generated data passes validation rules (AML thresholds, OSFI limits, BCBS 239)
4. **Temporal Consistency**: Dates, sequences, and lifecycle events are chronologically valid
5. **Privacy-Safe**: No real PII — all names, SINs, addresses are fabricated but structurally valid

## Data Domain Templates

### 1. Customer / Party Data

| Field | Generation Rule | Example |
|-------|----------------|---------|
| customer_id | Sequential with prefix (CUS-XXXXXXX) | CUS-0012847 |
| customer_type | Weighted: 85% individual, 15% corporate | Individual |
| first_name | From Canadian census name distribution | Alexandre |
| last_name | From Canadian surname frequency | Tremblay |
| date_of_birth | Normal dist μ=45, σ=15, min=18 | 1981-03-14 |
| sin_number | Valid Luhn-check 9-digit (fake) | 046-454-286 |
| address | Canadian postal code regions (weighted by pop) | 100 Sample St, Toronto ON M5V 1A1 |
| risk_rating | 70% Low, 20% Medium, 8% High, 2% Critical | Low |
| kyc_status | 90% Complete, 8% Pending, 2% Expired | Complete |
| segment | Retail/Commercial/Wealth (configurable mix) | Retail |
| relationship_start | Uniform 2005-2025 | 2018-06-22 |

### 2. Account Data

| Field | Generation Rule | Example |
|-------|----------------|---------|
| account_id | Branch(3) + Type(2) + Seq(7) | 001-10-0045892 |
| account_type | Chequing/Savings/GIC/TFSA/RRSP/Mortgage/LOC/CC | Chequing |
| currency | 92% CAD, 5% USD, 3% other | CAD |
| open_date | After customer relationship_start | 2019-01-15 |
| status | 85% Active, 10% Dormant, 5% Closed | Active |
| balance | Log-normal: μ depends on type | $12,847.33 |
| interest_rate | Based on BoC rate + product spread | 4.95% |
| branch_id | Weighted by branch size | 001 (Downtown Main) |

**Balance Distributions by Product:**
- Chequing: Log-normal μ=8.5 σ=1.2 (median ~$5,000)
- Savings: Log-normal μ=9.5 σ=1.5 (median ~$13,000)
- GIC: Uniform $5K-$500K
- Mortgage: Normal μ=$450K σ=$150K (Canadian market)
- Credit Card: Log-normal μ=7.5 σ=1.0 (median ~$1,800)

### 3. Transaction Data

| Field | Generation Rule | Example |
|-------|----------------|---------|
| txn_id | UUID or sequential | TXN-2026-0000001 |
| account_id | FK to Account | 001-10-0045892 |
| txn_date | Weighted (more on business days, payday spikes) | 2026-01-15 |
| txn_type | Debit/Credit with product-specific mix | Debit |
| amount | Product-dependent distribution | $127.45 |
| description | Template-based with merchant categories | INTERAC PURCHASE FOURTH COFFEE #1234 |
| channel | POS/Online/ATM/Branch/Mobile/Wire | POS |
| merchant_category | MCC codes (5411=Grocery, 5812=Restaurant, etc.) | 5411 |
| balance_after | Running balance calculation | $12,719.88 |

**Transaction Volume Patterns:**
- Chequing: 30-60 txns/month (Poisson λ=45)
- Savings: 2-5 txns/month
- Credit Card: 20-40 txns/month
- Mortgage: 1-2 txns/month (payment + property tax)

### 4. Loan Portfolio Data

| Field | Generation Rule | Example |
|-------|----------------|---------|
| loan_id | LN-XXXXXXX | LN-0045123 |
| product_type | Mortgage/Personal/Auto/LOC/Commercial | Mortgage |
| principal | Product-dependent normal dist | $425,000 |
| rate_type | 60% Fixed, 40% Variable | Fixed |
| interest_rate | BoC prime + spread by risk grade | 5.14% |
| term_months | 12/24/36/60/120/300 (product-dependent) | 300 |
| amortization_months | Standard Canadian (25yr residential) | 300 |
| ltv_ratio | Beta dist α=5 β=3 scaled to 0.4-0.95 | 0.78 |
| risk_grade | 1-10 (weighted toward 1-4 for performing) | 3 |
| ifrs9_stage | 88% Stage 1, 9% Stage 2, 3% Stage 3 | Stage 1 |
| ecl_provision | Stage-dependent % of balance | $1,275.00 |
| collateral_type | Residential/Commercial/Vehicle/None | Residential |

### 5. GL / Financial Data

| Field | Generation Rule | Example |
|-------|----------------|---------|
| gl_account | Standard bank COA (Assets 1xxx, Liab 2xxx, etc.) | 1210-001 (Loans - Residential) |
| period | YYYY-MM format | 2026-01 |
| debit | Positive amount | $45,123,456.78 |
| credit | Positive amount | $0.00 |
| cost_center | Branch/Dept/Product line | CC-RETAIL-ON |
| entity | Legal entity code | BANK-CANADA |
| currency | Reporting currency | CAD |

### 6. Payment Data (Interac/SWIFT/ACH)

| Field | Generation Rule | Example |
|-------|----------------|---------|
| payment_id | PAY-YYYYMMDD-XXXXXXX | PAY-20260115-0012345 |
| payment_rail | Interac(60%)/EFT(25%)/Wire(10%)/SWIFT(5%) | Interac |
| sender_account | FK to Account | 001-10-0045892 |
| receiver | Varies by rail (account/email/phone) | alex.t@email.com |
| amount | Rail-dependent limits | $250.00 |
| status | Completed/Pending/Failed/Returned | Completed |
| settlement_date | T+0 (Interac) to T+2 (SWIFT) | 2026-01-15 |

### 7. AML / Compliance Scenarios

| Scenario | Pattern | Detection Rule |
|----------|---------|---------------|
| Structuring | Multiple deposits just under $10K | >3 deposits $8K-$9.99K within 5 days |
| Rapid Movement | Large deposit → immediate withdrawal | >$50K in/out within 24 hours |
| Round-Trip | A→B→C→A pattern | Circular flow within 7 days |
| Dormant Activation | Long-dormant account suddenly active | >12 months dormant, then >$25K activity |
| Geographic Risk | Transactions to high-risk jurisdictions | FATF grey/blacklist country codes |

## Generation Strategies

### Strategy 1: Template-Based (Fast, Deterministic)
```
Input: Template name + record count + date range
Output: CSV/XLSX with realistic data
Method: Predefined distributions + random sampling
Use: Quick demos, unit test fixtures
```

### Strategy 2: LLM-Enhanced (Realistic, Contextual)
```
Input: Domain + business rules + sample records
Output: Contextually rich data with narratives
Method: LLM generates descriptions, names, scenarios
Use: UAT, migration dress rehearsals, regulatory submissions
```

### Strategy 3: Scenario-Driven (Test-Specific)
```
Input: Test scenario description + expected outcomes
Output: Data that triggers specific business logic
Method: Reverse-engineer from validation rules
Use: Integration testing, AML detection validation, IFRS 9 staging
```

## Canadian Banking Specifics

- **SIN Format**: 9 digits, Luhn-valid, starts with province prefix (0=unassigned for synthetic)
- **Transit Numbers**: 5-digit branch (XXXXX) + 3-digit institution (001=BMO, 002=Scotiabank, etc.)
- **Postal Codes**: A1A 1A1 format, first letter = province
- **CDIC Insurance**: $100K per eligible deposit category
- **Interac Limits**: $3K default e-Transfer, $25K business
- **OSFI Capital Ratios**: CET1 >11.5%, Total Capital >15.5%
- **BoC Rate**: Use current overnight rate for realistic lending/deposit rates

## Deliverables

| Deliverable | Description |
|------------|-------------|
| Customer Master (10K-1M records) | Party data with addresses, IDs, risk ratings |
| Account Portfolio (50K-5M accounts) | All product types with realistic balances |
| Transaction History (1M-100M txns) | 12-24 months of activity |
| Loan Book (10K-500K loans) | With IFRS 9 staging and ECL |
| GL Trial Balance | Full chart of accounts with YTD balances |
| Payment Files (ISO 20022) | Formatted for payment rail testing |
| AML Scenarios (100-1000 cases) | Known patterns for detection testing |
| Migration Reconciliation Set | Source <-> Target validation pairs |