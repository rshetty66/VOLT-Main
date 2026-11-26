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
 *   POST /api/export               build a Word, PowerPoint or Excel download from a deliverable
 *   GET  /api/healthz
 *   GET  /api/ledger/review        VOLT Ledger review queue (people only; never a model tool)
 *   POST /api/ledger/review        record an engagement-lead or client decision
 *   POST /api/ledger/driver        enter a driver value (FTEs, transaction counts, RWA) for allocation
 *   GET  /api/ledger/coa           chart-of-accounts designs and their review state
 *   GET  /api/ledger/coa/export    CSV download of a design: ?design_id=coa:0001&what=chart|hierarchy|mapping|decisions
 *
 * In production it also serves the built React app from dist/.
 */
// Must stay the first import: other modules read their settings from process.env when they load.
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
import { benchmarks } from "./analytics.js";
import { fxRate, startFx } from "./fx.js";
import { ModelLedger, routingEnabled } from "./router.js";
import { MODEL, errorMessage, getSession, intakeFor, runLive, type Emit, type RunInput } from "./orchestrator.js";
import { runDemo } from "./demo.js";
import { commandPrompt, commandStatus, loadRudraCommands, matchCommand } from "./commands.js";
import { TemplateError, templateStore } from "./templates.js";
import { exportRouter } from "./export/route.js";
import { ORCHESTRATOR_LANE, type CatalogResponse, type RunMode, type VoltEvent } from "../shared/events.js";
import { MAX_TEMPLATE_BYTES } from "../shared/templates.js";
import { AttachmentError, extractAttachment, limitText } from "./attachments.js";
import { listUploads, originalPath, readUpload, removeUpload, saveUpload } from "./uploads.js";
import { createProject, deleteChat, isProjectId, listChats, listProjects, restoreChat, saveChat, updateProject } from "./projects.js";
import { WEB_MAX_BYTES, WebSourceError, checkUrl, fetchPublic, htmlText, renderPage, renderingEnabled, shouldRender } from "./knowledge.js";
import { DEFAULT_PROJECT_ID, MEMORY_KINDS } from "../shared/projects.js";
import { ATTACH_MAX_BYTES, ATTACH_MAX_CHARS_FILE, ATTACH_MAX_CHARS_TOTAL, ATTACH_MAX_FILES } from "../shared/attachments.js";
import { runBudgetMs } from "./budget.js";
import { directAsk, quickAsk } from "./deliverable.js";
import { startHeartbeat } from "./sse.js";
import { assertSafeToListen, limitCostly, loginHandler, loginPostHandler, rateLimit, requestUser, requireToken, sameOriginWrites, securityConfig } from "./security.js";
import { ledgerCoaExport, ledgerDataRequirementsExport, ledgerEnabled, ledgerPeople } from "./ledger.js";
import { scopeSchema } from "../shared/scope.js";

const catalog = loadCatalog();
const security = securityConfig();
assertSafeToListen(security);
if (security.authMode === "username") console.warn("[security] VOLT_AUTH_MODE=username: sign-in needs only a name, with no secret. Anyone who can reach this URL can use the Claude API key.");
const app = express();
app.disable("x-powered-by");
// Behind a reverse proxy (Render, Fly, nginx) set VOLT_TRUST_PROXY=1 so req.ip and req.secure come from X-Forwarded-*;
// without it every visitor shares the proxy's address and one rate-limit budget.
if (process.env.VOLT_TRUST_PROXY) app.set("trust proxy", Number(process.env.VOLT_TRUST_PROXY) || 1);

/** Live when any Claude credential source is configured; VOLT_MODE overrides. */
function detectMode(): RunMode {
  const forced = process.env.VOLT_MODE;
  if (forced === "live" || forced === "demo") return forced;
  const env = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE", "ANTHROPIC_FEDERATION_RULE_ID"];
  if (env.some((k) => process.env[k])) return "live";
  // A credentials directory counts only when it holds something; an empty or stale folder stays in demo.
  const dir = path.join(os.homedir(), ".config", "anthropic");
  try {
    return fs.readdirSync(dir).length > 0 ? "live" : "demo";
  } catch {
    return "demo";
  }
}
const mode = detectMode();

// Access control comes first, ahead of every parser and route (including the model routes).
app.use(requireToken(security));
app.use(sameOriginWrites(security));
app.use(limitCostly(security.rateLimitPerMinute));
// Sign-in attempts are rate limited per client; the form posts here, the URL form still works.
const loginLimit = rateLimit(10);
app.get("/api/login", loginLimit, loginHandler(security));
app.post("/api/login", loginLimit, express.json({ limit: "2kb" }), loginPostHandler(security));

// Downloads (Word, PowerPoint, Excel) carry images, so they get their own body limit ahead of the 1 MB JSON parser.
app.use("/api/export", exportRouter((id) => templateStore().get(id)));
// Saved chats get their own, larger limit (a chat keeps the files it made); see PUT /api/chats/:id.
const json1mb = express.json({ limit: "1mb" });
app.use((req, res, next) => (req.method === "PUT" && req.path.startsWith("/api/chats/") ? next() : json1mb(req, res, next)));

/** The deployed commit, from the host's build variables (Render, Vercel), so a deploy can be checked from the browser. */
const COMMIT = (process.env.RENDER_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown").slice(0, 7);

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true, mode, model: MODEL, routing: routingEnabled(), agents: catalog.agents.length, commit: COMMIT, runBudgetSeconds: runBudgetMs() / 1000 });
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
    benchmarks: benchmarks().map(({ pcf: _p, ...b }) => b),
    fx: fxRate(),
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

// Reads an attached file to plain text. The text comes back to the browser and travels with the run request.
app.post("/api/attachments/extract", express.raw({ type: () => true, limit: ATTACH_MAX_BYTES }), async (req, res) => {
  const data = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array(0);
  if (data.length === 0) return void res.status(400).json({ error: "Send the file as the request body.", code: "empty" });
  let name = req.get("x-file-name") ?? "attachment";
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep the raw header */
  }
  try {
    res.json(await extractAttachment(name, data));
  } catch (err) {
    if (err instanceof AttachmentError) return void res.status(err.code === "unsupported_type" ? 415 : 422).json({ error: err.message, code: err.code });
    console.error("Attachment extraction failed", err);
    res.status(500).json({ error: "That file could not be read.", code: "unreadable" });
  }
});

// ── Uploads library ──────────────────────────────────────────────────────────
// Every attached file is kept (original + extracted text) so any later chat can use it again as a source.

/** A knowledge-base document is kept whole up to this length; a chat gets the first ATTACH_MAX_CHARS_FILE of it. */
const KB_MAX_CHARS = 2_000_000;
const projectParam = (v: unknown) => (isProjectId(v) ? v : DEFAULT_PROJECT_ID);

// A file attached in a chat (4 MB, as before) or added to a project's knowledge base (up to 25 MB).
app.post("/api/uploads", express.raw({ type: () => true, limit: WEB_MAX_BYTES }), async (req, res) => {
  const data = Buffer.isBuffer(req.body) ? new Uint8Array(req.body) : new Uint8Array(0);
  if (data.length === 0) return void res.status(400).json({ error: "Send the file as the request body.", code: "empty" });
  let name = req.get("x-file-name") ?? "attachment";
  try {
    name = decodeURIComponent(name);
  } catch {
    /* keep the raw header */
  }
  try {
    const extracted = await extractAttachment(name, data, KB_MAX_CHARS);
    const meta = saveUpload(extracted, data, { projectId: projectParam(req.get("x-project-id")) });
    res.json({ ...limitText(extracted.name, extracted.text), id: meta.id });
  } catch (err) {
    if (err instanceof AttachmentError) return void res.status(err.code === "unsupported_type" ? 415 : 422).json({ error: err.message, code: err.code });
    console.error("Upload failed", err);
    res.status(500).json({ error: "That file could not be read.", code: "unreadable" });
  }
});

// A web page or PDF added to a project's knowledge base by URL: fetched once, read to text, kept like an upload.
app.post("/api/uploads/url", express.json({ limit: "8kb" }), async (req, res) => {
  const body = z.object({ url: z.string().min(4).max(2000), projectId: z.string().optional() }).safeParse(req.body);
  if (!body.success) return void res.status(400).json({ error: "Send a URL." });
  try {
    // A site that refuses the plain fetch gets one rendered try when ScrapeGraph is set up (see renderPage).
    const got = await fetchPublic(body.data.url).catch(async (err) => {
      if (!shouldRender(err)) throw err;
      const page = await renderPage(body.data.url);
      return { bytes: new TextEncoder().encode(page.text), type: "text/markdown", url: checkUrl(body.data.url).toString(), page };
    });
    const host = new URL(got.url).hostname;
    let extracted;
    if ("page" in got) {
      extracted = { ...limitText("", got.page.text, KB_MAX_CHARS), name: `${(got.page.title || got.url).slice(0, 150)} (${host})` };
    } else if (got.type.includes("pdf") || /\.pdf$/i.test(new URL(got.url).pathname)) {
      const file = decodeURIComponent(new URL(got.url).pathname.split("/").pop() || "page").replace(/\.pdf$/i, "");
      extracted = { ...(await extractAttachment(`${file}.pdf`, got.bytes, KB_MAX_CHARS)), name: `${file} (${host})` };
    } else if (/text\/html|xhtml/.test(got.type) || !got.type) {
      let page = htmlText(new TextDecoder("utf-8").decode(got.bytes), got.url);
      // A page built by JavaScript has no text in its HTML: render it when ScrapeGraph is set up.
      if (page.text.length < 40 && renderingEnabled()) page = await renderPage(got.url);
      if (page.text.length < 40) return void res.status(422).json({ error: "No readable text was found on that page (it may need a browser to render)." });
      extracted = { ...limitText("", page.text, KB_MAX_CHARS), name: `${(page.title || got.url).slice(0, 150)} (${host})` };
    } else if (/text\/plain|text\/csv|json/.test(got.type)) {
      extracted = { ...limitText("", new TextDecoder("utf-8").decode(got.bytes).trim(), KB_MAX_CHARS), name: `${got.url.slice(0, 150)}` };
    } else return void res.status(415).json({ error: `That link returns ${got.type.split(";")[0]}, which VOLT cannot read. Add web pages, PDFs or text.` });
    const meta = saveUpload(extracted, got.bytes, { projectId: projectParam(body.data.projectId), url: got.url });
    res.json(meta);
  } catch (err) {
    if (err instanceof WebSourceError || err instanceof AttachmentError) return void res.status(422).json({ error: err.message });
    console.error("URL source failed", err);
    res.status(500).json({ error: "That page could not be added." });
  }
});

app.get("/api/uploads", (req, res) => {
  res.json(listUploads(typeof req.query.projectId === "string" ? projectParam(req.query.projectId) : undefined));
});

app.get("/api/uploads/:id", (req, res) => {
  const got = readUpload(req.params.id);
  if (!got) return void res.status(404).json({ error: "unknown upload" });
  // A long knowledge-base document goes into a chat cut to the chat limit; the agents search the rest.
  res.json({ ...got.meta, ...limitText(got.meta.name, got.text) });
});

app.get("/api/uploads/:id/file", (req, res) => {
  const file = originalPath(req.params.id);
  const meta = listUploads().find((m) => m.id === req.params.id);
  if (!file || !meta) return void res.status(404).json({ error: "unknown upload" });
  res.download(file, meta.url ? `${meta.name.replace(/[^\w .()-]/g, "_")}.html` : meta.name);
});

app.delete("/api/uploads/:id", (req, res) => {
  if (!removeUpload(req.params.id)) return void res.status(404).json({ error: "unknown upload" });
  res.status(204).end();
});

// ── Projects, memory and saved chats ─────────────────────────────────────────
// Kept on the data disk. A chat untouched for VOLT_ARCHIVE_DAYS (30) is archived, never deleted automatically.

const MemoryBody = z.array(z.object({ id: z.string().max(40).optional(), kind: z.enum(MEMORY_KINDS), text: z.string().max(600) })).max(100);

app.get("/api/projects", (_req, res) => {
  res.json(listProjects());
});

app.post("/api/projects", express.json({ limit: "4kb" }), (req, res) => {
  const body = z.object({ name: z.string().min(1).max(80) }).safeParse(req.body);
  if (!body.success) return void res.status(400).json({ error: "Give the project a name." });
  res.json(createProject(body.data.name));
});

app.patch("/api/projects/:id", express.json({ limit: "64kb" }), (req, res) => {
  const body = z.object({ name: z.string().max(80).optional(), memory: MemoryBody.optional() }).safeParse(req.body);
  if (!body.success) return void res.status(400).json({ error: body.error.message });
  const p = updateProject(req.params.id, body.data);
  if (!p) return void res.status(404).json({ error: "unknown project" });
  res.json(p);
});

app.get("/api/chats", (req, res) => {
  res.json(listChats(projectParam(req.query.projectId), req.query.archived === "1"));
});

app.put("/api/chats/:id", express.json({ limit: "4mb" }), (req, res) => {
  const body = z.object({ projectId: z.string(), run: z.looseObject({ id: z.string(), startedAt: z.number().optional() }) }).safeParse(req.body);
  if (!body.success || body.data.run.id !== req.params.id || !isProjectId(body.data.projectId)) return void res.status(400).json({ error: "invalid chat" });
  try {
    saveChat(body.data.projectId, body.data.run);
    res.status(204).end();
  } catch {
    res.status(400).json({ error: "invalid chat" });
  }
});

app.post("/api/chats/:id/restore", (req, res) => {
  if (!restoreChat(req.params.id)) return void res.status(404).json({ error: "unknown chat" });
  res.status(204).end();
});

app.delete("/api/chats/:id", (req, res) => {
  if (!deleteChat(req.params.id)) return void res.status(404).json({ error: "unknown chat" });
  res.status(204).end();
});

// ── VOLT Ledger review (people only) ─────────────────────────────────────────
// Decisions and driver values are made by people here, never by the model. In username mode the signed-in name is
// recorded; with the shared access token the reviewer is VOLT_REVIEWER_NAME (one reviewer for now, A25).
const reviewer = (req: express.Request) => requestUser(security, req) ?? process.env.VOLT_REVIEWER_NAME?.trim() ?? "engagement-lead";
const LedgerDecision = z.object({
  item_id: z.string().regex(/^R[0-9]{6}$/),
  stage: z.enum(["engagement_lead", "client"]),
  decision: z.enum(["approve", "reject", "amend"]),
  note: z.string().max(2000).default(""),
});
const LedgerDriver = z.object({
  key: z.enum(["fte", "transaction_count", "rwa"]),
  period: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/),
  dimensions: z.record(z.string().max(40), z.string().max(60)),
  value: z.string().regex(/^[0-9]+(\.[0-9]+)?$/),
  unit: z.string().max(20).default(""),
  note: z.string().max(500).default(""),
});

app.get("/api/ledger/review", async (req, res) => {
  if (!ledgerEnabled()) return void res.json({ enabled: false, items: [] });
  const r = await ledgerPeople("GET", "review_items", reviewer(req));
  const body = r.json as { data?: unknown };
  res.status(r.status === 200 ? 200 : r.status).json(r.status === 200 ? { enabled: true, reviewer: reviewer(req), items: body.data ?? [] } : r.json);
});

app.post("/api/ledger/review", async (req, res) => {
  const parsed = LedgerDecision.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const r = await ledgerPeople("POST", "review_decision", reviewer(req), parsed.data);
  res.status(r.status).json(r.json);
});

app.post("/api/ledger/driver", async (req, res) => {
  const parsed = LedgerDriver.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const r = await ledgerPeople("POST", "driver_value", reviewer(req), { ...parsed.data, kind: "driver", unit: parsed.data.unit || parsed.data.key.toUpperCase() });
  res.status(r.status).json(r.json);
});

app.get("/api/ledger/coa", async (req, res) => {
  if (!ledgerEnabled()) return void res.json({ enabled: false, designs: [] });
  const r = await ledgerPeople("GET", "coa_designs", reviewer(req));
  res.status(r.status).json(r.status === 200 ? { enabled: true, designs: (r.json as { data?: unknown }).data ?? [] } : r.json);
});

const CoaExport = z.object({ design_id: z.string().regex(/^coa:[0-9]{4}$/), what: z.enum(["chart", "hierarchy", "mapping", "decisions"]) });

app.get("/api/ledger/coa/export", async (req, res) => {
  const parsed = CoaExport.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const r = await ledgerCoaExport(parsed.data.design_id, parsed.data.what, reviewer(req));
  if (r.status !== 200) return void res.status(r.status).json({ error: r.text });
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${parsed.data.design_id.replace(":", "-")}-${parsed.data.what}.csv"`);
  res.send(r.text);
});

const RegisterExport = z.object({ design_id: z.string().regex(/^coa:[0-9]{4}$/).optional() });

app.get("/api/ledger/data-requirements/export", async (req, res) => {
  const parsed = RegisterExport.safeParse(req.query);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const r = await ledgerDataRequirementsExport(parsed.data.design_id, reviewer(req));
  if (r.status !== 200) return void res.status(r.status).json({ error: r.text });
  res.setHeader("content-type", "text/csv; charset=utf-8");
  res.setHeader("content-disposition", `attachment; filename="${(parsed.data.design_id ?? "reference-chart").replace(":", "-")}-data-requirements.csv"`);
  res.send(r.text);
});

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
  opus: z.boolean().optional(),
  templateId: z.string().max(32).optional(),
  scope: scopeSchema.optional(),
  projectId: z.string().regex(/^(general|[0-9a-f-]{36})$/).optional(),
  attachments: z
    .array(z.object({ name: z.string().max(200), text: z.string().max(ATTACH_MAX_CHARS_FILE + 200), uploadId: z.string().regex(/^[0-9a-f-]{36}$/).optional() }))
    .max(ATTACH_MAX_FILES)
    .refine((a) => a.reduce((n, f) => n + f.text.length, 0) <= ATTACH_MAX_CHARS_TOTAL, "The attached files are too long in total.")
    .optional(),
});

app.post("/api/run", async (req, res) => {
  const parsed = RunBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
  const template = parsed.data.templateId ? templates.get(parsed.data.templateId) : undefined;
  if (parsed.data.templateId && !template) return void res.status(400).json({ error: "unknown template" });
  const body: RunInput = { ...parsed.data, template: template ? { id: template.id, name: template.name, guide: template.guide } : undefined };

  const session = getSession(body.sessionId);
  if (session.busy) return void res.status(409).json({ error: "A run is already in progress for this conversation. Wait for it to finish or stop it first.", code: "session_busy" });
  session.busy = true;

  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  startHeartbeat(res);
  // End the run cleanly before the host's limit, so the answer written so far is kept instead of lost.
  const budget = runBudgetMs();
  const limitTimer = budget
    ? setTimeout(() => {
        emit({ type: "error", lane: ORCHESTRATOR_LANE, message: `This run reached its ${Math.round(budget / 1000)}-second time limit, so it stopped. The answer so far is shown. Ask a narrower question, or split the work into parts.` });
        controller.abort();
      }, budget)
    : undefined;
  // Model use per run, for the host log line at the end (audit trail: which model did what, at what estimated cost).
  const models = new ModelLedger();
  const emit: Emit = (e: VoltEvent) => {
    if (e.type === "usage" && e.model) models.add(e.model, e, e.costUsd ?? 0);
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  const runMode: RunMode = body.demo || mode === "demo" ? "demo" : "live";
  const kind = body.workflowId ? "workflow" : body.agentId && body.agentId !== "rudra" ? "agent" : "orchestrate";
  const title = body.workflowId
    ? catalog.workflowById.get(body.workflowId)?.name ?? body.workflowId
    : body.agentId
      ? catalog.agentById.get(body.agentId)?.name ?? body.agentId
      : "All specialists";
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  // One line per run start and end in the host's logs, so a slow or cut-off run can be traced (no prompt text is logged).
  console.log(`[run] start ${runId} ${kind} ${runMode} quick=${kind === "orchestrate" && quickAsk(body.prompt)} direct=${kind === "orchestrate" && directAsk(body.prompt)} budget=${budget / 1000}s commit=${COMMIT}`);
  res.on("close", () => console.log(`[run] end ${runId} after ${Math.round((Date.now() - startedAt) / 1000)}s${controller.signal.aborted ? " (stopped or cut off)" : ""} models: ${models.summary()}`));
  emit({ type: "run_start", runId, sessionId: session.id, mode: runMode, model: runMode === "live" ? MODEL : "simulator", kind, title });
  if (runMode === "demo" && body.attachments?.length) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: "Attached files are read in live mode only; this demo run ignores them" });
  if (body.template) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: `Formatting template "${body.template.name}" attached` });
  // Rudra commands ("/compare ...") apply to Rudra runs only, not to a single specialist or a workflow.
  try {
    const commands = kind === "orchestrate" ? loadRudraCommands() : [];
    const command = kind === "orchestrate" ? matchCommand(body.prompt, commands) : null;
    if (command) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: commandStatus(command) });

    if (runMode === "demo") await runDemo(catalog, body, emit, controller.signal);
    else await runLive(catalog, command ? { ...body, prompt: commandPrompt(body.prompt, command, commands) } : body, session, emit, controller.signal);
  } catch (err) {
    if (!controller.signal.aborted) emit({ type: "error", lane: ORCHESTRATOR_LANE, message: errorMessage(err) });
  } finally {
    clearTimeout(limitTimer);
    session.busy = false;
  }
  emit({ type: "done", sessionId: session.id });
  res.end();
});

// JSON errors for the API (for example an upload over the size limit), instead of Express's HTML page.
app.use("/api", (err: { status?: number; type?: string; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.type === "entity.too.large" ? 413 : err.status && err.status < 500 ? err.status : 500;
  const error = status === 413 ? "That upload or request is larger than this endpoint allows." : status === 500 ? "Server error" : err.message;
  if (status === 500) console.error(err);
  res.status(status).json({ error, code: status === 413 ? "too_large" : undefined });
});

if (process.env.NODE_ENV === "production") {
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../dist");
  // Hashed assets never change, so they are cached for good; index.html is always checked, so a reload after a deploy
  // picks up the new asset names. A missing asset is a 404, not the app page, so the browser reports it plainly.
  app.use(
    "/assets",
    express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }),
  );
  app.use(express.static(dist, { setHeaders: (res, file) => file.endsWith(".html") && res.setHeader("Cache-Control", "no-cache") }));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
}

// On Vercel the app runs as a serverless function (api/index.ts) and Vercel owns the socket, so nothing listens here.
export default app;

const port = Number(process.env.PORT ?? 8787);
// The live USD to CAD rate (server/fx.ts): read when the server starts serving.
if (process.env.VERCEL) startFx();
if (!process.env.VERCEL) app.listen(port, security.host, () => {
  startFx();
  console.log(`VOLT Agentic Console API on http://${security.host}:${port} (${mode} mode, model ${MODEL}${security.token ? ", access token required" : ""})`);
  console.log(`Catalog: ${catalog.agents.length} agents, ${catalog.workflows.length} workflows, ${catalog.skills.length} skills from ${catalog.source.name}@${catalog.source.commit?.slice(0, 7) ?? "?"}`);
});
