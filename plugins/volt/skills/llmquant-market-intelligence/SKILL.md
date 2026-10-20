---
name: llmquant-market-intelligence
description: Cross-asset market view, sentiment and positioning dashboards, and event-probability signals. Use for a quick read on market tone, risk appetite, or what the market is currently pricing.
input_data_source: web_search + fetch_web_page (LLMQuant Data is NOT connected in this deployment; go to the issuing body's own site or data API instead)
category: market-intelligence
volt_desk: market_intel
disable-model-invocation: true
---

# LLMQuant Market Intelligence

This category contains reusable market utility workflows that can support research, trading, and portfolio decisions.

## Routing Rules

1. Identify whether the user needs macro context, sentiment, or event probability evidence.
2. Select one workflow from the index.
3. Open only the selected workflow.
4. Use LLMQuant Data for all market, macro, event, options, and sentiment inputs.
5. Report dates, data windows, stale notices, and missing future data contracts.

## Workflow Index

| User intent | Workflow |
|---|---|
| Track cross-asset macro indicators and likely portfolio impact. | [`workflows/macro-view.md`](workflows/macro-view.md) |
| Build a market-wide sentiment dashboard. | [`workflows/market-sentiment.md`](workflows/market-sentiment.md) |
| Compare prediction-market and options-implied event probabilities. | [`workflows/event-probability-signals.md`](workflows/event-probability-signals.md) |

## LLMQuant Data Contract

Prefer LLMQuant Data when available. The workflows may need these data capabilities:
- Retrieve macro snapshots, macro histories, and cross-asset market prices.
- Retrieve crypto market snapshots and broader market sentiment indicators.
- Compare event probabilities from prediction markets, options-implied pricing, or user-provided probability tables.
- Track dates, frequencies, market windows, and stale-data notices.

Fallback:
- If a figure is unavailable from a connected feed, do NOT stop there: `web_search` for the issuing body, then `fetch_web_page` its page or data API. Only after BOTH have failed do you name the missing input, and then say which host and which error.
- If a needed data capability is unavailable, name it explicitly and continue only with available LLMQuant Data or user-provided evidence.
