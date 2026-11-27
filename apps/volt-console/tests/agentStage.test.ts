import { describe, expect, it } from "vitest";
import { applyEvent, newRun, type Run } from "../src/runState";
import { describeTool, stageScene, STATIONS, toolStation } from "../src/agentStage";
import type { VoltEvent } from "../shared/events";

const fold = (events: VoltEvent[], run: Run = newRun("p", "t", "orchestrate")) => events.reduce(applyEvent, run);
const start = (lane: string, name: string, layer = "Process"): VoltEvent => ({ type: "agent_start", lane, parentLane: "rudra", agentId: lane, name, layer, icon: "x", brief: "Map the close" });
const stand = (id: string) => {
  const s = STATIONS.find((x) => x.id === id)!;
  return [s.stand[0], s.stand[1], 0];
};

describe("agent stage scene", () => {
  it("puts Rudra on the hub, thinking, at the start of a run", () => {
    const [rudra, ...rest] = stageScene(newRun("p", "t", "orchestrate")).agents;
    expect(rudra).toMatchObject({ id: "rudra", lead: true, thinking: true, working: false, state: "running", pos: [4, 4, 18] });
    expect(rest).toEqual([]);
  });

  it("sends an agent to the station of its pending tool call and lights the station", () => {
    const run = fold([start("a", "Close lead"), { type: "tool_call", lane: "a", callId: "c1", name: "web_search", input: { query: "close days" } }]);
    const scene = stageScene(run);
    const a = scene.agents.find((x) => x.id === "a")!;
    expect(a).toMatchObject({ working: true, thinking: false, bubble: 'Searching the web: "close days"' });
    expect(a.pos).toEqual(stand("web"));
    expect(scene.live).toEqual(["web"]);
  });

  it("brings the agent back to its desk with the result once the tool returns", () => {
    const run = fold([
      start("a", "Close lead"),
      { type: "tool_call", lane: "a", callId: "c1", name: "web_search", input: { query: "q" } },
      { type: "tool_result", lane: "a", callId: "c1", name: "web_search", summary: "Found 6 sources" },
    ]);
    const scene = stageScene(run);
    const a = scene.agents.find((x) => x.id === "a")!;
    expect(a).toMatchObject({ working: false, thinking: true, bubble: "Found 6 sources", pos: [3.2, 1, 0] });
    expect(scene.live).toEqual([]);
  });

  it("sends Rudra to the file builder for create_file", () => {
    const run = fold([{ type: "tool_call", lane: "rudra", callId: "f", name: "create_file", input: { format: "xlsx" } }]);
    const rudra = stageScene(run).agents[0];
    expect(rudra.pos).toEqual(stand("files"));
    expect(rudra.bubble).toBe("Building the file");
  });

  it("marks failed agents and flags a model fallback", () => {
    const run = fold([start("a", "A"), start("b", "B"), { type: "fallback", lane: "b", from: "x", to: "y" }, { type: "agent_end", lane: "a", agentId: "a", ok: false }]);
    const [, a, b] = stageScene(run).agents;
    expect(a).toMatchObject({ state: "failed", bubble: "Failed" });
    expect(b).toMatchObject({ alert: true, bubble: "Retrying on a backup model" });
  });

  it("clears finished agents of earlier workflow phases off the floor", () => {
    const run = fold([
      { type: "phase_start", index: 0, name: "Diagnose", agents: ["a"] },
      start("w:0:a", "Phase 1 agent"),
      { type: "agent_end", lane: "w:0:a", agentId: "a", ok: true },
      { type: "phase_end", index: 0, name: "Diagnose" },
      { type: "phase_start", index: 1, name: "Design", agents: ["b"] },
      start("w:1:b", "Phase 2 agent"),
    ]);
    expect(stageScene(run).agents.map((a) => a.name)).toEqual(["Rudra", "Phase 2 agent"]);
  });

  it("shows the evidence gates on Rudra once the answer is finished", () => {
    const run: Run = { ...fold([start("a", "A")]), state: "done" };
    const scene = stageScene(run, { passed: 4, total: 5 });
    expect(scene.agents[0]).toMatchObject({ state: "done", bubble: "4 of 5 evidence gates passed", pos: [4, 4, 18] });
    expect(scene.agents[1].state).toBe("done");
    expect(scene.live).toEqual(["gates"]);
  });

  it("cuts long bubbles so they stay glanceable", () => {
    const run = fold([{ type: "agent_start", lane: "a", parentLane: "rudra", agentId: "a", name: "A", layer: "L", icon: "x", brief: "word ".repeat(40) }]);
    const bubble = stageScene(run).agents[1].bubble;
    expect(bubble.length).toBeLessThanOrEqual(60);
    expect(bubble.endsWith("\u2026")).toBe(true);
  });

  it("maps every tool VOLT uses for analysis and files to a station, in plain words", () => {
    expect(toolStation("apqc_benchmark")).toBe("analytics");
    expect(toolStation("load_skill")).toBe("kb");
    expect(toolStation("consult_agent")).toBeUndefined();
    expect(describeTool("load_skill", "close controls")).toBe("Loading playbook: close controls");
    expect(describeTool("some_new_tool")).toBe("some new tool");
  });
});
