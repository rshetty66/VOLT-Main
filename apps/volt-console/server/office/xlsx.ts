/**
 * Excel workbook: a summary sheet, every value case the agents ran rebuilt
 * with live formulas (so inputs can be changed), the APQC benchmarks, each
 * table in the deliverable on its own sheet, and the specialists' tables.
 */
import ExcelJS from "exceljs";
import { plain, type Block } from "./markdown.js";
import type { RunContent, ToolUse } from "./content.js";
import { STANDARD_BRAND, fitLogo, textOn, type Brand } from "./brand.js";

/** Placeholder colour for titles and header fills while building; applyBrand swaps in the template's colour. */
const NAVY = "FF1F3864";
const INPUT_BLUE = "FF0000CC";
const MONEY = '#,##0;[Red]-#,##0';
const PCT = "0.0%";

const thin = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
const box = { top: thin, bottom: thin, left: thin, right: thin };

function sheetName(wb: ExcelJS.Workbook, raw: string): string {
  const base = raw.replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";
  let name = base;
  for (let i = 2; wb.getWorksheet(name); i++) name = `${base.slice(0, 28)} ${i}`;
  return name;
}

/** A table cell: plain numbers and percentages become numbers, everything else stays text. */
function cellValue(text: string): { value: string | number; numFmt?: string } {
  const t = text.replace(/−/g, "-").trim();
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$|^-?\d+(\.\d+)?$/.test(t)) return { value: Number(t.replace(/,/g, "")), numFmt: t.includes(".") ? "#,##0.0#" : "#,##0" };
  if (/^-?\d+(\.\d+)?%$/.test(t)) return { value: Number(t.slice(0, -1)) / 100, numFmt: PCT };
  return { value: text };
}

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "top", wrapText: true };
    cell.border = box;
  });
}

/** Writes a captioned table starting at `row`; returns the next free row. */
function writeTable(ws: ExcelJS.Worksheet, row: number, caption: string, source: string, t: Extract<Block, { kind: "table" }>, widths: number[]): number {
  ws.getCell(row, 1).value = caption;
  ws.getCell(row, 1).font = { bold: true, size: 12, color: { argb: NAVY } };
  ws.getCell(row + 1, 1).value = source;
  ws.getCell(row + 1, 1).font = { italic: true, color: { argb: "FF7F7F7F" } };
  const headerRow = ws.getRow(row + 2);
  t.header.forEach((h, i) => (headerRow.getCell(i + 1).value = plain(h)));
  styleHeader(headerRow);
  t.rows.forEach((r, ri) => {
    const xr = ws.getRow(row + 3 + ri);
    r.forEach((cell, ci) => {
      const text = plain(cell);
      const v = cellValue(text);
      const c = xr.getCell(ci + 1);
      c.value = v.value;
      if (v.numFmt) c.numFmt = v.numFmt;
      c.alignment = { vertical: "top", wrapText: true };
      c.border = box;
      if (cell.some((i) => i.bold) && cell.every((i) => i.bold || !i.text.trim())) c.font = { bold: true };
      widths[ci] = Math.max(widths[ci] ?? 8, Math.min(60, text.length + 2));
    });
  });
  t.header.forEach((h, i) => (widths[i] = Math.max(widths[i] ?? 8, Math.min(60, plain(h).length + 4))));
  return row + 3 + t.rows.length + 2;
}

function applyWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = Math.max(10, w)));
}

/** Tables in a block list, each with the nearest heading above it as its caption. */
function captionedTables(blocks: Block[], fallback: string) {
  let heading = fallback;
  const out: { caption: string; table: Extract<Block, { kind: "table" }> }[] = [];
  for (const b of blocks) {
    if (b.kind === "heading") heading = plain(b.inlines);
    if (b.kind === "table") out.push({ caption: heading, table: b });
  }
  return out;
}

function valueCaseSheet(wb: ExcelJS.Workbook, cases: ToolUse[]) {
  const ws = wb.addWorksheet("Value case");
  ws.getColumn(1).width = 30;
  for (let c = 2; c <= 8; c++) ws.getColumn(c).width = 16;
  ws.getCell("A1").value = "Value cases the agents ran, rebuilt with live formulas";
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };
  ws.getCell("A2").value = "Blue cells are inputs: change them and every figure below recalculates. Column H shows the agent tool's own result as a check.";
  ws.getCell("A2").font = { italic: true, color: { argb: "FF7F7F7F" } };

  let r = 4;
  cases.forEach((vc, n) => {
    const i = vc.input;
    const d = vc.data;
    const horizon = Number(i.horizon_years ?? d.yearly?.length ?? 5);
    ws.getCell(r, 1).value = `Scenario ${n + 1} (run by ${vc.by})`;
    ws.getCell(r, 1).font = { bold: true, size: 12, color: { argb: NAVY } };
    r++;
    const inputs: [string, number, string?][] = [
      ["Finance FTEs", Number(i.finance_ftes)],
      ["Loaded cost per FTE", Number(i.loaded_cost_per_fte), MONEY],
      ["Automation (% of effort released)", Number(i.automation_pct) / 100, PCT],
      ["One-time investment", Number(i.one_time_investment), MONEY],
      ["Annual run cost", Number(i.annual_run_cost ?? 0), MONEY],
      ["Ramp (years to full benefit)", Number(i.ramp_years ?? 2)],
      ["Discount rate", Number(i.discount_rate ?? 0.08), PCT],
    ];
    const at: Record<string, string> = {};
    inputs.forEach(([label, value, fmt], k) => {
      ws.getCell(r + k, 1).value = label;
      const c = ws.getCell(r + k, 2);
      c.value = value;
      c.font = { color: { argb: INPUT_BLUE } };
      if (fmt) c.numFmt = fmt;
      at[label] = `$B$${r + k}`;
    });
    const [fte, cost, auto, inv, run, ramp, rate] = inputs.map(([l]) => at[l]);
    r += inputs.length + 1;

    const head = ws.getRow(r);
    ["Year", "Realisation", "Gross benefit", "Run cost", "Net cash flow", "Discount factor", "Present value", "Tool net flow"].forEach((h, k) => (head.getCell(k + 1).value = h));
    styleHeader(head);
    const first = r + 1;
    for (let y = 0; y <= horizon; y++) {
      const row = r + 1 + y;
      const set = (col: number, formula: string, result: number | undefined, fmt: string) => {
        const c = ws.getCell(row, col);
        c.value = { formula, result } as ExcelJS.CellFormulaValue;
        c.numFmt = fmt;
        c.border = box;
      };
      ws.getCell(row, 1).value = y;
      ws.getCell(row, 1).border = box;
      const tool = d.yearly?.[y - 1];
      if (y === 0) {
        set(5, `-${inv}`, -Number(i.one_time_investment), MONEY);
      } else {
        set(2, `MIN(1,A${row}/${ramp})`, tool ? tool.realisationPct / 100 : undefined, PCT);
        set(3, `${fte}*${auto}*${cost}*B${row}`, tool?.grossBenefit, MONEY);
        set(4, `${run}`, tool?.runCost, MONEY);
        set(5, `C${row}-D${row}`, tool?.netBenefit, MONEY);
        if (tool) {
          ws.getCell(row, 8).value = tool.netBenefit;
          ws.getCell(row, 8).numFmt = MONEY;
        }
      }
      set(6, `1/(1+${rate})^A${row}`, undefined, "0.0000");
      set(7, `E${row}*F${row}`, undefined, MONEY);
    }
    const last = r + 1 + horizon;
    r = last + 2;
    const result = (label: string, formula: string, value: number | null | undefined, fmt: string) => {
      ws.getCell(r, 1).value = label;
      ws.getCell(r, 1).font = { bold: true };
      const c = ws.getCell(r, 2);
      c.value = { formula, result: value ?? undefined } as ExcelJS.CellFormulaValue;
      c.numFmt = fmt;
      c.font = { bold: true };
      ws.getCell(r, 7).value = "Tool result";
      ws.getCell(r, 7).font = { italic: true, color: { argb: "FF7F7F7F" } };
      if (value !== undefined && value !== null) {
        ws.getCell(r, 8).value = value;
        ws.getCell(r, 8).numFmt = fmt;
      }
      r++;
    };
    result("Steady-state annual saving", `${fte}*${auto}*${cost}`, d.steadyStateAnnualSaving, MONEY);
    result("Capacity released (FTE)", `${fte}*${auto}`, d.capacityReleasedFtes, "0.0");
    result("NPV", `SUM(G${first}:G${last})`, d.npv, MONEY);
    result("IRR", `IFERROR(IRR(E${first}:E${last}),"n/a")`, d.irrPct === null || d.irrPct === undefined ? undefined : d.irrPct / 100, PCT);
    ws.getCell(r, 1).value = "Payback (years)";
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, 2).value = d.paybackYears ?? "beyond horizon";
    ws.getCell(r, 7).value = "From the tool";
    ws.getCell(r, 7).font = { italic: true, color: { argb: "FF7F7F7F" } };
    r += 3;
  });
}

function benchmarkSheet(wb: ExcelJS.Workbook, rows: ToolUse[]) {
  const ws = wb.addWorksheet("Benchmarks");
  ws.getCell("A1").value = "APQC benchmark positions";
  ws.getCell("A1").font = { bold: true, size: 14, color: { argb: NAVY } };
  const head = ws.getRow(3);
  ["Metric", "Unit", "Client", "Top quartile", "Median", "Bottom quartile", "Position", "Gap to median", "Gap to top quartile", "Better when", "Looked up by"].forEach((h, k) => (head.getCell(k + 1).value = h));
  styleHeader(head);
  rows.forEach((b, k) => {
    const bm = b.data.benchmark ?? {};
    const row = ws.getRow(4 + k);
    row.values = [bm.metric, bm.unit, b.data.clientValue ?? null, bm.top25, bm.median, bm.bottom25, b.data.quartile ?? "", b.data.gapToMedian ?? null, b.data.gapToTop25 ?? null, bm.lowerIsBetter ? "lower" : "higher", b.by];
    row.eachCell((c) => (c.border = box));
  });
  [44, 14, 10, 12, 10, 14, 18, 14, 18, 12, 22].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.views = [{ state: "frozen", ySplit: 3 }];
}

/**
 * Gives the finished workbook the template's look: the primary colour on titles and header
 * fills (with readable header text), the heading font on titles, the body font everywhere else.
 */
function applyBrand(wb: ExcelJS.Workbook, brand: Brand) {
  const primary = `FF${brand.primary}`;
  const headText = `FF${textOn(brand.primary)}`;
  for (const ws of wb.worksheets) {
    ws.eachRow({ includeEmpty: false }, (row) =>
      row.eachCell({ includeEmpty: false }, (cell) => {
        const font = { ...(cell.font ?? {}) };
        const fill = cell.fill as ExcelJS.FillPattern | undefined;
        const isHeader = fill?.type === "pattern" && fill.fgColor?.argb === NAVY;
        if (isHeader) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: primary } };
          font.color = { argb: headText };
        } else if (font.color?.argb === NAVY) {
          font.color = { argb: primary };
        }
        font.name = (font.size ?? 11) >= 12 ? brand.headingFont : brand.bodyFont;
        cell.font = font;
      }),
    );
  }
}

export async function buildXlsx(c: RunContent, brand: Brand = STANDARD_BRAND): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VOLT Agentic Console";
  wb.title = c.title;

  const deliverableTables = captionedTables(c.body, c.title);
  const specialistTables = c.specialists.flatMap((s) => captionedTables(s.blocks, s.name).map((t) => ({ ...t, by: s.name })));

  // Summary
  const sum = wb.addWorksheet("Summary");
  sum.getColumn(1).width = 44;
  sum.getColumn(2).width = 100;
  sum.getCell("A1").value = c.title;
  sum.getCell("A1").font = { bold: true, size: 16, color: { argb: NAVY } };
  const facts: [string, string][] = [
    ["Client", c.client],
    ["Engagement", c.engagementTitle],
    ["Date", c.date],
    ["Status", c.status === "done" ? "Working draft for review" : `Run ${c.status}`],
    ["Source", c.modeLabel],
    ["Request", c.prompt],
    ["Template", brand.name],
    ["Confidentiality", brand.confidentiality],
    ...c.intake.map(([k, v]) => [`Intake: ${k}`, v] as [string, string]),
  ];
  let r = 3;
  for (const [k, v] of facts.filter(([, v]) => v)) {
    sum.getCell(r, 1).value = k;
    sum.getCell(r, 1).font = { bold: true };
    sum.getCell(r, 2).value = v;
    sum.getCell(r, 2).alignment = { wrapText: true, vertical: "top" };
    r++;
  }
  r++;
  sum.getCell(r, 1).value = "Sheets in this workbook";
  sum.getCell(r, 1).font = { bold: true, size: 12, color: { argb: NAVY } };
  const contents: [string, string][] = [];

  if (c.valueCases.length) {
    valueCaseSheet(wb, c.valueCases);
    contents.push(["Value case", `${c.valueCases.length} scenario(s) the agents calculated, with live formulas`]);
  }
  if (c.benchmarks.length) {
    benchmarkSheet(wb, c.benchmarks);
    contents.push(["Benchmarks", `${c.benchmarks.length} APQC benchmark position(s)`]);
  }
  deliverableTables.forEach((t, n) => {
    const ws = wb.addWorksheet(sheetName(wb, `${n + 1} ${t.caption.replace(/^[\d.]+\s*/, "")}`));
    const widths: number[] = [];
    writeTable(ws, 1, t.caption, "From the deliverable", t.table, widths);
    applyWidths(ws, widths);
    ws.views = [{ state: "frozen", ySplit: 3 }];
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: Math.max(1, t.table.header.length) } };
    contents.push([ws.name, t.caption]);
  });
  if (specialistTables.length) {
    const ws = wb.addWorksheet("Specialist tables");
    const widths: number[] = [];
    let row = 1;
    for (const t of specialistTables) row = writeTable(ws, row, t.caption, `From ${t.by}`, t.table, widths);
    applyWidths(ws, widths);
    contents.push(["Specialist tables", `${specialistTables.length} table(s) from the specialists' outputs`]);
  }
  for (const [name, what] of contents) {
    r++;
    const cell = sum.getCell(r, 1);
    cell.value = { text: name, hyperlink: `#'${name}'!A1` };
    cell.font = { color: { argb: "FF0563C1" }, underline: true };
    sum.getCell(r, 2).value = what;
  }

  if (brand.logo) {
    const { w, h } = fitLogo(brand.logo, 200, 60);
    const image = wb.addImage({ buffer: brand.logo.data as unknown as ExcelJS.Buffer, extension: brand.logo.type === "image/png" ? "png" : "jpeg" });
    sum.addImage(image, { tl: { col: 1.55, row: 0.1 }, ext: { width: w, height: h } });
    sum.getRow(1).height = Math.max(20, h * 0.75 + 4);
  }
  applyBrand(wb, brand);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
