import { afterEach, describe, expect, it } from "vitest";
import { ModelLedger, estimateCost, higher, modelFor, parseTriage, ruleRoute, tierForStep, triage } from "../server/router";

const ENV = ["VOLT_ROUTING", "VOLT_MODEL", "VOLT_MODEL_OPUS", "VOLT_MODEL_SONNET", "VOLT_MODEL_HAIKU"];
afterEach(() => ENV.forEach((k) => delete process.env[k]));

/** A stand-in for the SDK client: returns `reply` as the triage text, or throws. */
const fake = (reply: string | Error) => {
  const calls: any[] = [];
  return {
    calls,
    client: {
      messages: {
        create: async (body: any) => {
          calls.push(body);
          if (reply instanceof Error) throw reply;
          return { content: [{ type: "text", text: reply }], usage: { input_tokens: 90, output_tokens: 7 } };
        },
      },
    } as any,
  };
};
const signal = new AbortController().signal;

describe("model router", () => {
  it("maps each tier to the current models, and steps to tiers", () => {
    expect([modelFor("haiku"), modelFor("sonnet"), modelFor("opus")]).toEqual(["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"]);
    expect([tierForStep("specialist"), tierForStep("workflow_phase"), tierForStep("direct_agent"), tierForStep("quick"), tierForStep("synthesis")]).toEqual(["sonnet", "sonnet", "sonnet", "sonnet", "opus"]);
  });

  it("takes model overrides from the environment, with VOLT_MODEL still setting the Opus tier", () => {
    process.env.VOLT_MODEL = "claude-opus-5";
    process.env.VOLT_MODEL_SONNET = "claude-sonnet-5";
    expect([modelFor("sonnet"), modelFor("opus")]).toEqual(["claude-sonnet-5", "claude-opus-5"]);
    process.env.VOLT_MODEL_OPUS = "claude-fable-5-2";
    expect(modelFor("opus")).toBe("claude-fable-5-2");
  });

  it("sends every step to the Opus-tier model when routing is off", () => {
    process.env.VOLT_ROUTING = "off";
    expect([modelFor("haiku"), modelFor("sonnet"), modelFor("opus")]).toEqual(["claude-opus-5-5", "claude-opus-5-5", "claude-opus-5-5"]);
  });

  it("only moves a conversation's lead up a tier", () => {
    expect([higher(undefined, "sonnet"), higher("opus", "sonnet"), higher("sonnet", "opus"), higher("haiku", "sonnet")]).toEqual(["sonnet", "opus", "opus", "sonnet"]);
  });

  it("reads the triage reply, and rejects one that names no tier", () => {
    expect(parseTriage("OPUS: a multi-GAAP chart of accounts design.")).toEqual({ tier: "opus", reason: "a multi-GAAP chart of accounts design" });
    expect(parseTriage("  sonnet - simple definition")).toEqual({ tier: "sonnet", reason: "simple definition" });
    expect(parseTriage("**OPUS**")).toEqual({ tier: "opus", reason: "triage" });
    expect(parseTriage("I think this needs a big model")).toBeNull();
    expect(parseTriage("HAIKU: tiny")).toBeNull();
  });

  it("falls back to the deliverable rule", () => {
    expect(ruleRoute(true)).toMatchObject({ tier: "opus", by: "rule" });
    expect(ruleRoute(false)).toMatchObject({ tier: "sonnet", by: "rule" });
  });

  it("classifies with one small Haiku call, thinking off, the request wrapped as data", async () => {
    const f = fake("SONNET: a definition");
    const { route, usage } = await triage("What is a suspense account?", ruleRoute(true), signal, f.client);
    expect(route).toEqual({ tier: "sonnet", reason: "a definition", by: "triage" });
    expect(usage).toEqual({ model: "claude-haiku-5-5", inputTokens: 90, outputTokens: 7 });
    expect(f.calls[0]).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 60, thinking: { type: "disabled" }, output_config: { effort: "low" } });
    expect(f.calls[0].messages[0].content).toBe("<request>\nWhat is a suspense account?\n</request>");
  });

  it("uses the rule when triage fails or answers off-format, and skips the call when routing is off", async () => {
    expect((await triage("x", ruleRoute(true), signal, fake(new Error("overloaded")).client)).route).toMatchObject({ tier: "opus", by: "rule" });
    expect((await triage("x", ruleRoute(false), signal, fake("no idea").client)).route).toMatchObject({ tier: "sonnet", by: "rule" });
    process.env.VOLT_ROUTING = "off";
    const f = fake("SONNET: x");
    expect((await triage("x", ruleRoute(true), signal, f.client)).route.by).toBe("rule");
    expect(f.calls).toHaveLength(0);
  });

  it("estimates cost at list price, and logs model use per run", () => {
    const t = { inputTokens: 1_000_000, outputTokens: 100_000, cacheReadTokens: 2_000_000, cacheWriteTokens: 100_000 };
    expect(estimateCost("claude-opus-5-5", t)).toBeCloseTo(4 + 0.5 + 2 + 0.4);
    expect(estimateCost("claude-sonnet-5-5", t)).toBeCloseTo(2 + 0.25 + 1 + 0.2);
    expect(estimateCost("claude-haiku-5-5", { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0 })).toBeCloseTo(0.00015);
    expect(estimateCost("some-other-model", t)).toBe(0);
    const ledger = new ModelLedger();
    expect(ledger.summary()).toBe("none");
    ledger.add("claude-sonnet-5-5", { inputTokens: 100, outputTokens: 20, cacheReadTokens: 5 }, 0.0012);
    ledger.add("claude-sonnet-5-5", { inputTokens: 50, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 10 }, 0.0008);
    expect(ledger.summary()).toBe("claude-sonnet-5-5 calls=2 in=160 out=30 cache=5 usd=0.0020");
  });
});
