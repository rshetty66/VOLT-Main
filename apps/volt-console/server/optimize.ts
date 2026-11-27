import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "./router.js";
import { OPTIMIZER_SYSTEM, parseOptimized, type Optimized } from "../shared/optimize.js";

/** Null means no usable rewrite; the caller still needs explicit confirmation. */
export async function optimizePrompt(
  prompt: string,
  signal: AbortSignal,
  client: Pick<Anthropic, "messages"> = new Anthropic(),
  workflow?: { name: string; topics: string[] },
): Promise<(Optimized & { model: string; inputTokens: number; outputTokens: number }) | null> {
  const model = modelFor("sonnet");
  try {
    const msg = await client.messages.create(
      { model, max_tokens: 2500, system: OPTIMIZER_SYSTEM + (workflow
        ? `\nSelected workflow: ${workflow.name}. Internal scoping topics from the workflow definition: ${JSON.stringify(workflow.topics)}. Incorporate relevant answers or labeled unknowns in PROMPT; do not display a user questionnaire.`
        : ""), messages: [{ role: "user", content: prompt }] },
      { signal, timeout: 40_000, maxRetries: 1 },
    );
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = msg.stop_reason === "max_tokens" ? null : parseOptimized(text);
    return parsed ? { ...parsed, model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens } : null;
  } catch (err) {
    if (signal.aborted) throw err;
    return null;
  }
}
