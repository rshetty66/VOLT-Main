import ExcelJS from "exceljs";
import type { ExportRequest, ExportTable, ValueCaseModel } from "../../shared/export.js";
import { cellValue, markdownBlocks, plain } from "./blocks.js";
import { TONE_STYLE, toneFor } from "../../shared/brand.js";
import { BRAND, brandLogo } from "./brand.js";
import type { ExportStyle } from "./style.js";
import { safeFormula } from "../../shared/files.js";

/**
 * The Excel workbook, laid out the way a consulting model is: a cover with the answer and a linked sheet index, a live
 * value-case model (blue inputs, formula calculations, outputs with a check against VOLT's own result), one formatted
 * sheet per exhibit, and the narrative last as notes.
 */

const INPUT_INK = "FF0000FF";
const INPUT_FILL = "FFFFF2CC";
const RULE = "FFBFC5D2";
const BAND = "FFF4F6FA";
const MUTED = "FF5B6862";

/** Sheet names: at most 31 characters, cut at a word, none of []:*?/\ and unique within the workbook. */
function sheetNamer() {
  const used = new Set<string>();
  return (raw: string) => {
    const clean = raw.replace(/^exhibit\s+(\d+)\s*[:.\-\u2013\u2014]?\s*/i, "Ex$1 ").replace(/[[\]:*?/\\']/g, " ").replace(/\s+/g, " ").trim();
    const cut = clean.length <= 31 ? clean : clean.slice(0, 31).replace(/\s+\S*$/, "");
    const base = cut || "Sheet";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - ` (${n})`.length)} (${n})`;
    used.add(name.toLowerCase());
    return name;
  };
}

/** A number format by size: whole thousands with separators, negatives in brackets; small values keep two decimals. */
function numFmt(v: number): string {
  if (Number.isInteger(v)) return Math.abs(v) >= 1000 ? "#,##0;(#,##0)" : "0;(0)";
  return Math.abs(v) >= 1000 ? "#,##0;(#,##0)" : "#,##0.00;(#,##0.00)";
}

function sheetSetup(ws: ExcelJS.Worksheet) {
  ws.views = [{ showGridLines: false }];
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } };
}

function titleRows(ws: ExcelJS.Worksheet, title: string, note: string | undefined, s: ExportStyle) {
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { name: s.headingFont, size: 14, bold: true, color: { argb: `FF${s.headingColor}` } };
  if (note) {
    const n = ws.getCell("A2");
    n.value = note;
    n.font = { name: s.bodyFont, italic: true, size: 10, color: { argb: MUTED } };
  }
}

function headerCell(c: ExcelJS.Cell, s: ExportStyle) {
  c.font = { name: s.bodyFont, bold: true, color: { argb: `FF${s.headerInk}` } };
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${s.headerFill}` } };
  c.alignment = { vertical: "middle", wrapText: true };
}

/**
 * One exhibit: a styled header, typed and formatted cells, banded rows, a bold total row, filter and frozen header. The
 * header stays on row 1, so formulas an agent writes ("=B2*C2" for the first data row) point at the right cells.
 */
function addTable(ws: ExcelJS.Worksheet, t: ExportTable, s: ExportStyle) {
  sheetSetup(ws);
  const top = 1;
  const header = ws.getRow(top);
  t.columns.forEach((h, i) => {
    const c = header.getCell(i + 1);
    c.value = h;
    headerCell(c, s);
    // A column of numbers gets a right-aligned header, over its figures.
    if (t.rows.length && t.rows.every((r) => r[i] === null || typeof r[i] === "number" || typeof cellValue(String(r[i])).value === "number")) c.alignment = { ...c.alignment, horizontal: "right" };
  });
  header.height = 20;
  t.rows.forEach((r, k) => {
    const row = ws.getRow(top + 1 + k);
    const total = /^(total|overall|net|npv)\b/i.test(String(r[0] ?? "").trim());
    t.columns.forEach((col, i) => {
      const raw = r[i];
      const cell = row.getCell(i + 1);
      if (typeof raw === "number") {
        cell.value = raw;
        cell.numFmt = /%/.test(col) && Math.abs(raw) <= 1 ? "0.0%" : numFmt(raw);
      } else if (raw === null || raw === undefined) cell.value = null;
      else if (safeFormula(raw)) cell.value = { formula: raw.slice(1) } as ExcelJS.CellFormulaValue;
      else {
        const v = cellValue(raw);
        cell.value = v.value;
        // Percent and currency keep their own format; a plain number gets the sheet's (no stray decimal point).
        if (typeof v.value === "number") cell.numFmt = v.format && /[%"]/.test(v.format) ? v.format : numFmt(v.value);
      }
      const tone = s.brand && typeof raw === "string" ? toneFor(col, raw) : null;
      cell.font = { name: s.bodyFont, bold: total || !!tone, color: tone ? { argb: `FF${TONE_STYLE[tone].ink}` } : undefined };
      if (tone) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${TONE_STYLE[tone].fill}` } };
      else if (k % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BAND } };
      cell.border = total ? { top: { style: "thin", color: { argb: "FF000000" } } } : { bottom: { style: "hair", color: { argb: RULE } } };
      cell.alignment = { vertical: "top", wrapText: typeof cell.value === "string" };
    });
  });
  t.columns.forEach((h, i) => {
    const longest = Math.max(h.length, ...t.rows.map((r) => String(r[i] ?? "").length));
    ws.getColumn(i + 1).width = Math.min(48, Math.max(10, longest + 2));
  });
  ws.views = [{ state: "frozen", ySplit: top, showGridLines: false }];
  if (t.rows.length) ws.autoFilter = { from: { row: top, column: 1 }, to: { row: top + t.rows.length, column: t.columns.length } };
}

/**
 * The value case as a live model. Inputs (blue on yellow) drive a yearly calculation in formulas; the outputs are
 * Excel's own NPV, IRR and payback, with a check row that compares them to the result VOLT's tool returned.
 */
function addModel(ws: ExcelJS.Worksheet, m: ValueCaseModel, s: ExportStyle) {
  sheetSetup(ws);
  titleRows(ws, "Value case model", "Change the blue inputs; every other figure recalculates.", s);
  const label = (r: number, text: string, bold = false) => {
    const c = ws.getCell(r, 1);
    c.value = text;
    c.font = { name: s.bodyFont, bold };
  };
  const section = (r: number, text: string, cols: number) => {
    for (let c = 1; c <= cols; c++) headerCell(ws.getCell(r, c), s);
    ws.getCell(r, 1).value = text;
  };
  const years = m.horizonYears;
  const last = 2 + years; // year 0 in column B, year N in the last column
  const col = (c: number) => ws.getColumn(c).letter;
  const L = col(last);

  // Inputs, rows 5 to 11.
  section(4, "Inputs", 3);
  const inputs: [string, number, string, string][] = [
    ["Finance FTEs", m.financeFtes, "#,##0", "FTE"],
    ["Loaded cost per FTE", m.loadedCostPerFte, "#,##0", "a year"],
    ["Capacity released at steady state", m.automationPct / 100, "0.0%", "of finance effort"],
    ["One-time investment", m.oneTimeInvestment, "#,##0", ""],
    ["Annual run cost", m.annualRunCost, "#,##0", "from year 1"],
    ["Years to full benefit", m.rampYears, "0.0", "linear ramp"],
    ["Discount rate", m.discountRate, "0.0%", ""],
  ];
  inputs.forEach(([name, v, fmt, unit], i) => {
    const r = 5 + i;
    label(r, name);
    const c = ws.getCell(r, 2);
    c.value = v;
    c.numFmt = fmt;
    c.font = { name: s.bodyFont, color: { argb: INPUT_INK } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
    c.border = { top: { style: "hair", color: { argb: RULE } }, bottom: { style: "hair", color: { argb: RULE } }, left: { style: "hair", color: { argb: RULE } }, right: { style: "hair", color: { argb: RULE } } };
    ws.getCell(r, 3).value = unit;
    ws.getCell(r, 3).font = { name: s.bodyFont, color: { argb: MUTED } };
  });
  const [FTE, COST, PCT, INV, RUN, RAMP, RATE] = ["$B$5", "$B$6", "$B$7", "$B$8", "$B$9", "$B$10", "$B$11"];

  // Calculations, rows 14 to 20.
  section(14, "Calculations", last);
  for (let y = 0; y <= years; y++) {
    const c = ws.getCell(14, 2 + y);
    c.value = y === 0 ? "Year 0" : `Year ${y}`;
    c.alignment = { horizontal: "right" };
  }
  const rows: [string, (y: number, c: string) => string | null, string, boolean?][] = [
    ["Benefit realised", (y, c) => (y === 0 ? null : `MIN(1,${y}/${RAMP})`), "0%"],
    ["Gross benefit", (y, c) => (y === 0 ? null : `${FTE}*${PCT}*${COST}*${c}15`), "#,##0;(#,##0)"],
    ["Run cost", (y) => (y === 0 ? null : `-${RUN}`), "#,##0;(#,##0)"],
    ["Investment", (y) => (y === 0 ? `-${INV}` : null), "#,##0;(#,##0)"],
    ["Net cash flow", (y, c) => `SUM(${c}16:${c}18)`, "#,##0;(#,##0)", true],
    ["Cumulative cash", (y, c) => (y === 0 ? `${c}19` : `${col(1 + y)}20+${c}19`), "#,##0;(#,##0)"],
  ];
  rows.forEach(([name, f, fmt, bold], i) => {
    const r = 15 + i;
    label(r, name, bold);
    for (let y = 0; y <= years; y++) {
      const c = ws.getCell(r, 2 + y);
      const formula = f(y, col(2 + y));
      c.value = formula ? ({ formula } as ExcelJS.CellFormulaValue) : null;
      c.numFmt = fmt;
      c.font = { name: s.bodyFont, bold };
      if (bold) c.border = { top: { style: "thin", color: { argb: "FF000000" } } };
    }
  });

  // Outputs, rows 23 to 28, with the check against the tool's own result.
  section(23, "Outputs", 3);
  const flows = `C19:${L}19`;
  const hit = `MATCH(TRUE,INDEX(C20:${L}20>=0,0),0)`;
  const outputs: [string, string, string, string][] = [
    ["Capacity released (FTE)", `${FTE}*${PCT}`, "0.0", ""],
    ["Steady-state annual saving", `${FTE}*${PCT}*${COST}`, "#,##0;(#,##0)", ""],
    ["NPV", `B19+NPV(${RATE},${flows})`, "#,##0;(#,##0)", ""],
    ["IRR", `IFERROR(IRR(B19:${L}19),"n/a")`, "0.0%", ""],
    ["Payback (years)", `IFERROR(${hit}-1-INDEX(B20:${L}20,${hit})/INDEX(${flows},${hit}),"Not within ${years} years")`, "0.00", ""],
  ];
  outputs.forEach(([name, formula, fmt], i) => {
    const r = 24 + i;
    label(r, name, name === "NPV");
    const c = ws.getCell(r, 2);
    c.value = { formula } as ExcelJS.CellFormulaValue;
    c.numFmt = fmt;
    c.font = { name: s.bodyFont, bold: name === "NPV" };
  });
  label(30, "Check: NPV as VOLT calculated it");
  ws.getCell(30, 2).value = m.npv;
  ws.getCell(30, 2).numFmt = "#,##0;(#,##0)";
  label(31, "Check: model agrees (within 1)");
  ws.getCell(31, 2).value = { formula: "ABS(B26-B30)<=1" } as ExcelJS.CellFormulaValue;
  [30, 31].forEach((r) => [1, 2].forEach((c) => (ws.getCell(r, c).font = { name: s.bodyFont, color: { argb: MUTED } })));

  ws.getColumn(1).width = 36;
  for (let c = 2; c <= last; c++) ws.getColumn(c).width = 14;
  ws.getColumn(3).width = Math.max(14, ws.getColumn(3).width ?? 14);
}

const logoIds = new WeakMap<ExcelJS.Workbook, number>();

/** A dark band with the VOLT logo across the top of the cover (only when no client template is selected). Returns the rows used. */
function brandBand(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, s: ExportStyle, cols: number): number {
  const logo = s.brand ? brandLogo() : null;
  if (!logo) return 0;
  for (let r = 1; r <= 4; r++) {
    ws.getRow(r).height = 20;
    for (let c = 1; c <= cols; c++) ws.getCell(r, c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${BRAND.cover}` } };
  }
  let id = logoIds.get(wb);
  if (id === undefined) logoIds.set(wb, (id = wb.addImage({ base64: logo.png.toString("base64"), extension: "png" })));
  const height = 72;
  ws.addImage(id, { tl: { col: 0.15, row: 0.1 }, ext: { width: Math.round((height * logo.width) / logo.height), height } });
  return 4;
}

/** Cover, value-case model, one sheet per exhibit, notes. */
export async function writeXlsx(req: ExportRequest, s: ExportStyle): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VOLT Console";
  wb.title = req.title;
  // Formulas are written without cached results; Excel and LibreOffice calculate them on open.
  wb.calcProperties.fullCalcOnLoad = true;
  const name = sheetNamer();
  const blocks = markdownBlocks(req.markdown);

  const cover = wb.addWorksheet(name("Cover"));

  // The exhibits: each markdown table under the heading it sits beneath, then the run's own data tables.
  let heading = "";
  let n = 0;
  const exhibits: { title: string; table: ExportTable }[] = [];
  for (const b of blocks) {
    if (b.type === "heading") heading = b.text;
    else if (b.type === "table") exhibits.push({ title: heading || `Table ${++n}`, table: { name: heading, columns: b.header, rows: b.rows } });
  }
  const index: { sheet: string; what: string }[] = [];
  // Live models first, then the report's exhibits in order, then the run's other data sheets.
  for (const t of (req.tables ?? []).filter((x) => x.model)) {
    const sheet = name("Value case model");
    addModel(wb.addWorksheet(sheet), t.model!, s);
    index.push({ sheet, what: "Live model: change the inputs, NPV, IRR and payback recalculate" });
  }
  for (const { title, table } of [...exhibits, ...(req.tables ?? []).filter((x) => !x.model).map((t) => ({ title: t.name, table: t }))]) {
    const sheet = name(title);
    addTable(wb.addWorksheet(sheet), table, s);
    index.push({ sheet, what: title });
  }

  // Notes: the narrative, for reference, with headings in bold.
  const prose = blocks.filter((b) => b.type !== "table");
  if (prose.length) {
    const sheet = name("Notes");
    const ws = wb.addWorksheet(sheet);
    sheetSetup(ws);
    titleRows(ws, "Notes", "The narrative behind the exhibits; the report itself is the Word, PowerPoint or HTML file.", s);
    ws.getColumn(1).width = 110;
    let r = 4;
    for (const b of prose) {
      const text = b.type === "heading" ? b.text : b.type === "paragraph" || b.type === "quote" ? plain(b.runs) : b.type === "list" ? b.items.map((it) => `- ${plain(it.runs)}`).join("\n") : "";
      if (!text) continue;
      const c = ws.getCell(r++, 1);
      c.value = text;
      c.alignment = { wrapText: true, vertical: "top" };
      c.font = b.type === "heading" ? { name: s.headingFont, bold: true, size: b.depth <= 2 ? 12 : 11, color: { argb: `FF${s.headingColor}` } } : { name: s.bodyFont };
      if (b.type === "heading" && r > 5) ws.getRow(r - 1).height = 22;
    }
    index.push({ sheet, what: "The narrative behind the exhibits" });
  }

  // Cover: the answer, then a linked index of the sheets.
  sheetSetup(cover);
  const top = brandBand(wb, cover, s, 3);
  const put = (r: number, v: string, font: Partial<ExcelJS.Font>) => {
    const c = cover.getCell(r, 1);
    c.value = v;
    c.font = { name: s.bodyFont, ...font };
    c.alignment = { wrapText: true, vertical: "top" };
    cover.mergeCells(r, 1, r, 3);
  };
  let r = top + 2;
  put(r++, req.title, { name: s.headingFont, size: 16, bold: true, color: { argb: `FF${s.headingColor}` } });
  cover.getRow(r - 1).height = 42;
  put(r++, req.subtitle ?? `Prepared ${new Date().toISOString().slice(0, 10)}`, { italic: true, color: { argb: MUTED } });
  const lead = blocks.find((b) => b.type === "paragraph");
  if (lead && lead.type === "paragraph") {
    r++;
    put(r, plain(lead.runs), { size: 11 });
    cover.getRow(r++).height = 48;
  }
  r++;
  ["Sheet", "What it holds"].forEach((h, i) => {
    const c = cover.getCell(r, i + 1);
    headerCell(c, s);
    c.value = h;
  });
  headerCell(cover.getCell(r, 3), s);
  r++;
  for (const it of index) {
    const c = cover.getCell(r, 1);
    // A HYPERLINK formula jumps within the workbook in Excel and LibreOffice alike.
    c.value = { formula: `HYPERLINK("#'${it.sheet}'!A1","${it.sheet.replace(/"/g, '""')}")`, result: it.sheet } as ExcelJS.CellFormulaValue;
    c.font = { name: s.bodyFont, color: { argb: `FF${s.headingColor}` }, underline: true };
    cover.getCell(r, 2).value = it.what;
    cover.getCell(r, 2).font = { name: s.bodyFont };
    [1, 2, 3].forEach((k) => (cover.getCell(r, k).border = { bottom: { style: "hair", color: { argb: RULE } } }));
    r++;
  }
  if (index.some((i) => i.what.startsWith("Live model"))) {
    r++;
    const c = cover.getCell(r, 1);
    c.value = "Input";
    c.font = { name: s.bodyFont, color: { argb: INPUT_INK } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
    cover.getCell(r, 2).value = "Blue on yellow is an input; black figures are formulas.";
    cover.getCell(r, 2).font = { name: s.bodyFont, color: { argb: MUTED } };
  }
  cover.getColumn(1).width = 34;
  cover.getColumn(2).width = 70;
  cover.getColumn(3).width = 12;

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
