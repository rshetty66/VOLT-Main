import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import { loadCatalog } from "../server/catalog";
import { exportDocument } from "../server/export";
import { runLocalTool, schemas, toolDefs, CONSULTED_TOOLS, ORCHESTRATOR_TOOLS, QUICK_TOOLS, SPECIALIST_TOOLS } from "../server/tools";
import { madeFile } from "../server/orchestrator";
import { slim } from "../src/history";
import { STALE_PAGE, errorText } from "../src/download";
import { quickAsk } from "../server/deliverable";
import { buildValueCase } from "../server/analytics";
import { csvText, safeFormula, type FileSpec } from "../shared/files";
import { FileCards, cardDeliverable, runFiles } from "../src/components/FileCards";
import { applyEvent as reduce, newRun } from "../src/runState";

const catalog = loadCatalog();

describe("create_file tool", () => {
  it("is offered to Rudra and to the specialists", () => {
    expect(ORCHESTRATOR_TOOLS).toContain("create_file");
    expect(SPECIALIST_TOOLS).toContain("create_file");
    expect(toolDefs(["create_file"])[0].input_schema.type).toBe("object");
  });

  it("is not offered to specialists Rudra consults, so one run makes one file", () => {
    expect(CONSULTED_TOOLS).not.toContain("create_file");
  });

  it("knows when the lead already made a file this turn, so the partner rewrite is skipped", () => {
    const call = { role: "assistant" as const, content: [{ type: "tool_use" as const, id: "t1", name: "create_file", input: {} }] };
    const result = { role: "user" as const, content: [{ type: "tool_result" as const, tool_use_id: "t1", content: "ok" }] };
    expect(madeFile([{ role: "user", content: "Build a value case in Excel" }, call, result, { role: "assistant", content: [{ type: "text", text: "Done" }] }])).toBe(true);
    expect(madeFile([{ role: "user", content: "Build it" }, { role: "assistant", content: [{ type: "text", text: "Answer" }] }])).toBe(false);
    expect(madeFile([call, result, { role: "user", content: "Next question" }])).toBe(false);
  });

  it("returns the file spec for the console and a short reply for the model", () => {
    const input = schemas.create_file.parse({ format: "pptx", title: "Close can fall to 5 days", markdown: "## 1. Situation\n\nText" });
    const r = runLocalTool(catalog, "create_file", input);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.data as FileSpec).format).toBe("pptx");
    expect(r.summary).toBe("PowerPoint deck: Close can fall to 5 days");
    expect(r.reply).toMatch(/download card/);
    expect(r.reply).not.toContain("Situation");
  });

  it("refuses an empty document and an unknown template, but lets Excel and CSV rely on the run's data sheets", () => {
    const run = (x: object) => runLocalTool(catalog, "create_file", schemas.create_file.parse(x));
    expect(run({ format: "csv", title: "Data", markdown: "" }).ok).toBe(true);
    expect(run({ format: "xlsx", title: "Value case", markdown: "" }).ok).toBe(true);
    expect(run({ format: "docx", title: "Empty", markdown: "  " }).ok).toBe(false);
    expect(run({ format: "docx", title: "T", markdown: "x", template_id: "nope" }).ok).toBe(false);
    expect(schemas.create_file.safeParse({ format: "exe", title: "T", markdown: "x" }).success).toBe(false);
  });
});

describe("formulas and CSV", () => {
  it("lets through calculation formulas only", () => {
    expect(safeFormula("=SUM(B2:B5)")).toBe(true);
    expect(safeFormula("=NPV(0.08,C2:C6)-B1")).toBe(true);
    expect(safeFormula("=IF(B2>0,B2*C2,0)")).toBe(true);
    expect(safeFormula('=HYPERLINK("http://x","y")')).toBe(false);
    expect(safeFormula("=WEBSERVICE(A1)")).toBe(false);
    expect(safeFormula("=cmd|' /C calc'!A0")).toBe(false);
    expect(safeFormula("=[book.xlsx]Sheet1!A1")).toBe(false);
    expect(safeFormula("SUM(A1)")).toBe(false);
  });

  it("writes safe formulas as Excel formulas and keeps the rest as text", async () => {
    const out = await exportDocument(
      { format: "xlsx", title: "Model", markdown: "", tables: [{ name: "Calc", columns: ["Item", "Qty", "Price", "Total"], rows: [["A", 2, 3, "=B2*C2"], ["B", 1, 4, '=HYPERLINK("http://x")']] }] },
      null,
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(out.data) as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet("Calc")!;
    expect((ws.getCell("D2").value as { formula: string }).formula).toBe("B2*C2");
    expect(ws.getCell("D3").value).toBe('=HYPERLINK("http://x")');
  });

  it("quotes CSV cells and neutralises formula text", () => {
    const csv = csvText({ name: "t", columns: ["Name", "Note"], rows: [["Acme, Inc", 'He said "hi"'], ["=1+1", null], [-5, "@x"]] });
    expect(csv).toBe('Name,Note\r\n"Acme, Inc","He said ""hi"""\r\n\'=1+1,\r\n-5,\'@x\r\n');
  });
});

describe("download cards", () => {
  it("shows one card per file a run made, not failed or pending calls", () => {
    let r = newRun("Build the close model", "Rudra", "orchestrate");
    const spec: FileSpec = { format: "xlsx", title: "Close model", markdown: "## 1. Inputs\n\n## 2. Outputs", tables: [{ name: "Inputs", columns: ["a"], rows: [[1]] }] };
    r = reduce(r, { type: "tool_call", lane: "rudra", callId: "c1", name: "create_file", input: {} });
    expect(runFiles(r)).toHaveLength(0);
    r = reduce(r, { type: "tool_result", lane: "rudra", callId: "c1", name: "create_file", summary: "Excel workbook: Close model", data: spec });
    r = reduce(r, { type: "tool_call", lane: "rudra", callId: "c2", name: "create_file", input: {} });
    r = reduce(r, { type: "tool_result", lane: "rudra", callId: "c2", name: "create_file", summary: "bad", isError: true });
    expect(runFiles(r).map((f) => f.spec.title)).toEqual(["Close model"]);
    const html = renderToStaticMarkup(createElement(FileCards, { run: r }));
    expect(html).toContain("Close model");
    expect(html).toContain("Excel workbook · 2 sections · 1 data sheet");
    expect(html).toContain(">Download<");
  });
});

describe("quick asks", () => {
  it("sends a file or a calculation from given figures down the quick path", () => {
    expect(quickAsk("Build a value case in excel : 140 finance FTEs at $115K loaded cost, 25% automation, $6M one-time investment.")).toBe(true);
    expect(quickAsk("Give me a CSV of the APQC close benchmarks")).toBe(true);
    expect(quickAsk("Calculate NPV and IRR for a $2M investment returning $700K a year for 5 years at 8%")).toBe(true);
  });

  it("keeps studies, open questions and commands on the full path", () => {
    expect(quickAsk("Assess our close and give me a roadmap deck")).toBe(false);
    expect(quickAsk("Design the target operating model for group finance in a Word report")).toBe(false);
    expect(quickAsk("What is the CSM under IFRS 17?")).toBe(false);
    expect(quickAsk("/compare excel")).toBe(false);
    expect(quickAsk("Build a value case in excel \n: 140 finance FTEs at $115K loaded cost, 25% automation, $6M one-time investment.")).toBe(true);
    expect(quickAsk("What data model should hold IFRS 17 cohorts?")).toBe(false);
  });

  it("gives Rudra the analytics and file tools, without the specialist bench", () => {
    expect(QUICK_TOOLS).toContain("build_value_case");
    expect(QUICK_TOOLS).toContain("create_file");
    expect(QUICK_TOOLS).not.toContain("consult_agent");
    expect(QUICK_TOOLS).not.toContain("find_agents");
  });

  it("adds the run's value case to an Excel file as a data sheet, so the agent never retypes it", () => {
    let r = newRun("Build a value case in excel", "Rudra", "orchestrate");
    const vc = buildValueCase({ financeFtes: 140, loadedCostPerFte: 115_000, automationPct: 25, oneTimeInvestment: 6_000_000 });
    r = reduce(r, { type: "tool_call", lane: "rudra", callId: "v1", name: "build_value_case", input: {} });
    r = reduce(r, { type: "tool_result", lane: "rudra", callId: "v1", name: "build_value_case", summary: "ok", data: vc });
    for (const [id, format] of [["x", "xlsx"], ["d", "docx"]] as const) {
      r = reduce(r, { type: "tool_call", lane: "rudra", callId: id, name: "create_file", input: {} });
      r = reduce(r, { type: "tool_result", lane: "rudra", callId: id, name: "create_file", summary: "ok", data: { format, title: "Value case", markdown: "## 1. Result" } });
    }
    const [xlsx, docx] = runFiles(r);
    expect(xlsx.spec.tables?.map((t) => t.name)).toEqual(["Value case"]);
    expect(xlsx.spec.tables?.[0].rows.at(-3)).toEqual(["NPV", null, null, null, vc.npv]);
    expect(docx.spec.tables).toBeUndefined();
  });
});

describe("after a deploy", () => {
  it("keeps a run's files and analytics in History, so a reload does not lose the download card", () => {
    let r = newRun("Build a value case in excel", "Rudra", "orchestrate");
    r = reduce(r, { type: "tool_call", lane: "rudra", callId: "f", name: "create_file", input: {} });
    r = reduce(r, { type: "tool_result", lane: "rudra", callId: "f", name: "create_file", summary: "ok", data: { format: "html", title: "Close", markdown: "## 1" } });
    r = reduce(r, { type: "tool_call", lane: "rudra", callId: "s", name: "find_skills", input: {} });
    r = reduce(r, { type: "tool_result", lane: "rudra", callId: "s", name: "find_skills", summary: "ok", data: [{ big: true }] });
    const kept = slim(r);
    expect(runFiles(kept).map((f) => f.spec.title)).toEqual(["Close"]);
    expect(kept.activity.find((a) => a.text === "find_skills")?.data).toBeUndefined();
  });

  it("explains a missing asset chunk as an update, not a fetch error", () => {
    expect(errorText(new TypeError("Failed to fetch dynamically imported module: https://x/assets/server.browser-CQrruq1j.js"))).toBe(STALE_PAGE);
    expect(errorText(new Error("Download failed (500)"))).toBe("Download failed (500)");
  });
});

describe("HTML page companions", () => {
  it("gives an HTML file the run's deck and workbook as companions, and no other file any", () => {
    const html: FileSpec = { format: "html", title: "Page", markdown: "## A" };
    const deck: FileSpec = { format: "pptx", title: "Deck", markdown: "## A" };
    const book: FileSpec = { format: "xlsx", title: "Book", markdown: "", tables: [{ name: "T", columns: ["a"], rows: [[1]] }] };
    const csv: FileSpec = { format: "csv", title: "Data", markdown: "" };
    const all = [html, deck, book, csv];
    expect(cardDeliverable(html, all).companions?.map((c) => c.format)).toEqual(["pptx", "xlsx"]);
    expect(cardDeliverable(book, all).companions).toBeUndefined();
  });
});
