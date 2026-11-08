/**
 * attachments.ts — client-side file ingestion for chat uploads.
 * Everything is extracted to plain text in the browser (no server round-trip),
 * capped so a big TB export can't blow the model's context budget.
 *
 * Supported: .txt .md .csv .tsv .json .log (direct), .xlsx/.xls (SheetJS),
 * .docx (mammoth), .pdf (pdfjs). Heavy parsers load lazily per file type.
 */

export interface Attachment {
  id: string;
  name: string;
  size: number;
  kind: 'text' | 'xlsx' | 'docx' | 'pdf';
  /** lifecycle: reading → ready | error */
  status: 'reading' | 'ready' | 'error';
  text: string;
  truncated: boolean;
  /** e.g. '3 sheets · 45 rows × 8 cols' or '6 pages' */
  summary?: string;
  error?: string;
}

export const MAX_FILES = 4;
const PER_FILE_CAP = 12_000;
const TOTAL_CAP = 24_000;
const XLSX_SHEET_CAP = 3;
const XLSX_ROW_CAP = 60;
const XLSX_COL_CAP = 12;
const PDF_PAGE_CAP = 8;

const TEXT_EXT = /\.(txt|md|csv|tsv|json|log)$/i;
const XLSX_EXT = /\.(xlsx|xls)$/i;
const DOCX_EXT = /\.docx$/i;
const PDF_EXT = /\.pdf$/i;

let seq = 0;
const nextId = () => `a${++seq}-${Date.now()}`;

export function acceptsFile(name: string): boolean {
  return (
    TEXT_EXT.test(name) ||
    XLSX_EXT.test(name) ||
    DOCX_EXT.test(name) ||
    PDF_EXT.test(name)
  );
}

export const ACCEPT_STRING = '.txt,.md,.csv,.tsv,.json,.log,.xlsx,.xls,.docx,.pdf';

function capText(text: string): { text: string; truncated: boolean } {
  if (text.length <= PER_FILE_CAP) return { text, truncated: false };
  return {
    text:
      text.slice(0, PER_FILE_CAP) +
      `\n… [truncated — ${text.length.toLocaleString()} chars total, showing first ${PER_FILE_CAP.toLocaleString()}]`,
    truncated: true,
  };
}

async function extractXlsx(file: File): Promise<{ text: string; summary: string }> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { dense: true });
  const parts: string[] = [];
  let sheets = 0;
  let dims = '';
  for (const sheetName of wb.SheetNames.slice(0, XLSX_SHEET_CAP)) {
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      raw: false,
      defval: '',
    });
    const rows = aoa.slice(0, XLSX_ROW_CAP).map((r) => r.slice(0, XLSX_COL_CAP));
    if (rows.length === 0) continue;
    sheets++;
    if (!dims) dims = `${aoa.length.toLocaleString()} rows × ${(aoa[0] as unknown[]).length} cols`;
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? '');
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\n');
    const more =
      aoa.length > XLSX_ROW_CAP
        ? `\n… [${(aoa.length - XLSX_ROW_CAP).toLocaleString()} more rows not shown — ask for a specific cut]`
        : '';
    parts.push(`Sheet "${sheetName}":\n${csv}${more}`);
  }
  const extra =
    wb.SheetNames.length > XLSX_SHEET_CAP
      ? `\n[${wb.SheetNames.length - XLSX_SHEET_CAP} more sheets not extracted: ${wb.SheetNames.slice(XLSX_SHEET_CAP).join(', ')}]`
      : '';
  return {
    text: parts.join('\n\n') + extra,
    summary: `${sheets} sheet${sheets === 1 ? '' : 's'}${dims ? ` · ${dims}` : ''}`,
  };
}

async function extractDocx(file: File): Promise<{ text: string; summary: string }> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  const words = result.value.split(/\s+/).filter(Boolean).length;
  return { text: result.value, summary: `${words.toLocaleString()} words` };
}

async function extractPdf(file: File): Promise<{ text: string; summary: string }> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = Math.min(doc.numPages, PDF_PAGE_CAP);
  const parts: string[] = [];
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (line) parts.push(`[p.${p}] ${line}`);
  }
  const more =
    doc.numPages > PDF_PAGE_CAP
      ? `\n[${doc.numPages - PDF_PAGE_CAP} more pages not extracted — ask for a specific section]`
      : '';
  return {
    text: parts.join('\n') + more,
    summary: `${doc.numPages} page${doc.numPages === 1 ? '' : 's'}`,
  };
}

export async function extractFile(file: File): Promise<Attachment> {
  const base: Attachment = {
    id: nextId(),
    name: file.name,
    size: file.size,
    kind: 'text',
    status: 'ready',
    text: '',
    truncated: false,
  };
  try {
    if (TEXT_EXT.test(file.name)) {
      const capped = capText(await file.text());
      return {
        ...base,
        ...capped,
        summary: `${file.size >= 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${file.size} B`}`,
      };
    }
    if (XLSX_EXT.test(file.name)) {
      const { text, summary } = await extractXlsx(file);
      return { ...base, kind: 'xlsx', ...capText(text), summary };
    }
    if (DOCX_EXT.test(file.name)) {
      const { text, summary } = await extractDocx(file);
      return { ...base, kind: 'docx', ...capText(text), summary };
    }
    if (PDF_EXT.test(file.name)) {
      const { text, summary } = await extractPdf(file);
      return { ...base, kind: 'pdf', ...capText(text), summary };
    }
    return {
      ...base,
      status: 'error',
      error: 'Unsupported type — use csv, xlsx, docx, pdf, txt or md.',
    };
  } catch {
    return {
      ...base,
      status: 'error',
      error: 'Could not read this file. Try exporting to CSV or pasting the text.',
    };
  }
}

/**
 * Fold ready attachments into the message sent to the model, enforcing the
 * total budget. Files marked truncated keep their note visible to the model.
 */
export function foldAttachments(text: string, atts: Attachment[]): string {
  const ready = atts.filter((a) => a.status === 'ready' && a.text);
  if (ready.length === 0) return text;
  let budget = TOTAL_CAP;
  const blocks: string[] = [];
  for (const a of ready) {
    if (budget <= 0) {
      blocks.push(`[Attached file: ${a.name} — omitted, total budget reached]`);
      continue;
    }
    const body = a.text.length > budget ? a.text.slice(0, budget) + '\n… [cut]' : a.text;
    budget -= body.length;
    blocks.push(
      `[Attached file: ${a.name}${a.summary ? ` — ${a.summary}` : ''}${a.truncated ? ' (truncated)' : ''}]\n${body}`,
    );
  }
  return `${text}\n\n---\n${blocks.join('\n\n')}`;
}
