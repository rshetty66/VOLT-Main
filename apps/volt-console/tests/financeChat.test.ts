import { describe, expect, it } from "vitest";
import { REFERENCE_MODEL, type FinanceModel } from "../shared/financeReference";
import { applyChanges, linkExists, parseChange, type ModelChange } from "../shared/financeChat";
import { checkClientModel, modelBrief, scenarioTurn } from "../server/financeChat";

const newAgent: ModelChange = { op: "add_agent", agent: { id: "ag_accrual", name: "Accrual agent", on: ["op_rules"], activities: ["Estimate accruals"], approver: "GL accountant", does: "Drafts accrual estimates from contract data.", guardrail: "Drafts only." } };
const signal = new AbortController().signal;
const clientReturning = (obj: unknown, seen: { system?: unknown } = {}) => ({
  messages: { create: async (req: { system: unknown }) => { seen.system = req.system; return { content: [{ type: "text", text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 20 } }; } },
});

describe("scenario changes to the finance model", () => {
  it("applies a what-if and changes only what it names", () => {
    const r = applyChanges(REFERENCE_MODEL, [newAgent, { op: "set_maturity", capability: "Close Management", target: 2 }]);
    expect(r.rejected).toEqual([]);
    expect(r.applied).toEqual(["Added Accrual agent on Accounting Rules", "Set Close Management maturity target 2"]);
    expect(r.model.agents.at(-1)?.id).toBe("ag_accrual");
    const { agents, capabilities, ...rest } = r.model;
    const { agents: a0, capabilities: c0, ...rest0 } = REFERENCE_MODEL;
    expect(rest).toEqual(rest0);
    expect(agents.slice(0, -1)).toEqual(a0);
    expect(capabilities.filter((c) => c.name !== "Close Management")).toEqual(c0.filter((c) => c.name !== "Close Management"));
    expect(REFERENCE_MODEL.agents.some((a) => a.id === "ag_accrual")).toBe(false);
  });

  it("rejects an unknown component, agent, activity, capability or duplicate id with a reason, and keeps the rest", () => {
    const r = applyChanges(REFERENCE_MODEL, [
      { op: "update_agent", id: "ag_rec", on: ["nowhere"] },
      { op: "remove_agent", id: "ag_ghost" },
      { op: "rate_activity", activity: "Invented activity", impact: "high" },
      { op: "set_maturity", capability: "Treasury", target: 3 },
      { ...newAgent, agent: { ...newAgent.agent, id: "ag_rec" } },
      { op: "add_agent", agent: { ...(newAgent as Extract<ModelChange, { op: "add_agent" }>).agent, activities: ["Not in taxonomy"] } },
      { op: "rate_activity", activity: "Run depreciation", impact: "moderate" },
    ]);
    expect(r.rejected).toHaveLength(6);
    expect(r.rejected.join("\n")).toMatch(/unknown component "nowhere"[\s\S]*No agent "ag_ghost"[\s\S]*No activity "Invented activity"[\s\S]*No capability "Treasury"[\s\S]*already exists[\s\S]*"Not in taxonomy"/);
    expect(r.applied).toEqual(['Rated "Run depreciation" moderate']);
  });

  it("parses only well-formed changes and strips markup", () => {
    expect(parseChange({ op: "drop_table" })).toBeNull();
    expect(parseChange({ op: "add_agent", agent: { id: "bad id", name: "x", on: ["op_rules"] } })).toBeNull();
    expect(parseChange({ op: "rate_activity", activity: "Run depreciation", impact: "huge" })).toBeNull();
    expect(parseChange({ op: "set_maturity", capability: "Credit", target: 5 })).toBeNull();
    expect(parseChange({ op: "update_agent", id: "ag_rec" })).toBeNull();
    const c = parseChange({ op: "update_agent", id: "ag_rec", does: "<img src=x onerror=1>Matches" });
    expect(c).toEqual({ op: "update_agent", id: "ag_rec", does: "img src=x onerror=1Matches" });
  });

  it("keeps links only to things in the model", () => {
    expect(linkExists(REFERENCE_MODEL, "cmp:op_rules")).toBe(true);
    expect(linkExists(REFERENCE_MODEL, "agent:ag_rec")).toBe(true);
    expect(linkExists(REFERENCE_MODEL, "l4:Run depreciation")).toBe(true);
    expect(linkExists(REFERENCE_MODEL, "cap:Intercompany")).toBe(true);
    expect(linkExists(REFERENCE_MODEL, "cmp:nope")).toBe(false);
    expect(linkExists(REFERENCE_MODEL, "javascript:alert(1)")).toBe(false);
  });
});

describe("scenarioTurn", () => {
  it("answers in demo mode without calling the model", async () => {
    const r = await scenarioTurn(REFERENCE_MODEL, [], "Where do agents fit?", false, signal, { messages: { create: () => { throw new Error("called"); } } } as never);
    expect(r.demo).toBe(true);
    expect(r.model).toBe(REFERENCE_MODEL);
  });

  it("applies valid changes, rejects the rest and drops unknown links", async () => {
    const seen: { system?: unknown } = {};
    const client = clientReturning({ bullets: ["Add an accrual agent.", "<b>Hypothesis</b> until the workshop."], links: [{ label: "Accrual agent", target: "agent:ag_accrual" }, { label: "Ghost", target: "cmp:ghost" }], changes: [newAgent, { op: "remove_agent", id: "ag_ghost" }, { op: "explode" }] }, seen);
    const r = await scenarioTurn(REFERENCE_MODEL, [{ role: "user", text: "earlier" }], "What if an agent drafts accruals?", true, signal, client as never);
    expect(r.applied).toEqual(["Added Accrual agent on Accounting Rules"]);
    expect(r.rejected).toHaveLength(2);
    expect(r.links).toEqual([{ label: "Accrual agent", target: "agent:ag_accrual" }]);
    expect(r.bullets[1]).toBe("bHypothesis/b until the workshop.");
    expect(r.model.agents).toHaveLength(12);
    expect(JSON.stringify(seen.system)).toContain("ag_rec");
  });

  it("checks a model the browser sends back", () => {
    expect(checkClientModel(structuredClone(REFERENCE_MODEL))).not.toBeNull();
    expect(checkClientModel({ title: "x" })).toBeNull();
    const bad = structuredClone(REFERENCE_MODEL) as FinanceModel;
    bad.agents[0].on = ["ghost"];
    expect(checkClientModel(bad)).toBeNull();
    expect(modelBrief(REFERENCE_MODEL)).toContain("PCF 9.3.2.6");
  });
});

describe("scenario assistant guards", () => {
  it("rate-limits the chat route as a cost-bearing model call", async () => {
    const { COSTLY } = await import("../server/security");
    expect(COSTLY.some((re) => re.test("/api/finance-model/chat"))).toBe(true);
  });
  it("applies nothing to a model that is already invalid", () => {
    const bad = structuredClone(REFERENCE_MODEL);
    bad.agents[0].on = ["ghost"];
    const r = applyChanges(bad, [{ op: "rate_activity", activity: "Run depreciation", impact: "moderate" }]);
    expect(r.applied).toEqual([]);
    expect(r.rejected[0]).toMatch(/ghost/);
  });
});
