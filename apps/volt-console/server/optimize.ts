import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "./router.js";
import { OPTIMIZER_SYSTEM, parseOptimized, type Optimized } from "../shared/optimize.js";

/** One Sonnet call that rewrites a rough request. Null when the model is unavailable or its reply is unusable, so the caller sends the original. */
export async function optimizePrompt(
  prompt: string,
  signal: AbortSignal,
  client: Pick<Anthropic, "messages"> = new Anthropic(),
): Promise<(Optimized & { model: string; inputTokens: number; outputTokens: number }) | null> {
  const model = modelFor("sonnet");
  try {
    const msg = await client.messages.create(
      { model, max_tokens: 2500, system: OPTIMIZER_SYSTEM, messages: [{ role: "user", content: `<request>\n${prompt.slice(0, 6000)}\n</request>` }] },
      { signal, timeout: 40_000, maxRetries: 1 },
    );
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = parseOptimized(text);
    return parsed ? { ...parsed, model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens } : null;
  } catch (err) {
    if (signal.aborted) throw err;
    return null;
  }
}
