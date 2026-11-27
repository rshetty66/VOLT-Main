import { describe, expect, it } from "vitest";
import { lintSkill } from "../shared/skillLint";
import { loadCatalog } from "../server/catalog";

const good = `---\nname: x\n---\n# X\n1. Run the query.\n2. Check that the result has rows.\n3. Post it.\n\n## Error recovery\n| Failure | Fix |\n|---|---|\n| empty | widen dates |\n`;

describe("skill lint", () => {
  it("passes a skill with numbered steps, a check and recovery", () => {
    expect(lintSkill(good, "Use when asked to run the weekly metrics query").failed).toEqual([]);
  });
  it("flags missing parts", () => {
    const r = lintSkill("# X\nJust do the thing.\n", "short").failed;
    expect(r).toEqual(expect.arrayContaining(["description", "steps", "verify", "recovery"]));
  });
  it("flags long bodies and bundled tool servers", () => {
    const r = lintSkill(good + "line\n".repeat(500) + "Add .mcp.json here", "Use when asked to run the weekly metrics query").failed;
    expect(r).toEqual(expect.arrayContaining(["length", "noMcp"]));
  });
  it("summarises the shipped skills", () => {
    const l = loadCatalog().health.lint!;
    expect(l.checked).toBeGreaterThan(100);
    expect(l.worst.length).toBeLessThanOrEqual(15);
  });
});
