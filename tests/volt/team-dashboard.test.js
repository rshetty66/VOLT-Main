/**
 * Tests for scripts/volt/team-dashboard.js
 *
 * Run with: node tests/volt/team-dashboard.test.js
 */

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const mod = require(path.join(__dirname, '..', '..', 'scripts', 'volt', 'team-dashboard.js'));
const { deriveStage, summarize, loadTasks, demoTasks, createServer, parseArgs, STAGES } = mod;

let passed = 0;
let failed = 0;
const pending = [];

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
function testAsync(name, fn) {
  pending.push(() => fn().then(
    () => { console.log(`  PASS ${name}`); passed++; },
    (err) => { console.log(`  FAIL ${name}`); console.log(`    Error: ${err.message}`); failed++; }
  ));
}

const H = 'abc123';
const approved = { plan_approved_by: 'human' };

console.log('\nteam-dashboard: deriveStage');
test('no plan approval -> approval', () => assert.strictEqual(deriveStage({ task: {} }), 'approval'));
test('missing task.json -> approval', () => assert.strictEqual(deriveStage({}), 'approval'));
test('approved, no handoff -> building', () => assert.strictEqual(deriveStage({ task: approved }), 'building'));
test('handoff, no audit -> auditing', () =>
  assert.strictEqual(deriveStage({ task: approved, handoff: { head_sha: H } }), 'auditing'));
test('audit for an older sha is ignored -> auditing', () =>
  assert.strictEqual(deriveStage({ task: approved, handoff: { head_sha: H }, audit: { sha: 'old', verdict: 'approve' } }), 'auditing'));
test('audit changes_requested -> building', () =>
  assert.strictEqual(deriveStage({ task: approved, handoff: { head_sha: H }, audit: { sha: H, verdict: 'changes_requested' } }), 'building'));
test('audit approve -> verifying', () =>
  assert.strictEqual(deriveStage({ task: approved, handoff: { head_sha: H }, audit: { sha: H, verdict: 'approve' } }), 'verifying'));
test('verdict FAIL -> building (rework)', () =>
  assert.strictEqual(deriveStage({ task: approved, handoff: { head_sha: H }, audit: { sha: H, verdict: 'approve' }, verdict: { sha: H, result: 'FAIL' } }), 'building'));
test('verdict PASS -> review', () =>
  assert.strictEqual(deriveStage({ task: approved, handoff: { head_sha: H }, verdict: { sha: H, result: 'PASS' } }), 'review'));
test('verdict for an older sha is ignored', () =>
  assert.strictEqual(deriveStage({ task: approved, handoff: { head_sha: H }, verdict: { sha: 'old', result: 'PASS' } }), 'auditing'));
test('status escalated wins over everything', () =>
  assert.strictEqual(deriveStage({ task: { ...approved, status: 'escalated' }, verdict: { sha: H, result: 'PASS' } }), 'escalated'));
test('status pr_open -> review', () => assert.strictEqual(deriveStage({ task: { status: 'pr_open' } }), 'review'));
test('status merged or closed -> done', () => {
  assert.strictEqual(deriveStage({ task: { status: 'merged' } }), 'done');
  assert.strictEqual(deriveStage({ task: { status: 'closed' } }), 'done');
});

console.log('\nteam-dashboard: summarize and demo');
test('needs_you is set for approval, review and escalated only', () => {
  const s = (task) => summarize({ id: 'x', task }).needs_you;
  assert.strictEqual(s({}), true);
  assert.strictEqual(s({ status: 'pr_open' }), true);
  assert.strictEqual(s({ status: 'escalated' }), true);
  assert.strictEqual(s(approved), false);
  assert.strictEqual(s({ status: 'merged' }), false);
});
test('summarize tolerates non-array fields', () => {
  const t = summarize({ id: 'x', task: { scope: { allow: 'nope' } }, audit: { findings: 'nope' }, verdict: { gates: {} } });
  assert.deepStrictEqual(t.scope, []);
  assert.deepStrictEqual(t.findings, []);
  assert.deepStrictEqual(t.gates, []);
});
test('demo data covers every stage', () => {
  const stages = new Set(demoTasks().map((t) => deriveStage(t)));
  for (const s of STAGES) assert.ok(stages.has(s), `missing ${s}`);
});

console.log('\nteam-dashboard: loadTasks');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'team-dash-'));
const tasksDir = path.join(tmp, 'tasks');
fs.mkdirSync(path.join(tasksDir, 'gh-1'), { recursive: true });
fs.writeFileSync(path.join(tasksDir, 'gh-1', 'task.json'), JSON.stringify({ title: 'One', ...approved }));
fs.writeFileSync(path.join(tasksDir, 'gh-1', 'handoff.json'), JSON.stringify({ head_sha: H }));
fs.mkdirSync(path.join(tasksDir, 'gh-2'));
fs.writeFileSync(path.join(tasksDir, 'gh-2', 'task.json'), '{broken');
fs.mkdirSync(path.join(tasksDir, 'bad name'));
fs.writeFileSync(path.join(tasksDir, 'stray.json'), '{}');

test('reads task folders and derives stages', () => {
  const tasks = loadTasks(tmp).map(summarize).sort((a, b) => a.id.localeCompare(b.id));
  assert.deepStrictEqual(tasks.map((t) => t.id), ['gh-1', 'gh-2']);
  assert.strictEqual(tasks[0].stage, 'auditing');
  assert.strictEqual(tasks[0].title, 'One');
});
test('flags unreadable JSON instead of crashing', () => {
  const t = loadTasks(tmp).map(summarize).find((x) => x.id === 'gh-2');
  assert.deepStrictEqual(t.invalid_files, ['task']);
});
test('missing team dir gives an empty list', () => assert.deepStrictEqual(loadTasks(path.join(tmp, 'nope')), []));

console.log('\nteam-dashboard: parseArgs');
test('defaults and flags', () => {
  const o = parseArgs(['--demo', '--port', '5000', '--dir', tmp]);
  assert.strictEqual(o.demo, true);
  assert.strictEqual(o.port, 5000);
  assert.strictEqual(o.teamDir, path.resolve(tmp));
});
test('rejects an invalid port', () => assert.throws(() => parseArgs(['--port', 'abc'])));

console.log('\nteam-dashboard: HTTP server');
function get(port, urlPath, { host, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method,
      headers: { Host: host || `127.0.0.1:${port}` } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
function withServer(opts, fn) {
  return new Promise((resolve, reject) => {
    const probe = http.createServer().listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => {
        const srv = createServer({ ...opts, port }).listen(port, '127.0.0.1', () => {
          fn(port).then((v) => { srv.close(); resolve(v); }, (e) => { srv.close(); reject(e); });
        });
      });
    });
  });
}

testAsync('serves the page with a strict CSP', () => withServer({ teamDir: tmp }, async (port) => {
  const r = await get(port, '/');
  assert.strictEqual(r.status, 200);
  assert.match(r.body, /<title>VOLT Agent Team<\/title>/);
  assert.match(r.headers['content-security-policy'], /default-src 'none'/);
}));
testAsync('API returns tasks from the team dir', () => withServer({ teamDir: tmp }, async (port) => {
  const r = JSON.parse((await get(port, '/api/tasks')).body);
  assert.strictEqual(r.demo, false);
  assert.strictEqual(r.tasks.length, 2);
}));
testAsync('API returns demo tasks with --demo', () => withServer({ teamDir: tmp, demo: true }, async (port) => {
  const r = JSON.parse((await get(port, '/api/tasks')).body);
  assert.strictEqual(r.demo, true);
  assert.strictEqual(r.team_dir, null);
  assert.ok(r.tasks.length >= STAGES.length);
}));
testAsync('rejects a foreign Host header (DNS rebinding)', () => withServer({ teamDir: tmp }, async (port) => {
  assert.strictEqual((await get(port, '/api/tasks', { host: 'evil.example' })).status, 403);
}));
testAsync('rejects non-GET and unknown paths, including traversal', () => withServer({ teamDir: tmp }, async (port) => {
  assert.strictEqual((await get(port, '/api/tasks', { method: 'POST' })).status, 405);
  assert.strictEqual((await get(port, '/../package.json')).status, 404);
  assert.strictEqual((await get(port, '/tasks/gh-1/task.json')).status, 404);
}));

(async () => {
  for (const run of pending) await run();
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nResults: Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
})();
