import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../server/index";
import { SAMPLE_COA_CSV, SAMPLE_LEGACY_CSV } from "../shared/coa";
import type { CoaEvent } from "../shared/events";
import { BAD_CSV, GOOD_CSV, startMockAnthropic } from "./mockAnthropic";

let mock: Awaited<ReturnType<typeof startMockAnthropic>>;
let live: Server, demo: Server;
const url = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;

async function assist(base: string, body: object): Promise<CoaEvent[]> {
  const r = await fetch(`${base}/api/assist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  return text.split("\n\n").filter((f) => f.startsWith("data: ")).map((f) => JSON.parse(f.slice(6)) as CoaEvent);
}

beforeAll(async () => {
  mock = await startMockAnthropic();
  process.env.ANTHROPIC_BASE_URL = mock.url;
  process.env.ANTHROPIC_API_KEY = "test-key";
  live = createApp("live").listen(0);
  demo = createApp("demo").listen(0);
  await new Promise((r) => setTimeout(r, 50));
});
afterAll(() => { live.close(); demo.close(); mock.close(); });

describe("validate route", () => {
  it("returns checks for the sample chart and mapping", async () => {
    const r = await fetch(`${url(demo)}/api/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coaCsv: SAMPLE_COA_CSV, legacyCsv: SAMPLE_LEGACY_CSV }) });
    const j = await r.json();
    expect(j.accounts).toBe(21);
    expect(j.coaChecks.every((c: any) => c.ok)).toBe(true);
    expect(j.mappingChecks.every((c: any) => c.ok)).toBe(true);
  });
  it("rejects a malformed body", async () => {
    const r = await fetch(`${url(demo)}/api/validate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(r.status).toBe(400);
  });
});

describe("assist route, demo mode", () => {
  it("reports the real checks and says it is not a model answer", async () => {
    const ev = await assist(url(demo), { prompt: "review", coaCsv: BAD_CSV });
    const text = ev.filter((e) => e.type === "text_delta").map((e: any) => e.text).join("");
    expect(text).toContain("Demo mode");
    expect(text).toContain("FAIL `C_TYPE_RANGE`");
    expect(ev.at(-1)).toEqual({ type: "done" });
    expect(mock.requests).toHaveLength(0);
  });
});

describe("assist route, live loop against the mock", () => {
  it("sends the coa-designer prompt and both tools, then proposes a chart that passed the check", async () => {
    mock.requests.length = 0;
    const ev = await assist(url(live), { prompt: "Design a small chart", coaCsv: SAMPLE_COA_CSV });
    const first = mock.requests[0].body;
    expect(first.system[0].text).toContain("COA Design Guru");
    expect(first.system[0].text).toContain("check_coa");
    expect(first.tools.map((t: any) => t.name).sort()).toEqual(["check_coa", "check_mapping"]);
    expect(first.messages.at(-1).content).toContain("Current target chart");

    // the tool result went back to the model before its final answer
    const second = mock.requests[1].body;
    expect(JSON.stringify(second.messages.at(-1).content)).toContain("PASS C_UNIQUE_CODES");

    const proposal = ev.find((e) => e.type === "proposal");
    expect(proposal).toEqual({ type: "proposal", kind: "coa", csv: GOOD_CSV });
    expect(ev.some((e) => e.type === "text_delta" && e.text === "Final answer.")).toBe(true);
    expect(ev.at(-1)).toEqual({ type: "done" });
  });

  it("does not emit a proposal when the check fails", async () => {
    mock.requests.length = 0;
    const ev = await assist(url(live), { prompt: "MARK_BAD" });
    const result = ev.find((e) => e.type === "tool_result") as any;
    expect(result.summary).toContain("fail");
    expect(ev.some((e) => e.type === "proposal")).toBe(false);
    expect(JSON.stringify(mock.requests[1].body.messages.at(-1).content)).toContain("FAIL C_TYPE_RANGE");
  });
});
