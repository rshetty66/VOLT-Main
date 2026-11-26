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

/** Models that answered 404/401 this process lifetime: skipped, so one bad id costs one failed call, not one per specialist. */
const broken = new Set<string>();
export const markBroken = (model: string) => void broken.add(model);
export const resetBroken = () => broken.clear();

const model = {
  gpt: () => process.env.VOLT_MODEL_GPT || "gpt-6.2-sol",
  grok: () => process.env.VOLT_MODEL_GROK || "grok-4.3",
  grokCode: () => process.env.VOLT_MODEL_GROK_CODE || "grok-code-fast-1",
};

/** A brief about code, data plumbing or scripting: the work a coding model is built for. */
const CODE_LIKE = /\b(sql|python|javascript|typescript|script(?:s|ing)?|regex|etl|api|json|schema|data model|data pipeline|integration code|macro|vba|code|refactor)\b/i;
export const codeLike = (text: string) => CODE_LIKE.test(text);

const usable = (m: string) => {
  const p = providerOf(m);
  return p !== "anthropic" && !!keyFor(p) && !broken.has(m);
};

/**
 * The model for one specialist. `claude` is the model the Claude router chose; it stays whenever the engine is
 * Claude, the brief is high-stakes (claude is Opus), or the chosen provider has no key.
 */
export function specialistModel(engine: Engine | undefined, brief: string, claude: string): { model: string; why: string } {
  const stay = { model: claude, why: "Claude" };
  if (!engine || engine === "claude") return stay;
  if (/opus/i.test(claude)) return { model: claude, why: "Claude (Opus is kept for high-stakes finance work)" };
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
