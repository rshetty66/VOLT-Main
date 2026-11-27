import { describe, expect, it } from "vitest";
import { parseProcessSpec, processBlocks, countVisuals } from "../shared/viz";
import { processSvg } from "../src/charts/specProcess";
import { DARK, LIGHT } from "../src/charts/palette";
import { kpiStrip, referenceLayout, splitPages, toneTables, voltHtml } from "../src/htmlTemplate";
import { markdownBlocks } from "../server/export/blocks";

const flow = {
  title: "Month-end close",
  lanes: ["Entity accounting", "Group reporting"],
  steps: [
    { id: "cut", lane: "Entity accounting", stage: "D-1", name: "Sub-ledger cut-off", system: "Oracle EBS", status: "manual" },
    { id: "ic", lane: "Group reporting", stage: "D-1", name: "Intercompany match", status: "new", issue: "Breaks found late" },
    { id: "cons", lane: "group reporting", stage: "D+2", name: "Consolidation", status: "automated" },
  ],
  links: [{ from: "cut", to: "cons", label: "trial balance" }, { from: "ic", to: "cons" }, { from: "cons", to: "nowhere" }],
};

describe("process flow spec", () => {
  it("reads lanes case-insensitively, numbers stages in order and drops links to unknown steps", () => {
    const p = parseProcessSpec(JSON.stringify(flow))!;
    expect(p.stages).toEqual(["D-1", "D+2"]);
    expect(p.steps.map((s) => s.lane)).toEqual([0, 1, 1]);
    expect(p.links).toHaveLength(2);
    expect(p.steps[1].issue).toBe("Breaks found late");
  });

  it("runs the steps in order when no links are given, and rejects a step in an unknown lane", () => {
    const { links: _links, ...noLinks } = flow;
    expect(parseProcessSpec(JSON.stringify(noLinks))!.links.map((l) => [l.from, l.to])).toEqual([[0, 1], [1, 2]]);
    expect(parseProcessSpec(JSON.stringify({ ...flow, steps: [...flow.steps, { lane: "Treasury", name: "x" }] }))).toBeNull();
    expect(parseProcessSpec("{oops")).toBeNull();
  });

  it("is counted as a visual and numbered as an image for the document writers", () => {
    const md = "```process\n" + JSON.stringify(flow) + "\n```\n";
    expect(countVisuals(md)).toBe(1);
    expect(processBlocks(md)[0]?.title).toBe("Month-end close");
    expect(markdownBlocks(md).filter((b) => b.type === "image").map((b) => (b as { ref: string }).ref)).toEqual(["proc-0"]);
  });

  it("draws every step and link with the data the HTML walkthrough needs, escaped, in both palettes", () => {
    const p = parseProcessSpec(JSON.stringify({ ...flow, title: "<b>Close</b>" }))!;
    for (const pal of [DARK, LIGHT]) {
      const svg = processSvg(p, pal);
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg).not.toContain("<b>");
      expect(svg.match(/class="vp-step"/g)).toHaveLength(3);
      expect(svg).toContain('data-from="0" data-to="2"');
      expect(svg).toContain(">Automated<");
    }
  });
});

describe("VOLT HTML template", () => {
  it("splits sections into pages at each h2, with the opening text as the summary", () => {
    const pages = splitPages("<p>Answer.</p><h2>Current state</h2><p>A</p><h2>Plan</h2><p>B</p>");
    expect(pages.map((p) => p.title)).toEqual(["Summary", "Current state", "Plan"]);
  });

  it("writes one tab per page, puts the answer in the So what panel, and escapes the title", () => {
    const html = voltHtml({ title: "Close <plan>", subtitle: "24 November 2026", pages: splitPages("<p>Close in five days.</p><h2>Plan</h2><p>B</p>") });
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('<aside class="sowhat" aria-label="So what"><b>So what</b><p>Close in five days.</p></aside>');
    expect(html).toContain("Close &lt;plan&gt;");
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    expect(html).toContain("prefers-reduced-motion");
  });

  it("follows the reference layout: bold-lead lists become cards, So what and Source lines get their own blocks", () => {
    const out = referenceLayout("<ol>\n<li><strong>Intercompany, Q1.</strong> removes 3 days</li>\n<li><strong>Recs, Q2.</strong> removes 1.5</li>\n</ol><ul><li>plain</li><li><strong>B</strong> x</li></ul><p><strong>So what:</strong> Start now.</p><p>Source: close calendar</p>");
    expect(out).toContain('<div class="cards"><div class="card"><span class="no">01</span><b>Intercompany, Q1</b><p>Removes 3 days</p></div>');
    expect(out).toContain("<ul><li>plain</li>");
    expect(out).toContain('<aside class="sowhat" aria-label="So what"><b>So what</b><p>Start now.</p></aside>');
    expect(out).toContain('<p class="src">Source: close calendar</p>');
    expect(referenceLayout('<figure class="chart">a</figure><figure class="chart">b</figure>')).toMatch(/^<div class="figs">/);
    expect(voltHtml({ title: "T", pages: splitPages("<p>A</p><h2>Plan</h2><p>Lede.</p><p>B</p>") })).toContain('<p class="lede">Lede.</p><p>B</p>');
  });

  it("draws a KPI chart as a strip of tiles, with the change coloured by which way is better", () => {
    const html = kpiStrip({ type: "kpi", title: "Close <scorecard>", unit: "days", labels: ["Close cycle", "Cost"], series: [{ name: "Now", values: [11, 120] }, { name: "Prior", values: [12, 100] }], better: "down", trends: [[14, 11], [90, 120]] });
    expect(html.match(/class="kpi"/g)).toHaveLength(2);
    expect(html).toContain('<span class="d good">-1 (-8.3%) vs Prior</span>');
    expect(html).toContain('<span class="d bad">+20 (+20%) vs Prior</span>');
    expect(html).toContain("Close &lt;scorecard&gt;");
    expect(html).toContain("<polyline");
  });

  it("colour-codes risk and status cells, and leaves other columns alone", () => {
    const out = toneTables("<table><thead><tr><th>Item</th><th>Risk</th></tr></thead><tbody><tr><td>High</td><td>High</td></tr></tbody></table>");
    expect(out).toContain('<td>High</td><td><span class="tone high">High</span></td>');
  });
});

describe("HTML deliverable fixes from the 5-day close review", () => {
  it("shows no change against a zero baseline", () => {
    const html = kpiStrip({ type: "kpi", title: "", labels: ["Days", "NPV"], series: [{ name: "Target", values: [5, 4.01] }, { name: "Today", values: [12, 0] }], better: "down" } as never);
    expect(html).toContain("-7");
    expect(html).not.toContain("+4.01");
  });
  it("names tabs in a few words, without the writer's numbering", () => {
    const html = voltHtml({ title: "T", pages: [{ title: "1. Executive summary", html: "<p>a</p>" }, { title: "2. Findings: a 12-day close is bottom quartile", html: "<p>b</p>" }] });
    expect(html).toContain("</span>Findings</button>");
    expect(html).not.toContain("01</span>1.");
    expect(html).toContain('<h2 class="pt">Findings: a 12-day close is bottom quartile</h2>');
  });
  it("wraps a long step name in full rather than cutting it", () => {
    const svg = processSvg(parseProcessSpec(JSON.stringify({ lanes: ["GL"], steps: [{ id: "a", lane: "GL", stage: "D1", name: "Recurring and estimate accruals posted to the ledger" }, { id: "b", lane: "GL", stage: "D2", name: "Lock" }] }))!, DARK);
    expect(svg).toContain(">Recurring and estimate accruals");
    expect(svg).not.toContain("...");
  });
});

describe("HTML page file links", () => {
  it("puts each companion file under the title as a download link", () => {
    const html = voltHtml({ title: "T", pages: [{ title: "A", html: "<p>a</p>" }], files: [{ label: "Excel", name: "volt-t.xlsx", href: "data:application/x;base64,AA==" }] });
    expect(html).toContain('<nav class="files" aria-label="Files"><a href="data:application/x;base64,AA==" download="volt-t.xlsx">Download Excel</a></nav>');
  });
});

describe("process step labels", () => {
  it("cut a line that does not fit its card with an ellipsis instead of spilling out", async () => {
    const { fitLines } = await import("../src/charts/specProcess");
    const { textWidth } = await import("../src/charts/specChart");
    const [cut] = fitLines(["Supercalifragilisticexpialidocious-reconciliation"], 80, 12.5);
    expect(cut.endsWith("…")).toBe(true);
    expect(textWidth(cut, 12.5)).toBeLessThanOrEqual(80);
    expect(fitLines(["Short"], 80, 12.5)).toEqual(["Short"]);
  });
});
