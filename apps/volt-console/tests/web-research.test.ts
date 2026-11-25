import { describe, expect, it } from "vitest";
import { SourceRegistry, registerWebBlock, webCitationKeys } from "../server/research";

const search = {
  type: "web_search_tool_result",
  tool_use_id: "srv_1",
  content: [
    { type: "web_search_result", url: "https://www.osfi-bsif.gc.ca/en/guidance/car-2026", title: "Capital Adequacy Requirements 2026", page_age: "2025-11-14", encrypted_content: "x" },
    { type: "web_search_result", url: "https://example.com/blog", title: "A blog post", encrypted_content: "y" },
  ],
};
const fetched = {
  type: "web_fetch_tool_result",
  tool_use_id: "srv_2",
  content: { type: "web_fetch_result", url: "https://www.ifrs.org/issued-standards/ifrs-9", retrieved_at: "2026-11-24T10:00:00Z", content: { type: "document", title: "IFRS 9 Financial Instruments", source: { type: "text", media_type: "text/plain", data: "..." } } },
};

describe("web research sources", () => {
  it("registers each search result and fetched page once, with its URL and authority", () => {
    const reg = new SourceRegistry("Review our capital position");
    const first = registerWebBlock(search, reg);
    expect(first.map((r) => r.key)).toEqual(["S02", "S03"]);
    expect(first[0]).toMatchObject({ url: "https://www.osfi-bsif.gc.ca/en/guidance/car-2026", publisher: "www.osfi-bsif.gc.ca", date: "2025-11", type: "web page", authority: 8 });
    expect(registerWebBlock(search, reg)).toEqual([]);
    const page = registerWebBlock(fetched, reg);
    expect(page[0]).toMatchObject({ key: "S04", title: "IFRS 9 Financial Instruments", url: "https://www.ifrs.org/issued-standards/ifrs-9", date: "2026-11", type: "web page" });
  });

  it("ignores error results and other blocks", () => {
    const reg = new SourceRegistry("x");
    expect(registerWebBlock({ type: "web_search_tool_result", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } }, reg)).toEqual([]);
    expect(registerWebBlock({ type: "web_fetch_tool_result", content: { type: "web_fetch_tool_error", error_code: "url_not_accessible" } }, reg)).toEqual([]);
    expect(registerWebBlock({ type: "text", text: "hi" }, reg)).toEqual([]);
    expect(reg.sources).toHaveLength(1);
  });

  it("turns the API's citations into register keys, and never a key for a page it did not retrieve", () => {
    const reg = new SourceRegistry("x");
    registerWebBlock(search, reg);
    registerWebBlock(fetched, reg);
    const keys = webCitationKeys(
      [
        { type: "web_search_result_location", url: "https://www.osfi-bsif.gc.ca/en/guidance/car-2026", title: "Capital Adequacy Requirements 2026", cited_text: "..." },
        { type: "web_search_result_location", url: "https://www.osfi-bsif.gc.ca/en/guidance/car-2026", title: "dup", cited_text: "..." },
        { type: "char_location", document_title: "IFRS 9 Financial Instruments", document_index: 0, cited_text: "..." },
        { type: "web_search_result_location", url: "https://invented.example.org/page", title: "Never retrieved", cited_text: "..." },
      ],
      reg,
    );
    expect(keys).toEqual(["S02", "S04"]);
    expect(webCitationKeys([], reg)).toEqual([]);
  });
});

describe("web research in the live loop (mocked Messages API)", () => {
  it("offers both web tools, records the pages, and puts the cited page's key in the answer", async () => {
    const http = await import("node:http");
    const bodies: any[] = [];
    const url = "https://www.osfi-bsif.gc.ca/en/guidance/car-2026";
    const server = http.createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        bodies.push(JSON.parse(raw));
        const ev: any[] = [
          { type: "message_start", message: { id: "m1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } } },
          { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "srv_1", name: "web_search", input: {} } },
          { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify({ query: "OSFI CAR 2026" }) } },
          { type: "content_block_stop", index: 0 },
          { type: "content_block_start", index: 1, content_block: { type: "web_search_tool_result", tool_use_id: "srv_1", content: [{ type: "web_search_result", url, title: "Capital Adequacy Requirements 2026", page_age: "2025-11-14", encrypted_content: "x" }] } },
          { type: "content_block_stop", index: 1 },
          { type: "content_block_start", index: 2, content_block: { type: "text", text: "", citations: [] } },
          { type: "content_block_delta", index: 2, delta: { type: "citations_delta", citation: { type: "web_search_result_location", url, title: "Capital Adequacy Requirements 2026", cited_text: "CET1 minimum 4.5%", encrypted_index: "e" } } },
          { type: "content_block_delta", index: 2, delta: { type: "text_delta", text: "The CET1 minimum is 4.5%." } },
          { type: "content_block_stop", index: 2 },
          { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 20, server_tool_use: { web_search_requests: 1 } } },
          { type: "message_stop" },
        ];
        res.writeHead(200, { "content-type": "text/event-stream" });
        for (const e of ev) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
        res.end();
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    process.env.ANTHROPIC_API_KEY = "test-key";
    process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${port}`;
    process.env.VOLT_WEB_RESEARCH = "on";
    try {
      const orchestrator = await import("../server/orchestrator");
      const catalog = (await import("../server/catalog")).loadCatalog();
      const events: any[] = [];
      await orchestrator.runLive(catalog, { prompt: "What CET1 minimum does OSFI set?" }, orchestrator.getSession(), (e) => events.push(e), new AbortController().signal);
      // bodies also holds the router's triage call (not streamed); the lead's request is the first streamed one.
      const lead = bodies.find((b) => b.stream);
      const tools = lead.tools.map((t: { type?: string; name: string }) => t.type ?? t.name);
      expect(tools).toEqual(expect.arrayContaining(["web_search_20260209", "web_fetch_20260209"]));
      expect(lead.system[0].text).toContain("Web research is on");
      const source = events.find((e) => e.type === "source" && e.record.url === url);
      expect(source?.record.key).toBe("S02");
      const text = events.filter((e) => e.type === "text_delta").map((e) => e.text).join("");
      expect(text).toBe("The CET1 minimum is 4.5%. [S02]");
      expect(events.some((e) => e.type === "error")).toBe(false);
    } finally {
      server.close();
    }
  });
});
