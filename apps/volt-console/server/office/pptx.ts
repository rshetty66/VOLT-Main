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
import { STANDARD_BRAND, fitLogo, joinLabels, textOn, type Brand } from "./brand.js";
import { benchmarkCharts, deckValueCases, money, type BenchmarkChart, type ValueCaseChart } from "./charts.js";

const GREY = "595959";
const W = 13.333;

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

export async function buildPptx(c: RunContent, brand: Brand = STANDARD_BRAND): Promise<Buffer> {
  const NAVY = brand.primary;
  const ACCENT = brand.accent;
  const FONT = brand.bodyFont;
  const HFONT = brand.headingFont;
  const HEAD_TEXT = textOn(brand.primary);
  // Title-slide text sits on the primary colour: white on dark brands, near-black on light ones.
  const onDark = HEAD_TEXT === "FFFFFF";
  const coverSub = onDark ? "E6E6E6" : "404040";
  const coverQuiet = onDark ? "C8C8C8" : "595959";
  const logoData = brand.logo ? `${brand.logo.type};base64,${brand.logo.data.toString("base64")}` : undefined;
  const cornerLogo = brand.logo ? fitLogo(brand.logo, 1.5, 0.55) : undefined;
  const p = new PptxGenJS();
  p.layout = "LAYOUT_WIDE";
  p.title = c.title;
  p.company = c.client || "VOLT";
  const footer = joinLabels([c.client, brand.confidentiality, c.isDemo ? "Demo output: simulated text" : brand.footer || "Working draft"], "  |  ");

  p.defineSlideMaster({
    title: "CONTENT",
    background: { color: "FFFFFF" },
    objects: [
      { rect: { x: 0, y: 0, w: W, h: 0.1, fill: { color: NAVY } } },
      { line: { x: 0.5, y: 1.18, w: W - 1, h: 0, line: { color: ACCENT, width: 1.25 } } },
      { text: { text: footer, options: { x: 0.5, y: 7.05, w: 11, h: 0.3, fontFace: FONT, fontSize: 9, color: "8C8C8C" } } },
      ...(logoData && cornerLogo ? [{ image: { x: W - 0.5 - cornerLogo.w, y: 0.42, w: cornerLogo.w, h: cornerLogo.h, data: logoData } }] : []),
    ],
    slideNumber: { x: W - 1.1, y: 7.05, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 9, color: "8C8C8C", align: "right" },
  });

  const content = (title: string) => {
    const s = p.addSlide({ masterName: "CONTENT" });
    const titleW = W - 1 - (cornerLogo ? cornerLogo.w + 0.3 : 0);
    s.addText(title, { x: 0.5, y: 0.3, w: titleW, h: 0.8, fontFace: HFONT, fontSize: 24, bold: true, color: NAVY, valign: "bottom", fit: "shrink" });
    return s;
  };

  // Title slide
  const t = p.addSlide();
  t.background = { color: NAVY };
  t.addShape(p.ShapeType.rect, { x: 0.6, y: 2.2, w: 0.12, h: 2.2, fill: { color: ACCENT }, line: { color: ACCENT } });
  if (brand.logo && logoData) {
    const big = fitLogo(brand.logo, 2.6, 0.9);
    // Logos are usually drawn for light backgrounds: on a dark cover, set the logo on a white panel.
    if (onDark) t.addShape(p.ShapeType.roundRect, { x: 0.8, y: 0.65, w: big.w + 0.3, h: big.h + 0.3, rectRadius: 0.08, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" } });
    t.addImage({ data: logoData, x: 0.95, y: 0.8, w: big.w, h: big.h });
  }
  t.addText(c.title, { x: 0.95, y: 2.1, w: 11.4, h: 1.5, fontFace: HFONT, fontSize: 36, bold: true, color: HEAD_TEXT, valign: "top", fit: "shrink" });
  t.addText([c.client, c.engagementTitle].filter(Boolean).join("  |  ") || brand.organisation || "VOLT", { x: 0.95, y: 3.65, w: 11.4, h: 0.5, fontFace: FONT, fontSize: 18, color: coverSub });
  t.addText(`${c.date}  |  ${c.status === "done" ? "Working draft for review" : `Run ${c.status}`}`, { x: 0.95, y: 4.15, w: 11.4, h: 0.4, fontFace: FONT, fontSize: 13, color: coverQuiet });
  if (brand.confidentiality) t.addText(brand.confidentiality, { x: 0.95, y: 4.6, w: 11.4, h: 0.4, fontFace: FONT, fontSize: 13, bold: true, color: coverSub });
  t.addText(c.isDemo ? c.modeLabel : joinLabels([brand.organisation, c.modeLabel], "  |  "), { x: 0.95, y: 6.6, w: 11.4, h: 0.35, fontFace: FONT, fontSize: 10, color: coverQuiet });
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
      const head = Array.from({ length: cols }, (_, i) => ({ text: plain(tbl.header[i] ?? []), options: { bold: true, color: HEAD_TEXT, fill: { color: NAVY } } }));
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

  // Charts from the agents' tool results: APQC benchmark positions, then the value cases.
  const benches = benchmarkCharts(c);
  const fmt = (v: number, unit: string) => (unit === "%" ? `${v}%` : `${v.toLocaleString("en")}${unit && !/^\$|ratio/i.test(unit) ? ` ${unit}` : ""}`);
  for (let i = 0; i < benches.length; i += 4) {
    const group = benches.slice(i, i + 4);
    const s = content(benches.length > 4 ? `APQC benchmark position (${i / 4 + 1} of ${Math.ceil(benches.length / 4)})` : "APQC benchmark position");
    group.forEach((b, k) => benchmarkChart(s, b, 0.6 + (k % 2) * 6.15, 1.4 + Math.floor(k / 2) * 2.75, 5.95, 2.6));
    s.addText("Bars: APQC quartile values; highlighted bar: the client. Source: the agents' apqc_benchmark tool results.", { x: 0.6, y: 6.65, w: W - 1.2, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: GREY });
    s.addNotes(group.map((b) => `${b.metric}: top quartile ${fmt(b.top25, b.unit)}, median ${fmt(b.median, b.unit)}, bottom quartile ${fmt(b.bottom25, b.unit)}${b.client !== null ? `; client ${fmt(b.client, b.unit)} (${b.quartile})` : ""}. Looked up by ${b.by}.`).join("\n"));
  }

  function benchmarkChart(s: PptxGenJS.Slide, b: BenchmarkChart, x: number, y: number, w: number, h: number) {
    // A horizontal bar chart draws its first category at the bottom, so the list runs client first, top quartile last.
    const labels = [...(b.client !== null ? ["Client"] : []), "Bottom quartile", "Median", "Top quartile"];
    const quartiles = [...(b.client !== null ? [null] : []), b.bottom25, b.median, b.top25];
    const data = [{ name: "APQC", labels, values: quartiles }];
    if (b.client !== null) data.push({ name: "Client", labels, values: [b.client, null, null, null] });
    s.addText(
      [
        { text: b.metric, options: { bold: true, color: "262626", breakLine: true } },
        { text: `${b.unit ? `${b.unit}, ` : ""}${b.lowerIsBetter ? "lower is better" : "higher is better"}${b.client !== null ? `  |  client: ${b.quartile.toLowerCase()}` : ""}`, options: { color: GREY, fontSize: 10 } },
      ],
      { x, y, w, h: 0.5, fontFace: FONT, fontSize: 12, valign: "top", margin: 0 },
    );
    s.addChart(p.ChartType.bar, data as PptxGenJS.OptsChartData[], {
      x, y: y + 0.5, w, h: h - 0.5,
      barDir: "bar", barGrouping: "stacked", barGapWidthPct: 45,
      chartColors: ["B4BCC8", ACCENT],
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 10, catAxisLabelColor: "404040",
      valAxisHidden: true, valGridLine: { style: "none" }, catAxisLineShow: false,
      showValue: true, dataLabelFontFace: FONT, dataLabelFontSize: 10, dataLabelColor: "262626", dataLabelPosition: "inEnd", dataLabelFormatCode: "#,##0.##",
      showLegend: false,
    });
  }

  const cases = deckValueCases(c);
  let lastCase: PptxGenJS.Slide | undefined;
  for (const vc of cases.shown) lastCase = valueCaseSlide(vc);
  if (lastCase && cases.distinct > cases.shown.length) {
    lastCase.addText(`${cases.distinct - cases.shown.length} more value-case scenario(s) are in the Excel workbook.`, { x: 0.6, y: 6.65, w: W - 1.2, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: GREY, align: "right" });
  }

  function valueCaseSlide(vc: ValueCaseChart) {
    const s = content(`Value case: ${vc.label.toLowerCase()} (${vc.by})`);
    const labels = vc.years.map((y) => (y === 0 ? "Invest" : `Year ${y}`));
    // For a combo chart pptxgenjs takes the options as its second argument (its typings say otherwise).
    (s.addChart as unknown as (types: unknown[], options: unknown) => void)(
      [
        { type: p.ChartType.bar, data: [{ name: "Net cash flow", labels, values: vc.net }], options: { chartColors: [NAVY], barGapWidthPct: 60 } },
        { type: p.ChartType.line, data: [{ name: "Cumulative cash position", labels, values: vc.cumulative }], options: { chartColors: [ACCENT], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7 } },
      ],
      {
        x: 0.6, y: 1.4, w: 8.4, h: 5.1,
        catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, catAxisLabelColor: "404040", catAxisLabelPos: "low",
        valAxisLabelFontFace: FONT, valAxisLabelFontSize: 10, valAxisLabelColor: "595959", valAxisLabelFormatCode: '[>=1000000]$#,##0.0,,"M";[<=-1000000]-$#,##0.0,,"M";$#,##0,"K"',
        valGridLine: { color: "E6E6E6", size: 0.75 },
        showLegend: true, legendPos: "b", legendFontFace: FONT, legendFontSize: 11,
      },
    );
    const facts: [string, string][] = [
      [`NPV at ${Math.round(vc.discountRate * 1000) / 10}%`, vc.npv === null ? "n/a" : money(vc.npv)],
      ["IRR", vc.irrPct === null ? "n/a" : `${Math.round(vc.irrPct * 10) / 10}%`],
      ["Payback", vc.paybackYears === null ? "beyond horizon" : `${Math.round(vc.paybackYears * 10) / 10} years`],
      ["Steady-state annual saving", vc.steadyStateSaving === null ? "n/a" : money(vc.steadyStateSaving)],
      ["One-time investment", money(vc.investment)],
    ];
    s.addText(
      facts.flatMap(([k, v]) => [
        { text: k, options: { fontSize: 11, color: GREY, breakLine: true } },
        { text: v, options: { fontSize: 22, bold: true, color: NAVY, breakLine: true, paraSpaceAfter: 10 } },
      ]),
      { x: 9.4, y: 1.5, w: 3.4, h: 4.9, fontFace: FONT, valign: "top", margin: 0 },
    );
    s.addText(`From the build_value_case tool, run by ${vc.by}. The Excel workbook rebuilds this ${vc.label.toLowerCase()} with live formulas.`, { x: 0.6, y: 6.65, w: 8.4, h: 0.3, fontFace: FONT, fontSize: 10, italic: true, color: GREY });
    s.addNotes(`${vc.label}: net cash flow by year ${vc.net.map((v, i) => `${labels[i]} ${money(v)}`).join(", ")}; cumulative ${vc.cumulative.map((v) => money(v)).join(", ")}.`);
    return s;
  }

  // Specialists consulted
  if (c.specialists.length) {
    const rows = c.specialists.map((s) => [s.name, s.layer, s.phase ?? ""]);
    const s = content("Specialists consulted");
    s.addTable(
      [["Specialist", "Practice area", "Workflow phase"].map((h) => ({ text: h, options: { bold: true, color: HEAD_TEXT, fill: { color: NAVY } } })), ...rows.map((r) => r.map((x) => ({ text: x })))],
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
  // Points left empty on purpose (the client bar's gaps) are written as empty values; drop them so no "0" is drawn.
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))) {
    zip.file(name, (await zip.file(name)!.async("string")).replace(/<c:pt idx="\d+">\s*<c:v>\s*<\/c:v>\s*<\/c:pt>/g, ""));
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
