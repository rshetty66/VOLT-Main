/**
 * VOLT Agentic Console API.
 *
 *   GET  /api/engagements          saved engagements with run counts
 *   POST /api/engagements          create one { clientName, title, description? }
 *   GET  /api/engagements/:id      one engagement and its runs
 *   GET  /api/runs                 recent runs (?engagementId=)
 *   GET  /api/runs/:id             one saved run with its full event stream
 *   GET  /api/runs/:id/markdown    the run as a Markdown file for review
 *   GET  /api/catalog   agents, workflows, services, skills, intake, health
 *   GET  /api/agents/:id   one agent incl. its VOLT system prompt
 *   GET  /api/skills/:id   one skill's SKILL.md
 *   POST /api/run       Server-Sent Events stream of a run (see shared/events.ts)
 *   GET  /api/healthz
 *
 * In production it also serves the built React app from dist/.
 */
import "./env.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import { z } from "zod";
import { loadCatalog, loadSkillBody, rankSkills } from "./catalog.js";
import { runLocalTool, schemas, type ToolName } from "./tools.js";
import { BENCHMARKS } from "./analytics.js";
import { MODEL, errorMessage, getSession, intakeFor, runLive, type Emit } from "./orchestrator.js";
import { DEFAULT_DATA_DIR, openDb } from "./db.js";
import { createEngagement, getEngagement, getRun, isUuid, listEngagements, listRuns, loadSession, markInterruptedRuns, saveSession } from "./store.js";
import { recordRun } from "./recorder.js";
import { runToMarkdown } from "./export.js";
import { runDemo } from "./demo.js";
import { ORCHESTRATOR_LANE, type CatalogResponse, type RunMode, type VoltEvent } from "../shared/events.js";

const catalog = loadCatalog();
const dataDir = process.env.VOLT_DATA_DIR || DEFAULT_DATA_DIR;
const db = await openDb(dataDir);
const interrupted = await markInterruptedRuns(db);
const app = express();
app.use(express.json({ limit: "1mb" }));

/** Live when any Claude credential source is configured; VOLT_MODE overrides. */
function detectMode(): RunMode {
  const forced = process.env.VOLT_MODE;
  if (forced === "live" || forced === "demo") return forced;
  const env = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE", "ANTHROPIC_FEDERATION_RULE_ID"];
  if (env.some((k) => process.env[k])) return "live";
  return fs.existsSync(path.join(os.homedir(), ".config", "anthropic")) ? "live" : "demo";
}
const mode = detectMode();

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true, mode, model: MODEL, agents: catalog.agents.length });
});

// ── Saved engagements and runs ───────────────────────────────────────────────

const NewEngagement = z.object({
  clientName: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
});

app.get("/api/engagements", async (_req, res) => {
  res.json(await listEngagements(db));
});

app.post("/api/engagements", async (req, res) => {
  const parsed = NewEngagement.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  res.status(201).json(await createEngagement(db, parsed.data));
});

app.get("/api/engagements/:id", async (req, res) => {
  const engagement = await getEngagement(db, req.params.id);
  if (!engagement) return void res.status(404).json({ error: "unknown engagement" });
  res.json({ ...engagement, runs: await listRuns(db, { engagementId: engagement.id }) });
});

app.get("/api/runs", async (req, res) => {
  const engagementId = typeof req.query.engagementId === "string" ? req.query.engagementId : undefined;
  if (engagementId && !isUuid(engagementId)) return void res.status(400).json({ error: "invalid engagementId" });
  res.json(await listRuns(db, { engagementId, limit: Number(req.query.limit) || 50 }));
});

app.get("/api/runs/:id", async (req, res) => {
  const run = await getRun(db, req.params.id);
  if (!run) return void res.status(404).json({ error: "unknown run" });
  res.json(run);
});

app.get("/api/runs/:id/markdown", async (req, res) => {
  const run = await getRun(db, req.params.id);
  if (!run) return void res.status(404).json({ error: "unknown run" });
  const engagement = run.engagementId ? await getEngagement(db, run.engagementId) : null;
  const name = `${run.title}-${run.startedAt.slice(0, 10)}`.replace(/[^A-Za-z0-9-]+/g, "-").replace(/-+/g, "-").toLowerCase();
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}.md"`);
  res.send(runToMarkdown(run, engagement));
});

app.get("/api/catalog", (_req, res) => {
  const body: CatalogResponse = {
    source: catalog.source,
    mode,
    model: MODEL,
    agents: catalog.agents.map(({ systemPrompt: _p, ...a }) => a),
    workflows: catalog.workflows,
    services: catalog.services,
    intake: catalog.intake,
    layerColors: catalog.layerColors,
    skills: catalog.skills.map(({ industry: _i, ...s }) => s),
    health: catalog.health,
    benchmarks: BENCHMARKS.map(({ pcf: _p, ...b }) => b),
  };
  res.json(body);
});

app.get("/api/agents/:id", (req, res) => {
  const agent = catalog.agentById.get(req.params.id);
  if (!agent) return void res.status(404).json({ error: "unknown agent" });
  res.json({
    ...agent,
    workflows: catalog.workflows.filter((w) => w.agents.includes(agent.id)).map((w) => w.id),
    services: catalog.services.filter((s) => s.agents.includes(agent.id)).map((s) => s.code),
  });
});

/** Skill Finder: ranked skill matches for a free-text task. */
app.get("/api/skills", (req, res) => {
  const q = String(req.query.q ?? "").slice(0, 500);
  res.json(
    rankSkills(catalog, q, 12).map(({ skill, score }) => ({
      ...skill,
      score,
      usedBy: catalog.agents.filter((a) => a.skills.includes(skill.id)).map((a) => a.id),
    })),
  );
});

/** Direct access to the deterministic analytics tools (same code the agents call). */
const DIRECT_TOOLS = new Set<ToolName>(["apqc_benchmark", "score_maturity", "appraise_investment", "build_value_case", "find_agents", "find_skills"]);
app.post("/api/tools/:name", (req, res) => {
  const name = req.params.name as ToolName;
  if (!DIRECT_TOOLS.has(name)) return void res.status(404).json({ error: "unknown tool" });
  const parsed = schemas[name].safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const r = runLocalTool(catalog, name as Exclude<ToolName, "consult_agent">, parsed.data);
  res.status(r.ok ? 200 : 400).json(r);
});

app.get("/api/skills/:id", (req, res) => {
  const meta = catalog.skillById.get(req.params.id);
  const body = loadSkillBody(req.params.id);
  if (!meta || !body) return void res.status(404).json({ error: "unknown skill" });
  res.json({ ...meta, body: body.body, truncated: body.truncated });
});

app.get("/api/workflows/:id/intake", (req, res) => {
  if (!catalog.workflowById.has(req.params.id)) return void res.status(404).json({ error: "unknown workflow" });
  res.json(intakeFor(catalog, req.params.id));
});

const RunBody = z.object({
  sessionId: z.string().max(100).optional(),
  prompt: z.string().min(1).max(20000),
  workflowId: z.string().optional(),
  intake: z.record(z.string(), z.string()).optional(),
  agentId: z.string().optional(),
  demo: z.boolean().optional(),
  engagementId: z.string().uuid().optional(),
});

app.post("/api/run", async (req, res) => {
  const parsed = RunBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const body = parsed.data;
  if (body.engagementId && !(await getEngagement(db, body.engagementId))) return void res.status(400).json({ error: "unknown engagement" });

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  const send: Emit = (e: VoltEvent) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  const runMode: RunMode = body.demo || mode === "demo" ? "demo" : "live";
  const session = getSession(body.sessionId, body.sessionId ? await loadSession(db, body.sessionId) : null);
  const kind = body.workflowId ? "workflow" : body.agentId && body.agentId !== "rudra" ? "agent" : "orchestrate";
  const title = body.workflowId
    ? catalog.workflowById.get(body.workflowId)?.name ?? body.workflowId
    : body.agentId
      ? catalog.agentById.get(body.agentId)?.name ?? body.agentId
      : "Rudra orchestration";
  const runId = crypto.randomUUID();
  const model = runMode === "live" ? MODEL : "simulator";
  const recorder = await recordRun(
    db,
    { id: runId, engagementId: body.engagementId, sessionId: session.id, kind, title, prompt: body.prompt, workflowId: body.workflowId, agentId: body.agentId, intake: body.intake, mode: runMode, model },
    send,
  );
  const emit = recorder.emit;
  emit({ type: "run_start", runId, sessionId: session.id, mode: runMode, model, kind, title });

  try {
    if (runMode === "demo") await runDemo(catalog, body, emit, controller.signal);
    else await runLive(catalog, body, session, emit, controller.signal);
  } catch (err) {
    if (!controller.signal.aborted) emit({ type: "error", lane: ORCHESTRATOR_LANE, message: errorMessage(err) });
  }
  emit({ type: "done", sessionId: session.id });
  res.end();
  try {
    if (runMode === "live") await saveSession(db, session);
    await recorder.finish({ aborted: controller.signal.aborted });
  } catch (err) {
    console.error(`Could not save run ${runId}:`, err);
  }
});

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`VOLT Agentic Console API on http://localhost:${port} (${mode} mode, model ${MODEL})`);
  console.log(`Saved data: ${dataDir}${interrupted ? ` (${interrupted} interrupted run(s) marked)` : ""}`);
  console.log(`Catalog: ${catalog.agents.length} agents, ${catalog.workflows.length} workflows, ${catalog.skills.length} skills from ${catalog.source.name}@${catalog.source.commit?.slice(0, 7) ?? "?"}`);
});
