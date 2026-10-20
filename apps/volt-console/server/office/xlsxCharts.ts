/**
 * Native Excel charts, added to a finished workbook.
 *
 * exceljs cannot write charts, so this writes the DrawingML parts itself: a chart
 * part per chart, one drawing per sheet that anchors them, the relationships, and
 * the content types. Each series points at worksheet ranges (so the chart follows
 * the live formulas when an input changes) and carries a cache of the values,
 * which viewers show before they recalculate.
 */
import JSZip from "jszip";

export interface XlsxSeries {
  name: string;
  /** A range on the chart's sheet, e.g. "$E$9:$E$14". */
  values: string;
  cache: (number | null)[];
  type: "bar" | "line";
  /** Six hex digits. */
  color: string;
  /** Different colours for single bars, by point index. */
  pointColors?: Record<number, string>;
}

export interface XlsxChart {
  title: string;
  /** Top-left cell (0-based column and row) and size in cells. */
  anchor: { col: number; row: number; cols: number; rows: number };
  categories: { ref: string; cache: (string | number)[] };
  series: XlsxSeries[];
  /** "col" for vertical bars (default), "bar" for horizontal ones listed top to bottom. */
  barDir?: "col" | "bar";
  valueFormat?: string;
  /** Value labels on the bars, and no value axis. */
  labelled?: boolean;
  legend?: boolean;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NS_C = "http://schemas.openxmlformats.org/drawingml/2006/chart";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_CHART = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart";
const REL_DRAWING = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const CT_CHART = "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
const CT_DRAWING = "application/vnd.openxmlformats-officedocument.drawing+xml";

const fill = (hex: string) => `<c:spPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></c:spPr>`;
const text = (size: number, color: string, font: string, bold = false) =>
  `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${size * 100}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:latin typeface="${esc(font)}"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;

function numCache(values: (number | null)[], format = "General") {
  const pts = values.map((v, i) => (v === null || !Number.isFinite(v) ? "" : `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)).join("");
  return `<c:numCache><c:formatCode>${esc(format)}</c:formatCode><c:ptCount val="${values.length}"/>${pts}</c:numCache>`;
}

function catXml(ref: string, cache: (string | number)[]) {
  if (cache.every((v) => typeof v === "number")) return `<c:cat><c:numRef><c:f>${esc(ref)}</c:f>${numCache(cache as number[])}</c:numRef></c:cat>`;
  const pts = cache.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(String(v))}</c:v></c:pt>`).join("");
  return `<c:cat><c:strRef><c:f>${esc(ref)}</c:f><c:strCache><c:ptCount val="${cache.length}"/>${pts}</c:strCache></c:strRef></c:cat>`;
}

/** One chart part. `sheet` is the sheet name the ranges live on. */
export function chartXml(chart: XlsxChart, sheet: string, font: string): string {
  const q = `'${sheet.replace(/'/g, "''")}'`;
  const ref = (r: string) => `${q}!${r}`;
  const cat = catXml(ref(chart.categories.ref), chart.categories.cache);
  const labels = chart.labelled
    ? `<c:dLbls><c:numFmt formatCode="${esc(chart.valueFormat ?? "General")}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${text(9, "262626", font)}<c:dLblPos val="inEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
    : "";
  let idx = 0;
  const ser = (s: XlsxSeries) => {
    const i = idx++;
    const head = `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx>`;
    const val = `<c:val><c:numRef><c:f>${esc(ref(s.values))}</c:f>${numCache(s.cache)}</c:numRef></c:val>`;
    if (s.type === "line") {
      return `<c:ser>${head}<c:spPr><a:ln w="31750" cap="rnd"><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/>${fill(s.color).replace("</c:spPr>", `<a:ln><a:solidFill><a:srgbClr val="${s.color}"/></a:solidFill></a:ln></c:spPr>`)}</c:marker>${cat}${val}<c:smooth val="0"/></c:ser>`;
    }
    const points = Object.entries(s.pointColors ?? {})
      .map(([p, color]) => `<c:dPt><c:idx val="${p}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/>${fill(color)}</c:dPt>`)
      .join("");
    return `<c:ser>${head}${fill(s.color)}<c:invertIfNegative val="0"/>${points}${labels}${cat}${val}</c:ser>`;
  };
  const bars = chart.series.filter((s) => s.type === "bar");
  const lines = chart.series.filter((s) => s.type === "line");
  const horizontal = chart.barDir === "bar";
  const barXml = bars.length
    ? `<c:barChart><c:barDir val="${horizontal ? "bar" : "col"}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${bars.map(ser).join("")}<c:gapWidth val="${horizontal ? 45 : 60}"/><c:axId val="5001"/><c:axId val="5002"/></c:barChart>`
    : "";
  const lineXml = lines.length ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${lines.map(ser).join("")}<c:marker val="1"/><c:axId val="5001"/><c:axId val="5002"/></c:lineChart>` : "";
  const noLine = `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>`;
  const catAx = `<c:catAx><c:axId val="5001"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="low"/>${horizontal ? noLine : `<c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="BFBFBF"/></a:solidFill></a:ln></c:spPr>`}${text(10, "404040", font)}<c:crossAx val="5002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const valAx = `<c:valAx><c:axId val="5002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${chart.labelled ? 1 : 0}"/><c:axPos val="${horizontal ? "t" : "l"}"/>${chart.labelled ? "" : `<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E6E6E6"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>`}<c:numFmt formatCode="${esc(chart.valueFormat ?? "General")}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${noLine}${text(9, "595959", font)}<c:crossAx val="5001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  const title = `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1200" b="1"><a:solidFill><a:srgbClr val="262626"/></a:solidFill><a:latin typeface="${esc(font)}"/></a:rPr><a:t>${esc(chart.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>`;
  const legend = chart.legend ? `<c:legend><c:legendPos val="b"/><c:overlay val="0"/>${text(10, "404040", font)}</c:legend>` : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart>${title}<c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${barXml}${lineXml}${catAx}${valAx}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr></c:chartSpace>`;
}

function drawingXml(charts: XlsxChart[], firstRel: number): string {
  const anchors = charts
    .map((c, i) => {
      const { col, row, cols, rows } = c.anchor;
      return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${col + cols}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + rows}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="${esc(c.title.slice(0, 60))}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}"><c:chart xmlns:c="${NS_C}" r:id="rId${firstRel + i}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="${NS_A}" xmlns:r="${NS_R}">${anchors}</xdr:wsDr>`;
}

const rels = (items: { id: string; type: string; target: string }[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map((r) => `<Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"/>`).join("")}</Relationships>`;

/** Adds the charts to the named sheets of an .xlsx and returns the new file. */
export async function addChartsToXlsx(xlsx: Buffer, bySheet: Record<string, XlsxChart[]>, font: string): Promise<Buffer> {
  const zip = await JSZip.loadAsync(xlsx);
  const read = async (path: string) => (await zip.file(path)?.async("string")) ?? null;
  const workbook = (await read("xl/workbook.xml"))!;
  const wbRels = (await read("xl/_rels/workbook.xml.rels"))!;
  let types = (await read("[Content_Types].xml"))!;
  const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

  let chartNo = Object.keys(zip.files).filter((n) => /^xl\/charts\/chart\d+\.xml$/.test(n)).length;
  let drawingNo = Object.keys(zip.files).filter((n) => /^xl\/drawings\/drawing\d+\.xml$/.test(n)).length;
  for (const [sheet, charts] of Object.entries(bySheet)) {
    if (!charts.length) continue;
    const sheetTag = [...workbook.matchAll(/<sheet\b[^>]*>/g)].map((m) => m[0]).find((t) => decode(t.match(/name="([^"]*)"/)?.[1] ?? "") === sheet);
    const rid = sheetTag?.match(/r:id="([^"]+)"/)?.[1];
    const target = rid && wbRels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`))?.[0].match(/Target="([^"]+)"/)?.[1];
    if (!target) throw new Error(`Sheet ${sheet} not found in the workbook`);
    const sheetPath = `xl/${target.replace(/^\/?xl\//, "")}`;
    const sheetFile = sheetPath.split("/").at(-1)!;
    const sheetRelsPath = `xl/worksheets/_rels/${sheetFile}.rels`;

    drawingNo++;
    const drawingPath = `xl/drawings/drawing${drawingNo}.xml`;
    const chartRels = charts.map((chart) => {
      chartNo++;
      zip.file(`xl/charts/chart${chartNo}.xml`, chartXml(chart, sheet, font));
      types = types.replace("</Types>", `<Override PartName="/xl/charts/chart${chartNo}.xml" ContentType="${CT_CHART}"/></Types>`);
      return { type: REL_CHART, target: `../charts/chart${chartNo}.xml` };
    });
    zip.file(drawingPath, drawingXml(charts, 1));
    zip.file(`xl/drawings/_rels/drawing${drawingNo}.xml.rels`, rels(chartRels.map((r, i) => ({ id: `rId${i + 1}`, ...r }))));
    types = types.replace("</Types>", `<Override PartName="/${drawingPath}" ContentType="${CT_DRAWING}"/></Types>`);

    // Link the drawing from the sheet: a relationship, then a <drawing> element in its schema position.
    const existing = await read(sheetRelsPath);
    const used = existing ? [...existing.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1])) : [];
    const drawingRid = `rId${Math.max(0, ...used) + 1}`;
    const rel = `<Relationship Id="${drawingRid}" Type="${REL_DRAWING}" Target="../drawings/drawing${drawingNo}.xml"/>`;
    zip.file(sheetRelsPath, existing ? existing.replace("</Relationships>", `${rel}</Relationships>`) : rels([]).replace("</Relationships>", `${rel}</Relationships>`));
    let xml = (await read(sheetPath))!;
    if (!/xmlns:r=/.test(xml.slice(0, 600))) xml = xml.replace("<worksheet ", `<worksheet xmlns:r="${NS_R}" `);
    const drawing = `<drawing r:id="${drawingRid}"/>`;
    const before = xml.search(/<(legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/);
    xml = before >= 0 ? `${xml.slice(0, before)}${drawing}${xml.slice(before)}` : xml.replace("</worksheet>", `${drawing}</worksheet>`);
    zip.file(sheetPath, xml);
  }
  zip.file("[Content_Types].xml", types);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
