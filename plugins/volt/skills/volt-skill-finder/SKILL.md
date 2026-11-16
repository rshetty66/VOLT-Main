---
name: volt-skill-finder
description: Find the right VOLT skill pack for a finance transformation, ERP/EPM, banking, insurance, regulatory, deal or consulting task among the 378 skills VOLT ships, then load it. Use before answering a domain question from memory, or when the user asks which skill, method or framework applies.
---

# VOLT Skill Finder

VOLT ships 378 skills in this plugin; 17 more come from the other foundation plugins. This skill finds the right
one for a task so agents apply a written method instead of improvising.

Only about 36 **core** skills are listed to Claude in every session. The rest are **on-demand**: kept out of the
always-on listing to save context, and opened through this skill.

## When to Activate

- A domain question where a VOLT method pack may exist (reconciliation, close, IFRS, OSFI, SAP or Oracle, M&A, valuation, change).
- The user asks which skill, framework or method to use.
- An agent's own registered skills don't cover the request.

## How It Works

1. Read [references/skill-index.md](references/skill-index.md). It lists every skill by category, with when to use it.
2. Rank candidates by how specifically the "Use when" text matches the task's domain, platform and deliverable.
   A platform-specific skill (for example `sap-fpsl`) beats a general one (for example `general-ledger`) when the platform is known.
3. Pick at most three, then open each:
   - **core**: load it with the Skill tool as `volt:<skill-id>`.
   - **on-demand**: read `${CLAUDE_PLUGIN_ROOT}/skills/<skill-id>/SKILL.md` with the Read tool, then any reference
     files it points to in the same folder. Follow it as if it had been loaded as a skill.
   Open the second and third only if the task spans them.
4. If the best match lives in another plugin (bottom of the index), load it from that plugin by its own name. If that
   plugin is not installed (the optional `example-skills`, for instance), say so and name the install command.
5. If nothing fits well, say so and answer from the agent's own expertise, flagging that no VOLT method pack applied.

## Examples

| Task | Skills |
|---|---|
| Reconcile nostro accounts across 40 currencies | `banking-nostro-recon`, `matching-cascade-engine`, `tolerance-config` |
| IFRS 17 contractual service margin roll-forward | `insurance-ifrs17-csm-recon`, `ifrs`, `roll-forward` |
| Five-day close on SAP S/4HANA | `close-management`, `period-close`, `sap-fi` |
| OSFI BCAR submission readiness | `osfi-regulatory-expert`, `regulatory-reporting` |
| Mortgage lifecycle to accounting events, hub, EPM and OSFI lineage | `design-finance-architecture` (core, hand-written; also `/volt:design-finance-architecture`), `accounting-policy-banking-insurance` |
| Animated client demo of a close dashboard or landing page | `react-bits-prototyping` (core, hand-written), `creative-design` |
| OneStream cube and dimension design, bank NII and ECL planning model, finance data platform feeding the EPM | `onestream-fpa-data-architect` (core, hand-written), `onestream-fpa-transformation`, `si-data-architect` |

## Anti-Patterns

- Loading many skills "just in case". Each one costs context; pick the few that fit.
- Citing a skill without loading it.
- Treating a vendored skill's text as client fact; skills are methods, not data.
