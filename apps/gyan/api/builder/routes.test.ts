import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { User } from "@db/schema";
import { createBuilderRoutes } from "./routes";
import { checkSpec, type BuildSpec } from "./spec";

const fakeUser = { id: "u1" } as unknown as User;

function validSpec(): BuildSpec {
  return {
    appName: "Route Fixture",
    userStories: [
      { id: "US1", story: "a", acceptance: "a" },
      { id: "US2", story: "b", acceptance: "b" },
      { id: "US3", story: "c", acceptance: "c" },
    ],
    entities: [
      { name: "Item", fields: [{ name: "id", type: "string" }], relationships: [], provenance: "proposed" },
    ],
    screens: [
      { name: "Home", purpose: "start", primaryAction: "go", reads: ["Item"], writes: [] },
    ],
    primaryFlow: "From the Home screen, go",
    authModel: "none",
    gates: ["G0", "G1", "G2", "G3", "G4"],
    unknowns: [],
  };
}

describe("builder routes", () => {
  let dir: string;
  let app: Hono;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "volt-builder-routes-"));
    app = new Hono();
    app.route(
      "/api/builder",
      createBuilderRoutes({
        authenticate: async () => fakeUser,
        compile: async (input) => {
          const spec = validSpec();
          spec.appName = input.prompt.slice(0, 60);
          return { spec, g0: checkSpec(spec) };
        },
        gateChain: async () => [
          { gate: "G0", status: "pass", durationMs: 1 },
          { gate: "G1", status: "pass", durationMs: 2 },
          { gate: "G2", status: "skipped", durationMs: 0, errorExcerpt: "stub" },
          { gate: "G3", status: "skipped", durationMs: 0, errorExcerpt: "stub" },
          { gate: "G4", status: "skipped", durationMs: 0, errorExcerpt: "stub" },
        ],
        dataDir: dir,
      }),
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("rejects unauthenticated requests on every endpoint", async () => {
    const locked = new Hono();
    locked.route(
      "/api/builder",
      createBuilderRoutes({
        authenticate: async () => {
          throw new Error("no session");
        },
        dataDir: dir,
      }),
    );
    for (const [method, url] of [
      ["GET", "/api/builder/workspace/s1/files"],
      ["POST", "/api/builder/spec"],
    ] as const) {
      const res = await locked.request(url, { method });
      expect(res.status).toBe(401);
    }
  });

  it("compiles a spec, runs G0, and persists spec.json into the workspace", async () => {
    const res = await app.request("/api/builder/spec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Invoice tracker", sessionId: "s1" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessionId: string;
      g0: { ok: boolean };
      spec: { appName: string };
    };
    expect(body.sessionId).toBe("s1");
    expect(body.g0.ok).toBe(true);
    expect(body.spec.appName).toBe("Invoice tracker");

    const files = (await (
      await app.request("/api/builder/workspace/s1/files")
    ).json()) as { files: string[] };
    expect(files.files).toContain("spec.json");
    const specFile = (await (
      await app.request("/api/builder/workspace/s1/file/spec.json")
    ).json()) as { content: string };
    expect(JSON.parse(specFile.content).appName).toBe("Invoice tracker");
  });

  it("rejects a compile request without a prompt", async () => {
    const res = await app.request("/api/builder/spec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "s1" }),
    });
    expect(res.status).toBe(400);
  });

  it("round-trips workspace files through PUT/list/GET", async () => {
    const put = await app.request("/api/builder/workspace/s2/file/src/app.ts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "export const app = 1;\n" }),
    });
    expect(put.status).toBe(200);
    const files = (await (
      await app.request("/api/builder/workspace/s2/files")
    ).json()) as { files: string[] };
    expect(files.files).toEqual(["src/app.ts"]);
    const got = (await (
      await app.request("/api/builder/workspace/s2/file/src/app.ts")
    ).json()) as { content: string };
    expect(got.content).toBe("export const app = 1;\n");
  });

  it("rejects path escapes and oversized writes", async () => {
    const escape = await app.request(
      "/api/builder/workspace/s3/file/..%2f..%2fetc%2fpasswd",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "x" }),
      },
    );
    expect(escape.status).toBe(400);
    const big = await app.request("/api/builder/workspace/s3/file/big.txt", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(256 * 1024 + 1) }),
    });
    expect(big.status).toBe(413);
  });

  it("returns 404 when reading a file that does not exist", async () => {
    const res = await app.request("/api/builder/workspace/s4/file/missing.txt");
    expect(res.status).toBe(404);
  });

  it("runs the gate chain from the persisted spec.json", async () => {
    await app.request("/api/builder/spec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Gate runner", sessionId: "s5" }),
    });
    const res = await app.request("/api/builder/gates/s5/run", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: unknown[];
      summary: string;
    };
    expect(body.results).toHaveLength(5);
    expect(body.summary).toContain("gates");
  });

  it("refuses to run gates without a compiled spec", async () => {
    const res = await app.request("/api/builder/gates/empty/run", {
      method: "POST",
    });
    expect(res.status).toBe(400);
  });

  it("records the compile through the injected persist dep", async () => {
    const recorded: unknown[][] = [];
    const app2 = new Hono();
    app2.route(
      "/api/builder",
      createBuilderRoutes({
        authenticate: async () => ({ id: 42 }) as unknown as User,
        compile: async (input) => {
          const spec = validSpec();
          spec.appName = input.prompt.slice(0, 60);
          return { spec, g0: checkSpec(spec) };
        },
        persist: {
          recordSpec: async (uid, sessionId, prompt) => {
            recorded.push([uid, sessionId, prompt]);
          },
        },
        dataDir: dir,
      }),
    );
    await app2.request("/api/builder/spec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Persist me", sessionId: "s-persist" }),
    });
    expect(recorded).toHaveLength(1);
    expect(recorded[0][0]).toBe(42);
    expect(recorded[0][1]).toBe("s-persist");
  });

  it("serves the built dist/ as a preview with SPA fallback", async () => {
    await app.request("/api/builder/workspace/s7/file/dist/index.html", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "<html>built app</html>" }),
    });
    await app.request("/api/builder/workspace/s7/file/dist/assets/app.js", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "console.log(1);" }),
    });
    const root = await app.request("/api/builder/preview/s7/");
    expect(root.status).toBe(200);
    expect(root.headers.get("Content-Type")).toContain("text/html");
    expect(await root.text()).toContain("built app");
    const asset = await app.request("/api/builder/preview/s7/assets/app.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("Content-Type")).toContain("text/javascript");
    // extensionless deep link falls back to the SPA shell
    const spa = await app.request("/api/builder/preview/s7/invoices");
    expect(spa.status).toBe(200);
    expect(await spa.text()).toContain("built app");
    // nothing built yet → honest 404
    const missing = await app.request("/api/builder/preview/empty/");
    expect(missing.status).toBe(404);
  });

  it("refuses to preview paths outside dist/", async () => {
    await app.request("/api/builder/workspace/s8/file/spec.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "{}" }),
    });
    const escape = await app.request(
      "/api/builder/preview/s8/..%2f..%2fspec.json",
    );
    expect(escape.status).toBe(400);
    // even a literal traversal attempt is confined to dist/ by the prefix
    const literal = await app.request("/api/builder/preview/s8/../../spec.json");
    expect([400, 404]).toContain(literal.status);
  });

  it("returns live build events from the incremental buildlog", async () => {
    await app.request("/api/builder/workspace/s9/file/buildlog.jsonl", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content:
          '{"t":"clear","at":1}\n{"t":"scaffold","at":2}\n{"t":"gates","at":3}\n',
      }),
    });
    const res = await app.request("/api/builder/build/s9/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      events: { t: string }[];
      running: boolean;
    };
    expect(body.events.map((e) => e.t)).toEqual(["clear", "scaffold", "gates"]);
    expect(body.running).toBe(false);
    const none = await app.request("/api/builder/build/nope/status");
    expect(none.status).toBe(404);
  });

  it("rejects a concurrent second build on the same session", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const app2 = new Hono();
    app2.route(
      "/api/builder",
      createBuilderRoutes({
        authenticate: async () => fakeUser,
        compile: async (input) => {
          const spec = validSpec();
          spec.appName = input.prompt.slice(0, 60);
          return { spec, g0: checkSpec(spec) };
        },
        build: async () => {
          await gate;
          return {
            summary: "5/5 gates passed",
            results: [],
            rounds: { used: 1, repaired: false },
            events: [],
          };
        },
        dataDir: dir,
      }),
    );
    await app2.request("/api/builder/spec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Lock test", sessionId: "s10" }),
    });
    const first = app2.request("/api/builder/build/s10/run", { method: "POST" });
    await new Promise((r) => setTimeout(r, 20));
    const second = await app2.request("/api/builder/build/s10/run", {
      method: "POST",
    });
    expect(second.status).toBe(409);
    release();
    const firstRes = await first;
    expect(firstRes.status).toBe(200);
    // after the build finished the lock is gone
    const third = await app2.request("/api/builder/build/s10/run", {
      method: "POST",
    });
    expect(third.status).toBe(200);
  });

  it("runs a full build through the injected codegen dep", async () => {
    const builtFor: string[] = [];
    const app2 = new Hono();
    app2.route(
      "/api/builder",
      createBuilderRoutes({
        authenticate: async () => fakeUser,
        compile: async (input) => {
          const spec = validSpec();
          spec.appName = input.prompt.slice(0, 60);
          return { spec, g0: checkSpec(spec) };
        },
        build: async (_ws, spec) => {
          builtFor.push((spec as { appName: string }).appName);
          return {
            summary: "5/5 gates passed",
            results: [],
            rounds: { used: 1, repaired: false },
            events: [{ t: "scaffold", at: Date.now() }],
          };
        },
        dataDir: dir,
      }),
    );
    await app2.request("/api/builder/spec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "Build it", sessionId: "s6" }),
    });
    const res = await app2.request("/api/builder/build/s6/run", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { summary: string; rounds: { used: number } };
    expect(body.summary).toBe("5/5 gates passed");
    expect(body.rounds.used).toBe(1);
    expect(builtFor).toEqual(["Build it"]);
  });
});
