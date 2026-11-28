import { describe, expect, it } from "vitest";
import { BLUEPRINT, blueprintBlock, isBlueprintAsk } from "../shared/blueprint";

describe("accounting rule engine blueprint questionnaire", () => {
  it("has sections A to H and 28 numbered questions, each with a config field", () => {
    expect(BLUEPRINT.map((s) => s.id).join("")).toBe("ABCDEFGH");
    const qs = BLUEPRINT.flatMap((s) => s.questions);
    expect(qs.map((q) => q.n)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(qs.every((q) => q.field.length > 0)).toBe(true);
  });
  it("passes answers as given, blanks as [to confirm], and skipped sections as labelled defaults", () => {
    const out = blueprintBlock({ 1: "Northwind Bank, NWB", 21: "2027-03-31" }, new Set(["F"]), ["current-state.pdf"]);
    expect(out).toContain("- 1. Client legal name and short name used in headings [client.name, client.short]: Northwind Bank, NWB");
    expect(out).toContain("[poc.target_date]: 2027-03-31");
    expect(out).toContain("[client.industry]: [to confirm]");
    expect(out).toContain("### F. Migration\n- Skipped: use labelled defaults or [to confirm].");
    expect(out).not.toContain("[waves]");
    expect(out).toContain("never invent client facts");
    expect(out).toContain("current-state.pdf");
  });
  it("opens for accounting rule engine and hub asks only", () => {
    expect(isBlueprintAsk("Design an accounting rule engine blueprint for our card book")).toBe(true);
    expect(isBlueprintAsk("Plan a 5-day close")).toBe(false);
  });
});
