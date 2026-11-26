import { describe, expect, it } from "vitest";
import { PROMPT_IDEAS } from "../src/promptIdeas";

describe("chat prompt ideas", () => {
  const ideas = PROMPT_IDEAS.flatMap((g) => g.ideas);

  it("has three groups of three unique ideas", () => {
    expect(PROMPT_IDEAS).toHaveLength(3);
    for (const g of PROMPT_IDEAS) expect(g.ideas).toHaveLength(3);
    expect(new Set(ideas).size).toBe(ideas.length);
  });

  it("keeps each idea short and plain ASCII", () => {
    for (const idea of ideas) {
      expect(idea.length, idea).toBeLessThanOrEqual(160);
      expect(/^[\x20-\x7E]+$/.test(idea), idea).toBe(true);
    }
  });
});
