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
});
