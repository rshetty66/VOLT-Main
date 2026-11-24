import { createContext, createElement, type ReactElement } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExportFormat, ExportImage, ExportRequest, ExportTable } from "../shared/export";
import { exportFileName } from "../shared/export";
import { strToU8, zipSync } from "fflate";
import { evidenceGates, registryJsonl, sectionOf, sourceRegisterMarkdown, type SourceRecord, type Tier } from "../shared/research";
import type { Run } from "./runState";
import { chartFor } from "./charts/RunVisuals";
import { chartableResults, exportCharts, type ChartableResult } from "./charts/results";
import { chartSvg } from "./charts/Visual";
import { renderMermaid } from "./charts/mermaid";
import { isArchitecture, isChart, isMermaid, isProcess } from "./charts/mermaidBlock";
import { processSvg } from "./charts/specProcess";
import { archSvg } from "./charts/specArch";
import { specSvg } from "./charts/specChart";
import { DARK, LIGHT } from "./charts/palette";
import { splitPages, toneTables, voltHtml } from "./htmlTemplate";
import { archBlocks, chartBlocks, processBlocks, type ProcessSpec } from "../shared/viz";
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
    // The appendix gets each distinct chart once; the Excel sheets keep the data of every call.
    charts: exportCharts(charts),
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
  const procs = processBlocks(d.markdown).map((spec) => (spec ? processSvg(spec, LIGHT) : ""));
  return { charts, diagrams, specs, archs, procs };
}

async function asImage(ref: string, svg: string, caption?: string): Promise<ExportImage | null> {
  if (!svg) return null;
  const { width, height } = svgSize(svg);
  return { ref, png: await base64(await svgToPng(svg, 2)), width, height, caption };
}

const CAPTION: Record<ChartableResult["kind"], (r: ChartableResult) => string> = {
  benchmark: (r) => (r.kind === "benchmark" ? r.data.benchmark.metric : ""),
  maturity: () => "Finance maturity: current and target",
  valueCase: (r) => {
    if (r.kind !== "valueCase") return "";
    const m = Math.abs(r.data.npv) >= 1e6 ? `${+(r.data.npv / 1e6).toFixed(1)}M` : `${Math.round(r.data.npv).toLocaleString("en-US")}`;
    return `Value case (NPV ${m}${r.data.paybackYears != null ? `, payback ${+r.data.paybackYears.toFixed(1)} years` : ""}): net benefit and cumulative cash`;
  },
};

/** The steps of a process flow as the HTML walkthrough reads them. */
const flowSteps = (spec: ProcessSpec) =>
  spec.steps.map((st) => ({ name: st.name, lane: spec.lanes[st.lane], stage: spec.stages[st.stage], system: st.system, control: st.control, owner: st.owner, duration: st.duration, status: st.status, issue: st.issue, detail: st.detail }));

/**
 * The HTML deliverable: VOLT's house template (src/htmlTemplate.ts), dark, with a tab per section. Charts, diagrams
 * and architectures are inline SVG in the console palette; process flows are interactive.
 */
export async function htmlDocument(d: Deliverable): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const charts = await Promise.all((d.charts ?? []).map((c) => chartFor(c).render(DARK)).map((el) => renderToStaticMarkup(el)));
  const diagrams = await Promise.all(mermaidSources(d.markdown).map((code) => renderMermaid(code, "dark").catch(() => "")));
  const specs = chartBlocks(d.markdown).map((spec) => (spec ? specSvg(spec, DARK) : ""));
  const archs = archBlocks(d.markdown).map((spec) => (spec ? archSvg(spec, DARK) : ""));
  const procs = processBlocks(d.markdown);
  let n = 0;
  let c = 0;
  let a = 0;
  let f = 0;
  const figure = (cls: string, svg: string) => createElement("figure", { className: cls, dangerouslySetInnerHTML: { __html: svg } });
  const flow = () => {
    const spec = procs[f++];
    if (!spec) return createElement("figure", null);
    return createElement("figure", { className: "flow", "data-steps": JSON.stringify(flowSteps(spec)), dangerouslySetInnerHTML: { __html: processSvg(spec, DARK) } });
  };
  const body = renderToStaticMarkup(
    createElement(ReactMarkdown, {
      remarkPlugins: [remarkGfm],
      components: {
        pre: ({ children, node }) => {
          const first = node?.children[0];
          const cls = first && first.type === "element" ? first.properties?.className : undefined;
          const name = Array.isArray(cls) ? cls.join(" ") : String(cls ?? "");
          return isMermaid(name) || isChart(name) || isArchitecture(name) || isProcess(name) ? (children as ReactElement) : createElement("pre", null, children);
        },
        code: ({ className, children }) =>
          isProcess(className) ? flow()
          : isArchitecture(className) ? figure("arch", archs[a++] || "")
          : isChart(className) ? figure("chart", specs[c++] || "")
          : isMermaid(className) ? figure("diagram", diagrams[n++] || "")
          : createElement("code", { className }, children),
      },
      // The title is the page's own heading, so a leading "# Title" line is not repeated.
      children: d.markdown.replace(/^\s*#\s+.+\n/, ""),
    }),
  );
  const appendix = charts.length ? `<h2>Appendix: Supporting analysis</h2>${charts.map((svg) => `<figure class="chart">${svg}</figure>`).join("")}` : "";
  return voltHtml({ title: d.title, subtitle: d.subtitle, pages: splitPages(toneTables(body + appendix)) });
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
    const { charts, diagrams, specs, archs, procs } = await pictures(d);
    const made = await Promise.all([
      ...charts.map((svg, i) => asImage(`chart-${i}`, svg, d.charts?.[i] ? CAPTION[d.charts[i].kind](d.charts[i]) : undefined)),
      ...diagrams.map((svg, i) => asImage(`diagram-${i}`, svg)),
      ...specs.map((svg, i) => asImage(`viz-${i}`, svg)),
      ...archs.map((svg, i) => asImage(`arch-${i}`, svg)),
      ...procs.map((svg, i) => asImage(`proc-${i}`, svg)),
    ]);
    images.push(...made.filter((x): x is ExportImage => !!x));
  }
  const body: ExportRequest = { format, title: d.title, subtitle: d.subtitle, markdown: d.markdown, images, tables: format === "xlsx" ? d.tables : undefined, templateId: d.templateId || undefined };
  const r = await fetch("/api/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? `Download failed (${r.status})`);
  downloadBlob(exportFileName(d.title, format), await r.blob());
}
