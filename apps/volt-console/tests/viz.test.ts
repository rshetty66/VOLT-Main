import { describe, expect, it } from "vitest";
import { chartBlocks, countVisuals, parseChartSpec } from "../shared/viz";
import { specSvg } from "../src/charts/specChart";
import { DARK, LIGHT } from "../src/charts/palette";
import { markdownBlocks } from "../server/export/blocks";

const good = { type: "bar", title: "Close days", unit: "days", labels: ["EMEA", "APAC"], series: [{ name: "Today", values: [12, 9] }, { name: "Target", values: [5, 5] }], source: "Client data [S01]" };

describe("chart spec", () => {
  it("accepts a valid chart and keeps its fields", () => {
    const spec = parseChartSpec(JSON.stringify(good))!;
    expect(spec.type).toBe("bar");
    expect(spec.series).toHaveLength(2);
    expect(spec.unit).toBe("days");
  });

  it("rejects what cannot be drawn: bad JSON, unknown type, one label, mismatched or non-numeric values, too many series", () => {
    expect(parseChartSpec("{not json")).toBeNull();
    expect(parseChartSpec(JSON.stringify({ ...good, type: "radar" }))).toBeNull();
    expect(parseChartSpec(JSON.stringify({ ...good, labels: ["only"], series: [{ name: "a", values: [1] }] }))).toBeNull();
    expect(parseChartSpec(JSON.stringify({ ...good, series: [{ name: "a", values: [1] }] }))).toBeNull();
    expect(parseChartSpec(JSON.stringify({ ...good, series: [{ name: "a", values: [1, "x"] }] }))).toBeNull();
    expect(parseChartSpec(JSON.stringify({ ...good, series: Array.from({ length: 4 }, () => ({ name: "s", values: [1, 2] })) }))).toBeNull();
    expect(parseChartSpec(JSON.stringify({ ...good, type: "donut", series: [{ name: "a", values: [1, -2] }] }))).toBeNull();
  });

  it("finds chart blocks in order, null for an invalid one, and counts charts and diagrams as visuals", () => {
    const md = "text\n```chart\n" + JSON.stringify(good) + "\n```\n\n```chart\nbroken\n```\n\n```mermaid\nflowchart LR\n A-->B\n```\n";
    const blocks = chartBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.title).toBe("Close days");
    expect(blocks[1]).toBeNull();
    expect(countVisuals(md)).toBe(3);
  });

  it("numbers chart blocks as image refs for the document writers", () => {
    const md = "```chart\n" + JSON.stringify(good) + "\n```\n\n```mermaid\nflowchart LR\n A-->B\n```\n\n```chart\n" + JSON.stringify(good) + "\n```\n";
    const refs = markdownBlocks(md).filter((b) => b.type === "image").map((b) => (b as { ref: string }).ref);
    expect(refs).toEqual(["viz-0", "diagram-0", "viz-1"]);
  });
});

describe("chart drawing", () => {
  const kinds = [
    { ...good, type: "bar" },
    { ...good, type: "hbar" },
    { ...good, type: "line" },
    { type: "donut", title: "Split", labels: ["A", "B", "C"], series: [{ name: "x", values: [3, 2, 1] }] },
  ];
  it.each(kinds)("draws a $type chart as a self-contained SVG in both palettes", (k) => {
    const spec = parseChartSpec(JSON.stringify(k))!;
    for (const p of [DARK, LIGHT]) {
      const svg = specSvg(spec, p);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain(spec.title);
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
    }
  });
  it("escapes text from the model", () => {
    const spec = parseChartSpec(JSON.stringify({ ...good, title: "<script>alert(1)</script>", labels: ["a&b", "c"] }))!;
    const svg = specSvg(spec, LIGHT);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("a&amp;b");
  });
  it("draws negative values and an all-zero series without NaN", () => {
    for (const values of [[-5, 10], [0, 0]]) {
      const svg = specSvg(parseChartSpec(JSON.stringify({ ...good, series: [{ name: "a", values }] }))!, LIGHT);
      expect(svg).not.toContain("NaN");
    }
  });
});

describe("executive chart types", () => {
  const specs = {
    stacked: { type: "stacked", title: "Cost by tower", unit: "$m", labels: ["R2R", "P2P", "O2C"], series: [{ name: "People", values: [4, 3, 2] }, { name: "Tech", values: [1, 2, 1] }, { name: "Other", values: [0.5, 0.5, 0.2] }] },
    combo: { type: "combo", title: "Volume and rate", unit: "k", unit2: "%", labels: ["Q1", "Q2", "Q3"], series: [{ name: "Journals", values: [40, 38, 31] }, { name: "Auto rate", values: [22, 35, 58] }] },
    waterfall: { type: "waterfall", title: "NII walk", unit: "$m", labels: ["Q2 NII", "Volume", "Margin", "Days", "Q3 NII"], series: [{ name: "NII", values: [500, 30, -12, 6, 524] }], highlight: "Margin" },
    kpi: { type: "kpi", title: "Close scorecard", unit: "days", labels: ["Close", "Recs", "Manual JEs"], series: [{ name: "Now", values: [6, 120, 340] }, { name: "Prior", values: [9, 150, 410] }], better: "down", trends: [[12, 10, 9, 6], [], [500, 410, 340]] },
    heatmap: { type: "heatmap", title: "Readiness", scale: "rag", labels: ["Data", "Process", "Tech"], series: [{ name: "EMEA", values: [1, 2, 3] }, { name: "APAC", values: [3, 3, 2] }] },
  };

  it.each(Object.entries(specs))("draws a %s chart at every animation frame without NaN", (_, k) => {
    const spec = parseChartSpec(JSON.stringify(k))!;
    expect(spec).not.toBeNull();
    for (const p of [DARK, LIGHT])
      for (const t of [0, 0.3, 0.7, 1]) {
        const svg = specSvg(spec, p, { t });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      }
  });

  it("reads highlight by label, keeps target, better and trends, and drops options a type cannot use", () => {
    const w = parseChartSpec(JSON.stringify(specs.waterfall))!;
    expect(w.highlight).toBe(2);
    const k = parseChartSpec(JSON.stringify(specs.kpi))!;
    expect(k.better).toBe("down");
    expect(k.trends).toHaveLength(3);
    expect(parseChartSpec(JSON.stringify({ ...good, target: { value: 5, label: "Target" } }))!.target).toEqual({ value: 5, label: "Target" });
    expect(parseChartSpec(JSON.stringify({ ...specs.kpi, target: 3 }))!.target).toBeUndefined();
    expect(parseChartSpec(JSON.stringify({ ...good, highlight: "Nowhere" }))!.highlight).toBeUndefined();
  });

  it("enforces each type's series limits", () => {
    expect(parseChartSpec(JSON.stringify({ ...specs.combo, series: specs.combo.series.slice(0, 1) }))).toBeNull();
    expect(parseChartSpec(JSON.stringify({ ...specs.waterfall, labels: ["A", "B"], series: [{ name: "x", values: [1, 2] }] }))).toBeNull();
    expect(parseChartSpec(JSON.stringify({ ...specs.stacked, series: specs.stacked.series.slice(0, 1) }))).toBeNull();
  });

  it("labels waterfall changes with a sign and totals without one, and a KPI fall as good when lower is better", () => {
    const w = specSvg(parseChartSpec(JSON.stringify(specs.waterfall))!, LIGHT);
    expect(w).toContain(">+30<");
    expect(w).toContain(">-12<");
    expect(w).toContain(">524<");
    const k = specSvg(parseChartSpec(JSON.stringify(specs.kpi))!, LIGHT);
    expect(k).toContain("-3 (-33.3%) vs Prior");
    expect(k).toContain(LIGHT.positive);
  });

  it("starts the entrance with nothing grown and ends with the exact values", () => {
    const spec = parseChartSpec(JSON.stringify({ ...good, type: "bar" }))!;
    expect(specSvg(spec, LIGHT, { t: 0 })).not.toContain(">12<");
    expect(specSvg(spec, LIGHT, { t: 1 })).toContain(">12<");
    expect(specSvg(spec, LIGHT)).toBe(specSvg(spec, LIGHT, { t: 1 }));
  });

  it("gives every mark a hover title", () => {
    expect(specSvg(parseChartSpec(JSON.stringify(specs.heatmap))!, DARK)).toContain("<title>EMEA / Data: Red</title>");
  });
});

describe("chart colours", () => {
  const lum = (hex: string) => {
    const c = hex.replace("#", "").match(/../g)!.map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  it.each([["dark", DARK], ["light", LIGHT]] as const)("gives every %s series a distinct colour at 3:1 or more against the background", (_, p) => {
    for (const set of [p.cats, [p.series, p.series2, p.cats[2], p.cats[3]]]) {
      expect(new Set(set.map((c) => c.toLowerCase())).size).toBe(set.length);
      for (const c of set) expect(ratio(c, p.bg)).toBeGreaterThanOrEqual(3);
    }
  });
  it("folds a donut's smallest slices into Other so no two slices share a colour", () => {
    const spec = parseChartSpec(JSON.stringify({ type: "donut", title: "Split", labels: ["A", "B", "C", "D", "E", "F", "G", "H"], series: [{ name: "x", values: [8, 1, 7, 2, 6, 3, 5, 4] }] }))!;
    expect(spec.labels).toEqual(["A", "C", "E", "G", "H", "Other"]);
    expect(spec.series[0].values).toEqual([8, 7, 6, 5, 4, 6]);
  });
});
