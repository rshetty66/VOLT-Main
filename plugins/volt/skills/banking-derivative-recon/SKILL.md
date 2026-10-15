---
name: banking-derivative-recon
description: >
  Derivative and trading book reconciliation between GL and front-office trading systems.
  Reconciles mark-to-market valuations, positions, and margin/collateral. Handles CSA
  netting, CVA/DVA/FVA adjustments, and valuation model differences. Activates for
  derivative reconciliation, trading book, mark-to-market, MTM, Murex, Calypso,
  front-to-back, position reconciliation, or collateral reconciliation.
version: 1.0.0
metadata:
  category: Reconciliation
  industry: Banking
  rec_type: derivative
  complexity: Expert
disable-model-invocation: true
---

# Derivative / Trading Book Reconciliation

## Domain Context

Front-to-back reconciliation ensuring trading system valuations (Murex, Calypso, Summit)
agree with General Ledger carrying amounts for derivative assets and liabilities.

- **GL Side:** GL 1400 (Derivative Assets) / GL 2400 (Derivative Liabilities) / GL 1410 (Margin)
- **Source Side:** Trading system mark-to-market valuations per deal
- **Frequency:** Daily (trading book), Weekly (banking book hedges)
- **Volume:** 10K-500K live deals; daily P&L explain required

---

## Matching Configuration

```yaml
tolerance:
  amount_abs: 1000         # $1,000 absolute (individual deal)
  amount_pct: 0.0001       # 0.01% relative (for large notionals)
  date_days: 0             # Same valuation date
  aging_threshold: 10      # 10-day clear policy

match_keys:
  trade_level: [deal_id, mtm_value, currency]
  aggregate: [product_type, counterparty, currency]
  margin: [csa_agreement_id, collateral_posted, collateral_received]

special_rules:
  netting: true            # CSA/ISDA master agreement netting
  day1_pnl: true           # New trade inception P&L handling
  xva_adjustments: true    # CVA/DVA/FVA overlay on clean MTM
```

---

## Common Exception Patterns

| Pattern | Description | Root Cause | Resolution |
|---------|-------------|------------|------------|
| Valuation model | Front office vs finance use different models | Model governance gap | Investigate; use finance model for GL |
| CSA threshold | Netting mismatch on collateral calculations | Threshold/MTA not applied consistently | Reconcile CSA parameters |
| Day-1 P&L | New trade GL recognition timing | Trade booked T, GL posts T+1 | Mark timing; will clear |
| CVA/DVA/FVA | XVA adjustments not in trading system MTM | Separate XVA engine | Post XVA overlay journal |
| Novation/assignment | Trade moved between books but GL not updated | Operations delay | Post transfer journal |
| Expiry/maturity | Trade expired but GL balance remains | Settlement not posted | Clear expired position |

---

## Reconciliation Levels

```
LEVEL 1: AGGREGATE (daily)
  Total Derivative Assets (GL 1400) = Sum of positive MTM (trading system)
  Total Derivative Liabilities (GL 2400) = Sum of negative MTM (trading system)
  Variance explanation required if > $1M

LEVEL 2: BY PRODUCT (daily)
  IRS, CCS, FX Forwards, Options, Credit Derivatives, Commodities
  Each product total in GL = Trading system total for that product

LEVEL 3: BY COUNTERPARTY (weekly)
  Netting sets per ISDA master agreement
  GL net per counterparty = Trading system net per counterparty
  Critical for credit risk (PFE/EEPE calculations)

LEVEL 4: TRADE-BY-TRADE (monthly or on-demand for material breaks)
  Individual deal MTM in GL = Individual deal MTM in trading system
  Used for break resolution and audit evidence
```

---

## XVA Reconciliation

```
CLEAN MTM (Trading System)
+ CVA (Credit Valuation Adjustment — counterparty credit risk)
- DVA (Debit Valuation Adjustment — own credit)
+ FVA (Funding Valuation Adjustment — funding cost)
+ ColVA (Collateral Valuation Adjustment)
+ KVA (Capital Valuation Adjustment — regulatory capital cost)
= TOTAL FAIR VALUE (GL carrying amount)

Each adjustment reconciled separately:
  GL XVA reserve balance = XVA engine calculated amount
  Differences due to: model updates, market data lag, parameter refresh timing
```

---

## MCP Tool Invocations

| Step | Tool | Query/Action |
|------|------|-------------|
| GL balances | `oracle_erp.run_sql_query` | GL_BALANCES WHERE account IN ('1400%', '2400%', '1410%') |
| GL detail | `oracle_erp.run_sql_query` | GL_JE_LINES for derivative accounts |
| Trading extract | `oracle_erp.read_workbook` | Murex/Calypso daily P&L report (CSV) |
| XVA data | `oracle_erp.read_workbook` | XVA engine output (CVA/DVA/FVA per netting set) |
| Post adjustment | `oracle_erp.upload_fbdi` | MTM adjustment / XVA true-up journal |

---

## Escalation Policy

| Condition | Action | SLA |
|-----------|--------|-----|
| Aggregate variance > $5M | Market Risk + Controller | Same day |
| Trade-level break > $1M | Desk head + Product Control | 4 hours |
| Netting set mismatch | Credit Risk + Operations | 24 hours |
| Model difference > 10bps | Model Validation team | 5 business days |

---

## Cross-References

- **matching-cascade-engine** — aggregate and trade-level matching
- **break-trace** — traces deal-level valuation differences
- **exception-classifier** — classifies derivative-specific breaks
- **tolerance-config** — derivative tolerance parameters
