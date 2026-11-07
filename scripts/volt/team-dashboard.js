#!/usr/bin/env node
'use strict';

/**
 * VOLT agent team dashboard: a read-only local page over .volt-team/tasks/.
 *
 *   node scripts/volt/team-dashboard.js [--demo] [--dir <team dir>] [--port 4317]
 *
 * Each task folder holds the files the agents hand off (task.json,
 * handoff.json, audit.json, verdict.json, progress.md). The stage of each
 * task is derived from which files exist and what they say. --demo serves
 * built-in sample tasks instead. Binds to 127.0.0.1 only, serves two fixed
 * routes, never writes, and rejects foreign Host headers.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const ID = /^[A-Za-z0-9._-]{1,80}$/;
const MAX_BYTES = 1024 * 1024;
const PAGE = path.join(__dirname, 'team-dashboard.html');

const STAGES = ['approval', 'building', 'auditing', 'verifying', 'review', 'escalated', 'done'];

function readFileSafe(file) {
  try {
    const st = fs.lstatSync(file);
    if (!st.isFile() || st.size > MAX_BYTES) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function readJson(file) {
  const s = readFileSafe(file);
  if (s === null) return null;
  try { return JSON.parse(s); } catch { return { _invalid: true }; }
}

function loadTask(dir, id) {
  const progress = readFileSafe(path.join(dir, 'progress.md'));
  return {
    id,
    task: readJson(path.join(dir, 'task.json')),
    handoff: readJson(path.join(dir, 'handoff.json')),
    audit: readJson(path.join(dir, 'audit.json')),
    verdict: readJson(path.join(dir, 'verdict.json')),
    progress: progress === null ? null : progress.slice(-4000),
  };
}

function loadTasks(teamDir) {
  const root = path.join(teamDir, 'tasks');
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => e.isDirectory() && ID.test(e.name))
    .map((e) => loadTask(path.join(root, e.name), e.name));
}

/** Which column a task belongs in, from the files its agents have written. */
function deriveStage(t) {
  const task = t.task || {};
  const head = t.handoff && t.handoff.head_sha;
  const status = task.status;
  if (status === 'escalated') return 'escalated';
  if (status === 'merged' || status === 'closed') return 'done';
  if (status === 'pr_open' || task.pr_url) return 'review';
  if (!task.plan_approved_by) return 'approval';
  if (!head) return 'building';
  const verdict = t.verdict && t.verdict.sha === head ? t.verdict : null;
  if (verdict) return verdict.result === 'PASS' ? 'review' : 'building';
  const audit = t.audit && t.audit.sha === head ? t.audit : null;
  if (!audit) return 'auditing';
  return audit.verdict === 'approve' ? 'verifying' : 'building';
}

function val(obj, key) {
  return (obj && obj[key]) || null;
}

function list(obj, key) {
  return (obj && Array.isArray(obj[key])) ? obj[key] : [];
}

function summarize(t) {
  const task = t.task || {};
  const stage = deriveStage(t);
  return {
    id: t.id,
    title: task.title || t.id,
    type: val(task, 'type'),
    issue_url: val(task, 'issue_url'),
    branch: val(task, 'branch') || val(t.handoff, 'branch'),
    pr_url: val(task, 'pr_url'),
    round: task.round || 1,
    max_attempts: task.max_attempts || 3,
    stage,
    needs_you: stage === 'approval' || stage === 'review' || stage === 'escalated',
    escalation_reason: val(task, 'escalation_reason'),
    scope: list(task.scope, 'allow'),
    head_sha: val(t.handoff, 'head_sha'),
    files_changed: list(t.handoff, 'files_changed'),
    assumptions: list(t.handoff, 'assumptions'),
    open_questions: list(t.handoff, 'open_questions'),
    audit_verdict: val(t.audit, 'verdict'),
    findings: list(t.audit, 'findings'),
    verdict: val(t.verdict, 'result'),
    gates: list(t.verdict, 'gates'),
    failure_reason: val(t.verdict, 'failure_reason'),
    progress: t.progress,
    invalid_files: ['task', 'handoff', 'audit', 'verdict'].filter((k) => t[k] && t[k]._invalid),
  };
}

function demoTasks() {
  const h = 'a1b2c3d';
  const gates = (fail) => ['red_on_base', 'green_on_head', 'npm_test', 'lint', 'volt_validators', 'scope', 'secrets', 'deps_unchanged']
    .map((name) => ({ name, pass: name !== fail }));
  return [
    { id: 'gh-151', task: { title: 'Skill finder ranks deprecated skills first', type: 'bug', branch: 'agent/gh-151-skill-rank',
      scope: { allow: ['scripts/lib/skill-rank.js', 'tests/lib/skill-rank.test.js'] } } },
    { id: 'gh-148', task: { title: 'validate-volt-plugin crashes on empty skills dir', type: 'bug', plan_approved_by: 'human',
      branch: 'agent/gh-148-empty-skills', scope: { allow: ['scripts/ci/validate-volt-plugin.js'] } },
      progress: '- 10:02 builder: repro test written, fails as expected\n- 10:09 builder: fix in progress' },
    { id: 'gh-145', task: { title: 'Unicode check misses zero-width joiners', type: 'bug', plan_approved_by: 'human', branch: 'agent/gh-145-zwj' },
      handoff: { head_sha: h, files_changed: ['scripts/ci/check-unicode-safety.js', 'tests/ci/unicode.test.js'], assumptions: ['U+200D is never valid in repo text'] } },
    { id: 'gh-142', task: { title: 'Hook crashes on null file path', type: 'bug', plan_approved_by: 'human', round: 2, branch: 'agent/gh-142-null-path' },
      handoff: { head_sha: h, files_changed: ['scripts/lib/foo.js', 'tests/lib/foo.test.js'] },
      audit: { sha: h, verdict: 'approve', findings: [{ severity: 'minor', file: 'scripts/lib/foo.js', line: 41, claim: 'Windows separators not normalised', failure_scenario: 'C:\\x -> treated as relative' }] } },
    { id: 'gh-139', task: { title: 'Command registry drops aliases with dots', type: 'bug', plan_approved_by: 'human', status: 'pr_open', branch: 'agent/gh-139-alias-dots' },
      handoff: { head_sha: h, files_changed: ['scripts/command-registry.js', 'tests/scripts/command-registry.test.js'] },
      audit: { sha: h, verdict: 'approve', findings: [] }, verdict: { sha: h, result: 'PASS', gates: gates() } },
    { id: 'gh-133', task: { title: 'Upgrade markdownlint to fix false positive', type: 'chore', status: 'escalated',
      escalation_reason: 'Needs a dependency change: human sign-off required' } },
    { id: 'gh-131', task: { title: 'Catalog sync ignores hand-written skills', type: 'bug', plan_approved_by: 'human', round: 3, branch: 'agent/gh-131-catalog' },
      handoff: { head_sha: h }, audit: { sha: h, verdict: 'approve', findings: [] },
      verdict: { sha: h, result: 'FAIL', gates: gates('scope'), failure_reason: 'scope: plugins/volt/data/catalog.json is not in scope.allow' } },
    { id: 'gh-120', task: { title: 'Session start hook leaks temp files', type: 'bug', plan_approved_by: 'human', status: 'merged' } },
  ];
}

function createServer({ teamDir, demo = false, port = 4317 } = {}) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  return http.createServer((req, res) => {
    const send = (code, type, body) => {
      res.writeHead(code, {
        'Content-Type': type,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'",
      });
      res.end(body);
    };
    if (!allowedHosts.has(req.headers.host)) return send(403, 'text/plain', 'Forbidden host');
    if (req.method !== 'GET') return send(405, 'text/plain', 'Method not allowed');
    const url = req.url.split('?')[0];
    if (url === '/') {
      const html = readFileSafe(PAGE);
      return html === null ? send(500, 'text/plain', 'Page missing') : send(200, 'text/html; charset=utf-8', html);
    }
    if (url === '/api/tasks') {
      const tasks = (demo ? demoTasks() : loadTasks(teamDir)).map(summarize);
      return send(200, 'application/json', JSON.stringify({ demo, team_dir: demo ? null : teamDir, stages: STAGES, tasks }));
    }
    return send(404, 'text/plain', 'Not found');
  });
}

function parseArgs(argv) {
  const opts = { demo: false, port: 4317, teamDir: process.env.VOLT_TEAM_DIR || path.resolve('.volt-team') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--demo') opts.demo = true;
    else if (argv[i] === '--port') opts.port = parseInt(argv[++i], 10);
    else if (argv[i] === '--dir') opts.teamDir = path.resolve(argv[++i]);
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) throw new Error('invalid --port');
  return opts;
}

if (require.main === module) {
  const opts = parseArgs(process.argv.slice(2));
  createServer(opts).listen(opts.port, '127.0.0.1', () => {
    const src = opts.demo ? 'demo data' : opts.teamDir;
    console.log(`VOLT team dashboard on http://localhost:${opts.port}  (${src})`);
  });
}

module.exports = { deriveStage, summarize, loadTasks, demoTasks, createServer, parseArgs, STAGES };
