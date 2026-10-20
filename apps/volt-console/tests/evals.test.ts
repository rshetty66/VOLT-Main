import { describe, expect, it } from "vitest";
import { loadGolden, regressions, runEvals, scoreRun, type EvalReport } from "../evals/evals";
import { loadCatalog } from "../server/catalog";
import type { StoredRun } from "../shared/records";

const catalog = loadCatalog();

describe("workflow evals", () => {
  it("has a golden prompt for every workflow", () => {
    const golden = loadGolden();
    expect(golden.map((g) => g.workflowId).sort()).toEqual(catalog.workflows.map((w) => w.id).sort());
    expect(golden.every((g) => g.prompt.includes("fictional") || g.prompt.includes("VOLT console"))).toBe(true);
  });

  it("runs workflows against the mock and passes them", async () => {
    const report = await runEvals({ mode: "mock", workflows: ["close-optimization", "finance-ai-strategy", "onestream-fpa"] });
    expect(report.results.map((r) => [r.workflowId, r.pass]).sort()).toEqual([
      ["close-optimization", true],
      ["finance-ai-strategy", true],
      ["onestream-fpa", true],
    ]);
    const close = report.results.find((r) => r.workflowId === "close-optimization")!.checks;
    expect(close.find((c) => c.name === "every specialist finished")?.detail).toBe("10 of 10");
    expect(close.find((c) => c.name === "handoff summaries")?.pass).toBe(true);
  }, 60_000);

  it("fails a run whose deliverable is thin, broken or missing a specialist", () => {
    const golden = loadGolden().find((g) => g.workflowId === "close-optimization")!;
    const run = {
      status: "done",
      error: null,
      finalText: "## Executive summary\nShort, and undefined.",
      events: [{ type: "agent_end", lane: "close-optimization:0:apqc-researcher", agentId: "apqc-researcher", ok: true }],
    } as unknown as StoredRun;
    const checks = Object.fromEntries(scoreRun(run, golden, catalog, "live").map((c) => [c.name, c]));
    expect(checks["deliverable written"].pass).toBe(false);
    expect(checks["deliverable sections"].detail).toBe("missing: recommendations table, risks, next steps");
    expect(checks["no broken output"].pass).toBe(false);
    expect(checks["every specialist finished"].detail).toMatch(/^missing: consolidation-reporting-agent/);
    expect(checks["mentions the essentials"].detail).toBe("missing: close, reconcil, roadmap");
  });

  it("flags regressions against the previous run", () => {
    const r = (pass: boolean, avg?: number) => ({ mode: "live", results: [{ workflowId: "w", pass, judge: avg === undefined ? undefined : { average: avg } }] }) as unknown as EvalReport;
    expect(regressions(r(false), r(true))).toEqual(["w: passed before, fails now"]);
    expect(regressions(r(true, 3.2), r(true, 4))).toEqual(["w: judge 4 -> 3.2"]);
    expect(regressions(r(true, 3.8), r(true, 4))).toEqual([]);
  });
});
