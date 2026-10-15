---
disable-model-invocation: true
description: "VOLT workflow: Finance AI Strategy & Roadmap. Comprehensive Finance 2.0 AI Strategy — current state diagnostic, Big Rock opportunity mapping, peer benchmarking, AI roadmap, and CFO-ready deliverable for enterprise controllership transformation. (6 phases, 11 specialist agents)"
argument-hint: "[client situation, scope, platforms, and what the deliverable must answer]"
---

# VOLT workflow: Finance AI Strategy & Roadmap

Comprehensive Finance 2.0 AI Strategy — current state diagnostic, Big Rock opportunity mapping, peer benchmarking, AI roadmap, and CFO-ready deliverable for enterprise controllership transformation.

**Client request:** $ARGUMENTS

## 1. Intake

If the request above does not already answer these, ask them in one AskUserQuestion call before starting:

1. What is the primary objective for this Finance AI Strategy engagement? Options: Full Finance 2.0 AI Strategy & Roadmap — comprehensive CFO-ready deliverable; Big Rock prioritization — identify and sequence the highest-value AI opportunities; Peer benchmarking — compare against peer banks; AI business case development — ROI/NPV model for AI investments; Custom objective (describe below).
2. Who is the primary audience for this deliverable? Options: CFO / Finance Leadership Team — executive briefing focus; Board of Directors — strategic overview with governance emphasis; Steering Committee — detailed roadmap with milestones; Finance Operations — tactical implementation playbook.
3. What level of detail do you need? Options: Executive summary (3-5 pages) — CFO meeting preparation; Working draft with section detail (10-15 pages); Comprehensive deliverable ready for client presentation (20+ pages).
4. Which Big Rock areas should be prioritized? Options: All five equally (Compensation, Technical Accounting, Reporting, Close, Governance); Close & Reporting (labor-intensive core processes); Technical Accounting & Close (complexity + volume); Governance & Compliance (risk reduction focus); Custom priority (describe below).
5. Client current state data (assessment metrics, labor costs, volume data, peer group, highest-volume entities):

## 2. Run the phases

Run the phases **in order**. Within a phase, launch every listed agent **in parallel** (one message, several Task calls),
each with a self-contained brief: the client request, the intake answers, the phase name and goal, and the outputs of
earlier phases. Keep each agent's returned deliverable; later phases build on it rather than repeating it.

| Phase | Name | Agents (Task `subagent_type`) |
|---|---|---|
| 1 | Strategic Framing & Current State Diagnostic | `volt:rudra`, `volt:apqc-researcher`, `volt:si-finance-process-lead` |
| 2 | Big Rock Deep Dives — Close, Reporting, Compensation, Technical Accounting, Governance | `volt:consolidation-reporting-agent`, `volt:coa-designer`, `volt:accounting-hub-architect`, `volt:internal-audit-agent` |
| 3 | FP&A Automation & Regulatory Streamlining | `volt:si-finance-process-lead`, `volt:si-data-analytics-lead` |
| 4 | Peer Benchmarking | `volt:apqc-researcher`, `volt:financial-modeling-agent` |
| 5 | AI Opportunity Roadmap & Value Case | `volt:financial-modeling-agent`, `volt:si-finance-process-lead` |
| 6 | Executive Deliverable Assembly | `volt:creative-designer`, `volt:fact-check-agent` |

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
