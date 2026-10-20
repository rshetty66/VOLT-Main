---
disable-model-invocation: true
description: Browse VOLT's consulting services catalogue and pick the service, agents and workflow for an engagement.
argument-hint: "[optional: practice, industry or engagement description]"
---

# VOLT consulting services

**Engagement:** $ARGUMENTS

Use the `volt:volt-services` skill. If an engagement is described, return the three best-matching services with their
coverage rating (full, partial or gap), the agents that deliver each, and the `/volt:run-<workflow>` command to run.
Flag partial or gap coverage plainly, so the user knows where VOLT needs human expertise.
If nothing is described, summarise the catalogue by practice and sub-practice.
