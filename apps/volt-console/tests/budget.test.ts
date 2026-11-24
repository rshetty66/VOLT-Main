import { describe, expect, it } from "vitest";
import { lateForRewrite, runBudgetMs } from "../server/budget.js";
import { SourceRegistry } from "../server/research.js";

const env = (e: Record<string, string>) => e as NodeJS.ProcessEnv;

describe("run time budget", () => {
  it("is 270 seconds on Vercel and 15 minutes elsewhere", () => {
    expect(runBudgetMs(env({ VERCEL: "1" }))).toBe(270_000);
    expect(runBudgetMs(env({}))).toBe(900_000);
  });
  it("can be set, and turned off with 0 even on Vercel", () => {
    expect(runBudgetMs(env({ VOLT_RUN_BUDGET_SECONDS: "120" }))).toBe(120_000);
    expect(runBudgetMs(env({ VERCEL: "1", VOLT_RUN_BUDGET_SECONDS: "0" }))).toBe(0);
    expect(runBudgetMs(env({ VOLT_RUN_BUDGET_SECONDS: "abc" }))).toBe(0);
    expect(runBudgetMs(env({ VOLT_RUN_BUDGET_SECONDS: "0" }))).toBe(0);
  });
  it("skips the rewrite only when over half the budget is spent", () => {
    expect(lateForRewrite(100_000, 270_000)).toBe(false);
    expect(lateForRewrite(140_000, 270_000)).toBe(true);
    expect(lateForRewrite(999_999, 0)).toBe(false);
  });
  it("starts the clock when the registry is made", () => {
    const before = Date.now();
    const r = new SourceRegistry("a prompt");
    expect(r.startedAt).toBeGreaterThanOrEqual(before);
    expect(r.startedAt).toBeLessThanOrEqual(Date.now());
  });
});
