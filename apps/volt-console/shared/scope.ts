/**
 * The intake: asked once at the start of a chat, before VOLT does any work, in up to three short rounds that follow
 * the discovery order (the goal, how success is measured, what comes back). A lookup or a quick ask skips it
 * (shared/asks.ts).
 *
 * Nothing is preselected, so no default steers the answer, and most questions take several answers. Every round can
 * be skipped, and "Not sure, recommend" lets VOLT pick and say why. The answers travel with every message in the chat
 * and are added to the brief as one scope block.
 */
import { z } from "zod";

import { BASES, CLIENT_TYPES, RECOMMEND } from "./scope-options.js";
import { GOAL_IDS, goalLines, goalType, validGoalAnswers } from "./goalTypes.js";
import { DISCOVERY, discoveryRules } from "./discovery.js";

export { BASES, CLIENT_TYPES, RECOMMEND };

/** Outcomes, grouped for the intake card. Up to MAX_OUTCOMES may be picked. */
export const OUTCOME_GROUPS = [
  { label: "Close and report", options: { close: "Faster close", close_quality: "Fewer late adjustments", recs: "Automate reconciliations", reg: "Regulatory and statutory reporting" } },
  { label: "Performance", options: { segment_profitability: "Segment and product profitability", fpa: "Better forecasting (FP&A)", cost: "Lower cost of finance", ops_reports: "Ops and management reports" } },
  { label: "Foundations", options: { coa_design: "CoA and ledger design", multi_gaap: "Multi-GAAP treatments", lineage: "GL-to-instrument lineage", controls: "Controls and audit readiness" } },
  { label: "Transformation", options: { tom: "Target operating model", erp_epm: "ERP or EPM selection", ai: "AI and automation in finance", advisory: "Business case and roadmap" } },
] as const;

export const DELIVERABLES: Record<string, string> = { chat: "Answer in chat", html: "HTML report", deck: "HTML slide deck", pptx: "PowerPoint deck", docx: "Word document", xlsx: "Excel workbook" };
export const DEPTHS: Record<string, string> = { quick: "Quick answer", standard: "Standard", deep: "Deep dive with evidence", [RECOMMEND]: "Not sure, recommend" };

export const MAX_OUTCOMES = 3;
export const MAX_KPIS = 12;

export const OUTCOMES: Record<string, string> = Object.assign({ [RECOMMEND]: "Not sure, recommend" }, ...OUTCOME_GROUPS.map((g) => g.options));

const keys = (o: object) => z.enum(Object.keys(o) as [string, ...string[]]);
const short = (n: number) => z.string().trim().max(n);

/** One success measure: today, the target and the date, each optional ("unknown" is a blank). */
export const kpiSchema = z
  .object({
    id: short(80).min(1),
    name: short(80).min(1),
    unit: short(24).optional(),
    /** The apqc_benchmark key, when the KPI has a built-in benchmark (shared/kpis.ts). */
    benchmark: short(60).optional(),
    baseline: short(40).optional(),
    target: short(40).optional(),
    by: short(20).optional(),
  })
  .strict();
export type Kpi = z.infer<typeof kpiSchema>;

export const scopeSchema = z
  .object({
    /** The kind of work (shared/goalTypes.ts) and the answers to that goal's own questions. */
    goal: z.enum(GOAL_IDS).optional(),
    goal_answers: z.record(short(40), z.array(short(40)).max(8)).optional(),
    client_type: keys(CLIENT_TYPES).optional(),
    outcomes: z.array(keys(OUTCOMES)).max(MAX_OUTCOMES).optional(),
    problem: short(300).optional(),
    kpis: z.array(kpiSchema).max(MAX_KPIS).optional(),
    basis: z.array(keys(BASES)).max(Object.keys(BASES).length).optional(),
    deliverables: z.array(keys(DELIVERABLES)).max(Object.keys(DELIVERABLES).length).optional(),
    depth: keys(DEPTHS).optional(),
  })
  .strict()
  .refine((s) => validGoalAnswers(s.goal, s.goal_answers), { message: "Unknown goal answer", path: ["goal_answers"] });

export type Scope = z.infer<typeof scopeSchema>;

const names = (list: readonly string[] | undefined, labels: Record<string, string>) => (list ?? []).map((k) => labels[k]).filter(Boolean);
const more = (list: string[]) => (list.length > 1 ? `${list[0]} +${list.length - 1}` : list[0]);

/** "Bank · Faster close +1 · 3 KPIs · IFRS · HTML report", for the chip that shows the chat's scope. */
export function scopeLabel(scope: Scope): string {
  const kpis = scope.kpis?.length ?? 0;
  return [
    scope.goal && scope.goal !== "finance_transformation" ? goalType(scope.goal)?.label : undefined,
    scope.client_type && CLIENT_TYPES[scope.client_type],
    more(names(scope.outcomes, OUTCOMES)),
    kpis ? `${kpis} KPI${kpis === 1 ? "" : "s"}` : undefined,
    more(names(scope.basis, BASES)),
    more(names(scope.deliverables, DELIVERABLES)),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "Days to close the books (days): today 11, target 5 by 2027-Q2", with "unknown" for any blank. */
export function kpiLine(k: Kpi): string {
  const unit = k.unit ? ` (${k.unit})` : "";
  return `${k.name}${unit}: today ${k.baseline || "unknown"}, target ${k.target || "unknown"}${k.by ? ` by ${k.by}` : ""}`;
}

const DEPTH: Record<string, string> = {
  quick: "Keep the answer short: the direct answer and the few points that matter, no appendices.",
  standard: "Give a complete but focused answer.",
  deep: "Go deep: cite the evidence for each claim and show the working.",
  [RECOMMEND]: "Pick the depth the request needs and say which in one line.",
};

const FILE: Record<string, string> = { html: "an HTML report", deck: "an HTML slide deck", pptx: "a PowerPoint deck", docx: "a Word document", xlsx: "an Excel workbook" };

/** The scope block added to the brief. Stay inside it; it replaces the questions it answers. */
export function scopeBrief(scope: Scope): string {
  const lines: string[] = goalLines(scope.goal, scope.goal_answers);
  if (scope.client_type) lines.push(`- Client type: ${CLIENT_TYPES[scope.client_type]}`);
  const outcomes = scope.outcomes ?? [];
  if (outcomes.includes(RECOMMEND)) lines.push("- Outcome: not set by the client; recommend the outcome that fits the request and say why in one line");
  else if (outcomes.length) lines.push(`- Outcomes: ${names(outcomes, OUTCOMES).join("; ")}`);
  if (scope.problem) lines.push(`- What is not working today (client's words): ${scope.problem}`);
  if (scope.kpis?.length) lines.push(`- Success measures:\n${scope.kpis.map((k) => `  - ${kpiLine(k)}`).join("\n")}`);
  const basis = scope.basis ?? [];
  if (basis.length) lines.push(`- Reporting basis: ${basis.includes(RECOMMEND) ? "not set; recommend the basis that fits and say why" : names(basis, BASES).join(", ")}`);
  const files = (scope.deliverables ?? []).flatMap((d) => (FILE[d] ? [FILE[d]] : []));
  if (scope.deliverables?.length) lines.push(`- Deliverable: ${names(scope.deliverables, DELIVERABLES).join(", ")}`);
  if (scope.depth) lines.push(`- Depth: ${DEPTHS[scope.depth]}`);
  if (!lines.length) return "";
  const kpiRule = scope.kpis?.length
    ? " Tie the answer to the success measures: say how each one moves and by when. A blank figure is unknown: say so and how to measure it, and never invent a baseline or a target. For a measure with a built-in benchmark, call apqc_benchmark with the client's figure when it is known."
    : "";
  const depth = scope.depth ? ` ${DEPTH[scope.depth]}` : "";
  const file = files.length ? ` When the message asks for work, deliver the result as ${files.join(" and ")} made with create_file.` : "";
  const discovery = scope.goal === DISCOVERY ? `\n\n${discoveryRules(scope.goal_answers)}` : "";
  return `## Scope the client set for this chat\n${lines.join("\n")}\nKeep the work inside this scope and do not ask again for anything it answers. If the request clearly falls outside it, say so in one line and go on with the request. The scope is context, not the task: a direct question or a lookup gets a direct answer to what it asks, never a deliverable on the outcomes above.${kpiRule}${depth}${file}${discovery}`;
}
