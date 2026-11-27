import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { ANIMATIONCHART_URL, animationChartEnabled, animationChartParams, asksForAnimation, stripMcpBlocks } from "../server/animationChart";

afterEach(() => {
  delete process.env.ANIMATIONCHART_API_KEY;
});

describe("AnimationChart switch", () => {
  it("is off without a key and on with one", () => {
    expect(animationChartEnabled()).toBe(false);
    process.env.ANIMATIONCHART_API_KEY = "  ";
    expect(animationChartEnabled()).toBe(false);
    process.env.ANIMATIONCHART_API_KEY = "ak_test";
    expect(animationChartEnabled()).toBe(true);
    const p = animationChartParams();
    expect(p.mcp_servers).toEqual([{ type: "url", url: ANIMATIONCHART_URL, name: "animationchart", authorization_token: "ak_test" }]);
    expect(p.tools).toEqual([{ type: "mcp_toolset", mcp_server_name: "animationchart" }]);
  });

  it("is offered only when the request asks for animation", () => {
    expect(asksForAnimation("Show the NIM bridge as an animated chart")).toBe(true);
    expect(asksForAnimation("Animate the close calendar")).toBe(true);
    expect(asksForAnimation("Use AnimationChart for the waterfall")).toBe(true);
    expect(asksForAnimation("Chart NIM by quarter")).toBe(false);
    expect(asksForAnimation("What is an inanimate object")).toBe(false);
  });

  it("turns AnimationChart blocks in the history into text notes", () => {
    const messages: any[] = [
      { role: "user", content: "animate it" },
      {
        role: "assistant",
        content: [
          { type: "mcp_tool_use", id: "m1", name: "create_diagram", server_name: "animationchart", input: {} },
          { type: "mcp_tool_result", tool_use_id: "m1", is_error: false, content: [{ type: "text", text: "Editor: https://app.animationchart.com/d/1" }] },
          { type: "text", text: "Here it is." },
        ],
      },
      { role: "assistant", content: [{ type: "mcp_tool_listing", mcp_server_name: "animationchart", tools: [] }] },
    ];
    expect(stripMcpBlocks(messages)).toBe(true);
    expect(messages[1].content).toEqual([
      { type: "text", text: "(Called AnimationChart create_diagram.)" },
      { type: "text", text: "(AnimationChart result: Editor: https://app.animationchart.com/d/1)" },
      { type: "text", text: "Here it is." },
    ]);
    expect(messages[2].content).toEqual([{ type: "text", text: "(AnimationChart)" }]);
    expect(stripMcpBlocks(messages)).toBe(false);
  });
});

describe("AnimationChart in the live loop (mocked Messages API)", () => {
  // One mock server for the file: the orchestrator keeps its first API client (and base URL) for the process.
  const state = { failMcp: false, bodies: [] as any[], betas: [] as string[] };
  let server: import("node:http").Server;
  beforeAll(async () => {
    const http = await import("node:http");
    server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = JSON.parse(raw);
        state.bodies.push(body);
        state.betas.push(String(req.headers["anthropic-beta"] ?? ""));
        if (state.failMcp && body.mcp_servers) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: "MCP server connection failed" } }));
          return;
        }
        if (!body.stream) {
          // The router's triage call.
          res.writeHead(200, { "content-type": "application/json" });
          res.end(JSON.stringify({ id: "t", type: "message", role: "assistant", model: "claude-haiku-5-5", content: [{ type: "text", text: '{"tier":"sonnet","reason":"chart"}' }], stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 } }));
          return;
        }
        const ev: any[] = [
          { type: "message_start", message: { id: "m1", type: "message", role: "assistant", model: "claude-sonnet-5-5", content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } },
          { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
          { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Chart ready." } },
          { type: "content_block_stop", index: 0 },
          { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 5 } },
          { type: "message_stop" },
        ];
        res.writeHead(200, { "content-type": "text/event-stream" });
        for (const e of ev) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
        res.end();
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterAll(() => server.close());

  async function withMockApi(failMcp: boolean, run: (bodies: any[], betas: string[]) => Promise<void>) {
    Object.assign(state, { failMcp, bodies: [], betas: [] });
    process.env.ANIMATIONCHART_API_KEY = "ak_test";
    await run(state.bodies, state.betas);
  }

  async function runPrompt(prompt: string) {
    const orchestrator = await import("../server/orchestrator");
    const catalog = (await import("../server/catalog")).loadCatalog();
    const events: any[] = [];
    await orchestrator.runLive(catalog, { prompt }, orchestrator.getSession(), (e) => events.push(e), new AbortController().signal);
    return events;
  }

  it("adds the MCP server, its toolset, the beta and the guide when the request asks for animation", async () => {
    await withMockApi(false, async (bodies, betas) => {
      const events = await runPrompt("Show NIM by quarter as an animated chart");
      const i = bodies.findIndex((b) => b.stream);
      const lead = bodies[i];
      expect(lead.mcp_servers).toEqual([{ type: "url", url: ANIMATIONCHART_URL, name: "animationchart", authorization_token: "ak_test" }]);
      expect(lead.tools).toEqual(expect.arrayContaining([{ type: "mcp_toolset", mcp_server_name: "animationchart" }]));
      expect(betas[i]).toContain("mcp-client-2025-11-20");
      expect(lead.system[0].text).toContain("AnimationChart is on for this request");
      expect(events.some((e) => e.type === "error")).toBe(false);
    });
  });

  it("leaves AnimationChart out when the request does not ask for animation", async () => {
    await withMockApi(false, async (bodies) => {
      await runPrompt("Chart NIM by quarter");
      const lead = bodies.find((b) => b.stream);
      expect(lead.mcp_servers).toBeUndefined();
      expect(lead.system[0].text).not.toContain("AnimationChart");
    });
  });

  it("falls back to VOLT's own charts when the AnimationChart server fails", async () => {
    await withMockApi(true, async (bodies) => {
      const events = await runPrompt("Animate the close calendar");
      const streamed = bodies.filter((b) => b.stream);
      expect(streamed[0].mcp_servers).toBeDefined();
      expect(streamed[1].mcp_servers).toBeUndefined();
      expect(events.some((e) => e.type === "status" && /AnimationChart unavailable \(400\)/.test(e.text))).toBe(true);
      expect(events.filter((e) => e.type === "text_delta").map((e) => e.text).join("")).toContain("Chart ready.");
    });
  });
});
