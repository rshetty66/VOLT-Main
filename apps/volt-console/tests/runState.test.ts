import { describe, expect, it } from "vitest";
import { applyEvent, newRun, summariseWork } from "../src/runState";
import type { VoltEvent } from "../shared/events";

const fold = (events: VoltEvent[]) => events.reduce(applyEvent, newRun("p", "t", "orchestrate"));
const start = (lane: string, name: string): VoltEvent => ({ type: "agent_start", lane, parentLane: "rudra", agentId: lane, name, layer: "ERP", icon: "x", brief: "b" });

describe("summariseWork", () => {
  it("is empty for a run with no specialists or tools", () => {
    expect(summariseWork(newRun("p", "t", "agent"))).toEqual({ specialists: 0, finished: 0, failed: 0, working: [], toolCalls: 0, errors: [] });
  });

  it("counts specialists, who is still working, and tool calls from every lane", () => {
    const run = fold([
      { type: "tool_call", lane: "rudra", callId: "c1", name: "find_agents", input: { query: "q" } },
      start("a", "Oracle GL"),
      start("b", "SAP FI"),
      { type: "tool_call", lane: "a", callId: "c2", name: "apqc_benchmark", input: {} },
      { type: "agent_end", lane: "a", agentId: "a", ok: true },
    ]);
    expect(summariseWork(run)).toMatchObject({ specialists: 2, finished: 1, failed: 0, working: ["SAP FI"], toolCalls: 2 });
  });

  it("surfaces errors from the orchestrator and from specialists, and counts failures", () => {
    const run = fold([
      start("a", "Oracle GL"),
      { type: "error", lane: "a", message: "specialist broke" },
      { type: "agent_end", lane: "a", agentId: "a", ok: false },
      { type: "error", lane: "rudra", message: "401 invalid x-api-key" },
    ]);
    const s = summariseWork(run);
    expect(s.failed).toBe(1);
    expect(s.errors.sort()).toEqual(["401 invalid x-api-key", "specialist broke"]);
  });
});
