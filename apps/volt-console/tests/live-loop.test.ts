import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockAnthropic } from "./mockAnthropic";
import type { VoltEvent } from "../shared/events";

let mock: Awaited<ReturnType<typeof startMockAnthropic>>;
let orchestrator: typeof import("../server/orchestrator");
let catalog: ReturnType<typeof import("../server/catalog").loadCatalog>;

beforeAll(async () => {
  mock = await startMockAnthropic();
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = mock.url;
  orchestrator = await import("../server/orchestrator");
  catalog = (await import("../server/catalog")).loadCatalog();
});
afterAll(() => mock.close());

async function run(req: Parameters<typeof orchestrator.runLive>[1]) {
  const events: VoltEvent[] = [];
  await orchestrator.runLive(catalog, req, orchestrator.getSession(), (e) => events.push(e), new AbortController().signal);
  return events;
}

describe("live agent loop (mocked Messages API)", () => {
  it("orchestrates parallel specialist consults and synthesises", async () => {
    const events = await run({ prompt: "12 day close on SAP" });
    const started = events.filter((e) => e.type === "agent_start").map((e) => (e as { agentId: string }).agentId);
    expect(started).toEqual(["sap-fico-specialist", "oracle-arcs-lead"]);
    expect(events.some((e) => e.type === "status" && e.text.includes("parallel"))).toBe(true);
    const bench = events.find((e) => e.type === "tool_result" && e.name === "apqc_benchmark");
    expect(bench && "summary" in bench && bench.summary).toContain("Bottom quartile");
    const rudraText = events.filter((e) => e.type === "text_delta" && e.lane === "rudra").map((e) => (e as { text: string }).text).join("");
    expect(rudraText).toContain("Final answer from Rudra");
  });

  it("sends a thin draft of a deliverable back once, and the screen replaces it", async () => {
    const events = await run({ prompt: "Build a plan to cut our month-end close from 12 days to 5 on SAP S/4HANA" });
    const types = events.map((e) => e.type);
    expect(types).toContain("text_reset");
    expect(events.some((e) => e.type === "status" && e.text.startsWith("Partner review"))).toBe(true);
    const reset = types.indexOf("text_reset");
    const text = (from: number, to: number) => events.slice(from, to).filter((e) => e.type === "text_delta" && e.lane === "rudra").map((e) => (e as { text: string }).text).join("");
    expect(text(0, reset)).toContain("Final answer from Rudra");
    expect(text(reset, events.length)).toContain("REVISED DELIVERABLE");
    expect(types.filter((t) => t === "text_reset")).toHaveLength(1);
  });

  it("leaves a short question alone", async () => {
    const events = await run({ prompt: "What is DSO?" });
    expect(events.map((e) => e.type)).not.toContain("text_reset");
  });

  it("sends the client deliverable standards and structure to the lead and the specialists", () => {
    const system = (r: { body: { system: { text: string }[] } }) => r.body.system.map((x) => x.text).join("\n");
    const lead = mock.requests.find((r) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent"))!;
    const specialist = mock.requests.find((r) => !r.body.tools.some((t: { name: string }) => t.name === "consult_agent"))!;
    expect(system(lead)).toContain("The final answer is a client deliverable");
    expect(system(lead)).toContain("Lead with the answer");
    expect(system(lead)).not.toContain("attribute key points to the specialist");
    expect(system(specialist)).toContain("Lead with the answer");
  });

  it("sends the expected request shape", () => {
    const first = mock.requests[0];
    expect(first.headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01");
    expect(first.body.model).toBe("claude-opus-5-5");
    expect(first.body.thinking).toEqual({ type: "adaptive", display: "updates" });
    expect(first.body.fallbacks).toBe("default");
    expect(first.body.system[0].cache_control).toEqual({ type: "ephemeral" });
    // All tool results of one turn come back in a single user message.
    const synth = mock.requests.find((r) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent") && Array.isArray(r.body.messages.at(-1).content));
    expect(synth?.body.messages.at(-1).content.map((c: { tool_use_id: string }) => c.tool_use_id)).toEqual(["tu_a", "tu_b", "tu_c"]);
  });

  it("attaches the selected template's formatting guide and offers the template tools", async () => {
    const before = mock.requests.length;
    await run({ prompt: "Draft the steering deck", agentId: "creative-designer", template: { id: "abc123", name: "Client deck", guide: "# Formatting guide: Client deck\nHeading font: Montserrat" } });
    const req = mock.requests[before];
    const first = req.body.messages[0].content as string;
    expect(first).toContain("Draft the steering deck");
    expect(first).toContain('Formatting template: "Client deck"');
    expect(first).toContain("Heading font: Montserrat");
    expect(req.body.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining(["list_templates", "get_template"]));
  });

  it("runs a workflow phase by phase", async () => {
    const events = await run({ prompt: "Insurer close", workflowId: "close-optimization" });
    const phases = events.filter((e) => e.type === "phase_start");
    expect(phases.length).toBe(catalog.workflowById.get("close-optimization")!.phases.length);
    expect(events.filter((e) => e.type === "agent_end").every((e) => (e as { ok: boolean }).ok)).toBe(true);
  });
});
