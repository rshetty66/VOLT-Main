import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { codeLike, COOLDOWN_MS, isHealthy, providerOf, recordFailure, resetBroken, markBroken, setClock, specialistModel } from "../server/providers";
import { specialistOpusReason } from "../server/router";
import { estimateCost } from "../server/router";

const SONNET = "claude-sonnet-5-5";
const OPUS = "claude-opus-5-5";
const env = { ...process.env };
beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.XAI_API_KEY;
  resetBroken();
});
afterEach(() => {
  process.env = { ...env };
});

describe("providerOf", () => {
  it("reads the provider from the model id", () => {
    expect(providerOf("claude-opus-5-5")).toBe("anthropic");
    expect(providerOf("gpt-6.2-sol")).toBe("openai");
    expect(providerOf("grok-4.3")).toBe("xai");
    expect(providerOf("grok-code-fast-1")).toBe("xai");
  });
});

describe("specialistModel", () => {
  const brief = "Assess the close process maturity and propose a roadmap.";
  it("stays on Claude by default and with no keys", () => {
    expect(specialistModel(undefined, brief, SONNET).model).toBe(SONNET);
    expect(specialistModel("claude", brief, SONNET).model).toBe(SONNET);
    expect(specialistModel("auto", brief, SONNET).model).toBe(SONNET);
    expect(specialistModel("gpt", brief, SONNET).model).toBe(SONNET);
  });
  it("keeps Opus work on Claude whatever the engine", () => {
    process.env.OPENAI_API_KEY = "k";
    process.env.XAI_API_KEY = "k";
    for (const e of ["auto", "gpt", "grok"] as const) expect(specialistModel(e, brief, OPUS).model).toBe(OPUS);
  });
  it("sends a chosen engine's work to that provider", () => {
    process.env.OPENAI_API_KEY = "k";
    process.env.XAI_API_KEY = "k";
    expect(specialistModel("gpt", brief, SONNET).model).toBe("gpt-6.2-sol");
    expect(specialistModel("grok", brief, SONNET).model).toBe("grok-4.3");
    expect(specialistModel("grok", "Write a SQL script to reconcile the ledger", SONNET).model).toBe("grok-code-fast-1");
  });
  it("auto uses the coding model for code-like briefs, then GPT, then Grok", () => {
    process.env.OPENAI_API_KEY = "k";
    process.env.XAI_API_KEY = "k";
    expect(specialistModel("auto", "Write a python script for the ETL", SONNET).model).toBe("grok-code-fast-1");
    expect(specialistModel("auto", brief, SONNET).model).toBe("gpt-6.2-sol");
    delete process.env.OPENAI_API_KEY;
    expect(specialistModel("auto", brief, SONNET).model).toBe("grok-4.3");
  });
  it("skips a model that was refused", () => {
    process.env.OPENAI_API_KEY = "k";
    markBroken("gpt-6.2-sol");
    expect(specialistModel("gpt", brief, SONNET).model).toBe(SONNET);
  });
  it("honours model overrides", () => {
    process.env.XAI_API_KEY = "k";
    process.env.VOLT_MODEL_GROK = "grok-4.7";
    expect(specialistModel("grok", brief, SONNET).model).toBe("grok-4.7");
  });
});

describe("codeLike and prices", () => {
  it("spots coding briefs", () => {
    expect(codeLike("fix the SQL query and the python ETL")).toBe(true);
    expect(codeLike("run ```select * from gl```")).toBe(true);
    expect(codeLike("SELECT id FROM ledger WHERE x = 1")).toBe(true);
    expect(codeLike("design the target operating model")).toBe(false);
    expect(codeLike("price the API and the pricing schema for the client")).toBe(false);
    expect(codeLike("review the json export")).toBe(false);
  });
  it("prices the new models", () => {
    const t = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 };
    expect(estimateCost("gpt-6.2-sol", t)).toBeCloseTo(12);
    expect(estimateCost("grok-4.3", t)).toBeCloseTo(3.75);
    expect(estimateCost("claude-sonnet-5-5", t)).toBeCloseTo(12);
  });
});

describe("per-turn guardrail", () => {
  it("keeps Opus work on Claude only when the turn says so", () => {
    process.env.OPENAI_API_KEY = "k";
    expect(specialistModel("gpt", "a plain brief", OPUS, false).model).toBe("gpt-6.2-sol");
    expect(specialistModel("gpt", "a plain brief", OPUS, true).model).toBe(OPUS);
    expect(specialistModel("gpt", "a plain brief", SONNET, true).model).toBe(SONNET);
  });
  it("decides from this turn's wording, scope and switch, not the session", () => {
    expect(specialistOpusReason({ prompt: "what is a payback period?" })).toBeNull();
    expect(specialistOpusReason({ prompt: "ASC 606 treatment" })).toMatch(/high-stakes/);
    expect(specialistOpusReason({ prompt: "x", scope: { depth: "deep" } })).toMatch(/Deep/);
    expect(specialistOpusReason({ prompt: "x", scope: { deliverables: ["pptx"] } })).toMatch(/pptx/);
    expect(specialistOpusReason({ prompt: "x", opus: true })).toMatch(/switch/);
  });
});

describe("model health", () => {
  it("skips a retired model for good and a throttled one for 60 seconds", () => {
    let now = 1_000;
    setClock(() => now);
    expect(recordFailure("grok-code-fast-1", 404)).toBe("permanent");
    expect(recordFailure("grok-4.3", 429)).toBe("cooldown");
    expect(recordFailure("gpt-6.2-sol", 400, "The model `x` does not exist")).toBe("permanent");
    expect(recordFailure("gpt-6.1-terra", 400, "bad tool schema")).toBeNull();
    expect(isHealthy("grok-4.3")).toBe(false);
    now += COOLDOWN_MS - 1;
    expect(isHealthy("grok-4.3")).toBe(false);
    now += 1;
    expect(isHealthy("grok-4.3")).toBe(true);
    now += 10 * COOLDOWN_MS;
    expect(isHealthy("grok-code-fast-1")).toBe(false);
    expect(isHealthy("gpt-6.1-terra")).toBe(true);
    setClock(() => Date.now());
  });
  it("routes a burst to the next usable engine while one cools down", () => {
    process.env.OPENAI_API_KEY = "k";
    process.env.XAI_API_KEY = "k";
    recordFailure("gpt-6.2-sol", 503);
    expect(specialistModel("auto", "a plain brief", SONNET).model).toBe("grok-4.3");
    resetBroken();
  });
});
