import { beforeEach, describe, expect, it } from "vitest";
import { ProviderError, runResponsesLoop, sse } from "../server/responsesLoop";

const frames = (events: object[]) =>
  new Response(new ReadableStream({ start(c) { for (const e of events) c.enqueue(new TextEncoder().encode(`event: x\ndata: ${JSON.stringify(e)}\n\n`)); c.close(); } }), { status: 200 });

const base = {
  model: "gpt-6.2-sol",
  system: "sys",
  input: "brief",
  tools: [{ name: "apqc_benchmark", description: "d", input_schema: { type: "object", properties: {} } }],
  signal: new AbortController().signal,
};
beforeEach(() => {
  process.env.OPENAI_API_KEY = "test";
  process.env.XAI_API_KEY = "test";
});

describe("runResponsesLoop", () => {
  it("runs a tool call, sends its result back and returns the answer", async () => {
    const bodies: any[] = [];
    const replies = [
      frames([
        { type: "response.output_item.done", item: { type: "function_call", call_id: "c1", name: "apqc_benchmark", arguments: '{"x":1}' } },
        { type: "response.completed", response: { usage: { input_tokens: 100, output_tokens: 10, input_tokens_details: { cached_tokens: 40 } } } },
      ]),
      frames([
        { type: "response.output_text.delta", delta: "Hello " },
        { type: "response.output_text.delta", delta: "world" },
        { type: "response.completed", response: { usage: { input_tokens: 120, output_tokens: 5 } } },
      ]),
    ];
    const text: string[] = [];
    const usage: any[] = [];
    const calls: any[] = [];
    const out = await runResponsesLoop({
      ...base,
      fetchImpl: (async (_u: string, init: any) => (bodies.push(JSON.parse(init.body)), replies.shift()!)) as any,
      onText: (t) => text.push(t),
      onUsage: (u) => usage.push(u),
      execute: async (c) => (calls.push(c), { content: "result" }),
    });
    expect(out).toBe("Hello world");
    expect(text.join("")).toBe("Hello world");
    expect(calls).toEqual([{ id: "c1", name: "apqc_benchmark", input: { x: 1 } }]);
    expect(usage[0]).toEqual({ inputTokens: 60, outputTokens: 10, cacheReadTokens: 40 });
    expect(bodies[0].store).toBe(false);
    expect(bodies[0].reasoning).toEqual({ effort: "high" });
    expect(bodies[1].input.map((i: any) => i.type ?? i.role)).toEqual(["user", "function_call", "function_call_output"]);
    expect(bodies[1].input[2].output).toBe("result");
  });

  it("sends no reasoning block to xAI and uses its base URL", async () => {
    let url = "";
    let body: any;
    await runResponsesLoop({
      ...base,
      model: "grok-4.3",
      fetchImpl: (async (u: string, init: any) => ((url = u), (body = JSON.parse(init.body)), frames([{ type: "response.output_text.delta", delta: "ok" }, { type: "response.completed", response: {} }]))) as any,
      onText() {},
      onUsage() {},
      execute: async () => ({ content: "" }),
    });
    expect(url).toBe("https://api.x.ai/v1/responses");
    expect(body.reasoning).toBeUndefined();
  });

  it("raises a ProviderError with the status on a refusal", async () => {
    const run = runResponsesLoop({
      ...base,
      fetchImpl: (async () => new Response(JSON.stringify({ error: { message: "model not found" } }), { status: 404 })) as any,
      onText() {},
      onUsage() {},
      execute: async () => ({ content: "" }),
    });
    await expect(run).rejects.toMatchObject({ status: 404, message: expect.stringContaining("model not found") });
    await expect(run).rejects.toBeInstanceOf(ProviderError);
  });

  it("parses frames split across chunks", async () => {
    const enc = new TextEncoder();
    const parts = ['data: {"a":', '1}\n\ndata: {"b":2}\n', "\ndata: [DONE]\n\n"];
    const body = new ReadableStream<Uint8Array>({ start(c) { for (const p of parts) c.enqueue(enc.encode(p)); c.close(); } });
    const got: any[] = [];
    for await (const e of sse(body)) got.push(e);
    expect(got).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
