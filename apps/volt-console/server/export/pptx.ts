import PptxGenJS from "pptxgenjs";
import type { ExportImage, ExportRequest } from "../../shared/export.js";
import { contentsOf, markdownBlocks, plain, type Run } from "./blocks.js";
import { toneFor, type Tone } from "../../shared/brand.js";
import type { ExportStyle } from "./style.js";
import { chartBlocks, type ChartSpec } from "../../shared/viz.js";
import { DECK, MUTED } from "./deckTheme.js";

type Slide = ReturnType<PptxGenJS["addSlide"]>;
type TextProps = PptxGenJS.TextProps;

/**
 * The PowerPoint export, laid out on the consulting deck design system (deckTheme.ts, the same grid, type and colours as
 * the consulting-ppt-template skill). Each "##" section becomes one slide where it fits: its text sits beside or above
 * its chart or table, and its "Source:" line sits at the foot of every slide of the section. A section only runs onto a
 * second slide when its content cannot fit at a readable size, so no slide holds a title and a source line alone.
 * planDeck() is pure, and checkPlan() is the validator that runs on every plan before a file is written.
 */

export interface Para {
  runs: Run[];
  bullet?: boolean | "number";
  indent?: number;
  italic?: boolean;
  mono?: boolean;
}

export type Exhibit =
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "chart"; spec: ChartSpec }
  | { kind: "kpi"; spec: ChartSpec }
  | { kind: "heatmap"; spec: ChartSpec }
  | { kind: "picture"; img: ExportImage };

export interface PlannedSlide {
  kind: "contents" | "text" | "exhibit";
  title: string;
  paras: Para[];
  exhibit?: Exhibit;
  /** A chart that sits under a short table on the same slide, instead of taking a slide of its own. */
  second?: Exhibit;
  source?: string;
  /** Where the text goes on an exhibit slide: a takeaways panel on the right, a strip above, or a band below. */
  place?: "panel" | "strip" | "below";
  textPt?: number;
}

// Grid, from the design system.
const W = 13.333;
const H = 7.5;
const M = DECK.grid.margin_in;
const CW = W - 2 * M;
const TOP = DECK.grid.content_top_in;
const BOTTOM = DECK.grid.content_bottom_in;
const PANEL_W = 3.65;
const MIN_PT = 12;

// ── text fitting ─────────────────────────────────────────────────────────────────────────────────────────

const AVG_EM = 0.52; // average character width of Inter / Calibri as a share of the font size

export function textHeight(paras: Para[], wIn: number, pt: number): number {
  let lines = 0;
  for (const p of paras) {
    const indent = (p.bullet ? 0.3 : 0) + (p.indent ?? 0) * 0.3;
    const perLine = Math.max(8, Math.floor(((wIn - indent) * 72) / (pt * AVG_EM)));
    for (const l of plain(p.runs).split("\n")) lines += Math.max(1, Math.ceil(l.length / perLine));
  }
  return (lines * pt * 1.2 + paras.length * pt * 0.5) / 72;
}

/** The largest size from max down to min at which the text fits the box, or null. */
export function fitPt(paras: Para[], wIn: number, hIn: number, max: number, min = MIN_PT): number | null {
  for (let pt = max; pt >= min; pt--) if (textHeight(paras, wIn, pt) <= hIn) return pt;
  return null;
}

function tableHeight(header: string[], rows: string[][], wIn: number, pt: number): number {
  const widths = colWidths([header, ...rows], wIn, pt);
  const rowH = (r: string[]) =>
    Math.max(...r.map((c, i) => Math.max(1, Math.ceil((c.length * pt * AVG_EM) / 72 / Math.max(0.3, widths[i] - 0.15))))) * ((pt * 1.25) / 72) + 0.12;
  return [header, ...rows].reduce((a, r) => a + rowH(r), 0);
}

function colWidths(all: string[][], wIn: number, pt: number): number[] {
  const n = Math.max(...all.map((r) => r.length));
  const col = (i: number) => all.map((r) => r[i] ?? "");
  // Every column first gets room for its longest word (so "Medium" never breaks), then the rest goes by text length.
  const floor = Array.from({ length: n }, (_, i) => (Math.max(3, ...col(i).flatMap((c) => c.split(/\s+/).map((w) => w.length))) * pt * 0.62) / 72 + 0.16);
  const weight = Array.from({ length: n }, (_, i) => Math.min(40, Math.max(4, ...col(i).map((c) => c.length))));
  const spare = Math.max(0, wIn - floor.reduce((a, b) => a + b, 0));
  const sum = weight.reduce((a, b) => a + b, 0);
  return floor.map((f, i) => f + (weight[i] / sum) * spare);
}

// ── planning ─────────────────────────────────────────────────────────────────────────────────────────────

const NATIVE_CHARTS = new Set<ChartSpec["type"]>(["bar", "hbar", "stacked", "line", "donut"]);
const SOURCE_RE = /^\s*\**\s*sources?\s*:/i;

function exhibitFor(ref: string, specs: (ChartSpec | null)[], images: Map<string, ExportImage>): Exhibit | null {
  const spec = ref.startsWith("viz-") ? specs[Number(ref.slice(4))] : null;
  if (spec?.type === "kpi") return { kind: "kpi", spec };
  if (spec?.type === "heatmap") return { kind: "heatmap", spec };
  if (spec && NATIVE_CHARTS.has(spec.type) && !spec.target && spec.highlight === undefined) return { kind: "chart", spec };
  const img = images.get(ref);
  return img ? { kind: "picture", img } : null;
}

interface Section {
  title: string;
  paras: Para[];
  exhibits: Exhibit[];
  sources: string[];
  /** A chart's own source line, used only when the section has no Source paragraph. */
  chartSources: string[];
}

function sectionsOf(req: ExportRequest): Section[] {
  const specs = chartBlocks(req.markdown);
  const images = new Map((req.images ?? []).map((i) => [i.ref, i]));
  const out: Section[] = [];
  let cur: Section = { title: "Summary", paras: [], exhibits: [], sources: [], chartSources: [] };
  const push = () => {
    if (cur.paras.length || cur.exhibits.length) out.push(cur);
  };
  for (const b of markdownBlocks(req.markdown)) {
    switch (b.type) {
      case "heading":
        if (b.depth <= 3) {
          push();
          cur = { title: b.text, paras: [], exhibits: [], sources: [], chartSources: [] };
        } else cur.paras.push({ runs: [{ text: b.text, bold: true }] });
        break;
      case "paragraph": {
        const t = plain(b.runs).trim();
        if (!t) break;
        if (SOURCE_RE.test(t)) cur.sources.push(t.replace(/^\s*\**\s*/, "").replace(/\*\*/g, ""));
        else cur.paras.push({ runs: b.runs });
        break;
      }
      case "list":
        b.items.forEach((it) => cur.paras.push({ runs: it.runs, bullet: b.ordered ? "number" : true, indent: it.level }));
        break;
      case "quote":
        cur.paras.push({ runs: b.runs, italic: true });
        break;
      case "code":
        cur.paras.push({ runs: [{ text: b.text }], mono: true });
        break;
      case "table":
        cur.exhibits.push({ kind: "table", header: b.header, rows: b.rows });
        break;
      case "image": {
        const ex = exhibitFor(b.ref, specs, images);
        if (!ex) break;
        cur.exhibits.push(ex);
        if (ex.kind === "chart" || ex.kind === "kpi" || ex.kind === "heatmap") {
          if (ex.spec.note && !cur.paras.some((p) => plain(p.runs) === ex.spec.note)) cur.paras.push({ runs: [{ text: ex.spec.note }] });
          if (ex.spec.source && !cur.chartSources.length) cur.chartSources.push(`Source: ${ex.spec.source}`);
        }
        break;
      }
      case "rule":
        break;
    }
  }
  push();
  return out;
}

/** Packs text into as few slides as fit at 14pt or more, then lets each slide grow to 18pt where it has room. */
function textSlides(title: string, paras: Para[], source: string | undefined, h: number): PlannedSlide[] {
  const chunks: Para[][] = [];
  let chunk: Para[] = [];
  for (const p of paras) {
    if (chunk.length && fitPt([...chunk, p], CW, h, 14, 14) === null) {
      chunks.push(chunk);
      chunk = [];
    }
    chunk.push(p);
  }
  if (chunk.length) chunks.push(chunk);
  return chunks.map((c, i) => ({ kind: "text", title: i ? `${title} (cont.)` : title, paras: c, source, textPt: fitPt(c, CW, h, 18) ?? MIN_PT }));
}

/** Splits a table into slides of rows that fit the height, repeating the header. */
function tableChunks(ex: Extract<Exhibit, { kind: "table" }>, wIn: number, hIn: number, pt: number): Exhibit[] {
  const out: Exhibit[] = [];
  let rows: string[][] = [];
  for (const r of ex.rows) {
    if (rows.length && tableHeight(ex.header, [...rows, r], wIn, pt) > hIn) {
      out.push({ ...ex, rows });
      rows = [];
    }
    rows.push(r);
  }
  out.push({ ...ex, rows });
  return out;
}

const tablePt = (rows: number) => (rows > 8 ? 11 : 12);
/** The smallest box a chart may have under a table; the gap between them. */
const MIN_SECOND_H = 2.4;
const SECOND_GAP = 0.3;

/** Height the text strip above an exhibit takes: its text, at most 1 inch, plus a gap. */
function stripH(p: PlannedSlide): number {
  return Math.min(1.0, textHeight(p.paras, CW, p.textPt ?? MIN_PT)) + 0.1;
}

/** Height of a slide's table plus the gap below it, or Infinity when the slide's exhibit is not a table. */
function stackedTableH(p: PlannedSlide): number {
  const t = p.exhibit;
  return t?.kind === "table" ? tableHeight(t.header, t.rows, CW, tablePt(t.rows.length)) + SECOND_GAP : Infinity;
}

export function planDeck(req: ExportRequest): PlannedSlide[] {
  const slides: PlannedSlide[] = [];
  const body = BOTTOM - TOP;
  for (const sec of sectionsOf(req)) {
    const source = (sec.sources.length ? sec.sources : sec.chartSources).join(" ") || undefined;
    if (!sec.exhibits.length) {
      slides.push(...textSlides(sec.title, sec.paras, source, body));
      continue;
    }
    // Decide where the section's text goes on its first exhibit slide.
    let paras = sec.paras;
    let place: PlannedSlide["place"];
    let textPt: number | undefined;
    const first = sec.exhibits[0];
    const wide = (first.kind === "table" && first.header.length >= 5) || (first.kind === "heatmap" && first.spec.labels.length >= 6);
    if (paras.length) {
      const tries: [PlannedSlide["place"], number, number][] =
        first.kind === "kpi" ? [["below", CW, 1.5]] : wide ? [["strip", CW, 1.0], ["below", CW, 1.2]] : [["panel", PANEL_W - 0.6, body - 1.6], ["strip", CW, 1.0]];
      for (const [p, w, h] of tries) {
        const pt = fitPt(paras, w, h, p === "panel" ? 14 : 16);
        if (pt) {
          place = p;
          textPt = pt;
          break;
        }
      }
      if (!place) {
        // Too much text to sit beside the exhibit: it gets slides of its own, and the exhibits follow.
        slides.push(...textSlides(sec.title, paras, source, body));
        paras = [];
      }
    }
    let n = slides.filter((s) => s.title.startsWith(sec.title)).length;
    const start = slides.length;
    sec.exhibits.forEach((ex, i) => {
      const prev = slides.length > start ? slides[slides.length - 1] : undefined;
      if (prev && !prev.second && ex.kind !== "table" && ex.kind !== "picture" && (prev.place === undefined || prev.place === "strip")) {
        const left = body - (prev.place === "strip" ? stripH(prev) : 0) - stackedTableH(prev);
        if (left >= MIN_SECOND_H) {
          prev.second = ex;
          return;
        }
      }
      const withText = i === 0 && paras.length > 0;
      const reserve = !withText ? 0 : place === "strip" ? 1.1 : place === "below" ? 1.6 : 0;
      const w = withText && place === "panel" ? CW - PANEL_W - 0.3 : CW;
      const parts = ex.kind === "table" ? tableChunks(ex, w, body - reserve, tablePt(ex.rows.length)) : [ex];
      parts.forEach((part, j) => {
        const text = withText && j === 0;
        slides.push({ kind: "exhibit", title: n++ ? `${sec.title} (cont.)` : sec.title, paras: text ? paras : [], exhibit: part, source, place: text ? place : undefined, textPt: text ? textPt : undefined });
      });
    });
  }
  const chartImages = (req.images ?? []).filter((i) => i.ref.startsWith("chart-"));
  for (const img of chartImages) slides.push({ kind: "exhibit", title: img.caption ? `Appendix: ${img.caption}` : "Appendix: Supporting analysis", paras: [], exhibit: { kind: "picture", img } });
  // Contents lists only the sections that got a slide, so a section with nothing to show leaves no dead entry.
  const shown = markdownBlocks(req.markdown).filter((b) => b.type !== "heading" || b.depth !== 2 || slides.some((s) => s.title === b.text));
  const contents = contentsOf(shown, [], chartImages.length ? ["Appendix: Supporting analysis"] : []);
  if (contents.length) slides.unshift({ kind: "contents", title: "Contents", paras: contents.map((t) => ({ runs: [{ text: t }] })) });
  return slides;
}

/** The validator: every slide must carry content beyond its title and source, and its text must fit. */
export function checkPlan(slides: PlannedSlide[]): string[] {
  const issues: string[] = [];
  slides.forEach((s, i) => {
    const n = i + 2; // slide 1 is the cover
    if (!s.exhibit && !s.paras.length) issues.push(`slide ${n}: no content besides the title`);
    if (s.kind === "text" && textHeight(s.paras, CW, s.textPt ?? MIN_PT) > BOTTOM - TOP + 0.05) issues.push(`slide ${n}: text overflows`);
    if (s.place === "panel" && textHeight(s.paras, PANEL_W - 0.6, s.textPt ?? MIN_PT) > BOTTOM - TOP - 1.55) issues.push(`slide ${n}: takeaways overflow`);
    if ((s.textPt ?? MIN_PT) < MIN_PT) issues.push(`slide ${n}: text under ${MIN_PT}pt`);
    if (s.source && s.source.length > 260) issues.push(`slide ${n}: source line longer than two lines`);
  });
  return issues;
}

// ── rendering ────────────────────────────────────────────────────────────────────────────────────────────

const TONE_FILL: Record<Tone, string> = { high: DECK.colors.accent6, mid: DECK.colors.accent5, low: DECK.colors.accent4 };

export async function writePptx(req: ExportRequest, s: ExportStyle): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "VOLT", width: W, height: H });
  pptx.layout = "VOLT";
  pptx.title = req.title;
  pptx.company = "VOLT Console";

  // VOLT's own look unless a client template is selected; then its fonts and colours drive the same layouts.
  const C = DECK.colors;
  const head = s.brand ? DECK.fonts.heading : s.headingFont;
  const font = s.brand ? DECK.fonts.body : s.bodyFont;
  const navy = s.brand ? C.dk1 : s.headingColor;
  const titleInk = s.brand ? C.dk2 : s.headingColor;
  const ink = s.brand ? C.dk1 : s.ink;
  const accent = s.brand ? C.accent1 : s.accent;
  // Stacked segments carry white labels, so they use only the darker theme colours.
  const stackColors = [C.dk2, C.accent1, C.accent4, C.accent6, MUTED];
  const series = s.brand ? [C.accent1, C.dk2, C.accent3, C.accent4, C.accent5, C.accent6] : [s.accent, s.headingColor, C.accent3, C.accent4, C.accent5, C.accent6];
  const F = DECK.grid.footer_top_in;

  pptx.defineSlideMaster({
    title: "CONTENT",
    background: { color: "FFFFFF" },
    objects: s.brand
      ? [
          { rect: { x: M, y: F + 0.06, w: 0.12, h: 0.12, fill: { color: accent }, line: { color: accent } } },
          { text: { text: "VOLT", options: { x: M + 0.22, y: F, w: 3, h: 0.25, fontFace: font, fontSize: DECK.type_pt.footer, bold: true, color: titleInk, margin: 0 } } },
        ]
      : [],
    slideNumber: { x: W - M - 0.8, y: F, w: 0.8, h: 0.25, fontFace: font, fontSize: DECK.type_pt.footer, color: MUTED, align: "right" },
  });

  const runsOf = (paras: Para[], pt: number, color: string): TextProps[] =>
    paras.flatMap((p) => {
      const pieces = p.runs.filter((r) => r.text);
      return pieces.map((r, i) => ({
        text: r.text,
        options: {
          bold: r.bold,
          italic: r.italic || p.italic,
          fontFace: r.code || p.mono ? "Consolas" : font,
          fontSize: pt,
          color,
          // pptxgenjs writes paragraph properties from every run, so each run repeats them.
          bullet: p.bullet === "number" ? { type: "number" as const } : p.bullet ? { characterCode: "25A0", indent: 16 } : false,
          indentLevel: p.indent,
          paraSpaceBefore: 6,
          ...(i === pieces.length - 1 ? { breakLine: true } : {}),
        },
      }));
    });

  const titled = (p: PlannedSlide): Slide => {
    const slide = pptx.addSlide({ masterName: "CONTENT" });
    const size = fitPt([{ runs: [{ text: p.title }] }], CW, DECK.grid.title_height_in, DECK.type_pt.title, 20) ?? 20;
    slide.addText(p.title, { x: M, y: DECK.grid.title_top_in, w: CW, h: DECK.grid.title_height_in, fontFace: head, fontSize: size, color: titleInk, valign: "bottom", margin: 0 });
    if (p.source) {
      slide.addText(p.source, { x: M, y: DECK.grid.source_top_in, w: CW - 1, h: 0.36, fontFace: font, fontSize: DECK.type_pt.source, color: MUTED, valign: "top", margin: 0 });
    }
    return slide;
  };

  const box = (slide: Slide, ex: Exhibit, x: number, y: number, w: number, h: number) => {
    switch (ex.kind) {
      case "table": {
        const pt = tablePt(ex.rows.length);
        const widths = colWidths([ex.header, ...ex.rows], w, pt);
        const header = ex.header.map((t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: s.brand ? accent : s.headerFill } } }));
        const rows = ex.rows.map((r, ri) =>
          ex.header.map((col, i) => {
            const t = (r[i] ?? "").replace(/\*\*/g, "");
            const tone = toneFor(col, t);
            const zebra = ri % 2 ? { fill: { color: "F4F6FA" } } : {};
            return tone ? { text: t, options: { bold: true, color: tone === "mid" ? ink : "FFFFFF", fill: { color: TONE_FILL[tone] } } } : { text: t, options: zebra };
          }),
        );
        slide.addTable([header, ...rows], { x, y, w, colW: widths, fontFace: font, fontSize: pt, color: ink, valign: "middle", border: { type: "solid", pt: 0.5, color: "D5DAE3" }, margin: 0.06 });
        break;
      }
      case "chart": {
        const spec = ex.spec;
        const kind = ({ bar: "bar", hbar: "bar", stacked: "bar", line: "line", donut: "doughnut" } as const)[spec.type as "bar"];
        const data = spec.series.slice(0, spec.type === "donut" ? 1 : undefined).map((d) => ({ name: d.name, labels: spec.labels, values: d.values }));
        slide.addChart(kind, data, {
          x, y, w, h,
          showTitle: true, title: spec.title + (spec.unit ? ` (${spec.unit})` : ""), titleFontFace: head, titleFontSize: 14, titleColor: titleInk,
          // One series reads as one colour; pptxgenjs would otherwise colour each bar differently.
          chartColors: spec.series.length === 1 && spec.type !== "donut" ? [series[0]] : spec.type === "stacked" ? stackColors : series,
          showLegend: spec.series.length > 1 || spec.type === "donut", legendPos: "b", legendFontFace: font, legendFontSize: 11,
          showValue: spec.type !== "donut", showPercent: spec.type === "donut", dataLabelFormatCode: "General", valAxisLabelFormatCode: "General", dataLabelFontSize: 10, dataLabelColor: spec.type === "stacked" ? "FFFFFF" : ink, dataLabelFontFace: font,
          catAxisLabelFontFace: font, catAxisLabelFontSize: 11, catAxisLabelColor: ink, valAxisLabelFontFace: font, valAxisLabelFontSize: 10, valAxisLabelColor: MUTED,
          valAxisHidden: spec.type !== "line", valGridLine: { style: "none" }, catGridLine: { style: "none" },
          ...(spec.type === "hbar" ? { barDir: "bar", catAxisOrientation: "maxMin" } : spec.type === "stacked" ? { barDir: "col", barGrouping: "stacked" } : { barDir: "col" }),
          ...(spec.type === "donut" ? { holeSize: 60 } : {}),
          ...(spec.type === "line" ? { lineSize: 3, lineDataSymbolSize: 7 } : { barGapWidthPct: 60 }),
        } as PptxGenJS.IChartOpts);
        break;
      }
      case "kpi": {
        const spec = ex.spec;
        const n = spec.labels.length;
        const perRow = Math.min(4, n);
        const rowsN = Math.ceil(n / perRow);
        const gap = 0.25;
        const tw = (w - (perRow - 1) * gap) / perRow;
        const th = Math.min(2.3, (h - (rowsN - 1) * gap) / rowsN);
        const fmt = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 2 });
        spec.labels.forEach((label, i) => {
          const tx = x + (i % perRow) * (tw + gap);
          const ty = y + Math.floor(i / perRow) * (th + gap);
          slide.addShape(pptx.ShapeType.rect, { x: tx, y: ty, w: tw, h: th, fill: { color: "FFFFFF" }, line: { color: "D5DAE3", width: 0.75 } });
          slide.addShape(pptx.ShapeType.rect, { x: tx, y: ty, w: tw, h: 0.08, fill: { color: accent }, line: { color: accent } });
          const v = spec.series[0].values[i];
          slide.addText(`${fmt(v)}${spec.unit && spec.unit.length <= 4 ? spec.unit : ""}`, { x: tx + 0.25, y: ty + 0.25, w: tw - 0.5, h: th * 0.4, fontFace: head, fontSize: DECK.type_pt.stat, color: titleInk, valign: "bottom", margin: 0 });
          const lines: TextProps[] = [{ text: label, options: { bold: true, breakLine: true } }];
          const base = spec.series[1]?.values[i];
          if (base !== undefined && Number.isFinite(base)) {
            const d = v - base;
            const pct = base ? ` (${d > 0 ? "+" : ""}${((d / base) * 100).toFixed(1)}%)` : "";
            lines.push({ text: `${d > 0 ? "+" : ""}${fmt(d)}${pct} vs ${spec.series[1].name}: ${fmt(base)}` });
          }
          slide.addText(lines, { x: tx + 0.25, y: ty + 0.3 + th * 0.4, w: tw - 0.5, h: th * 0.6 - 0.4, fontFace: font, fontSize: DECK.type_pt.small, color: ink, valign: "top", margin: 0 });
        });
        break;
      }
      case "heatmap": {
        const spec = ex.spec;
        const all = spec.series.flatMap((r) => r.values).filter(Number.isFinite);
        const lo = Math.min(...all), hi = Math.max(...all);
        const rag = spec.scale === "rag";
        const ragCell = (v: number) => (v <= 1 ? { t: "R", f: C.accent6 } : v <= 2 ? { t: "A", f: C.accent5 } : { t: "G", f: C.accent4 });
        const blend = (v: number) => {
          const k = hi > lo ? (v - lo) / (hi - lo) : 1;
          const c = (i: number) => Math.round(255 + (parseInt(accent.slice(i, i + 2), 16) - 255) * (0.15 + 0.85 * k));
          return [0, 2, 4].map((i) => c(i).toString(16).padStart(2, "0")).join("").toUpperCase();
        };
        const header = ["", ...spec.labels].map((t) => ({ text: t, options: { bold: true, color: ink, fill: { color: "FFFFFF" }, align: "center" as const } }));
        const rows = spec.series.map((r) => [
          { text: r.name, options: { bold: true, color: ink, fill: { color: "FFFFFF" } } },
          ...r.values.map((v) => {
            if (rag) {
              const c = ragCell(v);
              return { text: c.t, options: { bold: true, align: "center" as const, color: "FFFFFF", fill: { color: c.f } } };
            }
            const f = blend(v);
            const dark = hi > lo && (v - lo) / (hi - lo) > 0.55;
            return { text: String(v), options: { align: "center" as const, color: dark ? "FFFFFF" : ink, fill: { color: f } } };
          }),
        ]);
        const widths = [Math.min(2.6, w * 0.25), ...spec.labels.map(() => (w - Math.min(2.6, w * 0.25)) / spec.labels.length)];
        slide.addTable([header, ...rows], { x, y, w, colW: widths, fontFace: font, fontSize: 12, valign: "middle", border: { type: "solid", pt: 2, color: "FFFFFF" }, rowH: Math.min(0.55, h / (rows.length + 1)) });
        if (rag) slide.addText("R red, A amber, G green", { x, y: y + h - 0.3, w, h: 0.3, fontFace: font, fontSize: 10, color: MUTED, margin: 0 });
        break;
      }
      case "picture": {
        const img = ex.img;
        const k = Math.min(w / img.width, h / img.height);
        const pw = img.width * k, ph = img.height * k;
        slide.addImage({ data: `image/png;base64,${img.png}`, x: x + (w - pw) / 2, y: y + (h - ph) / 2, w: pw, h: ph });
        break;
      }
    }
  };

  // Cover: the consulting cover, a white card over a light field and a navy base band.
  const cover = pptx.addSlide();
  cover.background = { color: s.brand ? C.lt2 : "F2F2F2" };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 4.65, w: W, h: H - 4.65, fill: { color: navy }, line: { color: navy } });
  cover.addShape(pptx.ShapeType.rect, { x: M, y: 1.35, w: 3.55, h: 4.75, fill: { color: s.brand ? C.dk2 : accent }, line: { color: s.brand ? C.dk2 : accent } });
  if (s.brand) cover.addText("VOLT", { x: M + 0.35, y: 5.45, w: 2.8, h: 0.4, fontFace: font, fontSize: 16, bold: true, color: "FFFFFF", margin: 0 });
  cover.addShape(pptx.ShapeType.rect, { x: 4.35, y: 1.35, w: W - M - 4.35, h: 4.75, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" } });
  [0, 1, 2].forEach((i) => cover.addShape(pptx.ShapeType.rect, { x: W - M - 0.25 - (3 - i) * 0.3 - (2 - i) * 0.22, y: 5.5, w: 0.3, h: 0.3, fill: { color: accent }, line: { color: accent } }));
  const coverPt = fitPt([{ runs: [{ text: req.title }] }], 7.55, 2.1, DECK.type_pt.cover_title, 24) ?? 24;
  cover.addText(req.title, { x: 4.75, y: 1.95, w: 7.55, h: 2.2, fontFace: head, fontSize: coverPt, color: titleInk, valign: "bottom", margin: 0 });
  cover.addText(req.subtitle ?? `Generated ${new Date().toISOString().slice(0, 10)}`, { x: 4.75, y: 4.35, w: 6.0, h: 1.0, fontFace: font, fontSize: 18, color: ink, valign: "top", margin: 0 });

  const plan = planDeck(req);
  const issues = checkPlan(plan);
  if (issues.length) console.warn(`[export] PowerPoint layout check: ${issues.join("; ")}`);

  for (const p of plan) {
    const slide = titled(p);
    if (p.kind === "contents") {
      const items = p.paras;
      const half = items.length > 7 ? Math.ceil(items.length / 2) : items.length;
      [items.slice(0, half), items.slice(half)].forEach((col, i) => {
        if (!col.length) return;
        const cw = items.length > 7 ? (CW - 0.5) / 2 : CW;
        const pt = fitPt(col, cw, BOTTOM - TOP, 18) ?? MIN_PT;
        slide.addText(runsOf(col, pt, ink), { x: M + i * (cw + 0.5), y: TOP, w: cw, h: BOTTOM - TOP, valign: "top", margin: 0, paraSpaceAfter: 6 });
      });
      continue;
    }
    if (p.kind === "text") {
      slide.addText(runsOf(p.paras, p.textPt ?? MIN_PT, ink), { x: M, y: TOP, w: CW, h: BOTTOM - TOP, valign: "top", margin: 0 });
      continue;
    }
    const ex = p.exhibit!;
    const pt = p.textPt ?? MIN_PT;
    if (p.paras.length && p.place === "panel") {
      const px = W - M - PANEL_W;
      slide.addShape(pptx.ShapeType.rect, { x: px, y: TOP, w: PANEL_W, h: BOTTOM - TOP, fill: { color: navy }, line: { color: navy } });
      slide.addShape(pptx.ShapeType.rect, { x: px + 0.3, y: TOP + 0.3, w: 0.3, h: 0.3, fill: { color: accent }, line: { color: accent } });
      slide.addText("Key takeaways", { x: px + 0.3, y: TOP + 0.75, w: PANEL_W - 0.6, h: 0.5, fontFace: head, fontSize: DECK.type_pt.heading, color: "FFFFFF", margin: 0 });
      slide.addText(runsOf(p.paras, pt, "FFFFFF"), { x: px + 0.3, y: TOP + 1.35, w: PANEL_W - 0.6, h: BOTTOM - TOP - 1.55, valign: "top", margin: 0 });
      box(slide, ex, M, TOP, CW - PANEL_W - 0.3, BOTTOM - TOP);
    } else if (p.paras.length && p.place === "strip") {
      const sh = stripH(p);
      slide.addText(runsOf(p.paras, pt, ink), { x: M, y: TOP, w: CW, h: sh - 0.1, valign: "top", margin: 0 });
      box(slide, ex, M, TOP + sh, CW, BOTTOM - TOP - sh);
      if (p.second) box(slide, p.second, M, TOP + sh + stackedTableH(p), CW, BOTTOM - TOP - sh - stackedTableH(p));
    } else if (p.paras.length && p.place === "below") {
      box(slide, ex, M, TOP, CW, BOTTOM - TOP - 1.6);
      slide.addShape(pptx.ShapeType.rect, { x: M, y: BOTTOM - 1.45, w: CW, h: 0.02, fill: { color: C.lt2 }, line: { color: C.lt2 } });
      slide.addText(runsOf(p.paras, pt, ink), { x: M, y: BOTTOM - 1.35, w: CW, h: 1.35, valign: "top", margin: 0 });
    } else {
      box(slide, ex, M, TOP, CW, BOTTOM - TOP);
      if (p.second) box(slide, p.second, M, TOP + stackedTableH(p), CW, BOTTOM - TOP - stackedTableH(p));
    }
  }
  return new Uint8Array((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}
