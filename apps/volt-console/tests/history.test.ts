import { describe, expect, it } from "vitest";
import { HISTORY_KEY, loadHistory, mergeHistory, saveHistory, slim, type StorageLike } from "../src/history";
import { newRun, type Run } from "../src/runState";

const run = (over: Partial<Run> = {}): Run => ({ ...newRun("a prompt", "Rudra orchestration", "orchestrate"), text: "an answer", state: "done", ...over });
const mem = (limit = Infinity): StorageLike & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      if (v.length > limit) throw new Error("quota");
      data[k] = v;
    },
  };
};

describe("history", () => {
  it("keeps finished runs with an answer, newest first, and skips running or empty ones", () => {
    const a = run({ startedAt: 1 });
    const b = run({ startedAt: 2 });
    const merged = mergeHistory([], [a, b, run({ state: "running" }), run({ text: "  " })]);
    expect(merged.map((r) => r.startedAt)).toEqual([2, 1]);
  });

  it("merges by id and caps the list", () => {
    const a = run({ startedAt: 1 });
    expect(mergeHistory([a], [{ ...a, text: "newer" }])).toHaveLength(1);
    expect(mergeHistory([a], [{ ...a, text: "newer" }])[0].text).toBe("newer");
    const many = Array.from({ length: 40 }, (_, i) => run({ startedAt: i }));
    expect(mergeHistory([], many, 30)).toHaveLength(30);
  });

  it("drops bulky tool data but keeps the specialists' notes", () => {
    const r = run({
      activity: [{ id: "1", kind: "tool", text: "tool", data: { big: "x".repeat(1000) }, detail: "d" }],
      lanes: { l1: { id: "l1", agentId: "a", name: "A", layer: "L", icon: "", brief: "", parentLane: "", text: "notes", state: "done", activity: [{ id: "2", kind: "tool", text: "t", data: { big: 1 } }] } },
    });
    const s = slim(r);
    expect(JSON.stringify(s)).not.toContain("xxxx");
    expect(s.lanes.l1.text).toBe("notes");
  });

  it("round-trips through storage, and a run left working reloads as stopped", () => {
    const st = mem();
    saveHistory([run({ id: "x", state: "running" }), run({ id: "y" })], st);
    const back = loadHistory(st);
    expect(back.map((r) => [r.id, r.state])).toEqual([["x", "stopped"], ["y", "done"]]);
  });

  it("survives corrupt data and a full browser", () => {
    const st = mem();
    st.data[HISTORY_KEY] = "{not json";
    expect(loadHistory(st)).toEqual([]);
    st.data[HISTORY_KEY] = JSON.stringify([{ nope: 1 }]);
    expect(loadHistory(st)).toEqual([]);
    const tiny = mem(2000);
    const runs = Array.from({ length: 5 }, (_, i) => run({ id: `r${i}`, text: "x".repeat(900), startedAt: 10 - i }));
    expect(() => saveHistory(runs, tiny)).not.toThrow();
    expect(loadHistory(tiny).length).toBeGreaterThan(0);
    expect(loadHistory(tiny).length).toBeLessThan(5);
  });
});
