import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { GOALS, GOAL_GUIDE, PLAN_TOOL, goalToolDefs, planGoal, type Plan } from "../server/goals";
import { isLedgerTool } from "../server/ledger";
import { startMockAnthropic } from "./mockAnthropic";

const plan = (input: unknown): Plan => {
  const r = planGoal(input);
  if (!r.ok) throw new Error(r.error);
  return r.plan;
};

describe("goal planner", () => {
  it("plans only with ledger tools that exist", () => {
    for (const g of Object.values(GOALS)) for (const s of g.steps) expect(isLedgerTool(s.tool), s.tool).toBe(true);
  });

  it("'I want to close faster' with nothing attached asks for the three inputs, once, and nothing else", () => {
    const p = plan({ goals: ["close_faster"], in_client_words: "I want to close faster" });
    expect(p.next).toBe("ask");
    expect(p.ask.map((a) => a.input)).toEqual(["trial_balance", "client", "period"]);
    expect(p.instruction).toContain("Ask nothing else");
    expect(p.goals[0].not_yet.join(" ")).toContain("close calendar");
  });

  it("'design our CoA' with the trial balance attached runs straight through", () => {
    const p = plan({ goals: ["design_coa"], in_client_words: "design our CoA", known: { upload_id: "U1", client: "SYNBANK", period: "2026-09" } });
    expect(p.next).toBe("execute");
    expect(p.ask).toEqual([]);
    expect(p.goals[0].steps.every((s) => s.status === "ready")).toBe(true);
    expect(p.goals[0].steps.at(-1)?.tool).toBe("ledger_run_exam");
  });

  it("a trial balance already loaded needs no client or period and skips the load", () => {
    const p = plan({ goals: ["finance_ops_reports"], in_client_words: "monthly pack", known: { doc_id: "D0001" } });
    expect(p.next).toBe("execute");
    expect(p.goals[0].steps[0]).toMatchObject({ tool: "ledger_ingest_upload", status: "done" });
  });

  it("'show segment profitability' runs direct profitability and asks for the cost driver as optional", () => {
    const p = plan({ goals: ["segment_profitability"], in_client_words: "show segment profitability", known: { doc_id: "D0001" } });
    expect(p.next).toBe("execute");
    expect(p.ask).toEqual([expect.objectContaining({ input: "allocation_basis", if_skipped: expect.stringContaining("direct profitability") })]);
    const waits = p.goals[0].steps.filter((s) => s.status === "waits").map((s) => s.tool);
    expect(waits).toEqual(["ledger_propose_allocation_rule", "ledger_run_allocation"]);
    expect(plan({ goals: ["segment_profitability"], in_client_words: "x", known: { doc_id: "D0001", allocation_basis: "fte" } }).ask).toEqual([]);
  });

  it("lineage and data needs need no inputs; unbuilt goals say so", () => {
    expect(plan({ goals: ["finance_data_model"], in_client_words: "what data do we need from the loan system" }).next).toBe("execute");
    const p = plan({ goals: ["multi_gaap", "driver_based_fpa"], in_client_words: "IFRS and US GAAP, and a driver-based forecast", known: { doc_id: "D0001" } });
    expect(p.goals.map((g) => g.not_yet.join(" ")).join(" ")).toMatch(/phase 2.*phase 4/);
  });

  it("asks a question shared by two goals once", () => {
    const p = plan({ goals: ["close_faster", "segment_profitability"], in_client_words: "close faster and see which lines make money" });
    expect(p.ask.map((a) => a.input)).toEqual(["trial_balance", "client", "period", "allocation_basis"]);
  });

  it("refuses an unknown goal or a bad period", () => {
    expect(planGoal({ goals: ["make_money"], in_client_words: "x" }).ok).toBe(false);
    expect(planGoal({ goals: ["close_faster"], in_client_words: "x", known: { period: "Sept" } }).ok).toBe(false);
  });

  it("describes every goal by what the client means, so the model classifies by meaning", () => {
    const d = goalToolDefs()[0];
    expect(d.name).toBe(PLAN_TOOL);
    for (const [id, g] of Object.entries(GOALS)) {
      expect(d.description).toContain(`${id}: ${g.means}`);
      expect(GOAL_GUIDE).toContain(id);
    }
  });
});

describe("goal planner in the chat", () => {
  let mock: Awaited<ReturnType<typeof startMockAnthropic>>;
  beforeAll(async () => {
    mock = await startMockAnthropic();
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_BASE_URL = mock.url;
  });
  afterAll(() => mock.close());
  afterEach(() => vi.unstubAllEnvs());

  async function leadRequest(prompt: string) {
    const orchestrator = await import("../server/orchestrator");
    const catalog = (await import("../server/catalog")).loadCatalog();
    const before = mock.requests.length;
    await orchestrator.runLive(catalog, { prompt }, orchestrator.getSession(), () => {}, new AbortController().signal);
    return mock.requests.slice(before).find((r) => r.body.tools.some((t: { name: string }) => t.name === "consult_agent"))!.body;
  }

  it("gives the lead the planner and the goal guide when the ledger is on, and neither when it is off", async () => {
    vi.stubEnv("VOLT_LEDGER_URL", "http://ledger.test");
    vi.stubEnv("VOLT_LEDGER_TOKEN", "t");
    const on = await leadRequest("We take twelve days to close and I want that down");
    expect(on.tools.map((t: { name: string }) => t.name)).toContain(PLAN_TOOL);
    expect(JSON.stringify(on.system)).toContain("Work from the client's goal");
    vi.stubEnv("VOLT_LEDGER_TOKEN", "");
    const off = await leadRequest("We take twelve days to close and I want that down");
    expect(off.tools.map((t: { name: string }) => t.name)).not.toContain(PLAN_TOOL);
    expect(JSON.stringify(off.system)).not.toContain("Work from the client's goal");
  });
});
