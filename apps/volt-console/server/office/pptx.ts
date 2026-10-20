/**
 * PowerPoint board deck: a title slide, contents, one or more slides per
 * deliverable section (paragraphs and lists as bullets, tables as table
 * slides, split across slides when long), and the specialists consulted.
 * Each slide's speaker notes carry the full section text, so nothing that
 * was shortened to fit is lost.
 */
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import { plain, sections, type Block, type Inline } from "./markdown.js";
import type { RunContent } from "./content.js";

const NAVY = "1F3864";
const ACCENT = "2E75B6";
const GREY = "595959";
const W = 13.333;
const FONT = "Calibri";

interface Bullet {
  runs: Inline[];
  level: number;
  heading?: boolean;
}

type Table = Extract<Block, { kind: "table" }>;

/** Shortens long text at a sentence or word boundary. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(" "))) + " ...";
}

function clipRuns(runs: Inline[], max: number): Inline[] {
  const out: Inline[] = [];
  let left = max;
  for (const r of runs) {
    const t = r.text.replace(/\s+/g, " ");
    if (left <= 0) break;
    if (t.length <= left) {
      out.push({ ...r, text: t });
      left -= t.length;
    } else {
      out.push({ ...r, text: clip(t, left) });
      left = 0;
    }
  }
  return out;
}

const lines = (b: Bullet) => Math.max(1, Math.ceil(plain(b.runs).length / (b.level ? 105 : 115)));

function blocksToBullets(blocks: Block[]): (Bullet | { table: Table; caption: string })[] {
  const out: (Bullet | { table: Table; caption: string })[] = [];
  let base = 0;
  let caption = "";
  for (const b of blocks) {
    if (b.kind === "heading") {
      caption = plain(b.inlines);
      out.push({ runs: [{ text: caption, bold: true }], level: 0, heading: true });
      base = 1;
    } else if (b.kind === "paragraph") {
      const text = plain(b.inlines);
      if (text) out.push({ runs: clipRuns(b.inlines, 330), level: base });
    } else if (b.kind === "list") {
      for (const item of b.items) out.push({ runs: clipRuns(item.inlines, 260), level: Math.min(2, base + item.level) });
    } else if (b.kind === "table") {
      out.push({ table: b, caption });
    } else if (b.kind === "quote") {
      out.push(...(blocksToBullets(b.blocks).filter((x) => "runs" in x) as Bullet[]));
    } else if (b.kind === "code") {
      out.push({ runs: [{ text: clip(b.text, 300), code: true }], level: base });
    }
  }
  return out;
}

function notesFor(blocks: Block[]): string {
  const text = (bs: Block[]): string[] =>
    bs.flatMap((b) => {
      if (b.kind === "heading" || b.kind === "paragraph") return [plain(b.inlines)];
      if (b.kind === "list") return b.items.map((i) => `${"  ".repeat(i.level)}- ${plain(i.inlines)}`);
      if (b.kind === "table") return [[b.header, ...b.rows].map((r) => r.map(plain).join(" | ")).join("\n")];
      if (b.kind === "quote") return text(b.blocks);
      if (b.kind === "code") return [b.text];
      return [];
    });
  return text(blocks).join("\n\n").slice(0, 12000);
}

export async function buildPptx(c: RunContent): Promise<Buffer> {
  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE";
  p.title = c.title;
  p.company = c.client || "VOLT";
  const footer = [c.client, c.isDemo ? "Demo output: simulated text" : "Working draft"].filter(Boolean).join("  |  ");

  p.defineSlideMaster({
    title: "CONTENT",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.1, fill: { color: NAVY } } },
      { line: { x: 0.5, y: 1.18, w: W - 1, h: 0, line: { color: ACCENT, width: 1.25 } } },
      { text: { text: footer, options: { x: 0.5, y: 7.05, w: 9, h: 0.3, fontFace: FONT, fontSize: 9, color: "8C8C8C" } } },
    ],
    slideNumber: { x: W - 1.1, y: 7.05, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 9, color: "8C8C8C", align: "right" },
  });

  const content = (title: string) => {
    const s = p.addSlide({ masterName: "CONTENT" });
    s.addText(title, { x: 0.5, y: 0.3, w: W - 1, h: 0.8, fontFace: FONT, fontSize: 24, bold: true, color: NAVY, valign: "bottom", fit: "shrink" });
    return s;
  };

  // Title slide
  const t = p.addSlide();
  t.background = { color: NAVY };
  t.addShape(p.ShapeType.rect, { x: 0.6, y: 2.2, w: 0.12, h: 2.2, fill: { color: ACCENT }, line: { color: ACCENT } });
  t.addText(c.title, { x: 0.95, y: 2.1, w: 11.4, h: 1.5, fontFace: FONT, fontSize: 36, bold: true, color: "FFFFFF", valign: "top", fit: "shrink" });
  t.addText([c.client, c.engagementTitle].filter(Boolean).join("  |  ") || "VOLT", { x: 0.95, y: 3.65, w: 11.4, h: 0.5, fontFace: FONT, fontSize: 18, color: "D9E2F3" });
  t.addText(`${c.date}  |  ${c.status === "done" ? "Working draft for review" : `Run ${c.status}`}`, { x: 0.95, y: 4.15, w: 11.4, h: 0.4, fontFace: FONT, fontSize: 13, color: "B4C6E7" });
  t.addText(c.modeLabel, { x: 0.95, y: 6.6, w: 11.4, h: 0.35, fontFace: FONT, fontSize: 10, color: c.isDemo ? "FFD966" : "8EA9DB" });
  const lead = sections(c.body).find((s) => !s.title);
  t.addNotes([`Request: ${c.prompt}`, lead ? notesFor(lead.blocks) : ""].filter(Boolean).join("\n\n"));

  const secs = sections(c.body).filter((s) => s.title && s.blocks.some((b) => b.kind !== "rule"));

  // Contents
  if (secs.length > 2) {
    const s = content("Contents");
    s.addText(
      secs.map((x) => ({ text: x.title, options: { breakLine: true } })),
      { x: 0.7, y: 1.45, w: W - 1.4, h: 5.4, fontFace: FONT, fontSize: 18, color: "262626", valign: "top", paraSpaceAfter: 8 },
    );
  }

  if (!secs.length) {
    const s = content("No deliverable");
    s.addText("This run produced no final deliverable. See the specialist outputs in the Word or Markdown export.", { x: 0.7, y: 1.6, w: W - 1.4, h: 1, fontFace: FONT, fontSize: 18, color: GREY });
  }

  for (const sec of secs) {
    const notes = notesFor(sec.blocks);
    const items = blocksToBullets(sec.blocks);
    let pending: Bullet[] = [];
    let part = 0;
    const title = () => (part++ ? `${sec.title} (cont.)` : sec.title);

    const flush = () => {
      // Drop a trailing subheading that would sit alone at the bottom of a slide.
      while (pending.length && pending.at(-1)!.heading) pending.pop();
      if (!pending.length) return;
      const s = content(title());
      s.addText(
        pending.flatMap((b) => {
          const runs = b.runs.length ? b.runs : [{ text: "" }];
          // Paragraph options go on the first run only; a bullet on a later run would start a new paragraph.
          return runs.map((r, k) => ({
            text: r.text,
            options: {
              bold: r.bold || b.heading,
              italic: r.italic,
              fontFace: r.code ? "Consolas" : FONT,
              color: b.heading ? ACCENT : "262626",
              fontSize: b.heading ? 16 : b.level ? 13 : 15,
              ...(k === 0 ? { bullet: b.heading ? false : { indent: 18 }, indentLevel: b.heading ? 0 : b.level, paraSpaceBefore: b.heading ? 6 : 2 } : {}),
              breakLine: k === runs.length - 1,
            },
          }));
        }),
        { x: 0.6, y: 1.35, w: W - 1.2, h: 5.55, valign: "top", fit: "shrink" },
      );
      s.addNotes(notes);
      pending = [];
    };

    let used = 0;
    for (const item of items) {
      if ("table" in item) {
        flush();
        used = 0;
        tableSlides(item.table, item.caption && item.caption !== sec.title ? `${sec.title}: ${item.caption}` : sec.title, notes);
        continue;
      }
      const need = lines(item) + (item.heading ? 0.6 : 0.25);
      if (used + need > 15 && pending.length) {
        flush();
        used = 0;
      }
      pending.push(item);
      used += need;
    }
    flush();
  }

  function tableSlides(tbl: Table, title: string, notes: string) {
    const cols = Math.max(tbl.header.length, ...tbl.rows.map((r) => r.length));
    const text = (r: Inline[][], i: number) => clip(plain(r[i] ?? []), 220);
    const longest = Array.from({ length: cols }, (_, i) => Math.max(plain(tbl.header[i] ?? []).length, ...tbl.rows.map((r) => text(r, i).length)));
    const weight = longest.map((l) => Math.min(60, Math.max(6, l)));
    const total = weight.reduce((a, b) => a + b, 0);
    const width = W - 1.2;
    const colW = weight.map((w) => (w / total) * width);
    const fontSize = cols > 5 ? 10 : 11;
    const charsPerInch = fontSize === 10 ? 15 : 13.5;
    const rowH = (r: Inline[][]) => Math.max(...colW.map((w, i) => Math.ceil(Math.max(1, text(r, i).length) / Math.max(4, w * charsPerInch - 2)))) * (fontSize / 72) * 1.25 + 0.12;
    const headH = rowH(tbl.header);
    let chunk: Inline[][][] = [];
    let h = headH;
    let part = 0;
    const emit = () => {
      if (!chunk.length) return;
      const s = content(part++ ? `${title} (cont.)` : title);
      const head = Array.from({ length: cols }, (_, i) => ({ text: plain(tbl.header[i] ?? []), options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } }));
      const body = chunk.map((r, ri) =>
        Array.from({ length: cols }, (_, i) => {
          const cell = r[i] ?? [];
          const bold = cell.length > 0 && cell.every((x) => x.bold || !x.text.trim());
          return { text: text(r, i), options: { bold, fill: { color: ri % 2 ? "F3F5F9" : "FFFFFF" } } };
        }),
      );
      s.addTable([head, ...body], { x: 0.6, y: 1.4, w: width, colW, fontFace: FONT, fontSize, color: "262626", valign: "top", border: { type: "solid", pt: 0.5, color: "D9D9D9" }, margin: 0.05, autoPage: false });
      s.addNotes(notes);
      chunk = [];
      h = headH;
    };
    for (const r of tbl.rows) {
      const rh = rowH(r);
      if (h + rh > 5.4 && chunk.length) emit();
      chunk.push(r);
      h += rh;
    }
    emit();
  }

  // Specialists consulted
  if (c.specialists.length) {
    const rows = c.specialists.map((s) => [s.name, s.layer, s.phase ?? ""]);
    const s = content("Specialists consulted");
    s.addTable(
      [["Specialist", "Practice area", "Workflow phase"].map((h) => ({ text: h, options: { bold: true, color: "FFFFFF", fill: { color: NAVY } } })), ...rows.map((r) => r.map((x) => ({ text: x })))],
      { x: 0.6, y: 1.4, w: W - 1.2, colW: [4.5, 4.2, 3.4], fontFace: FONT, fontSize: 12, color: "262626", border: { type: "solid", pt: 0.5, color: "D9D9D9" }, margin: 0.06, autoPage: false },
    );
    s.addText("Each specialist's full output is in the Word export's appendix.", { x: 0.6, y: 6.55, w: W - 1.2, h: 0.35, fontFace: FONT, fontSize: 11, italic: true, color: GREY });
  }

  // pptxgenjs ignores its compression option, and writes paragraph properties for every text run;
  // a paragraph may have only one (the first), so the extra ones are removed before deflating.
  const zip = await JSZip.loadAsync((await p.write({ outputType: "nodebuffer" })) as Buffer);
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    zip.file(name, singleParagraphProperties(await zip.file(name)!.async("string")));
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** Keeps only the leading a:pPr of each a:p. */
export function singleParagraphProperties(xml: string): string {
  return xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (_m, inner: string) => {
    const pPr = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g;
    const body = inner.replace(pPr, (match: string, offset: number) => (offset === 0 ? match : ""));
    return `<a:p>${body}</a:p>`;
  });
}
