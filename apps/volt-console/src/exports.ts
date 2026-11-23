import { createContext, createElement, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExportFormat, ExportImage, ExportRequest, ExportTable } from "../shared/export";
import { exportFileName } from "../shared/export";
import { strToU8, zipSync } from "fflate";
import { evidenceGates, registryJsonl, sectionOf, sourceRegisterMarkdown, type SourceRecord, type Tier } from "../shared/research";
import type { Run } from "./runState";
import { chartFor } from "./charts/RunVisuals";
import { chartableResults, type ChartableResult } from "./charts/results";
import { chartSvg } from "./charts/Visual";
import { renderMermaid } from "./charts/mermaid";
import { isArchitecture, isChart, isMermaid } from "./charts/mermaidBlock";
import { archSvg } from "./charts/specArch";
import { specSvg } from "./charts/specChart";
import { LIGHT } from "./charts/palette";
import { archBlocks, chartBlocks } from "../shared/viz";
import { downloadBlob, downloadText, svgSize, svgToPng } from "./download";

/** The template selected in the top bar; downloads follow its fonts and colours. */
export const TemplateContext = createContext("");

export type DownloadFormat = ExportFormat | "md" | "html" | "zip";

export interface Deliverable {
  title: string;
  subtitle?: string;
  markdown: string;
  charts?: ChartableResult[];
  tables?: ExportTable[];
  templateId?: string;
  /** What the research engine recorded for this run; it makes the research bundle. */
  research?: { query: string; tier?: Tier; mode?: string; startedAt: string; sources: SourceRecord[]; log: string[] };
}

/** The ```mermaid blocks of a markdown text, in document order (the server numbers them the same way). */
export function mermaidSources(markdown: string): string[] {
  return [...markdown.matchAll(/^```mermaid[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1].replace(/\n$/, ""));
}

/** A run's deliverable: Rudra's answer, optionally followed by each specialist's notes. */
export function runDeliverable(run: Run, includeLanes: boolean, templateId?: string): Deliverable {
  const lanes = run.laneOrder.map((id) => run.lanes[id]).filter((l) => l?.text.trim());
  const appendix = includeLanes && lanes.length ? ["", "## Appendix: specialist notes", "", ...lanes.flatMap((l) => [`### ${l.name} (${l.layer})`, "", l.text.trim(), ""])].join("\n") : "";
  const charts = chartableResults(run);
  return {
    // The cover is client-facing: the deliverable's own title (its first "#" heading), else the request; the date, and no run internals.
    title: (/^#\s+(.+)$/m.exec(run.text)?.[1].trim() ?? (run.kind === "workflow" && run.title ? `${run.title}: ${run.prompt}` : run.prompt)).slice(0, 120),
    subtitle: new Date(run.startedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    // The source register is appended from the run's record, so every key in the text resolves in every format.
    markdown: run.text + (run.sources.length > 1 ? sourceRegisterMarkdown(run.sources) : "") + appendix,
    charts,
    tables: chartTables(charts),
    templateId,
    research: {
      query: run.prompt,
      tier: run.tier,
      mode: run.mode,
      startedAt: new Date(run.startedAt).toISOString(),
      sources: run.sources,
      log: [...run.activity, ...lanes.flatMap((l) => l.activity)].filter((a) => a.kind === "tool").map((a) => `${a.text}${a.detail ? `: ${a.detail}` : ""}`),
    },
  };
}

/** Chart data as worksheet tables for Excel. */
export function chartTables(results: ChartableResult[]): ExportTable[] {
  const out: ExportTable[] = [];
  const bench = results.filter((r) => r.kind === "benchmark");
  if (bench.length)
    out.push({
      name: "Benchmarks",
      columns: ["Metric", "Client", "Top quartile", "Median", "Bottom quartile", "Unit", "Position", "Gap to top quartile", "Lower is better"],
      rows: bench.map(({ data: d }) => [d.benchmark.metric, d.clientValue ?? null, d.benchmark.top25, d.benchmark.median, d.benchmark.bottom25, d.benchmark.unit, d.quartile ?? "", d.gapToTop25 ?? null, d.benchmark.lowerIsBetter ? "yes" : "no"]),
    });
  // Repeated names are numbered by the Excel writer ("Value case (2)").
  results.forEach((r) => {
    if (r.kind === "valueCase")
      out.push({
        name: "Value case",
        columns: ["Year", "Realised %", "Gross benefit", "Run cost", "Net benefit"],
        rows: [
          [0, null, null, null, -r.data.oneTimeInvestment],
          ...r.data.yearly.map((y) => [y.year, y.realisationPct / 100, y.grossBenefit, y.runCost, y.netBenefit]),
          ["NPV", null, null, null, r.data.npv],
          ["IRR %", r.data.irrPct, null, null, null],
          ["Payback (years)", r.data.paybackYears, null, null, null],
        ],
      });
    if (r.kind === "maturity")
      out.push({ name: "Maturity", columns: ["Dimension", "Current", "Target", "Gap"], rows: r.data.dimensions.map((d) => [d.dimension, d.current, d.target, d.gap]) });
  });
  return out;
}

async function base64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function pictures(d: Deliverable) {
  const charts = await Promise.all((d.charts ?? []).map((c) => chartSvg(chartFor(c).render)));
  const diagrams = await Promise.all(mermaidSources(d.markdown).map((code) => renderMermaid(code, "default").catch(() => "")));
  const specs = chartBlocks(d.markdown).map((spec) => (spec ? specSvg(spec, LIGHT) : ""));
  const archs = archBlocks(d.markdown).map((spec) => (spec ? archSvg(spec, LIGHT) : ""));
  return { charts, diagrams, specs, archs };
}

async function asImage(ref: string, svg: string, caption?: string): Promise<ExportImage | null> {
  if (!svg) return null;
  const { width, height } = svgSize(svg);
  return { ref, png: await base64(await svgToPng(svg, 2)), width, height, caption };
}

const CAPTION: Record<ChartableResult["kind"], (r: ChartableResult) => string> = {
  benchmark: (r) => (r.kind === "benchmark" ? r.data.benchmark.metric : ""),
  maturity: () => "Finance maturity: current and target",
  valueCase: () => "Value case: net benefit and cumulative cash",
};

/** A standalone HTML page with the charts and diagrams inline as SVG. */
export async function htmlDocument(d: Deliverable): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { charts, diagrams, specs, archs } = await pictures(d);
  let n = 0;
  let c = 0;
  let a = 0;
  const body = renderToStaticMarkup(
    createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      components: {
        pre: ({ children, node }) => {
          const first = node?.children[0];
          const cls = first && first.type === "element" ? first.properties?.className : undefined;
          const name = Array.isArray(cls) ? cls.join(" ") : String(cls ?? "");
          return isMermaid(name) || isChart(name) || isArchitecture(name) ? (children as ReactElement) : createElement("pre", null, children);
        },
        code: ({ className, children }) =>
          isArchitecture(className) ? createElement("figure", { dangerouslySetInnerHTML: { __html: archs[a++] || "" } }) : isChart(className) ? createElement("figure", { dangerouslySetInnerHTML: { __html: specs[c++] || "" } }) : isMermaid(className) ? createElement("figure", { dangerouslySetInnerHTML: { __html: diagrams[n++] || "" } }) : createElement("code", { className }, children),
      },
      children: d.markdown,
    }),
  );
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const results = charts.length ? `<h2>Results</h2>${charts.map((svg) => `<figure>${svg}</figure>`).join("")}` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.title)}</title>
<style>
body{font:15px/1.55 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1a1e2e;background:#fff;max-width:960px;margin:0 auto;padding:32px 20px}
h1,h2,h3{line-height:1.25;color:#1a1e2e}h1{font-size:28px}.sub{color:#5a6278;margin-top:-8px}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:14px}th,td{border:1px solid #d9dce6;padding:6px 9px;text-align:left;vertical-align:top}th{background:#1a1e2e;color:#fff}
code{font-family:ui-monospace,Menlo,Consolas,monospace;background:#f2f4f3;padding:1px 4px;border-radius:3px}pre{background:#f2f4f3;padding:12px;overflow:auto}pre code{background:none;padding:0}
figure{margin:16px 0;overflow-x:auto}figure svg{max-width:100%;height:auto}blockquote{margin:12px 0;padding-left:12px;border-left:3px solid #00b8d4;color:#3b4258}
</style></head><body>
<h1>${esc(d.title)}</h1>${d.subtitle ? `<p class="sub">${esc(d.subtitle)}</p>` : ""}
${results}
${body}
</body></html>
`;
}

/**
 * The research bundle: the report with its evidence beside it, so a reviewer can audit it from the files alone.
 * query, the full report, the executive brief, contradictions, residue, the source registry, the gate results and the search log.
 */
export function researchBundle(d: Deliverable, asOf = new Date()): Uint8Array {
  const r = d.research ?? { query: d.title, startedAt: asOf.toISOString(), sources: [], log: [] };
  const tier: Tier = r.tier ?? "STANDARD";
  const gates = evidenceGates(d.markdown, r.sources, tier);
  const part = (re: RegExp, fallback: string) => sectionOf(d.markdown, re) ?? fallback;
  const files: Record<string, string> = {
    "query.md": `# Query\n\n${r.query}\n\nDepth tier: ${tier}\nMode: ${r.mode ?? "n/a"}\nRun started: ${r.startedAt}\n`,
    "full-report.md": `# ${d.title}\n\n${d.markdown}\n`,
    "executive-brief.md": `# Executive brief\n\n${part(/executive summary/, d.markdown.split(/\s+/).slice(0, 300).join(" "))}\n`,
    "contradictions.md": `# Contradictions and tensions\n\n${part(/contradictions?|tensions?/, "The report has no contradictions section.")}\n`,
    "residue.md": `# Residue\n\n${part(/residue/, "The report has no residue section.")}\n`,
    "sources/registry.jsonl": registryJsonl(r.sources),
    "analysis/gates.json": JSON.stringify({ tier, asOf: asOf.toISOString().slice(0, 10), passed: gates.filter((g) => g.pass).length, total: gates.length, gates }, null, 2) + "\n",
    "analysis/search-log.md": `# Search log\n\nEvery tool the agents used, in order.\n\n${r.log.length ? r.log.map((l, i) => `${i + 1}. ${l}`).join("\n") : "No tool calls were recorded."}\n`,
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [`research/${k}`, strToU8(v)])));
}

/** Download a deliverable as Word, PowerPoint, Excel, Markdown, HTML or a research bundle. */
export async function downloadDeliverable(format: DownloadFormat, d: Deliverable) {
  if (format === "md") {
    const head = [`# ${d.title}`, d.subtitle ? `\n_${d.subtitle}_` : "", ""].join("\n");
    return downloadText(exportFileName(d.title, "md"), `${head}\n${d.markdown}\n`, "text/markdown");
  }
  if (format === "zip") return downloadBlob(exportFileName(d.title, "zip"), new Blob([researchBundle(d) as BlobPart], { type: "application/zip" }));
  if (format === "html") return downloadText(exportFileName(d.title, "html"), await htmlDocument(d), "text/html");

  const images: ExportImage[] = [];
  if (format !== "xlsx") {
    const { charts, diagrams, specs, archs } = await pictures(d);
    const made = await Promise.all([
      ...charts.map((svg, i) => asImage(`chart-${i}`, svg, d.charts?.[i] ? CAPTION[d.charts[i].kind](d.charts[i]) : undefined)),
      ...diagrams.map((svg, i) => asImage(`diagram-${i}`, svg)),
      ...specs.map((svg, i) => asImage(`viz-${i}`, svg)),
      ...archs.map((svg, i) => asImage(`arch-${i}`, svg)),
    ]);
    images.push(...made.filter((x): x is ExportImage => !!x));
  }
  const body: ExportRequest = { format, title: d.title, subtitle: d.subtitle, markdown: d.markdown, images, tables: format === "xlsx" ? d.tables : undefined, templateId: d.templateId || undefined };
  const r = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `Download failed (${r.status})`);
  downloadBlob(exportFileName(d.title, format), await r.blob());
}
