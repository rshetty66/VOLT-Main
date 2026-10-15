#!/usr/bin/env bash
# Install the VOLT Claude Code stack at user level (~/.claude), so it applies in every project.
#
#   1. Karpathy behaviour rules     andrej-karpathy-skills@karpathy-skills
#   2. ECC, selectively             hooks, rules, reviewer agents, memory, security skills
#                                   (no planning/TDD loop: Superpowers owns that)
#   3. Superpowers (primary method) superpowers@claude-plugins-official
#   4. GSD                          NOT installed: enable only for long multi-day work, never with Superpowers
#   5. Anthropic document skills    document-skills@anthropic-agent-skills
#   +  VOLT                         volt@volt-main, from this repository's plugins/ marketplace
#
# Usage: bash scripts/volt/setup-stack.sh [--dry-run]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

run() { echo "+ $*"; [ -n "$DRY" ] || "$@"; }
need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing required command: $1" >&2; exit 1; }; }
need node
need claude

echo "== ECC (selective install: no planning/TDD loop skills)"
bash "$REPO/install.sh" --target claude $DRY --enable-hooks \
  --modules rules-core,agents-core,hooks-runtime,platform-configs,skill-unified-memory,research-apis,business-content
bash "$REPO/install.sh" --target claude $DRY \
  --skills security-scan,agent-security-hardening,mcp-dependency-review,safety-guard,gateguard

echo "== Marketplaces"
run claude plugin marketplace add forrestchang/andrej-karpathy-skills
run claude plugin marketplace add anthropics/claude-plugins-official
run claude plugin marketplace add anthropics/skills
run claude plugin marketplace add "$REPO/plugins"

echo "== Plugins"
run claude plugin install andrej-karpathy-skills@karpathy-skills
run claude plugin install superpowers@claude-plugins-official
run claude plugin install document-skills@anthropic-agent-skills
run claude plugin install volt@volt-main

echo
echo "Done. GSD is intentionally not installed; see VOLT_STACK.md before enabling it on a long-running project."
