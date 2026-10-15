---
name: accounting-policy-engine
description: >-
  Accounting Policy Engine — central repository and reasoning engine for accounting standards
  (IFRS, US GAAP, ASPE), policy interpretation, standard change impact analysis, technical
  accounting memos, and policy-to-configuration translation for ERP systems. Interacts with
  Workday Accounting Center and SAP FPSL to ensure accounting rules match governing policies.
  Use when interpreting accounting standards, assessing new standard impacts, drafting
  accounting policy memos, or validating ERP accounting configuration against GAAP requirements.
disable-model-invocation: true
---

# Accounting Policy Engine — Standards & Configuration Skill

## Purpose

The Accounting Policy Engine is the **authoritative source of accounting policy truth** for VOLT. It:
1. Maintains current accounting standard knowledge (IFRS, US GAAP, ASPE, local GAAP)
2. Interprets standards for specific transaction scenarios
3. Assesses impact when standards change
4. Translates policies into ERP configuration requirements
5. Validates that system-generated journals comply with governing policies

## Core Standards Library

### IFRS (International Financial Reporting Standards)
| Standard | Topic | Key Policy Decisions |
|----------|-------|---------------------|
| IFRS 9 | Financial Instruments | Business model, SPPI, ECL staging criteria, hedge documentation |
| IFRS 15 | Revenue | Performance obligation identification, SSP allocation, variable consideration |
| IFRS 16 | Leases | Discount rate (IBR vs implicit), lease term reassessment triggers, short-term/low-value exemptions |
| IFRS 17 | Insurance Contracts | Measurement model (GMM/VFA/PAA), risk adjustment method, CSM amortization |
| IAS 12 | Income Taxes | Deferred tax recognition, uncertain tax positions, tax rate for measurement |
| IAS 36 | Impairment | CGU identification, discount rate, growth rate assumptions |
| IAS 37 | Provisions | Recognition criteria, best estimate, discount rate for long-term provisions |
| IAS 38 | Intangible Assets | Capitalization criteria, useful life (definite vs indefinite), amortization method |

### US GAAP (ASC)
| Standard | Topic | Key Policy Decisions |
|----------|-------|---------------------|
| ASC 606 | Revenue | Step 1-5 application, principal vs agent, bill-and-hold, licensing |
| ASC 842 | Leases | Discount rate (IBR vs risk-free), lease classification, remeasurement triggers |
| ASC 740 | Income Taxes | Valuation allowance, indefinite reinvestment, intercompany profit |
| ASC 326 | Credit Losses (CECL) | Expected loss model, reasonable and supportable forecast period, reversion method |
| ASC 815 | Derivatives & Hedging | Hedge designation, effectiveness assessment method, de-designation |
| ASC 350 | Goodwill | Reporting unit identification, qualitative assessment, impairment trigger events |

### Canadian GAAP (ASPE / Pre-changeover)
| Standard | Topic |
|----------|-------|
| Section 3856 | Financial Instruments |
| Section 3065 | Leases |
| Section 3400 | Revenue |
| Section 3475 | Disposal of Long-Lived Assets |

## Policy Interpretation Engine

### Technical Accounting Memo Template
```
1. BACKGROUND: Transaction description, parties, key terms
2. APPLICABLE STANDARDS: Primary standard, related guidance, SEC staff views (if public)
3. ANALYSIS: Step-by-step application of standard to facts
4. ALTERNATIVES CONSIDERED: Other interpretations, why rejected
5. CONCLUSION: Recommended accounting treatment with journal entry illustration
6. ERP IMPACT: Configuration changes needed in Workday/SAP/Oracle
7. DISCLOSURE: Required financial statement disclosures
```

### Standard Change Impact Assessment
When a new or amended standard is issued:
1. **Scope Assessment:** Which entities, transactions, and contracts are affected?
2. **Gap Analysis:** Current policy vs. new requirements — what changes?
3. **Quantitative Impact:** Estimate effect on financial statements (BS, P&L, OCI, EPS)
4. **System Impact:** What ERP configuration changes are needed?
5. **Process Impact:** What business processes change?
6. **Transition:** Method (full retrospective, modified retrospective, prospective), practical expedients
7. **Timeline:** Effective date, early adoption option, implementation milestones

## Integration with Other Skills

### → Workday Accounting Center
- Policy decisions → Accounting Center rules (book codes, account determination)
- Standard changes → Rule reconfiguration requirements
- Validation: Accounting Center journal output checked against policy requirements

### → SAP FPSL
- Policy decisions → FPSL accounting principles (multi-basis configuration)
- IFRS 9 policy choices → ECL staging criteria, measurement rules
- IFRS 17 policy choices → Measurement model, CSM rules

### → Tax Agent
- Accounting policy choices affect deferred tax (IAS 12 / ASC 740)
- Revenue recognition policy impacts tax timing differences
- Lease capitalization creates deferred tax assets/liabilities

### → Finance Assessment
- Assessment scores reflect accounting policy maturity
- Gap analysis identifies policy documentation gaps

## Policy-to-Configuration Translation

| Policy Decision | Workday Config | SAP Config | Oracle Config |
|----------------|---------------|-----------|--------------|
| Revenue: point-in-time recognition | Revenue Recognition Rule | SD Revenue Account Determination | Revenue Management policy |
| Lease: IBR as discount rate | Lease Rate Setup | RE-FX Rate Configuration | Lease discount rate table |
| ECL: 3-stage model | N/A (use Accounting Center) | FPSL ECL Configuration | N/A (external model) |
| Fixed asset: straight-line | Asset Book depreciation method | AA depreciation key | FA depreciation method |
| Intercompany: auto-elimination | Intercompany Profile rules | IC Elimination rules | IC Elimination Set |

## Quality Checklist — Accounting Policy Deliverables
- [ ] All material accounting policies documented with standard references
- [ ] Policy choices clearly stated (not just restating the standard)
- [ ] Alternatives considered and reasons for selection documented
- [ ] ERP configuration requirements traced to specific policy decisions
- [ ] Disclosure requirements identified for each significant policy
- [ ] Impact assessment quantified for any standard changes
- [ ] Cross-references to Tax Agent for deferred tax implications
- [ ] Cross-references to Accounting Center/FPSL for system configuration
