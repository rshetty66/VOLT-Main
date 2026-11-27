/**
 * The discovery goal: turn an early idea into a small, evidence-based brief before any deliverable is built. The
 * same workflow as the repo's /discover-outcome command (.claude/commands/discover-outcome.md), cut to what a chat
 * needs. Its two intake questions live in goalTypes.ts; the rules below join the scope block when the goal is picked.
 */
import { RECOMMEND } from "./scope-options.js";

export const DISCOVERY = "discovery";

export const DISCOVERY_MODES = { brief: "Discovery brief", spec: "Specification", plan: "Delivery plan", research: "Research answer" };
export const DISCOVERY_SOURCES = { docs: "Project documents", web: "Web research", both: "Both", none: "Only what I tell you" };

type Answers = Record<string, string[]> | undefined;

/** True when the client picked the project's documents as evidence, so the knowledge base is searched. */
export function discoveryUsesDocs(scope: { goal?: string; goal_answers?: Answers } | undefined): boolean {
  const s = scope?.goal === DISCOVERY ? (scope.goal_answers?.sources ?? []) : [];
  return s.includes("docs") || s.includes("both");
}

const SOURCE_RULE: Record<string, string> = {
  docs: "Use the project's documents as evidence; do not search the web.",
  web: "Use web research only to answer the decision the client names; if no decision is named, ask which decision it should support before searching.",
  both: "Use the project's documents first, then web research only for the decision the client names; if no decision is named, ask which one before searching.",
  none: "Use only what the client tells you in this chat: no web research and no documents.",
  [RECOMMEND]: "Pick the evidence the idea needs (project documents, web research or none) and say why in one line.",
};

/** The discovery rules added to the scope block. */
export function discoveryRules(answers: Answers): string {
  const sources = answers?.sources ?? [];
  const source = sources.length ? sources.map((s) => SOURCE_RULE[s]).filter(Boolean).join(" ") : SOURCE_RULE[RECOMMEND];
  return `## Discovery: shape the idea before building anything
- Restate the request in one sentence as the business outcome it should produce, not as a feature.
- Ask only questions whose answer changes the scope, priority, success measures or risk treatment, and never ask for what the chat or the scope already says. Ask at most three related questions in a turn, as a numbered list with answer choices and a "Not sure, recommend" choice, then stop and wait. Use each answer to pick the next question; stop by round eight, or sooner once the key decisions are clear.
- The client can answer "skip" to a question, or "skip all" to go straight to the brief: carry each gap forward as unknown.
- Cover, as far as they change the work: the problem today and its evidence; who has it and the workflow where it breaks; the outcome, with baseline, target, date and how it is measured; the smallest first release (Must, Should, Could, Not now) and what is out of scope; constraints and risks, including the accountable control owner for a regulated workflow. Never infer a regulatory obligation from the industry alone.
- ${source}
- Keep facts, client decisions, evidence, assumptions and recommendations apart. Never invent a metric, baseline, market figure, requirement or system: write "unknown" and how it could be measured.
- Before the output, give a short recap: problem, users, outcome, success measures, evidence, constraints, first-release scope and non-goals, open decisions. Recommend the smallest step that tests the main value; if a full build is not yet justified, say what simpler check would be.
- Then produce only the output the mode names. Discovery brief: executive summary; problem and evidence; users and workflow; outcomes and measurable success criteria; first-release scope, priorities and non-goals; requirements as observable behaviours; constraints, risks and controls; assumptions and open decisions with owners; evidence with source keys; next step and the approval it needs. Specification adds use cases with testable acceptance criteria, edge cases, permissions, error states and data needs, each tied to an outcome. Delivery plan maps the agreed scope to steps, dependencies and how each is verified. Research answer answers the stated decision only, with an evidence table and its gaps.
- Check before sending: every requirement serves an outcome or a control, every measure has a source or says unknown, and no acceptance criterion says "fast", "secure" or "user-friendly" without a number.
- Do not build a deliverable, create a file or start the work until the client confirms the brief. End with "Discovery brief ready. Confirm it and I can prepare the plan.", "Plan ready. Confirm it and I can start the agreed scope." or "I need your decision on: ..."`;
}
