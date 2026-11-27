import { expect, it } from "vitest";
import { recentChatLabel as label } from "../src/recentChatLabel";

it("turns optimized briefs into labels without showing template headings", () => {
  expect(label("**1. Context & Business Ask** Rerun the deliverable produced earlier in this conversation (or attached).")).toBe("Rerun the previous deliverable");
  expect(label("## Context and Business Ask\nCreate a board memo.\n## Output Format")).toBe("Board memo");
});
it("softens shouting without losing acronyms, numbers or ordinary mixed case", () => {
  expect(label("nEED A FINANCIAL INFORMATION MODEL FOR IFRS 17")).toBe("Financial information model for IFRS 17");
  expect(label("Compare IFRS and US GAAP")).toBe("Compare IFRS and US GAAP");
});
it("bounds old labels including unbroken strings, with an empty-state fallback", () => {
  expect(label("")).toBe("Untitled chat");
  expect(label("a".repeat(500))).toHaveLength(65);
  expect(label("Prepare a board-ready plan to take the month-end close of a Canadian Schedule I bank from nine days to five.")).toBe("Board-ready plan to take the month-end close of a Canadian…");
});
