import { describe, expect, it } from "vitest";
import { archBlocks, countVisuals, parseArchSpec } from "../shared/viz";
import { archSvg } from "../src/charts/specArch";
import { DARK, LIGHT } from "../src/charts/palette";
import { markdownBlocks } from "../server/export/blocks";

const good = {
  title: "Option A: ERP-centric",
  layers: [
    { name: "Sources", items: ["SAP ECC", "Oracle EBS", "NetSuite"] },
    { name: "Integration", items: ["API gateway", "ETL"] },
    { name: "Consolidation", items: ["OneStream"], badge: "Recommended" },
    { name: "Reporting", items: ["Power BI", "Excel"] },
  ],
  note: "Illustrative",
};

describe("architecture spec", () => {
  it("accepts system objects with a status, defaults a plain string to kept, and rejects an unknown status as kept", () => {
    const s = parseArchSpec(JSON.stringify({ layers: [{ name: "A", items: [{ name: "SAP ECC", status: "retire" }, "Oracle EBS", { name: "X", status: "bogus" }] }, { name: "B", items: [{ name: "OneStream", status: "new" }] }] }))!;
    expect(s.layers[0].items.map((i) => i.status)).toEqual(["retire", "keep", "keep"]);
    expect(s.layers[1].items[0]).toEqual({ name: "OneStream", status: "new" });
  });

  it("keeps flows between known systems (any case) and drops the ones that name a system that is not there, or loop back", () => {
    const spec = {
      layers: [{ name: "A", items: ["SAP ECC", "Oracle EBS"] }, { name: "B", items: ["OneStream"] }],
      flows: [{ from: "sap ecc", to: "OneStream", label: "journals" }, { from: "Oracle EBS", to: "Nope" }, { from: "OneStream", to: "onestream" }, { from: "Oracle EBS", to: "OneStream" }],
    };
    const s = parseArchSpec(JSON.stringify(spec))!;
    expect(s.flows.map((f) => `${f.from}>${f.to}`)).toEqual(["sap ecc>OneStream", "Oracle EBS>OneStream"]);
    expect(parseArchSpec(JSON.stringify({ ...spec, flows: undefined }))!.flows).toEqual([]);
  });

  it("accepts a valid option and keeps layers in order", () => {
    const s = parseArchSpec(JSON.stringify(good))!;
    expect(s.layers.map((l) => l.name)).toEqual(["Sources", "Integration", "Consolidation", "Reporting"]);
    expect(s.layers[2].badge).toBe("Recommended");
  });

  it("rejects what cannot be drawn: bad JSON, one layer, eight layers, a layer with no items or five, no name", () => {
    expect(parseArchSpec("nope")).toBeNull();
    expect(parseArchSpec(JSON.stringify({ ...good, layers: [good.layers[0]] }))).toBeNull();
    expect(parseArchSpec(JSON.stringify({ ...good, layers: Array.from({ length: 8 }, (_, i) => ({ name: `L${i}`, items: ["x"] })) }))).toBeNull();
    expect(parseArchSpec(JSON.stringify({ ...good, layers: [{ name: "A", items: [] }, good.layers[1]] }))).toBeNull();
    expect(parseArchSpec(JSON.stringify({ ...good, layers: [{ name: "A", items: ["1", "2", "3", "4", "5"] }, good.layers[1]] }))).toBeNull();
    expect(parseArchSpec(JSON.stringify({ ...good, layers: [{ name: "", items: ["x"] }, good.layers[1]] }))).toBeNull();
  });

  it("finds architecture blocks in order, counts them as visuals, and numbers them for the document writers", () => {
    const md = "```architecture\n" + JSON.stringify(good) + "\n```\n\n```architecture\nbroken\n```\n\n```chart\n{}\n```\n";
    const found = archBlocks(md);
    expect(found).toHaveLength(2);
    expect(found[0]?.title).toBe("Option A: ERP-centric");
    expect(found[1]).toBeNull();
    expect(countVisuals(md)).toBe(3);
    const refs = markdownBlocks(md).filter((b) => b.type === "image").map((b) => (b as { ref: string }).ref);
    expect(refs).toEqual(["arch-0", "arch-1", "viz-0"]);
  });
});

describe("architecture drawing", () => {
  it("draws a full-width stack of slabs in both palettes with no bad numbers", () => {
    const spec = parseArchSpec(JSON.stringify(good))!;
    for (const p of [DARK, LIGHT]) {
      const svg = archSvg(spec, p);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain("Option A: ERP-centric");
      for (const l of spec.layers) expect(svg).toContain(l.name);
      expect(svg).toContain("Recommended");
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
      // Each layer is a slab (two depth faces) with an icon, built in from the top; every system is a chip.
      expect((svg.match(/<polygon/g) ?? []).length).toBe(spec.layers.length * 2);
      expect((svg.match(/class="va-band"/g) ?? []).length).toBe(spec.layers.length);
      expect(svg).toContain(`style="--va-i:0"`);
      for (const l of spec.layers) for (const it of l.items) expect(svg).toContain(`>${it.name.replace(/&/g, "&amp;")}</text>`);
      expect(svg).toContain('viewBox="0 0 1160');
    }
  });

  it("marks systems by status, and draws each flow with its arrowhead, a legend and a list", () => {
    const spec = parseArchSpec(
      JSON.stringify({
        title: "Option B",
        layers: [
          { name: "Sources", items: [{ name: "SAP ECC", status: "retire" }, "Oracle EBS"] },
          { name: "Consolidation", items: [{ name: "OneStream", status: "new" }] },
        ],
        flows: [{ from: "SAP ECC", to: "OneStream", label: "journals" }, { from: "Oracle EBS", to: "OneStream" }],
      }),
    )!;
    for (const p of [DARK, LIGHT]) {
      const svg = archSvg(spec, p);
      expect(svg).toContain("Consolidation: OneStream (new)");
      expect(svg).toContain("Sources: SAP ECC (retire), Oracle EBS (kept)");
      expect(svg).toContain("SAP ECC -&gt; OneStream: journals");
      expect(svg).toMatch(/<line [^>]*stroke="#(ff5722|e64a19)"/); // a retired system is struck through
      expect(svg).toContain("Data flow");
      expect((svg.match(/<path d="M [^"]+" fill="none"/g) ?? []).length).toBe(4); // two flows, each a halo and a line
      expect(svg).not.toContain("NaN");
    }
  });

  it("escapes model text and handles two and seven layers", () => {
    const evil = parseArchSpec(JSON.stringify({ ...good, title: "<script>x</script>", layers: [{ name: "a&b", items: ["<b>"] }, good.layers[1]] }))!;
    const svg = archSvg(evil, LIGHT);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("a&amp;b");
    const seven = parseArchSpec(JSON.stringify({ ...good, layers: Array.from({ length: 7 }, (_, i) => ({ name: `Layer ${i}`, items: ["x", "y"] })) }))!;
    expect(archSvg(seven, LIGHT)).not.toContain("NaN");
  });

  it("keeps long system names whole, two chips to a row when one row is too tight", () => {
    const long = "Enterprise performance management consolidation";
    const spec = parseArchSpec(JSON.stringify({ title: "T", layers: [{ name: "Sources", items: [long, long + " two", long + " three", long + " four"] }, { name: "GL", items: ["Ledger"] }] }))!;
    const svg = archSvg(spec, DARK);
    expect(svg).not.toContain("...");
    expect(svg).toContain(">Enterprise performance management consolidation</text>");
    const ys = new Set([...svg.matchAll(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="39" rx="5"/g)].map((m) => m[1]));
    expect(ys.size).toBe(3); // two rows of chips in Sources, one in GL
  });
});

describe("architecture flows with long system names", () => {
  it("keeps a flow whose end names a system longer than the name limit", () => {
    const long = "Consolidation and IC (FCCS or OneStream, chosen to follow the GL)";
    const spec = parseArchSpec(JSON.stringify({ title: "B", layers: [{ name: "GL", items: ["Existing GL"] }, { name: "Close", items: [{ name: long, status: "new" }] }], flows: [{ from: "Existing GL", to: long, label: "trial balance" }] }));
    expect(spec?.flows).toHaveLength(1);
    expect(spec?.layers[1].items[0].name).toBe(spec?.flows[0].to);
  });
});
