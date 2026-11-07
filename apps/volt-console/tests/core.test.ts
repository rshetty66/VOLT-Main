import { describe, expect, it } from "vitest";
import { loadCatalog, loadSkillBody, rankAgents, rankSkills } from "../server/catalog";
import { appraiseInvestment, buildValueCase, compareToBenchmark, scoreMaturity } from "../server/analytics";
import { runLocalTool, schemas, toolDefs, ORCHESTRATOR_TOOLS } from "../server/tools";
import { extractMetrics, lens, specialistTitle } from "../server/demo";

const catalog = loadCatalog();

describe("VOLT catalog", () => {
  it("loads the validated capability set", () => {
    expect(catalog.agents.length).toBeGreaterThanOrEqual(200);
    expect(catalog.workflows.length).toBeGreaterThanOrEqual(30);
    expect(catalog.skills.length).toBeGreaterThanOrEqual(300);
    expect(catalog.agentById.get("rudra")?.systemPrompt).toMatch(/Rudra/);
  });

  it("every workflow phase references a registered agent", () => {
    expect(catalog.health.missingAgents).toEqual([]);
  });

  it("loads skill bodies from the gzipped pack", () => {
    expect(loadSkillBody("apqc-benchmarks")?.body).toMatch(/APQC/);
    expect(loadSkillBody("does-not-exist")).toBeNull();
  });
});

describe("routing", () => {
  const top = (q: string) => rankAgents(catalog, q, 3).map((r) => r.agent.id);
  it.each([
    ["Our month-end close takes 12 days on SAP S/4HANA", "sap-fico-specialist"],
    ["OSFI BCAR capital ratio for our bank", "osfi-bcar-master"],
    ["IFRS 16 lease portfolio accounting", "lease-accounting-agent"],
    ["Day 1 readiness for an acquisition", "ma-day1-readiness-lead"],
    ["Workday payroll implementation", "workday-payroll-lead"],
  ])("%s → %s", (q, id) => {
    expect(top(q)).toContain(id);
  });

  it("Skill Finder ranks reconciliation packs for a nostro question", () => {
    expect(rankSkills(catalog, "reconcile nostro accounts", 3).map((r) => r.skill.id)).toContain("banking-nostro-recon");
  });
});

describe("analytics", () => {
  it("places a 12-day close in the bottom quartile", () => {
    const r = compareToBenchmark("days_to_close", 12);
    expect("error" in r).toBe(false);
    if (!("error" in r)) {
      expect(r.quartile).toBe("Bottom quartile");
      expect(r.gapToTop25).toBe(8);
    }
  });

  it("handles higher-is-better metrics", () => {
    const r = compareToBenchmark("journal_entries_per_fte", 4000);
    if ("error" in r) throw new Error(r.error);
    expect(r.quartile).toBe("Top quartile");
    expect(r.gapToTop25).toBe(0);
  });

  it("computes NPV, IRR and payback", () => {
    const r = appraiseInvestment({ initialInvestment: 1000, cashFlows: [500, 500, 500], discountRate: 0.1 });
    expect(r.npv).toBeCloseTo(243.43, 1);
    expect(r.irrPct).toBeCloseTo(23.38, 1);
    expect(r.paybackYears).toBe(2);
  });

  it("builds a ramped value case", () => {
    const r = buildValueCase({ financeFtes: 100, loadedCostPerFte: 100_000, automationPct: 20, oneTimeInvestment: 2_000_000, rampYears: 2 });
    expect(r.steadyStateAnnualSaving).toBe(2_000_000);
    expect(r.yearly[0].grossBenefit).toBe(1_000_000);
    expect(r.yearly[1].grossBenefit).toBe(2_000_000);
  });

  it("scores maturity and lists unassessed dimensions", () => {
    const r = scoreMaturity([{ dimension: "Close and Consolidation", current: 2, target: 4 }]);
    expect(r.overall).toBe(2);
    expect(r.priorityGaps).toEqual(["Close and Consolidation"]);
    expect(r.unassessed).toHaveLength(6);
  });
});

describe("tools", () => {
  it("exposes valid JSON schemas", () => {
    for (const t of toolDefs(ORCHESTRATOR_TOOLS)) {
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema).not.toHaveProperty("$schema");
    }
  });

  it("rejects bad input before running", () => {
    expect(schemas.apqc_benchmark.safeParse({ client_value: 3 }).success).toBe(false);
  });

  it("suggests close skills when a skill is not shipped", () => {
    const r = runLocalTool(catalog, "load_skill", { skill_id: "pdf" });
    expect(r.ok).toBe(false);
  });
});

describe("demo metric extraction", () => {
  it("reads close days and DSO from free text", () => {
    expect(extractMetrics("Our close takes 12 days and DSO is 55")).toEqual([
      { metric: "days_to_close", value: 12 },
      { metric: "dso", value: 55 },
    ]);
  });
});

describe("demo specialist cards", () => {
  const catalog = loadCatalog();
  const agent = catalog.agents.find((a) => a.id === "accounting-hub-architect")!;

  it("shows the agent's own role, not the Prompt Defense Baseline", () => {
    const text = lens(agent);
    expect(text).not.toContain("Prompt Defense");
    expect(text).not.toContain("#");
    expect(text.startsWith("You are the Accounting Hub Architect.")).toBe(true);
  });

  it("keeps the first two sentences when there is no baseline block", () => {
    const plain = { ...agent, systemPrompt: "You are a tester. You check things. You report." };
    expect(lens(plain)).toBe("You are a tester. You check things.");
  });

  it("renders a bold name when the agent has no icon", () => {
    expect(specialistTitle({ ...agent, icon: "" })).toBe(`**${agent.name}**`);
    expect(specialistTitle({ ...agent, icon: "A" })).toBe(`**A ${agent.name}**`);
  });
});
