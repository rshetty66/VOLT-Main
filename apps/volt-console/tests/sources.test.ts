import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { standardTies, toCurrencyUnits } from "../shared/mortgageFigures";

// Synthetic fixture pages (test data only), the same note-style tables as the Python self-test.
const PAGES = [
  "Note 5 Loans\n(Millions of Canadian dollars)\nAs at October 31, 2025\nResidential mortgages\nGross   412,345\nAllowance for credit losses   (1,234)\nNet   411,111",
  "Allowance for credit losses - residential mortgages\nBalance at beginning of year 1,100\nProvision for credit losses 400\nWrite-offs (300)\nRecoveries 40\nExchange rate and other (6)\nBalance at end of year 1,234\nStage 1 300 Stage 2 500 Stage 3 434",
];
const RECORDED = {
  meta: { issuer: "Fixture Bank", period_end: "2025-10-31", currency: "CAD", scale: "millions", basis: "IFRS", statement_reference: "Note 5" },
  figures: [
    { id: "gross_loans", value: "412345", page: 1, quote: "Gross 412,345" },
    { id: "allowance_total", value: "1234", page: 1, quote: "Allowance for credit losses (1,234)" },
    { id: "net_loans", value: "411111", page: 1, quote: "Net 411,111" },
    { id: "allowance_opening", value: "1100", page: 2, quote: "Balance at beginning of year 1,100" },
    { id: "provision", value: "400", page: 2, quote: "Provision for credit losses 400" },
    { id: "write_offs", value: "300", page: 2, quote: "Write-offs (300)" },
    { id: "recoveries", value: "40", page: 2, quote: "Recoveries 40" },
    { id: "other_movements", value: "-6", page: 2, quote: "Exchange rate and other (6)" },
    { id: "allowance_closing", value: "1234", page: 2, quote: "Balance at end of year 1,234" },
    { id: "stage1_allowance", value: "300", page: 2, quote: "Stage 1 300" },
    { id: "stage2_allowance", value: "500", page: 2, quote: "Stage 2 500" },
    { id: "stage3_allowance", value: "434", page: 2, quote: "Stage 3 434" },
  ],
};

let mockFigures = RECORDED;
const requests: any[] = [];

function sse(res: http.ServerResponse, blocks: any[], usage: Record<string, unknown>) {
  const ev: any[] = [{ type: "message_start", message: { id: `m${requests.length}`, type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, usage: { input_tokens: 200, output_tokens: 0, cache_read_input_tokens: 0 } } }];
  blocks.forEach((b, i) => {
    if (b.type === "tool_use" || b.type === "server_tool_use") {
      ev.push({ type: "content_block_start", index: i, content_block: { ...b, input: {} } });
      ev.push({ type: "content_block_delta", index: i, delta: { type: "input_json_delta", partial_json: JSON.stringify(b.input) } });
    } else {
      ev.push({ type: "content_block_start", index: i, content_block: b });
    }
    ev.push({ type: "content_block_stop", index: i });
  });
  ev.push({ type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 50, ...usage } });
  ev.push({ type: "message_stop" });
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const e of ev) res.write(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`);
  res.end();
}

let server: http.Server;
let sources: typeof import("../server/sources");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "volt-sources-test-"));

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const b = JSON.parse(body);
      requests.push(b);
      const names = b.tools.map((t: { name: string }) => t.name);
      if (names.includes("record_candidates")) {
        return sse(res, [
          { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "Fixture Bank 2025 annual report" } },
          { type: "web_search_tool_result", tool_use_id: "srv_1", content: [{ type: "web_search_result", url: "https://fixture.example/ar2025.pdf", title: "Annual Report 2025", encrypted_content: "x", page_age: null }] },
          { type: "tool_use", id: "tu_c", name: "record_candidates", input: { candidates: [{ title: "Annual Report 2025", url: "https://fixture.example/ar2025.pdf", period: "fiscal 2025", publisher: "Fixture Bank investor relations", primary_source: true }] } },
        ], { server_tool_use: { web_search_requests: 1, web_fetch_requests: 0 } });
      }
      if (names.includes("web_fetch")) {
        return sse(res, [
          { type: "server_tool_use", id: "srv_2", name: "web_fetch", input: { url: "https://fixture.example/ar2025.pdf" } },
          { type: "web_fetch_tool_result", tool_use_id: "srv_2", content: { type: "web_fetch_result", url: "https://fixture.example/ar2025.pdf", retrieved_at: "2026-11-01T15:00:00Z", content: { type: "document", title: "Annual Report 2025", citations: null, source: { type: "text", media_type: "text/plain", data: PAGES.join("\f") } } } },
          { type: "tool_use", id: "tu_f", name: "record_figures", input: mockFigures },
        ], { server_tool_use: { web_search_requests: 0, web_fetch_requests: 1 } });
      }
      return sse(res, [{ type: "tool_use", id: "tu_u", name: "record_figures", input: mockFigures }], {});
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.VOLT_SOURCES_DIR = dir;
  sources = await import("../server/sources");
});
afterAll(() => {
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("mortgage figure helpers", () => {
  it("scales reporting units to currency units exactly", () => {
    expect(toCurrencyUnits("412345", "millions")).toBe("412345000000.00");
    expect(toCurrencyUnits("412.5", "millions")).toBe("412500000.00");
    expect(toCurrencyUnits("-6", "thousands")).toBe("-6000.00");
    expect(toCurrencyUnits("12.34", "units")).toBe("12.34");
    expect(() => toCurrencyUnits("1.234", "units")).toThrow(/precision/);
  });

  it("only builds ties whose figures are all present, with a rounding tolerance of half a unit per term", () => {
    expect(standardTies(["gross_loans", "allowance_total", "net_loans"])).toEqual([
      { id: "net_carrying_amount", terms: [["gross_loans", 1], ["allowance_total", -1], ["net_loans", -1]], tolerance: "1.5" },
    ]);
    expect(standardTies(["gross_loans"])).toEqual([]);
  });
});

describe("sources (mocked Claude web tools)", () => {
  it("finds candidate filings with web_search and counts the search", async () => {
    const r = await sources.findFilings("Fixture Bank", "fiscal 2025");
    expect(r.candidates[0]).toMatchObject({ url: "https://fixture.example/ar2025.pdf", primary_source: true });
    expect(r.usage.webSearches).toBe(1);
    const req = requests.at(-1);
    expect(req.tools.map((t: { type?: string; name: string }) => t.type ?? t.name)).toEqual(["web_search_20260209", "record_candidates"]);
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.system[0].text).toMatch(/Looking Up a Published Source|primary source/i);
  });

  it("fetches a filing by URL, keeps the fetched document and verifies every figure", async () => {
    const r = await sources.extractFigures({ url: "https://fixture.example/ar2025.pdf" });
    expect(r.source).toMatchObject({ url: "https://fixture.example/ar2025.pdf", evidenceClass: "PUBLIC_FILING", pageCount: 2 });
    expect(r.figures).toHaveLength(12);
    expect(r.figures[0]).toMatchObject({ scale: "millions", currency: "CAD", period: "2025-10-31", evidence_class: "PUBLIC_FILING" });
    expect(r.report.status).toBe("VALIDATED_SCOPED");
    expect(r.usage.webFetches).toBe(1);
    expect(fs.existsSync(path.join(dir, `${r.source.id}.json`))).toBe(true);
  });

  it("flags a figure whose quote is not on its page", async () => {
    mockFigures = { ...RECORDED, figures: RECORDED.figures.map((f) => (f.id === "provision" ? { ...f, value: "4000", quote: "Provision for credit losses 4,000" } : f)) };
    const r = await sources.extractFigures({ url: "https://fixture.example/ar2025.pdf" });
    mockFigures = RECORDED;
    expect(r.report.status).toBe("BLOCKED");
    expect(r.report.blockers.join(" ")).toMatch(/provision: quote not found on page 2/);
  });

  it("extracts from an uploaded document without web tools and re-verifies edits at zero tokens", async () => {
    const src = await sources.ingestDocument(Buffer.from(PAGES.join("\f")), "text/plain", { title: "Uploaded statements", evidenceClass: "CLIENT_DOCUMENT" });
    const r = await sources.extractFigures({ sourceId: src.id });
    expect(requests.at(-1).tools.map((t: { name: string }) => t.name)).toEqual(["record_figures"]);
    expect(r.figures[0].evidence_class).toBe("CLIENT_DOCUMENT");
    expect(r.report.status).toBe("VALIDATED_SCOPED");
    const before = requests.length;
    const edited = r.figures.map((f) => (f.id === "net_loans" ? { ...f, value: "411112" } : f));
    const again = await sources.verifyFigures(src.id, edited);
    expect(requests.length).toBe(before);
    expect(again.checks.find((c) => c.check_id === "X_VALUE_IN_QUOTE")?.status).toBe("FAIL");
  });

  it("refuses a non-https URL and an unknown source id", async () => {
    await expect(sources.extractFigures({ url: "http://fixture.example/a.pdf" })).rejects.toThrow(/https URL/);
    await expect(sources.verifyFigures("f".repeat(64), [])).rejects.toThrow(/Unknown source/);
  });
});
