/**
 * Files VOLT makes on request. The agent's create_file call carries the content; the console builds the file with the
 * same writers as the Download menu (so charts, process flows and client templates come out the same) and shows it
 * as a download card in the chat.
 */
import type { ExportTable } from "./export.js";
import type { HubContent } from "./accountingHub.js";

export const FILE_FORMATS = ["docx", "pptx", "xlsx", "csv", "html", "slides", "pdf", "md"] as const;
export type FileFormat = (typeof FILE_FORMATS)[number];

export const FILE_LABEL: Record<FileFormat, string> = {
  docx: "Word report",
  pptx: "PowerPoint deck",
  xlsx: "Excel workbook",
  csv: "CSV data",
  html: "Interactive web page",
  slides: "HTML slide deck",
  pdf: "PDF report",
  md: "Markdown",
};

export interface FileSpec {
  format: FileFormat;
  title: string;
  subtitle?: string;
  markdown: string;
  tables?: ExportTable[];
  templateId?: string;
  /** An Accounting Hub page: drawn from this content instead of the markdown. */
  hub?: HubContent;
}

/**
 * Functions an agent-written Excel formula may use. Anything else (HYPERLINK, WEBSERVICE, external links, DDE) stays
 * text, so a workbook VOLT makes can calculate but never reach out of the file.
 */
const SAFE_FUNCTIONS = new Set(
  "SUM SUMIF SUMIFS SUMPRODUCT AVERAGE AVERAGEIF MIN MAX COUNT COUNTA COUNTIF COUNTIFS ROUND ROUNDUP ROUNDDOWN ABS IF IFS IFERROR AND OR NOT NPV IRR XNPV XIRR PMT PV FV RATE NPER INDEX MATCH VLOOKUP HLOOKUP XLOOKUP CHOOSE MEDIAN STDEV PRODUCT POWER SQRT LN EXP YEAR MONTH DATE EOMONTH EDATE".split(" "),
);

/** True when `s` is "=" plus a formula built only from cell references, numbers, operators and the safe functions. */
export function safeFormula(s: string): boolean {
  if (!s.startsWith("=") || s.length > 500) return false;
  const body = s.slice(1);
  if (!/^[A-Za-z0-9_$:.,+\-*/^()%<>=&" !']*$/.test(body)) return false;
  const fns = [...body.matchAll(/([A-Za-z][A-Za-z0-9.]*)\s*\(/g)].map((m) => m[1].toUpperCase());
  return fns.every((f) => SAFE_FUNCTIONS.has(f));
}

/** One CSV text per table (RFC 4180 quoting). Text that a spreadsheet would run as a formula is prefixed with "'". */
export function csvText(t: ExportTable): string {
  const cell = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v);
    const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns, ...t.rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

