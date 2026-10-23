/**
 * VOLT Agentic Console API.
 *
 *   GET  /api/catalog   agents, workflows, services, skills, intake, health
 *   GET  /api/agents/:id   one agent incl. its VOLT system prompt
 *   GET  /api/skills/:id   one skill's SKILL.md
 *   POST /api/run       Server-Sent Events stream of a run (see shared/events.ts)
 *   GET  /api/templates            uploaded templates
 *   POST /api/templates            upload a .docx/.dotx/.xlsx/.xltx/.pptx/.potx (raw body, X-File-Name header)
 *   GET  /api/templates/:id        formatting profile and guide
 *   GET  /api/templates/:id/original   the uploaded file
 *   DELETE /api/templates/:id
 *   GET  /api/healthz
 *
 * In production it also serves the built React app from dist/.
 */
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
import { MODEL, errorMessage, getSession, intakeFor, runLive, type Emit, type RunInput } from "./orchestrator.js";
import { runDemo } from "./demo.js";
import { TemplateError, templateStore } from "./templates.js";
import { ORCHESTRATOR_LANE, type CatalogResponse, type RunMode, type VoltEvent } from "../shared/events.js";
import { MAX_TEMPLATE_BYTES } from "../shared/templates.js";

const catalog = loadCatalog();
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

// ── Templates ────────────────────────────────────────────────────────────────

const templates = templateStore();

app.get("/api/templates", (_req, res) => {
  res.json(templates.list());
});

app.post("/api/templates", express.raw({ type: () => true, limit: MAX_TEMPLATE_BYTES }), (req, res) => {
  const data = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array(0);
  if (data.length === 0) return void res.status(400).json({ error: "Send the template file as the request body.", code: "invalid_file" });
  const header = (name: string) => {
    const v = req.get(name);
    try {
      return v ? decodeURIComponent(v) : undefined;
    } catch {
      return v;
    }
  };
  try {
    const profile = templates.save(data, header("x-file-name") ?? "template", header("x-template-name"));
    res.status(201).json(profile);
  } catch (err) {
    if (err instanceof TemplateError) {
      const status = err.code === "too_large" ? 413 : err.code === "unsupported_type" ? 415 : 400;
      return void res.status(status).json({ error: err.message, code: err.code });
    }
    console.error("Template extraction failed", err);
    res.status(500).json({ error: "The template could not be read.", code: "invalid_file" });
  }
});

app.get("/api/templates/:id", (req, res) => {
  const t = templates.get(req.params.id);
  if (!t) return void res.status(404).json({ error: "unknown template" });
  res.json(t);
});

app.get("/api/templates/:id/original", (req, res) => {
  const t = templates.get(req.params.id);
  const file = templates.originalPath(req.params.id);
  if (!t || !file) return void res.status(404).json({ error: "unknown template" });
  res.download(file, t.fileName);
});

app.delete("/api/templates/:id", (req, res) => {
  if (!templates.remove(req.params.id)) return void res.status(404).json({ error: "unknown template" });
  res.status(204).end();
});

// ── Runs ─────────────────────────────────────────────────────────────────────

const RunBody = z.object({
  sessionId: z.string().max(100).optional(),
  prompt: z.string().min(1).max(20000),
  workflowId: z.string().optional(),
  intake: z.record(z.string(), z.string()).optional(),
  agentId: z.string().optional(),
  demo: z.boolean().optional(),
  templateId: z.string().max(32).optional(),
});

app.post("/api/run", async (req, res) => {
  const parsed = RunBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const template = parsed.data.templateId ? templates.get(parsed.data.templateId) : undefined;
  if (parsed.data.templateId && !template) return void res.status(400).json({ error: "unknown template" });
  const body: RunInput = { ...parsed.data, template: template ? { id: template.id, name: template.name, guide: template.guide } : undefined };

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  const emit: Emit = (e: VoltEvent) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  const runMode: RunMode = body.demo || mode === "demo" ? "demo" : "live";
  const session = getSession(body.sessionId);
  const kind = body.workflowId ? "workflow" : body.agentId && body.agentId !== "rudra" ? "agent" : "orchestrate";
  const title = body.workflowId
    ? catalog.workflowById.get(body.workflowId)?.name ?? body.workflowId
    : body.agentId
      ? catalog.agentById.get(body.agentId)?.name ?? body.agentId
      : "Rudra orchestration";
  emit({ type: "run_start", runId: crypto.randomUUID(), sessionId: session.id, mode: runMode, model: runMode === "live" ? MODEL : "simulator", kind, title });
  if (body.template) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: `Formatting template "${body.template.name}" attached` });

  try {
    if (runMode === "demo") await runDemo(catalog, body, emit, controller.signal);
    else await runLive(catalog, body, session, emit, controller.signal);
  } catch (err) {
    if (!controller.signal.aborted) emit({ type: "error", lane: ORCHESTRATOR_LANE, message: errorMessage(err) });
  }
  emit({ type: "done", sessionId: session.id });
  res.end();
});

// JSON errors for the API (for example an upload over the size limit), instead of Express's HTML page.
app.use("/api", (err: { status?: number; type?: string; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.type === "entity.too.large" ? 413 : err.status && err.status < 500 ? err.status : 500;
  const error = status === 413 ? `Templates must be ${MAX_TEMPLATE_BYTES / 1024 / 1024} MB or smaller.` : status === 500 ? "Server error" : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error, code: status === 413 ? "too_large" : undefined });
});

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  app.use(express.static(dist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  console.log(`VOLT Agentic Console API on http://localhost:${port} (${mode} mode, model ${MODEL})`);
  console.log(`Catalog: ${catalog.agents.length} agents, ${catalog.workflows.length} workflows, ${catalog.skills.length} skills from ${catalog.source.name}@${catalog.source.commit?.slice(0, 7) ?? "?"}`);
});
