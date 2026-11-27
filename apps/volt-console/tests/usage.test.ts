import { describe, expect, it } from "vitest";
import { cad, chatUsage, compact, modelName, modelsLine, usageTotals } from "../src/usage";
import { newRun, type Run } from "../src/runState";

const run = (over: Partial<Run> & { in?: number; out?: number; cache?: number } = {}): Run => {
  const { in: i = 0, out = 0, cache = 0, ...rest } = over;
  return { ...newRun("a prompt", "Rudra orchestration", "orchestrate"), text: "x", state: "done", mode: "live", usage: { input: i, output: out, cacheRead: cache }, ...rest };
};

describe("token usage per chat", () => {
  it("groups runs that share a session into one chat and adds their tokens", () => {
    const chats = chatUsage([
      run({ sessionId: "s1", startedAt: 1, finishedAt: 5, in: 1000, out: 200, cache: 300, prompt: "First question" }),
      run({ sessionId: "s1", startedAt: 10, finishedAt: 20, in: 500, out: 100, cache: 50, prompt: "Follow-up" }),
      run({ sessionId: "s2", startedAt: 30, finishedAt: 40, in: 90, out: 10, prompt: "Another chat" }),
    ]);
    expect(chats).toHaveLength(2);
    const s1 = chats.find((c) => c.id === "s1")!;
    expect(s1.runs.map((r) => r.prompt)).toEqual(["First question", "Follow-up"]);
    expect([s1.input, s1.output, s1.cacheRead, s1.total]).toEqual([1500, 300, 350, 1800]);
    expect(s1.title).toBe("First question");
  });

  it("lists the newest chat first, and treats a run with no session as its own chat", () => {
    const chats = chatUsage([run({ id: "a", startedAt: 1, finishedAt: 2 }), run({ id: "b", startedAt: 50, finishedAt: 60 })]);
    expect(chats.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("flags a chat made only of demo runs, and shortens a long title", () => {
    const c = chatUsage([run({ sessionId: "d", mode: "demo", prompt: "word ".repeat(60) })])[0];
    expect(c.demo).toBe(true);
    expect(c.title.length).toBeLessThanOrEqual(90);
    expect(c.title.endsWith("...")).toBe(true);
    expect(chatUsage([run({ sessionId: "m", mode: "demo" }), run({ sessionId: "m", mode: "live" })])[0].demo).toBe(false);
  });

  it("adds up totals across chats, and handles no history", () => {
    const totals = usageTotals(chatUsage([run({ sessionId: "a", in: 100, out: 20, cache: 5 }), run({ sessionId: "b", in: 50, out: 10, cache: 1 })]));
    expect(totals).toEqual({ chats: 2, runs: 2, input: 150, output: 30, cacheRead: 6, total: 180, cost: 0, models: [] });
    expect(usageTotals(chatUsage([]))).toEqual({ chats: 0, runs: 0, input: 0, output: 0, cacheRead: 0, total: 0, cost: 0, models: [] });
  });

  it("writes compact numbers", () => {
    expect([compact(0), compact(999), compact(1234), compact(52270), compact(361511), compact(2_400_000)]).toEqual(["0", "999", "1.2K", "52.3K", "362K", "2.4M"]);
  });

  it("adds up estimated cost per chat and per model, most expensive model first", () => {
    const priced = (sessionId: string, cost: number, models: Record<string, { tokens: number; cost: number }>) => ({ ...run({ sessionId }), usage: { input: 0, output: 0, cacheRead: 0, cost, models } });
    const chats = chatUsage([
      priced("a", 0.3, { "claude-opus-5-5": { tokens: 10000, cost: 0.25 }, "claude-haiku-5-5": { tokens: 90, cost: 0.00001 } }),
      priced("b", 0.1, { "claude-sonnet-5-5": { tokens: 8000, cost: 0.08 }, "claude-opus-5-5": { tokens: 1000, cost: 0.02 } }),
    ]);
    const totals = usageTotals(chats);
    expect(totals.cost).toBeCloseTo(0.4);
    expect(totals.models.map((m) => m.model)).toEqual(["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);
    expect(totals.models[0]).toEqual({ model: "claude-opus-5-5", tokens: 11000, cost: 0.27 });
    expect([cad(0), cad(0.004), cad(1)]).toEqual(["CA$0.00", "<CA$0.01", "CA$1.38"]);
    expect(chats.find((c) => c.id === "a")!.models.map((m) => m.model)).toEqual(["claude-opus-5-5", "claude-haiku-5-5"]);
  });

  it("names the models each chat used, in plain words", () => {
    expect([modelName("claude-opus-5-5"), modelName("claude-haiku-5-5"), modelName("claude-sonnet-5"), modelName("gpt-x")]).toEqual(["Opus 5.5", "Haiku 5.5", "Sonnet 5", "gpt-x"]);
    expect(modelsLine([{ model: "claude-opus-5-5", tokens: 12300, cost: 0.2 }, { model: "claude-haiku-5-5", tokens: 90, cost: 0 }])).toBe("Opus 5.5 12.3K · Haiku 5.5 90");
    expect(chatUsage([run({ sessionId: "old" })])[0].models).toEqual([]);
  });
});

describe("cost over time and sortable tables", () => {
  it("adds up cost and tokens per day, oldest first", async () => {
    const { costByDay } = await import("../src/usage");
    const run = (t: string, cost: number) => ({ startedAt: new Date(t).getTime(), usage: { input: 100, output: 50, cacheRead: 0, cost } }) as never;
    expect(costByDay([run("2026-11-26T15:00:00", 0.5), run("2026-11-25T10:00:00", 0.25), run("2026-11-26T18:00:00", 0.25)])).toEqual([
      { day: "2026-11-25", cost: 0.25, tokens: 150 },
      { day: "2026-11-26", cost: 0.75, tokens: 300 },
    ]);
  });

  it("sorts numbers and text both ways and keeps missing values last", async () => {
    const { sortRows } = await import("../src/useSort");
    const rows = [{ n: 2, s: "b" }, { n: undefined, s: "a" }, { n: 10, s: "c" }];
    expect(sortRows(rows, (r) => r.n, "desc").map((r) => r.n)).toEqual([10, 2, undefined]);
    expect(sortRows(rows, (r) => r.n, "asc").map((r) => r.n)).toEqual([2, 10, undefined]);
    expect(sortRows(rows, (r) => r.s, "asc").map((r) => r.s)).toEqual(["a", "b", "c"]);
  });
});
