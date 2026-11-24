import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import { loadCatalog } from "../server/catalog";
import { exportDocument } from "../server/export";
import { runLocalTool, schemas, toolDefs, ORCHESTRATOR_TOOLS, SPECIALIST_TOOLS } from "../server/tools";
import { csvText, safeFormula, type FileSpec } from "../shared/files";
import { FileCards, runFiles } from "../src/components/FileCards";
import { applyEvent as reduce, newRun } from "../src/runState";

const catalog = loadCatalog();

describe("create_file tool", () => {
  it("is offered to Rudra and to the specialists", () => {
    expect(ORCHESTRATOR_TOOLS).toContain("create_file");
    expect(SPECIALIST_TOOLS).toContain("create_file");
    expect(toolDefs(["create_file"])[0].input_schema.type).toBe("object");
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

  it("refuses a CSV without tables, an empty file and an unknown template", () => {
    const run = (x: object) => runLocalTool(catalog, "create_file", schemas.create_file.parse(x));
    expect(run({ format: "csv", title: "Data", markdown: "" }).ok).toBe(false);
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
