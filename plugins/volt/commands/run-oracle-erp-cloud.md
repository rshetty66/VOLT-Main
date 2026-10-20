---
disable-model-invocation: true
description: "VOLT workflow: Oracle ERP Cloud Implementation. End-to-end Oracle Fusion ERP Cloud implementation with AI-assisted configuration. (5 phases, 12 specialist agents)"
argument-hint: "[client situation, scope, platforms, and what the deliverable must answer]"
---

# VOLT workflow: Oracle ERP Cloud Implementation

End-to-end Oracle Fusion ERP Cloud implementation with AI-assisted configuration.

**Client request:** $ARGUMENTS

## 1. Intake

If the request above does not already answer these, ask them in one AskUserQuestion call before starting:

1. What is the primary objective? Options: Full Oracle ERP Cloud implementation planning; Module configuration design (GL, AP, AR, FA, Projects); Data migration strategy and FBDI/HDL template design; Integration architecture and middleware mapping; Custom objective (describe below).
2. Who is the primary audience? Options: Steering Committee / C-Suite — executive summary focus; Project Team — detailed working documents; Client Stakeholders — presentation-ready deliverables; Internal Review — quality and methodology focus.
3. What level of detail do you need? Options: High-level strategic overview (2-3 pages); Working draft with section detail (5-10 pages); Comprehensive deliverable ready for refinement (10+ pages).

## 2. Run the phases

Run the phases **in order**. Within a phase, launch every listed agent **in parallel** (one message, several Task calls),
each with a self-contained brief: the client request, the intake answers, the phase name and goal, and the outputs of
earlier phases. Keep each agent's returned deliverable; later phases build on it rather than repeating it.

| Phase | Name | Agents (Task `subagent_type`) |
|---|---|---|
| 1 | Discovery & Setup Tasks | `volt:oracle-erp-configurator`, `volt:si-functional-lead`, `volt:apqc-researcher` |
| 2 | Configure & Build | `volt:oracle-erp-configurator`, `volt:oracle-scm-configurator`, `volt:oracle-hcm-configurator`, `volt:oracle-config-agent` |
| 3 | Data Migration | `volt:erp-data-loader`, `volt:si-data-architect` |
| 4 | Test & Validate | `volt:erp-test-automation`, `volt:si-security-controls-lead` |
| 5 | Deploy & Cutover | `volt:si-integration-lead`, `volt:si-change-management-lead` |

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
