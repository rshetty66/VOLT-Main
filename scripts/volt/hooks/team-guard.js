#!/usr/bin/env node
'use strict';

/**
 * team-guard: PreToolUse guard for the VOLT agent team.
 *
 * Active only when VOLT_TEAM=1 (set when launching the team), so normal
 * sessions are unaffected. Blocks (exit 2) destructive shell commands,
 * merges, secret exposure, dependency changes, edits to generated VOLT
 * files and protected paths, and writes into another git worktree.
 * Malformed input exits 0 with a log line; the settings.json permissions
 * deny list is the second layer.
 */

const fs = require('fs');
const path = require('path');

const GENERATED = new RegExp(
  '^plugins/volt/(agents/|commands/run-[^/]+\\.md$|data/|THIRD_PARTY/|' +
  'skills/(?!(volt-skill-finder|volt-services|design-finance-architecture)/))'
);
const PROTECTED = /^(\.git\/|\.github\/|\.claude\/|scripts\/volt\/hooks\/)|(^|\/)(package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.gitignore)$/;
const ENV_FILE = /(^|[/'"=\s])\.env(\.[\w.-]+)?(['"\s]|$)/;
const ENV_TEMPLATE = /\.env\.(example|sample|template)\b/;
const SECRET_VAR = /\$\{?[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|CREDENTIAL)[A-Z0-9_]*\}?/;

function segments(command) {
  return String(command)
    .split(/&&|\|\||[;|&\n]/)
    .map((s) => s.trim().split(/\s+/).filter(Boolean))
    .map((t) => {
      while (t.length && (t[0] === 'sudo' || /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0]))) t.shift();
      return t;
    })
    .filter((t) => t.length);
}

function hasFlag(args, short, long) {
  return args.some((a) => (long && (a === long || a.startsWith(long + '='))) ||
    (short && /^-[a-zA-Z]+$/.test(a) && a.includes(short)));
}

function checkGitPush(args) {
  if (hasFlag(args, 'f', '--force') || args.some((a) => a.startsWith('--force-with-lease'))) return 'force push';
  if (hasFlag(args, 'd', '--delete') || args.includes('--mirror')) return 'remote branch deletion';
  if (args.includes('--no-verify')) return 'skipping git hooks';
  const positional = args.filter((a) => !a.startsWith('-'));
  const refspecs = positional.slice(1);
  if (!refspecs.length) return 'push without an explicit agent/* branch';
  for (const spec of refspecs) {
    if (spec.startsWith('+')) return 'force push';
    const dest = spec.includes(':') ? spec.split(':')[1] : spec;
    if (!/^(refs\/heads\/)?agent\/./.test(dest)) return 'push outside agent/* branches';
  }
  return null;
}

const HISTORY_REWRITE = () => 'history rewrite';
const GIT_SUBCOMMANDS = {
  push: checkGitPush,
  reset: (r) => (r.includes('--hard') ? 'git reset --hard' : null),
  clean: (r) => (hasFlag(r, 'f', '--force') ? 'git clean -f' : null),
  branch: (r) => ((r.includes('-D') || (hasFlag(r, 'd', '--delete') && hasFlag(r, 'f', '--force')))
    ? 'force branch delete' : null),
  worktree: (r) => (r[0] === 'remove' && hasFlag(r.slice(1), 'f', '--force') ? 'forced worktree removal' : null),
  rebase: HISTORY_REWRITE,
  'filter-branch': HISTORY_REWRITE,
  'filter-repo': HISTORY_REWRITE,
  'update-ref': (r) => (r.includes('-d') ? 'ref deletion' : null),
  commit: (r) => (r.includes('--no-verify') || hasFlag(r, 'n') ? 'skipping git hooks' : null),
  merge: () => 'merge is human-only',
};

function checkGit(args) {
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) i += (args[i] === '-C' || args[i] === '-c') ? 2 : 1;
  const check = Object.prototype.hasOwnProperty.call(GIT_SUBCOMMANDS, args[i]) ? GIT_SUBCOMMANDS[args[i]] : null;
  return check ? check(args.slice(i + 1)) : null;
}

const PKG_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];
const PKG_MUTATIONS = ['install', 'i', 'add', 'uninstall', 'remove', 'rm', 'update', 'upgrade', 'up'];

const SEGMENT_RULES = [
  (n, a) => (n === 'rm' && (hasFlag(a, 'r', '--recursive') || hasFlag(a, 'R')) && hasFlag(a, 'f', '--force')
    ? 'recursive force delete' : null),
  (n, a) => (n === 'git' ? checkGit(a) : null),
  (n, a) => (n === 'gh' && a[0] === 'pr' && ['merge', 'ready', 'review'].includes(a[1])
    ? 'merge/ready/review is human-only' : null),
  (n, a) => (n === 'printenv' || (['env', 'set'].includes(n) && !a.length) ||
    (['export', 'declare'].includes(n) && (a.includes('-p') || a.includes('-x')))
    ? 'dumping environment variables' : null),
  (n, a) => (['echo', 'printf'].includes(n) && SECRET_VAR.test(a.join(' ')) ? 'printing a secret variable' : null),
  (n, a) => ((PKG_MANAGERS.includes(n) && PKG_MUTATIONS.includes(a[0])) || (/^pip3?$/.test(n) && a[0] === 'install')
    ? 'dependency change needs a human' : null),
];

function checkBash(command) {
  const cmd = String(command || '');
  if (/\bdrop\s+(table|database|schema)\b|\btruncate\s+table\b/i.test(cmd)) return 'destructive SQL';
  if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|node|python3?)\b/.test(cmd)) return 'piping a download into a shell';
  if (ENV_FILE.test(cmd) && !ENV_TEMPLATE.test(cmd)) return 'reading an .env file';
  for (const [name, ...args] of segments(cmd)) {
    for (const rule of SEGMENT_RULES) {
      const why = rule(name, args);
      if (why) return why;
    }
  }
  return null;
}

function gitRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function checkWrite(filePath, cwd, env) {
  const base = cwd || process.cwd();
  const fp = path.resolve(base, filePath);
  const teamDir = env.VOLT_TEAM_DIR ? path.resolve(env.VOLT_TEAM_DIR) : '';
  if (teamDir && fp.startsWith(teamDir + path.sep)) return null;
  const ownRoot = gitRoot(base);
  const fileRoot = gitRoot(path.dirname(fp));
  if (!ownRoot || fileRoot !== ownRoot) return 'write outside own worktree';
  const rel = path.relative(ownRoot, fp).split(path.sep).join('/');
  if (GENERATED.test(rel)) return 'generated VOLT file; change plugins/volt/tools/import_volt.py instead';
  if (PROTECTED.test(rel)) return `protected path ${rel}`;
  if (/(^|\/)\.env(\.[\w.-]+)?$/.test(rel) && !ENV_TEMPLATE.test(rel)) return 'writing an .env file';
  return null;
}

/** Returns a block reason, or null to allow. */
function evaluate(input, env = process.env) {
  if (env.VOLT_TEAM !== '1' || !input || typeof input !== 'object') return null;
  const ti = input.tool_input || {};
  if (input.tool_name === 'Bash') return checkBash(ti.command);
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(input.tool_name)) {
    const fp = ti.file_path || ti.notebook_path;
    return fp ? checkWrite(fp, input.cwd, env) : null;
  }
  return null;
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
      process.stderr.write('[team-guard] could not parse hook input; allowing\n');
      process.exit(0);
    }
    const reason = evaluate(input);
    if (reason) {
      process.stderr.write(`[team-guard] BLOCKED: ${reason}. Stop and escalate to the lead orchestrator.\n`);
      process.exit(2);
    }
    process.exit(0);
  });
}

if (require.main === module) main();

module.exports = { evaluate, checkBash, checkWrite };
