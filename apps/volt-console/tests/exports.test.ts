import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { parseMarkdown, plain, sections } from "../server/office/markdown";
import { runContent } from "../server/office/content";
import { buildDocx } from "../server/office/docx";
import { buildXlsx } from "../server/office/xlsx";
import { buildPptx, singleParagraphProperties } from "../server/office/pptx";
import { buildValueCase, compareToBenchmark } from "../server/analytics";
import type { StoredRun } from "../shared/records";
import type { VoltEvent } from "../shared/events";

const deliverable = `# Close Optimization: Board Draft

**Client:** Example lender

## Executive summary

**A 5-day close is achievable.** Process tuning gets to about 8 days:
- a single close layer
  - nested detail
- intercompany matched before month-end (35% -> 75%)

## 3. Roadmap

### 3.1 Waves

| Wave | One-time (CAD) | Automation |
|---|---|---|
| 0 | 350,000 | 15% |
| **Total** | **3,200,000** | 15% |
`;

const vcInput = { finance_ftes: 95, loaded_cost_per_fte: 120000, automation_pct: 15, one_time_investment: 3200000, annual_run_cost: 600000, ramp_years: 2, discount_rate: 0.09, horizon_years: 5 };
const vc = buildValueCase({ financeFtes: 95, loadedCostPerFte: 120000, automationPct: 15, oneTimeInvestment: 3200000, annualRunCost: 600000, rampYears: 2, discountRate: 0.09, horizonYears: 5 });
const bm = compareToBenchmark("days_to_close", 11);

const events: VoltEvent[] = [
  { type: "run_start", runId: "r", sessionId: "s", mode: "live", model: "claude-opus-5-5", kind: "workflow", title: "Finance Close Optimization" },
  { type: "phase_start", index: 0, name: "Diagnosis", agents: ["apqc-researcher"] },
  { type: "agent_start", lane: "close-optimization:0:apqc-researcher", parentLane: "rudra", agentId: "apqc-researcher", name: "APQC Researcher", layer: "Enablers", icon: "", brief: "b" },
  { type: "text_delta", lane: "close-optimization:0:apqc-researcher", text: "## Benchmarks\n\n| Metric | Client |\n|---|---|\n| Days to close | 11 |\n" },
  { type: "agent_end", lane: "close-optimization:0:apqc-researcher", agentId: "apqc-researcher", ok: true },
  { type: "tool_call", lane: "rudra", callId: "t1", name: "build_value_case", input: vcInput },
  { type: "tool_result", lane: "rudra", callId: "t1", name: "build_value_case", summary: "s", data: vc },
  { type: "tool_call", lane: "rudra", callId: "t2", name: "apqc_benchmark", input: { metric: "days_to_close", client_value: 11 } },
  { type: "tool_result", lane: "rudra", callId: "t2", name: "apqc_benchmark", summary: "s", data: bm },
  { type: "text_delta", lane: "rudra", text: deliverable },
  { type: "done", sessionId: "s" },
];

const run: StoredRun = {
  id: "00000000-0000-4000-8000-000000000001", engagementId: null, sessionId: "s", kind: "workflow", title: "Finance Close Optimization", prompt: "11-day close",
  workflowId: "close-optimization", agentId: null, mode: "live", model: "claude-opus-5-5", status: "done", error: null, inputTokens: 1, outputTokens: 1,
  startedAt: "2026-10-20T17:55:07.809Z", finishedAt: "2026-10-20T18:05:00.000Z", intake: { audience: "C-Suite / Board" }, finalText: deliverable, events,
};
const engagement = { id: "e", clientName: "Maple Harbour Financial", title: "Close optimization", description: "", createdAt: "", updatedAt: "", runCount: 1, lastRunAt: null };
const content = runContent(run, engagement);

describe("markdown parsing", () => {
  it("keeps headings, inline bold, nested list levels and tables", () => {
    const blocks = parseMarkdown(deliverable);
    const list = blocks.find((b) => b.kind === "list");
    expect(list && list.kind === "list" && list.items.map((i) => i.level)).toEqual([0, 1, 0]);
    const table = blocks.find((b) => b.kind === "table");
    expect(table && table.kind === "table" && table.rows.map((r) => plain(r[1]))).toEqual(["350,000", "3,200,000"]);
    const para = blocks.find((b) => b.kind === "paragraph" && plain(b.inlines).startsWith("A 5-day"));
    expect(para && para.kind === "paragraph" && para.inlines[0].bold).toBe(true);
    expect(sections(blocks).map((s) => s.title)).toEqual(["Close Optimization: Board Draft", "Executive summary", "3. Roadmap"]);
  });

  it("uses the deliverable's H1 as the document title and gathers tool results", () => {
    expect(content.title).toBe("Close Optimization: Board Draft");
    expect(content.specialists.map((s) => [s.name, s.phase])).toEqual([["APQC Researcher", "Diagnosis"]]);
    expect(content.valueCases).toHaveLength(1);
    expect(content.benchmarks).toHaveLength(1);
  });
});

describe("office exports", () => {
  it("Word report has the title, the deliverable table and the specialist appendix", async () => {
    const zip = await JSZip.loadAsync(await buildDocx(content));
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const text of ["Close Optimization: Board Draft", "Maple Harbour Financial", "Executive summary", "3,200,000", "Appendix: specialist outputs", "APQC Researcher"]) expect(xml).toContain(text);
    expect(xml).toContain("<w:tbl>");
  });

  it("Excel workbook rebuilds the value case with formulas matching the tool", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildXlsx(content)) as unknown as Parameters<typeof wb.xlsx.load>[0]);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Summary", "Value case", "Benchmarks", "1 Waves", "Specialist tables"]);
    const ws = wb.getWorksheet("Value case")!;
    let npv: ExcelJS.CellFormulaValue | undefined;
    ws.eachRow((row) => {
      if (row.getCell(1).value === "NPV") npv = row.getCell(2).value as ExcelJS.CellFormulaValue;
    });
    expect(npv?.formula).toMatch(/^SUM\(G\d+:G\d+\)$/);
    expect(npv?.result).toBeCloseTo(vc.npv, 2);
    const waves = wb.getWorksheet("1 Waves")!;
    expect(waves.getCell("B4").value).toBe(350000); // numbers become numbers
    expect(waves.getCell("C4").value).toBeCloseTo(0.15); // percentages become fractions
    expect(waves.getCell("A5").font?.bold).toBe(true);
  });

  it("PowerPoint deck has section and table slides, one paragraph-properties element per paragraph, and notes", async () => {
    const zip = await JSZip.loadAsync(await buildPptx(content));
    const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
    expect(slides.length).toBe(4); // title, executive summary, roadmap table, specialists (no Contents for two sections)
    const all = (await Promise.all(slides.map((s) => zip.file(s)!.async("string")))).join("");
    expect(all).toContain("Executive summary");
    expect(all).toContain("3. Roadmap: 3.1 Waves");
    expect(all).toContain("Specialists consulted");
    for (const p of all.match(/<a:p>[\s\S]*?<\/a:p>/g) ?? []) expect((p.match(/<a:pPr\b/g) ?? []).length).toBeLessThanOrEqual(1);
    expect(Object.keys(zip.files).some((n) => n.startsWith("ppt/notesSlides/"))).toBe(true);
  });

  it("strips duplicate paragraph properties but keeps the first", () => {
    const xml = '<a:p><a:pPr lvl="1"><a:buChar char="x"/></a:pPr><a:r><a:t>a</a:t></a:r><a:pPr indent="0"><a:buNone/></a:pPr><a:r><a:t>b</a:t></a:r></a:p>';
    expect(singleParagraphProperties(xml)).toBe('<a:p><a:pPr lvl="1"><a:buChar char="x"/></a:pPr><a:r><a:t>a</a:t></a:r><a:r><a:t>b</a:t></a:r></a:p>');
  });
});
