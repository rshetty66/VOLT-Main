/**
 * Client files: CSV, Excel, PDF and Word documents uploaded to an engagement.
 *
 * The original bytes and the text extracted from them are kept in the local
 * database (deleting the engagement deletes them). Agents never see the bytes:
 * they read the extracted text, a part at a time, through read_client_file,
 * wrapped as untrusted data (see orchestrator.ts).
 */
import crypto from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import type { ClientFile, FileKind } from "../shared/records.js";
import type { Db } from "./db.js";

export const FILE_LIMITS = {
  /** Largest upload accepted. */
  maxBytes: 10 * 1024 * 1024,
  /** Files per engagement. */
  maxFiles: 25,
  /** Extracted text kept per file; the rest is dropped and the file marked truncated. */
  maxChars: 400_000,
  /** Rows kept per CSV file or Excel sheet. */
  maxRows: 5_000,
  /** One read_client_file part. */
  partChars: 12_000,
} as const;

export const ACCEPTED = ".csv, .xlsx, .pdf, .docx";

export class FileError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ── Recognising and reading files ────────────────────────────────────────────

/** The kind of a file from its name and its first bytes; both must agree. */
export async function detectKind(name: string, bytes: Buffer): Promise<FileKind> {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  const zip = bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (ext === "pdf") {
    if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
    throw new FileError(415, `${name} is not a PDF file.`);
  }
  if (ext === "xlsx" || ext === "docx") {
    const part = ext === "xlsx" ? "xl/workbook.xml" : "word/document.xml";
    if (zip) {
      const z = await JSZip.loadAsync(bytes).catch(() => null);
      if (z?.file(part)) return ext;
    }
    throw new FileError(415, `${name} is not a valid ${ext === "xlsx" ? "Excel workbook" : "Word document"} (.${ext}). Older .xls and .doc files must be saved in the newer format first.`);
  }
  if (ext === "csv") {
    if (bytes.includes(0) || zip) throw new FileError(415, `${name} does not look like a text CSV file.`);
    return "csv";
  }
  throw new FileError(415, `${name}: only ${ACCEPTED} files can be uploaded.`);
}

const csvField = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvLine = (cells: string[]) => cells.map(csvField).join(",");

/** Parses CSV text (comma or semicolon separated, quoted fields allowed). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.slice(0, src.indexOf("\n") >>> 0);
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, v.getUTCHours() || v.getUTCMinutes() ? 16 : 10);
  if (typeof v === "object") {
    if ("result" in v) return cellText((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    if ("text" in v) return String((v as ExcelJS.CellHyperlinkValue).text);
    if ("error" in v) return String((v as ExcelJS.CellErrorValue).error);
    return "";
  }
  return String(v);
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unxml = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) =>
    e.startsWith("#x") ? String.fromCodePoint(parseInt(e.slice(2), 16)) : e.startsWith("#") ? String.fromCodePoint(Number(e.slice(1))) : (XML_ENTITIES[e] ?? m),
  );

/** The visible text of one Word paragraph, with tabs and line breaks. */
function paragraphText(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g)) {
    out += m[1] !== undefined ? unxml(m[1]) : m[0] === "<w:tab/>" ? "\t" : "\n";
  }
  return out;
}

/** Word body as Markdown-ish text: headings, paragraphs and tables as pipe tables. */
export async function docxText(bytes: Buffer): Promise<{ text: string; paragraphs: number; tables: number }> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  const body = xml.slice(xml.indexOf("<w:body"), xml.lastIndexOf("</w:body>"));
  const lines: string[] = [];
  let paragraphs = 0;
  let tables = 0;
  for (const m of body.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p(?:\s[^>]*)?\/>/g)) {
    const block = m[0];
    if (block.startsWith("<w:tbl>")) {
      tables++;
      const rows = [...block.matchAll(/<w:tr[ >][\s\S]*?<\/w:tr>/g)].map((r) =>
        [...r[0].matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map((c) =>
          [...c[0].matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map((p) => paragraphText(p[0])).join(" ").replace(/\|/g, "/").trim(),
        ),
      );
      if (rows.length) {
        const width = Math.max(...rows.map((r) => r.length));
        const pad = (r: string[]) => `| ${[...r, ...Array(width - r.length).fill("")].join(" | ")} |`;
        lines.push("", pad(rows[0]), `|${" --- |".repeat(width)}`, ...rows.slice(1).map(pad), "");
      }
      continue;
    }
    const text = paragraphText(block).trim();
    if (!text) continue;
    paragraphs++;
    const level = block.match(/<w:pStyle w:val="(?:Heading|heading|Titre|berschrift)\s?(\d)"/)?.[1];
    const title = /<w:pStyle w:val="Title"/.test(block);
    lines.push(level ? `${"#".repeat(Math.min(6, Number(level) + 1))} ${text}` : title ? `# ${text}` : text);
  }
  return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), paragraphs, tables };
}

const plural = (n: number, word: string) => `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;

/** Extracts what agents read: CSV as CSV, sheets as CSV under a heading each, documents as text. */
export async function extract(kind: FileKind, bytes: Buffer): Promise<{ text: string; summary: string; truncated: boolean }> {
  let text = "";
  let summary = "";
  let truncated = false;
  if (kind === "csv") {
    const rows = parseCsv(bytes.toString("utf8"));
    truncated = rows.length > FILE_LIMITS.maxRows;
    const kept = rows.slice(0, FILE_LIMITS.maxRows);
    text = kept.map(csvLine).join("\n");
    summary = `CSV, ${plural(Math.max(0, rows.length - 1), "row")} × ${plural(rows[0]?.length ?? 0, "column")}`;
  } else if (kind === "xlsx") {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const parts: string[] = [];
    let total = 0;
    const sheets = wb.worksheets.filter((ws) => ws.state === "visible" && ws.actualRowCount > 0);
    for (const ws of sheets) {
      const rows: string[][] = [];
      ws.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        for (let c = 1; c <= ws.actualColumnCount; c++) cells.push(cellText(row.getCell(c).value));
        while (cells.length && cells.at(-1) === "") cells.pop();
        if (cells.length) rows.push(cells);
      });
      if (rows.length > FILE_LIMITS.maxRows) truncated = true;
      total += rows.length;
      parts.push(`## Sheet: ${ws.name} (${plural(rows.length, "row")})\n${rows.slice(0, FILE_LIMITS.maxRows).map(csvLine).join("\n")}`);
    }
    text = parts.join("\n\n");
    summary = `Excel, ${plural(sheets.length, "sheet")}, ${plural(total, "row")}`;
  } else if (kind === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text: pages } = await extractText(pdf, { mergePages: false });
    text = pages.map((p, i) => `## Page ${i + 1}\n${p.trim()}`).join("\n\n");
    if (!pages.some((p) => p.trim())) throw new FileError(422, "No text could be read from this PDF. It may be a scanned image; reading scans (OCR) is not supported.");
    summary = `PDF, ${plural(totalPages, "page")}`;
  } else {
    const d = await docxText(bytes);
    if (!d.text) throw new FileError(422, "No text could be read from this Word document.");
    text = d.text;
    summary = `Word, ${plural(d.paragraphs, "paragraph")}${d.tables ? `, ${plural(d.tables, "table")}` : ""}`;
  }
  if (text.length > FILE_LIMITS.maxChars) {
    text = text.slice(0, FILE_LIMITS.maxChars);
    truncated = true;
  }
  if (truncated) summary += " (truncated)";
  return { text, summary, truncated };
}

/** Splits extracted text into parts of at most partChars, at line ends where possible. */
export function splitParts(text: string, size: number = FILE_LIMITS.partChars): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const cut = rest.lastIndexOf("\n", size);
    const at = cut > size / 2 ? cut + 1 : size;
    parts.push(rest.slice(0, at));
    rest = rest.slice(at);
  }
  parts.push(rest);
  return parts;
}

// ── Storage ──────────────────────────────────────────────────────────────────

type Row = Record<string, any>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

const META = `f.id, f.ref_no, f.engagement_id, f.user_id, u.name as user_name, f.name, f.kind, f.size_bytes, f.summary, f.truncated, length(f.extracted) as chars, f.created_at`;

function toFile(r: Row): ClientFile {
  const chars = Number(r.chars);
  return {
    id: r.id,
    ref: `F${r.ref_no}`,
    engagementId: r.engagement_id,
    name: r.name,
    kind: r.kind,
    sizeBytes: r.size_bytes,
    summary: r.summary,
    truncated: r.truncated,
    parts: Math.max(1, Math.ceil(chars / FILE_LIMITS.partChars)),
    addedBy: r.user_name ?? null,
    createdAt: iso(r.created_at),
  };
}

/** An engagement's files in upload order, with the refs agents cite (F1, F2…; a deleted file's ref is not reused). */
export async function listFiles(db: Db, engagementId: string): Promise<ClientFile[]> {
  const { rows } = await db.query<Row>(`select ${META} from client_files f left join users u on u.id = f.user_id where f.engagement_id = $1 order by f.ref_no`, [engagementId]);
  return rows.map(toFile);
}

export async function getFile(db: Db, id: string): Promise<ClientFile | null> {
  const { rows } = await db.query<Row>(`select ${META} from client_files f left join users u on u.id = f.user_id where f.id = $1`, [id]);
  return rows[0] ? toFile(rows[0]) : null;
}

export async function getFileData(db: Db, id: string): Promise<{ name: string; kind: FileKind; data: Buffer } | null> {
  const { rows } = await db.query<Row>("select name, kind, data from client_files where id = $1", [id]);
  return rows[0] ? { name: rows[0].name, kind: rows[0].kind, data: Buffer.from(rows[0].data) } : null;
}

export async function getFileText(db: Db, id: string): Promise<string | null> {
  const { rows } = await db.query<Row>("select extracted from client_files where id = $1", [id]);
  return rows[0]?.extracted ?? null;
}

/** A file name safe to store and show: no folders, no control characters, at most 200 characters. */
export const cleanName = (raw: string) =>
  (raw.split(/[\\/]/).at(-1) ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(-200) || "upload";

export async function addFile(db: Db, input: { engagementId: string; userId: string; name: string; bytes: Buffer }): Promise<ClientFile> {
  const name = cleanName(input.name);
  if (input.bytes.length === 0) throw new FileError(400, `${name} is empty.`);
  if (input.bytes.length > FILE_LIMITS.maxBytes) throw new FileError(413, `${name} is larger than the ${FILE_LIMITS.maxBytes / 1024 / 1024} MB limit.`);
  const existing = await listFiles(db, input.engagementId);
  if (existing.length >= FILE_LIMITS.maxFiles) throw new FileError(409, `This engagement already has ${FILE_LIMITS.maxFiles} files, the limit. Delete one first.`);
  const sha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
  const { rows: dupes } = await db.query<Row>("select name from client_files where engagement_id = $1 and sha256 = $2", [input.engagementId, sha256]);
  if (dupes[0]) throw new FileError(409, `This file is already uploaded as ${dupes[0].name}.`);
  const kind = await detectKind(name, input.bytes);
  let content: Awaited<ReturnType<typeof extract>>;
  try {
    content = await extract(kind, input.bytes);
  } catch (err) {
    if (err instanceof FileError) throw err;
    throw new FileError(422, `${name} could not be read: ${err instanceof Error ? err.message : String(err)}`);
  }
  // F-numbers come from a counter on the engagement, so a deleted file's ref is never reused.
  const { rows: next } = await db.query<Row>("update engagements set next_file_ref = next_file_ref + 1 where id = $1 returning next_file_ref - 1 as ref_no", [input.engagementId]);
  const { rows } = await db.query<Row>(
    `insert into client_files (engagement_id, user_id, name, kind, size_bytes, sha256, data, extracted, summary, truncated, ref_no)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [input.engagementId, input.userId, name, kind, input.bytes.length, sha256, input.bytes, content.text, content.summary, content.truncated, next[0].ref_no],
  );
  return (await getFile(db, rows[0].id))!;
}

export async function deleteFile(db: Db, id: string): Promise<void> {
  await db.query("delete from client_files where id = $1", [id]);
}

// ── What a run's agents get ──────────────────────────────────────────────────

/** The files a run may read, and a reader for them. Built once per run. */
export interface FileAccess {
  files: ClientFile[];
  read: (ref: string, part?: number) => Promise<{ ok: true; file: ClientFile; part: number; text: string } | { ok: false; error: string }>;
}

export async function fileAccess(db: Db, engagementId: string | undefined): Promise<FileAccess | undefined> {
  if (!engagementId) return undefined;
  const files = await listFiles(db, engagementId);
  if (!files.length) return undefined;
  const texts = new Map<string, string[]>();
  return {
    files,
    read: async (ref, part = 1) => {
      const file = files.find((f) => f.ref.toLowerCase() === ref.trim().toLowerCase() || f.name === ref.trim());
      if (!file) return { ok: false, error: `No client file '${ref}'. Files: ${files.map((f) => `${f.ref} ${f.name}`).join("; ")}` };
      if (!texts.has(file.id)) texts.set(file.id, splitParts((await getFileText(db, file.id)) ?? ""));
      const parts = texts.get(file.id)!;
      if (part < 1 || part > parts.length) return { ok: false, error: `${file.ref} has ${parts.length} part(s); ask for part 1 to ${parts.length}.` };
      return { ok: true, file, part, text: parts[part - 1] };
    },
  };
}
