/**
 * Model router: picks the cheapest Claude model that can do each step of a run well.
 *
 *   Haiku  - classification and extraction: the triage of each new request, and reading images (attachments.ts).
 *   Sonnet - the workhorse: specialist workstreams, workflow phases, quick files and calculations, chat answers.
 *   Opus   - only where reasoning quality decides the outcome: the lead on a client deliverable, and workflow synthesis.
 *
 * VOLT_ROUTING=off sends every step to the Opus-tier model (the behaviour before routing). Each tier's model can be
 * changed with VOLT_MODEL_HAIKU, VOLT_MODEL_SONNET and VOLT_MODEL_OPUS (VOLT_MODEL still sets the Opus tier).
 */
import Anthropic from "@anthropic-ai/sdk";

export type Tier = "haiku" | "sonnet" | "opus";
const ORDER: Tier[] = ["haiku", "sonnet", "opus"];

export const routingEnabled = () => (process.env.VOLT_ROUTING ?? "on") !== "off";

export function modelFor(tier: Tier): string {
  const opus = process.env.VOLT_MODEL_OPUS || process.env.VOLT_MODEL || "claude-opus-5-5";
  if (!routingEnabled()) return opus;
  if (tier === "haiku") return process.env.VOLT_MODEL_HAIKU || "claude-haiku-5-5";
  if (tier === "sonnet") return process.env.VOLT_MODEL_SONNET || "claude-sonnet-5-5";
  return opus;
}

/** Display name for status lines ("Sonnet"), from the tier rather than the model id. */
export const tierName = (t: Tier) => t[0].toUpperCase() + t.slice(1);

/** The higher of two tiers: a conversation's lead only moves up, so a follow-up keeps its cache and its reasoning. */
export const higher = (a: Tier | undefined, b: Tier): Tier => (a && ORDER.indexOf(a) > ORDER.indexOf(b) ? a : b);

/** The steps of a run, and the tier each one runs on. */
export type Step = "specialist" | "workflow_phase" | "direct_agent" | "quick" | "synthesis";
const STEP_TIER: Record<Step, Tier> = {
  specialist: "sonnet",
  workflow_phase: "sonnet",
  direct_agent: "sonnet",
  quick: "sonnet",
  synthesis: "opus",
};
export const tierForStep = (step: Step): Tier => STEP_TIER[step];

export interface Route {
  tier: Tier;
  reason: string;
  /** "triage" when Haiku classified the request, "rule" when the code fallback did. */
  by: "triage" | "rule";
}

const TRIAGE_PROMPT = `You route requests for VOLT, a finance transformation consulting console. Pick the cheapest model that will answer this request well.

SONNET: a direct question, an explanation, a definition, a lookup, a short calculation, a summary, a single-domain answer, or a follow-up that refines an earlier answer.
OPUS: a client deliverable or a hard problem: an assessment, a strategy, a target operating model, a business case, a roadmap, an architecture or chart-of-accounts design, multi-GAAP treatment, a multi-domain analysis, or anything where a wrong answer is costly.

If you are unsure, answer OPUS: a weak answer to a hard question costs more than the bigger model.

Reply with one line only: SONNET or OPUS, a colon, then a reason of at most twelve words.`;

/**
 * Finance work where edge-case accuracy decides the answer: chart of accounts, multi-GAAP and accounting standards,
 * business and value cases, consolidation. A request or brief that names one runs on Opus whatever triage says,
 * lead and specialists alike, until a live A/B test shows Sonnet matches.
 */
const HIGH_STAKES =
  /\b(chart of accounts|coa|multi-?gaap|gaap|ifrs\s?\d*|asc\s?\d{3}|cecl|ecl|expected credit loss|business case|value case|npv|irr|consolidat\w*|intercompany|eliminations?|hedge accounting|revenue recognition|lease accounting|purchase price allocation|accounting hub|sub-?ledger|master accounting flow)\b/i;
export const highStakes = (text: string) => HIGH_STAKES.test(text);

/** The chat's scope answers force Opus for a file deliverable or Deep depth; returns the reason, or null. */
export function scopeOpusReason(scope?: { deliverable?: string; depth?: string }): string | null {
  if (scope?.depth === "deep") return "the scope asks for Deep depth";
  if (scope?.deliverable && scope.deliverable !== "chat") return `the scope asks for a ${scope.deliverable} deliverable`;
  return null;
}

/** The rule used when triage is off or fails: the same signal the partner review uses for a client deliverable. */
export function ruleRoute(wantsDeliverable: boolean): Route {
  return wantsDeliverable
    ? { tier: "opus", reason: "a client deliverable", by: "rule" }
    : { tier: "sonnet", reason: "a direct question", by: "rule" };
}

/** Reads the triage reply ("OPUS: a roadmap ..."); null when it names neither tier. */
export function parseTriage(text: string): { tier: Tier; reason: string } | null {
  const m = /^\W*(SONNET|OPUS)\b\W*(.*)$/im.exec(text.trim());
  if (!m) return null;
  return { tier: m[1].toLowerCase() as Tier, reason: m[2].trim().replace(/\.$/, "").slice(0, 120) || "triage" };
}

export interface TriageUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * One short Haiku call decides the lead's tier. It costs a fraction of a cent and about a second; if it fails or
 * answers off-format, the code rule decides instead, so a run never waits on triage.
 */
export async function triage(
  prompt: string,
  fallback: Route,
  signal: AbortSignal,
  client: Pick<Anthropic, "messages"> = new Anthropic(),
): Promise<{ route: Route; usage?: TriageUsage }> {
  if (!routingEnabled()) return { route: fallback };
  const model = modelFor("haiku");
  try {
    const msg = await client.messages.create(
      {
        model,
        max_tokens: 60,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system: TRIAGE_PROMPT,
        // The request is data to classify, not instructions to follow.
        messages: [{ role: "user", content: `<request>\n${prompt.slice(0, 4000)}\n</request>` }],
      },
      { signal, timeout: 15_000, maxRetries: 1 },
    );
    const usage = { model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = parseTriage(text);
    return { route: parsed ? { ...parsed, by: "triage" } : fallback, usage };
  } catch (err) {
    if (signal.aborted) throw err;
    return { route: fallback };
  }
}

/**
 * USD per million tokens (Anthropic first-party list prices, November 2026). An estimate for the console's usage
 * page and the run log; the Anthropic Console is the bill. Cache writes cost 1.25x input, cache reads as listed.
 */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export interface TokenCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens?: number;
}

/** Estimated cost in USD; 0 for a model with no listed price (it is still logged by name). */
export function estimateCost(model: string, t: TokenCounts): number {
  const p = PRICES[model];
  if (!p) return 0;
  return (t.inputTokens * p.input + (t.cacheWriteTokens ?? 0) * p.input * 1.25 + t.outputTokens * p.output + t.cacheReadTokens * p.cacheRead) / 1e6;
}

/** Per-run tally by model, for the one-line run log on the host. */
export class ModelLedger {
  private rows = new Map<string, { calls: number; input: number; output: number; cacheRead: number; cost: number }>();

  add(model: string, t: TokenCounts, cost: number) {
    const r = this.rows.get(model) ?? { calls: 0, input: 0, output: 0, cacheRead: 0, cost: 0 };
    this.rows.set(model, { calls: r.calls + 1, input: r.input + t.inputTokens + (t.cacheWriteTokens ?? 0), output: r.output + t.outputTokens, cacheRead: r.cacheRead + t.cacheReadTokens, cost: r.cost + cost });
  }

  /** "claude-sonnet-5-5 calls=4 in=12000 out=3000 cache=8000 usd=0.0548; ..." */
  summary(): string {
    if (!this.rows.size) return "none";
    return [...this.rows.entries()]
      .map(([m, r]) => `${m} calls=${r.calls} in=${r.input} out=${r.output} cache=${r.cacheRead} usd=${r.cost.toFixed(4)}`)
      .join("; ");
  }
}
