/**
 * routes.ts — Builder workspace service endpoints (D5).
 *
 * Mounted at /api/builder under the same session-cookie auth the tRPC
 * context uses. v1 surface:
 *
 *   POST /spec                          compile a prompt into a spec (D6), run G0,
 *                                       persist spec.json into the session workspace
 *   GET  /workspace/:session/files      list workspace files
 *   GET  /workspace/:session/file/*     read one file (413 over the read cap)
 *   PUT  /workspace/:session/file/*     write one file (256 KB cap)
 *   POST /gates/:session/run            run the G0–G4 chain from spec.json
 *   POST /build/:session/run            full build; optional { maxRounds } (1–5)
 *
 * Everything session-scoped resolves through workspaceFor, which sanitizes
 * the id and confines all file operations to that session's directory.
 */
import { Hono } from "hono";
import type { User } from "@db/schema";
import { authenticateRequest } from "../kimi/auth";
import { log } from "../lib/logger";
import { workspaceFor, WorkspaceError } from "./workspace";
import { buildSpecSchema, checkSpec, type BuildSpec } from "./spec";
import { compileSpec, type CompileInput } from "./compiler";
import { runGates, summarize, type GateResult } from "./gates";
import { runBuild, type BuildOutcome } from "./codegen";
import {
  listBuilderSessions,
  getBuilderSession,
  recordBuildEnd,
  recordBuildStart,
  recordSpecCompile,
} from "./store";
import type { BuildSpec as StoredSpec } from "./spec";

const MAX_WRITE_CHARS = 256 * 1024;
const MAX_READ_CHARS = 512 * 1024;
const MAX_PROMPT_CHARS = 8_000;
const MAX_CLIENT_FILE_CHARS = 100 * 1024;

export interface BuilderRouteDeps {
  authenticate?: (headers: Headers) => Promise<User>;
  compile?: (input: CompileInput) => Promise<{ spec: unknown; g0: unknown }>;
  gateChain?: (
    ws: import("./workspace").Workspace,
    spec: unknown,
  ) => Promise<GateResult[]>;
  build?: (
    ws: import("./workspace").Workspace,
    spec: unknown,
    opts?: { maxRounds?: number },
  ) => Promise<BuildOutcome>;
  dataDir?: string;
  /** Persistence hooks — injectable for tests; default to the real store. */
  persist?: {
    recordSpec?: typeof recordSpecCompile;
    buildStart?: typeof recordBuildStart;
    buildEnd?: typeof recordBuildEnd;
  };
}

/** Runtime data root for builder workspaces; overridable for tests. */
export function builderDataDir(): string {
  return process.env.BUILDER_DATA_DIR ?? "builder-data";
}

export function createBuilderRoutes(
  deps: BuilderRouteDeps = {},
): Hono<{ Variables: { user: User } }> {
  const authenticate = deps.authenticate ?? authenticateRequest;
  const compile = deps.compile ?? compileSpec;
  const gateChain =
    deps.gateChain ??
    ((ws, spec) => runGates(ws, spec as Parameters<typeof runGates>[1]));
  const build =
    deps.build ??
    ((ws, spec, opts) =>
      runBuild(ws, spec as Parameters<typeof runBuild>[1], {
        maxRounds: opts?.maxRounds,
      }));
  const dataDir = deps.dataDir ?? builderDataDir();
  const persist = deps.persist ?? {};
  const recordSpec = persist.recordSpec ?? recordSpecCompile;
  const buildStart = persist.buildStart ?? recordBuildStart;
  const buildEnd = persist.buildEnd ?? recordBuildEnd;
  /** One build per session at a time — a second POST while running is a 409. */
  const running = new Set<string>();

  const app = new Hono<{ Variables: { user: User } }>();

  app.use("*", async (c, next) => {
    let user: User;
    try {
      user = await authenticate(c.req.raw.headers);
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
    c.set("user", user);
    await next();
  });

  const wsFor = (session: string) => workspaceFor(dataDir, session);

  // --- Spec compile + G0 ---------------------------------------------------

  app.post("/spec", async (c) => {
    let body: {
      prompt?: unknown;
      sessionId?: unknown;
      clientFile?: { name?: unknown; content?: unknown };
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
      return c.json({ error: "prompt must be 1–8000 characters" }, 400);
    }
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim()
        ? body.sessionId.trim()
        : crypto.randomUUID();
    const clientFile =
      body.clientFile &&
      typeof body.clientFile.name === "string" &&
      typeof body.clientFile.content === "string" &&
      body.clientFile.content.length <= MAX_CLIENT_FILE_CHARS
        ? {
            name: body.clientFile.name.slice(0, 200),
            content: body.clientFile.content,
          }
        : undefined;

    let result;
    try {
      result = await compile({ prompt, clientFile });
    } catch (err) {
      log.error("builder spec compile failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json(
        { error: err instanceof Error ? err.message : "compile failed" },
        502,
      );
    }

    // Persist so the gates endpoint and the future codegen agent share one
    // spec of record; G0 failures persist too — they are the resume point.
    const ws = wsFor(sessionId);
    try {
      await ws.ensure();
      await ws.write("spec.json", JSON.stringify(result.spec, null, 2));
    } catch (err) {
      log.error("builder spec persist failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "workspace unavailable" }, 500);
    }

    // Per-user history (D10) — fire-and-forget; a DB outage must never
    // cost the user a successful compile.
    const uid = Number(c.get("user").id);
    if (Number.isFinite(uid)) {
      void recordSpec(
        uid,
        sessionId,
        prompt,
        result.spec as StoredSpec,
      ).catch((err) =>
        log.error("builder history record failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return c.json({ sessionId, spec: result.spec, g0: result.g0 });
  });

  // --- Per-user history ------------------------------------------------------

  app.get("/sessions", async (c) => {
    const uid = Number(c.get("user").id);
    if (!Number.isFinite(uid)) return c.json({ sessions: [] });
    try {
      return c.json({ sessions: await listBuilderSessions(uid) });
    } catch (err) {
      log.error("builder session list failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ sessions: [], unavailable: true });
    }
  });

  app.get("/sessions/:session", async (c) => {
    const uid = Number(c.get("user").id);
    if (!Number.isFinite(uid)) return c.json({ error: "not found" }, 404);
    try {
      const detail = await getBuilderSession(uid, c.req.param("session"));
      if (!detail) return c.json({ error: "not found" }, 404);
      return c.json(detail);
    } catch (err) {
      log.error("builder session detail failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json({ error: "history unavailable" }, 503);
    }
  });

  // --- Workspace file service ----------------------------------------------

  app.get("/workspace/:session/files", async (c) => {
    try {
      return c.json({ files: await wsFor(c.req.param("session")).list() });
    } catch (err) {
      return workspaceError(c, err);
    }
  });

  // Encoded separators (%2f, %5c) and NULs are never legitimate in a stored
  // file name; c.req.path keeps them undecoded, so reject them here before
  // the workspace layer would treat them as literal name characters.
  const badRel = (rel: string) =>
    !rel || /%2f|%5c|\\|\0/i.test(rel);

  app.get("/workspace/:session/file/*", async (c) => {
    const rel = c.req.path.split("/file/")[1] ?? "";
    if (badRel(rel)) return c.json({ error: "invalid file path" }, 400);
    try {
      const content = await wsFor(c.req.param("session")).read(rel);
      if (content.length > MAX_READ_CHARS) {
        return c.json({ error: "file exceeds the 512 KB read cap" }, 413);
      }
      return c.json({ path: rel, content });
    } catch (err) {
      return workspaceError(c, err);
    }
  });

  app.put("/workspace/:session/file/*", async (c) => {
    const rel = c.req.path.split("/file/")[1] ?? "";
    if (badRel(rel)) return c.json({ error: "invalid file path" }, 400);
    let body: { content?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (typeof body.content !== "string" || body.content.length === 0) {
      return c.json({ error: "content must be a non-empty string" }, 400);
    }
    if (body.content.length > MAX_WRITE_CHARS) {
      return c.json({ error: "content exceeds the 256 KB write cap" }, 413);
    }
    try {
      await wsFor(c.req.param("session")).write(rel, body.content);
      return c.json({ ok: true, path: rel });
    } catch (err) {
      return workspaceError(c, err);
    }
  });

  // --- Spec of record --------------------------------------------------------

  type Loaded =
    | { ok: true; ws: import("./workspace").Workspace; spec: BuildSpec }
    | { ok: false; status: 400 | 409; body: unknown };

  /** Load and validate spec.json for a session. */
  const loadSpec = async (session: string): Promise<Loaded> => {
    const ws = wsFor(session);
    let raw: string;
    try {
      raw = await ws.read("spec.json");
    } catch {
      return {
        ok: false,
        status: 400,
        body: { error: "no spec.json in this session — compile a spec first" },
      };
    }
    const parsed = buildSpecSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        body: { error: "spec.json failed schema validation" },
      };
    }
    const g0 = checkSpec(parsed.data);
    if (!g0.ok) {
      return {
        ok: false,
        status: 409,
        body: {
          error: "G0 failed",
          issues: g0.issues,
          blockingUnknowns: g0.blockingUnknowns,
        },
      };
    }
    return { ok: true, ws, spec: parsed.data };
  };

  // --- Gate chain ------------------------------------------------------------

  app.post("/gates/:session/run", async (c) => {
    const loaded = await loadSpec(c.req.param("session"));
    if (!loaded.ok) return c.json(loaded.body, loaded.status);
    const results = await gateChain(loaded.ws, loaded.spec);
    return c.json({ results, summary: summarize(results) });
  });

  // --- Full build: scaffold → codegen → gates → bounded repairs --------------

  const MIN_ROUNDS = 1;
  const MAX_ROUNDS = 5;
  const DEFAULT_ROUNDS = 3;

  /**
   * Optional { maxRounds } body: total generation rounds (1 initial +
   * repairs). Clamped to 1–5; the default matches the codegen policy.
   */
  const parseRounds = async (c: import("hono").Context): Promise<
    { ok: true; maxRounds?: number } | { ok: false; body: unknown }
  > => {
    const raw = await c.req.text();
    if (!raw.trim()) return { ok: true, maxRounds: undefined };
    let body: { maxRounds?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return { ok: false, body: { error: "Invalid JSON body" } };
    }
    if (typeof body.maxRounds !== "number" || !Number.isFinite(body.maxRounds)) {
      return { ok: false, body: { error: "maxRounds must be a number" } };
    }
    const clamped = Math.min(
      MAX_ROUNDS,
      Math.max(MIN_ROUNDS, Math.round(body.maxRounds)),
    );
    return { ok: true, maxRounds: clamped };
  };

  app.post("/build/:session/run", async (c) => {
    const session = c.req.param("session");
    if (running.has(session)) {
      return c.json({ error: "a build is already running for this session" }, 409);
    }
    const rounds = await parseRounds(c);
    if (!rounds.ok) return c.json(rounds.body, 400);
    const loaded = await loadSpec(session);
    if (!loaded.ok) return c.json(loaded.body, loaded.status);
    const uid = Number(c.get("user").id);
    if (Number.isFinite(uid)) {
      void buildStart(uid, session).catch((err) =>
        log.error("builder history record failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
    running.add(session);
    let outcome: BuildOutcome;
    try {
      outcome = await build(loaded.ws, loaded.spec, {
        maxRounds: rounds.maxRounds ?? DEFAULT_ROUNDS,
      });
    } catch (err) {
      log.error("builder build failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      running.delete(session);
      return c.json(
        { error: err instanceof Error ? err.message : "build failed" },
        502,
      );
    }
    running.delete(session);
    if (Number.isFinite(uid)) {
      void buildEnd(uid, session, outcome).catch((err) =>
        log.error("builder history record failed", {
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
    return c.json({
      summary: outcome.summary,
      results: outcome.results,
      rounds: outcome.rounds,
      events: outcome.events,
    });
  });

  // --- Live build status (incremental buildlog.jsonl) -------------------------

  app.get("/build/:session/status", async (c) => {
    const ws = wsFor(c.req.param("session"));
    let raw: string;
    try {
      raw = await ws.read("buildlog.jsonl");
    } catch {
      return c.json({ error: "no build log for this session" }, 404);
    }
    const events = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return null;
        }
      })
      .filter((e) => e !== null);
    return c.json({ events, running: running.has(c.req.param("session")) });
  });

  // --- Preview: serve the built dist/ (D15) -----------------------------------

  const MIME: Record<string, string> = {
    html: "text/html; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    css: "text/css; charset=utf-8",
    json: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    map: "application/json; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    wasm: "application/wasm",
    woff: "font/woff",
    woff2: "font/woff2",
  };

  app.get("/preview/:session/*", async (c) => {
    const rel = c.req.path.split(`/preview/${c.req.param("session")}/`)[1] ?? "";
    if (/%2f|%5c|\\|\0/i.test(rel)) {
      return c.json({ error: "invalid path" }, 400);
    }
    const ws = wsFor(c.req.param("session"));
    // SPA fallback: extensionless (or missing) paths resolve to index.html.
    const hasExt = /\.[a-z0-9]+$/i.test(rel);
    const candidates = rel
      ? hasExt
        ? [`dist/${rel}`]
        : [`dist/${rel}/index.html`, "dist/index.html"]
      : ["dist/index.html"];
    for (const candidate of candidates) {
      try {
        const content = await ws.read(candidate);
        const ext = candidate.split(".").pop() ?? "";
        return c.newResponse(content, {
          headers: {
            "Content-Type": MIME[ext] ?? "application/octet-stream",
            // Generated apps must never inherit the parent's framing policy.
            "Content-Security-Policy":
              "frame-ancestors 'self' http://localhost:* http://127.0.0.1:*",
            "X-Content-Type-Options": "nosniff",
          },
        });
      } catch {
        /* try the next candidate */
      }
    }
    return c.json(
      { error: "no built app — run a build that passes G2 first" },
      404,
    );
  });

  return app;
}

function workspaceError(c: import("hono").Context, err: unknown) {
  if (err instanceof WorkspaceError) return c.json({ error: err.message }, 400);
  const code = (err as { code?: string })?.code;
  if (code === "ENOENT") return c.json({ error: "not found" }, 404);
  log.error("builder workspace error", {
    error: err instanceof Error ? err.message : String(err),
  });
  return c.json({ error: "workspace operation failed" }, 500);
}
