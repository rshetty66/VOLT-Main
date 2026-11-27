/**
 * Providers beyond Claude. GPT (OpenAI) and Grok (xAI) both speak the Responses API, so one adapter
 * (responsesLoop.ts) serves them. They run SPECIALIST workstreams only: the lead keeps the Claude conversation
 * (its session, prompt cache, web citations and partner review are Claude features), and high-stakes finance
 * briefs stay on Opus until a live A/B test shows otherwise.
 *
 *   OPENAI_API_KEY  enables GPT     VOLT_MODEL_GPT       (default gpt-6.2-sol)
 *   XAI_API_KEY     enables Grok    VOLT_MODEL_GROK      (default grok-4.3)
 *                                   VOLT_MODEL_GROK_CODE (default grok-code-fast-1)
 */
export type Provider = "anthropic" | "openai" | "xai";
export type Engine = "claude" | "auto" | "gpt" | "grok";
export const ENGINES: readonly Engine[] = ["claude", "auto", "gpt", "grok"];

export const providerOf = (model: string): Provider => (/^grok/i.test(model) ? "xai" : /^(gpt|o\d|chatgpt)/i.test(model) ? "openai" : "anthropic");

export const BASE_URL: Record<"openai" | "xai", string> = {
  openai: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  xai: process.env.XAI_BASE_URL || "https://api.x.ai/v1",
};
export const keyFor = (p: "openai" | "xai") => (p === "openai" ? process.env.OPENAI_API_KEY : process.env.XAI_API_KEY) || "";

/** Which non-Claude providers have a key, for the console's engine selector. */
export const availableProviders = () => ({ gpt: !!keyFor("openai"), grok: !!keyFor("xai") });

/**
 * Model health, in memory. Two states:
 *  - permanent: 401/403/404, or a 400 that says the model id is invalid or retired. Skipped for the process lifetime.
 *  - cooldown: 429 or 5xx. Skipped for COOLDOWN_MS, so a burst of specialists goes to the next usable engine
 *    instead of each one waiting on a provider that is throttling or down.
 */
export const COOLDOWN_MS = 60_000;
const PERMANENT = Number.POSITIVE_INFINITY;
const health = new Map<string, number>(); // model -> epoch ms until which it is skipped
let clock = () => Date.now();
/** Test hook: replace the clock. */
export const setClock = (fn: () => number) => void (clock = fn);

export type Failure = "permanent" | "cooldown" | null;
const BAD_MODEL = /(model|deprecat|retired|not found|does not exist|unknown|invalid|unsupported|not supported|no access)/i;
/** How a provider status (and message, for a 400) should affect the model's health; null when it should not. */
export function classifyFailure(status: number, message = ""): Failure {
  if (status === 401 || status === 403 || status === 404) return "permanent";
  if (status === 400) return BAD_MODEL.test(message) && /model/i.test(message) ? "permanent" : null;
  if (status === 429 || status >= 500) return "cooldown";
  return null;
}

export const markBroken = (model: string) => void health.set(model, PERMANENT);
export const markCooling = (model: string, ms = COOLDOWN_MS) => {
  if (health.get(model) !== PERMANENT) health.set(model, clock() + ms);
};
/** Records a failure by its status; returns how it was classified. */
export function recordFailure(model: string, status: number, message = ""): Failure {
  const f = classifyFailure(status, message);
  if (f === "permanent") markBroken(model);
  else if (f === "cooldown") markCooling(model);
  return f;
}
export const isHealthy = (model: string) => {
  const until = health.get(model);
  if (until === undefined) return true;
  if (until !== PERMANENT && clock() >= until) {
    health.delete(model);
    return true;
  }
  return false;
};
export const resetBroken = () => health.clear();

const model = {
  gpt: () => process.env.VOLT_MODEL_GPT || "gpt-6.2-sol",
  grok: () => process.env.VOLT_MODEL_GROK || "grok-4.3",
  grokCode: () => process.env.VOLT_MODEL_GROK_CODE || "grok-code-fast-1",
};

/** Syntax that only appears in code: fences, braces, statements, SQL. */
const CODE_SYNTAX = /```|\{[^}]*\}|\([^)]*\);|\bselect\b[\s\S]{1,200}?\bfrom\b/i;
/** Technical words; one alone ("api", "schema", "json" in a pricing brief) proves nothing, two do. */
const CODE_TOKENS = /\b(sql|python|javascript|typescript|script|scripts|scripting|regex|etl|endpoint|endpoints|json|migration|macro|vba|refactor|unit tests?|stack trace)\b/gi;
/** A brief about code or data plumbing: the work a coding model is built for. */
export function codeLike(text: string): boolean {
  if (CODE_SYNTAX.test(text)) return true;
  const found = new Set((text.match(CODE_TOKENS) ?? []).map((t) => t.toLowerCase().replace(/s$/, "")));
  return found.size >= 2;
}

const usable = (m: string) => {
  const p = providerOf(m);
  return p !== "anthropic" && !!keyFor(p) && isHealthy(m);
};

/**
 * The model for one specialist. `claude` is the model the Claude router chose; it stays whenever the engine is
 * Claude, the brief is high-stakes (claude is Opus), or the chosen provider has no key.
 */
export function specialistModel(engine: Engine | undefined, brief: string, claude: string, guard?: boolean): { model: string; why: string } {
  const stay = { model: claude, why: "Claude" };
  if (!engine || engine === "claude") return stay;
  // `guard` is the per-turn high-stakes decision (this turn's wording, scope or Opus switch), made by the caller.
  // Without it, fall back to the model's name. The chat's lead tier never decides this.
  if (guard ?? /opus/i.test(claude)) return { model: claude, why: "Claude (Opus is kept for high-stakes finance work)" };
  const code = codeLike(brief);
  const gpt = model.gpt();
  const grok = code ? model.grokCode() : model.grok();
  if (engine === "gpt") return usable(gpt) ? { model: gpt, why: "GPT" } : stay;
  if (engine === "grok") return usable(grok) ? { model: grok, why: code ? "Grok Code" : "Grok" } : stay;
  // auto: a coding model for code-like briefs, otherwise the tier-matched GPT, otherwise Grok.
  if (code && usable(model.grokCode())) return { model: model.grokCode(), why: "Grok Code (code-like brief)" };
  if (usable(gpt)) return { model: gpt, why: "GPT" };
  if (usable(model.grok())) return { model: model.grok(), why: "Grok" };
  return stay;
}

/** USD per million tokens, list prices checked November 2026. Estimates for the usage page; the provider's invoice is the bill. */
export const EXTRA_PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "gpt-6.2-astra": { input: 8, output: 40, cacheRead: 0.4 },
  "gpt-6.2-sol": { input: 2, output: 10, cacheRead: 0.1 },
  "gpt-6.1-terra": { input: 1, output: 5, cacheRead: 0.05 },
  "gpt-6-luna": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "grok-4.7": { input: 2, output: 6, cacheRead: 0.5 },
  "grok-4.6": { input: 2, output: 6, cacheRead: 0.5 },
  "grok-4.5": { input: 2, output: 6, cacheRead: 0.3 },
  "grok-4.3": { input: 1.25, output: 2.5, cacheRead: 0.2 },
  "grok-4.20": { input: 1.25, output: 2.5, cacheRead: 0.2 },
  // Sources disagree ($0.20/$1.50 at launch, $1/$2 on current lists); the higher figure keeps the estimate safe.
  "grok-code-fast-1": { input: 1, output: 2, cacheRead: 0.2 },
  "grok-build-0.1": { input: 1, output: 2, cacheRead: 0.2 },
};
