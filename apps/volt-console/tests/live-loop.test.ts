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

  it("gives the lead the attached files, with their source keys, and registers them as sources", async () => {
    const before = mock.requests.length;
    const events = await run({ prompt: "12 day close on SAP", attachments: [{ name: "trial-balance.csv", text: "account,amount\n4000,UNIQUE-ATTACH-777" }] });
    const lead = mock.requests.slice(before).find((r) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent"))!;
    const first = JSON.stringify(lead.body.messages[0].content);
    expect(first).toContain("UNIQUE-ATTACH-777");
    expect(first).toContain("[S02] trial-balance.csv");
    const sources = events.filter((e) => e.type === "source").map((e) => (e as { record: { key: string; type: string } }).record);
    expect(sources.find((r) => r.key === "S02")?.type).toBe("client data");
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

  it("records tool results in the source register and sends each key back to the model", async () => {
    const events = await run({ prompt: "12 day close on SAP" });
    const sources = events.filter((e) => e.type === "source").map((e) => (e as { record: { key: string; title: string; type: string } }).record);
    expect(sources[0]).toMatchObject({ key: "S01", type: "client input" });
    expect(sources.find((x) => x.key === "S02")).toMatchObject({ title: "APQC benchmark: days_to_close", type: "benchmark table" });
    expect(events.find((e) => e.type === "research")).toMatchObject({ tier: "STANDARD" });
    // the lead's second request carries the benchmark result with its key
    const withResult = mock.requests.filter((r) => JSON.stringify(r.body.messages).includes("Source key: S02"));
    expect(withResult.length).toBeGreaterThan(0);
    expect(JSON.stringify(withResult[0].body.messages)).toContain("Cite this result as [S02]");
  });

  it("sends the failed evidence gates back in the partner review", async () => {
    await run({ prompt: "Build a plan to cut our month-end close from 12 days to 5 on SAP S/4HANA" });
    const review = mock.requests.find((r) => typeof r.body.messages.at(-1)?.content === "string" && String(r.body.messages.at(-1).content).startsWith("Partner review"));
    expect(review).toBeTruthy();
    const text = String(review!.body.messages.at(-1).content);
    expect(text).toContain("Contradictions and tensions");
    expect(text).toContain("Residue");
    expect(text).toContain("Scope and method");
  });

  it("gives the lead the evidence rules and the specialists the short form", () => {
    const system = (r: { body: { system: { text: string }[] } }) => r.body.system.map((x) => x.text).join("\n");
    const lead = mock.requests.find((r) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent"))!;
    const specialist = mock.requests.find((r) => !r.body.tools.some((t: { name: string }) => t.name === "consult_agent"))!;
    expect(system(lead)).toContain("Cite by source key");
    expect(system(lead)).toContain("## 6. Evidence and method");
    expect(system(specialist)).toContain("Cite the source key");
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

  it("routes the lead by Haiku triage, runs specialists on Sonnet, and prices every call", async () => {
    const before = mock.requests.length;
    const triaged = mock.triage.length;
    const events = await run({ prompt: "12 day close on SAP" });
    expect(mock.triage.length).toBe(triaged + 1);
    expect(mock.triage.at(-1)!.body.model).toBe("claude-haiku-5-5");
    const reqs = mock.requests.slice(before);
    const isLead = (r: (typeof reqs)[number]) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent");
    expect(new Set(reqs.filter(isLead).map((r) => r.body.model))).toEqual(new Set(["claude-opus-5-5"]));
    expect(new Set(reqs.filter((r) => !isLead(r)).map((r) => r.body.model))).toEqual(new Set(["claude-sonnet-5-5"]));
    expect(events.some((e) => e.type === "status" && e.text.startsWith("Model: Opus for the lead (Haiku triage"))).toBe(true);
    const usage = events.filter((e) => e.type === "usage") as Extract<VoltEvent, { type: "usage" }>[];
    expect(new Set(usage.map((u) => u.model))).toEqual(new Set(["claude-haiku-5-5", "claude-opus-5-5", "claude-sonnet-5-5"]));
    expect(usage.every((u) => (u.costUsd ?? 0) > 0)).toBe(true);
  });

  it("runs a simple question's lead on Sonnet, and keeps a conversation's lead from moving down", async () => {
    const session = orchestrator.getSession();
    const leadModel = async (prompt: string) => {
      const before = mock.requests.length;
      await orchestrator.runLive(catalog, { prompt }, session, () => {}, new AbortController().signal);
      return mock.requests.slice(before).find((r) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent"))!.body.model;
    };
    expect(await leadModel("TRIAGE-SONNET what is a suspense account")).toBe("claude-sonnet-5-5");
    expect(await leadModel("12 day close on SAP")).toBe("claude-opus-5-5");
    expect(await leadModel("TRIAGE-SONNET and a follow-up")).toBe("claude-opus-5-5");
  });

  it("puts high-stakes finance work and the Opus switch on Opus for the lead and the specialists, without triage", async () => {
    for (const req of [{ prompt: "Multi-GAAP chart of accounts for our bank" }, { prompt: "TRIAGE-SONNET 12 day close on SAP", opus: true }]) {
      const before = mock.requests.length;
      const triaged = mock.triage.length;
      const events = await run(req);
      expect(mock.triage.length).toBe(triaged);
      expect(new Set(mock.requests.slice(before).map((r) => r.body.model))).toEqual(new Set(["claude-opus-5-5"]));
      expect(events.some((e) => e.type === "status" && e.text.includes("Specialists run on Opus"))).toBe(true);
    }
  });

  it("puts the lead on Opus without triage when the scope asks for a file or Deep depth", async () => {
    for (const scope of [{ deliverables: ["docx"] }, { depth: "deep" }]) {
      const before = mock.requests.length;
      const triaged = mock.triage.length;
      const events = await run({ prompt: "TRIAGE-SONNET 12 day close on SAP", scope });
      expect(mock.triage.length).toBe(triaged);
      const lead = mock.requests.slice(before).filter((r) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent"));
      expect(new Set(lead.map((r) => r.body.model))).toEqual(new Set(["claude-opus-5-5"]));
      expect(events.some((e) => e.type === "status" && e.text.includes("the scope asks for"))).toBe(true);
    }
  });

  it("sends a quick file ask to Sonnet without a triage call", async () => {
    const before = mock.requests.length;
    const triaged = mock.triage.length;
    await run({ prompt: "Make an Excel workbook of a 5-day close calendar" });
    expect(mock.triage.length).toBe(triaged);
    expect(mock.requests[before].body.model).toBe("claude-sonnet-5-5");
  });

  it("runs a workflow phase by phase", async () => {
    const events = await run({ prompt: "Insurer close", workflowId: "close-optimization" });
    const phases = events.filter((e) => e.type === "phase_start");
    expect(phases.length).toBe(catalog.workflowById.get("close-optimization")!.phases.length);
    expect(events.filter((e) => e.type === "agent_end").every((e) => (e as { ok: boolean }).ok)).toBe(true);
    expect(events.some((e) => e.type === "status" && e.text === "Model: Sonnet for each phase, Opus for the synthesis.")).toBe(true);
  });
});
