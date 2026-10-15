---
name: llmquant-risk
description: Market risk regime and fear scoring, VIX status, hedge design and sizing, and research health checks. Use for hedging, drawdown risk, panic signals, or stress-regime questions.
input_data_source: web_search + fetch_web_page (LLMQuant Data is NOT connected in this deployment; go to the issuing body's own site or data API instead)
category: risk
volt_desk: risk
disable-model-invocation: true
---

# LLMQuant Risk

This category routes risk regime, hedging, panic scoring, and research-quality workflows.

## Routing Rules

1. Identify the asset, portfolio, risk horizon, drawdown tolerance, and required decision.
2. Select the closest workflow below.
3. Open only the selected workflow.
4. Use LLMQuant Data for prices, volatility, options, macro, portfolio positions, alerts, profiles, and watchlists.
5. Report timestamps, data windows, stale notices, assumptions, and missing inputs.

## Workflow Index

| User intent | Workflow |
|---|---|
| Build a per-ticker panic score. | [`workflows/fear-score.md`](workflows/fear-score.md) |
| Translate VIX into an options-risk regime. | [`workflows/vix-status.md`](workflows/vix-status.md) |
| Design protective puts, collars, and put-spread hedges. | [`workflows/hedge-advisor.md`](workflows/hedge-advisor.md) |
| Audit stale profiles, thesis drift, orphan themes, and outdated evidence. | [`workflows/research-health-check.md`](workflows/research-health-check.md) |

## LLMQuant Data Contract

Prefer LLMQuant Data when available. The workflows may need these data capabilities:
- Retrieve price history, volatility, drawdowns, correlations, market regime, VIX context, and macro risk indicators.
- Retrieve option chains, implied volatility history, Greeks, hedge candidates, and liquidity context.
- Retrieve portfolio positions, watchlists, alerts, research profiles, thesis records, and stale evidence.
- Measure hedge cost, risk reduction, concentration, and unresolved data gaps.

Fallback:
- If a figure is unavailable from a connected feed, do NOT stop there: `web_search` for the issuing body, then `fetch_web_page` its page or data API. Only after BOTH have failed do you name the missing input, and then say which host and which error.
- If portfolio or option data is unavailable, name the missing input and produce a data-limited risk note.
