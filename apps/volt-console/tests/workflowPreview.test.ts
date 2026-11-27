import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareWorkflowPreview } from "../src/components/Workflows";

const prompt = "Compare the alternatives for our CFO.";
const workflowId = "strategy";
const signal = () => new AbortController().signal;
afterEach(() => vi.unstubAllGlobals());

describe("named workflow preview", () => {
  it("sends the prompt and named workflow to the optimizer, preserving the returned text", async () => {
    const edited = "  Decision brief\nInclude both options.\n";
    const fetch = vi.fn().mockResolvedValue(Response.json({ optimized: { prompt: edited } }));
    vi.stubGlobal("fetch", fetch);
    const abort = signal();
    expect(await prepareWorkflowPreview(prompt, workflowId, true, abort)).toEqual({ kind: "optimized", text: edited });
    expect(fetch).toHaveBeenCalledWith("/api/optimize", expect.objectContaining({ method: "POST", signal: abort, body: JSON.stringify({ prompt, workflowId }) }));
  });

  it("keeps demo requests local and returns the original for review", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await prepareWorkflowPreview(prompt, workflowId, false, signal())).toEqual({ kind: "original", text: prompt });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([Response.json({ optimized: null }), Response.json({ optimized: { prompt: " " } }), new Response(null, { status: 502 })])(
    "fails closed when the optimizer returns no usable rewrite",
    async (response) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      await expect(prepareWorkflowPreview(prompt, workflowId, true, signal())).rejects.toThrow();
    },
  );
});
