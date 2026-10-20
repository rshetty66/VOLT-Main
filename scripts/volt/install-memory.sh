#!/usr/bin/env bash
# Add the VOLT harness rules to Claude Code user memory, so they load in every project.
#
#   copies plugins/volt/memory/harness-rules.md  ->  ~/.claude/volt-harness.md
#   appends one import line to ~/.claude/CLAUDE.md (once; a backup is taken first)
#
# Usage: bash scripts/volt/install-memory.sh [--dry-run]
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="--dry-run"

SRC="$REPO/plugins/volt/memory/harness-rules.md"
DIR="$HOME/.claude"
RULES="$DIR/volt-harness.md"
MEMORY="$DIR/CLAUDE.md"
MARKER="<!-- volt-harness: managed by VOLT-Main scripts/volt/install-memory -->"

run() { echo "+ $*"; [ -n "$DRY" ] || "$@"; }

run mkdir -p "$DIR"
run cp "$SRC" "$RULES"

if [ -f "$MEMORY" ] && grep -qF "$MARKER" "$MEMORY"; then
  echo "= $MEMORY already imports volt-harness.md"
  exit 0
fi
if [ -f "$MEMORY" ]; then
  run cp "$MEMORY" "$MEMORY.bak-$(date +%Y%m%d%H%M%S)"
fi
echo "+ append import of ~/.claude/volt-harness.md to $MEMORY"
if [ -z "$DRY" ]; then
  {
    [ -s "$MEMORY" ] && printf '\n'
    printf '%s\n@~/.claude/volt-harness.md\n' "$MARKER"
  } >> "$MEMORY"
fi
