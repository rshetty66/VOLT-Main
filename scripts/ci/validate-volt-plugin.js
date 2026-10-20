#!/usr/bin/env node
/**
 * Validate the VOLT plugin (plugins/volt) and its marketplace (plugins/.claude-plugin).
 *
 * Applies ECC's agent rules (validate-agents.js) to VOLT agents and adds the
 * cross-reference checks a generated plugin needs: every `volt:<id>` named in a
 * command or agent resolves to a shipped agent or skill, and every workflow phase
 * names a registered agent.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '../..');
const PLUGIN = path.join(ROOT, 'plugins/volt');
const VALID_MODELS = new Set(['haiku', 'sonnet', 'opus']);
const errors = [];
const fail = msg => errors.push(msg);

function frontmatter(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return { error: 'missing frontmatter' };
  try {
    const data = yaml.load(m[1]);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'frontmatter is not a mapping' };
    return { data, raw: m[1], body: text.slice(m[0].length) };
  } catch (err) {
    return { error: `invalid YAML: ${err.message.split('\n')[0]}` };
  }
}

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch (err) {
    fail(`${rel}: ${err.message}`);
    return null;
  }
}

// Manifests
const manifest = readJson('plugins/volt/.claude-plugin/plugin.json');
if (manifest) {
  if (manifest.name !== 'volt') fail('plugin.json: name must be "volt"');
  if (!manifest.version) fail('plugin.json: version is required');
  for (const key of ['skills', 'commands']) {
    if (!Array.isArray(manifest[key])) fail(`plugin.json: ${key} must be an array`);
  }
  for (const key of ['agents', 'hooks']) {
    if (key in manifest) fail(`plugin.json: do not declare "${key}" (see .claude-plugin/PLUGIN_SCHEMA_NOTES.md)`);
  }
}
const marketplace = readJson('plugins/.claude-plugin/marketplace.json');
if (marketplace) {
  const entry = (marketplace.plugins || []).find(p => p.name === 'volt');
  if (!entry) fail('marketplace.json: missing the "volt" plugin entry');
  else if (!fs.existsSync(path.join(ROOT, 'plugins', entry.source))) fail(`marketplace.json: source ${entry.source} does not exist`);
}

// Agents
const agentDir = path.join(PLUGIN, 'agents');
const agents = new Set();
for (const file of fs.readdirSync(agentDir).filter(f => f.endsWith('.md'))) {
  const fm = frontmatter(path.join(agentDir, file));
  if (fm.error) { fail(`agents/${file}: ${fm.error}`); continue; }
  const { data, raw } = fm;
  for (const field of ['name', 'description', 'tools', 'model']) {
    if (!data[field] || !String(data[field]).trim()) fail(`agents/${file}: missing ${field}`);
  }
  if (data.name !== file.replace(/\.md$/, '')) fail(`agents/${file}: name "${data.name}" does not match the file name`);
  if (!VALID_MODELS.has(data.model)) fail(`agents/${file}: invalid model "${data.model}"`);
  if (/^tools:\s*(\[|$)/m.test(raw)) fail(`agents/${file}: tools must be a comma-separated scalar`);
  agents.add(data.name);
}

// Skills
const skillDir = path.join(PLUGIN, 'skills');
const skills = new Set();
for (const dir of fs.readdirSync(skillDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
  const file = path.join(skillDir, dir.name, 'SKILL.md');
  if (!fs.existsSync(file)) { fail(`skills/${dir.name}: missing SKILL.md`); continue; }
  const fm = frontmatter(file);
  if (fm.error) { fail(`skills/${dir.name}/SKILL.md: ${fm.error}`); continue; }
  for (const field of ['name', 'description']) {
    if (typeof fm.data[field] !== 'string' || !fm.data[field].trim()) fail(`skills/${dir.name}/SKILL.md: missing ${field}`);
  }
  skills.add(dir.name);
}

// Cross-references: `volt:<id>` must resolve to an agent or a skill
const refRe = /`volt:([a-z0-9][a-z0-9-]*)`/g;
function checkRefs(label, text) {
  for (const m of text.matchAll(refRe)) {
    if (!agents.has(m[1]) && !skills.has(m[1])) fail(`${label}: unresolved reference volt:${m[1]}`);
  }
}
const commandDir = path.join(PLUGIN, 'commands');
let commandCount = 0;
for (const file of fs.readdirSync(commandDir).filter(f => f.endsWith('.md'))) {
  const fm = frontmatter(path.join(commandDir, file));
  if (fm.error) { fail(`commands/${file}: ${fm.error}`); continue; }
  if (typeof fm.data.description !== 'string' || !fm.data.description.trim()) fail(`commands/${file}: missing description`);
  checkRefs(`commands/${file}`, fm.body);
  commandCount++;
}
for (const name of agents) checkRefs(`agents/${name}.md`, fs.readFileSync(path.join(agentDir, `${name}.md`), 'utf8'));

// Data used by the console app
const workflows = readJson('plugins/volt/data/workflows.json') || [];
for (const wf of workflows) {
  if (!fs.existsSync(path.join(commandDir, `run-${wf.id}.md`))) fail(`workflow ${wf.id}: missing commands/run-${wf.id}.md`);
  for (const phase of wf.phases) for (const a of phase.agents) if (!agents.has(a)) fail(`workflow ${wf.id}: unknown agent ${a}`);
}
for (const svc of readJson('plugins/volt/data/services.json') || []) {
  for (const a of svc.agents) if (!agents.has(a)) fail(`service ${svc.code}: unknown agent ${a}`);
}

if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  console.error(`VOLT plugin validation failed with ${errors.length} error(s)`);
  process.exit(1);
}
console.log(`Validated VOLT plugin: ${agents.size} agents, ${commandCount} commands, ${skills.size} skills, ${workflows.length} workflows`);
