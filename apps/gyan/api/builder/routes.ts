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
 *   POST /build/:session/run            full build: scaffold → codegen →
 *                                       gates → one evidence-based repair
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
  ) => Promise<BuildOutcome>;
  dataDir?: string;
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
    ((ws, spec) => runBuild(ws, spec as Parameters<typeof runBuild>[1]));
  const dataDir = deps.dataDir ?? builderDataDir();

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

    return c.json({ sessionId, spec: result.spec, g0: result.g0 });
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

  // --- Full build: scaffold → codegen → gates → one repair -------------------

  app.post("/build/:session/run", async (c) => {
    const loaded = await loadSpec(c.req.param("session"));
    if (!loaded.ok) return c.json(loaded.body, loaded.status);
    let outcome: BuildOutcome;
    try {
      outcome = await build(loaded.ws, loaded.spec);
    } catch (err) {
      log.error("builder build failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json(
        { error: err instanceof Error ? err.message : "build failed" },
        502,
      );
    }
    return c.json({
      summary: outcome.summary,
      results: outcome.results,
      rounds: outcome.rounds,
      events: outcome.events,
    });
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
