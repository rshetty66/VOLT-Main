import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startMockAnthropic } from "./mockAnthropic";
import type { VoltEvent } from "../shared/events";
import type { Db } from "../server/db";

let mock: Awaited<ReturnType<typeof startMockAnthropic>>;
let db: Db;
let orchestrator: typeof import("../server/orchestrator");
let runs: typeof import("../server/runs");
let store: typeof import("../server/store");
let settings: typeof import("../server/settings");
let usage: typeof import("../server/usage");
let cost: typeof import("../server/cost");
let auth: typeof import("../server/auth");
let catalog: ReturnType<typeof import("../server/catalog").loadCatalog>;
let server: Server;
let base = "";
let adminId = "";
let anaId = "";

beforeAll(async () => {
  mock = await startMockAnthropic();
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = mock.url;
  orchestrator = await import("../server/orchestrator");
  runs = await import("../server/runs");
  store = await import("../server/store");
  settings = await import("../server/settings");
  usage = await import("../server/usage");
  cost = await import("../server/cost");
  auth = await import("../server/auth");
  catalog = (await import("../server/catalog")).loadCatalog();
  db = await (await import("../server/db")).openDb();
  adminId = (await auth.createUser(db, { email: "admin@example.com", name: "Admin", role: "admin", password: "correct-horse-battery" })).id;
  anaId = (await auth.createUser(db, { email: "ana@example.com", name: "Ana", role: "consultant", password: "correct-horse-battery" })).id;
  const { createApp } = await import("../server/app");
  server = createApp({ db, catalog, mode: "live" }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  mock.close();
  await db.close();
});
beforeEach(() => {
  mock.options.specialistAlwaysTools = false;
  mock.options.cacheWriteTokens = 0;
});

async function signIn(email: string) {
  const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "correct-horse-battery" }) });
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Cookie: cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* stream */
    }
    return { status: res.status, data, text };
  };
}

async function runToEnd(body: Parameters<typeof runs.startRun>[1], userId?: string) {
  const seen: VoltEvent[] = [];
  const handle = await runs.startRun({ db, catalog, mode: "live", userId }, body, (e) => seen.push(e));
  await handle.finished;
  return { seen, saved: (await store.getRun(db, handle.runId))! };
}

describe("prices", () => {
  it("prices each kind of token, dated model ids and long Haiku prompts", () => {
    const p = cost.DEFAULT_PRICES;
    const u = { inputTokens: 1_000_000, cacheWriteTokens: 1_000_000, cacheReadTokens: 1_000_000, outputTokens: 1_000_000 };
    expect(cost.callCost(p, "claude-opus-5-5", u)).toBeCloseTo(4 + 5 + 0.2 + 20);
    expect(cost.callCost(p, "claude-opus-5-5-20261001", { inputTokens: 1000, outputTokens: 0, cacheReadTokens: 0 })).toBeCloseTo(0.004);
    expect(cost.callCost(p, "claude-haiku-5-5", { inputTokens: 50_000, outputTokens: 0, cacheReadTokens: 0 })).toBeCloseTo(0.005);
    expect(cost.callCost(p, "claude-haiku-5-5", { inputTokens: 150_000, outputTokens: 0, cacheReadTokens: 0 })).toBeCloseTo(0.075);
    expect(cost.callCost(p, "simulator", u)).toBe(0);
  });
});

describe("less context re-sent", () => {
  it("caches the conversation as well as the system prompt, and reports cache writes", async () => {
    mock.options.cacheWriteTokens = 30;
    const events: VoltEvent[] = [];
    await orchestrator.runLive(catalog, { prompt: "12 day close" }, orchestrator.getSession(), (e) => events.push(e), new AbortController().signal);
    const req = mock.requests.at(-1)!.body;
    expect(req.cache_control).toEqual({ type: "ephemeral" });
    expect(req.system[0].cache_control).toEqual({ type: "ephemeral" });
    const u = events.find((e) => e.type === "usage") as Extract<VoltEvent, { type: "usage" }>;
    expect(u.model).toBe("claude-opus-5-5");
    expect(u.cacheWriteTokens).toBe(30);
  });

  it("passes handoff summaries, not full outputs, to later phases, and synthesises with a slimmer prompt", async () => {
    const from = mock.requests.length;
    await orchestrator.runLive(catalog, { prompt: "Insurer close", workflowId: "close-optimization" }, orchestrator.getSession(), () => {}, new AbortController().signal);
    const firstCalls = mock.requests.slice(from).filter((r) => r.body.messages.length === 1 && !r.body.system[0].text.includes("You are synthesising"));
    const briefs = firstCalls.map((r) => r.body.messages[0].content as string);
    expect(briefs.every((b) => b.includes("## Handoff summary"))).toBe(true);
    expect(briefs.filter((b) => b.includes("## Handoffs from earlier phases")).length).toBeGreaterThan(0);
    expect(briefs.some((b) => b.includes("Outputs from earlier phases"))).toBe(false);
    const synth = mock.requests.slice(from).find((r) => r.body.system[0].text.includes("You are synthesising"))!;
    expect(synth.body.system[0].text).not.toContain("VOLT agent roster");
  });

  it("keeps the handoff section, or the opening of an output that has none", () => {
    const withHandoff = "## Findings\nLong analysis...\n\n## Handoff summary\nClose is 11 days; target 6. Recon is the bottleneck.";
    expect(orchestrator.handoffOf(withHandoff)).toBe("Close is 11 days; target 6. Recon is the bottleneck.");
    const long = `${"Lead paragraph with the answer.\n".repeat(80)}`;
    const lead = orchestrator.handoffOf(long);
    expect(lead.length).toBeLessThanOrEqual(1510);
    expect(lead.endsWith("[...]")).toBe(true);
    expect(orchestrator.handoffOf("Short output.")).toBe("Short output.");
  });

  it("caps a specialist's steps and asks for the answer on the last one", async () => {
    mock.options.specialistAlwaysTools = true;
    await settings.updateSettings(db, { specialistMaxSteps: 3 }, adminId);
    const from = mock.requests.length;
    const { seen } = await runToEnd({ prompt: "Insurer close", workflowId: "close-optimization" }, adminId);
    await settings.resetSettings(db, ["specialistMaxSteps"]);

    const lane = (seen.find((e) => e.type === "agent_start") as Extract<VoltEvent, { type: "agent_start" }>).lane;
    const laneUsage = seen.filter((e) => e.type === "usage" && e.lane === lane);
    expect(laneUsage.length).toBe(3);
    expect(seen.some((e) => e.type === "status" && e.lane === lane && e.text.includes("3-step limit"))).toBe(true);
    // The third call carried the request to finish.
    const calls = mock.requests.slice(from).filter((r) => (r.body.messages[0].content as string).includes(catalog.workflowById.get("close-optimization")!.phases[0].name));
    expect(JSON.stringify(calls.find((r) => r.body.messages.length === 5)?.body.messages.at(-1))).toContain("write your final deliverable now");
  });

  it("uses the configured specialist model, and the console model for the lead", async () => {
    await settings.updateSettings(db, { specialistModel: "claude-sonnet-5-5" }, adminId);
    const from = mock.requests.length;
    await runToEnd({ prompt: "12 day close" }, adminId);
    await settings.resetSettings(db, ["specialistModel"]);
    const sent = mock.requests.slice(from);
    expect(sent.filter((r) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent")).every((r) => r.body.model === "claude-opus-5-5")).toBe(true);
    expect(sent.some((r) => r.body.model === "claude-sonnet-5-5")).toBe(true);
  });
});

describe("cost and budgets", () => {
  it("saves each run's cost and cache writes, priced per call", async () => {
    mock.options.cacheWriteTokens = 1000;
    const { seen, saved } = await runToEnd({ prompt: "12 day close" }, anaId);
    const calls = seen.filter((e): e is Extract<VoltEvent, { type: "usage" }> => e.type === "usage");
    const expected = calls.reduce((s, e) => s + cost.callCost(cost.DEFAULT_PRICES, e.model, e), 0);
    expect(calls.every((e) => (e.costUsd ?? 0) > 0)).toBe(true);
    expect(saved.costUsd).toBeCloseTo(expected, 4);
    expect(saved.cacheWriteTokens).toBe(1000 * calls.length);
    const estimate = await usage.estimateRun(db, catalog, await settings.getSettings(db), {});
    expect(estimate.basis).toBe("history");
    expect(estimate.usd).toBeCloseTo(saved.costUsd, 2);
  });

  it("stops a run that reaches its budget, warning first", async () => {
    await settings.updateSettings(db, { runBudgetUsd: 0.006 }, adminId);
    const { seen, saved } = await runToEnd({ prompt: "Insurer close", workflowId: "close-optimization" }, anaId);
    await settings.resetSettings(db, ["runBudgetUsd"]);
    expect(seen.some((e) => e.type === "status" && e.text.startsWith("Budget:"))).toBe(true);
    expect(saved.status).toBe("stopped");
    expect(saved.error).toMatch(/this run's budget of \$0\.01 was reached/);
    expect(saved.error).toMatch(/then Resume\.$/);
    expect(seen.filter((e) => e.type === "usage").length).toBeLessThan(10);
    // What it finished can be resumed.
    expect(runs.finishedOutputs(saved).size).toBeGreaterThan(0);
  });

  it("stops a run at the person's monthly budget, and refuses new live runs once it is used", async () => {
    await usage.setUserBudget(db, anaId, (await usage.monthSpent(db, anaId)) + 0.003);
    const { saved } = await runToEnd({ prompt: "Insurer close", workflowId: "close-optimization" }, anaId);
    expect(saved.status).toBe("stopped");
    expect(saved.error).toMatch(/your monthly budget/);

    const ana = await signIn("ana@example.com");
    const before = mock.requests.length;
    const refused = await ana("POST", "/api/run", { prompt: "another" });
    expect(refused.status).toBe(403);
    expect(refused.data.error).toMatch(/monthly Claude budget/);
    expect(mock.requests.length).toBe(before);
    const demo = await ana("POST", "/api/run", { prompt: "another", demo: true });
    expect(demo.status).toBe(200);
    await usage.setUserBudget(db, anaId, null);
  });

  it("shows spend and an estimate; only admins change prices, budgets and models", async () => {
    const admin = await signIn("admin@example.com");
    const ana = await signIn("ana@example.com");

    const mine = (await ana("GET", "/api/usage")).data;
    expect(mine.scope).toBe("you");
    expect(mine.monthTotalUsd).toBeGreaterThan(0);
    expect(mine.byPerson).toEqual([]);
    const all = (await admin("GET", "/api/usage")).data;
    expect(all.scope).toBe("everyone");
    expect(all.byPerson.find((p: { name: string }) => p.name === "Ana").spentUsd).toBeCloseTo(mine.monthTotalUsd, 3);

    const est = (await ana("GET", "/api/usage/estimate?workflowId=finance-assessment")).data;
    expect(est.estimate.basis).toBe("rough");
    expect(est.estimate.low).toBeLessThan(est.estimate.usd);
    expect(est.budget.monthlyBudgetUsd).toBe(100);

    expect((await ana("GET", "/api/settings/cost")).status).toBe(403);
    expect((await ana("PUT", "/api/settings/cost", { runBudgetUsd: 1 })).status).toBe(403);
    expect((await ana("PUT", `/api/users/${anaId}/budget`, { monthlyBudgetUsd: 999 })).status).toBe(403);

    expect((await admin("PUT", "/api/settings/cost", { specialistModel: "claude-unknown-9" })).status).toBe(400);
    expect((await admin("PUT", "/api/settings/cost", { warnAt: 2 })).status).toBe(400);
    const changed = await admin("PUT", "/api/settings/cost", { runBudgetUsd: 25, prices: { ...cost.DEFAULT_PRICES, "claude-opus-5-5": { input: 3, cacheWrite: 3.75, cacheRead: 0.15, output: 15 } } });
    expect(changed.status).toBe(200);
    expect(changed.data.settings.runBudgetUsd).toBe(25);
    expect((await ana("GET", "/api/usage/estimate")).data.budget.runBudgetUsd).toBe(25);
    const reset = await admin("POST", "/api/settings/cost/reset", { keys: ["runBudgetUsd", "prices"] });
    expect(reset.data.settings.runBudgetUsd).toBe(10);
    expect(reset.data.settings.prices["claude-opus-5-5"].input).toBe(4);

    expect((await admin("PUT", `/api/users/${anaId}/budget`, { monthlyBudgetUsd: 250 })).status).toBe(200);
    expect((await ana("GET", "/api/usage")).data.budget.monthlyBudgetUsd).toBe(250);
    const audit = (await admin("GET", "/api/audit")).data;
    expect(JSON.stringify(audit)).toContain("budget_set");
  });
});
