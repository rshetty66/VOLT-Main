import { describe, expect, it } from "vitest";
import { CAPABILITIES, INDUSTRIES, LAYERS, PATTERNS, REFERENCE, SEGMENTS, STACKS, architectureMarkdown, industryDiagram, stackDiagram, type Diagram } from "../src/architecture/data";
import { columnLayout } from "../src/architecture/layout";

const all: Diagram[] = [...REFERENCE, ...PATTERNS, ...STACKS.map(stackDiagram), ...INDUSTRIES.map(industryDiagram)];

// Approximate text widths at the diagram font sizes (12px titles, 10.5px subtitles).
const fits = (text: string, px: number, width: number) => text.length * px * 0.56 <= width - 14;

describe("architecture diagrams", () => {
  it("keep every box inside the drawing and every label inside its box", () => {
    for (const d of all) {
      const l = columnLayout(d);
      for (const b of l.boxes) {
        expect(b.x, d.name).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w, d.name).toBeLessThanOrEqual(l.w);
        expect(b.y + b.h, d.name).toBeLessThanOrEqual(l.h);
        expect(fits(b.t, 12, b.w), `${d.name}: "${b.t}"`).toBe(true);
        if (b.s) expect(fits(b.s, 10.5, b.w), `${d.name}: "${b.s}"`).toBe(true);
      }
    }
  });

  it("draw links left to right between existing boxes", () => {
    for (const d of all) {
      for (const link of columnLayout(d).links) expect(link.to[0], d.name).toBeGreaterThan(link.from[0]);
    }
    const twoBases = columnLayout(REFERENCE[1]);
    expect(twoBases.links).toHaveLength(4);
  });

  it("put every stack and industry on the same six layers", () => {
    expect(LAYERS).toHaveLength(6);
    STACKS.forEach((s) => expect(s.lanes).toHaveLength(6));
    INDUSTRIES.forEach((d) => expect(d.lanes).toHaveLength(6));
    CAPABILITIES.forEach((c) => typeof c.cells !== "string" && expect(c.cells).toHaveLength(SEGMENTS.length));
  });

  it("summarise the tab as markdown with one table per view and no bank names", () => {
    const md = architectureMarkdown();
    expect(md.match(/^\| /gm)?.length).toBeGreaterThan(20);
    for (const h of ["## Capability map", "## Design patterns", "## Platform stacks", "## Industries"]) expect(md).toContain(h);
    expect(md).not.toMatch(/\bBMO\b|Bank of Montreal|RBC|TD Bank|Scotiabank|CIBC/);
  });
});
