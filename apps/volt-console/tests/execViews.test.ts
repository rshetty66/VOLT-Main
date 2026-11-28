import { describe, expect, it } from "vitest";
import { parseFimSpec, parseView } from "../shared/views";
import { parseArchSpec } from "../shared/viz";
import { fimSvg, viewSvg } from "../src/charts/specViews";
import { archSvg } from "../src/charts/specArch";
import { DARK } from "../src/charts/palette";
import { actionTitle, tocSlide } from "../src/htmlDeck";
import { splitPages, voltHtml } from "../src/htmlTemplate";
import { VIEWS } from "./fixtures/views";

describe("finance information model view", () => {
  it("parses a lineage chain and rejects one that is too short or has a status the ledger never returns", () => {
    const f = parseFimSpec(JSON.stringify(VIEWS.fim))!;
    expect(f.chain.map((c) => c.level)).toEqual(["Source", "Instrument", "Accounting event", "GL balance", "Report"]);
    expect(f.adjustments.map((a) => a.level)).toEqual(["instrument", "gl"]);
    expect(f.balance?.status).toBe("ties");
    expect(parseFimSpec(JSON.stringify({ ...VIEWS.fim, chain: VIEWS.fim.chain.slice(0, 2) }))).toBeNull();
    expect(parseFimSpec(JSON.stringify({ ...VIEWS.fim, balance: { account: "1200", status: "great" } }))?.balance?.status).toBeUndefined();
    expect(parseFimSpec("{")).toBeNull();
  });

  it("draws one column per level, both adjustment levels and the keys carried end to end", () => {
    const svg = fimSvg(parseFimSpec(JSON.stringify(VIEWS.fim))!, DARK);
    expect(svg.match(/class="vf-col"/g)).toHaveLength(5);
    expect(svg).toContain("Instrument-level adjustments");
    expect(svg).toContain("GL-level adjustments");
    expect(svg).toContain("Keys carried end to end");
    expect(viewSvg(parseView("fim", JSON.stringify(VIEWS.fim))!, DARK)).toBe(svg);
  });
});

describe("technology architecture walkthrough data", () => {
  const spec = {
    ...VIEWS.technology,
    layers: [
      { name: "Sources", items: [{ name: "Core banking", status: "keep", flow: "ar", coa: ["thick"], group: 1, detail: "Posts loans." }] },
      { name: "Ledger", items: [{ name: "IFRS ledger", status: "new", flow: "a", coa: ["thin", "bogus"], group: 2, detail: "Book of record." }] },
    ],
    flows: [{ from: "Core banking", to: "IFRS ledger" }],
    groups: [{ name: "Data foundation" }, { name: "Ledger", platform: "Oracle" }],
    ribbons: { a: ["Source", "Ledger"], r: ["Source"] },
    principles: ["Reconcile by design."],
    tiles: [{ title: "Thin ledger", text: "Detail stays below the GL." }],
    steps: [
      { title: "Sources", text: "Start here.", on: ["core banking"] },
      { title: "Ledger", text: "Then the book of record.", on: ["IFRS ledger", "Not a system"] },
    ],
  };

  it("keeps flow, COA layers, group and detail per item, and maps step names to known systems", () => {
    const a = parseArchSpec(JSON.stringify(spec))!;
    expect(a.layers[1].items[0]).toMatchObject({ flow: "a", coa: ["thin"], group: 2, detail: "Book of record." });
    expect(a.steps?.map((s) => s.on)).toEqual([["Core banking"], ["IFRS ledger"]]);
    expect(a.groups?.[1]).toEqual({ name: "Ledger", platform: "Oracle" });
    expect(a.principles).toEqual(["Reconcile by design."]);
  });

  it("puts the walkthrough data on the svg and draws the key principles and tiles", () => {
    const svg = archSvg(parseArchSpec(JSON.stringify(spec))!, DARK);
    expect(svg).toContain("data-steps=");
    expect(svg).toContain("data-ribbons=");
    expect(svg).toMatch(/<g class="va-chip" data-n="ifrs ledger"[^>]*data-f="a"/);
    expect(svg).toContain("Key principles");
    expect(svg).toContain("Thin ledger");
  });
});

describe("deck contents and headlines", () => {
  it("does not treat a label or an exhibit caption as a slide headline", () => {
    expect(actionTitle("Design principles:")).toBe(false);
    expect(actionTitle("Exhibit 3: close days by stage")).toBe(false);
    expect(actionTitle("The close starts before period end")).toBe(true);
  });

  it("lists every section with links to its slides, and skips a slide whose headline repeats the section", () => {
    const toc = tocSlide([
      { title: "Summary", slides: [{ headline: "Five days is realistic" }] },
      { title: "Findings", slides: [{ headline: "Findings" }, { headline: "Waiting outweighs work" }] },
      { title: "Plan", slides: [{ headline: "Policy first" }] },
    ]);
    expect(toc).toContain('<h2>Contents</h2>');
    expect(toc.match(/data-go="1-\d"/g)).toEqual(['data-go="1-0"', 'data-go="1-1"']);
    expect(tocSlide([{ title: "A", slides: [] }, { title: "B", slides: [] }])).toBe("");
  });

  it("gives the page a linked contents list, heading anchors and an animation toggle", () => {
    const html = voltHtml({ title: "Close plan", pages: splitPages("<p>Lead.</p><h2>Findings</h2><h3>Baseline</h3><p>A</p><h2>Plan</h2><p>B</p><h2>Risks</h2><p>C</p>") });
    expect(html).toContain('<nav class="toc"');
    expect(html).toMatch(/<h3 id="s\d+-1"/);
    expect(html).toContain("data-static-toggle");
  });
});
