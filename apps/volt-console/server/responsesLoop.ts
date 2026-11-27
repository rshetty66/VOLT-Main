/**
 * One agent loop over the Responses API, for GPT (OpenAI) and Grok (xAI). Same contract as the Claude loop for a
 * specialist: stream the text, run the function tools the model asks for (in parallel), repeat until it answers.
 * Stateless (store: false), so client briefs are not kept on the provider's servers.
 * No dependency: plain fetch and server-sent events.
 */
import { BASE_URL, keyFor, providerOf } from "./providers.js";

export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** The stream failed after text had already been emitted; `partial` is everything the user has seen. */
export class PartialStreamError extends ProviderError {
  constructor(status: number, message: string, public partial: string) {
    super(status, message);
  }
}

export interface FnTool {
  name: string;
  description?: string;
  input_schema: unknown;
}

export interface ResponsesLoopOptions {
  model: string;
  system: string;
  /** The brief (one user message). */
  input: string;
  tools: FnTool[];
  /** Runs one tool call; its content goes back to the model. */
  execute(call: { id: string; name: string; input: unknown }): Promise<{ content: string; isError?: boolean }>;
  onText(delta: string): void;
  /** inputTokens excludes cached tokens; outputTokens already includes reasoning tokens (reasoningTokens is informational). */
  onUsage(u: { inputTokens: number; outputTokens: number; cacheReadTokens: number; reasoningTokens?: number }): void;
  signal: AbortSignal;
  effort?: string;
  maxTurns?: number;
  fetchImpl?: typeof fetch;
}

type Item = Record<string, unknown>;

/** Anthropic effort names to OpenAI's three levels. */
const reasoningEffort = (e?: string) => (e === "low" ? "low" : e === "medium" ? "medium" : "high");

/** Server-sent events as parsed JSON payloads. */
export async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, any>> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i).replace(/^\r?\n\r?\n/, "");
      const data = block
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;
      try {
        yield JSON.parse(data);
      } catch {
        /* a partial or non-JSON frame: skip */
      }
    }
  }
}

/** An Anthropic tool definition as a /responses function tool: type, top-level name, description, JSON-schema parameters. */
export function toFunctionTool(t: FnTool) {
  const schema = (t.input_schema && typeof t.input_schema === "object" ? t.input_schema : {}) as Record<string, unknown>;
  const parameters = { ...schema, type: "object", properties: (schema.properties as object | undefined) ?? {} };
  return { type: "function" as const, name: t.name, description: t.description ?? "", parameters, strict: false };
}

/** Reads token counts from a completed response's usage block (OpenAI and xAI share the shape). */
export function parseUsage(u: any) {
  const cached = u?.input_tokens_details?.cached_tokens ?? u?.prompt_tokens_details?.cached_tokens ?? 0;
  return {
    inputTokens: Math.max(0, (u?.input_tokens ?? 0) - cached),
    outputTokens: u?.output_tokens ?? 0,
    cacheReadTokens: cached,
    reasoningTokens: u?.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

/**
 * Runs the loop. If the stream fails after text was emitted, throws PartialStreamError (carrying that text) so the
 * caller can continue on Claude; before any text, a plain ProviderError so the caller can rerun the step.
 */
export async function runResponsesLoop(o: ResponsesLoopOptions): Promise<string> {
  let emitted = "";
  try {
    return await runLoop({ ...o, onText: (d) => ((emitted += d), o.onText(d)) });
  } catch (err) {
    if (o.signal.aborted) throw err;
    const pe = err instanceof ProviderError ? err : new ProviderError(503, `Connection to the provider failed: ${(err as Error)?.message ?? err}`);
    if (emitted.trim()) throw new PartialStreamError(pe.status, pe.message, emitted);
    throw pe;
  }
}

async function runLoop(o: ResponsesLoopOptions): Promise<string> {
  const provider = providerOf(o.model);
  if (provider === "anthropic") throw new Error(`${o.model} is not a Responses API model`);
  const key = keyFor(provider);
  if (!key) throw new ProviderError(401, `No API key set for ${provider === "openai" ? "OPENAI_API_KEY" : "XAI_API_KEY"}`);
  const doFetch = o.fetchImpl ?? fetch;
  const maxTurns = o.maxTurns ?? 40;
  const tools = o.tools.map(toFunctionTool);
  const input: Item[] = [{ role: "user", content: o.input }];
  let finalText = "";

  for (let turn = 0; turn <= maxTurns; turn++) {
    const wrapUp = turn === maxTurns;
    const res = await doFetch(`${BASE_URL[provider]}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: o.model,
        instructions: o.system,
        input,
        tools,
        tool_choice: wrapUp ? "none" : "auto",
        parallel_tool_calls: true,
        stream: true,
        store: false,
        max_output_tokens: 32000,
        // xAI rejects a reasoning block on models that do not take one, so only OpenAI is sent it.
        // With store: false, reasoning items can only be replayed in encrypted form, so OpenAI is asked for it.
        ...(provider === "openai" ? { reasoning: { effort: reasoningEffort(o.effort) }, include: ["reasoning.encrypted_content"] } : {}),
      }),
      signal: o.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      let msg = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        msg = j.error?.message ?? j.error ?? msg;
      } catch {
        /* keep the raw text */
      }
      throw new ProviderError(res.status, `${provider === "openai" ? "OpenAI" : "xAI"} API ${res.status}: ${msg}`);
    }

    let text = "";
    const calls: { call_id: string; name: string; arguments: string }[] = [];
    const items: Item[] = []; // every output item of this response, in order: reasoning, messages, function calls
    let completedOutput: Item[] | undefined;
    for await (const ev of sse(res.body)) {
      if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") {
        text += ev.delta;
        o.onText(ev.delta);
      } else if (ev.type === "response.output_item.done" && ev.item) {
        items.push(ev.item);
        if (ev.item.type === "function_call") calls.push({ call_id: ev.item.call_id, name: ev.item.name, arguments: ev.item.arguments ?? "{}" });
      } else if (ev.type === "response.completed" || ev.type === "response.incomplete") {
        if (ev.response?.usage) o.onUsage(parseUsage(ev.response.usage));
        if (Array.isArray(ev.response?.output)) completedOutput = ev.response.output;
        if (ev.type === "response.incomplete" && !calls.length && !text) throw new ProviderError(502, `Response incomplete: ${ev.response?.incomplete_details?.reason ?? "unknown"}`);
      } else if (ev.type === "response.failed" || ev.type === "error") {
        throw new ProviderError(502, ev.response?.error?.message ?? ev.message ?? "The provider reported an error");
      }
    }
    if (text) finalText = text;
    if (!calls.length) return finalText;

    // Stateless: the next request must carry this response's output items (reasoning included, beside the function
    // calls they led to), then one function_call_output per call.
    const output = items.length ? items : (completedOutput ?? []);
    const echo = output.filter((it) => it.type !== "reasoning" || !!it.encrypted_content); // an unencrypted reasoning item cannot be replayed
    const echoed = echo.some((it) => it.type === "function_call") ? echo : [...echo, ...calls.map((c) => ({ type: "function_call", call_id: c.call_id, name: c.name, arguments: c.arguments }))];
    input.push(...echoed);
    const results = await Promise.all(
      calls.map(async (c) => {
        let parsed: unknown = {};
        try {
          parsed = JSON.parse(c.arguments || "{}");
        } catch {
          return { call_id: c.call_id, output: `Invalid JSON arguments for ${c.name}` };
        }
        const r = await o.execute({ id: c.call_id, name: c.name, input: parsed });
        return { call_id: c.call_id, output: r.isError ? `Error: ${r.content}` : r.content };
      }),
    );
    for (const r of results) input.push({ type: "function_call_output", call_id: r.call_id, output: r.output });
  }
  return finalText;
}
