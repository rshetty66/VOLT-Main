#!/usr/bin/env node
'use strict';

/**
 * loop-breaker: stops an agent that keeps re-running the same failing command.
 *
 * Registered on PostToolUseFailure (counts a failure) and PostToolUse (a
 * success clears the count) for Bash. Active only when VOLT_TEAM=1. On the
 * Nth identical failure (VOLT_LOOP_LIMIT, default 3) it exits 2 so the agent
 * is told to stop retrying and escalate. Neither the command nor the error
 * text is echoed, so nothing secret reaches the log. Internal errors exit 0.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function stateFile(sessionId, dir) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return path.join(dir || os.tmpdir(), `volt-loop-${safe}.json`);
}

function signature(command, errorText) {
  const lines = String(errorText || '').trim().split(/\r?\n/).filter(Boolean);
  const last = lines.length ? lines[lines.length - 1] : '';
  return crypto.createHash('sha256').update(`${String(command).trim()}\n${last}`).digest('hex').slice(0, 16);
}

function errorTextOf(input) {
  const r = input.tool_response;
  return [
    typeof input.error === 'string' ? input.error : '',
    typeof r === 'string' ? r : '',
    r && typeof r.stderr === 'string' ? r.stderr : '',
    r && typeof r.stdout === 'string' ? r.stdout : '',
  ].filter(Boolean).join('\n');
}

function load(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

/** Returns a block message, or null. Updates the state file. */
function record(input, env = process.env, dir) {
  if (env.VOLT_TEAM !== '1' || !input || input.tool_name !== 'Bash') return null;
  const command = input.tool_input && input.tool_input.command;
  if (!command) return null;
  const limit = Math.max(2, parseInt(env.VOLT_LOOP_LIMIT, 10) || 3);
  const file = stateFile(input.session_id, dir);
  const state = load(file);
  const cmdKey = crypto.createHash('sha256').update(String(command).trim()).digest('hex').slice(0, 16);

  if (input.hook_event_name !== 'PostToolUseFailure') {
    if (!state[cmdKey]) return null;
    delete state[cmdKey];
    fs.writeFileSync(file, JSON.stringify(state));
    return null;
  }

  const sig = signature(command, errorTextOf(input));
  const prev = state[cmdKey];
  const count = prev && prev.sig === sig ? prev.count + 1 : 1;
  state[cmdKey] = { sig, count };
  fs.writeFileSync(file, JSON.stringify(state));
  if (count < limit) return null;
  return `The same command has failed ${count} times with the same error. Stop retrying. ` +
    'Record the failing command and your diagnosis in handoff.json open_questions and return to the lead orchestrator.';
}

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { raw += c; });
  process.stdin.on('end', () => {
    try {
      const msg = record(JSON.parse(raw));
      if (msg) {
        process.stderr.write(`[loop-breaker] ${msg}\n`);
        process.exit(2);
      }
    } catch (err) {
      process.stderr.write(`[loop-breaker] skipped: ${err.message}\n`);
    }
    process.exit(0);
  });
}

if (require.main === module) main();

module.exports = { record, signature, stateFile };
