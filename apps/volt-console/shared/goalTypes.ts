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
      { key: "market", label: "Which markets should the research cover?", multi: true, options: rec({ banking: "Banking", insurance: "Insurance", wealth: "Asset and wealth management", pensions: "Pensions", consulting: "Consulting and advisory", tech: "Finance technology" }) },
      { key: "need", label: "What should the research answer?", multi: true, options: rec({ size: "Market size and growth", players: "Who the competitors are", pricing: "Pricing and fees", buyers: "What buyers want", deals: "Recent deals and moves", regulation: "Regulatory change" }) },
    ],
  },
  {
    id: "business_development",
    label: "Business development",
    hint: "Targets, deals, proposals, pitches",
    questions: [
      { key: "stage", label: "Where is the opportunity today?", multi: false, options: rec({ targets: "Finding targets", qualify: "Qualifying a lead", proposal: "Writing the proposal", pitch: "Preparing the pitch", orals: "Orals or final defence" }) },
      { key: "client", label: "Who is the client?", multi: true, options: rec(CLIENT_TYPES) },
    ],
  },
  {
    id: "strategy",
    label: "Strategy and board advice",
    hint: "Options, recommendations, board papers",
    questions: [
      { key: "audience", label: "Who will read it?", multi: true, options: rec({ board: "Board", cfo: "CFO", exec: "Executive team", audit: "Audit committee", investors: "Investors", regulator: "Regulator" }) },
      { key: "form", label: "What decision should it support?", multi: false, options: rec({ options: "Choose between options", recommendation: "Approve a recommendation", risk: "Understand a risk", brief: "Be briefed on a topic" }) },
    ],
  },
  {
    id: "accounting",
    label: "Accounting or regulatory question",
    hint: "A treatment, a disclosure, a capital rule",
    questions: [
      { key: "basis", label: "Which reporting basis applies?", multi: true, options: { ...BASES } },
      { key: "topic", label: "Which topics does it touch?", multi: true, options: rec({ recognition: "Recognition and measurement", ecl: "Expected credit loss (IFRS 9)", insurance: "Insurance contracts (IFRS 17)", hedging: "Hedge accounting", consolidation: "Consolidation", leases: "Leases", disclosure: "Disclosure", capital: "Regulatory capital" }) },
    ],
  },
  {
    id: "data_analysis",
    label: "Data and analysis",
    hint: "Work on figures you have",
    questions: [
      { key: "data", label: "Which data should VOLT use?", multi: true, options: rec({ attached: "Files I attach", kb: "Knowledge base", public: "Public data" }) },
      { key: "output", label: "What do you want back?", multi: true, options: rec({ table: "Table", chart: "Chart", workbook: "Workbook", narrative: "Written findings" }) },
    ],
  },
  {
    id: "technology",
    label: "Technology or vendor selection",
    hint: "ERP, EPM, hub, data, AI",
    questions: [
      { key: "area", label: "Which part of the stack?", multi: true, options: rec({ erp: "ERP", epm: "EPM, close and consolidation", hub: "Accounting hub", data: "Data platform", ai: "AI and automation" }) },
      { key: "stage", label: "How far along is the decision?", multi: false, options: rec({ long: "Building a long list", short: "Comparing a short list", case: "Making the business case", plan: "Planning the implementation" }) },
    ],
  },
  {
    id: DISCOVERY,
    label: "Shape an idea into a brief",
    hint: "Outcome, scope and success measures before any build",
    questions: [
      { key: "mode", label: "What should VOLT hand back?", multi: false, options: rec(DISCOVERY_MODES) },
      { key: "sources", label: "Which evidence should it use?", multi: false, options: rec(DISCOVERY_SOURCES) },
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

/** The key under which the free-text answer to "Something else" is kept in Scope.other. */
export const OTHER_GOAL = "goal";

/**
 * "- Which markets should the research cover: Banking, Insurance" lines for the scope block. A recommend answer asks
 * VOLT to choose; an Other answer adds the client's own words.
 */
export function goalLines(goal: string | undefined, answers: Record<string, string[]> | undefined, other: Record<string, string> = {}): string[] {
  const g = goalType(goal);
  if (!g) return [];
  const lines = [`- Goal: ${g.label}`];
  if (other[OTHER_GOAL]?.trim()) lines.push(`- What the chat is for (client's words): ${other[OTHER_GOAL].trim()}`);
  for (const q of g.questions) {
    const a = answers?.[q.key] ?? [];
    const own = other[q.key]?.trim();
    const label = q.label.replace(/\?$/, "");
    if (a.includes(RECOMMEND)) lines.push(`- ${label}: not set; recommend what fits and say why in one line`);
    else if (a.length || own) lines.push(`- ${label}: ${[...a.map((o) => q.options[o]), ...(own ? [`${own} (client's words)`] : [])].join(", ")}`);
  }
  return lines;
}
