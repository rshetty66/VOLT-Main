# ADR-NNN: <Decision stated as a fact, present tense>

| | |
|---|---|
| **Status** | Accepted |
| **Date** | YYYY-MM-DD |
| **Deciders** | <names> |
| **Related** | RFC-NNN, ADR-NNN |

## Context

<The forces at play when this was decided. Constraints, deployment realities, deadlines,
what was already built. Write for someone who was not in the room.

Be specific about what made the obvious answer wrong — that is usually the whole reason
this ADR exists.>

## Decision

<One paragraph, present tense: "We use X." Then the specifics: the module, the default,
the env flag, the path.>

## Consequences

**Good**

- <What this buys.>

**Bad**

- <What it costs. What is now harder. What debt is knowingly accepted.>

**Ceiling**

- <The scale or condition at which this decision breaks, and the upgrade path.
  Example: "single-writer SQLite; move to PostgresSaver before parallel fan-out."
  This should match the `ponytail:` comment in the code, if there is one.>

## Alternatives considered

### <Name>

<What it was, and the specific reason it lost. Not "too complex" — say which complexity
and why it was not worth paying.>

## Revisit when

<Concrete trigger, not "periodically". Examples:
- concurrent chat sessions exceed ~20
- retrieval precision@6 drops below 0.7 on the eval set
- the platform team provisions the SharePoint MCP credentials>
