---
name: volt-release-loop
description: "Self-running release loop for the VOLT console: one discrete change per lap from branch to PR to tests to merge to Render deploy to live check, with an independent verifier, a persistent loop-state.md, and hard stop rules. Use when asked to run the release loop, work through a backlog of VOLT fixes, or stop prompting turn by turn on VOLT changes."
license: MIT
metadata:
  author: rshetty
  version: '1.0'
---

# VOLT Release Loop

Replaces the manual cycle of fix, open PR, wait for "merge", wait for Render, re-test live. One lap does one change. State lives in `loop-state.md`, never in the conversation.

## Candidacy test (passed)
1. Repetition: every VOLT change follows the same path.
2. Verifiable done: typecheck, tests and a live probe give a yes or no.
3. Token budget: a lap is small; a run is capped (see Stop rules).
4. Tool access: git, gh, npm, curl and a browser are available. Render deploys from main.
Scope rule: one backlog item per lap. If an item needs more than about 200 changed lines or touches stored data, split it or stop.

## Building blocks
- Trigger: on demand ("run the release loop"). Optional later: scheduled, once training ends.
- Execution skills: this skill, plus `verification-loop` and `operator-approval-loop` in `skills/`.
- Goal and gate: the lap's acceptance line from the backlog, checked by Gate A (objective) and Gate B (reviewer sub-agent). The worker never grades its own work.
- Memory: `loop-state.md` (copy from `assets/loop-state.md` if absent).
- Stop rules: below.

## Each lap
1. Read `loop-state.md` first. Take the first backlog item with status `todo`. If none, exit cleanly.
2. Branch `loop/<item-id>` from an up-to-date main. Implement only that item.
3. Gate A, objective, in `apps/volt-console`: `npm run typecheck`, then `npx vitest run`. Check that the only failure is the known baseline `tests/uploads.test.ts` "reads the text layer of a PDF". Any other failure: fix once, rerun; if it still fails, stop (see Stop rules).
4. Gate B, independent: start a separate reviewer sub-agent with only the diff and the acceptance line. It answers pass or fail with reasons and checks for secrets, deleted data and unrelated edits. The worker does not see its own reasoning in this step. A fail goes back to step 2 once.
5. Commit with the trailer `Co-authored-by: Perplexity <noreply@perplexity.ai>`, push, open a PR. Add a CHANGELOG.md entry under Unreleased.
6. Checkpoint. While `training_mode: true`, stop and ask the owner to say "merge". Never merge without that word. After training ends, merge only if Gate A and B both passed and the item is not on the always-ask list.
7. After merge, wait for Render: run `scripts/verify_live.sh` (it polls for the new build, signs in, and probes the changed route or page). Check that the probe output matches the acceptance line.
8. Live check fails: open a fix item at the top of the backlog, mark the lap `failed`, continue to step 9.
9. Log the lap in `loop-state.md`: result, PR number, what was learned, anything that would have saved time. Update `runs_completed` at the end of the run.

## Stop rules
- Max 6 laps per run, and a $5 model cost cap. Stop and report when either is reached.
- Same failure twice in a row: stop and report, do not retry a third time.
- Always ask the owner first, even after training: anything that deletes or migrates stored data, per-user chat changes, auth changes, new secrets, repository visibility, force pushes.
- Never ask for or accept passwords or keys in chat.
- Stop if main is red or Render reports a failed deploy.
- Training: `training_mode` stays true until `runs_completed` is 3 or more and the owner sets it false.

## Error recovery
| Failure | Fix |
|---|---|
| Test fails outside the known baseline | Read the failure, fix once, rerun; second failure stops the loop |
| Render returns 404 or 502 right after merge | Normal during deploy swap; poll up to 8 minutes, then stop |
| Live login 401 | Sign in again with the username; a redeploy clears sessions |
| Merge conflict | Rebase on main once; if it conflicts again, stop and report |
| Reviewer sub-agent fails the diff | Fix the named issue once; a second fail stops the loop |
| Model call 400 from the API | Read the message; do not retry the same request, change it |

## Files
- `assets/loop-state.md`: template for the memory file; copy it next to the repo root on first run.
- `scripts/verify_live.sh`: polls the live site until it serves the new build, signs in with `VOLT_USER`, and prints the status of the paths given as arguments.
