import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { heroes, sectionSlides, speakerNotes, voltDeck } from "../src/htmlDeck";
import { barTables, cellNumber, splitPages } from "../src/htmlTemplate";
import { specSvg, wrapLabel } from "../src/charts/specChart";
import { DARK } from "../src/charts/palette";
import { FILE_FORMATS, FILE_LABEL } from "../shared/files";

const require = createRequire(import.meta.url);
const read = (p: string) => readFileSync(require.resolve(p), "utf8");
const assets = { js: read("reveal.js/dist/reveal.js"), css: read("reveal.js/dist/reveal.css"), notes: read("reveal.js/plugin/notes/notes.js") };

describe("HTML slide deck", () => {
  const pages = splitPages("<p>Close in five days.</p><h2>2. Plan</h2><ul><li>A</li><li>B</li></ul><p>Notes: say the <strong>date</strong>.</p>");
  const html = voltDeck({ title: "Close <plan>", subtitle: "26 November 2026", pages }, assets);

  it("opens with a cover, then one numbered slide per section with the answer in the So what panel", () => {
    expect(html.match(/<section class="cover">/g)).toHaveLength(1);
    expect(html.match(/<section class="slide">/g)).toHaveLength(2);
    expect(html).toContain("<h1>Close &lt;plan&gt;</h1>");
    expect(html).toContain('<span class="no">02</span><div><h2>Plan</h2></div>');
    expect(html).toContain('<aside class="sowhat" aria-label="So what"><b>So what</b><p>Close in five days.</p></aside>');
  });

  it("gives each subsection its own slide, headed by its bold lead line as the action title", () => {
    const s = sectionSlides("2. Findings", "<p>Intro.</p><h3>Baseline</h3><p><strong>Close takes 8 days.</strong></p><p>Detail.</p><h3>Root causes</h3><p><strong>Exhibit 1: Gap</strong></p><table></table>");
    expect(s.map((x) => [x.kicker, x.headline])).toEqual([["", "Findings"], ["Findings | Baseline", "Close takes 8 days."], ["Findings", "Root causes"]]);
    expect(s[1].html).toBe("<p>Detail.</p>");
    expect(sectionSlides("Plan", "<h3>A</h3><p>x</p>").map((x) => x.headline)).toEqual(["A"]);
  });

  it("fits slides instead of scrolling them: a measuring pass paginates before reveal.js starts", () => {
    expect(html).toContain(".reveal .slides>section{block-size:100%;padding:40px 56px 32px;overflow:hidden}");
    expect(html.indexOf("classList.add('measuring')")).toBeLessThan(html.lastIndexOf("Reveal.initialize({"));
    expect(html).toContain('<div class="body">');
  });

  it("moves Notes: paragraphs into speaker notes", () => {
    expect(html).toContain('<aside class="notes">say the <strong>date</strong>.</aside>');
    expect(html).not.toContain("<p>Notes:");
    expect(speakerNotes("<p>x</p>")).toEqual({ html: "<p>x</p>", notes: "" });
  });

  it("is one offline file: reveal.js inlined, nothing fetched, inline scripts cannot close early", () => {
    expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
    expect(html).not.toContain("sourceMappingURL");
    expect(html).toContain("Reveal.initialize");
    // Four scripts (reveal.js, its notes plugin, the house script, the deck script), so four closing tags.
    expect(html.match(/<\/script/gi)).toHaveLength(4);
  });

  it("is offered as its own file format", () => {
    expect(FILE_FORMATS).toContain("slides");
    expect(FILE_LABEL.slides).toBe("HTML slide deck");
  });

  it("uses one sans font for titles, works in a sandboxed preview, and never leaves a near-empty continued slide", () => {
    expect(html).toContain(".reveal h1,.reveal h2{font-family:inherit");
    expect(html).toContain(".reveal .detail h4{font-family:inherit");
    expect(html).toContain("hash: !/^about:/.test(location.href)");
    expect(html).toContain("movedH < 90");
    expect(html).toContain("max-block-size:var(--fig-h,470px)");
  });

  it("shows the number a list leads with as a hero figure", () => {
    const out = heroes("<ul><li><strong>7 days removed by six levers.</strong> Today is 12.</li><li>Other</li></ul>");
    expect(out).toContain('<b class="hv">7<small>days</small></b><span class="hl">removed by six levers</span>');
    expect(heroes("<ul><li><strong>USD 3.5M invested</strong></li></ul>")).toContain('<b class="hv">3.5<small>USD M</small></b>');
    expect(heroes("<ul><li><strong>Fix the GL</strong></li></ul>")).not.toContain("hero");
  });
});

describe("Exhibit readability", () => {
  it("wraps long bridge labels instead of cutting them", () => {
    const svg = specSvg({ type: "waterfall", title: "Bridge", unit: "days", labels: ["Current close", "ECL & valuations pre-close", "Sub-ledger feeds", "Risk-tiered recs", "Intercompany", "FTP off close path", "Single consol run", "Target close"], series: [{ name: "Days", values: [12, -2, -1.5, -1.5, -1, -0.5, -0.5, 5] }], target: { value: 5, label: "Target 5 days" } }, DARK);
    expect(svg).not.toContain("...");
    expect(svg).toContain(">pre-close</text>");
    expect(svg).toContain(">Target 5 days</text>");
    expect(svg).not.toContain("Target 5 days 5");
    expect(wrapLabel("Auto-reconciliation and matching", 90, 12)).toEqual(["Auto-reconciliation", "and matching"]);
  });

  it("puts a data bar on number columns of a table", () => {
    const t = "<table><thead><tr><th>Case</th><th>NPV</th><th>Note</th></tr></thead><tbody><tr><td>Low</td><td>−2,393,243</td><td>a</td></tr><tr><td>Base</td><td>1,577,030</td><td>b</td></tr><tr><td>High</td><td>5,047,304</td><td>c</td></tr></tbody></table>";
    const out = barTables(t);
    expect(out).toContain('<span class="nb neg" style="--w:47%">−2,393,243</span>');
    expect(out).toContain('<span class="nb" style="--w:100%">5,047,304</span>');
    expect(out).toContain("<td>a</td>");
    expect(cellNumber("22.95%")).toBe(22.95);
    expect(cellNumber("USD 3.5M")).toBe(3.5e6);
    expect(cellNumber("2.36 (Defined)")).toBeNull();
  });
});
