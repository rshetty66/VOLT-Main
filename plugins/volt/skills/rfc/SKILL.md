---
name: rfc
description: Write, review, or revise an RFC / design doc / technical proposal before building something non-trivial in VOLT. Use when the design is contentious, crosses layers, or needs team consensus recorded before code.
category: Engineering Practice
disable-model-invocation: true
---

# RFC — Request for Comments

An RFC is a *proposal under discussion*. It argues for a design before it is built.
If the decision is already made and you only need the record, use the `adr` skill instead.

## Write one only when it earns its keep

**Write an RFC when:**
- Two or more credible designs exist and the choice is contentious.
- The change crosses layers (`api/graph/` routing brain <-> `api/routes/` <-> `web/src/`) or touches the tool surface the agent can call.
- It changes a trust boundary: auth, write-gating (`FIRM_ERP_ALLOW_WRITES`), mock-vs-live data, or what leaves the cluster.
- Someone will ask "why is it like this?" in six months and the code alone won't answer.

**Skip the RFC when:**
- One obvious design, no contention → just build it.
- Bug fix, refactor with no interface change, dependency bump.
- The whole thing fits in a PR description.

> If you catch yourself writing an RFC to justify work already finished, stop. That is an ADR.

## Location and naming

```text
docs/0-RFCs/RFC-<NNN>-<kebab-slug>.md
```

`NNN` is the next free zero-padded number. List the directory first — never guess the number.
Add a row to `docs/0-RFCs/RFC-README.md` (create it if absent) with number, title, status, date.

## Required structure

Fill every section. "N/A" with a reason is acceptable; a missing section is not.

1. **Header** — number, title, author, status (`Draft` | `In Review` | `Accepted` | `Rejected` | `Superseded by RFC-NNN`), date.
2. **Summary** — the proposal in 3 sentences or fewer. A reader who stops here should know what changes.
3. **Motivation** — the problem, with evidence. Name the file, the log line, the failing case, or the user complaint. No abstract nouns.
4. **Proposed design** — what actually gets built. Interfaces, state shape, node/edge changes, file paths. Include the code or schema sketch.
5. **Alternatives considered** — at least two, each with why it lost. An RFC with no rejected alternative is a decision pretending to be a proposal.
6. **Trade-offs and risks** — what gets worse. Latency, token cost, operational burden, blast radius on failure.
7. **Migration and rollback** — how existing sessions/data survive the change, and how to turn it off.
8. **Open questions** — what you want reviewers to decide. Be specific enough to be answerable.

Template: [`references/rfc-template.md`](references/rfc-template.md)

## VOLT-specific review checks

Before marking an RFC ready for review, answer these — reviewers will ask:

| Area | Question the RFC must answer |
|---|---|
| Routing brain | Does this add a node, an edge, or a role? Does `GraphState` grow a key? Does the supervisor's role menu change? |
| Streaming | Generation happens *outside* the graph (`roles.execute_role`). Does this proposal keep token streaming intact? |
| Degradation | What happens when the LLM gateway, Oracle MCP, or SharePoint is unreachable? VOLT's rule is chat never breaks. |
| Checkpoints | Does a new state key break resume on an existing `checkpoints.sqlite` thread? |
| Egress | Does anything call the network at runtime? The cluster blocks non-PyPI egress. |
| Writes | Does this expose a mutating tool? Mutating Oracle tools stay behind `FIRM_ERP_ALLOW_WRITES` with a screaming log line. |
| Token budget | What does this add to the system prompt or the tool-result feedback loop? |

## Reviewing someone else's RFC

Lead with the load-bearing objection, not line edits. In order:

1. **Is this the right problem?** A well-argued solution to the wrong problem is the expensive failure.
2. **Does the design survive the failure cases?** Pick the two ugliest and walk them.
3. **Is a named alternative actually better?** Say which and why, concretely.
4. Only then: clarity, naming, missing detail.

State your verdict explicitly: approve, approve-with-changes, or object-with-reason. Silence is not review.

## Status discipline

- An RFC that has been `Draft` for a month is dead — mark it `Rejected` with a one-line reason and move on.
- When implementation diverges from an `Accepted` RFC, amend the RFC in the same PR. An RFC contradicting the code is worse than no RFC.
- Superseding: set `Superseded by RFC-NNN` on the old one; never edit history out.
