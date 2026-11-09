/**
 * exporters.ts — client-side deliverable export: MD / HTML / DOCX / XLSX / PDF.
 * Everything is generated in the browser so exports work on the published
 * site with no server-side tooling. Heavy libs load lazily per format.
 */

const PRINT_CSS = `
  body { font-family: 'Segoe UI', system-ui, sans-serif; color: #141414; max-width: 760px; margin: 40px auto; padding: 0 24px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 20px; border-bottom: 2px solid #d9a527; padding-bottom: 8px; }
  h2 { font-size: 16px; margin-top: 28px; }
  h3 { font-size: 14px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 12px; }
  th { text-align: left; text-transform: uppercase; font-size: 10px; letter-spacing: .06em; color: #666; border-bottom: 1.5px solid #141414; padding: 5px 8px 5px 0; }
  td { border-bottom: 1px solid #ddd; padding: 6px 8px 6px 0; vertical-align: top; }
  code { background: #f3f1ea; padding: 1px 5px; border-radius: 3px; font-size: 11.5px; }
  pre { background: #f7f5f0; border: 1px solid #e2ded4; border-radius: 6px; padding: 10px 12px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #d9a527; margin-left: 0; padding-left: 14px; color: #555; }
  .brand { font-family: monospace; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #999; margin-bottom: 24px; }
  .brand b { color: #d9a527; }
  .diagram { margin: 14px 0; padding: 12px; border: 1px solid #e2ded4; border-radius: 8px; text-align: center; }
  .diagram svg { max-width: 100%; height: auto; }
`;

import { configureMermaid } from '@/components/volt/Mermaid';

const MERMAID_RE = /```mermaid\s*\n([\s\S]*?)```/g;
const CHART_RE = /```chart\s*\n([\s\S]*?)```/g;

interface ChartData {
  title?: string;
  unit?: string;
  rows: [string, number][];
}

function parseChart(code: string): ChartData | null {
  try {
    const s = JSON.parse(code);
    if (!s || !Array.isArray(s.data) || s.data.length === 0) return null;
    const rows: [string, number][] = s.data
      .filter((d: any) => d && d.label !== undefined && isFinite(Number(d.value)))
      .map((d: any) => [String(d.label), Number(d.value)]);
    return rows.length ? { title: s.title, unit: s.unit, rows } : null;
  } catch {
    return null;
  }
}

function chartHtml(c: ChartData | null, raw: string): string {
  if (!c) return `<pre><code>${raw.replace(/</g, '&lt;')}</code></pre>`;
  const head = `<tr><th>Label</th><th>${c.unit ? `Value (${c.unit})` : 'Value'}</th></tr>`;
  const body = c.rows
    .map(([l, v]) => `<tr><td>${l}</td><td>${v.toLocaleString()}</td></tr>`)
    .join('');
  const caption = c.title ? `<p><strong>${c.title}</strong></p>` : '';
  return `${caption}<table>${head}${body}</table>`;
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Markdown → styled body HTML. When `diagrams` is on, ```mermaid fences are
 * rendered to inline SVG (light theme) so HTML/PDF exports carry the actual
 * process diagram; otherwise a placeholder note stands in (docx can't take
 * inline SVG through html-docx-js).
 */
async function mdToHtml(
  md: string,
  opts: { diagrams?: boolean } = {},
): Promise<string> {
  const { marked } = await import('marked');
  const codes: string[] = [];
  const charts: { data: ChartData | null; raw: string }[] = [];
  const stripped = md
    .replace(MERMAID_RE, (_m, code) => {
      codes.push(String(code).trim());
      return `\n\nVOLT-MERMAID-${codes.length - 1}\n\n`;
    })
    .replace(CHART_RE, (_m, code) => {
      charts.push({ data: parseChart(String(code).trim()), raw: String(code).trim() });
      return `\n\nVOLT-CHART-${charts.length - 1}\n\n`;
    });
  let html = (await marked.parse(stripped, { gfm: true })) as string;
  html = html.replace(/<p>VOLT-CHART-(\d+)<\/p>/g, (_m, n) => {
    const c = charts[Number(n)];
    return chartHtml(c.data, c.raw);
  });
  if (codes.length === 0) return html;
  if (!opts.diagrams) {
    return html.replace(
      /<p>VOLT-MERMAID-\d+<\/p>/g,
      '<p><em>[Process diagram — see the app or the HTML/PDF export]</em></p>',
    );
  }
  const m = await configureMermaid('light');
  try {
    for (let i = 0; i < codes.length; i++) {
      let inner: string;
      try {
        inner = (await m.render(`volt-exp-${Date.now()}-${i}`, codes[i])).svg;
      } catch {
        inner = `<pre><code>${codes[i].replace(/</g, '&lt;')}</code></pre>`;
      }
      html = html.replace(
        `<p>VOLT-MERMAID-${i}</p>`,
        `<div class="diagram">${inner}</div>`,
      );
    }
  } finally {
    await configureMermaid('dark');
  }
  return html;
}

function branded(bodyHtml: string, title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${PRINT_CSS}</style></head><body><div class="brand"><b>VOLT</b> · Gyan deliverable · ${new Date().toISOString().slice(0, 10)}</div>${bodyHtml}</body></html>`;
}

/** Parse GFM tables out of a markdown document. */
function extractTables(md: string): { headers: string[]; rows: string[][] }[] {
  const tables: { headers: string[]; rows: string[][] }[] = [];
  const lines = md.split('\n');
  let i = 0;
  const splitRow = (l: string) =>
    l
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  while (i < lines.length - 1) {
    const isHeader = lines[i].includes('|') && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-');
    if (isHeader && lines[i].trim() !== '') {
      const headers = splitRow(lines[i]);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i++;
      }
      if (headers.length > 1) tables.push({ headers, rows });
    } else {
      i++;
    }
  }
  return tables;
}

/**
 * Build a real .docx (not HTML-in-a-zip): headings as genuine Word heading
 * styles (navigation pane works), an auto-updating TOC field, styled tables
 * with a shaded header row, code blocks, bullets, blockquotes. Mermaid
 * diagrams degrade to a placeholder note — Word can't take inline SVG.
 */
async function buildDocx(md: string): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    ShadingType,
    BorderStyle,
    HeadingLevel,
    TableOfContents,
    PageBreak,
  } = await import('docx');

  const AMBER = 'D9A527';
  const INK = '141414';

  const runs = (text: string, base: Record<string, unknown> = {}) => {
    const out: InstanceType<typeof TextRun>[] = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let last = 0;
    for (const m of text.matchAll(re)) {
      const idx = m.index ?? 0;
      if (idx > last)
        out.push(new TextRun({ text: text.slice(last, idx), ...base }));
      const tok = m[0];
      if (tok.startsWith('**'))
        out.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...base }));
      else
        out.push(
          new TextRun({ text: tok.slice(1, -1), font: 'Consolas', ...base }),
        );
      last = idx + tok.length;
    }
    if (last < text.length)
      out.push(new TextRun({ text: text.slice(last), ...base }));
    return out.length ? out : [new TextRun({ text: '', ...base })];
  };

  const body: (
    | InstanceType<typeof Paragraph>
    | InstanceType<typeof Table>
    | InstanceType<typeof TableOfContents>
  )[] = [];

  body.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'VOLT', bold: true, color: AMBER, font: 'Consolas', size: 16 }),
        new TextRun({
          text: `  ·  Gyan deliverable · ${new Date().toISOString().slice(0, 10)}`,
          color: '999999',
          font: 'Consolas',
          size: 16,
        }),
      ],
      spacing: { after: 240 },
    }),
  );

  body.push(
    new Paragraph({
      children: runs('Contents', { bold: true, size: 24, color: INK }),
      spacing: { before: 120, after: 120 },
    }),
    new TableOfContents('Table of Contents', {
      hyperlink: true,
      headingStyleRange: '1-3',
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  const lines = md.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^```mermaid/.test(line)) {
      while (i < lines.length && !/^```\s*$/.test(lines[i])) i++;
      i++;
      body.push(
        new Paragraph({
          children: runs('[Process diagram — see the app or the HTML/PDF export]', {
            italics: true,
            color: '999999',
            size: 18,
          }),
          spacing: { before: 80, after: 160 },
        }),
      );
      continue;
    }
    if (/^```chart/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      const chart = parseChart(code.join('\n'));
      if (chart) {
        if (chart.title) {
          body.push(
            new Paragraph({
              children: runs(chart.title, { bold: true, size: 21 }),
              spacing: { before: 120, after: 80 },
            }),
          );
        }
        const cell = (text: string, header: boolean) =>
          new TableCell({
            children: [
              new Paragraph({
                children: runs(
                  text,
                  header ? { bold: true, size: 15, color: '666666' } : { size: 17 },
                ),
              }),
            ],
            shading: header ? { type: ShadingType.CLEAR, fill: 'F3F1EA' } : undefined,
            margins: { top: 50, bottom: 50, left: 90, right: 90 },
          });
        body.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  cell('Label', true),
                  cell(chart.unit ? `Value (${chart.unit})` : 'Value', true),
                ],
                tableHeader: true,
              }),
              ...chart.rows.map(
                ([l, v]) =>
                  new TableRow({
                    children: [cell(l, false), cell(v.toLocaleString(), false)],
                  }),
              ),
            ],
          }),
          new Paragraph({ children: [], spacing: { after: 120 } }),
        );
      } else {
        body.push(
          new Paragraph({
            children: runs('[Chart data could not be parsed]', {
              italics: true,
              color: '999999',
              size: 18,
            }),
            spacing: { after: 120 },
          }),
        );
      }
      continue;
    }
    if (line.startsWith('```')) {
      i++;
      const code: string[] = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      for (const cl of code) {
        body.push(
          new Paragraph({
            children: [new TextRun({ text: cl || ' ', font: 'Consolas', size: 17 })],
            shading: { type: ShadingType.CLEAR, fill: 'F7F5F0' },
            spacing: { before: 0, after: 0 },
          }),
        );
      }
      body.push(new Paragraph({ children: [], spacing: { after: 120 } }));
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const size = level === 1 ? 32 : level === 2 ? 26 : 22;
      body.push(
        new Paragraph({
          children: runs(h[2], { bold: true, size, color: INK }),
          heading:
            level === 1
              ? HeadingLevel.HEADING_1
              : level === 2
                ? HeadingLevel.HEADING_2
                : HeadingLevel.HEADING_3,
          spacing: { before: level === 1 ? 120 : 280, after: 120 },
          border:
            level === 1
              ? { bottom: { color: AMBER, space: 4, style: BorderStyle.SINGLE, size: 12 } }
              : undefined,
        }),
      );
      i++;
      continue;
    }
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) &&
      lines[i + 1].includes('-') &&
      line.trim() !== ''
    ) {
      const splitRow = (l: string) =>
        l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const headers = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const fit = (r: string[]) =>
        Array.from({ length: headers.length }, (_, k) => r[k] ?? '');
      const cell = (text: string, header: boolean) =>
        new TableCell({
          children: [
            new Paragraph({
              children: runs(
                text,
                header
                  ? { bold: true, size: 15, color: '666666' }
                  : { size: 17 },
              ),
            }),
          ],
          shading: header ? { type: ShadingType.CLEAR, fill: 'F3F1EA' } : undefined,
          margins: { top: 50, bottom: 50, left: 90, right: 90 },
        });
      body.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: headers.map((htxt) => cell(htxt, true)),
              tableHeader: true,
            }),
            ...rows.map(
              (r) => new TableRow({ children: fit(r).map((c) => cell(c, false)) }),
            ),
          ],
        }),
        new Paragraph({ children: [], spacing: { after: 120 } }),
      );
      continue;
    }
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      body.push(
        new Paragraph({
          children: runs(bullet[1], { size: 21 }),
          bullet: { level: 0 },
          spacing: { after: 60 },
        }),
      );
      i++;
      continue;
    }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      body.push(
        new Paragraph({
          children: runs(quote[1], { italics: true, color: '555555', size: 21 }),
          indent: { left: 360 },
          spacing: { after: 120 },
        }),
      );
      i++;
      continue;
    }
    if (line.trim() === '') {
      i++;
      continue;
    }
    body.push(
      new Paragraph({
        children: runs(line, { size: 21 }),
        spacing: { after: 120 },
      }),
    );
    i++;
  }

  const doc = new Document({
    features: { updateFields: true },
    sections: [{ properties: {}, children: body }],
  });
  return Packer.toBlob(doc);
}

export const exporters = {
  md(content: string, name: string) {
    saveBlob(new Blob([content], { type: 'text/markdown' }), `${name}.md`);
  },

  async html(content: string, name: string) {
    const body = await mdToHtml(content, { diagrams: true });
    saveBlob(new Blob([branded(body, name)], { type: 'text/html' }), `${name}.html`);
  },

  async docx(content: string, name: string) {
    const blob = await buildDocx(content);
    saveBlob(blob, `${name}.docx`);
  },

  async xlsx(content: string, name: string) {
    const tables = extractTables(content);
    const charts = [...content.matchAll(CHART_RE)]
      .map((m) => parseChart(String(m[1]).trim()))
      .filter((c): c is ChartData => c !== null);
    if (tables.length === 0 && charts.length === 0) return false;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    tables.forEach((t, i) => {
      const ws = XLSX.utils.aoa_to_sheet([t.headers, ...t.rows]);
      XLSX.utils.book_append_sheet(wb, ws, `Table ${i + 1}`.slice(0, 31));
    });
    charts.forEach((c, i) => {
      const ws = XLSX.utils.aoa_to_sheet([
        ['Label', c.unit ? `Value (${c.unit})` : 'Value'],
        ...c.rows,
      ]);
      const title = (c.title ?? `Chart ${i + 1}`).replace(/[\\/*?[\]:]/g, ' ');
      XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
    });
    XLSX.writeFile(wb, `${name}.xlsx`);
    return true;
  },

  async pdf(content: string, name: string) {
    const body = await mdToHtml(content, { diagrams: true });
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(branded(body, name));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  },
} as const;

export type ExportFormat = keyof typeof exporters;

export const EXPORT_LABELS: Record<ExportFormat, string> = {
  md: 'Markdown (.md)',
  html: 'HTML page (.html)',
  docx: 'Word (.docx)',
  xlsx: 'Excel — tables (.xlsx)',
  pdf: 'PDF (print view)',
};

/**
 * Human deliverable name from the answer itself: H1 title first, then the
 * originating question, then a generic fallback. Files land as
 * "VOLT - <Deliverable Title>.<ext>".
 */
export function deliverableName(content: string, prompt?: string): string {
  const h1 = /^#\s+(.+)$/m.exec(content)?.[1];
  const clean = (s: string) =>
    s
      .replace(/[*_`]/g, '')
      .replace(/[–—]/g, '-') // em/en dashes break Chromium's download filename
      .replace(/[\\/:*?"<>|#]/g, '')
      .replace(/[^\x20-\x7E]/g, '')
      .replace(/(\s+-\s*){2,}/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();
  const base = clean(h1 ?? prompt ?? '');
  return `VOLT - ${base ? base.slice(0, 80) : 'Gyan deliverable'}`;
}
