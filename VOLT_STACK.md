# VOLT Claude application stack

Last verified: 2026-10-15, Claude Code 2.1.301. Every install below was run end to end in a clean configuration
before it was written down (see "How this was verified").

## Core stack

| # | Layer | Official source | How VOLT installs it | Status in VOLT |
|---|---|---|---|---|
| 1 | Behaviour rules | [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) | Plugin `andrej-karpathy-skills@karpathy-skills` | Always on. The four rules are also summarised in `CLAUDE.md` |
| 2 | Harness and ops | [affaan-m/ECC](https://github.com/affaan-m/ecc), vendored here | ECC's own selective installer (`install.sh` / `install.ps1`) | Hooks, rules, reviewer agents, memory and security skills only. No planning or TDD loop |
| 3 | Development method (primary) | [obra/superpowers](https://github.com/obra/superpowers) | Plugin `superpowers@claude-plugins-official` | On. Owns brainstorm, plan, TDD, debug and verify |
| 4 | Context engineering (secondary) | [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) | Plugin `gsd-core@gsd-core` (or `npx @opengsd/gsd-core@latest`, per its README) | Registered but **off**. Enable only for long, multi-day, multi-file work |
| 5 | Official skills and plugins | [anthropics/skills](https://github.com/anthropics/skills), [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | Plugin `document-skills@anthropic-agent-skills` | On. docx, pptx, xlsx and pdf for client deliverables |
| + | VOLT practice | this repository | Plugin `volt@volt-main` from `plugins/` | On. Agents, workflows, skills, Skill Finder |
| + | Harness rules | this repository | `scripts/volt/install-memory` imports them into `~/.claude/CLAUDE.md` | On in every project. Full run: `/volt:harness`. See [docs/volt/HARNESS.md](docs/volt/HARNESS.md) |
| + | Anatomy skill | [wheresryan22/anatomy](https://github.com/wheresryan22/anatomy) (MIT) | `npx skills add wheresryan22/anatomy -g -a claude-code` into `~/.claude/skills/anatomy` | On in every project. `/anatomy <idea>` builds an interactive isometric figure. Needs Node 22.20+ for the skills CLI |

## Set it up

```bash
bash scripts/volt/setup-stack.sh             # macOS / Linux / Git Bash
bash scripts/volt/setup-stack.sh --dry-run   # show what would happen
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\volt\setup-stack.ps1   # Windows
```

The script installs at user level (`~/.claude`), so the stack applies in every project, including client work outside
this repository. It needs `node` and the `claude` CLI on the path.

Opening this repository in Claude Code also registers the same marketplaces and enables the same plugins through
`.claude/settings.json`. Claude Code asks you to trust them on first open.

## Overlap and conflict rules

- **Superpowers and GSD.** Both own a plan-and-execute loop, so never enable both in one project. Superpowers is the default.
  For a long-running project, switch per project: set `"superpowers@claude-plugins-official": false` and
  `"gsd-core@gsd-core": true` in that project's `.claude/settings.json`.
- **ECC and Superpowers.** ECC also ships planning, TDD and verification-loop skills and commands. A plugin's skills
  cannot be switched off one by one from settings (`skillOverrides` does not apply to plugin skills), so VOLT installs
  ECC with its own selective installer and leaves those modules out:
  - Installed: `rules-core`, `agents-core` (reviewers and specialists), `hooks-runtime`, `platform-configs`, `skill-unified-memory`, `research-apis`, `business-content`.
  - Installed by name: the `security-scan`, `agent-security-hardening`, `mcp-dependency-review`, `safety-guard` and `gateguard` skills.
  - Not installed: `workflow-quality` (TDD, verification loop, plan canvas, santa loop) and `commands-core` (`/plan`, `/tdd`, `/orch-*`).
    ECC's `security` module is skipped too, because it depends on `workflow-quality`; ECC's `security-reviewer` agent covers that review.
- **Karpathy rules** apply everywhere and conflict with nothing.

## GitHub Actions

ECC's workflows are kept because ECC's tests read them, but its heavy or project-specific jobs (the 45-minute
Linux/Windows/macOS CI matrix, skill-taste checks, stale-issue closer, metrics issue) are guarded with
`if: github.repository == 'affaan-m/ECC'`, so they do not spend this repository's Actions minutes or touch its issues.
`.github/workflows/volt.yml` is VOLT's CI: one Linux job running ECC's validators, the VOLT plugin checks and the console tests.

## Security

Install only from the official sources linked above: GitHub `affaan-m/ECC`, npm `ecc-universal` / `ecc-agentshield`, or ecc.tools for ECC.
Forks and mirrors (for example `affaann-m/...`, `anhstudio/...`, `qo-kr/...` or gitcode mirrors) are not approved.
The ECC copy in this repository was taken from `github.com/affaan-m/ecc` at commit `76aaa77`.

The Anatomy skill is a third-party skill installed from `github.com/wheresryan22/anatomy`, and the skills CLI installs its
default branch. It was reviewed at commit `1482e84`: it runs a local headless Chrome for checks and publishes to its
community gallery only on an explicit yes. Re-review before relying on a newer version.

## Watchlist (not installed)

- [obra/superpowers-lab](https://github.com/obra/superpowers-lab): experimental skills (mcp-cli, tmux control).
- [obra/superpowers-developing-for-claude-code](https://github.com/obra/superpowers-developing-for-claude-code): building your own plugins and skills.
- [anthropics/claude-plugins-community](https://github.com/anthropics/claude-plugins-community): community marketplace (read-only mirror).
- [jokim1/karpathy-skills](https://github.com/jokim1/karpathy-skills): `/karpathy:audit` and `/karpathy:diff` review commands.

## How this was verified

On 2026-10-15, in an empty home directory:

- `scripts/volt/setup-stack.sh` ran end to end. All four plugins installed and showed as enabled in `claude plugin list`.
- The ECC install placed 30 skills, none of them `tdd-workflow`, `verification-loop`, `plan-canvas`, `santa-method` or `orch-*`.
- `claude plugin validate` passed for `plugins/` and `plugins/volt`.

On 2026-10-23, with `HOME` pointed at an empty directory, `npx --yes skills add wheresryan22/anatomy -g -a claude-code -y`
installed `anatomy` into `~/.claude/skills/anatomy` (Node 22.22.0). `setup-stack.sh` as a whole was not re-run for this step.
