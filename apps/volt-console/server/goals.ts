/**
 * Goal planner for the VOLT chat: turns a finance outcome the client states in their own words into a plan over the
 * ledger tools.
 *
 * The lead model works out which goal the client means (from meaning, not keywords) and calls plan_finance_goal with
 * the goal and what the conversation already gives. The planner is deterministic: it returns the steps in order, the
 * inputs still missing (as the questions to ask), and what the brain cannot do yet, so the chat asks only for what is
 * needed and never promises a capability that is not built.
 */
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";

type InputId = "trial_balance" | "client" | "period" | "allocation_basis";

/** What each input is, and the one question that asks for it. */
const INPUTS: Record<InputId, { ask: string; optional?: string }> = {
  trial_balance: { ask: "Please attach the trial balance as CSV or XLSX, one row per account, with entity, cost centre, business line and product columns if you have them." },
  client: { ask: "What short name should I use for the client (for example SYNBANK)?" },
  period: { ask: "Which period end is this, as YYYY-MM?" },
  allocation_basis: {
    ask: "Should shared costs reach business lines by FTE, transaction count or risk-weighted assets?",
    optional: "Without it the result is direct profitability only, before shared costs.",
  },
};

interface Step { tool: string; does: string; needs?: InputId[] }
interface Goal { outcome: string; means: string; inputs: InputId[]; steps: Step[]; deliverable: string; not_yet: string[] }

const LOAD: Step[] = [
  { tool: "ledger_ingest_upload", does: "Load the trial balance", needs: ["trial_balance", "client", "period"] },
  { tool: "ledger_list_accounts", does: "List the accounts and their current mappings" },
];
const MAP: Step[] = [
  { tool: "ledger_get_ontology_context", does: "Look up the canonical concepts" },
  { tool: "ledger_map_line_items", does: "Map every account to a concept in one call; flag policy gaps instead of forcing a mapping" },
  { tool: "ledger_coverage", does: "Confirm every account is mapped or has a gap" },
];

export const GOALS = {
  design_coa: {
    outcome: "A target chart of accounts and ledger design that gives IFRS, US GAAP, statutory and management views from one structure.",
    means: "The client wants a chart designed, redesigned, rationalised, harmonised after a merger, or diagnosed.",
    inputs: ["trial_balance", "client", "period"],
    steps: [...LOAD, ...MAP,
      { tool: "ledger_diagnose_coa", does: "Diagnose the current chart" },
      { tool: "ledger_check_coa_design", does: "Check the whole target design; fix only failed checks" },
      { tool: "ledger_propose_coa_design", does: "Propose the design and its decisions for review" },
      { tool: "ledger_propose_coa_mapping", does: "Map every legacy account to the new chart and tie out" },
      { tool: "ledger_data_requirements", does: "Derive the data each new account needs from source systems" },
      { tool: "ledger_run_exam", does: "Score the result against the bank pack's answer keys" }],
    deliverable: "CoA design pack: diagnosis, segments and ranges, hierarchy, coverage, mapping and tie-out, decision log, data requirements.",
    not_yet: ["Knowledge packs for industries other than banking (an insurer pack is planned)."],
  },
  close_faster: {
    outcome: "A shorter, controlled close: balances tied to their instruments, exceptions and adjustments owned and reviewed, statements straight from the ledger.",
    means: "The close takes too long, reconciliations are manual, or the client wants fewer late adjustments.",
    inputs: ["trial_balance", "client", "period"],
    steps: [...LOAD, ...MAP,
      { tool: "ledger_load_information_model", does: "Load the finance information model" },
      { tool: "ledger_trace_gl_balance", does: "Tie key balances to instruments and journals; explain every break" },
      { tool: "ledger_propose_adjustment", does: "Propose instrument-level or GL-level adjustments only where a break needs one (they go to review)" },
      { tool: "ledger_build_statement", does: "Produce the balance sheet and income statement from the ledger" }],
    deliverable: "Close readiness view: unmapped accounts, tie-out status per balance, open adjustments awaiting review, statements, and the steps that shorten the close.",
    not_yet: ["A close calendar with tasks, owners and day-by-day tracking.",
      "Period-on-period flux analysis (one period is loaded at a time today).",
      "The client's own instrument data: lineage runs on the synthetic bank dataset until it is loaded."],
  },
  driver_based_fpa: {
    outcome: "Plans and forecasts built from business drivers rather than last year plus a percentage.",
    means: "The client wants a driver-based budget, forecast or rolling plan, or to know which drivers move results.",
    inputs: ["trial_balance", "client", "period"],
    steps: [...LOAD, ...MAP,
      { tool: "ledger_list_metrics", does: "List the KPIs the ledger can compute" },
      { tool: "ledger_compute_ratio", does: "Compute the baseline KPIs the drivers will move" },
      { tool: "ledger_get_balances", does: "Baseline balances by business line and product" },
      { tool: "ledger_propose_allocation_rule", does: "Propose driver-based cost rules (driver values are entered by people)" }],
    deliverable: "Driver baseline: current KPIs and balances by segment, the drivers behind them, and the driver data still needed.",
    not_yet: ["Driver models, forecasts and scenarios (plan phase 4).", "Plan versus actual variance."],
  },
  segment_profitability: {
    outcome: "Profit by business line and product, with direct income traced to contracts and shared costs allocated by approved drivers.",
    means: "The client asks which businesses, products or branches make money, or wants segment reporting.",
    inputs: ["trial_balance", "client", "period", "allocation_basis"],
    steps: [...LOAD, ...MAP,
      { tool: "ledger_get_balances", does: "Direct income and cost by business line" },
      { tool: "ledger_load_information_model", does: "Load the finance information model" },
      { tool: "ledger_trace_gl_balance", does: "Trace segment income to the contracts behind it" },
      { tool: "ledger_propose_allocation_rule", does: "Propose the shared-cost rule on the chosen driver", needs: ["allocation_basis"] },
      { tool: "ledger_run_allocation", does: "Run it once the rule is approved and driver values are entered", needs: ["allocation_basis"] },
      { tool: "ledger_compute_ratio", does: "Business-line metrics, including allocations" }],
    deliverable: "Segment P&L by business line: direct result, allocated costs, fully loaded result and metrics, each cited.",
    not_yet: ["Funds transfer pricing and capital charges."],
  },
  finance_ops_reports: {
    outcome: "Standard finance operations reports from the ledger: statements, KPIs, data quality and the review backlog.",
    means: "The client wants a monthly pack, management reports, a KPI scorecard or a data quality view.",
    inputs: ["trial_balance", "client", "period"],
    steps: [...LOAD, ...MAP,
      { tool: "ledger_build_statement", does: "Balance sheet and income statement" },
      { tool: "ledger_list_metrics", does: "List the KPIs available" },
      { tool: "ledger_compute_ratio", does: "Compute the KPIs for the pack" },
      { tool: "ledger_run_exam", does: "Data quality scorecard: mapping, gaps and tie-out" }],
    deliverable: "Finance operations pack: statements, KPI table, data quality scorecard and items awaiting review.",
    not_yet: ["Scheduled report packs and distribution."],
  },
  finance_data_model: {
    outcome: "The finance data requirements and information model: what source data each account needs, and lineage from GL balance to instrument with adjustments at both levels.",
    means: "The client asks what data finance needs from source systems, how a balance is built up, or for lineage.",
    inputs: [],
    steps: [
      { tool: "ledger_load_information_model", does: "Load the finance information model" },
      { tool: "ledger_data_requirements", does: "Build the data requirements register for the chart" },
      { tool: "ledger_trace_gl_balance", does: "Show lineage for representative balances" },
      { tool: "ledger_instrument_summary", does: "Show one instrument end to end" }],
    deliverable: "Data requirements register and lineage walk-through, each cited.",
    not_yet: ["The client's own instrument data: the model runs on the synthetic bank dataset until it is loaded."],
  },
  multi_gaap: {
    outcome: "Treatments that differ between IFRS, US GAAP and local GAAP, kept as delta ledgers on an IFRS primary ledger.",
    means: "The client reports under more than one GAAP or asks how a treatment differs between them.",
    inputs: ["trial_balance", "client", "period"],
    steps: [...LOAD, ...MAP,
      { tool: "ledger_flag_policy_gap", does: "Flag each treatment that needs a policy decision per GAAP" },
      { tool: "ledger_build_statement", does: "Build the statements under IFRS and US GAAP" }],
    deliverable: "Multi-GAAP view: statements under each GAAP and the open policy decisions.",
    not_yet: ["Delta ledgers and treatment rules per GAAP (plan phase 2)."],
  },
} satisfies Record<string, Goal>;

export type GoalId = keyof typeof GOALS;
const GOAL_IDS = Object.keys(GOALS) as [GoalId, ...GoalId[]];

export const planSchema = z.object({
  goals: z.array(z.enum(GOAL_IDS)).min(1).max(3).describe("The outcome(s) the client is after, in priority order."),
  in_client_words: z.string().max(400).describe("The client's goal as they put it."),
  known: z.object({
    doc_id: z.string().optional().describe("A trial balance already loaded, e.g. D0001."),
    upload_id: z.string().optional().describe("An attached CSV or XLSX trial balance, from the attachment list."),
    client: z.string().optional(),
    period: z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/).optional(),
    allocation_basis: z.enum(["fte", "transaction_count", "rwa"]).optional(),
  }).default({}).describe("Everything the conversation already gives. Never ask again for anything here."),
});

export const PLAN_TOOL = "plan_finance_goal";

export function goalToolDefs(): Anthropic.Beta.BetaTool[] {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(planSchema) as Record<string, unknown>;
  const list = (Object.entries(GOALS) as [GoalId, Goal][]).map(([id, g]) => `${id}: ${g.means}`).join(" ");
  return [{
    name: PLAN_TOOL,
    description: `Plan the work for a finance goal before using the ledger tools. Goals: ${list} Returns the steps in order, the questions to ask for inputs that are missing, and what cannot be done yet.`,
    input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
  }];
}

export type Plan = {
  goals: { goal: GoalId; outcome: string; steps: { n: number; tool: string; does: string; status: "done" | "ready" | "waits" }[]; deliverable: string; not_yet: string[] }[];
  ask: { input: InputId; question: string; if_skipped?: string }[];
  next: "ask" | "execute";
  instruction: string;
};

export function planGoal(input: unknown): { ok: true; plan: Plan } | { ok: false; error: string } {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: `Invalid input for ${PLAN_TOOL}: ${parsed.error.message}` };
  const { goals, known } = parsed.data;
  const have = new Set<InputId>();
  if (known.doc_id || known.upload_id) have.add("trial_balance");
  if (known.client) have.add("client");
  if (known.period) have.add("period");
  if (known.allocation_basis) have.add("allocation_basis");
  // A loaded trial balance already carries its client and period.
  if (known.doc_id) { have.add("client"); have.add("period"); }

  const missing = new Set<InputId>();
  const out = goals.map((goal) => {
    const g: Goal = GOALS[goal];
    for (const i of g.inputs) if (!have.has(i)) missing.add(i);
    const steps = g.steps.map((s, k) => ({
      n: k + 1,
      tool: s.tool,
      does: s.does,
      status: (s.tool === "ledger_ingest_upload" && known.doc_id ? "done" : (s.needs ?? []).every((i) => have.has(i)) ? "ready" : "waits") as "done" | "ready" | "waits",
    }));
    return { goal, outcome: g.outcome, steps, deliverable: g.deliverable, not_yet: g.not_yet };
  });
  const ask = [...missing].map((i) => ({ input: i, question: INPUTS[i].ask, ...(INPUTS[i].optional ? { if_skipped: INPUTS[i].optional } : {}) }));
  const required = ask.filter((a) => !a.if_skipped);
  const next = required.length ? "ask" : "execute";
  const instruction = next === "ask"
    ? `Ask the client only these ${ask.length} question${ask.length > 1 ? "s" : ""}, together in one short message, say in one line what you will do once you have them, then stop. Ask nothing else.`
    : `Run the ready steps in order${ask.length ? ", note what the optional input would add" : ""}, skip steps that wait on an input, say plainly what is not built yet, and deliver: ${out.map((o) => o.deliverable).join(" ")}`;
  return { ok: true, plan: { goals: out, ask, next, instruction } };
}

/** The part of the lead's system prompt that makes the chat work from goals, not keywords. */
export const GOAL_GUIDE = `## Work from the client's goal
People state outcomes in their own words ("we take twelve days to close", "which branches make money", "our chart is a mess after the merger", "what data do we need from the loan system"). Work out the outcome behind the words; do not wait for a keyword or a command. The finance goals the ledger brain serves are design_coa, close_faster, driver_based_fpa, segment_profitability, finance_ops_reports, finance_data_model and multi_gaap (the plan_finance_goal tool describes each).
When a request is about one of these outcomes:
1. Call plan_finance_goal first, with the goal (up to three, most important first) and everything the conversation already gives: attached upload ids, loaded doc ids, client name, period, allocation driver.
2. If its "next" is "ask", ask only the questions it returns, together in one short message, and stop. Do not ask for anything it does not list, and never ask again for something the conversation gives.
3. If "next" is "execute", run the ready steps in order, then deliver what it names. Say plainly what is in "not_yet" instead of approximating it.
If the request is about a finance outcome but does not say which, take the goal from the chat's scope; a question about documents or facts (a lookup, a list) is not a goal, so answer it without a plan, whatever the scope's outcome. If the goal is unclear between two outcomes, pick the likelier one, say which you chose, and go on. Advisory questions with no ledger work (a roadmap, a vendor choice) need no plan.`;
