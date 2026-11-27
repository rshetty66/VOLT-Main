# loop-state.md

training_mode: true
runs_completed: 0
last_run: never

## Backlog
| id | item | acceptance line | status |
|---|---|---|---|
| R1 | (describe one change) | (what the live site or test must show) | todo |

Statuses: todo, in-progress, awaiting-approval, merged, verified, failed, blocked.

## Current lap
- item: none
- branch: none
- PR: none
- gate A: not run
- gate B: not run

## Blockers
- none

## Lessons learned
- Render redeploys clear sessions; sign in again before probing.
- Sonnet 5.5 rejects `thinking: disabled`; omit the parameter.
- Only known failing test: tests/uploads.test.ts PDF text layer.

## Run history
| run | date | laps | merged | failed | notes |
|---|---|---|---|---|---|
