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
