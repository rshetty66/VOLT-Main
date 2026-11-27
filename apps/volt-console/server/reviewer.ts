import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "./router.js";
import { REVIEWER_PROMPT, parseVerdict, type Verdict } from "../shared/review.js";

/** One review by a fresh-context model that never saw how the draft was made. */
export async function independentReview(
  ask: string,
  draft: string,
  signal: AbortSignal,
  client: Pick<Anthropic, "messages"> = new Anthropic(),
): Promise<{ verdict: Verdict; model: string; inputTokens: number; outputTokens: number } | null> {
  const model = modelFor("sonnet");
  try {
    const msg = await client.messages.create(
      {
        model,
        max_tokens: 700,
        system: REVIEWER_PROMPT,
        messages: [{ role: "user", content: `<request>\n${ask.slice(0, 6000)}\n</request>\n\n<draft>\n${draft.slice(0, 60000)}\n</draft>` }],
      },
      { signal, timeout: 60_000, maxRetries: 1 },
    );
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return { verdict: parseVerdict(text), model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens };
  } catch (err) {
    if (signal.aborted) throw err;
    return null;
  }
}
