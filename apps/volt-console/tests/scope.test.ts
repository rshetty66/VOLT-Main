import { describe, expect, it } from "vitest";
import { DELIVERABLES, MAX_KPIS, OUTCOMES, OUTCOME_GROUPS, RECOMMEND, scopeBrief, scopeLabel, scopeSchema } from "../shared/scope";
import { KPI_LIBRARY, parseKpiList, suggestKpis } from "../shared/kpis";
import { directAsk, quickAsk } from "../shared/asks";
import { BENCHMARKS } from "../server/analytics";
import { withTemplate } from "../server/orchestrator";

describe("chat intake", () => {
  it("offers outcomes across finance transformation, with nothing preselected and a recommend option", () => {
    expect(OUTCOME_GROUPS.map((g) => g.label)).toEqual(["Close and report", "Performance", "Foundations", "Transformation"]);
    expect(Object.keys(OUTCOMES).length).toBeGreaterThanOrEqual(16);
    expect(OUTCOMES[RECOMMEND]).toBe("Not sure, recommend");
    expect(scopeSchema.parse({})).toEqual({});
  });

  it("takes several outcomes, bases and deliverables, and caps outcomes at three and KPIs at twelve", () => {
    expect(scopeSchema.safeParse({ outcomes: ["close", "recs", "fpa"], basis: ["ifrs", "us_gaap"], deliverables: ["html", "xlsx"] }).success).toBe(true);
    expect(scopeSchema.safeParse({ outcomes: ["close", "recs", "fpa", "cost"] }).success).toBe(false);
    const kpi = (i: number) => ({ id: `k${i}`, name: `KPI ${i}` });
    expect(scopeSchema.safeParse({ kpis: Array.from({ length: MAX_KPIS }, (_, i) => kpi(i)) }).success).toBe(true);
    expect(scopeSchema.safeParse({ kpis: Array.from({ length: MAX_KPIS + 1 }, (_, i) => kpi(i)) }).success).toBe(false);
  });

  it("rejects an unknown answer, field or KPI field", () => {
    expect(scopeSchema.safeParse({ client_type: "hedge_fund" }).success).toBe(false);
    expect(scopeSchema.safeParse({ colour: "red" }).success).toBe(false);
    expect(scopeSchema.safeParse({ kpis: [{ id: "a", name: "A", owner: "x" }] }).success).toBe(false);
  });

  it("offers chat, HTML, slide deck, PowerPoint, Word and Excel as deliverables", () => {
    expect(Object.keys(DELIVERABLES)).toEqual(["chat", "html", "deck", "pptx", "docx", "xlsx"]);
    expect(scopeBrief({ deliverables: ["html", "xlsx"] })).toContain("an HTML report and an Excel workbook made with create_file");
    expect(scopeBrief({ deliverables: ["chat"] })).not.toContain("create_file");
    expect(scopeBrief({})).toBe("");
  });

  it("puts the outcomes, the problem and every KPI, with unknowns, into one scope block", () => {
    const brief = scopeBrief({
      client_type: "insurer",
      outcomes: ["close", "recs"],
      problem: "11-day close",
      kpis: [
        { id: "days_to_close", name: "Days to close the books", unit: "days", benchmark: "days_to_close", baseline: "11", target: "5", by: "2027-Q2" },
        { id: "recs", name: "Reconciliations auto-matched", unit: "%" },
      ],
      basis: ["ifrs", "us_gaap"],
      depth: "quick",
    });
    expect(brief).toContain("- Client type: Insurer");
    expect(brief).toContain("- Outcomes: Faster close; Automate reconciliations");
    expect(brief).toContain("- What is not working today (client's words): 11-day close");
    expect(brief).toContain("Days to close the books (days): today 11, target 5 by 2027-Q2");
    expect(brief).toContain("Reconciliations auto-matched (%): today unknown, target unknown");
    expect(brief).toContain("never invent a baseline or a target");
    expect(brief).toContain("- Reporting basis: IFRS, US GAAP");
    expect(brief).toContain("Keep the answer short");
    // The scope frames the work; it must not turn a lookup into a deliverable.
    expect(brief).toContain("a direct question or a lookup gets a direct answer");
  });

  it("asks VOLT to recommend when the client is not sure", () => {
    expect(scopeBrief({ outcomes: [RECOMMEND] })).toContain("recommend the outcome that fits the request");
    expect(scopeBrief({ basis: [RECOMMEND] })).toContain("recommend the basis that fits");
  });

  it("labels the chip briefly", () => {
    expect(scopeLabel({ client_type: "bank", outcomes: ["close", "recs"], kpis: [{ id: "a", name: "A" }, { id: "b", name: "B" }], basis: ["ifrs"], deliverables: ["html"] })).toBe("Bank · Faster close +1 · 2 KPIs · IFRS · HTML report");
  });

  it("reaches the lead with the request, and only when a scope was set", () => {
    expect(withTemplate({ prompt: "Which branches make money?", scope: { client_type: "credit_union" } })).toContain("- Client type: Credit union");
    expect(withTemplate({ prompt: "Which branches make money?" })).toBe("Which branches make money?");
  });
});

describe("KPI suggestions", () => {
  it("suggests KPIs for the chosen outcomes, every outcome has at least one, and benchmark keys exist", () => {
    for (const o of Object.keys(OUTCOMES).filter((k) => k !== RECOMMEND)) expect(suggestKpis([o]).length, o).toBeGreaterThan(0);
    expect(suggestKpis(["fpa"]).map((k) => k.id)).toContain("budget_accuracy");
    expect(suggestKpis([])).toEqual(KPI_LIBRARY);
    const keys = new Set(BENCHMARKS.map((b) => b.key));
    for (const k of KPI_LIBRARY) if (k.benchmark) expect(keys.has(k.benchmark), k.id).toBe(true);
  });

  it("adds several custom KPIs from one comma-separated list, without repeats", () => {
    expect(parseKpiList("Cost-to-income ratio, Days to sign off segment results;\nCost-to-income ratio, ")).toEqual(["Cost-to-income ratio", "Days to sign off segment results"]);
  });
});

describe("intake skip", () => {
  it("skips the intake for lookups and quick asks, and asks it for a piece of work", () => {
    expect(directAsk("Which Big 6 banks reported CET1 above 13% in Q3?")).toBe(true);
    expect(quickAsk("Give me a CSV of the APQC close benchmarks")).toBe(true);
    const study = "Our month-end takes 11 days and the board wants 5. Build a plan to get there.";
    expect(directAsk(study) || quickAsk(study)).toBe(false);
  });
});

describe("goal catalog", () => {
  it("offers nine goal types, each with at most two questions, and every question can recommend", async () => {
    const { GOAL_TYPES } = await import("../shared/goalTypes");
    expect(GOAL_TYPES.map((g) => g.id)).toEqual(["finance_transformation", "market_research", "business_development", "strategy", "accounting", "data_analysis", "technology", "discovery", "other"]);
    for (const g of GOAL_TYPES) {
      expect(g.questions.length, g.id).toBeLessThanOrEqual(2);
      for (const q of g.questions) expect(q.options[RECOMMEND], `${g.id}.${q.key}`).toBe("Not sure, recommend");
    }
  });

  it("accepts answers to the goal's own questions only", () => {
    expect(scopeSchema.safeParse({ goal: "market_research", goal_answers: { market: ["consulting", "banking"], need: ["players"] } }).success).toBe(true);
    expect(scopeSchema.safeParse({ goal: "market_research", goal_answers: { market: ["mining"] } }).success).toBe(false);
    expect(scopeSchema.safeParse({ goal: "market_research", goal_answers: { audience: ["board"] } }).success).toBe(false);
    expect(scopeSchema.safeParse({ goal: "strategy", goal_answers: { audience: ["board", "cfo"] } }).success).toBe(false);
    expect(scopeSchema.safeParse({ goal: "astrology" }).success).toBe(false);
  });

  it("puts the goal and its answers in the scope block, and a skipped question adds nothing", () => {
    const brief = scopeBrief({ goal: "market_research", goal_answers: { market: ["consulting"], need: [RECOMMEND] } });
    expect(brief).toContain("- Goal: Market and competitor research");
    expect(brief).toContain("- Which market: Consulting and advisory");
    expect(brief).toContain("- What do you need: not set; recommend what fits");
    expect(scopeBrief({ goal: "other" })).toContain("- Goal: Something else");
    expect(scopeLabel({ goal: "market_research", deliverables: ["deck"] })).toBe("Market and competitor research · HTML slide deck");
  });

  it("adds the discovery rules only for the discovery goal, and its evidence answer decides the knowledge base", async () => {
    const { discoveryUsesDocs } = await import("../shared/discovery");
    const brief = scopeBrief({ goal: "discovery", goal_answers: { mode: ["spec"], sources: ["none"] } });
    expect(brief).toContain("- Goal: Shape an idea into a brief");
    expect(brief).toContain("- What back: Specification");
    expect(brief).toContain("## Discovery: shape the idea before building anything");
    expect(brief).toContain("at most three related questions");
    expect(brief).toContain('"skip all"');
    expect(brief).toContain("no web research and no documents");
    expect(brief).toContain("until the client confirms the brief");
    expect(scopeBrief({ goal: "strategy" })).not.toContain("## Discovery");
    expect(scopeBrief({ goal: "discovery" })).toContain("Pick the evidence the idea needs");
    expect(discoveryUsesDocs({ goal: "discovery", goal_answers: { sources: ["docs"] } })).toBe(true);
    expect(discoveryUsesDocs({ goal: "discovery", goal_answers: { sources: ["both"] } })).toBe(true);
    expect(discoveryUsesDocs({ goal: "discovery", goal_answers: { sources: ["web"] } })).toBe(false);
    expect(discoveryUsesDocs({ goal: "data_analysis", goal_answers: { data: ["kb"] } })).toBe(false);
    expect(discoveryUsesDocs(undefined)).toBe(false);
  });
});
