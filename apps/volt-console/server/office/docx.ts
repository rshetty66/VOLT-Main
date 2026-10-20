/**
 * Word report: title block, request and intake, the deliverable, then each
 * specialist's output as an appendix. Headings use Word's built-in heading
 * styles, so the navigation pane and a table of contents work.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
} from "docx";
import type { Block, Inline } from "./markdown.js";
import type { RunContent } from "./content.js";

const NAVY = "1F3864";
const GREY = "595959";
const RULE = "BFBFBF";
const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4];

function runs(inlines: Inline[], extra: { bold?: boolean; color?: string; size?: number } = {}): TextRun[] {
  return inlines.flatMap((i) =>
    i.text.split("\n").map(
      (part, k) =>
        new TextRun({
          text: part,
          break: k > 0 ? 1 : undefined,
          bold: i.bold || extra.bold,
          italics: i.italic,
          font: i.code ? "Consolas" : undefined,
          color: extra.color,
          size: extra.size,
        }),
    ),
  );
}

function table(b: Extract<Block, { kind: "table" }>): Table {
  const cols = Math.max(b.header.length, ...b.rows.map((r) => r.length), 1);
  const cell = (inl: Inline[], header: boolean, zebra: boolean, i: number) =>
    new TableCell({
      width: { size: columnWidths[i], type: WidthType.DXA },
      shading: header ? { fill: NAVY, type: ShadingType.CLEAR, color: "auto" } : zebra ? { fill: "F3F5F9", type: ShadingType.CLEAR, color: "auto" } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({ children: runs(inl, header ? { bold: true, color: "FFFFFF", size: 19 } : { size: 19 }) })],
    });
  const pad = (r: Inline[][]) => [...r, ...Array.from({ length: cols - r.length }, () => [] as Inline[])];
  // Column widths: each column first gets room for its longest word (so "-0.14M" or "R10" never wraps
  // mid-word), then the rest of the 9840-twip text width goes to columns in proportion to their text.
  const text = (c: Inline[] | undefined) => (c ?? []).map((i) => i.text).join("");
  const columnWidths = (() => {
    const all = (i: number) => [b.header[i], ...b.rows.map((r) => r[i])].map(text);
    const minW = Array.from({ length: cols }, (_, i) => Math.min(2200, 220 + 95 * Math.max(2, ...all(i).flatMap((t) => t.split(/\s+/)).map((w) => w.length))));
    const total = minW.reduce((a, x) => a + x, 0);
    if (total >= 9840) return minW.map((w) => Math.floor((w / total) * 9840));
    const extra = Array.from({ length: cols }, (_, i) => Math.max(1, Math.min(400, Math.max(...all(i).map((t) => t.length))) - (minW[i] - 220) / 95));
    const extraSum = extra.reduce((a, x) => a + x, 0);
    return minW.map((w, i) => Math.floor(w + ((9840 - total) * extra[i]) / extraSum));
  })();
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D9D9D9" };
  return new Table({
    width: { size: 9840, type: WidthType.DXA },
    columnWidths,
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: pad(b.header).map((c, k) => cell(c, true, false, k)) }),
      ...b.rows.map((r, i) => new TableRow({ cantSplit: true, children: pad(r).map((c, k) => cell(c, false, i % 2 === 1, k)) })),
    ],
  });
}

/** Renders blocks; `shift` maps Markdown heading depth to Word heading level. */
function render(blocks: Block[], shift: (depth: number) => number, lists: { n: number }): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const b of blocks) {
    switch (b.kind) {
      case "heading":
        out.push(new Paragraph({ heading: HEADINGS[Math.min(3, Math.max(0, shift(b.depth)))], children: runs(b.inlines) }));
        break;
      case "paragraph":
        out.push(new Paragraph({ spacing: { after: 120 }, children: runs(b.inlines) }));
        break;
      case "list": {
        const instance = ++lists.n;
        for (const item of b.items) {
          const level = Math.min(item.level, 2);
          const opts: IParagraphOptions = b.ordered
            ? { numbering: { reference: "ordered", level, instance }, children: runs(item.inlines) }
            : { bullet: { level }, children: runs(item.inlines) };
          out.push(new Paragraph({ ...opts, spacing: { after: 60 } }));
        }
        out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
        break;
      }
      case "table":
        out.push(table(b), new Paragraph({ spacing: { after: 120 }, children: [] }));
        break;
      case "code":
        for (const line of b.text.split("\n"))
          out.push(new Paragraph({ shading: { fill: "F2F2F2", type: ShadingType.CLEAR, color: "auto" }, children: [new TextRun({ text: line, font: "Consolas", size: 18 })] }));
        break;
      case "quote":
        out.push(...render(b.blocks, shift, lists));
        break;
      case "rule":
        out.push(new Paragraph({ border: { bottom: { color: RULE, space: 1, style: BorderStyle.SINGLE, size: 6 } }, spacing: { after: 120 }, children: [] }));
        break;
    }
  }
  return out;
}

export async function buildDocx(c: RunContent): Promise<Buffer> {
  const lists = { n: 0 };
  const meta = (label: string, value: string) =>
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: `${label}: `, bold: true, color: GREY }), new TextRun({ text: value, color: GREY })] });

  const front: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: c.title })] }),
    ...(c.client ? [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: [c.client, c.engagementTitle].filter(Boolean).join(" | "), size: 28, color: NAVY })] })] : []),
    meta("Date", c.date),
    meta("Status", c.status === "done" ? "Working draft for review" : `Run ${c.status}`),
    meta("Source", c.modeLabel),
    new Paragraph({ border: { bottom: { color: RULE, space: 1, style: BorderStyle.SINGLE, size: 6 } }, spacing: { after: 200 }, children: [] }),
  ];
  if (c.isDemo)
    front.push(new Paragraph({ shading: { fill: "FFF4CE", type: ShadingType.CLEAR, color: "auto" }, spacing: { after: 200 }, children: [new TextRun({ text: "Demo output. The specialist text below is simulated and must not be used with a client.", bold: true })] }));

  const request: (Paragraph | Table)[] = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Request")] }),
    ...c.prompt.split(/\n+/).map((p) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun(p)] })),
  ];
  if (c.intake.length)
    request.push(
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Intake")] }),
      ...c.intake.map(([k, v]) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun(v)] })),
    );

  const body = c.body.length ? render(c.body, (d) => d - 2, lists) : [new Paragraph({ children: [new TextRun({ text: "No final deliverable was produced for this run.", italics: true })] })];

  const appendix: (Paragraph | Table)[] = [];
  if (c.specialists.length) {
    appendix.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Appendix: specialist outputs")] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "Each specialist's contribution as delivered, before synthesis.", color: GREY })] }),
    );
    for (const s of c.specialists) {
      appendix.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, pageBreakBefore: appendix.length > 3, children: [new TextRun(s.name)] }),
        new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: [s.layer, s.phase && `${s.phase} phase`].filter(Boolean).join(" | "), color: GREY, italics: true })] }),
        ...render(s.blocks, (d) => Math.max(2, d), lists),
      );
    }
  }

  const doc = new Document({
    creator: "VOLT Agentic Console",
    title: c.title,
    description: [c.client, c.engagementTitle].filter(Boolean).join(" - "),
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 }, paragraph: { spacing: { line: 276 } } } },
      paragraphStyles: [
        { id: "Title", name: "Title", basedOn: "Normal", next: "Normal", run: { size: 48, bold: true, color: NAVY }, paragraph: { spacing: { after: 120 } } },
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: NAVY }, paragraph: { spacing: { before: 360, after: 120 }, keepNext: true } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 23, bold: true, color: "2F5496" }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, italics: true, color: "2F5496" }, paragraph: { spacing: { before: 160, after: 60 }, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: "%2.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: LevelFormat.LOWER_ROMAN, text: "%3.", alignment: AlignmentType.START, style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1200, bottom: 1200, left: 1200, right: 1200 } } },
        headers: {
          default: new Header({
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: ["VOLT", c.client].filter(Boolean).join(" | "), size: 16, color: GREY })] })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: [c.isDemo ? "Demo output | Page " : "Working draft | Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: GREY })],
              }),
            ],
          }),
        },
        children: [...front, ...request, ...body, ...appendix],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
