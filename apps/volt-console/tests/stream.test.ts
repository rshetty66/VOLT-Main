import { afterEach, describe, expect, it, vi } from "vitest";
import { CLOSED_EARLY, streamRun } from "../src/api";

function serve(chunks: string[], hold = false) {
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
      if (!hold) c.close();
    },
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));
}

async function drain(idleMs?: number) {
  const seen: string[] = [];
  for await (const e of streamRun({ prompt: "x" }, new AbortController().signal, idleMs)) seen.push(e.type);
  return seen;
}

afterEach(() => vi.unstubAllGlobals());

describe("run stream", () => {
  it("finishes normally when the server sends done", async () => {
    serve([`data: {"type":"status","lane":"rudra","text":"a"}\n\n`, `data: {"type":"done","sessionId":"s"}\n\n`]);
    expect(await drain()).toEqual(["status", "done"]);
  });

  it("fails, instead of staying 'running', when the stream ends without done (server restarted mid-run)", async () => {
    serve([`data: {"type":"status","lane":"rudra","text":"a"}\n\n`]);
    await expect(drain()).rejects.toThrow(CLOSED_EARLY);
  });

  it("fails when the stream goes silent past the heartbeat", async () => {
    serve([`: ping\n\n`], true);
    await expect(drain(50)).rejects.toThrow(CLOSED_EARLY);
  });
});
