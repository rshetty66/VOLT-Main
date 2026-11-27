import { describe, expect, it } from "vitest";
import { applyEvent, newRun, runStatus, RUN_STATUS_LABEL } from "../src/runState";
import { ORCHESTRATOR_LANE } from "../shared/events";

const started = () => newRun("How long is our close?", "Chat", "orchestrate");

describe("run status pill", () => {
  it("says Working while the run streams and Completed once it is done", () => {
    let r = started();
    expect(runStatus(r)).toBe("working");
    r = applyEvent(r, { type: "text_delta", lane: ORCHESTRATOR_LANE, text: "Eleven days." });
    r = applyEvent(r, { type: "done", sessionId: "s" });
    expect(runStatus(r)).toBe("completed");
    expect(RUN_STATUS_LABEL[runStatus(r)]).toBe("Completed");
  });

  it("says Stopped when the user stopped it", () => {
    expect(runStatus({ ...started(), state: "stopped" })).toBe("stopped");
  });

  it("says Failed when the lead reported an error", () => {
    let r = applyEvent(started(), { type: "text_delta", lane: ORCHESTRATOR_LANE, text: "Partial" });
    r = applyEvent(r, { type: "error", lane: ORCHESTRATOR_LANE, message: "The model is overloaded" });
    r = applyEvent(r, { type: "done", sessionId: "s" });
    expect(runStatus(r)).toBe("failed");
  });

  it("stays Completed when only a specialist failed and the lead still answered", () => {
    let r = applyEvent(started(), { type: "agent_start", lane: "l1", agentId: "a", name: "A", layer: "x", icon: "", brief: "", parentLane: ORCHESTRATOR_LANE });
    r = applyEvent(r, { type: "error", lane: "l1", message: "timeout" });
    r = applyEvent(r, { type: "text_delta", lane: ORCHESTRATOR_LANE, text: "Answer" });
    r = applyEvent(r, { type: "done", sessionId: "s" });
    expect(runStatus(r)).toBe("completed");
  });
});
