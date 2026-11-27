import { describe, expect, it } from "vitest";
import { parseChartSpec, parseProcessSpec } from "../shared/viz";
import { specSvg } from "../src/charts/specChart";
import { fitLines, processSvg } from "../src/charts/specProcess";
import { textWidth } from "../src/charts/specChart";
import { DARK } from "../src/charts/palette";
import { VIZ_CSS, VIZ_SCRIPT } from "../src/charts/vizScript";
import { SCRIPT } from "../src/htmlTemplate";

const bar = {
  type: "bar",
  title: "Close days by entity",
  unit: "days",
  labels: ["Canada", "UK"],
  series: [{ name: "Today", values: [9, 10] }, { name: "Target", values: [5, 5] }],
  drill: { uk: { labels: ["Cut-off", "Recs"], series: [{ name: "Today", values: [2, 4] }, { name: "Target", values: [1, 2] }] }, Nowhere: { labels: ["a", "b"], series: [{ name: "x", values: [1, 2] }] } },
};

describe("chart drill-down", () => {
  it("keeps a valid breakdown per known label, of the same type, one level deep", () => {
    const s = parseChartSpec(JSON.stringify(bar))!;
    expect(Object.keys(s.drill!)).toEqual(["1"]);
    expect(s.drill![1].type).toBe("bar");
    expect(s.drill![1].title).toBe("Close days by entity: UK");
    expect(s.drill![1].unit).toBe("days");
    expect(s.drill![1].drill).toBeUndefined();
  });

  it("ignores drill on types that cannot drill", () => {
    expect(parseChartSpec(JSON.stringify({ ...bar, type: "line" }))!.drill).toBeUndefined();
  });
});

describe("interactive chart markup", () => {
  it("tags every mark with its label and series, and legend entries with their series", () => {
    const svg = specSvg(parseChartSpec(JSON.stringify(bar))!, DARK, { interactive: true });
    expect(svg.match(/class="vm" data-i="\d" data-s="\d"/g)).toHaveLength(4);
    expect(svg.match(/class="vl" data-s="\d"/g)).toHaveLength(2);
    expect(svg.match(/class="vh" data-i="\d"/g)).toHaveLength(2);
  });

  it("leaves hover bands out of downloads", () => {
    expect(specSvg(parseChartSpec(JSON.stringify(bar))!, DARK)).not.toContain('class="vh"');
  });
});

const flow = {
  title: "Close",
  lanes: ["Entity accounting", "Group reporting"],
  steps: [
    { id: "a", lane: "Entity accounting", stage: "D-1", name: "Reconcile general ledger accounts across every entity and sub-ledger in the group", pcf: "9.3.2.6 Reconcile general ledger accounts [10824]", issue: "Manual" },
    { id: "b", lane: "Entity accounting", stage: "D+1", name: "Trial balance" },
    { id: "c", lane: "Group reporting", stage: "D+1", name: "Consolidate" },
  ],
  links: [{ from: "a", to: "b", label: "a label far too long to fit between two cards" }, { from: "b", to: "c", label: "TB" }],
};

describe("process flow fit", () => {
  it("keeps the APQC PCF citation and shows its hierarchy ID on the card", () => {
    const p = parseProcessSpec(JSON.stringify(flow))!;
    expect(p.steps[0].pcf).toBe("9.3.2.6 Reconcile general ledger accounts [10824]");
    expect(processSvg(p, DARK)).toContain(">PCF 9.3.2.6<");
  });

  it("marks lanes, issues and steps for the walkthrough", () => {
    const svg = processSvg(parseProcessSpec(JSON.stringify(flow))!, DARK);
    expect(svg).toContain('class="vp-lane" data-lane="1"');
    expect(svg).toContain('data-lane="0" data-issue="1"');
  });

  it("draws a link label only where it fits, so labels never sit on cards", () => {
    const svg = processSvg(parseProcessSpec(JSON.stringify(flow))!, DARK);
    expect(svg).not.toContain("far too long");
  });

  it("is drawn at most a page wide for a normal flow", () => {
    const svg = processSvg(parseProcessSpec(JSON.stringify(flow))!, DARK);
    expect(Number(svg.match(/viewBox="0 0 (\d+)/)![1])).toBeLessThanOrEqual(1160);
  });

  it("wraps names and ends what does not fit with an ellipsis, every line within the width", () => {
    const lines = fitLines("Reconcile general ledger accounts across every entity and sub-ledger in the group", 120, 11, 3);
    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith("...")).toBe(true);
    for (const l of lines) expect(textWidth(l, 11)).toBeLessThanOrEqual(120);
  });
});

describe("shared interaction script", () => {
  it("is valid script, defines chart and flow, and is inlined in the HTML deliverable", () => {
    const w: Record<string, unknown> = {};
    new Function("window", "document", "matchMedia", VIZ_SCRIPT)(w, {}, undefined);
    const viz = w.voltViz as Record<string, unknown>;
    expect(typeof viz.chart).toBe("function");
    expect(typeof viz.flow).toBe("function");
    expect(SCRIPT).toContain(VIZ_SCRIPT);
    expect(VIZ_CSS).toContain(".vv-tip");
  });
});
