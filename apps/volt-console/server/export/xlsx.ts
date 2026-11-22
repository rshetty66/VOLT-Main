import ExcelJS from "exceljs";
import type { ExportRequest } from "../../shared/export.js";
import { cellValue, markdownBlocks, plain } from "./blocks.js";
import type { ExportStyle } from "./style.js";

/** Sheet names: at most 31 characters, none of []:*?/\ and unique within the workbook. */
function sheetNamer() {
  const used = new Set<string>();
  return (raw: string) => {
    const base = raw.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Sheet";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base.slice(0, 31 - ` (${n})`.length)} (${n})`;
    used.add(name.toLowerCase());
    return name;
  };
}

function addTable(wb: ExcelJS.Workbook, name: string, columns: string[], rows: (string | number | null)[][], s: ExportStyle) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  const header = ws.addRow(columns);
  header.eachCell((c) => {
    c.font = { name: s.bodyFont, bold: true, color: { argb: `FF${s.headerInk}` } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${s.headerFill}` } };
    c.alignment = { vertical: "middle" };
  });
  for (const r of rows) {
    const row = ws.addRow(columns.map((_, i) => null));
    columns.forEach((_, i) => {
      const raw = r[i];
      const cell = row.getCell(i + 1);
      if (typeof raw === "number" || raw === null || raw === undefined) cell.value = raw ?? null;
      else {
        const v = cellValue(raw);
        cell.value = v.value;
        if (v.format) cell.numFmt = v.format;
      }
      cell.font = { name: s.bodyFont };
    });
  }
  ws.columns.forEach((col, i) => {
    const longest = Math.max(columns[i]?.length ?? 0, ...rows.map((r) => String(r[i] ?? "").length));
    col.width = Math.min(60, Math.max(10, longest + 2));
  });
  return ws;
}

/** Summary sheet, one sheet per markdown table (named after its section) and one per structured table. */
export async function writeXlsx(req: ExportRequest, s: ExportStyle): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "VOLT Console";
  wb.title = req.title;
  const name = sheetNamer();

  const summary = wb.addWorksheet(name("Summary"));
  summary.addRow([req.title]).font = { name: s.headingFont, size: 16, bold: true, color: { argb: `FF${s.headingColor}` } };
  if (req.subtitle) summary.addRow([req.subtitle]).font = { name: s.bodyFont, italic: true };
  summary.addRow([`Generated ${new Date().toISOString().slice(0, 10)}`]).font = { name: s.bodyFont, color: { argb: "FF5B6862" } };
  summary.addRow([]);
  const head = summary.addRow(["Section", "Content"]);
  head.eachCell((c) => {
    c.font = { name: s.bodyFont, bold: true, color: { argb: `FF${s.headerInk}` } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${s.headerFill}` } };
  });
  summary.getColumn(1).width = 32;
  summary.getColumn(2).width = 100;

  let section = "Summary";
  let tableNo = 0;
  const tables: { name: string; header: string[]; rows: string[][] }[] = [];
  for (const b of markdownBlocks(req.markdown)) {
    if (b.type === "heading") section = b.text;
    else if (b.type === "paragraph" || b.type === "quote") summary.addRow([section, plain(b.runs)]);
    else if (b.type === "list") b.items.forEach((it) => summary.addRow([section, `- ${plain(it.runs)}`]));
    else if (b.type === "table") tables.push({ name: section === "Summary" ? `Table ${++tableNo}` : section, header: b.header, rows: b.rows });
  }
  summary.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  summary.eachRow((r) => r.eachCell((c) => (c.font = c.font ?? { name: s.bodyFont })));

  for (const t of tables) addTable(wb, name(t.name), t.header, t.rows, s);
  for (const t of req.tables ?? []) addTable(wb, name(t.name), t.columns, t.rows, s);

  return new Uint8Array(await wb.xlsx.writeBuffer());
}
