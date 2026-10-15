---
name: volt-services
description: VOLT's consulting services catalogue (60 services across Management Consulting, Enterprise Applications, and Investment and Growth), each mapped to the VOLT agents, workflow commands and skills that deliver it, with a full, partial or gap coverage rating. Use when scoping an engagement, choosing which VOLT agents or workflow to run, or answering what VOLT can deliver.
---

# VOLT consulting services

## When to Activate

- Scoping an engagement or a proposal ("what can VOLT deliver for a mid-size insurer's close?").
- Choosing the agents or `/volt:run-<workflow>` command for a request.
- Checking where VOLT coverage is partial or a gap, so human expertise is planned in.

## How It Works

The catalogue lives in [references/services.md](references/services.md). Each service lists:

- its code, practice and sub-practice
- its coverage: **full** (VOLT agents and workflows deliver it end to end), **partial** (some steps need human specialists) or **gap**
- the agents (`subagent_type: volt:<id>`), the `/volt:run-<workflow>` commands and the skills that deliver it

Match the request to the services, then run the listed workflow command or delegate to the listed agents.

## Examples

- "Accelerate our month-end close" maps to the close optimization and record-to-report service: its agents, then `/volt:run-close-optimization`.
- "OSFI capital reporting for a D-SIB" maps to the industry service for regulatory capital: `osfi-bcar-master`, then `/volt:run-bcar-capital-reporting`.

## Anti-Patterns

- Promising a **gap** service as if VOLT delivers it.
- Running a workflow without checking that its agents fit the client's platforms and industry.
