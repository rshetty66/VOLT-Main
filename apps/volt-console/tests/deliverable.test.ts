import { describe, expect, it } from "vitest";
import { deliverableStandards, deliverableStructure, leadDeliverableGuide, specialistDeliverableGuide } from "../server/deliverable";

describe("client deliverable guide", () => {
  it("reads the section list from run-client-deliverable.md", () => {
    const s = deliverableStructure() ?? "";
    expect(s.toLowerCase()).toContain("executive summary");
    expect(s.toLowerCase()).toContain("recommendations table");
    expect(s.toLowerCase()).toContain("next steps");
  });

  it("reads the writing standards without their frontmatter", () => {
    const s = deliverableStandards() ?? "";
    expect(s).toContain("Lead with the answer");
    expect(s.startsWith("---")).toBe(false);
  });

  it("tells the lead agent to write for the client, in that structure, with numbered sections", () => {
    const g = leadDeliverableGuide();
    expect(g).toContain("The final answer is a client deliverable");
    expect(g.toLowerCase()).toContain("executive summary");
    expect(g).toContain("Do not mention agents, specialists, tools");
    expect(g).toContain("Number the `##` sections");
  });

  it("gives specialists the same writing standard", () => {
    expect(specialistDeliverableGuide()).toContain("Lead with the answer");
  });

  it("adds nothing when the plugin files are missing", () => {
    expect(deliverableStructure("/nonexistent")).toBeNull();
    expect(leadDeliverableGuide("/nonexistent")).toBe("");
    expect(specialistDeliverableGuide("/nonexistent")).toBe("");
  });
});
