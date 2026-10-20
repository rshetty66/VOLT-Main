---
disable-model-invocation: true
description: Run a task inside a seven-layer harness (plan, context, tools and hooks, permissions, verification, feedback, completion) instead of one long chat.
argument-hint: "[the task, e.g. build the FY27 close calendar workbook from the attached trial balances]"
---

# VOLT harness

**Task:** $ARGUMENTS

Before starting, fill the remaining inputs below. Take any that the task or the conversation already states. Ask for
the rest in one AskUserQuestion call (one question per missing field, with sensible defaults as options), and ask
nothing else first. Then follow the prompt, with `{{TASK}}` meaning the task above and the other `{{...}}` fields
meaning the answers.

- `{{OUTPUT}}`: deliverable and output path
- `{{CHECKS}}`: acceptance checks
- `{{SOURCES}}`: source material
- `{{SCOPE}}`: allowed changes (files, folders, systems)
- `{{LIMIT}}`: run limit (attempts, time or steps)

```text
<prompt>
<goal>
Complete {{TASK}} inside a harness, not one long chat. The harness is the plan, the context, the tools, the checks, and the rules around the model. Leave a usable result, a verification report, and an updated CLAUDE.md. Stop when every check passes or the agreed limit is reached.
</goal>
<role>
Act as the lead that builds, runs, and maintains this harness. Read the existing project instructions and inspect current work before editing. Plan and merge yourself; give bounded work to subagents. Record decisions that change the harness.
</role>
<principles>
Start in plan mode and agree on the plan before editing. Give the model a way to verify its own work. When it makes a mistake, add the durable rule to CLAUDE.md. Run parallel sessions only on independent work. Keep the harness small enough to inspect and reuse.
</principles>
<inputs>
Task: {{TASK}}
Deliverable and output path: {{OUTPUT}}
Acceptance checks: {{CHECKS}}
Source material: {{SOURCES}}
Allowed changes: {{SCOPE}}
Run limit: {{LIMIT}}
Fill these fields before starting. If a missing detail changes the outcome, ask one focused question.
</inputs>
<layer_1_plan>
Enter plan mode before any edit. Write the plan as steps with one output and one check each.
- Name the files each step reads and writes.
- Mark steps that can run in parallel.
- Write the checks before the work, not after.
Save the plan to plan.md and pause for approval.
</layer_1_plan>
<layer_2_context>
Load only the context each step needs:
1. Read CLAUDE.md and the files named in the step.
2. Pass subagents the step, its inputs, and its check.
3. Keep long logs and raw output out of the main session.
4. Summarize results as paths, verdicts, and evidence.
Keep the main context for decisions, not for searching.
</layer_2_context>
<layer_3_tools_hooks>
If a rule must hold every time (format, lint, type check, block a path), make it a hook or a script, not an instruction. A prompt is for judgment only.
- List every hook and script in CLAUDE.md.
- Never rely on the model to remember a deterministic rule.
If a required tool is unavailable, name the blocker and preserve the steps that can still be completed.
</layer_3_tools_hooks>
<layer_4_permissions>
Check the active permissions before running the harness. Keep edits inside {{SCOPE}}. Configure tool rules or sandbox controls when enforcement is required; prose alone is not a boundary.
- Ask before publishing, sending, or spending.
- Never let two sessions edit the same file.
- Preserve a recoverable version before risky changes.
</layer_4_permissions>
<layer_5_verification>
Every step must prove itself. Verify with real signals: tests, builds, type checks, screenshots, and the actual output. The model's confidence comes last.
Save checks.md with a row for each requirement:
  step | requirement | verdict | evidence
Use pass, fail, or unresolved. Leave missing evidence visible.
</layer_5_verification>
<layer_6_feedback>
Build two feedback paths.
Correction: a failed check sends the step back with the reason, the evidence, and the scope "fix this step only". Cap it at three attempts.
Memory: when you catch a mistake or a correction lands, write the reusable rule into CLAUDE.md so the next session does not repeat it.
</layer_6_feedback>
<layer_7_completion>
Before execution, write a completion checklist from {{CHECKS}}. Each item must point to observable evidence.
- Every output exists and can be opened.
- Every check ran against the saved version.
- Failures are fixed or explicitly reported.
- CLAUDE.md holds every new rule from this run.
If a limit or blocker stops the run, return a partial status with the exact steps left.
</layer_7_completion>
<execution_loop>
1. Read plan.md and pick the next ready steps.
2. Run independent steps in parallel.
3. Verify every output against its check.
4. Return failed steps, never the whole batch.
5. Merge accepted outputs and run the full checks.
6. Continue until completion, a blocker, or {{LIMIT}}.
Do not weaken a check to obtain a pass.
</execution_loop>
<handoff>
After each stage, update progress.md:
Plan: steps done, running, and blocked.
Outputs: exact paths to the current saved files.
Decisions: what changed in the harness and why.
Open issues: failures, uncertainties, and blockers.
Next action: the next ready step.
On resumption, read CLAUDE.md, plan.md, and progress.md first, then continue from the recorded next step.
</handoff>
<delivery>
Return {{OUTPUT}}, plan.md, checks.md, progress.md, and the CLAUDE.md diff. State what was checked, what passed, and what remains unresolved. Save the harness as a reusable template after review. Report measured usage only when available; do not infer savings from the prompt.
</delivery>
</prompt>
```

For a finance deliverable, use the VOLT agents and skills inside the steps (`/volt:find-skill` to pick a method pack)
and Anthropic's document skills for Word, PowerPoint, Excel and PDF outputs.
