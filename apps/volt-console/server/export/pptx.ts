import PptxGenJS from "pptxgenjs";
import type { ExportImage, ExportRequest } from "../../shared/export.js";
import { contentsOf, markdownBlocks, plain, type Run } from "./blocks.js";
import { TONE_STYLE, toneFor } from "../../shared/brand.js";
import { BRAND, brandLogo } from "./brand.js";
import type { ExportStyle } from "./style.js";
import { chartBlocks, type ChartSpec } from "../../shared/viz.js";

type Slide = ReturnType<PptxGenJS["addSlide"]>;
type TextProps = PptxGenJS.TextProps;

const MAX_LINES = 8;
const MAX_CHARS = 900;

/** Title slide, a picture slide per chart, then one slide per H1-H3 section (continued when long). */
export async function writePptx(req: ExportRequest, s: ExportStyle): Promise<Uint8Array> {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "VOLT", width: s.slide.widthIn, height: s.slide.heightIn });
  pptx.layout = "VOLT";
  pptx.title = req.title;
  pptx.company = "VOLT Console";
  const W = s.slide.widthIn, H = s.slide.heightIn, M = 0.5;
  const images = new Map((req.images ?? []).map((i) => [i.ref, i]));

  const titled = (title: string): Slide => {
    const slide = pptx.addSlide();
    slide.addText(title, { x: M, y: 0.3, w: W - 2 * M, h: 0.8, fontFace: s.headingFont, fontSize: 26, bold: true, color: s.headingColor, valign: "middle" });
    slide.addShape(pptx.ShapeType.line, { x: M, y: 1.12, w: W - 2 * M, h: 0, line: { color: s.accent, width: 1.5 } });
    if (s.brand) {
      slide.addText(`VOLT  ·  ${BRAND.tagline}`, { x: M, y: H - 0.4, w: W - 2 * M - 1, h: 0.3, fontFace: s.bodyFont, fontSize: 10, color: "5B6862" });
      slide.slideNumber = { x: W - M - 0.8, y: H - 0.4, w: 0.8, h: 0.3, fontFace: s.bodyFont, fontSize: 10, color: "5B6862", align: "right" };
    }
    return slide;
  };
  const picture = (title: string, img: ExportImage) => {
    const slide = titled(title);
    const boxW = W - 2 * M, boxH = H - 1.5 - 0.4 - (img.caption ? 0.4 : 0);
    const k = Math.min(boxW / img.width, boxH / img.height);
    const w = img.width * k, h = img.height * k;
    slide.addImage({ data: `image/png;base64,${img.png}`, x: (W - w) / 2, y: 1.4 + (boxH - h) / 2, w, h });
    if (img.caption) slide.addText(img.caption, { x: M, y: H - 0.8, w: W - 2 * M, h: 0.4, fontFace: s.bodyFont, fontSize: 12, italic: true, color: "5B6862", align: "center" });
  };

  // A chart block whose type PowerPoint draws natively becomes an editable chart; the rest stay pictures, and so does a
  // chart with a target line or a call-out, which a native chart cannot carry.
  const specs = chartBlocks(req.markdown);
  const NATIVE: Partial<Record<ChartSpec["type"], PptxGenJS.CHART_NAME>> = { bar: "bar", hbar: "bar", stacked: "bar", line: "line", donut: "doughnut" };
  const colours = ["1A1E2E", "0097A7", "D4AF37", "FF5722", "5C6BC0", "8A90A5"];
  const native = (spec: ChartSpec | null | undefined): spec is ChartSpec => !!spec && !!NATIVE[spec.type] && !spec.target && spec.highlight === undefined;
  const nativeChart = (title: string, spec: ChartSpec) => {
    const kind = NATIVE[spec.type]!;
    const slide = titled(title);
    const data = spec.series.slice(0, spec.type === "donut" ? 1 : undefined).map((x) => ({ name: x.name, labels: spec.labels, values: x.values }));
    const foot = spec.source ? 0.45 : 0;
    slide.addChart(kind, data, {
      x: M, y: 1.3, w: W - 2 * M, h: H - 1.75 - foot,
      showTitle: true, title: spec.title + (spec.unit ? ` (${spec.unit})` : ""), titleFontFace: s.headingFont, titleFontSize: 16, titleColor: s.headingColor,
      chartColors: s.brand ? colours : [s.accent, ...colours.slice(1)],
      showLegend: spec.series.length > 1 || spec.type === "donut", legendPos: "b", legendFontFace: s.bodyFont, legendFontSize: 11,
      showValue: spec.type !== "donut", showPercent: spec.type === "donut", dataLabelFontSize: 10, dataLabelColor: s.ink,
      catAxisLabelFontFace: s.bodyFont, catAxisLabelFontSize: 11, valAxisLabelFontFace: s.bodyFont, valAxisLabelFontSize: 10,
      valGridLine: { color: "D9DCE6", size: 0.5 }, catGridLine: { style: "none" },
      ...(spec.type === "hbar" ? { barDir: "bar" } : spec.type === "stacked" ? { barDir: "col", barGrouping: "stacked" } : { barDir: "col" }),
      ...(spec.type === "donut" ? { holeSize: 60 } : {}),
      ...(spec.type === "line" ? { lineSize: 3, lineDataSymbolSize: 7 } : { barGapWidthPct: 60 }),
    });
    if (spec.source) slide.addText(`Source: ${spec.source}`, { x: M, y: H - 0.85, w: W - 2 * M, h: 0.35, fontFace: s.bodyFont, fontSize: 11, color: "5B6862" });
  };

  // Title slide: VOLT's own cover (dark, no logo) unless a client template is selected.
  const first = pptx.addSlide();
  if (s.brand) {
    first.background = { color: BRAND.cover };
    first.addShape(pptx.ShapeType.line, { x: W / 2 - 1.5, y: H / 2 - 1.45, w: 3, h: 0, line: { color: BRAND.cyan, width: 2 } });
    first.addText(req.title, { x: 0.9, y: H / 2 - 1.25, w: W - 1.8, h: 1.6, fontFace: s.headingFont, fontSize: 32, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
    first.addText(req.subtitle ?? `Generated ${new Date().toISOString().slice(0, 10)}`, { x: 0.9, y: H / 2 + 0.45, w: W - 1.8, h: 0.5, fontFace: s.bodyFont, fontSize: 16, color: BRAND.cyan, align: "center", valign: "top" });
  } else {
    first.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.25, h: H, fill: { color: s.accent }, line: { color: s.accent } });
    first.addText(req.title, { x: 0.9, y: H / 2 - 1.3, w: W - 1.8, h: 1.4, fontFace: s.headingFont, fontSize: 36, bold: true, color: s.headingColor, valign: "bottom" });
    first.addText(req.subtitle ?? `Generated ${new Date().toISOString().slice(0, 10)}`, {
      x: 0.9, y: H / 2 + 0.2, w: W - 1.8, h: 1, fontFace: s.bodyFont, fontSize: 16, color: "5B6862", valign: "top",
    });
  }

  const blocks = markdownBlocks(req.markdown);
  const chartImages = (req.images ?? []).filter((i) => i.ref.startsWith("chart-"));
  const contents = contentsOf(blocks, [], chartImages.length ? ["Appendix: Supporting analysis"] : []);
  if (contents.length) {
    const shown = contents.slice(0, 12);
    const more = contents.length - shown.length;
    titled("Contents").addText([...shown, ...(more > 0 ? [`+ ${more} more`] : [])].map((text) => ({ text, options: { breakLine: true } })), {
      x: M, y: 1.4, w: W - 2 * M, h: H - 1.9, fontFace: s.bodyFont, fontSize: 20, color: s.ink, valign: "top", paraSpaceAfter: 10,
    });
  }

  // Body: text accumulates on the current section's slide until it is full or a table or picture interrupts it.
  let section = "Summary";
  let lines: TextProps[] = [];
  let chars = 0;
  let part = 0;
  const flush = () => {
    if (!lines.length) return;
    const slide = titled(part++ ? `${section} (cont.)` : section);
    slide.addText(lines, { x: M, y: 1.35, w: W - 2 * M, h: H - 1.75, fontFace: s.bodyFont, fontSize: 16, color: s.ink, valign: "top", paraSpaceAfter: 6 });
    lines = [];
    chars = 0;
  };
  const add = (runs: Run[], opts: { bullet?: boolean | { type: "number" }; indent?: number; italic?: boolean; bold?: boolean; mono?: boolean } = {}) => {
    const text = plain(runs).trim();
    if (!text) return;
    if (lines.length >= MAX_LINES || chars + text.length > MAX_CHARS) flush();
    const pieces = runs.filter((r) => r.text);
    pieces.forEach((r, i) =>
      lines.push({
        text: r.text,
        options: {
          bold: r.bold || opts.bold,
          italic: r.italic || opts.italic,
          fontFace: r.code || opts.mono ? "Consolas" : undefined,
          ...(i === 0 ? { bullet: opts.bullet ?? false, indentLevel: opts.indent } : {}),
          ...(i === pieces.length - 1 ? { breakLine: true } : {}),
        },
      }),
    );
    chars += text.length;
  };
  const startSection = (title: string) => {
    flush();
    section = title;
    part = 0;
  };

  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        // H1-H3 each start a slide; deeper headings stay as bold lines on the current one.
        if (b.depth <= 3) startSection(b.text);
        else add([{ text: b.text, bold: true }]);
        break;
      case "paragraph":
        add(b.runs);
        break;
      case "list":
        b.items.forEach((it) => add(it.runs, { bullet: b.ordered ? { type: "number" } : true, indent: it.level }));
        break;
      case "quote":
        add(b.runs, { italic: true });
        break;
      case "code":
        add([{ text: b.text }], { mono: true });
        break;
      case "table": {
        flush();
        const slide = titled(part++ ? `${section} (cont.)` : section);
        const head = b.header.map((h) => ({ text: h, options: { bold: true, color: s.headerInk, fill: { color: s.headerFill } } }));
        const rows = b.rows.map((r) =>
          b.header.map((h, i) => {
            const text = r[i] ?? "";
            const tone = s.brand ? toneFor(h, text) : null;
            return tone ? { text, options: { bold: true, color: TONE_STYLE[tone].ink, fill: { color: TONE_STYLE[tone].fill } } } : { text };
          }),
        );
        slide.addTable([head, ...rows], {
          x: M, y: 1.35, w: W - 2 * M, fontFace: s.bodyFont, fontSize: 12, color: s.ink, border: { type: "solid", pt: 0.75, color: "C9D1CD" },
          autoPage: true, autoPageRepeatHeader: true, autoPageSlideStartY: 1.35,
        });
        break;
      }
      case "image": {
        const img = images.get(b.ref);
        const spec = b.ref.startsWith("viz-") ? specs[Number(b.ref.slice(4))] : null;
        if (!native(spec) && !img) break;
        flush();
        const title = part++ ? `${section} (cont.)` : section;
        if (native(spec)) nativeChart(title, spec);
        else if (img) picture(title, img);
        break;
      }
      case "rule":
        break;
    }
  }
  flush();
  // The charts built from the agents' analysis tools follow the body, as an appendix.
  for (const c of chartImages) picture(c.caption ? `Appendix: ${c.caption}` : "Appendix: Supporting analysis", c);
  return new Uint8Array((await pptx.write({ outputType: "nodebuffer" })) as Buffer);
}
