import { describe, expect, it } from "vitest";
import { parseProcessSpec, processBlocks, countVisuals } from "../shared/viz";
import { processSvg } from "../src/charts/specProcess";
import { DARK, LIGHT } from "../src/charts/palette";
import { splitPages, toneTables, voltHtml } from "../src/htmlTemplate";
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

  it("colour-codes risk and status cells, and leaves other columns alone", () => {
    const out = toneTables("<table><thead><tr><th>Item</th><th>Risk</th></tr></thead><tbody><tr><td>High</td><td>High</td></tr></tbody></table>");
    expect(out).toContain('<td>High</td><td><span class="tone high">High</span></td>');
  });
});
