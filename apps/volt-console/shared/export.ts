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

export interface ExportTable {
  name: string;
  columns: string[];
  rows: (string | number | null)[][];
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

export function exportFileName(title: string, ext: string, date = new Date()): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "volt";
  return `volt-${slug}-${date.toISOString().slice(0, 10)}.${ext}`;
}
