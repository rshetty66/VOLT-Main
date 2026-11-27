import { describe, expect, it } from "vitest";
import { keyPoints, plain } from "../src/runDigest";

describe("run digest", () => {
  it("takes bullet items first, as plain text", () => {
    const md = "## Findings\n\nIntro line.\n\n- **Close** takes 9 days vs a [peer median](https://x) of 5\n- Intercompany drives `two thirds` of delay\n* Three control gaps\n1. A 90-day plan";
    expect(keyPoints(md)).toEqual(["Close takes 9 days vs a peer median of 5", "Intercompany drives two thirds of delay", "Three control gaps", "A 90-day plan"]);
  });

  it("caps the number of points", () => {
    expect(keyPoints("- a one\n- b two\n- c three\n- d four\n- e five", 3)).toHaveLength(3);
  });

  it("falls back to the first sentences of the prose", () => {
    const md = "# Title\n\nThe close takes nine days. Peers take five! Why does it lag? Mostly intercompany.";
    expect(keyPoints(md, 3)).toEqual(["The close takes nine days.", "Peers take five!", "Why does it lag?"]);
  });

  it("skips tables, code, quotes, rules and label-only bullets", () => {
    const md = "| a | b |\n|---|---|\n```\ncode line.\n```\n> quoted.\n---\n- Scope:\nReal sentence here.";
    expect(keyPoints(md)).toEqual(["Real sentence here."]);
  });

  it("cuts long points", () => {
    const [p] = keyPoints(`- ${"word ".repeat(60)}\n- second point`);
    expect(p.length).toBeLessThanOrEqual(140);
    expect(p.endsWith("…")).toBe(true);
  });

  it("returns nothing for empty text", () => {
    expect(keyPoints("")).toEqual([]);
  });

  it("strips inline Markdown", () => {
    expect(plain("**Bold** and _it_ and `code` and [link](http://a)")).toBe("Bold and it and code and link");
  });
});
