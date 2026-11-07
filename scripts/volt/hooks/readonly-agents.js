#!/usr/bin/env node
'use strict';

/**
 * readonly-agents: applies the vendored subagent-read-only-guard to named
 * subagents only.
 *
 * The guard (.claude/hooks/subagent-read-only-guard.py, from
 * claude-code-templates) blocks writes for every subagent. VOLT agents that
 * write deliverables, and the agent-team builder, must keep writing, so this
 * wrapper hands the call to the guard only when the subagent's agent_type is
 * in the read-only list. The list is READONLY_AGENTS below, or the
 * comma-separated VOLT_READONLY_AGENTS when set. For listed agents it fails
 * closed: if the guard cannot run, the call is denied.
 */

const path = require('path');
const { spawnSync } = require('child_process');

const READONLY_AGENTS = ['code-auditor', 'ai-agent-audit-specialist', 'compliance-auditor', 'data-researcher'];
const GUARD = path.join(__dirname, '..', '..', '..', '.claude', 'hooks', 'subagent-read-only-guard.py');

function readonlyList(env) {
  const raw = env.VOLT_READONLY_AGENTS;
  if (typeof raw !== 'string' || !raw.trim()) return READONLY_AGENTS;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** True when this hook call comes from a subagent on the read-only list. */
function isGuarded(input, env = process.env) {
  if (!input || typeof input !== 'object' || !input.agent_id) return false;
  return readonlyList(env).includes(input.agent_type);
}

function denyJson(reason) {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  });
}

/** Runs the guard for a guarded call. Returns the text to print on stdout. */
function runGuard(raw, guardPath = GUARD) {
  const r = spawnSync('python3', ['-I', guardPath], { input: raw, encoding: 'utf8', timeout: 10000 });
  if (r.error || r.status !== 0) {
    return denyJson('Blocked by readonly-agents: the read-only guard could not run, so this call is denied.');
  }
  return r.stdout || '';
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    let input;
    try {
      input = JSON.parse(raw);
    } catch {
      process.stderr.write('[readonly-agents] could not parse hook input; allowing\n');
      process.exit(0);
    }
    if (isGuarded(input)) process.stdout.write(runGuard(raw));
    process.exit(0);
  });
}

if (require.main === module) main();

module.exports = { isGuarded, runGuard, readonlyList, READONLY_AGENTS };
