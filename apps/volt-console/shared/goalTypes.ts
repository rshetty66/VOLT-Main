/**
 * The goal catalog: what kind of work the chat is for. Finance transformation keeps its outcomes and KPIs
 * (shared/scope.ts); every other goal asks at most two short questions of its own. Every question can be skipped, and
 * each offers "Not sure, recommend".
 */
import { BASES, CLIENT_TYPES, RECOMMEND } from "./scope-options.js";
import { DISCOVERY, DISCOVERY_MODES, DISCOVERY_SOURCES } from "./discovery.js";

export interface GoalQuestion {
  key: string;
  label: string;
  options: Record<string, string>;
  /** Several answers allowed. */
  multi: boolean;
}

export interface GoalType {
  id: string;
  label: string;
  hint: string;
  questions: GoalQuestion[];
}

const rec = (o: Record<string, string>) => ({ ...o, [RECOMMEND]: "Not sure, recommend" });

export const GOAL_TYPES: GoalType[] = [
  { id: "finance_transformation", label: "Finance transformation", hint: "Close, reporting, FP&A, CoA, operating model", questions: [] },
  {
    id: "market_research",
    label: "Market and competitor research",
    hint: "A market, its players, prices and deals",
    questions: [
      { key: "market", label: "Which market?", multi: true, options: rec({ consulting: "Consulting and advisory", banking: "Banking", insurance: "Insurance", wealth: "Asset and wealth", pensions: "Pensions", tech: "Finance technology" }) },
      { key: "need", label: "What do you need?", multi: true, options: rec({ size: "Size and growth", players: "Competitor landscape", pricing: "Pricing and fees", buyers: "Buyer needs", deals: "Recent deals" }) },
    ],
  },
  {
    id: "business_development",
    label: "Business development",
    hint: "Targets, deals, proposals, pitches",
    questions: [
      { key: "stage", label: "Which stage?", multi: false, options: rec({ targets: "Find targets", qualify: "Qualify a deal", proposal: "Write a proposal", pitch: "Prepare a pitch" }) },
      { key: "client", label: "For which client?", multi: false, options: rec(CLIENT_TYPES) },
    ],
  },
  {
    id: "strategy",
    label: "Strategy and board advice",
    hint: "Options, recommendations, board papers",
    questions: [
      { key: "audience", label: "Who is it for?", multi: false, options: rec({ board: "Board", cfo: "CFO", exec: "Executive team", investors: "Investors" }) },
      { key: "form", label: "What form?", multi: false, options: rec({ options: "Options paper", recommendation: "Recommendation", risk: "Risk view", brief: "One-page brief" }) },
    ],
  },
  {
    id: "accounting",
    label: "Accounting or regulatory question",
    hint: "A treatment, a disclosure, a capital rule",
    questions: [
      { key: "basis", label: "Which basis?", multi: true, options: { ...BASES } },
      { key: "topic", label: "Topic", multi: false, options: rec({ recognition: "Recognition and measurement", disclosure: "Disclosure", capital: "Regulatory capital", consolidation: "Consolidation", hedging: "Hedging", leases: "Leases" }) },
    ],
  },
  {
    id: "data_analysis",
    label: "Data and analysis",
    hint: "Work on figures you have",
    questions: [
      { key: "data", label: "Which data?", multi: true, options: rec({ attached: "Files I attach", kb: "Knowledge base", public: "Public data" }) },
      { key: "output", label: "What back?", multi: true, options: rec({ table: "Table", chart: "Chart", workbook: "Workbook", narrative: "Narrative" }) },
    ],
  },
  {
    id: "technology",
    label: "Technology or vendor selection",
    hint: "ERP, EPM, hub, data, AI",
    questions: [
      { key: "area", label: "Which area?", multi: true, options: rec({ erp: "ERP", epm: "EPM and close", hub: "Accounting hub", data: "Data platform", ai: "AI and automation" }) },
      { key: "stage", label: "Which stage?", multi: false, options: rec({ long: "Long list", short: "Short list", case: "Business case", plan: "Implementation plan" }) },
    ],
  },
  {
    id: DISCOVERY,
    label: "Shape an idea into a brief",
    hint: "Outcome, scope and success measures before any build",
    questions: [
      { key: "mode", label: "What back?", multi: false, options: rec(DISCOVERY_MODES) },
      { key: "sources", label: "Which evidence?", multi: false, options: rec(DISCOVERY_SOURCES) },
    ],
  },
  { id: "other", label: "Something else", hint: "Say it in your own words", questions: [] },
];

export const GOAL_IDS = GOAL_TYPES.map((g) => g.id) as [string, ...string[]];
export const goalType = (id: string | undefined) => GOAL_TYPES.find((g) => g.id === id);

/** True when every answer names a question of the goal and an option of that question. */
export function validGoalAnswers(goal: string | undefined, answers: Record<string, string[]> | undefined): boolean {
  if (!answers) return true;
  const g = goalType(goal);
  if (!g) return Object.keys(answers).length === 0;
  return Object.entries(answers).every(([k, v]) => {
    const q = g.questions.find((x) => x.key === k);
    return !!q && (q.multi || v.length <= 1) && v.every((o) => o in q.options);
  });
}

/** "- Which market?: Banking, Insurance" lines for the scope block; a recommend answer asks VOLT to choose. */
export function goalLines(goal: string | undefined, answers: Record<string, string[]> | undefined): string[] {
  const g = goalType(goal);
  if (!g) return [];
  const lines = [`- Goal: ${g.label}`];
  for (const q of g.questions) {
    const a = answers?.[q.key] ?? [];
    if (!a.length) continue;
    const label = q.label.replace(/\?$/, "");
    lines.push(a.includes(RECOMMEND) ? `- ${label}: not set; recommend what fits and say why in one line` : `- ${label}: ${a.map((o) => q.options[o]).join(", ")}`);
  }
  return lines;
}
