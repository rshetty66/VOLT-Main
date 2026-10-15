---
name: adr
description: Record an architecture decision that has already been made, as an immutable dated ADR. Use when a choice constrains future work and the reasoning would otherwise be lost - library picks, boundaries, storage engines, protocol choices.
category: Engineering Practice
disable-model-invocation: true
---

# ADR — Architecture Decision Record

An ADR is a *dated, immutable record of a decision already taken* and the context that
forced it. It is not a proposal (that is `rfc`) and not a changelog entry (that is `changelog`).

The value of an ADR is entirely in the **Context** and **Consequences** sections. Anyone
can read the code to see what was chosen; only the ADR says what the world looked like
when the choice was made.

## Write one when the decision constrains the future

**Write an ADR for:**
- A boundary: what lives in the graph vs. outside it, what the agent may call, what a
  layer is forbidden to import.
- A technology commitment that is expensive to reverse: SQLite checkpointer vs. Postgres,
  TF-IDF vs. dense embeddings, LangGraph vs. hand-rolled orchestration.
- A deliberate constraint: mock-only Oracle in v1, read-only SharePoint, zero runtime egress.
- A rejected-for-now option someone will re-propose. The ADR is how you stop re-arguing it.

**Do not write an ADR for:** implementation details, anything you'd happily change next
week, or a decision only one file cares about. Use a `ponytail:` code comment for those.

## Location and naming

```text
docs/1-ADRs/ADR-<NNN>-<kebab-slug>.md
```

List the directory to find the next number. Add a row to `docs/1-ADRs/ADR-README.md`
(create if absent): number, title, status, date, one-line decision.

## Structure

```text
# ADR-NNN: <Decision stated as a fact>
Status | Date | Deciders | Related
## Context
## Decision
## Consequences
## Alternatives considered
## Revisit when
```

Template: [`references/adr-template.md`](references/adr-template.md)

### Title

State the decision, not the topic. Present tense, active.

- Good: `ADR-004: Skill retrieval uses TF-IDF, not hosted embeddings`
- Bad: `ADR-004: Embedding backend` (that's a topic, not a decision)

### Context

The forces that made the decision necessary. Constraints, deadlines, what was already
built, what the deployment environment forbids. This is the section future readers need.
Write it so someone who was not in the room understands why the obvious answer was wrong.

### Decision

One paragraph, present tense: "We use X." Then the specifics — the flag, the default, the
module. Cite paths.

### Consequences

Both directions, honestly. Split them:

- **Good:** what this buys.
- **Bad:** what it costs, what is now harder, what technical debt is accepted.
- **Ceiling:** the scale or condition at which this decision breaks. Name it explicitly —
  this is what makes the ADR actionable later, and it should match any `ponytail:` comment
  in the code.

### Status lifecycle

| Status | Meaning |
|---|---|
| `Accepted` | In force. The code reflects it. |
| `Superseded by ADR-NNN` | Replaced. Body stays unedited. |
| `Deprecated` | No longer applies, nothing replaced it. |

**ADRs are append-only.** Never rewrite the body of an `Accepted` ADR to match new
reality — supersede it with a new ADR that references the old one. The history is the point.

## VOLT decisions that already deserve ADRs

If these are not yet recorded, they are the highest-value ADRs to write first. Several are
already documented as `ponytail:` comments in code — lift the ceiling and upgrade path
from the comment into the ADR:

| Decision | Where it lives today | Ceiling to record |
|---|---|---|
| Generation runs outside the graph so SSE streaming survives | `api/graph/build.py` docstring | Graph nodes cannot yield tokens |
| SqliteSaver + WAL for checkpoints | `api/graph/build.py:66` | Single-writer SQLite; Postgres before parallel fan-out |
| TF-IDF default embedding backend | `api/graph/skill_index.py` | Recall vs. `VOLT_EMBED_BACKEND=st`; needs cached model or egress |
| Mutating Oracle tools gated by env flag, not name heuristic | `api/graph/tools.py:37` | No per-call human confirmation yet |
| Only truncated tool summaries re-enter the model conversation | `api/graph/agent_loop.py:26` | `_RESULT_CAP` = 6000 chars |
| Mock-only Oracle for v1 | deployment config | Live writes blocked until confirmation-gating ships |

## Relationship to the other records

```text
rfc        -> proposes, argues, may be rejected      (mutable while Draft)
adr        -> records what was decided and why       (immutable once Accepted)
changelog  -> tells users what changed for them      (per release)
```

A large RFC that gets accepted usually produces one ADR per load-bearing decision inside
it. Link them both ways.
