/**
 * VOLT catalog, read straight from the VOLT Claude Code plugin (plugins/volt), so the
 * console and Claude Code run the same agents, workflows and skills:
 *
 * - agents/<id>.md        agent system prompts (body) + data/agents.json display metadata
 * - data/workflows.json   multi-phase workflows (phases in order, agents within a phase in parallel)
 * - data/services.json    consulting services mapped to agents / workflows / skills with coverage
 * - data/intake.json      workflow intake questions
 * - skills/<id>/SKILL.md  skill text, loaded lazily
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AgentDef {
  id: string;
  name: string;
  layer: string;
  icon: string;
  color: string;
  description: string;
  keywords: string[];
  skills: string[];
  systemPrompt: string;
}

export interface WorkflowDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  agents: string[];
  phases: { name: string; agents: string[] }[];
}

export interface ServiceDef {
  code: string;
  name: string;
  practice: string;
  subPractice: string;
  description: string;
  agents: string[];
  workflows: string[];
  skills: string[];
  coverage: "full" | "partial" | "gap" | string;
}

export interface SkillMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  industry: string;
  resources: string[];
}

export interface IntakeQuestion {
  key: string;
  question: string;
  options?: string[];
}

export interface Catalog {
  source: { name: string; commit?: string; ref?: string; built_utc?: string };
  agents: AgentDef[];
  workflows: WorkflowDef[];
  services: ServiceDef[];
  intake: Record<string, IntakeQuestion[]>;
  layerColors: Record<string, string>;
  skills: SkillMeta[];
  agentById: Map<string, AgentDef>;
  skillById: Map<string, SkillMeta>;
  workflowById: Map<string, WorkflowDef>;
  health: CatalogHealth;
}

export interface CatalogHealth {
  /** Skill ids that agents or services reference but the package does not ship. */
  missingSkills: { skill: string; referencedBy: string[] }[];
  /** Agent ids referenced by workflows / services that are not in the registry. */
  missingAgents: { agent: string; referencedBy: string[] }[];
  servicesByCoverage: Record<string, number>;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = process.env.VOLT_PLUGIN_DIR ?? path.resolve(here, "../../../plugins/volt");

const readJson = <T>(dir: string, rel: string): T => JSON.parse(fs.readFileSync(path.join(dir, rel), "utf8")) as T;

/** Agent body without its YAML frontmatter: that is the agent's system prompt. */
function agentPrompt(dir: string, id: string): string {
  const text = fs.readFileSync(path.join(dir, "agents", `${id}.md`), "utf8");
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

export function loadCatalog(pluginDir = PLUGIN_DIR): Catalog {
  if (!fs.existsSync(path.join(pluginDir, "data", "agents.json"))) {
    throw new Error(`VOLT plugin not found at ${pluginDir}. Set VOLT_PLUGIN_DIR or run plugins/volt/tools/import_volt.py.`);
  }
  const meta = readJson<Omit<AgentDef, "systemPrompt" | "icon" | "color">[]>(pluginDir, "data/agents.json");
  const agents: AgentDef[] = meta.map((a) => ({ ...a, icon: "", color: "", systemPrompt: agentPrompt(pluginDir, a.id) }));
  const skills = readJson<Omit<SkillMeta, "resources" | "industry">[]>(pluginDir, "data/skills.json").map((s) => ({
    ...s,
    industry: "",
    resources: listResources(path.join(pluginDir, "skills", s.id)),
  }));
  const raw = {
    source: { name: "volt plugin", ...readJson<{ commit?: string; ref?: string; built_utc?: string }>(pluginDir, "data/source.json") },
    agents,
    workflows: readJson<WorkflowDef[]>(pluginDir, "data/workflows.json"),
    services: readJson<ServiceDef[]>(pluginDir, "data/services.json"),
    intake: readJson<Record<string, IntakeQuestion[]>>(pluginDir, "data/intake.json"),
    layerColors: {},
    skills,
  };
  const agentById = new Map(raw.agents.map((a) => [a.id, a]));
  const skillById = new Map(raw.skills.map((s) => [s.id, s]));
  const workflowById = new Map(raw.workflows.map((w) => [w.id, w]));
  const provided = readJson<Record<string, string>>(pluginDir, "data/provided-elsewhere.json");
  return { ...raw, agentById, skillById, workflowById, health: checkHealth(raw, agentById, skillById, provided) };
}

function listResources(skillDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, d.name);
      if (d.isDirectory()) walk(full);
      else if (d.name.endsWith(".md") && d.name !== "SKILL.md") out.push(path.relative(skillDir, full).split(path.sep).join("/"));
    }
  };
  if (fs.existsSync(skillDir)) walk(skillDir);
  return out.sort();
}

function checkHealth(
  raw: Pick<Catalog, "agents" | "workflows" | "services">,
  agents: Map<string, AgentDef>,
  skills: Map<string, SkillMeta>,
  providedElsewhere: Record<string, string> = {},
): CatalogHealth {
  const missingSkills = new Map<string, Set<string>>();
  const missingAgents = new Map<string, Set<string>>();
  const note = (m: Map<string, Set<string>>, key: string, by: string) => m.set(key, (m.get(key) ?? new Set()).add(by));

  const missing = (id: string) => !skills.has(id) && !(id in providedElsewhere);
  for (const a of raw.agents) for (const s of a.skills) if (missing(s)) note(missingSkills, s, `agent:${a.id}`);
  for (const s of raw.services) {
    for (const sk of s.skills) if (missing(sk)) note(missingSkills, sk, `service:${s.code}`);
    for (const ag of s.agents) if (!agents.has(ag)) note(missingAgents, ag, `service:${s.code}`);
  }
  for (const w of raw.workflows) for (const p of w.phases) for (const ag of p.agents) if (!agents.has(ag)) note(missingAgents, ag, `workflow:${w.id}`);

  const servicesByCoverage: Record<string, number> = {};
  for (const s of raw.services) servicesByCoverage[s.coverage] = (servicesByCoverage[s.coverage] ?? 0) + 1;
  const list = (m: Map<string, Set<string>>, k: "skill" | "agent") =>
    [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, by]) => ({ [k]: id, referencedBy: [...by] }));
  return {
    missingSkills: list(missingSkills, "skill") as CatalogHealth["missingSkills"],
    missingAgents: list(missingAgents, "agent") as CatalogHealth["missingAgents"],
    servicesByCoverage,
  };
}

export function loadSkillBody(skillId: string, pluginDir = PLUGIN_DIR) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(skillId)) return null;
  const dir = path.join(pluginDir, "skills", skillId);
  const file = path.join(dir, "SKILL.md");
  if (!fs.existsSync(file)) return null;
  const body = fs.readFileSync(file, "utf8");
  const resources = Object.fromEntries(listResources(dir).map((r) => [r, fs.readFileSync(path.join(dir, r), "utf8").slice(0, 40_000)]));
  return { body: body.slice(0, 120_000), truncated: body.length > 120_000, resources };
}

// ── Routing ────────────────────────────────────────────────────────────────
// VOLT's route_to_agent() counts raw keyword substrings, which sends e.g.
// "our month-end close takes 12 days" to crm-connector. This BM25-style scorer
// weighs keywords, name, layer, description and the system prompt, and keeps
// VOLT's preference for domain agents over generic "Skills —" meta-agents.

const STOP = new Set(
  "the a an and or of to for in on with we our is are be how what can do need help you me my this that it at by as from into should using use takes take day days get our us any".split(" "),
);

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/s\/4\s?hana/g, "s4hana")
    .replace(/month[- ]end/g, "monthend close")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOP.has(t))
    // Prefix stemming: "reconcile" and "reconciliation" both become "reconci".
    .map((t) => (t.length > 7 ? t.slice(0, 7) : t.length > 4 && t.endsWith("s") ? t.slice(0, -1) : t));
}

interface Doc {
  agent: AgentDef;
  fields: { tokens: string[]; weight: number }[];
}

let index: { docs: Doc[]; df: Map<string, number> } | null = null;

function buildIndex(catalog: Catalog) {
  const docs: Doc[] = catalog.agents.map((agent) => ({
    agent,
    fields: [
      { tokens: tokenize(agent.keywords.join(" ")), weight: 3 },
      { tokens: tokenize(agent.name + " " + agent.id.replace(/-/g, " ")), weight: 2.5 },
      { tokens: tokenize(agent.description), weight: 1.5 },
      { tokens: tokenize(agent.layer), weight: 0.5 },
      { tokens: tokenize(agent.systemPrompt.slice(0, 1500)), weight: 0.35 },
    ],
  }));
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d.fields.flatMap((f) => f.tokens))) df.set(t, (df.get(t) ?? 0) + 1);
  return { docs, df };
}

export function rankAgents(catalog: Catalog, query: string, limit = 5): { agent: AgentDef; score: number }[] {
  index ??= buildIndex(catalog);
  const terms = [...new Set(tokenize(query))];
  const N = index.docs.length;
  return index.docs
    .map(({ agent, fields }) => {
      let score = 0;
      for (const t of terms) {
        const idf = Math.log(1 + (N - (index!.df.get(t) ?? 0) + 0.5) / ((index!.df.get(t) ?? 0) + 0.5));
        for (const f of fields) {
          const tf = f.tokens.filter((x) => x === t).length;
          if (tf) score += f.weight * idf * ((tf * 2.2) / (tf + 1.2));
        }
      }
      if (agent.layer.startsWith("Skills —")) score *= 0.75;
      if (agent.layer === "Orchestration") score *= 0.5;
      return { agent, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

let skillIndex: { skill: SkillMeta; name: string[]; desc: string[] }[] | null = null;
let skillDf: Map<string, number> | null = null;

/** Skill Finder: IDF-weighted match of a task against skill ids and descriptions. */
export function rankSkills(catalog: Catalog, query: string, limit = 5): { skill: SkillMeta; score: number }[] {
  if (!skillIndex) {
    skillIndex = catalog.skills.map((skill) => ({ skill, name: tokenize(skill.id.replace(/-/g, " ")), desc: tokenize(skill.description) }));
    skillDf = new Map();
    for (const s of skillIndex) for (const t of new Set([...s.name, ...s.desc])) skillDf.set(t, (skillDf.get(t) ?? 0) + 1);
  }
  const N = skillIndex.length;
  const terms = new Set(tokenize(query));
  return skillIndex
    .map(({ skill, name, desc }) => {
      let score = 0;
      for (const t of terms) {
        const idf = Math.log(1 + N / (1 + (skillDf!.get(t) ?? 0)));
        const tf = Math.min(desc.filter((d) => d === t).length, 3);
        score += idf * ((name.includes(t) ? 3 : 0) + tf);
      }
      return { skill, score: Math.round(score * 10) / 10 };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
