---
disable-model-invocation: true
description: "VOLT workflow: Implementation Mobilization. Project mobilization: charter, governance, policy review, workshop planning. (4 phases, 10 specialist agents)"
argument-hint: "[client situation, scope, platforms, and what the deliverable must answer]"
---

# VOLT workflow: Implementation Mobilization

Project mobilization: charter, governance, policy review, workshop planning.

**Client request:** $ARGUMENTS

## 1. Intake

If the request above does not already answer these, ask them in one AskUserQuestion call before starting:

1. What is the primary objective for this analysis? Options: Full program mobilization — charter, governance, and sprint planning; Policy harmonization — analyze regional policies and recommend global standard; Workshop preparation — design and plan the first design workshops; Technical landscape — system configuration and integration mapping; Custom objective (describe below).
2. Who is the primary audience for the output? Options: Steering Committee / C-Suite — executive summary focus; Project Team — detailed working documents; Client Stakeholders — presentation-ready deliverables; Internal Review — quality and methodology focus.
3. What level of detail do you need? Options: High-level strategic overview (2-3 pages); Working draft with section detail (5-10 pages); Comprehensive deliverable ready for refinement (10+ pages).
4. Which regions should be prioritized in the analysis? Options: North America (USA, Canada); Europe (UK, Germany, France, Nordics); Asia-Pacific (China, India, Japan, Korea, ANZ); Latin America (Brazil, Mexico); All regions equally.

## 2. Run the phases

Run the phases **in order**. Within a phase, launch every listed agent **in parallel** (one message, several Task calls),
each with a self-contained brief: the client request, the intake answers, the phase name and goal, and the outputs of
earlier phases. Keep each agent's returned deliverable; later phases build on it rather than repeating it.

| Phase | Name | Agents (Task `subagent_type`) |
|---|---|---|
| 1 | Project Planning & Mobilization | `volt:pmo-tracker`, `volt:project-knowledge-base`, `volt:data-safeguard` |
| 2 | Requirements & Policy Gathering | `volt:policy-harmonization`, `volt:project-knowledge-base`, `volt:si-finance-process-lead`, `volt:apqc-researcher` |
| 3 | Design Workshop Planning | `volt:workshop-facilitator`, `volt:si-functional-lead`, `volt:creative-designer` |
| 4 | Quality Assurance & Delivery | `volt:fact-check-agent`, `volt:data-safeguard`, `volt:pmo-tracker` |

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
