/**
 * Tests for scripts/volt/hooks/loop-breaker.js
 *
 * Run with: node tests/volt/loop-breaker.test.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', '..', 'scripts', 'volt', 'hooks', 'loop-breaker.js');
const { record } = require(script);

const ON = { VOLT_TEAM: '1' };
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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loop-breaker-'));
let n = 0;
function session() { n++; return `s${n}`; }

function fail(sid, command, error, env = ON) {
  return record({ hook_event_name: 'PostToolUseFailure', session_id: sid, tool_name: 'Bash',
    tool_input: { command }, error }, env, dir);
}
function ok(sid, command) {
  return record({ hook_event_name: 'PostToolUse', session_id: sid, tool_name: 'Bash',
    tool_input: { command }, tool_response: { stdout: 'ok' } }, ON, dir);
}

console.log('\nloop-breaker');
test('blocks on the 3rd identical failure', () => {
  const s = session();
  assert.strictEqual(fail(s, 'npm test', 'boom\nAssertionError: x'), null);
  assert.strictEqual(fail(s, 'npm test', 'other\nAssertionError: x'), null);
  assert.match(fail(s, 'npm test', 'more\nAssertionError: x'), /failed 3 times/);
});
test('a different error resets the count', () => {
  const s = session();
  fail(s, 'npm test', 'AssertionError: a');
  fail(s, 'npm test', 'AssertionError: a');
  assert.strictEqual(fail(s, 'npm test', 'TypeError: b'), null);
});
test('a success clears the count', () => {
  const s = session();
  fail(s, 'npm test', 'E');
  fail(s, 'npm test', 'E');
  ok(s, 'npm test');
  assert.strictEqual(fail(s, 'npm test', 'E'), null);
});
test('different commands are counted separately', () => {
  const s = session();
  fail(s, 'npm test', 'E');
  fail(s, 'npm run lint', 'E');
  assert.strictEqual(fail(s, 'npm test', 'E'), null);
});
test('sessions are counted separately', () => {
  const a = session();
  const b = session();
  fail(a, 'npm test', 'E');
  fail(a, 'npm test', 'E');
  assert.strictEqual(fail(b, 'npm test', 'E'), null);
});
test('VOLT_LOOP_LIMIT changes the threshold', () => {
  const s = session();
  const env = { ...ON, VOLT_LOOP_LIMIT: '2' };
  fail(s, 'npm test', 'E', env);
  assert.ok(fail(s, 'npm test', 'E', env));
});
test('message never echoes the command or error text', () => {
  const s = session();
  const secret = 'ghp_SECRETVALUE';
  fail(s, `curl -H "x: ${secret}"`, secret);
  fail(s, `curl -H "x: ${secret}"`, secret);
  const msg = fail(s, `curl -H "x: ${secret}"`, secret);
  assert.ok(msg && !msg.includes(secret));
});
test('inactive without VOLT_TEAM=1', () => {
  const s = session();
  for (let i = 0; i < 5; i++) assert.strictEqual(fail(s, 'npm test', 'E', {}), null);
});
test('CLI exits 0 on malformed JSON', () => {
  const r = spawnSync('node', [script], { encoding: 'utf8', input: '{bad', env: { ...process.env, ...ON } });
  assert.strictEqual(r.status, 0);
});

fs.rmSync(dir, { recursive: true, force: true });
console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
