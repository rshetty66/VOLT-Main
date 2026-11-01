---
description: Design how a financial product's lifecycle becomes accounting events, journals, GL, EPM and regulatory lineage, with offline journal and mapping validation.
argument-hint: "[scope, e.g. Canadian residential mortgages on Oracle Accounting Hub + FCCS, IFRS 9 and US CECL]"
---

# Finance Architecture and Accounting Events

**Scope:** $ARGUMENTS

Load the `volt:design-finance-architecture` skill and follow it.

1. Build the intake completeness matrix for the scope above. Name what is missing, who owns it and which phase it
   blocks; do not block every workstream for one missing field.
2. Run the gated phases A-H that the available evidence supports. Load only the reference modules the scope needs.
3. Put every proposed journal or mapping through the bundled validators (from the skill folder:
   `python3 -I scripts/validate_journals.py FILE.json`, `python3 -I scripts/validate_mapping.py FILE.json`) and report
   their PASS, FAIL and NOT_RUN checks as they are.
4. If the user gave no scope or no client data, run the synthetic golden case instead: validate
   `assets/mortgage-demo.json` and `assets/mapping-demo.json`, walk through the mortgage lifecycle matrix, and show the
   IFRS / US CECL full-book versus delta-overlay example (10,000 versus 8,000). Label it ILLUSTRATIVE_EXAMPLE.
5. Return the reviewable package with a run status of BLOCKED, PARTIAL, READY_FOR_REVIEW or VALIDATED_SCOPED. Never
   set APPROVED or RELEASED yourself.
