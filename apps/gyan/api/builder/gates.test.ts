import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runGates, screenRoutes, summarize, type GateConfig } from "./gates";
import type { BuildSpec } from "./spec";
import { Workspace } from "./workspace";

const SERVER_CJS = `const http = require("http");
const port = Number(process.env.PORT || 3000);
http.createServer((req, res) => { res.writeHead(200); res.end("ok"); }).listen(port);
`;

const OK_CHECK = `node -e "process.exit(0)"`;
const OK_BUILD = `node -e "require('fs').mkdirSync('dist',{recursive:true});require('fs').writeFileSync('dist/index.html','ok')"`;
const START = "node server.cjs";

function validSpec(): BuildSpec {
  return {
    appName: "Gate Fixture",
    userStories: [
      { id: "US1", story: "a", acceptance: "a" },
      { id: "US2", story: "b", acceptance: "b" },
      { id: "US3", story: "c", acceptance: "c" },
    ],
    entities: [
      { name: "Thing", fields: [{ name: "id", type: "string" }], relationships: [], provenance: "proposed" },
    ],
    screens: [
      { name: "Home", purpose: "start", primaryAction: "go", reads: ["Thing"], writes: [] },
    ],
    primaryFlow: "From the Home screen, go",
    authModel: "none",
    gates: ["G0", "G1", "G2", "G3", "G4"],
    unknowns: [],
  };
}

describe("runGates", () => {
  let dir: string;
  let ws: Workspace;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "volt-gates-"));
    ws = new Workspace(dir);
    await ws.ensure();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function project(opts: {
    check?: string;
    build?: string;
    start?: string;
    smoke?: string | null;
    browser?: GateConfig["browser"];
  }): Promise<GateConfig> {
    await ws.write("server.cjs", SERVER_CJS);
    if (opts.smoke != null) await ws.write("smoke.mjs", opts.smoke);
    return {
      check: opts.check ?? OK_CHECK,
      build: opts.build ?? OK_BUILD,
      start: opts.start ?? START,
      timeoutMs: 15_000,
      // Tests exercise the browser stage explicitly via injected probes;
      // the default keeps the real chromium out of unit tests.
      browser: opts.browser ?? { disabled: true },
    };
  }

  it("passes all gates when check, build, boot and smoke succeed", async () => {
    const config = await project({ smoke: "process.exit(0)\n" });
    const results = await runGates(ws, validSpec(), config);
    expect(results.map((r) => [r.gate, r.status])).toEqual([
      ["G0", "pass"],
      ["G1", "pass"],
      ["G2", "pass"],
      ["G3", "pass"],
      ["G4", "pass"],
    ]);
    expect(summarize(results)).toBe("5/5 gates passed");
  });

  it("honestly skips G4 when no smoke script exists", async () => {
    const config = await project({ smoke: null });
    const results = await runGates(ws, validSpec(), config);
    const g4 = results.find((r) => r.gate === "G4");
    expect(g4?.status).toBe("skipped");
    expect(g4?.errorExcerpt).toContain("primary flow unverified");
    expect(summarize(results)).toBe("4/5 gates passed");
  });

  it("fails G4 when the smoke script exits non-zero", async () => {
    const config = await project({
      smoke: 'console.error("smoke failed");\nprocess.exit(1);\n',
    });
    const results = await runGates(ws, validSpec(), config);
    const g4 = results.find((r) => r.gate === "G4");
    expect(g4?.status).toBe("fail");
    expect(g4?.errorExcerpt).toContain("smoke failed");
    expect(summarize(results)).toContain("gate G4 failed");
  });

  it("stops at G1 and skips G2–G4 when check fails", async () => {
    const config = await project({
      check: 'node -e "console.error(\'type error\');process.exit(1)"',
      smoke: "process.exit(0)\n",
    });
    const results = await runGates(ws, validSpec(), config);
    expect(results.map((r) => [r.gate, r.status])).toEqual([
      ["G0", "pass"],
      ["G1", "fail"],
      ["G2", "skipped"],
      ["G3", "skipped"],
      ["G4", "skipped"],
    ]);
    expect(results[1].errorExcerpt).toContain("type error");
    expect(results[2].errorExcerpt).toBe("not run — G1 failed");
    expect(summarize(results)).toContain("gate G1 failed");
  });

  it("caps failure excerpts at 20 lines", async () => {
    const config = await project({
      check:
        'node -e "for(let i=0;i<100;i++)console.log(\'line\'+i);process.exit(1)"',
    });
    const results = await runGates(ws, validSpec(), config);
    const g1 = results.find((r) => r.gate === "G1");
    expect(g1?.status).toBe("fail");
    const lines = g1!.errorExcerpt!.split("\n");
    expect(lines.length).toBeLessThanOrEqual(20);
    expect(lines[lines.length - 1]).toBe("line99");
  });

  it("fails G3 when the bundle never serves and skips G4", async () => {
    const config = await project({
      start: 'node -e "console.error(\'boot crashed\');process.exit(1)"',
      smoke: "process.exit(0)\n",
    });
    const results = await runGates(ws, validSpec(), {
      ...config,
      timeoutMs: 2_000,
    });
    expect(results.map((r) => [r.gate, r.status])).toEqual([
      ["G0", "pass"],
      ["G1", "pass"],
      ["G2", "pass"],
      ["G3", "fail"],
      ["G4", "skipped"],
    ]);
    expect(results[3].errorExcerpt).toContain("boot crashed");
  }, 15_000);

  it("skips everything after G0 when the spec is incomplete", async () => {
    const config = await project({ smoke: "process.exit(0)\n" });
    const spec = validSpec();
    spec.primaryFlow = "Exports a PDF with no screen reference";
    const results = await runGates(ws, spec, config);
    expect(results[0]).toMatchObject({ gate: "G0", status: "fail" });
    expect(results.slice(1).every((r) => r.status === "skipped")).toBe(true);
  });

  it("passes G4 with a note when the browser probe is skipped", async () => {
    const config = await project({
      smoke: "process.exit(0)\n",
      browser: {
        probe: async () => ({
          ok: true,
          consoleErrors: [],
          skipped: "no chromium binary found",
        }),
      },
    });
    const results = await runGates(ws, validSpec(), config);
    const g4 = results.find((r) => r.gate === "G4");
    expect(g4?.status).toBe("pass");
    expect(g4?.note).toContain("browser stages skipped");
  });

  it("fails G4 when the browser probe sees console errors", async () => {
    const config = await project({
      smoke: "process.exit(0)\n",
      browser: {
        probe: async () => ({
          ok: false,
          consoleErrors: ["console.error: boom"],
        }),
      },
    });
    const results = await runGates(ws, validSpec(), config);
    const g4 = results.find((r) => r.gate === "G4");
    expect(g4?.status).toBe("fail");
    expect(g4?.errorExcerpt).toContain("browser probe failed");
    expect(g4?.errorExcerpt).toContain("boom");
    expect(summarize(results)).toContain("gate G4 failed");
  });

  it("fails G4 when the primary-action round-trip does nothing", async () => {
    const config = await project({
      smoke: "process.exit(0)\n",
      browser: {
        probe: async () => ({
          ok: false,
          consoleErrors: [],
          actionError: "primary action click produced no DOM change or navigation",
        }),
      },
    });
    const results = await runGates(ws, validSpec(), config);
    const g4 = results.find((r) => r.gate === "G4");
    expect(g4?.status).toBe("fail");
    expect(g4?.errorExcerpt).toContain("no DOM change");
  });

  it("notes a fully verified G4 pass from the browser probe", async () => {
    const config = await project({
      smoke: "process.exit(0)\n",
      browser: { probe: async () => ({ ok: true, consoleErrors: [] }) },
    });
    const results = await runGates(ws, validSpec(), config);
    const g4 = results.find((r) => r.gate === "G4");
    expect(g4?.status).toBe("pass");
    expect(g4?.note).toBe("smoke + browser probe passed");
  });

  it("passes G4 with a note when the browser stage is disabled", async () => {
    const config = await project({
      smoke: "process.exit(0)\n",
      browser: { disabled: true },
    });
    const results = await runGates(ws, validSpec(), config);
    const g4 = results.find((r) => r.gate === "G4");
    expect(g4?.status).toBe("pass");
    expect(g4?.note).toContain("browser stages disabled");
  });
});

describe("screenRoutes", () => {
  it("maps the start screen to / and kebab-cases the rest", () => {
    const spec = validSpec();
    spec.screens = [
      { name: "Home", purpose: "start", primaryAction: "go", reads: [], writes: [] },
      { name: "Invoice List", purpose: "list", primaryAction: "add", reads: [], writes: [] },
      { name: "Audit  Trail!", purpose: "review", primaryAction: "run", reads: [], writes: [] },
    ];
    expect(screenRoutes(spec)).toEqual(["/", "/invoice-list", "/audit-trail"]);
  });
});
