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
  it("draws a stack of slabs in both palettes with no bad numbers", () => {
    const spec = parseArchSpec(JSON.stringify(good))!;
    for (const p of [DARK, LIGHT]) {
      const svg = archSvg(spec, p);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain("Option A: ERP-centric");
      for (const l of spec.layers) expect(svg).toContain(l.name);
      expect(svg).toContain("Recommended");
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("undefined");
      // three polygons (top and two sides) per layer, plus one tile per system (no flows or statuses here, so no legend)
      expect((svg.match(/<polygon/g) ?? []).length).toBe(spec.layers.length * 3 + spec.layers.reduce((n, l) => n + l.items.length, 0));
    }
  });

  it("numbers systems across the whole stack, colours them by status, and draws each flow with its arrowhead and a legend", () => {
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
      expect(svg).toContain("3 OneStream (new)");
      expect(svg).toContain("1 SAP ECC (retire)");
      expect(svg).toContain("1 SAP ECC -&gt; 3 OneStream: journals");
      expect(svg).toContain("#ff5722"); // a retired tile
      expect(svg).toContain("#00e5ff"); // a new tile
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
});
