---
name: llmquant-credit
description: Issuer credit risk review, credit-spread regime, high-yield stress, default risk, debt maturity walls, covenant headroom, ratings and CDS context. Use for borrower or counterparty credit questions.
input_data_source: web_search + fetch_web_page (LLMQuant Data is NOT connected in this deployment; go to the issuing body's own site or data API instead)
category: credit
volt_desk: credit
disable-model-invocation: true
---

# LLMQuant Credit

This category routes credit research workflows for issuer risk, spread regimes, and high-yield stress.

## Routing Rules

1. Identify issuer, ticker, bond, index, sector, maturity bucket, credit rating, and horizon.
2. Select the closest workflow below.
3. Open only that workflow and any referenced local resources.
4. Use LLMQuant Data for filings, debt schedule, fundamentals, rates, spreads, ratings, equity prices, CDS, and macro context.
5. Report filing dates, market timestamps, rating dates, observation windows, stale notices, and missing inputs.

## Workflow Index

| User intent | Workflow |
|---|---|
| Review an issuer's balance-sheet, cash-flow, maturity, and covenant credit risk. | [`workflows/issuer-credit-risk-review.md`](workflows/issuer-credit-risk-review.md) |
| Diagnose credit-spread regime, risk appetite, and sector pressure. | [`workflows/credit-spread-regime.md`](workflows/credit-spread-regime.md) |
| Monitor high-yield stress, refinancing risk, fallen angels, and default pressure. | [`workflows/high-yield-stress-monitor.md`](workflows/high-yield-stress-monitor.md) |

## LLMQuant Data Contract

Prefer LLMQuant Data when available. The workflows may need these data capabilities:
- Retrieve issuer filings, financial statements, debt schedules, maturity ladders, segment exposure, and risk factors.
- Retrieve bond, CDS, spread, rating, recovery, default, and sector credit data when available.
- Retrieve rates, yield curves, equity prices, volatility, liquidity, macro, commodity, and FX context.
- Retrieve ETF holdings or fund-flow data for credit ETFs and crowded exposures when available.

Fallback:
- If a figure is unavailable from a connected feed, do NOT stop there: `web_search` for the issuing body, then `fetch_web_page` its page or data API. Only after BOTH have failed do you name the missing input, and then say which host and which error.
- If bond-level, CDS, or rating data is unavailable, use filings, equity, rates, and macro evidence while naming missing credit-market inputs.
- Do not estimate covenant headroom or default probability without required terms and market data.
