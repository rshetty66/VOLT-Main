import {
  AlignmentType, BorderStyle, Document, HeadingLevel, ImageRun, PageBreak, Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import type { ExportImage, ExportRequest } from "../../shared/export.js";
import { contentsOf, markdownBlocks, type Run } from "./blocks.js";
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
  const cell = (t: string, head: boolean) =>
    new TableCell({
      borders,
      shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: s.headerFill } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: head, color: head ? s.headerInk : undefined, size: (s.bodySizePt - 1) * 2 })] })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }), ...rows.map((r) => new TableRow({ children: header.map((_, i) => cell(r[i] ?? "", false)) }))],
  });
}

export async function writeDocx(req: ExportRequest, s: ExportStyle): Promise<Uint8Array> {
  const images = new Map((req.images ?? []).map((i) => [i.ref, i]));
  const maxImg = (s.page.widthIn - s.page.margins.left - s.page.margins.right) * PX_PER_IN;
  const caption = (t: string) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: t, italics: true, size: 18, color: "5B6862" })] });
  const body: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(req.title)] }),
    ...(req.subtitle ? [new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: req.subtitle, color: "5B6862" })] })] : []),
  ];

  const blocks = markdownBlocks(req.markdown);
  const charts = (req.images ?? []).filter((i) => i.ref.startsWith("chart-"));
  const contents = contentsOf(blocks, charts.length ? ["Results"] : []);
  if (contents.length) {
    body.push(new Paragraph({ spacing: { before: 240, after: 160 }, children: [new TextRun({ text: "Contents", bold: true, size: 32, font: s.headingFont, color: s.headingColor })] }));
    for (const line of contents) body.push(new Paragraph({ spacing: { after: 100 }, children: [new TextRun(line)] }));
    body.push(new Paragraph({ children: [new PageBreak()] }));
  }
  if (charts.length) {
    body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Results")] }));
    for (const c of charts) body.push(image(c, maxImg), ...(c.caption ? [caption(c.caption)] : []));
  }

  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        body.push(new Paragraph({ heading: HEADING[Math.min(5, b.depth - 1)], children: [new TextRun(b.text)] }));
        break;
      case "paragraph":
        body.push(new Paragraph({ spacing: { after: 120 }, children: textRuns(b.runs, s) }));
        break;
      case "list":
        b.items.forEach((it, i) =>
          body.push(
            b.ordered
              ? new Paragraph({ indent: { left: 360 + it.level * 360, hanging: 360 }, children: [new TextRun(`${i + 1}. `), ...textRuns(it.runs, s)] })
              : new Paragraph({ bullet: { level: Math.min(it.level, 8) }, children: textRuns(it.runs, s) }),
          ),
        );
        break;
      case "table":
        body.push(table(b.header, b.rows, s), new Paragraph({ children: [] }));
        break;
      case "code":
        body.push(...b.text.split("\n").map((line) => new Paragraph({ shading: { type: ShadingType.CLEAR, color: "auto", fill: "F2F4F3" }, children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })] })));
        break;
      case "quote":
        body.push(new Paragraph({ indent: { left: 540 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: s.accent, space: 8 } }, children: textRuns(b.runs.map((r) => ({ ...r, italic: true })), s) }));
        break;
      case "image": {
        const img = images.get(b.ref);
        body.push(img ? image(img, maxImg) : new Paragraph({ children: [new TextRun({ text: "[diagram not available]", italics: true })] }));
        break;
      }
      case "rule":
        body.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "C9D1CD", space: 1 } }, children: [] }));
        break;
    }
  }

  const tw = (inches: number) => Math.round(inches * 1440);
  const heading = (size: number) => ({ run: { font: s.headingFont, color: s.headingColor, bold: true, size: size * 2 }, paragraph: { spacing: { before: 240, after: 120 } } });
  const doc = new Document({
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
        children: body,
      },
    ],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}
