import { describe, expect, it } from "vitest";
import { isFinanceTransformation, missingViews, parseLifecycleSpec, parseTaxonomySpec, taxonomyCounts, viewBlocks } from "../shared/views";
import { countVisuals, parseArchSpec } from "../shared/viz";
import { lifecycleSvg, taxonomySvg } from "../src/charts/specViews";
import { archSvg } from "../src/charts/specArch";
import { DARK, LIGHT } from "../src/charts/palette";
import { markdownBlocks } from "../server/export/blocks";
import { loadCatalog } from "../server/catalog";
import { runLocalTool, schemas } from "../server/tools";
import { assessDepth } from "../server/deliverable";
import { chatLeadIn, kpisFirst, sectionSlides } from "../src/htmlDeck";
import { referenceLayout } from "../src/htmlTemplate";
import { clip, mergeHandoffs } from "../src/agentStage";
import { VIEWS, VIEWS_MD } from "./fixtures/views";

describe("taxonomy and lifecycle views", () => {
  it("parses a taxonomy, counts it and rejects one that is too big or too thin", () => {
    const t = parseTaxonomySpec(JSON.stringify(VIEWS.taxonomy))!;
    expect(t.groups).toHaveLength(2);
    expect(t.groups[0].processes[2].activities[2]).toEqual({ name: "Net and settle", impact: "low" });
    expect(taxonomyCounts(t)).toEqual({ l2: 2, l3: 6, l4: 12, high: 5, moderate: 5 });
    expect(parseTaxonomySpec(JSON.stringify({ ...VIEWS.taxonomy, groups: [VIEWS.taxonomy.groups[0]] }))).toBeNull();
    expect(parseTaxonomySpec(JSON.stringify({ ...VIEWS.taxonomy, l1: "" }))).toBeNull();
    expect(parseTaxonomySpec("{")).toBeNull();
  });

  it("parses a lifecycle and needs three to seven stages that each say what changes", () => {
    const l = parseLifecycleSpec(JSON.stringify(VIEWS.lifecycle))!;
    expect(l.stages.map((s) => s.impact)).toEqual(["high", "high", "moderate", "moderate", "low"]);
    expect(parseLifecycleSpec(JSON.stringify({ ...VIEWS.lifecycle, stages: VIEWS.lifecycle.stages.slice(0, 2) }))).toBeNull();
    expect(parseLifecycleSpec(JSON.stringify({ ...VIEWS.lifecycle, stages: [...VIEWS.lifecycle.stages.slice(0, 2), { name: "X" }] }))).toBeNull();
  });

  it("draws both in both palettes, escaped, wrapped and with computed counts", () => {
    for (const p of [DARK, LIGHT]) {
      const t = taxonomySvg(parseTaxonomySpec(JSON.stringify(VIEWS.taxonomy))!, p);
      expect(t).toContain('viewBox="0 0 1160');
      expect(t).toContain("L3  PCF 9.3.2.6");
      expect(t).toContain("12 L4 activities");
      const l = lifecycleSvg(parseLifecycleSpec(JSON.stringify(VIEWS.lifecycle))!, p);
      expect(l).toContain(">Residential mortgage</text>");
      expect(l).toContain("With the transformation");
      for (const svg of [t, l]) expect(svg).not.toMatch(/NaN|undefined|\.\.\./);
    }
    const evil = parseTaxonomySpec(JSON.stringify({ ...VIEWS.taxonomy, l1: "<script>" }))!;
    expect(taxonomySvg(evil, DARK)).not.toContain("<script>");
  });

  it("is a visual everywhere the other fenced visuals are", () => {
    expect(viewBlocks(VIEWS_MD).map((v) => v?.kind)).toEqual(["taxonomy", "lifecycle"]);
    expect(countVisuals(VIEWS_MD)).toBe(5);
    const refs = markdownBlocks(VIEWS_MD).filter((b) => b.type === "image").map((b) => (b as { ref: string }).ref);
    expect(refs).toEqual(["proc-0", "view-0", "arch-0", "arch-1", "view-1"]);
  });
});

describe("required views of a finance transformation deliverable", () => {
  const catalog = loadCatalog();
  it("names every missing view, and none when all five are there", () => {
    expect(missingViews("## 1. Close\nText")).toHaveLength(5);
    expect(missingViews(VIEWS_MD)).toEqual([]);
    expect(isFinanceTransformation("Close can fall from 9 to 5 days")).toBe(true);
    expect(isFinanceTransformation("Market entry is worth CAD 4M")).toBe(false);
  });

  it("refuses a finance transformation deck without them, too long or talking about the chat, and makes it once fixed", () => {
    const bad = runLocalTool(catalog, "create_file", schemas.create_file.parse({ format: "slides", title: "Close can fall from 9 to 5 days", markdown: `${"## Slide\n\nThe interactive page is in the download card above.\n\n".repeat(15)}` }));
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error).toContain("```taxonomy");
    expect(bad.error).toContain("Technology reference architecture");
    expect(bad.error).toContain("15 '##' slides");
    expect(bad.error).toContain("download card");
    const good = runLocalTool(catalog, "create_file", schemas.create_file.parse({ format: "slides", title: "Close can fall from 9 to 5 days", markdown: `## Summary\n\nFive days by September 2027.\n${VIEWS_MD}` }));
    expect(good.ok).toBe(true);
    // Word and Excel files are not decks, so they are not held to the deck views.
    expect(runLocalTool(catalog, "create_file", schemas.create_file.parse({ format: "docx", title: "Close plan", markdown: "## 1. Close\n\nText" })).ok).toBe(true);
  });

  it("makes the depth check ask for the views on a finance transformation deliverable", () => {
    expect(assessDepth("# Close\n\n## 1. Executive summary\n\nClose in 5 days.").gaps.join(" ")).toContain("product lifecycle view");
    expect(assessDepth("# Market entry\n\n## 1. Executive summary\n\nEnter Ontario.").gaps.join(" ")).not.toContain("lifecycle");
  });
});

describe("architecture connectors", () => {
  it("never puts a flow label over a card", () => {
    const spec = parseArchSpec(JSON.stringify(VIEWS.technology))!;
    const svg = archSvg(spec, DARK);
    const chipRects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx="5"/g)].map((m) => m.slice(1).map(Number));
    const labelRects = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="15" rx="3"/g)].map((m) => [...m.slice(1).map(Number), 15]);
    expect(labelRects.length).toBeGreaterThan(3);
    for (const [lx, ly, lw, lh] of labelRects)
      for (const [cx, cy, cw, ch] of chipRects) expect(lx < cx + cw && lx + lw > cx && ly < cy + ch && ly + lh > cy).toBe(false);
    expect(svg).not.toContain("NaN");
  });

  it("numbers a label that has nowhere to fit and lists it under the stack", () => {
    const flows = Array.from({ length: 10 }, (_, i) => (i % 2 ? { from: "Beta", to: "Alpha", label: `data set ${i}` } : { from: "Alpha", to: "Beta", label: `data set ${i}` }));
    const spec = parseArchSpec(JSON.stringify({ title: "T", layers: [{ name: "A", items: ["Alpha", "Beta"] }, { name: "B", items: ["Gamma"] }], flows }))!;
    const svg = archSvg(spec, DARK);
    expect(svg).toMatch(/<circle [^>]*r="7.5"/);
    expect(svg).toMatch(/>\(1\) (Alpha|Beta) -&gt; (Alpha|Beta): data set \d<\/text>/);
  });
});

describe("executive deck", () => {
  it("decodes titles once, drops a trailing colon and puts the KPI strip first", () => {
    const s = sectionSlides("7. Controls: move controls earlier, don&#x27;t remove them", "<p>x</p>");
    expect(s[0].headline).toBe("Controls: move controls earlier, don't remove them");
    expect(sectionSlides("Next steps", "<h3>Decisions needed in the next 30 days:</h3><ul><li>a</li></ul>")[0].headline).toBe("Decisions needed in the next 30 days");
    expect(kpisFirst('<p>a</p><div class="kpi-slot"><figure class="kpis">k</figure></div>')).toBe('<div class="kpi-slot"><figure class="kpis">k</figure></div><p>a</p>');
    expect(chatLeadIn("<p>The interactive page is in the download card above.</p>")).toBe(true);
    expect(chatLeadIn("<p>Close in five days.</p>")).toBe(false);
  });

  it("puts two charts side by side even when they carry their data", () => {
    expect(referenceLayout('<figure class="chart" data-spec="{}">a</figure><figure class="chart" data-spec="{}">b</figure>')).toMatch(/^<div class="figs">/);
  });
});

describe("agent stage chips", () => {
  it("counts a repeated hand-off instead of repeating its chip", () => {
    const h = { from: "Rudra", to: "Analyst", label: "Value case model" };
    const out = mergeHandoffs([], [{ key: "1", ...h }, { key: "2", ...h }, { key: "3", ...h }, { key: "4", from: "Rudra", to: "Memory", label: "Process" }]);
    expect(out.map((c) => [c.to, c.count])).toEqual([["Memory", 1], ["Analyst", 3]]);
  });

  it("never cuts a caption inside a number", () => {
    expect(clip("Saving $2.52M/yr, NPV $991k over 5 years", 26)).toBe("Saving $2.52M/yr…");
    expect(clip("Process: 9.1.2.2 Prepare periodic budget", 40)).toBe("Process: 9.1.2.2 Prepare periodic budget");
    expect(clip("Process: 9.1.2.2 Prepare periodic budget plan", 40)).toBe("Process: 9.1.2.2 Prepare periodic budget…");
    expect(clip("short")).toBe("short");
  });
});
