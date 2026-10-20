---
disable-model-invocation: true
description: "VOLT workflow: Payroll to General Ledger. End-to-end payroll processing and GL integration — payroll run, costing, reconciliation, posting. (4 phases, 6 specialist agents)"
argument-hint: "[client situation, scope, platforms, and what the deliverable must answer]"
---

# VOLT workflow: Payroll to General Ledger

End-to-end payroll processing and GL integration — payroll run, costing, reconciliation, posting.

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
| 1 | Payroll Configuration & Rules | `volt:workday-payroll-lead`, `volt:oracle-payroll-lead` |
| 2 | Payroll Costing & Account Mapping | `volt:sap-fico-specialist`, `volt:coa-designer` |
| 3 | Payroll-GL Reconciliation | `volt:consolidation-reporting-agent` |
| 4 | Testing & Parallel Runs | `volt:erp-test-lead` |

## 3. Synthesise

Write the integrated deliverable yourself (as the `volt:rudra` orchestrator would): executive summary, findings by phase,
a recommendations table (recommendation, owning workstream, priority, value or risk), key risks and assumptions, next steps.
Resolve disagreements between agents explicitly and attribute key points to the agent that raised them.

## 4. Verify before handing over

- Every figure is sourced (client input, a tool, or a cited benchmark) or labelled as an estimate.
- Each recommendation traces to a phase finding.
- Gaps in the client data are listed, not papered over.

If the user wants a client-ready file, produce it with the document skills (docx, pptx, xlsx) from the
anthropic-agent-skills plugin.
