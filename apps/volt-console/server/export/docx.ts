import {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, PageBreak, PageNumber, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType, Bookmark, InternalHyperlink, LeaderType, PageReference, TabStopType
} from "docx";
import type { ExportImage, ExportRequest } from "../../shared/export.js";
import { markdownBlocks, tocEntries, type Run } from "./blocks.js";
import { TONE_STYLE, toneFor } from "../../shared/brand.js";
import { BRAND } from "./brand.js";
import type { ExportStyle } from "./style.js";

const HEADING = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];
const PX_PER_IN = 96;

function textRuns(runs: Run[], s: ExportStyle) {
  return runs.map((r) =>
    r.text === "\n" ? new TextRun({ break: 1 }) : new TextRun({ text: r.text, bold: r.bold, italics: r.italic, font: r.code ? "Consolas" : undefined }),
  );
}

function image(img: ExportImage, maxWidthPx: number) {
  const scale = Math.min(1, maxWidthPx / img.width);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: img.caption ? 40 : 160 },
    children: [new ImageRun({ type: "png", data: Buffer.from(img.png, "base64"), transformation: { width: Math.round(img.width * scale), height: Math.round(img.height * scale) } })],
  });
}

function table(header: string[], rows: string[][], s: ExportStyle) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: "C9D1CD" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (t: string, head: boolean, column = "") => {
    // Priority, risk and status words are colour coded with the brand palette (orange high, gold medium, cyan low).
    const tone = !head && s.brand ? toneFor(column, t) : null;
    const fill = head ? s.headerFill : tone ? TONE_STYLE[tone].fill : undefined;
    return new TableCell({
      borders,
      shading: fill ? { type: ShadingType.CLEAR, color: "auto", fill } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: head || !!tone, color: head ? s.headerInk : tone ? TONE_STYLE[tone].ink : undefined, size: (s.bodySizePt - 1) * 2 })] })],
    });
  };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }), ...rows.map((r) => new TableRow({ children: header.map((h, i) => cell(r[i] ?? "", false, h)) }))],
  });
}

/** The cover: the title and the date. No logo or picture, so the first thing on the page is the document. */
function coverTitle(req: ExportRequest): Paragraph[] {
  const title = new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(req.title)] });
  const date = req.subtitle ? [new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: req.subtitle, color: "5B6862" })] })] : [];
  return [title, ...date];
}

/** A one-cell table: light tint, thick accent bar on the left, no other borders. */
function callout(children: (Paragraph | Table)[], accent: string): Table {
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: "E8FBFE" },
            margins: { top: 140, bottom: 100, left: 220, right: 200 },
            borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 36, color: accent } },
            children: [...children, new Paragraph({ spacing: { after: 0 }, children: [] })],
          }),
        ],
      }),
    ],
  });
}

const APPENDIX = "Appendix: Supporting analysis";

export async function writeDocx(req: ExportRequest, s: ExportStyle): Promise<Uint8Array> {
  const images = new Map((req.images ?? []).map((i) => [i.ref, i]));
  const maxImg = (s.page.widthIn - s.page.margins.left - s.page.margins.right) * PX_PER_IN;
  const caption = (t: string) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: t, italics: true, size: 18, color: "5B6862" })] });
  const body: (Paragraph | Table)[] = [...coverTitle(req)];

  const blocks = markdownBlocks(req.markdown);
  const charts = (req.images ?? []).filter((i) => i.ref.startsWith("chart-"));
  const toc = tocEntries(blocks, charts.length ? [APPENDIX] : []);
  const tocId = new Map(toc.filter((t) => t.heading).map((t) => [t.heading, t.id]));
  if (toc.length) {
    // A real table of contents: sections and sub-sections, each a link to its heading, with dotted leaders and the page
    // number Word fills in (the file asks Word to update its fields when it opens).
    const width = Math.round((s.page.widthIn - s.page.margins.left - s.page.margins.right) * 1440);
    body.push(new Paragraph({ spacing: { before: 240, after: 160 }, children: [new TextRun({ text: "Contents", bold: true, size: 32, font: s.headingFont, color: s.headingColor })] }));
    for (const t of toc) {
      body.push(
        new Paragraph({
          spacing: { after: t.level === 1 ? 90 : 40 },
          indent: { left: t.level === 1 ? 0 : 360 },
          tabStops: [{ type: TabStopType.RIGHT, position: width, leader: LeaderType.DOT }],
          children: [
            new InternalHyperlink({ anchor: t.id, children: [new TextRun({ text: t.text, bold: t.level === 1, size: t.level === 1 ? 22 : 20 })] }),
            new TextRun({ text: "\t", size: 20 }),
            new PageReference(t.id),
          ],
        }),
      );
    }
    body.push(new Paragraph({ children: [new PageBreak()] }));
  }
  // The executive summary is collected here and written as one shaded callout.
  let summary: (Paragraph | Table)[] | null = null;
  let sink: (Paragraph | Table)[] = body;
  const flushSummary = () => {
    if (summary && summary.length) body.push(callout(summary, s.accent), new Paragraph({ spacing: { after: 160 }, children: [] }));
    summary = null;
    sink = body;
  };
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        flushSummary();
        body.push(new Paragraph({ heading: HEADING[Math.min(5, b.depth - 1)], children: tocId.has(b) ? [new Bookmark({ id: tocId.get(b)!, children: [new TextRun(b.text)] })] : [new TextRun(b.text)] }));
        // The executive summary sits in a tinted callout with an accent bar, so it reads first.
        if (/executive summary/i.test(b.text) && b.depth <= 3) {
          summary = [];
          sink = summary;
        }
        break;
      case "paragraph":
        sink.push(new Paragraph({ spacing: { after: 120 }, children: textRuns(b.runs, s) }));
        break;
      case "list":
        b.items.forEach((it, i) =>
          sink.push(
            b.ordered
              ? new Paragraph({ indent: { left: 360 + it.level * 360, hanging: 360 }, children: [new TextRun(`${i + 1}. `), ...textRuns(it.runs, s)] })
              : new Paragraph({ bullet: { level: Math.min(it.level, 8) }, children: textRuns(it.runs, s) }),
          ),
        );
        break;
      case "table":
        sink.push(table(b.header, b.rows, s), new Paragraph({ children: [] }));
        break;
      case "code":
        sink.push(...b.text.split("\n").map((line) => new Paragraph({ shading: { type: ShadingType.CLEAR, color: "auto", fill: "F2F4F3" }, children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })] })));
        break;
      case "quote":
        sink.push(new Paragraph({ indent: { left: 540 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: s.accent, space: 8 } }, children: textRuns(b.runs.map((r) => ({ ...r, italic: true })), s) }));
        break;
      case "image": {
        const img = images.get(b.ref);
        sink.push(img ? image(img, maxImg) : new Paragraph({ children: [new TextRun({ text: "[diagram not available]", italics: true })] }));
        break;
      }
      case "rule":
        sink.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C9D1CD", space: 1 } }, children: [] }));
        break;
    }
  }
  flushSummary();

  // The charts built from the agents' analysis tools go last, as an appendix: the executive summary comes first.
  if (charts.length) {
    body.push(new Paragraph({ children: [new PageBreak()] }), new Paragraph({ heading: HeadingLevel.HEADING_1, children: toc.length ? [new Bookmark({ id: toc[toc.length - 1].id, children: [new TextRun(APPENDIX)] })] : [new TextRun(APPENDIX)] }));
    for (const c of charts) body.push(image(c, maxImg), ...(c.caption ? [caption(c.caption)] : []));
  }

  const tw = (inches: number) => Math.round(inches * 1440);
  const heading = (size: number) => ({ run: { font: s.headingFont, color: s.headingColor, bold: true, size: size * 2 }, paragraph: { spacing: { before: 240, after: 120 } } });
  const doc = new Document({
    features: { updateFields: true },
    creator: "VOLT Console",
    title: req.title,
    styles: {
      default: {
        document: { run: { font: s.bodyFont, size: s.bodySizePt * 2, color: s.ink } },
        title: { run: { font: s.headingFont, color: s.headingColor, size: 52, bold: true } },
        heading1: heading(18),
        heading2: heading(15),
        heading3: heading(13),
        heading4: heading(12),
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: tw(s.page.widthIn), height: tw(s.page.heightIn) },
            margin: { top: tw(s.page.margins.top), right: tw(s.page.margins.right), bottom: tw(s.page.margins.bottom), left: tw(s.page.margins.left) },
          },
        },
        ...(s.brand
          ? {
              footers: {
                default: new Footer({
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      border: { top: { style: BorderStyle.SINGLE, size: 6, color: BRAND.cyan, space: 6 } },
                      children: [
                        new TextRun({ text: `VOLT  ·  ${BRAND.tagline}  ·  Page `, size: 16, color: "5B6862" }),
                        new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "5B6862" }),
                      ],
                    }),
                  ],
                }),
              },
            }
          : {}),
        children: body,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
