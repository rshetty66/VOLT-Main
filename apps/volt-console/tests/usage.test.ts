import { describe, expect, it } from "vitest";
import { chatUsage, compact, usageTotals } from "../src/usage";
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
    expect(totals).toEqual({ chats: 2, runs: 2, input: 150, output: 30, cacheRead: 6, total: 180 });
    expect(usageTotals(chatUsage([]))).toEqual({ chats: 0, runs: 0, input: 0, output: 0, cacheRead: 0, total: 0 });
  });

  it("writes compact numbers", () => {
    expect([compact(0), compact(999), compact(1234), compact(52270), compact(361511), compact(2_400_000)]).toEqual(["0", "999", "1.2K", "52.3K", "362K", "2.4M"]);
  });
});
