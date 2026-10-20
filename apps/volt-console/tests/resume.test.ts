import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockAnthropic } from "./mockAnthropic";
import type { VoltEvent } from "../shared/events";
import type { Db } from "../server/db";

let mock: Awaited<ReturnType<typeof startMockAnthropic>>;
let db: Db;
let runs: typeof import("../server/runs");
let store: typeof import("../server/store");
let catalog: ReturnType<typeof import("../server/catalog").loadCatalog>;

beforeAll(async () => {
  mock = await startMockAnthropic();
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = mock.url;
  runs = await import("../server/runs");
  store = await import("../server/store");
  catalog = (await import("../server/catalog")).loadCatalog();
  db = await (await import("../server/db")).openDb();
});
afterAll(async () => {
  mock.close();
  await db.close();
});

/** A stopped close-optimization run in which every specialist finished except the Fact-Check Agent. */
async function stoppedRun() {
  const wf = catalog.workflowById.get("close-optimization")!;
  const id = crypto.randomUUID();
  await store.createRun(db, { id, sessionId: "s", kind: "workflow", title: wf.name, prompt: "11-day close", workflowId: wf.id, intake: { audience: "C-Suite / Board" }, mode: "live", model: "claude-opus-5-5" });
  const events: VoltEvent[] = [{ type: "run_start", runId: id, sessionId: "s", mode: "live", model: "claude-opus-5-5", kind: "workflow", title: wf.name }];
  wf.phases.forEach((phase, i) => {
    events.push({ type: "phase_start", index: i, name: phase.name, agents: phase.agents });
    for (const agentId of phase.agents) {
      const lane = `${wf.id}:${i}:${agentId}`;
      const unfinished = agentId === "fact-check-agent";
      events.push({ type: "agent_start", lane, parentLane: "rudra", agentId, name: agentId, layer: "x", icon: "", brief: "b" });
      events.push({ type: "text_delta", lane, text: unfinished ? "PARTIAL fact check" : `SAVED output of ${agentId}` });
      events.push({ type: "agent_end", lane, agentId, ok: !unfinished });
    }
    if (i < wf.phases.length - 1) events.push({ type: "phase_end", index: i, name: phase.name });
  });
  events.push({ type: "done", sessionId: "s" });
  await store.appendEvents(db, id, 0, events);
  await store.finishRun(db, id, { status: "stopped", finalText: "", inputTokens: 268100, outputTokens: 49764, cacheReadTokens: 0 });
  return (await store.getRun(db, id))!;
}

describe("resuming a stopped workflow run", () => {
  it("reuses finished specialists, reruns only the unfinished one, then synthesises", async () => {
    const source = await stoppedRun();
    const reuse = runs.finishedOutputs(source);
    expect(reuse.size).toBe(9);
    expect([...reuse.keys()].some((k) => k.endsWith("fact-check-agent"))).toBe(false);

    const before = mock.requests.length;
    const seen: VoltEvent[] = [];
    const handle = await runs.startRun(
      { db, catalog, mode: "live" },
      { prompt: source.prompt, workflowId: source.workflowId!, intake: source.intake!, resumeFrom: source.id },
      (e) => seen.push(e),
      { reuse },
    );
    await handle.finished;
    const calls = mock.requests.slice(before);

    // Fact-Check Agent (find_skills turn + answer) and Rudra's synthesis (same two turns): 4 calls, not 22.
    expect(calls.length).toBe(4);
    const factCheckBrief = JSON.stringify(calls[0].body.messages[0].content);
    expect(factCheckBrief).toContain("Fact-Check Agent perspective");
    expect(factCheckBrief).toContain("SAVED output of financial-modeling-agent"); // earlier phases fed in from the saved run
    expect(factCheckBrief).not.toContain("PARTIAL");
    expect(JSON.stringify(calls[2].body.messages.at(-1))).toContain("Synthesise the final executive deliverable");

    const saved = (await store.getRun(db, handle.runId))!;
    expect(saved.status).toBe("done");
    expect(saved.title).toBe("Finance Close Optimization (resumed)");
    expect(saved.finalText).toContain("Specialist deliverable.");
    const ends = seen.filter((e) => e.type === "agent_end");
    expect(ends.length).toBe(10);
    expect(ends.every((e) => e.type === "agent_end" && e.ok)).toBe(true);
    expect(seen.some((e) => e.type === "status" && e.text.startsWith("Resuming: reusing 9"))).toBe(true);
    expect((await store.getRun(db, source.id))?.status).toBe("stopped"); // the original is left as it was
  }, 60_000);
});
