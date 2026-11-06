/**
 * Tests for the hooks adopted from claude-code-templates (aitmpl):
 *   scripts/volt/hooks/readonly-agents.js  (wraps .claude/hooks/subagent-read-only-guard.py)
 *   scripts/volt/hooks/subagent-log.js
 *   the tdd-gate and scope-guard wiring in .claude/settings.json (VOLT_TEAM=1 only)
 *
 * Run with: node tests/volt/aitmpl-hooks.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..', '..');
const ro = require(path.join(root, 'scripts', 'volt', 'hooks', 'readonly-agents.js'));
const log = require(path.join(root, 'scripts', 'volt', 'hooks', 'subagent-log.js'));
const settings = JSON.parse(fs.readFileSync(path.join(root, '.claude', 'settings.json'), 'utf8'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL ${name}`);
    console.log(`    Error: ${err.message}`);
    failed++;
  }
}

const hasPython = spawnSync('python3', ['--version']).status === 0;
const hasJq = spawnSync('jq', ['--version']).status === 0;

function sub(agentType, tool, toolInput) {
  return { agent_id: 'a1', agent_type: agentType, tool_name: tool, tool_input: toolInput, hook_event_name: 'PreToolUse' };
}
function decision(stdout) {
  if (!stdout.trim()) return 'allow';
  return JSON.parse(stdout).hookSpecificOutput.permissionDecision;
}
function runCmd(command, input, env) {
  const r = spawnSync('bash', ['-c', command], {
    input: JSON.stringify(input), encoding: 'utf8', timeout: 15000,
    env: { ...process.env, VOLT_TEAM: '', CLAUDE_PROJECT_DIR: root, ...env },
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}
function hookCommands(event, needle) {
  return (settings.hooks[event] || []).flatMap((m) => m.hooks.map((h) => h.command)).filter((c) => c.includes(needle));
}

console.log('\nreadonly-agents: who is guarded');
test('main conversation (no agent_id) is never guarded', () =>
  assert.strictEqual(ro.isGuarded({ agent_type: 'code-auditor', tool_name: 'Write' }, {}), false));
test('listed subagent is guarded', () => assert.strictEqual(ro.isGuarded(sub('code-auditor', 'Write', {}), {}), true));
test('unlisted subagent (e.g. the builder) is not guarded', () =>
  assert.strictEqual(ro.isGuarded(sub('feature-builder', 'Write', {}), {}), false));
test('VOLT_READONLY_AGENTS overrides the list', () => {
  const env = { VOLT_READONLY_AGENTS: 'risk-manager, quant-analyst' };
  assert.strictEqual(ro.isGuarded(sub('risk-manager', 'Write', {}), env), true);
  assert.strictEqual(ro.isGuarded(sub('code-auditor', 'Write', {}), env), false);
});

console.log('\nreadonly-agents: guard decisions (python3 required)');
if (hasPython) {
  const guard = (input) => decision(ro.runGuard(JSON.stringify(input)));
  test('denies Write for a guarded agent', () => assert.strictEqual(guard(sub('code-auditor', 'Write', { file_path: 'x.js' })), 'deny'));
  test('denies a writing shell command', () =>
    assert.strictEqual(guard(sub('code-auditor', 'Bash', { command: 'echo hi > out.txt' })), 'deny'));
  test('denies git commit', () => assert.strictEqual(guard(sub('code-auditor', 'Bash', { command: 'git commit -m x' })), 'deny'));
  test('allows read-only git diff', () =>
    assert.strictEqual(guard(sub('code-auditor', 'Bash', { command: 'git diff main..HEAD' })), 'allow'));
  test('allows grep', () => assert.strictEqual(guard(sub('code-auditor', 'Bash', { command: "grep -rn 'TODO' scripts" })), 'allow'));
} else {
  console.log('  SKIP python3 not installed');
}
test('fails closed when the guard cannot run', () =>
  assert.strictEqual(decision(ro.runGuard(JSON.stringify(sub('code-auditor', 'Write', {})), '/nonexistent/guard.py')), 'deny'));

console.log('\nreadonly-agents: wiring in settings.json');
const roCmd = hookCommands('PreToolUse', 'readonly-agents.js')[0];
test('is wired on PreToolUse', () => assert.ok(roCmd));
if (hasPython && roCmd) {
  test('settings command denies a guarded subagent write', () =>
    assert.strictEqual(decision(runCmd(roCmd, sub('code-auditor', 'Edit', { file_path: 'a.js' })).stdout), 'deny'));
  test('settings command leaves the main conversation alone', () => {
    const r = runCmd(roCmd, { tool_name: 'Edit', tool_input: { file_path: 'a.js' } });
    assert.strictEqual(r.code, 0);
    assert.strictEqual(r.stdout, '');
  });
}
test('settings command exits 0 on malformed input', () => {
  const r = spawnSync('bash', ['-c', roCmd], { input: '{bad', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  assert.strictEqual(r.status, 0);
});

console.log('\nsubagent-log');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'subagent-log-'));
test('records agent_type, not "unknown"', () => {
  const e = log.entry({ hook_event_name: 'SubagentStart', agent_type: 'code-auditor', agent_id: 'a1', session_id: 's1' }, new Date(0));
  assert.deepStrictEqual(e, { schema_version: 1, ts: '1970-01-01T00:00:00.000Z', event: 'SubagentStart',
    agent_type: 'code-auditor', agent_id: 'a1', session_id: 's1' });
});
test('ignores other events', () => assert.strictEqual(log.entry({ hook_event_name: 'PreToolUse', agent_type: 'x' }), null));
test('appends one line per event under CLAUDE_PROJECT_DIR/.claude', () => {
  const env = { CLAUDE_PROJECT_DIR: tmp };
  log.record({ hook_event_name: 'SubagentStart', agent_type: 'a' }, env);
  log.record({ hook_event_name: 'SubagentStop', agent_type: 'a' }, env);
  const lines = fs.readFileSync(path.join(tmp, '.claude', 'agent-log.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepStrictEqual(lines.map((l) => l.event), ['SubagentStart', 'SubagentStop']);
});
test('caps long field values', () =>
  assert.strictEqual(log.entry({ hook_event_name: 'SubagentStart', agent_type: 'x'.repeat(500) }).agent_type.length, 200));
test('is wired on SubagentStart and SubagentStop', () => {
  assert.ok(hookCommands('SubagentStart', 'subagent-log.js').length);
  assert.ok(hookCommands('SubagentStop', 'subagent-log.js').length);
});
test('settings command exits 0 on malformed input', () => {
  const cmd = hookCommands('SubagentStart', 'subagent-log.js')[0];
  const r = spawnSync('bash', ['-c', cmd], { input: '{bad', encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
  assert.strictEqual(r.status, 0);
  assert.match(r.stderr, /\[subagent-log\] skipped/);
});

console.log('\ntdd-gate and scope-guard: only with VOLT_TEAM=1');
const tddPre = hookCommands('PreToolUse', 'tdd-gate.sh')[0];
const tddStop = hookCommands('Stop', 'tdd-gate.sh')[0];
const scopeStop = hookCommands('Stop', 'scope-guard.sh')[0];
const prodEdit = { hook_event_name: 'PreToolUse', session_id: `t${process.pid}`, tool_name: 'Edit',
  cwd: root, tool_input: { file_path: path.join(root, 'src', 'example.js') } };
test('tdd-gate is wired on PreToolUse, PostToolUse, PostToolUseFailure and Stop', () => {
  for (const ev of ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Stop']) assert.ok(hookCommands(ev, 'tdd-gate.sh').length, ev);
});
test('tdd-gate does nothing without VOLT_TEAM', () => {
  const r = runCmd(tddPre, prodEdit, {});
  assert.strictEqual(r.code, 0);
  assert.strictEqual(r.stdout, '');
});
if (hasJq) {
  test('tdd-gate blocks a production edit with no failing test when VOLT_TEAM=1', () => {
    const r = runCmd(tddPre, prodEdit, { VOLT_TEAM: '1', TMPDIR: tmp });
    assert.strictEqual(decision(r.stdout), 'deny');
    assert.match(r.stdout, /TDD gate/);
  });
  test('tdd-gate never blocks a test file', () => {
    const input = { ...prodEdit, tool_input: { file_path: path.join(root, 'tests', 'x.test.js') } };
    assert.strictEqual(runCmd(tddPre, input, { VOLT_TEAM: '1', TMPDIR: tmp }).stdout, '');
  });
} else {
  console.log('  SKIP jq not installed');
}
test('tdd-gate Stop does nothing without VOLT_TEAM', () =>
  assert.strictEqual(runCmd(tddStop, { hook_event_name: 'Stop', session_id: 'x' }, {}).stdout, ''));
test('scope-guard never blocks (warning only) and is off without VOLT_TEAM', () => {
  assert.strictEqual(runCmd(scopeStop, { hook_event_name: 'Stop' }, {}).code, 0);
  assert.strictEqual(runCmd(scopeStop, { hook_event_name: 'Stop' }, { VOLT_TEAM: '1' }).code, 0);
});

console.log('\nStripe confirm-writes');
test('money-moving Stripe tools ask first', () => {
  for (const t of ['mcp__stripe__send_money', 'mcp__stripe__transfer_money', 'mcp__stripe__stripe_api_write']) {
    assert.ok(settings.permissions.ask.includes(t), t);
  }
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
