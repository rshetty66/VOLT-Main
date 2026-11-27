import { describe, expect, it } from "vitest";
import { parseOptimized, shouldOptimize } from "../shared/optimize";
import { optimizePrompt } from "../server/optimize";

const REPLY = `ASK: Get board approval for a finance platform.
ASSUMPTIONS: Mid-to-large enterprise | 24-month horizon
PROMPT:
Context & Business Ask
The board decides next month between two finance platforms and needs a recommendation it can defend to the audit committee.
Key Questions to Answer
1. Which fits better?`;

describe("prompt optimizer", () => {
  it("includes workflow scoping topics internally and keeps the entire rough request", async () => {
    const ask = "Client request. ".repeat(500) + "Use only the attached trial balance.";
    const client = { messages: { create: async (args: { system: string; messages: {content: string}[] }) => {
      expect(args.system).toContain("do not present an intake questionnaire");
      expect(args.system).toContain("Which ledgers are in scope?");
      expect(args.messages[0].content).toBe(ask);
      return { content: [{type: "text", text: REPLY}], usage: {input_tokens: 0, output_tokens: 0} };
    } } } as never;
    expect(await optimizePrompt(ask, new AbortController().signal, client,
      { name: "Close", topics: ["Which ledgers are in scope?"] })).not.toBeNull();
  });
  it("skips commands, lookups and short text", () => {
    expect(shouldOptimize("/help")).toBe(false);
    expect(shouldOptimize("hi there")).toBe(false);
    expect(shouldOptimize("should we pick Oracle or Workday for finance, board wants an answer next month")).toBe(true);
  });
  it("parses the reply", () => {
    const o = parseOptimized(REPLY);
    expect(o?.ask).toContain("board approval");
    expect(o?.assumptions).toHaveLength(2);
    expect(o?.prompt.startsWith("Context & Business Ask")).toBe(true);
  });
  it("rejects a reply without a usable prompt", () => {
    expect(parseOptimized("sure, here you go")).toBeNull();
    expect(parseOptimized("ASK: x\nASSUMPTIONS: y\nPROMPT:\nshort")).toBeNull();
  });
  it("returns null on failure and never sets thinking", async () => {
    const bad = { messages: { create: async () => { throw new Error("x"); } } } as never;
    expect(await optimizePrompt("rough", new AbortController().signal, bad)).toBeNull();
    let seen: any;
    const ok = { messages: { create: async (a: unknown) => { seen = a; return { content: [{ type: "text", text: REPLY }], usage: { input_tokens: 9, output_tokens: 9 } }; } } } as never;
    const r = await optimizePrompt("rough", new AbortController().signal, ok);
    expect(r?.prompt).toContain("Key Questions");
    expect(seen.thinking).toBeUndefined();
  });
});
