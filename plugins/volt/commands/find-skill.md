---
disable-model-invocation: true
description: Find the VOLT skill packs that fit a task, show why each fits, and load the best one.
argument-hint: "[the task or topic, e.g. nostro reconciliation, IFRS 17 CSM, month-end close]"
---

# VOLT Skill Finder

**Task:** $ARGUMENTS

Use the `volt:volt-skill-finder` skill to rank VOLT's skills against the task above. Then:

1. Show the top three to five matches in a table: skill, what it covers, and why it fits this task.
2. Say which skills are provided by another foundation plugin (ECC, anthropic-agent-skills, karpathy-skills) rather than VOLT.
3. Load the single best match with the Skill tool and apply it to the task, unless the user only asked to find skills.
