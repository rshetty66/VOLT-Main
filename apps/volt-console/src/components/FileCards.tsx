import { useContext, useState } from "react";
import { TemplateContext, chartTables, downloadDeliverable, runFileVersion, type Deliverable } from "../exports";
import { chartableResults } from "../charts/results";
import type { ExportTable } from "../../shared/export";
import { FILE_LABEL, type FileSpec } from "../../shared/files";
import { errorText } from "../download";
import type { ActivityItem, Run } from "../runState";

/**
 * The files agents made in a run (create_file calls that succeeded), Rudra's first, then each specialist's. An Excel
 * or CSV file also carries the run's tool results (value case, benchmarks, maturity) as data sheets, built from the
 * tool output itself, so the agent never retypes the figures.
 */
export function runFiles(run: Run): { id: string; spec: FileSpec }[] {
  const items: ActivityItem[] = [...run.activity, ...run.laneOrder.flatMap((id) => run.lanes[id]?.activity ?? [])];
  const results: ExportTable[] = chartTables(chartableResults(run));
  return items
    .filter((it) => it.kind === "tool" && (it.text === "create_file" || it.text === "build_accounting_hub") && !it.isError && !it.pending && it.data)
    .map((it) => {
      const spec = it.data as FileSpec;
      const data = spec.format === "xlsx" || spec.format === "csv" ? [...(spec.tables ?? []), ...results] : spec.tables;
      return { id: it.id, spec: { ...spec, tables: data?.length ? data : undefined } };
    });
}

function detail(s: FileSpec): string {
  if (s.hub) return "5 tabs · interactive diagrams";
  const sections = (s.markdown.match(/^##\s/gm) ?? []).length;
  const visuals = (s.markdown.match(/^```(chart|process|architecture|mermaid)\b/gm) ?? []).length;
  const sheets = s.tables?.length ?? 0;
  const parts = [
    sections ? `${sections} ${s.format === "pptx" || s.format === "slides" ? "slide" : "section"}${sections === 1 ? "" : "s"}` : "",
    visuals ? `${visuals} exhibit${visuals === 1 ? "" : "s"}` : "",
    sheets ? `${sheets} ${s.format === "csv" ? "table" : "data sheet"}${sheets === 1 ? "" : "s"}` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

const COMPANION_FORMATS = ["pptx", "xlsx", "docx"] as const;
type CompanionFormat = (typeof COMPANION_FORMATS)[number];

/** The deliverable a card downloads. An HTML page also carries the run's other Office files, as links in its header. */
export function cardDeliverable(spec: FileSpec, all: FileSpec[], templateId?: string, version?: Deliverable["version"]): Deliverable {
  const own = (s: FileSpec): Deliverable => ({ title: s.title, subtitle: s.subtitle, markdown: s.markdown, tables: s.tables, templateId: s.templateId || templateId, hub: s.hub, version });
  if (spec.format !== "html") return own(spec);
  const companions = all.filter((s): s is FileSpec & { format: CompanionFormat } => (COMPANION_FORMATS as readonly string[]).includes(s.format)).map((s) => ({ format: s.format, deliverable: own(s) }));
  return { ...own(spec), companions };
}

function FileCard({ spec, all, version }: { spec: FileSpec; all: FileSpec[]; version?: Deliverable["version"] }) {
  const selected = useContext(TemplateContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadDeliverable(spec.format, cardDeliverable(spec, all, selected || undefined, version));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="file-card">
      <svg className="file-icon" viewBox="0 0 40 48" aria-hidden="true">
        <path d="M6 2h20l10 10v32a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M26 2v10h10" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="20" y="36" textAnchor="middle">{spec.format === "slides" ? "DECK" : spec.format.toUpperCase()}</text>
      </svg>
      <div className="file-meta">
        <div className="file-title">{spec.title}</div>
        <div className="file-sub">
          {FILE_LABEL[spec.format]}
          {detail(spec) ? ` · ${detail(spec)}` : ""}
        </div>
        {error && (
          <div className="download-err" role="alert">
            {error}
          </div>
        )}
      </div>
      <button className="btn sm" onClick={go} disabled={busy}>
        {busy ? <><span className="spinner" /> Building</> : spec.format === "pdf" ? "Save as PDF" : "Download"}
      </button>
    </div>
  );
}

/** Download cards for the files a run made. */
export function FileCards({ run }: { run: Run }) {
  const files = runFiles(run);
  if (!files.length) return null;
  return (
    <div className="file-cards" aria-label="Files VOLT made">
      {files.map((f) => (
        <FileCard key={f.id} spec={f.spec} all={files.map((x) => x.spec)} version={runFileVersion(run)} />
      ))}
    </div>
  );
}
