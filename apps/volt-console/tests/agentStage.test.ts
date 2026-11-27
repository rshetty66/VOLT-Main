import { describe, expect, it } from "vitest";
import { applyEvent, newRun, type Run } from "../src/runState";
import { describeTool, edgePath, flowScene, toolStation, type Flow } from "../src/agentStage";
import type { VoltEvent } from "../shared/events";

const fold = (events: VoltEvent[], run: Run = newRun("p", "t", "orchestrate")) => events.reduce(applyEvent, run);
const start = (lane: string, name: string, brief = "Map the close"): VoltEvent => ({ type: "agent_start", lane, parentLane: "rudra", agentId: lane, name, layer: "Process", icon: "x", brief });
const node = (f: Flow, id: string) => f.nodes.find((n) => n.id === id)!;
const edge = (f: Flow, id: string) => f.edges.find((e) => e.id === id);

describe("agent flow scene", () => {
  it("starts with You handed off to Rudra, who is planning, and every route faint", () => {
    const f = flowScene(newRun("p", "t", "orchestrate"));
    expect(node(f, "user").state).toBe("done");
    expect(node(f, "rudra")).toMatchObject({ state: "active", caption: "Planning", agent: true });
    expect(edge(f, "user>rudra")?.state).toBe("done");
    expect(edge(f, "rudra>web")?.state).toBe("idle");
    expect(node(f, "web").state).toBe("idle");
  });

  it("skips the model-routing status line in captions", () => {
    const f = flowScene(fold([{ type: "status", lane: "rudra", text: "Model: Opus for the lead (Haiku triage: Generating synthetic data)" }]));
    expect(node(f, "rudra").caption).toBe("Planning");
  });

  it("lights the tool agent and the link while a call is pending, then marks both done with the result", () => {
    const call: VoltEvent = { type: "tool_call", lane: "rudra", callId: "c1", name: "web_search", input: { query: "close days" } };
    const live = flowScene(fold([call]));
    expect(node(live, "web")).toMatchObject({ state: "active", caption: "Search: close days" });
    expect(node(live, "rudra").caption).toBe("Waiting on Researcher");
    expect(edge(live, "rudra>web")).toMatchObject({ state: "on", color: node(live, "rudra").color });

    const back = flowScene(fold([call, { type: "tool_result", lane: "rudra", callId: "c1", name: "web_search", summary: "Found 6 sources" }]));
    expect(node(back, "web")).toMatchObject({ state: "done", caption: "Found 6 sources" });
    expect(edge(back, "rudra>web")?.state).toBe("done");
  });

  it("adds specialists in the Delegate column with their own colours and links their tool calls from them", () => {
    const f = flowScene(fold([start("a", "Close lead"), start("b", "Controls lead"), { type: "tool_call", lane: "b", callId: "k", name: "load_skill", input: { skill_id: "close-controls" } }]));
    const a = node(f, "a");
    const b = node(f, "b");
    expect(a).toMatchObject({ state: "active", side: true, caption: "Map the close" });
    expect(a.color).not.toBe(b.color);
    expect(edge(f, "rudra>a")?.state).toBe("on");
    expect(edge(f, "b>kb")).toMatchObject({ state: "on", color: b.color });
    expect(node(f, "kb")).toMatchObject({ name: "Memory", state: "active", caption: "Playbook: close-controls" });
  });

  it("marks failed specialists", () => {
    const f = flowScene(fold([start("a", "A"), { type: "agent_end", lane: "a", agentId: "a", ok: false }]));
    expect(node(f, "a")).toMatchObject({ state: "failed", caption: "Failed" });
    expect(edge(f, "rudra>a")?.state).toBe("done");
  });

  it("clears finished specialists of earlier workflow phases and keeps at most four", () => {
    const run = fold([
      { type: "phase_start", index: 0, name: "Diagnose", agents: ["a"] },
      start("w:0:a", "Phase 1 agent"),
      { type: "agent_end", lane: "w:0:a", agentId: "a", ok: true },
      { type: "phase_end", index: 0, name: "Diagnose" },
      { type: "phase_start", index: 1, name: "Design", agents: ["b"] },
      start("w:1:b", "Phase 2 agent"),
    ]);
    expect(flowScene(run).nodes.filter((n) => n.side).map((n) => n.name)).toEqual(["Phase 2 agent"]);
    const many = fold(["a", "b", "c", "d", "e"].map((x) => start(x, x.toUpperCase())));
    expect(flowScene(many).nodes.filter((n) => n.side).map((n) => n.name)).toEqual(["B", "C", "D", "E"]);
  });

  it("runs the file through the Builder to the Verifier, then to the Output once finished", () => {
    const run: Run = {
      ...fold([
        { type: "tool_call", lane: "rudra", callId: "f", name: "create_file", input: { format: "xlsx" } },
        { type: "tool_result", lane: "rudra", callId: "f", name: "create_file", summary: "Value-Case_v1.xlsx" },
      ]),
      state: "done",
    };
    const f = flowScene(run, { passed: 4, total: 5 });
    expect(node(f, "files")).toMatchObject({ state: "done", caption: "Value-Case_v1.xlsx" });
    expect(edge(f, "files>gates")?.state).toBe("done");
    expect(node(f, "gates")).toMatchObject({ state: "failed", caption: "4 of 5 gates passed" });
    expect(edge(f, "gates>out")?.state).toBe("done");
    expect(node(f, "out")).toMatchObject({ state: "done", caption: "Answer ready" });
    expect(node(f, "rudra").state).toBe("done");
  });

  it("routes the answer past the Verifier to the Output even when there are no gates", () => {
    const f = flowScene({ ...newRun("p", "t", "orchestrate"), state: "done" });
    expect(edge(f, "rudra>gates")?.state).toBe("done");
    expect(edge(f, "gates>out")?.state).toBe("done");
    expect(edge(f, "rudra>out")).toBeUndefined();
    expect(node(f, "gates").state).toBe("idle");
  });

  it("cuts long captions so they stay one short line", () => {
    const f = flowScene(fold([start("a", "A", "word ".repeat(40))]));
    const cap = node(f, "a").caption;
    expect(cap.length).toBeLessThanOrEqual(26);
    expect(cap.endsWith("…")).toBe(true);
  });

  it("maps every tool VOLT uses for analysis and files to a tool agent, in plain words", () => {
    expect(toolStation("apqc_benchmark")).toBe("analytics");
    expect(toolStation("load_skill")).toBe("kb");
    expect(toolStation("consult_agent")).toBeUndefined();
    expect(describeTool("load_skill", "close controls")).toBe("Playbook: close controls");
    expect(describeTool("some_new_tool")).toBe("some new tool");
  });

  it("draws links between node rims", () => {
    expect(edgePath({ id: "rudra", x: 130, y: 115 }, { id: "web", x: 440, y: 45 })).toBe("M147,115 C286.5,115 286.5,45 426,45");
  });
});
