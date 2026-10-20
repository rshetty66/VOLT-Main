/**
 * VOLT Agentic Console API.
 *
 *   GET  /api/engagements          saved engagements with run counts
 *   POST /api/engagements          create one { clientName, title, description? }
 *   GET  /api/engagements/:id      one engagement and its runs
 *   GET  /api/runs                 recent runs (?engagementId=)
 *   GET  /api/runs/:id             one saved run with its full event stream
 *   GET  /api/runs/:id/markdown    the run as a Markdown file for review
 *   GET  /api/runs/:id/export/:fmt the run as a Word (docx), Excel (xlsx) or PowerPoint (pptx) file,
 *                                  in the engagement's template or else the application standard
 *   GET  /api/templates            the template library, the built-in standard first
 *   POST /api/templates            create one; PUT/DELETE /api/templates/:id change or remove it
 *   GET  /api/templates/:id/logo   the template's logo image
 *   GET  /api/templates/:id/preview/:fmt  sample Word/Excel/PowerPoint file in that template
 *   PATCH /api/engagements/:id     { templateId } assigns a template (null or "standard": the standard)
 *   POST /api/runs/:id/stop        halt a run that is still going
 *   GET  /api/catalog   agents, workflows, services, skills, intake, health
 *   GET  /api/agents/:id   one agent incl. its VOLT system prompt
 *   GET  /api/skills/:id   one skill's SKILL.md
 *   POST /api/run       Server-Sent Events stream of a run (see shared/events.ts). The run
 *                       continues and is saved if this connection closes; only /stop halts it.
 *   GET  /api/healthz
 *
 * In production it also serves the built React app from dist/.
 */
import "./env.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { z } from "zod";
import { loadCatalog, loadSkillBody, rankSkills } from "./catalog.js";
import { runLocalTool, schemas, type ToolName } from "./tools.js";
import { BENCHMARKS } from "./analytics.js";
import { MODEL, intakeFor } from "./orchestrator.js";
import { DEFAULT_DATA_DIR, openDb } from "./db.js";
import { createEngagement, getEngagement, getRun, isUuid, listEngagements, listRuns, markInterruptedRuns, setEngagementTemplate } from "./store.js";
import { finishedOutputs, startRun, stopRun } from "./runs.js";
import { runToMarkdown } from "./export.js";
import { fileStem, runContent } from "./office/content.js";
import { sampleContent } from "./office/sample.js";
import { MAX_LOGO_BYTES, normaliseColour } from "./office/brand.js";
import { STANDARD_ID, brandFor, createTemplate, deleteTemplate, getLogo, getTemplate, listTemplates, updateTemplate, type TemplateInput } from "./templates.js";
import { buildDocx } from "./office/docx.js";
import { buildXlsx } from "./office/xlsx.js";
import { buildPptx } from "./office/pptx.js";
import type { CatalogResponse, RunMode, VoltEvent } from "../shared/events.js";

const catalog = loadCatalog();
const dataDir = process.env.VOLT_DATA_DIR || DEFAULT_DATA_DIR;
const db = await openDb(dataDir);
const interrupted = await markInterruptedRuns(db);
const app = express();
// 2 MB leaves room for a 1 MB template logo sent as base64.
app.use(express.json({ limit: "2mb" }));

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
  templateId: z.string().uuid().nullable().optional(),
});

/** A template id from a request: a library id, or null for the application standard. */
const TemplateRef = z.union([z.string().uuid(), z.literal(STANDARD_ID), z.null()]).transform((v) => (v === STANDARD_ID ? null : v));

app.get("/api/engagements", async (_req, res) => {
  res.json(await listEngagements(db));
});

app.post("/api/engagements", async (req, res) => {
  const parsed = NewEngagement.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  if (parsed.data.templateId && !(await getTemplate(db, parsed.data.templateId))) return void res.status(400).json({ error: "unknown template" });
  res.status(201).json(await createEngagement(db, parsed.data));
});

app.patch("/api/engagements/:id", async (req, res) => {
  const parsed = z.object({ templateId: TemplateRef }).safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  if (!(await getEngagement(db, req.params.id))) return void res.status(404).json({ error: "unknown engagement" });
  if (parsed.data.templateId && !(await getTemplate(db, parsed.data.templateId))) return void res.status(400).json({ error: "unknown template" });
  res.json(await setEngagementTemplate(db, req.params.id, parsed.data.templateId));
});

// ── Output templates ─────────────────────────────────────────────────────────

const colour = z.string().transform((v, ctx) => normaliseColour(v) ?? (ctx.addIssue({ code: "custom", message: "colours are six hex digits, e.g. #1F3864" }), z.NEVER));
// Font names go into document XML attributes: letters, digits, spaces and hyphens only.
const font = z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9 -]+$/, "font names use letters, digits, spaces and hyphens");
const TemplateBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  organisation: z.string().max(100).optional(),
  primaryColor: colour,
  accentColor: colour,
  headingFont: font,
  bodyFont: font,
  footerText: z.string().max(120).optional(),
  confidentiality: z.string().max(160).optional(),
  /** A data URL ("data:image/png;base64,..."), null to remove the logo, or absent to keep it. */
  logo: z.string().max(1_500_000).nullable().optional(),
});

function templateInput(body: z.infer<typeof TemplateBody>): TemplateInput | string {
  let logo: Buffer | null | undefined = body.logo === null ? null : undefined;
  if (typeof body.logo === "string") {
    const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/=]+)$/.exec(body.logo);
    if (!m) return "the logo must be a PNG or JPEG image";
    logo = Buffer.from(m[2], "base64");
    if (logo.length > MAX_LOGO_BYTES) return "the logo must be 1 MB or smaller";
  }
  const { logo: _l, ...rest } = body;
  return { ...rest, logo };
}

app.get("/api/templates", async (_req, res) => {
  res.json(await listTemplates(db));
});

app.get("/api/templates/:id", async (req, res) => {
  const t = await getTemplate(db, req.params.id);
  if (!t) return void res.status(404).json({ error: "unknown template" });
  res.json(t);
});

app.post("/api/templates", async (req, res) => {
  const parsed = TemplateBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  const input = templateInput(parsed.data);
  if (typeof input === "string") return void res.status(400).json({ error: input });
  try {
    res.status(201).json(await createTemplate(db, input));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.put("/api/templates/:id", async (req, res) => {
  if (req.params.id === STANDARD_ID) return void res.status(403).json({ error: "the built-in standard cannot be changed; create a template instead" });
  const parsed = TemplateBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
  const input = templateInput(parsed.data);
  if (typeof input === "string") return void res.status(400).json({ error: input });
  try {
    const t = await updateTemplate(db, req.params.id, input);
    if (!t) return void res.status(404).json({ error: "unknown template" });
    res.json(t);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.delete("/api/templates/:id", async (req, res) => {
  if (req.params.id === STANDARD_ID) return void res.status(403).json({ error: "the built-in standard cannot be deleted" });
  if (!(await deleteTemplate(db, req.params.id))) return void res.status(404).json({ error: "unknown template" });
  res.json({ ok: true });
});

app.get("/api/templates/:id/logo", async (req, res) => {
  const logo = await getLogo(db, req.params.id);
  if (!logo) return void res.status(404).type("text/plain").send("No logo.");
  res.setHeader("Content-Type", logo.type);
  res.setHeader("Cache-Control", "no-cache");
  res.send(logo.data);
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

// Downloads answer errors in plain text: a browser saving a JSON error body looks like a broken export.
app.get("/api/runs/:id/markdown", async (req, res) => {
  const run = await getRun(db, req.params.id);
  if (!run) return void res.status(404).type("text/plain").send("Unknown run.");
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
  resumeFrom: z.string().uuid().optional(),
});

app.post("/api/run", async (req, res) => {
  const parsed = RunBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  let body = parsed.data;
  let reuse: Map<string, string> | undefined;
  if (body.resumeFrom) {
    // Resume takes the request, intake and engagement from the earlier run, not from the body.
    const source = await getRun(db, body.resumeFrom);
    if (!source) return void res.status(404).json({ error: "unknown run" });
    if (source.kind !== "workflow" || !source.workflowId) return void res.status(400).json({ error: "only workflow runs can be resumed" });
    if (source.status !== "stopped" && source.status !== "error") return void res.status(409).json({ error: `run is ${source.status}; only stopped or failed runs can be resumed` });
    reuse = finishedOutputs(source);
    body = { prompt: source.prompt, workflowId: source.workflowId, intake: source.intake ?? undefined, engagementId: source.engagementId ?? undefined, demo: body.demo, resumeFrom: source.id };
  }
  if (body.engagementId && !(await getEngagement(db, body.engagementId))) return void res.status(400).json({ error: "unknown engagement" });

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  const run = await startRun({ db, catalog, mode }, body, (e: VoltEvent) => {
    if (res.writableEnded) return;
    res.write(`data: ${JSON.stringify(e)}\n\n`);
    if (e.type === "done") res.end();
  }, { reuse });
  // A closed connection only stops the streaming; the run finishes and is saved.
  res.on("close", run.detach);
});

const OFFICE = {
  docx: { build: buildDocx, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { build: buildXlsx, type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pptx: { build: buildPptx, type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
} as const;

app.get("/api/templates/:id/preview/:format", async (req, res) => {
  const format = OFFICE[req.params.format as keyof typeof OFFICE];
  if (!format) return void res.status(404).type("text/plain").send("Preview formats: docx, xlsx, pptx.");
  const t = await getTemplate(db, req.params.id);
  if (!t) return void res.status(404).type("text/plain").send("Unknown template.");
  const file = await format.build(sampleContent(), await brandFor(db, t.builtIn ? null : t.id));
  res.setHeader("Content-Type", format.type);
  res.setHeader("Content-Disposition", `attachment; filename="${fileStem(`${t.name} preview`, new Date().toISOString())}.${req.params.format}"`);
  res.send(file);
});

app.get("/api/runs/:id/export/:format", async (req, res) => {
  const format = OFFICE[req.params.format as keyof typeof OFFICE];
  if (!format) return void res.status(404).type("text/plain").send("Export formats: docx, xlsx, pptx.");
  const run = await getRun(db, req.params.id);
  if (!run) return void res.status(404).type("text/plain").send("Unknown run.");
  try {
    const engagement = run.engagementId ? await getEngagement(db, run.engagementId) : null;
    // The engagement's template if it has one; otherwise the application standard.
    const file = await format.build(runContent(run, engagement), await brandFor(db, engagement?.templateId));
    res.setHeader("Content-Type", format.type);
    res.setHeader("Content-Disposition", `attachment; filename="${fileStem(run.title, run.startedAt)}.${req.params.format}"`);
    res.send(file);
  } catch (err) {
    console.error(`Export ${req.params.format} of run ${run.id} failed:`, err);
    res.status(500).type("text/plain").send("The export failed; the server log has the details.");
  }
});

app.post("/api/runs/:id/stop", async (req, res) => {
  if (stopRun(req.params.id)) return void res.json({ ok: true });
  const run = await getRun(db, req.params.id);
  res.status(run ? 409 : 404).json({ error: run ? `run is already ${run.status}` : "unknown run" });
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
