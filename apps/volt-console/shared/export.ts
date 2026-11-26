/** Download request sent by the console to POST /api/export (Word, PowerPoint or Excel). */

export type ExportFormat = "docx" | "pptx" | "xlsx";

export interface ExportImage {
  /** "chart-<n>" for a chart (placed in a Results section) or "diagram-<n>" for the n-th mermaid block in the markdown. */
  ref: string;
  /** PNG bytes, base64 (no data: prefix). */
  png: string;
  /** Natural size in px, used to keep the aspect ratio. */
  width: number;
  height: number;
  caption?: string;
}

/** A value case's inputs and the tool's results: Excel rebuilds it as a live model (inputs, calculations, outputs). */
export interface ValueCaseModel {
  financeFtes: number;
  loadedCostPerFte: number;
  /** 0 to 100. */
  automationPct: number;
  oneTimeInvestment: number;
  annualRunCost: number;
  rampYears: number;
  horizonYears: number;
  /** A decimal, such as 0.08. */
  discountRate: number;
  npv: number;
  irrPct: number | null;
  paybackYears: number | null;
}

export interface ExportTable {
  name: string;
  columns: string[];
  rows: (string | number | null)[][];
  /** Set on a value case: Excel writes the live model instead of the static rows (CSV keeps the rows). */
  model?: ValueCaseModel;
}

export interface ExportRequest {
  format: ExportFormat;
  title: string;
  subtitle?: string;
  markdown: string;
  images?: ExportImage[];
  /** Structured data written as extra Excel sheets (for example benchmark and value-case results). */
  tables?: ExportTable[];
  /** Uploaded template whose fonts, colours and page setup the file follows. */
  templateId?: string;
}

export const EXPORT_MIME: Record<ExportFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * The naming convention for every file VOLT hands out: VOLT_<Client>_<Deliverable>_<YYYY-MM-DD>_v<N>.<ext>, for example
 * VOLT_TD-Bank_Close-Acceleration-Plan_2026-11-26_v2.pptx. Fields are separated by "_", words inside a field by "-",
 * so the name sorts by client, then deliverable, then date, and is safe on Windows, macOS and SharePoint. The client
 * is the project's name (left out in the General project); the deliverable is the title's first six meaningful words;
 * the date is the local calendar date; N counts different versions of the same deliverable on the same day.
 */
const SMALL = new Set("a an and the of on in for to by with from at as is are be i we our my your their its each this that these those".split(" "));

/** A name field: up to `maxWords` meaningful words of `s`, capitalised, joined by "-", at most `maxLen` characters. */
export function nameField(s: string, maxWords = 6, maxLen = 50): string {
  const words = (s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z0-9]+/g) ?? []).filter((w) => !SMALL.has(w.toLowerCase()));
  let out = "";
  for (const w of words.slice(0, maxWords)) {
    const word = w[0].toUpperCase() + w.slice(1);
    if (out && out.length + 1 + word.length > maxLen) break;
    out = out ? `${out}-${word}` : word.slice(0, maxLen);
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, "0");
/** YYYY-MM-DD in the local time zone, so an evening download in Toronto is not dated tomorrow. */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** The name without its version and extension: VOLT_<Client>_<Deliverable>_<YYYY-MM-DD>. */
export function fileBase(title: string, client = "", date = new Date()): string {
  const c = nameField(client, 4, 30);
  return ["VOLT", ...(c && c.toLowerCase() !== "general" ? [c] : []), nameField(title) || "Deliverable", localDate(date)].join("_");
}

export function exportFileName(title: string, ext: string, opts: { client?: string; version?: number; date?: Date } = {}): string {
  return `${fileBase(title, opts.client, opts.date)}_v${opts.version ?? 1}.${ext}`;
}
