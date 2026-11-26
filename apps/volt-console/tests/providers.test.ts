import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { codeLike, providerOf, resetBroken, markBroken, specialistModel } from "../server/providers";
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
    expect(codeLike("fix the SQL query")).toBe(true);
    expect(codeLike("design the target operating model")).toBe(false);
  });
  it("prices the new models", () => {
    const t = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 };
    expect(estimateCost("gpt-6.2-sol", t)).toBeCloseTo(12);
    expect(estimateCost("grok-4.3", t)).toBeCloseTo(3.75);
    expect(estimateCost("claude-sonnet-5-5", t)).toBeCloseTo(12);
  });
});
