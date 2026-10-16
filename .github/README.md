# VOLT-Main

VOLT AGENTIC SOLUTION

VOLT (Vision, Orchestrate, Launch, Transform) is a finance transformation practice that runs inside Claude Code:
specialist agents, multi-phase consulting workflows and finance method packs, built on a vetted harness stack.

## What you get

| Use | How |
|---|---|
| Ask VOLT anything; Rudra routes it to the right specialists and synthesises the answer | `/volt:ask <client situation and question>` |
| Run a full multi-phase engagement workflow (35 available) | `/volt:run-close-optimization`, `/volt:run-finance-assessment`, `/volt:run-bcar-capital-reporting`, ... |
| Find the right method pack among 378 VOLT skills | `/volt:find-skill <task>` |
| Scope an engagement against the 60-service catalogue | `/volt:services <engagement>` |
| Run a task inside the seven-layer harness (plan, checks, correction, handoff files) | `/volt:harness <task>`; [architecture](../docs/volt/HARNESS.md) |
| Delegate to one specialist | Any of the 236 agents, e.g. `volt:osfi-bcar-master`, `volt:sap-fico-specialist`, `volt:oracle-arcs-lead` |
| Client-ready files | Word, PowerPoint, Excel and PDF through Anthropic's document skills |

## Set up

```bash
git clone https://github.com/rshetty66/VOLT-Main && cd VOLT-Main
bash scripts/volt/setup-stack.sh        # Windows: powershell -ExecutionPolicy Bypass -File scripts\volt\setup-stack.ps1
```

This installs the whole stack at user level, so it works in every project. [VOLT_STACK.md](../VOLT_STACK.md) explains
each layer and the conflict rules (Superpowers on, GSD off, ECC without its planning loop).

## Repository layout

| Path | What it holds |
|---|---|
| [`plugins/volt/`](../plugins/volt) | The VOLT plugin: agents, workflow commands, skills, Skill Finder, services catalogue |
| [`plugins/volt/tools/import_volt.py`](../plugins/volt/tools/import_volt.py) | Rebuilds the plugin from a `volt_deploy` package |
| [`apps/volt-console/`](../apps/volt-console) | Browser console: React UI and Claude-powered multi-agent API over the plugin |
| [`scripts/volt/`](../scripts/volt) | Stack setup scripts, including the user-memory step for the harness rules |
| [`VOLT_STACK.md`](../VOLT_STACK.md) | The recommended Claude application stack and how VOLT applies it |
| everything else | **ECC**, the agent harness ([affaan-m/ecc](https://github.com/affaan-m/ecc) at `76aaa77`, MIT). Its README is the root [`README.md`](../README.md) |

## Foundation and credits

- ECC by Affaan Mustafa, MIT License. ECC's `LICENSE`, root `README.md` and sources are unchanged, apart from its
  GitHub automation: ECC's full CI matrix, skill-taste checks, stale-issue closer and metrics issue only run in the
  upstream `affaan-m/ECC` repository (a one-line `if:` guard on each job), and `CODEOWNERS` names this repository's owner.
  VOLT's own CI is `.github/workflows/volt.yml`: ECC's validators, the VOLT plugin checks and the console tests.
- VOLT skills vendored from third parties keep their provenance and licences in
  [`plugins/volt/THIRD_PARTY/`](../plugins/volt/THIRD_PARTY).

To pull ECC updates:

```bash
git remote add upstream https://github.com/affaan-m/ecc
git fetch upstream
```
