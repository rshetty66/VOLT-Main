---
disable-model-invocation: true
description: "VOLT workflow: Client Deliverable Production. End-to-end deliverable creation — research, draft, design, format, export. (4 phases, 5 specialist agents)"
argument-hint: "[client situation, scope, platforms, and what the deliverable must answer]"
---

# VOLT workflow: Client Deliverable Production

End-to-end deliverable creation — research, draft, design, format, export.

**Client request:** $ARGUMENTS

## 1. Intake

If the request above does not already answer these, ask them in one AskUserQuestion call before starting:

1. What is the primary objective? Options: Strategic assessment and recommendations; Detailed working document for the project team; Executive briefing for leadership; Technical analysis and design decisions.
2. Who is the target audience? Options: C-Suite / Board; Project Team; Client Stakeholders; Internal Review.
3. What depth of analysis? Options: High-level summary (2-3 pages); Working draft (5-10 pages); Comprehensive output (10+ pages).

## 2. Run the phases

Run the phases **in order**. Within a phase, launch every listed agent **in parallel** (one message, several Task calls),
each with a self-contained brief: the client request, the intake answers, the phase name and goal, and the outputs of
earlier phases. Keep each agent's returned deliverable; later phases build on it rather than repeating it.

| Phase | Name | Agents (Task `subagent_type`) |
|---|---|---|
| 1 | Research & Analysis | `volt:deep-researcher`, `volt:comms-writer` |
| 2 | Content Drafting | `volt:comms-writer`, `volt:fact-check-agent` |
| 3 | Visual Design | `volt:creative-studio` |
| 4 | Document Assembly & Export | `volt:document-factory`, `volt:fact-check-agent` |

## 3. Synthesise

Write the artifact the recipient will use. For a decision document, use an executive summary, decision-relevant findings,
a recommendations table with owners and timing, key risks and assumptions, and next steps. For operating procedures, designs,
datasets and other formats, use the structure the audience needs instead. State substantive disagreements and their implications;
attribute claims to sources, not agents. Keep internal working papers separate unless requested.

## 4. Verify before handing over

- Every figure is sourced (client input, a tool, or a cited benchmark) or labelled as an estimate.
- Each recommendation traces to a phase finding.
- Gaps in the client data are listed, not papered over.

If the user wants a client-ready file, produce it with the document skills (docx, pptx, xlsx) from the
anthropic-agent-skills plugin.
