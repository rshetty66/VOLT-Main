/**
 * provider.ts — platform gateway provider (AI SDK, image-preinstalled packages).
 * Credential is server-side only; never imported from frontend code.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { listModels } from "./ai-client";

export const kimiGw = createOpenAICompatible({
  name: "kimi-gw",
  baseURL: process.env.KIMI_AGENTGW_BASE_URL!,
  apiKey: process.env.KIMI_AGENTGW_API_KEY!,
  includeUsage: true,
  supportsStructuredOutputs: true,
});

let cachedModelId: string | undefined;

/** Resolve the site's default model from the gateway — never hardcoded. */
export async function defaultModel(): Promise<string> {
  if (!cachedModelId) {
    const { defaultModelId } = await listModels();
    cachedModelId = defaultModelId;
  }
  return cachedModelId;
}
