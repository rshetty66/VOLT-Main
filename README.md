# VOLT-Main
VOLT AGENTIC SOLUTION

Foundation for the VOLT rebuild (Vision, Orchestrate, Launch, Transform).

## Foundation: ECC agent harness

This repository is seeded from **ECC**, the agent harness operating system
(https://github.com/affaan-m/ecc, MIT License, Copyright (c) 2026 Affaan Mustafa),
upstream commit `76aaa77`. ECC's `LICENSE` is kept unchanged, and its full README
is in [ECC_README.md](ECC_README.md).

ECC supplies the harness layer the rebuild builds on:

| Path | What it holds |
|---|---|
| `agents/` | 71 agent definitions |
| `skills/` | skill packs (~600 files) |
| `commands/` | 97 slash commands |
| `hooks/`, `rules/` | hook scripts and coding rules |
| `mcp-configs/` | MCP server configurations |
| `src/`, `ecc2/`, `scripts/` | harness tooling and installers |

VOLT's own finance transformation capabilities will be layered on top in later steps:
the agent registry, multi-phase workflows, consulting services catalogue, skills and engines.

## Pulling ECC updates

    git remote add upstream https://github.com/affaan-m/ecc
    git fetch upstream

## What was left out

ECC's `.github/` folder (CI and release workflows, scheduled maintenance jobs, Dependabot,
CODEOWNERS, funding and issue templates) is not included. It runs ECC's own project operations
and would fire against this repository. VOLT's own CI will be added when there is VOLT code to test.
