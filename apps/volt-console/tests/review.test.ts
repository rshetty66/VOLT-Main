import { describe, expect, it } from "vitest";
import { MAX_HANDBACKS, parseVerdict, wantsReviewInText } from "../shared/review";
import { independentReview } from "../server/reviewer";

describe("builder/reviewer loop", () => {
  it("caps hand-backs at three", () => expect(MAX_HANDBACKS).toBe(3));
  it("asks for review in words", () => {
    expect(wantsReviewInText("Draft the plan and have it reviewed")).toBe(true);
    expect(wantsReviewInText("I want an independent review of this")).toBe(true);
    expect(wantsReviewInText("Review the close calendar")).toBe(false);
  });
  it("reads PASS and REVISE, and fails open on junk", () => {
    expect(parseVerdict("PASS").pass).toBe(true);
    const v = parseVerdict("REVISE\n- NPV does not match the table\n- no risk register");
    expect(v.pass).toBe(false);
    expect(v.gaps).toHaveLength(2);
    expect(parseVerdict("REVISE with no list").pass).toBe(true);
    expect(parseVerdict("looks fine").pass).toBe(true);
  });
  it("returns null when the reviewer call fails", async () => {
    const client = { messages: { create: async () => { throw new Error("boom"); } } } as never;
    expect(await independentReview("ask", "draft", new AbortController().signal, client)).toBeNull();
  });
  it("sends the request and draft only", async () => {
    let seen: any;
    const client = { messages: { create: async (a: unknown) => { seen = a; return { content: [{ type: "text", text: "PASS" }], usage: { input_tokens: 5, output_tokens: 1 } }; } } } as never;
    const r = await independentReview("the ask", "the draft", new AbortController().signal, client);
    expect(r?.verdict.pass).toBe(true);
    expect(seen.messages).toHaveLength(1);
    expect(seen.messages[0].content).toContain("the draft");
    expect(seen.thinking).toBeUndefined();
  });
});
