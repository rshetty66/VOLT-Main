/**
 * VOLT Agentic Console API. Every route except health, sign-in status, sign-in and
 * first-run setup needs a signed-in user (cookie session; see auth.ts).
 *
 *   GET  /api/auth/status          { setupRequired, user }
 *   POST /api/auth/setup           create the first admin (only while there are no users) and sign in
 *   POST /api/auth/login           { email, password }; POST /api/auth/logout
 *   GET  /api/auth/me              the signed-in user; POST /api/auth/password changes own password
 *   GET  /api/users                people (admins: full list; consultants: a directory for adding members)
 *   POST /api/users                admin: add a user; PATCH /api/users/:id role, name, disabled;
 *   POST /api/users/:id/password   admin: set a new password (ends that user's sessions)
 *   GET  /api/audit                admin: recent activity
 *   GET  /api/engagements          engagements the user owns or shares (admins: all)
 *   POST /api/engagements          create one { clientName, title, description?, templateId? }
 *   GET  /api/engagements/:id      one engagement, its members, its runs and the caller's access
 *   PATCH /api/engagements/:id     { templateId } assigns a template (null or "standard": the standard)
 *   POST /api/engagements/:id/members { userId }; DELETE /api/engagements/:id/members/:userId
 *   GET  /api/runs                 recent runs the user can see (?engagementId=)
 *   GET  /api/runs/:id             one saved run with its full event stream
 *   GET  /api/runs/:id/markdown    the run as a Markdown file for review
 *   GET  /api/runs/:id/export/:fmt the run as Word (docx), Excel (xlsx) or PowerPoint (pptx), in the
 *                                  engagement's template or else the application standard
 *   POST /api/runs/:id/stop        halt a run that is still going
 *   GET  /api/templates            the template library, the built-in standard first
 *   POST /api/templates            create one; PUT/DELETE /api/templates/:id change or remove it
 *   GET  /api/templates/:id/logo   the template's logo image
 *   GET  /api/templates/:id/preview/:fmt  sample Word/Excel/PowerPoint file in that template
 *   GET  /api/catalog              agents, workflows, services, skills, intake, health
 *   GET  /api/agents/:id           one agent incl. its VOLT system prompt
 *   GET  /api/skills/:id           one skill's SKILL.md
 *   POST /api/run                  Server-Sent Events stream of a run (see shared/events.ts). The run
 *                                  continues and is saved if this connection closes; only /stop halts it.
 *   GET  /api/healthz
 */
import express, { type Request, type Response } from "express";
import { z } from "zod";
import { loadSkillBody, rankSkills, type Catalog } from "./catalog.js";
import { runLocalTool, schemas, type ContextTool, type ToolName } from "./tools.js";
import { BENCHMARKS } from "./analytics.js";
import { MODEL, intakeFor } from "./orchestrator.js";
import type { Db } from "./db.js";
import { addMember, createEngagement, getEngagement, getRun, isUuid, listEngagements, listMembers, listRuns, removeMember, runsForSession, setEngagementTemplate } from "./store.js";
import { finishedOutputs, startRun, stopRun } from "./runs.js";
import { runToMarkdown } from "./export.js";
import { fileStem, runContent } from "./office/content.js";
import { sampleContent } from "./office/sample.js";
import { MAX_LOGO_BYTES, normaliseColour } from "./office/brand.js";
import { STANDARD_ID, brandFor, createTemplate, deleteTemplate, getLogo, getTemplate, listTemplates, updateTemplate, type TemplateInput } from "./templates.js";
import { buildDocx } from "./office/docx.js";
import { buildXlsx } from "./office/xlsx.js";
import { buildPptx } from "./office/pptx.js";
import {
  COOKIE,
  audit,
  canWrite,
  checkCredentials,
  claimUnownedData,
  clearCookie,
  clearFailures,
  countUsers,
  createUser,
  endSession,
  engagementAccess,
  getUser,
  listAudit,
  listUsers,
  lockedFor,
  normaliseEmail,
  otherActiveAdmins,
  passwordProblem,
  readCookie,
  recordFailure,
  runAccess,
  scopeFor,
  sessionCookie,
  setPassword,
  startSession,
  tokenHash,
  updateUser,
  userForToken,
} from "./auth.js";
import type { CatalogResponse, RunMode, VoltEvent } from "../shared/events.js";
import type { User } from "../shared/records.js";
import { FILE_LIMITS, FileError, addFile, deleteFile, getFile, getFileData, getFileText, listFiles, splitParts } from "./files.js";
import { DEFAULT_SETTINGS, SettingsPatch, getSettings, resetSettings, updateSettings } from "./settings.js";
import { budgetBlock, budgetFor, estimateRun, setUserBudget, usageSummary } from "./usage.js";

export interface AppContext {
  db: Db;
  catalog: Catalog;
  mode: RunMode;
}

const PUBLIC = new Set(["/healthz", "/auth/status", "/auth/login", "/auth/setup"]);
const userOf = (res: Response) => res.locals.user as User;

export function createApp({ db, catalog, mode }: AppContext): express.Express {
  const app = express();
  // 2 MB leaves room for a 1 MB template logo sent as base64.
  app.use(express.json({ limit: "2mb" }));

  // ── Sign-in ──────────────────────────────────────────────────────────────────

  app.use("/api", async (req, res, next) => {
    if (PUBLIC.has(req.path)) return next();
    const user = await userForToken(db, readCookie(req.headers.cookie, COOKIE));
    if (!user) return void res.status(401).json({ error: "Please sign in." });
    res.locals.user = user;
    next();
  });

  /** Ends the request with 403 unless the signed-in user's role allows changes. */
  const requireWriter = (res: Response) => {
    if (canWrite(userOf(res))) return true;
    res.status(403).json({ error: "Viewers can read and download, but not make changes." });
    return false;
  };
  const requireAdmin = (res: Response) => {
    if (userOf(res).role === "admin") return true;
    res.status(403).json({ error: "Only admins can do this." });
    return false;
  };
  const secure = (req: Request) => req.secure || req.headers["x-forwarded-proto"] === "https";

  app.get("/api/healthz", (_req, res) => {
    res.json({ ok: true, mode, model: MODEL, agents: catalog.agents.length });
  });

  app.get("/api/auth/status", async (req, res) => {
    res.json({ setupRequired: (await countUsers(db)) === 0, user: await userForToken(db, readCookie(req.headers.cookie, COOKIE)) });
  });

  const NewUser = z.object({
    name: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(200),
    password: z.string(),
  });

  app.post("/api/auth/setup", async (req, res) => {
    if ((await countUsers(db)) > 0) return void res.status(409).json({ error: "Setup is already done; please sign in." });
    const parsed = NewUser.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Enter a name, a valid email and a password." });
    const problem = passwordProblem(parsed.data.password);
    if (problem) return void res.status(400).json({ error: problem });
    const user = await createUser(db, { ...parsed.data, role: "admin" });
    await claimUnownedData(db, user.id);
    await audit(db, user.id, "setup", { type: "user", id: user.id }, { email: user.email });
    res.setHeader("Set-Cookie", sessionCookie(await startSession(db, user.id), secure(req)));
    res.status(201).json(user);
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = z.object({ email: z.string().max(200), password: z.string().max(200) }).safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Enter your email and password." });
    const key = `${normaliseEmail(parsed.data.email)}|${req.ip}`;
    const locked = lockedFor(key);
    if (locked) return void res.status(429).json({ error: `Too many failed attempts. Try again in ${locked} minute(s).` });
    const user = await checkCredentials(db, parsed.data.email, parsed.data.password);
    if (!user) {
      recordFailure(key);
      await audit(db, null, "login_failed", undefined, { email: normaliseEmail(parsed.data.email) });
      return void res.status(401).json({ error: "That email and password don't match an active account." });
    }
    clearFailures(key);
    await audit(db, user.id, "login");
    res.setHeader("Set-Cookie", sessionCookie(await startSession(db, user.id), secure(req)));
    res.json(user);
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = readCookie(req.headers.cookie, COOKIE);
    if (token) await endSession(db, token);
    await audit(db, userOf(res).id, "logout");
    res.setHeader("Set-Cookie", clearCookie);
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (_req, res) => {
    res.json(userOf(res));
  });

  app.post("/api/auth/password", async (req, res) => {
    const parsed = z.object({ current: z.string(), password: z.string() }).safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Enter your current and new password." });
    const me = userOf(res);
    if (!(await checkCredentials(db, me.email, parsed.data.current))) return void res.status(400).json({ error: "Your current password is not right." });
    const problem = passwordProblem(parsed.data.password);
    if (problem) return void res.status(400).json({ error: problem });
    await setPassword(db, me.id, parsed.data.password, tokenHash(readCookie(req.headers.cookie, COOKIE) ?? ""));
    await audit(db, me.id, "password_changed", { type: "user", id: me.id });
    res.json({ ok: true });
  });

  // ── Users (admin) ────────────────────────────────────────────────────────────

  const RoleSchema = z.enum(["admin", "consultant", "viewer"]);

  app.get("/api/users", async (_req, res) => {
    const users = await listUsers(db);
    // Admins manage everyone; others get a directory, for adding engagement members.
    if (userOf(res).role === "admin") return void res.json(users);
    res.json(users.filter((u) => !u.disabled).map(({ id, name, email, role }) => ({ id, name, email, role })));
  });

  app.post("/api/users", async (req, res) => {
    if (!requireAdmin(res)) return;
    const parsed = NewUser.extend({ role: RoleSchema }).safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Enter a name, a valid email, a role and a password." });
    const problem = passwordProblem(parsed.data.password);
    if (problem) return void res.status(400).json({ error: problem });
    if ((await listUsers(db)).some((u) => u.email === normaliseEmail(parsed.data.email))) return void res.status(409).json({ error: "Someone already has that email." });
    const user = await createUser(db, parsed.data);
    await audit(db, userOf(res).id, "user_created", { type: "user", id: user.id }, { email: user.email, role: user.role });
    res.status(201).json(user);
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!requireAdmin(res)) return;
    const parsed = z.object({ name: z.string().trim().min(1).max(100).optional(), role: RoleSchema.optional(), disabled: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
    const target = await getUser(db, req.params.id);
    if (!target) return void res.status(404).json({ error: "unknown user" });
    const losesAdmin = target.role === "admin" && ((parsed.data.role && parsed.data.role !== "admin") || parsed.data.disabled);
    if (losesAdmin && (await otherActiveAdmins(db, target.id)) === 0) return void res.status(409).json({ error: "There must always be at least one active admin." });
    const user = await updateUser(db, target.id, parsed.data);
    await audit(db, userOf(res).id, "user_updated", { type: "user", id: target.id }, parsed.data);
    res.json(user);
  });

  app.post("/api/users/:id/password", async (req, res) => {
    if (!requireAdmin(res)) return;
    const parsed = z.object({ password: z.string() }).safeParse(req.body);
    const problem = parsed.success ? passwordProblem(parsed.data.password) : "Enter a new password.";
    if (problem || !parsed.success) return void res.status(400).json({ error: problem });
    const target = await getUser(db, req.params.id);
    if (!target) return void res.status(404).json({ error: "unknown user" });
    await setPassword(db, target.id, parsed.data.password);
    await audit(db, userOf(res).id, "password_reset", { type: "user", id: target.id });
    res.json({ ok: true });
  });

  // ── Usage and cost control ───────────────────────────────────────────────────

  app.get("/api/usage", async (_req, res) => {
    res.json(await usageSummary(db, await getSettings(db), userOf(res)));
  });

  /** The cost estimate shown before a run, with the person's budget. */
  app.get("/api/usage/estimate", async (req, res) => {
    const q = z.object({ workflowId: z.string().max(100).optional(), agentId: z.string().max(100).optional() }).safeParse(req.query);
    if (!q.success) return void res.status(400).json({ error: q.error.message });
    const settings = await getSettings(db);
    res.json({ estimate: await estimateRun(db, catalog, settings, q.data), budget: await budgetFor(db, settings, userOf(res).id), mode });
  });

  app.get("/api/settings/cost", async (_req, res) => {
    if (!requireAdmin(res)) return;
    res.json({ settings: await getSettings(db), defaults: DEFAULT_SETTINGS, leadModel: MODEL });
  });

  app.put("/api/settings/cost", async (req, res) => {
    if (!requireAdmin(res)) return;
    const parsed = SettingsPatch.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues.map((i) => `${i.path.join(".") || "settings"}: ${i.message}`).join("; ") });
    const prices = parsed.data.prices ?? (await getSettings(db)).prices;
    if (parsed.data.specialistModel && !prices[parsed.data.specialistModel]) {
      return void res.status(400).json({ error: `Add a price for ${parsed.data.specialistModel} before using it, so its runs are costed.` });
    }
    const settings = await updateSettings(db, parsed.data, userOf(res).id);
    await audit(db, userOf(res).id, "cost_settings_updated", undefined, { changed: Object.keys(parsed.data) });
    res.json({ settings, defaults: DEFAULT_SETTINGS, leadModel: MODEL });
  });

  app.post("/api/settings/cost/reset", async (req, res) => {
    if (!requireAdmin(res)) return;
    const keys = z.array(z.enum(["prices", "runBudgetUsd", "monthlyBudgetUsd", "warnAt", "specialistModel", "specialistMaxSteps"])).safeParse(req.body?.keys);
    if (!keys.success) return void res.status(400).json({ error: "Name the settings to reset." });
    const settings = await resetSettings(db, keys.data);
    await audit(db, userOf(res).id, "cost_settings_reset", undefined, { keys: keys.data });
    res.json({ settings, defaults: DEFAULT_SETTINGS, leadModel: MODEL });
  });

  /** A person's own monthly budget; null returns them to the default. */
  app.put("/api/users/:id/budget", async (req, res) => {
    if (!requireAdmin(res)) return;
    const parsed = z.object({ monthlyBudgetUsd: z.number().min(0).max(1_000_000).nullable() }).safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Enter a monthly budget in dollars (0 for no limit), or clear it to use the default." });
    const target = await getUser(db, req.params.id);
    if (!target) return void res.status(404).json({ error: "unknown user" });
    await setUserBudget(db, target.id, parsed.data.monthlyBudgetUsd);
    await audit(db, userOf(res).id, "budget_set", { type: "user", id: target.id }, { monthlyBudgetUsd: parsed.data.monthlyBudgetUsd });
    res.json({ ok: true });
  });

  app.get("/api/audit", async (req, res) => {
    if (!requireAdmin(res)) return;
    res.json(await listAudit(db, Number(req.query.limit) || 200));
  });

  // ── Engagements ──────────────────────────────────────────────────────────────

  const NewEngagement = z.object({
    clientName: z.string().trim().min(1).max(200),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(5000).optional(),
    templateId: z.string().uuid().nullable().optional(),
  });

  /** A template id from a request: a library id, or null for the application standard. */
  const TemplateRef = z.union([z.string().uuid(), z.literal(STANDARD_ID), z.null()]).transform((v) => (v === STANDARD_ID ? null : v));

  app.get("/api/engagements", async (_req, res) => {
    res.json(await listEngagements(db, scopeFor(userOf(res))));
  });

  app.post("/api/engagements", async (req, res) => {
    if (!requireWriter(res)) return;
    const parsed = NewEngagement.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
    if (parsed.data.templateId && !(await getTemplate(db, parsed.data.templateId))) return void res.status(400).json({ error: "unknown template" });
    const e = await createEngagement(db, { ...parsed.data, ownerId: userOf(res).id });
    await audit(db, userOf(res).id, "engagement_created", { type: "engagement", id: e.id }, { clientName: e.clientName, title: e.title });
    res.status(201).json(e);
  });

  /** Loads an engagement the user may see; 404 (not 403) otherwise, so its existence is not revealed. */
  async function visibleEngagement(res: Response, id: string, need: "read" | "write") {
    const engagement = await getEngagement(db, id);
    const access = engagement ? await engagementAccess(db, userOf(res), engagement.id) : "none";
    if (!engagement || access === "none") {
      res.status(404).json({ error: "unknown engagement" });
      return null;
    }
    if (need === "write" && access !== "write") {
      res.status(403).json({ error: "Viewers can read and download, but not make changes." });
      return null;
    }
    return { engagement, access };
  }

  app.get("/api/engagements/:id", async (req, res) => {
    const found = await visibleEngagement(res, req.params.id, "read");
    if (!found) return;
    const { engagement, access } = found;
    res.json({ ...engagement, access, members: await listMembers(db, engagement.id), runs: await listRuns(db, { engagementId: engagement.id }) });
  });

  app.patch("/api/engagements/:id", async (req, res) => {
    const parsed = z.object({ templateId: TemplateRef }).safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
    if (!(await visibleEngagement(res, req.params.id, "write"))) return;
    if (parsed.data.templateId && !(await getTemplate(db, parsed.data.templateId))) return void res.status(400).json({ error: "unknown template" });
    await audit(db, userOf(res).id, "engagement_template_set", { type: "engagement", id: req.params.id }, { templateId: parsed.data.templateId });
    res.json(await setEngagementTemplate(db, req.params.id, parsed.data.templateId));
  });

  /** Members are managed by the engagement's owner and by admins. */
  async function canManageMembers(res: Response, id: string) {
    const found = await visibleEngagement(res, id, "write");
    if (!found) return false;
    const me = userOf(res);
    if (me.role === "admin" || found.engagement.ownerId === me.id) return true;
    res.status(403).json({ error: "Only the engagement's owner or an admin can change its members." });
    return false;
  }

  app.post("/api/engagements/:id/members", async (req, res) => {
    const parsed = z.object({ userId: z.string().uuid() }).safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: "Choose a person to add." });
    if (!(await canManageMembers(res, req.params.id))) return;
    const member = await getUser(db, parsed.data.userId);
    if (!member || member.disabled) return void res.status(400).json({ error: "unknown user" });
    await addMember(db, req.params.id, member.id);
    await audit(db, userOf(res).id, "member_added", { type: "engagement", id: req.params.id }, { userId: member.id, email: member.email });
    res.json(await listMembers(db, req.params.id));
  });

  app.delete("/api/engagements/:id/members/:userId", async (req, res) => {
    if (!(await canManageMembers(res, req.params.id))) return;
    await removeMember(db, req.params.id, req.params.userId);
    await audit(db, userOf(res).id, "member_removed", { type: "engagement", id: req.params.id }, { userId: req.params.userId });
    res.json(await listMembers(db, req.params.id));
  });

  // ── Client files (per engagement) ───────────────────────────────────────────

  /** Content-Disposition for a stored file name, safe for any characters. */
  const disposition = (name: string) => `attachment; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;
  const MIME: Record<string, string> = {
    csv: "text/csv; charset=utf-8",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  /** The file's engagement must be visible to the user (writable for changes); answers 404 otherwise. */
  async function visibleFile(res: Response, id: string, need: "read" | "write") {
    const file = isUuid(id) ? await getFile(db, id) : null;
    if (!file) {
      res.status(404).json({ error: "unknown file" });
      return null;
    }
    return (await visibleEngagement(res, file.engagementId, need)) ? file : null;
  }
  const rawBody = express.raw({ type: () => true, limit: FILE_LIMITS.maxBytes + 1 });

  app.get("/api/engagements/:id/files", async (req, res) => {
    if (!(await visibleEngagement(res, req.params.id, "read"))) return;
    res.json(await listFiles(db, req.params.id));
  });

  /** The file itself is the request body; its name comes in the X-File-Name header, URI-encoded. */
  app.post("/api/engagements/:id/files", async (req, res) => {
    if (!(await visibleEngagement(res, req.params.id, "write"))) return;
    rawBody(req, res, async (err?: unknown) => {
      if (err) {
        const tooBig = (err as { type?: string }).type === "entity.too.large";
        return void res.status(tooBig ? 413 : 400).json({ error: tooBig ? `Files can be up to ${FILE_LIMITS.maxBytes / 1024 / 1024} MB.` : "The upload could not be read." });
      }
      let name = "";
      try {
        name = decodeURIComponent(String(req.headers["x-file-name"] ?? ""));
      } catch {
        /* left empty */
      }
      if (!name) return void res.status(400).json({ error: "Send the file name in the X-File-Name header." });
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      try {
        const file = await addFile(db, { engagementId: req.params.id, userId: userOf(res).id, name, bytes });
        await audit(db, userOf(res).id, "file_uploaded", { type: "engagement", id: req.params.id }, { file: file.name, kind: file.kind, bytes: file.sizeBytes });
        res.status(201).json(file);
      } catch (e) {
        if (e instanceof FileError) return void res.status(e.status).json({ error: e.message });
        console.error("Upload failed:", e);
        res.status(500).json({ error: "The upload failed; the server log has the details." });
      }
    });
  });

  app.get("/api/files/:id", async (req, res) => {
    const file = await visibleFile(res, req.params.id, "read");
    if (!file) return;
    const data = (await getFileData(db, file.id))!;
    res.setHeader("Content-Type", MIME[data.kind] ?? "application/octet-stream");
    res.setHeader("Content-Disposition", disposition(data.name));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(data.data);
  });

  /** What agents read from the file, one part at a time, for the preview. */
  app.get("/api/files/:id/text", async (req, res) => {
    const file = await visibleFile(res, req.params.id, "read");
    if (!file) return;
    const parts = splitParts((await getFileText(db, file.id)) ?? "");
    const part = Math.min(parts.length, Math.max(1, Number(req.query.part) || 1));
    res.json({ file, part, parts: parts.length, text: parts[part - 1] });
  });

  app.delete("/api/files/:id", async (req, res) => {
    const file = await visibleFile(res, req.params.id, "write");
    if (!file) return;
    await deleteFile(db, file.id);
    await audit(db, userOf(res).id, "file_deleted", { type: "engagement", id: file.engagementId }, { file: file.name });
    res.json({ ok: true });
  });

  // ── Output templates (shared by everyone; viewers can only look) ────────────

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
    if (!requireWriter(res)) return;
    const parsed = TemplateBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    const input = templateInput(parsed.data);
    if (typeof input === "string") return void res.status(400).json({ error: input });
    try {
      const t = await createTemplate(db, input);
      await audit(db, userOf(res).id, "template_created", { type: "template", id: t.id }, { name: t.name });
      res.status(201).json(t);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.put("/api/templates/:id", async (req, res) => {
    if (!requireWriter(res)) return;
    if (req.params.id === STANDARD_ID) return void res.status(403).json({ error: "the built-in standard cannot be changed; create a template instead" });
    const parsed = TemplateBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join("; ") });
    const input = templateInput(parsed.data);
    if (typeof input === "string") return void res.status(400).json({ error: input });
    try {
      const t = await updateTemplate(db, req.params.id, input);
      if (!t) return void res.status(404).json({ error: "unknown template" });
      await audit(db, userOf(res).id, "template_updated", { type: "template", id: t.id }, { name: t.name });
      res.json(t);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    if (!requireWriter(res)) return;
    if (req.params.id === STANDARD_ID) return void res.status(403).json({ error: "the built-in standard cannot be deleted" });
    const t = await getTemplate(db, req.params.id);
    if (!t || !(await deleteTemplate(db, req.params.id))) return void res.status(404).json({ error: "unknown template" });
    await audit(db, userOf(res).id, "template_deleted", { type: "template", id: req.params.id }, { name: t.name });
    res.json({ ok: true });
  });

  app.get("/api/templates/:id/logo", async (req, res) => {
    const logo = await getLogo(db, req.params.id);
    if (!logo) return void res.status(404).type("text/plain").send("No logo.");
    res.setHeader("Content-Type", logo.type);
    res.setHeader("Cache-Control", "no-cache");
    res.send(logo.data);
  });

  // ── Runs ─────────────────────────────────────────────────────────────────────

  /** Loads a run the user may see; 404 otherwise. Downloads answer in plain text. */
  async function visibleRun(res: Response, id: string, need: "read" | "write", plain = false) {
    const run = await getRun(db, id);
    const access = run ? await runAccess(db, userOf(res), run) : "none";
    const fail = (status: number, msg: string) => (plain ? res.status(status).type("text/plain").send(msg) : res.status(status).json({ error: msg }));
    if (!run || access === "none") {
      fail(404, plain ? "Unknown run." : "unknown run");
      return null;
    }
    if (need === "write" && access !== "write") {
      fail(403, "Viewers can read and download, but not make changes.");
      return null;
    }
    return run;
  }

  app.get("/api/runs", async (req, res) => {
    const engagementId = typeof req.query.engagementId === "string" ? req.query.engagementId : undefined;
    if (engagementId && !isUuid(engagementId)) return void res.status(400).json({ error: "invalid engagementId" });
    if (engagementId && !(await visibleEngagement(res, engagementId, "read"))) return;
    res.json(await listRuns(db, { engagementId, limit: Number(req.query.limit) || 50, scope: scopeFor(userOf(res)) }));
  });

  app.get("/api/runs/:id", async (req, res) => {
    const run = await visibleRun(res, req.params.id, "read");
    if (run) res.json(run);
  });

  // Downloads answer errors in plain text: a browser saving a JSON error body looks like a broken export.
  app.get("/api/runs/:id/markdown", async (req, res) => {
    const run = await visibleRun(res, req.params.id, "read", true);
    if (!run) return;
    const engagement = run.engagementId ? await getEngagement(db, run.engagementId) : null;
    await audit(db, userOf(res).id, "export", { type: "run", id: run.id }, { format: "md" });
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileStem(run.title, run.startedAt)}.md"`);
    res.send(runToMarkdown(run, engagement));
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
    const run = await visibleRun(res, req.params.id, "read", true);
    if (!run) return;
    try {
      const engagement = run.engagementId ? await getEngagement(db, run.engagementId) : null;
      // The engagement's template if it has one; otherwise the application standard.
      const file = await format.build(runContent(run, engagement), await brandFor(db, engagement?.templateId));
      await audit(db, userOf(res).id, "export", { type: "run", id: run.id }, { format: req.params.format });
      res.setHeader("Content-Type", format.type);
      res.setHeader("Content-Disposition", `attachment; filename="${fileStem(run.title, run.startedAt)}.${req.params.format}"`);
      res.send(file);
    } catch (err) {
      console.error(`Export ${req.params.format} of run ${run.id} failed:`, err);
      res.status(500).type("text/plain").send("The export failed; the server log has the details.");
    }
  });

  app.post("/api/runs/:id/stop", async (req, res) => {
    const run = await visibleRun(res, req.params.id, "write");
    if (!run) return;
    if (!stopRun(run.id)) return void res.status(409).json({ error: `run is already ${run.status}` });
    await audit(db, userOf(res).id, "run_stopped", { type: "run", id: run.id });
    res.json({ ok: true });
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
    if (!requireWriter(res)) return;
    const me = userOf(res);
    const parsed = RunBody.safeParse(req.body);
    if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });
    let body = parsed.data;
    let reuse: Map<string, string> | undefined;
    if (body.resumeFrom) {
      // Resume takes the request, intake and engagement from the earlier run, not from the body.
      const source = await visibleRun(res, body.resumeFrom, "write");
      if (!source) return;
      if (source.kind !== "workflow" || !source.workflowId) return void res.status(400).json({ error: "only workflow runs can be resumed" });
      if (source.status !== "stopped" && source.status !== "error") return void res.status(409).json({ error: `run is ${source.status}; only stopped or failed runs can be resumed` });
      reuse = finishedOutputs(source);
      body = { prompt: source.prompt, workflowId: source.workflowId, intake: source.intake ?? undefined, engagementId: source.engagementId ?? undefined, demo: body.demo, resumeFrom: source.id };
    }
    if (body.engagementId && !(await visibleEngagement(res, body.engagementId, "write"))) return;
    if (body.sessionId) {
      // Continuing a conversation needs write access to a run that used it.
      const runs = await runsForSession(db, body.sessionId);
      const allowed = runs.length > 0 && (await Promise.all(runs.map((r) => runAccess(db, me, r)))).includes("write");
      if (!allowed) return void res.status(403).json({ error: "That conversation belongs to someone else." });
    }
    if (!body.demo && mode === "live") {
      const blocked = budgetBlock(await budgetFor(db, await getSettings(db), me.id));
      if (blocked) return void res.status(403).json({ error: blocked });
    }

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    const run = await startRun(
      { db, catalog, mode, userId: me.id },
      body,
      (e: VoltEvent) => {
        if (res.writableEnded) return;
        res.write(`data: ${JSON.stringify(e)}\n\n`);
        if (e.type === "done") res.end();
      },
      { reuse },
    );
    await audit(db, me.id, body.resumeFrom ? "run_resumed" : "run_started", { type: "run", id: run.runId }, { engagementId: body.engagementId, workflowId: body.workflowId, agentId: body.agentId, resumeFrom: body.resumeFrom });
    // A closed connection only stops the streaming; the run finishes and is saved.
    res.on("close", run.detach);
  });

  // ── Catalogue and tools ──────────────────────────────────────────────────────

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
    const r = runLocalTool(catalog, name as Exclude<ToolName, ContextTool>, parsed.data);
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

  return app;
}
