import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { speakerNotes, voltDeck } from "../src/htmlDeck";
import { splitPages } from "../src/htmlTemplate";
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
    expect(html).toContain('<span class="no">02</span><h2>Plan</h2>');
    expect(html).toContain('<aside class="sowhat" aria-label="So what"><b>So what</b><p>Close in five days.</p></aside>');
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
});
