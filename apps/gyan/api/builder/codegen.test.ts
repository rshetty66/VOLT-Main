import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyFileMap,
  buildCodegenMessages,
  codegenSystemPrompt,
  failureReport,
  runBuild,
  type FileMap,
} from "./codegen";
import type { BuildSpec } from "./spec";
import type { GateResult } from "./gates";
import { Workspace } from "./workspace";

function validSpec(): BuildSpec {
  return {
    appName: "Build Fixture",
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

function fileMap(files: Record<string, string>): FileMap {
  return { files: Object.entries(files).map(([p, content]) => ({ path: p, content })) };
}

const PASS: GateResult[] = ["G0", "G1", "G2", "G3", "G4"].map((gate) => ({
  gate: gate as GateResult["gate"],
  status: "pass",
  durationMs: 1,
}));

const G1_FAIL: GateResult[] = [
  { gate: "G0", status: "pass", durationMs: 1 },
  { gate: "G1", status: "fail", durationMs: 2, errorExcerpt: "src/App.tsx(3,1): error TS2304" },
  { gate: "G2", status: "skipped", durationMs: 0, errorExcerpt: "not run — G1 failed" },
  { gate: "G3", status: "skipped", durationMs: 0, errorExcerpt: "not run — G1 failed" },
  { gate: "G4", status: "skipped", durationMs: 0, errorExcerpt: "not run — G1 failed" },
];

describe("codegen contract", () => {
  it("system prompt encodes the stack and honesty rules", () => {
    const p = codegenSystemPrompt();
    expect(p).toContain("tsc --noEmit");
    expect(p).toContain("vite build");
    expect(p).toContain("smoke.mjs");
    expect(p).toContain("localStorage");
    expect(p).toContain("Never write spec.json");
  });

  it("repair round appends failure evidence as a new user message", () => {
    const report = failureReport(G1_FAIL);
    expect(report).toContain("gate G1 failed");
    expect(report).toContain("TS2304");
    const msgs = buildCodegenMessages(validSpec(), report);
    expect(msgs).toHaveLength(3);
    expect(msgs[2].content as string).toContain("Failure evidence");
    expect(msgs[2].content as string).toContain("TS2304");
  });
});

describe("applyFileMap", () => {
  let dir: string;
  let ws: Workspace;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "volt-apply-"));
    ws = new Workspace(dir);
    await ws.ensure();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes valid files and reports unsafe ones as skipped", async () => {
    const r = await applyFileMap(
      ws,
      fileMap({
        "src/app.tsx": "export {}",
        "../evil.ts": "nope",
        "shell.sh": "#!/bin/sh",
        "node_modules/x/index.js": "x",
      }),
    );
    expect(r.written).toEqual(["src/app.tsx"]);
    expect(r.skipped).toHaveLength(3);
    expect(await ws.list()).toEqual(["src/app.tsx"]);
  });
});

describe("runBuild", () => {
  let dir: string;
  let ws: Workspace;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "volt-build-"));
    ws = new Workspace(dir);
    await ws.ensure();
    await ws.write("spec.json", JSON.stringify(validSpec()));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("passes on round 1 without a repair round", async () => {
    const calls: unknown[][] = [];
    const outcome = await runBuild(ws, validSpec(), {
      maxRounds: 3,
      generate: async (args) => {
        calls.push([args]);
        return { object: fileMap({ "src/App.tsx": "export {}" }) };
      },
      gateRunner: async () => PASS,
    });
    expect(calls).toHaveLength(1);
    expect(outcome.rounds).toEqual({ used: 1, repaired: false });
    expect(outcome.summary).toBe("5/5 gates passed");
  });

  it("repairs exactly once with gate evidence, then stops when still failing", async () => {
    const prompts: string[] = [];
    let gateCalls = 0;
    const outcome = await runBuild(ws, validSpec(), {
      generate: async (args) => {
        prompts.push(args.messages.map((m) => String(m.content)).join("\n"));
        return { object: fileMap({ "src/App.tsx": "export {}" }) };
      },
      gateRunner: async () => {
        gateCalls++;
        return G1_FAIL;
      },
    });
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("Failure evidence");
    expect(prompts[1]).toContain("TS2304");
    expect(gateCalls).toBe(2);
    expect(outcome.rounds).toEqual({ used: 2, repaired: true });
    expect(outcome.summary).toContain("gate G1 failed");
  });

  it("scaffolds, preserves spec.json, and writes buildlog.jsonl", async () => {
    await runBuild(ws, validSpec(), {
      generate: async () => ({ object: fileMap({ "src/App.tsx": "export {}" }) }),
      gateRunner: async () => PASS,
    });
    const files = await ws.list();
    expect(files).toContain("spec.json");
    expect(files).toContain("package.json");
    expect(files).toContain("smoke.mjs");
    expect(files).toContain("buildlog.jsonl");
    const log = await ws.read("buildlog.jsonl");
    const events = log.trim().split("\n").map((l) => JSON.parse(l).t);
    expect(events).toEqual(["clear", "scaffold", "generate", "apply", "gates"]);
  });

  it("throws when generation output does not match the file map schema", async () => {
    await expect(
      runBuild(ws, validSpec(), {
        generate: async () => ({ object: { files: "nope" } }),
        gateRunner: async () => PASS,
      }),
    ).rejects.toThrow(/invalid file map/);
  });

  it("clears stale files from a previous build before regenerating", async () => {
    await ws.write("stale-from-old-round.tsx", "old");
    await runBuild(ws, validSpec(), {
      generate: async () => ({ object: fileMap({ "src/App.tsx": "export {}" }) }),
      gateRunner: async () => PASS,
    });
    expect(await ws.list()).not.toContain("stale-from-old-round.tsx");
  });
});
