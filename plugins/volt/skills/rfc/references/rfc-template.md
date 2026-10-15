# RFC-NNN: <Title>

| | |
|---|---|
| **Author** | <name> |
| **Status** | Draft |
| **Created** | YYYY-MM-DD |
| **Updated** | YYYY-MM-DD |
| **Supersedes** | — |

## Summary

<Three sentences maximum. What changes, for whom, and why now.>

## Motivation

<The problem, with evidence. Name the file, the log line, the failing request, the
number that is wrong. If you cannot point at something concrete, the RFC is premature.>

**Today:**

<What the code does now. Cite paths — `api/graph/supervisor.py:120`.>

**Why that hurts:**

<Consequence, ideally measured. Latency, wrong answers, operator toil, cost.>

## Proposed design

<What gets built. Be concrete enough that a reviewer could implement it from this
section alone.>

### Interfaces / state changes

```python
# new or changed shapes
```

### Control flow

```text
START -> ingest -> retrieve -> supervisor -> ... -> END
```

### Files touched

| File | Change |
|---|---|
| `path/to/file.py` | <what changes> |

## Alternatives considered

### A. <Name>

<What it is.> **Rejected because** <reason>.

### B. <Name>

<What it is.> **Rejected because** <reason>.

## Trade-offs and risks

| Risk | Likelihood | Blast radius | Mitigation |
|---|---|---|---|
| | | | |

**What gets worse:** <Be honest. Every design costs something.>

## Migration and rollback

**Migration:** <How do in-flight sessions, existing checkpoints, and stored data survive?>

**Rollback:** <Exact steps or env flag to disable. If rollback is impossible, say so loudly.>

## VOLT review checklist

- [ ] Graph: nodes/edges/roles/`GraphState` changes described
- [ ] Streaming path unaffected (generation stays outside the graph)
- [ ] Degradation behaviour defined for LLM gateway / Oracle MCP / SharePoint outage
- [ ] Existing `checkpoints.sqlite` threads still resume
- [ ] No new runtime network egress (or explicitly justified)
- [ ] No mutating tool exposed outside `FIRM_ERP_ALLOW_WRITES`
- [ ] System-prompt / token-budget impact stated

## Open questions

1. <Specific enough that a reviewer can answer it.>
2.

## Decision

<Filled at Accepted/Rejected time: who decided, when, and the one-line rationale.
Then record it as an ADR if it constrains future work.>
