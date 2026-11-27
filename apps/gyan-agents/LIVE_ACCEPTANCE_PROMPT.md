# Gyan finance controls: live acceptance prompt

Paste the prompt below into VOLT after the private Gyan runtime is connected. Use a disposable test project with a verified designer and a separate controller. If chat cannot operate Studio, follow the requested manual steps in Workflows → Gyan Agents; do not treat chat output as a run.

```text
Test the deployed Gyan bank/GL reconciliation workflow in a disposable project.
Use synthetic CAD data only. The materiality limit for these cases is CAD 5,000.00.
Exactly CAD 5,000.00 is at the limit; CAD 5,000.01 is over. This is a test criterion,
not authorization to accept smaller unbalanced journals or waive source evidence.
Record the deployment revision, project, workflow version,
run ID, source snapshot IDs, final status, and relevant trace events for each case.
If you cannot operate Studio, give me the exact manual steps and mark the case NOT RUN.
Do not substitute a narrative, a previous CI result, or raw model arithmetic for a live run.
Do not edit production data, post a journal, release a payment, or impersonate a controller.
Keep prompt confirmation, simulation, and independent controller review separate.

Use these CSVs for the baseline:

bank.csv
reference,amount,currency
A,15000.00,CAD
B,-15000.00,CAD

gl.csv
reference,amount,currency,journal_id,debit,credit
A,15000.00,CAD,J1,15000.00,0.00
B,-15000.00,CAD,J1,0.00,15000.00

1. Balanced control. Bind both snapshots, validate and save the draft, then run a simulation.
   Expect both references to match, zero exceptions, and independent verification with
   resolvable source-row references. Final status should be awaiting_hitl, not completed.
   Stop there; no approval or posting is needed for this control.

2. Material unbalanced journal. Make a new GL snapshot: change only the last row to
   B,-9000.00,CAD,J1,0.00,9000.00 (CAD 6,000.00 imbalance). Repeat in a separate
   snapshot/version with B,-9999.99,CAD,J1,0.00,9999.99 (CAD 5,000.01 imbalance,
   the first cent over the limit). Keep the same bank snapshot for both.
   Simulate each version. Expect “Unbalanced journal”, status failed, no verified result,
   no approval request, and no write-back. A reconciliation exception awaiting review
   is not a pass. Check that no approval is offered for the failed run.

3. Correct figure, no source evidence. Use the balanced inputs. Only if a dedicated,
   authorized test harness exists on this deployment, remove the source-row references
   from the CAD 15,000.00 matched result A after calculation and before the independent critic reads it.
   Leave every amount unchanged. Expect critic rejection, failed status, no verified result,
   no approval request, and no write-back. Do not edit stored artifacts or enable fault
   injection on production. If there is no such harness, mark this case NOT TESTED LIVE;
   report the corresponding CI regression separately. An empty upload is not this test.

Return one row per case: expected result | observed result | PASS / FAIL / NOT TESTED LIVE |
workflow version and run ID | trace or source evidence. State which controls were
demonstrated on this deployment and which were verified only in CI.
```
