#!/usr/bin/env node
'use strict';

/**
 * subagent-log: appends one JSON line per subagent start and stop to
 * .claude/agent-log.jsonl (git-ignored), as an offline audit trail of which
 * agents ran, in what order, in which session.
 *
 * Adapted from claude-code-templates' hooks/subagent-lifecycle-logger, which
 * reads $CLAUDE_AGENT_NAME. Claude Code does not set that variable, so every
 * line would say "unknown"; this version reads agent_type and agent_id from the
 * hook input instead. Never blocks: any error exits 0.
 */

const fs = require('fs');
const path = require('path');

const EVENTS = new Set(['SubagentStart', 'SubagentStop']);

function str(v) {
  return typeof v === 'string' && v ? v.slice(0, 200) : null;
}

/** The log line for a hook input, or null when it is not a subagent event. */
function entry(input, now = new Date()) {
  if (!input || !EVENTS.has(input.hook_event_name)) return null;
  return {
    schema_version: 1,
    ts: now.toISOString(),
    event: input.hook_event_name,
    agent_type: str(input.agent_type) || 'unknown',
    agent_id: str(input.agent_id),
    session_id: str(input.session_id),
  };
}

function logFile(input, env = process.env) {
  const root = env.CLAUDE_PROJECT_DIR || (input && input.cwd) || process.cwd();
  return path.join(root, '.claude', 'agent-log.jsonl');
}

function record(input, env = process.env, now = new Date()) {
  const line = entry(input, now);
  if (!line) return null;
  const file = logFile(input, env);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(line) + '\n');
  return file;
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    try {
      record(JSON.parse(raw));
    } catch (err) {
      process.stderr.write(`[subagent-log] skipped: ${err.message}\n`);
    }
    process.exit(0);
  });
}

if (require.main === module) main();

module.exports = { entry, record, logFile };
