---
name: llmquant-rates-fx
description: Yield curve and duration analysis, central-bank divergence, FX carry, real rates, dollar direction, and cross-currency hedging. Use for rates, curve, or currency exposure questions.
input_data_source: web_search + fetch_web_page (LLMQuant Data is NOT connected in this deployment; go to the issuing body's own site or data API instead)
category: rates-fx
volt_desk: rates_fx
disable-model-invocation: true
---

# LLMQuant Rates FX

This category routes rates and foreign-exchange workflows for curve analysis, central-bank divergence, and FX carry.

## Routing Rules

1. Identify currencies, countries, curve points, instrument proxy, horizon, and decision type.
2. Select the closest workflow below.
3. Open only that workflow and any referenced local resources.
4. Use LLMQuant Data for yield curves, policy rates, inflation, growth, FX prices, carry, volatility, credit, commodities, and macro context.
5. Report observation dates, price timestamps, policy dates, curve tenors, stale notices, and missing inputs.

## Workflow Index

| User intent | Workflow |
|---|---|
| Analyze yield curve shape, duration exposure, and curve trades. | [`workflows/yield-curve-trade-lens.md`](workflows/yield-curve-trade-lens.md) |
| Compare central-bank paths and macro divergence across countries. | [`workflows/central-bank-divergence.md`](workflows/central-bank-divergence.md) |
| Build an FX carry, momentum, valuation, and risk dashboard. | [`workflows/fx-carry-dashboard.md`](workflows/fx-carry-dashboard.md) |

## LLMQuant Data Contract

Prefer LLMQuant Data when available. The workflows may need these data capabilities:
- Retrieve nominal and real yield curves, policy rates, inflation expectations, rate histories, and term-premium context.
- Retrieve FX spot history, carry, forward points, rate differentials, volatility, positioning, and trade-weighted dollar context.
- Retrieve central-bank meeting calendars, policy communication, macro indicators, commodities, credit, and risk sentiment.
- Retrieve portfolio duration, currency exposures, ETF look-through, and hedging instruments when available.

Fallback:
- If a figure is unavailable from a connected feed, do NOT stop there: `web_search` for the issuing body, then `fetch_web_page` its page or data API. Only after BOTH have failed do you name the missing input, and then say which host and which error.
- If forward points, real rates, or positioning are unavailable, state the missing inputs and use spot/rate-differential evidence only.
- Do not infer live FX carry or curve trades without timestamped rate and FX data.
