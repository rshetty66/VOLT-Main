import { describe, expect, it } from "vitest";
import { benchmarkLayout, checksLayout, linearScale, maturityLayout, niceTicks, valueCaseLayout } from "../src/charts/layout";
import { chartableResults } from "../src/charts/results";
import { isMermaid } from "../src/charts/mermaidBlock";
import { compareToBenchmark, buildValueCase, scoreMaturity, type BenchmarkComparison } from "../server/analytics";
import { newRun, applyEvent } from "../src/runState";

describe("chart scales", () => {
  it("maps a domain onto a range linearly, including reversed ranges", () => {
    const s = linearScale([0, 10], [0, 200]);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(100);
    expect(linearScale([0, 10], [200, 0])(10)).toBe(0);
  });

  it("produces round ticks that cover the data", () => {
    const t = niceTicks(-6_000_000, 3_500_000, 5);
    expect(t[0]).toBeLessThanOrEqual(-6_000_000);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(3_500_000);
    expect(t).toContain(0);
    const step = t[1] - t[0];
    t.forEach((v, i) => i && expect(v - t[i - 1]).toBe(step));
  });
});

describe("benchmark layout", () => {
  const close = compareToBenchmark("days_to_close", 12) as BenchmarkComparison;

  it("orders the bands best to worst left to right and places the client inside the axis", () => {
    const l = benchmarkLayout(close.benchmark, 12, 600);
    expect(l.points.top25).toBeLessThan(l.points.median);
    expect(l.points.median).toBeLessThan(l.points.bottom25);
    expect(l.client).toBeGreaterThan(l.points.bottom25); // 12 days is worse than the bottom quartile (10)
    expect(l.client).toBeLessThanOrEqual(600);
    expect(l.bands.map((b) => b.label)).toEqual(["Top 25%", "2nd", "3rd", "Bottom"]);
    expect(l.bands.reduce((a, b) => a + b.width, 0)).toBeCloseTo(600, 6);
  });

  it("keeps the top quartile on the left when higher is better", () => {
    const je = compareToBenchmark("journal_entries_per_fte", 2500) as BenchmarkComparison;
    const l = benchmarkLayout(je.benchmark, 2500, 600);
    expect(l.points.top25).toBeLessThan(l.points.bottom25);
    expect(l.client).toBeGreaterThan(l.points.top25);
    expect(l.client).toBeLessThan(l.points.median);
    expect(je.quartile).toBe("Second quartile");
  });
});

describe("value case layout", () => {
  const vc = buildValueCase({ financeFtes: 140, loadedCostPerFte: 115000, automationPct: 25, oneTimeInvestment: 6_000_000, annualRunCost: 450_000, rampYears: 2, horizonYears: 5 });

  it("returns the investment so the cumulative line starts below zero", () => {
    expect(vc.oneTimeInvestment).toBe(6_000_000);
  });

  it("draws one bar per year and a cumulative line that ends on the undiscounted total", () => {
    const l = valueCaseLayout(vc.yearly, vc.oneTimeInvestment, 640, 260);
    expect(l.bars).toHaveLength(5);
    expect(l.cumulative).toHaveLength(6);
    expect(l.cumulative[0].value).toBe(-6_000_000);
    expect(l.cumulative[5].value).toBe(vc.totalUndiscountedReturn - 6_000_000);
    // every tick label is a value inside the drawn range
    const lo = Math.min(...l.ticks), hi = Math.max(...l.ticks);
    l.cumulative.forEach((p) => expect(p.value).toBeGreaterThanOrEqual(lo));
    l.cumulative.forEach((p) => expect(p.value).toBeLessThanOrEqual(hi));
    // the zero line sits between the top and bottom of the plot
    expect(l.zeroY).toBeGreaterThan(0);
    expect(l.zeroY).toBeLessThan(260);
  });
});

describe("maturity and checks layouts", () => {
  it("scales current and target on a 1-5 axis", () => {
    const m = scoreMaturity([{ dimension: "Close and Consolidation", current: 2, target: 4 }]);
    const l = maturityLayout(m.dimensions, 500);
    expect(l.rows[0].currentX).toBeLessThan(l.rows[0].targetX);
    expect(l.ticks).toEqual([1, 2, 3, 4, 5]);
  });

  it("splits a report into pass, fail and not-run widths", () => {
    const l = checksLayout({ pass: 8, fail: 3, notRun: 9 }, 400);
    expect(l.map((s) => s.label)).toEqual(["PASS", "FAIL", "NOT_RUN"]);
    expect(l.reduce((a, s) => a + s.width, 0)).toBeCloseTo(400, 6);
    expect(l[1].width).toBeCloseTo(60, 6);
  });
});

describe("results and diagrams in a run", () => {
  it("collects chartable tool results from Rudra and the specialist lanes", () => {
    let run = newRun("p", "t", "orchestrate");
    const bench = compareToBenchmark("days_to_close", 12);
    run = applyEvent(run, { type: "tool_call", lane: "rudra", callId: "c1", name: "apqc_benchmark", input: {} });
    run = applyEvent(run, { type: "tool_result", lane: "rudra", callId: "c1", name: "apqc_benchmark", summary: "", data: bench });
    run = applyEvent(run, { type: "tool_call", lane: "rudra", callId: "c2", name: "find_agents", input: {} });
    run = applyEvent(run, { type: "tool_result", lane: "rudra", callId: "c2", name: "find_agents", summary: "", data: [{ id: "x" }] });
    run = applyEvent(run, { type: "agent_start", lane: "L1", parentLane: "rudra", agentId: "a", name: "A", layer: "x", icon: "", brief: "" });
    run = applyEvent(run, { type: "tool_call", lane: "L1", callId: "c3", name: "score_maturity", input: {} });
    run = applyEvent(run, { type: "tool_result", lane: "L1", callId: "c3", name: "score_maturity", summary: "", data: scoreMaturity([{ dimension: "Close and Consolidation", current: 2 }]) });
    const r = chartableResults(run);
    expect(r.map((x) => x.kind)).toEqual(["benchmark", "maturity"]);
  });

  it("recognises mermaid code blocks", () => {
    expect(isMermaid("language-mermaid")).toBe(true);
    expect(isMermaid("language-ts")).toBe(false);
    expect(isMermaid(undefined)).toBe(false);
  });
});

describe("demo routing diagram", () => {
  it("draws one node per specialist with quoted, bracket-free labels", async () => {
    const { routingDiagram } = await import("../server/demo");
    const d = routingDiagram([{ name: 'SAP FI/CO "Deep" Specialist [S/4]' }, { name: "Oracle GL" }], [{ name: "Close Optimization" }]);
    expect(d.startsWith("```mermaid\nflowchart LR")).toBe(true);
    expect(d).toContain(`a0["SAP FI/CO 'Deep' Specialist  S/4 "]`);
    expect(d).toContain("a1 --> synth");
    expect(d).toContain("synth -.-> w0");
    expect(d.trim().endsWith("```")).toBe(true);
  });
});

describe("download sizing", () => {
  it("reads px size from width/height, and falls back to the viewBox for width=100%", async () => {
    const { svgSize, datedName } = await import("../src/download");
    expect(svgSize('<svg width="640" height="128" viewBox="0 0 640 128">')).toEqual({ width: 640, height: 128 });
    expect(svgSize('<svg id="m" width="100%" style="max-width: 1357px;" viewBox="0 0 1357.5 318.75">')).toEqual({ width: 1357.5, height: 318.75 });
    expect(svgSize('<svg viewBox="-8 -8 500 300">')).toEqual({ width: 500, height: 300 });
    expect(datedName("Close / SAP: plan", "docx")).toMatch(/^volt-close-sap-plan-\d{4}-\d{2}-\d{2}\.docx$/);
  });
});
