// Rebuilds server/knowledge/apqc-pcf.json from APQC's flat Excel PCF (Cross-Industry), keeping APQC's copyright notice.
//   npx tsx scripts/import-apqc-pcf.ts <path-to-APQC_PCF_Cross-Industry_vX.xlsx>
// Reads the "Combined" sheet (every process element), the "Metrics" sheet (metric definitions, no benchmark values),
// the version from "Introduction" and the notice from "Copyright and Attribution". The xlsx itself is not committed.
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const src = process.argv[2];
if (!src) {
  console.error("Usage: npx tsx scripts/import-apqc-pcf.ts <APQC_PCF_Cross-Industry.xlsx>");
  process.exit(1);
}
const out = path.resolve(import.meta.dirname, "../server/knowledge/apqc-pcf.json");

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v) return v.richText.map((r) => r.text).join("");
  return String(v);
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const rows = (ws: ExcelJS.Worksheet) => {
  const all: string[][] = [];
  ws.eachRow((row) => all.push((row.values as ExcelJS.CellValue[]).slice(1).map((v) => clean(text(v)))));
  return all;
};

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(src);
const sheet = (name: string) => {
  const ws = wb.getWorksheet(name);
  if (!ws) throw new Error(`Sheet '${name}' not found in ${src}`);
  return ws;
};

const intro = rows(sheet("Introduction")).flat();
const version = intro.find((c) => /^VERSION NUMBER/i.test(c))?.replace(/^VERSION NUMBER\s*/i, "") ?? "";
const generated = intro.find((c) => /^GENERATED ON/i.test(c))?.replace(/^GENERATED ON\s*/i, "") ?? "";
const notice = rows(sheet("Copyright and Attribution")).flat().find((c) => /APQC\. ALL RIGHTS RESERVED/i.test(c));
if (!version || !notice) throw new Error("Version or APQC copyright notice not found: refusing to write the file without the notice.");

// Combined: PCF ID, Hierarchy ID, Name, Difference Index, Change Details, Metrics Available?, Element Description
const [elHead, ...elRows] = rows(sheet("Combined"));
if (elHead[0] !== "PCF ID" || elHead[1] !== "Hierarchy ID" || elHead[6] !== "Element Description") throw new Error(`Unexpected Combined header: ${elHead.join(" | ")}`);
const elements = elRows.filter((r) => r[0]).map((r) => [Number(r[0]), r[1], r[2], r[6], r[5] === "Y" ? 1 : 0] as const);

// Metrics: Process Element ID, Hierarchy ID, Process Element, Metric Category, Metric ID, Metric Name, Formula, Units
const [mHead, ...mRows] = rows(sheet("Metrics"));
if (mHead[0] !== "Process Element ID" || mHead[5] !== "Metric Name") throw new Error(`Unexpected Metrics header: ${mHead.join(" | ")}`);
const metrics = mRows.filter((r) => r[0] && r[4]).map((r) => [Number(r[0]), r[3], Number(r[4]), r[5], r[6], r[7]] as const);

// One element or metric per line, so a new PCF release diffs line by line.
const lines = [
  "{",
  `"source": ${JSON.stringify({ name: "APQC Process Classification Framework (PCF), Cross-Industry", version, generated, notice })},`,
  `"elementColumns": ["pcfId", "hierarchyId", "name", "description", "metricsAvailable"],`,
  `"elements": [\n${elements.map((e) => JSON.stringify(e)).join(",\n")}\n],`,
  `"metricColumns": ["pcfId", "category", "metricId", "name", "formula", "units"],`,
  `"metrics": [\n${metrics.map((m) => JSON.stringify(m)).join(",\n")}\n]`,
  "}",
];
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${lines.join("\n")}\n`);
console.log(`Wrote ${elements.length} process elements and ${metrics.length} metric definitions (PCF ${version}) to ${path.relative(process.cwd(), out)}`);
