import { useContext, useState } from "react";
import { TemplateContext, downloadDeliverable } from "../exports";
import { FILE_LABEL, type FileSpec } from "../../shared/files";
import type { ActivityItem, Run } from "../runState";

/** The files agents made in a run (create_file calls that succeeded), Rudra's first, then each specialist's. */
export function runFiles(run: Run): { id: string; spec: FileSpec }[] {
  const items: ActivityItem[] = [...run.activity, ...run.laneOrder.flatMap((id) => run.lanes[id]?.activity ?? [])];
  return items.filter((it) => it.kind === "tool" && it.text === "create_file" && !it.isError && !it.pending && it.data).map((it) => ({ id: it.id, spec: it.data as FileSpec }));
}

function detail(s: FileSpec): string {
  const sections = (s.markdown.match(/^##\s/gm) ?? []).length;
  const visuals = (s.markdown.match(/^```(chart|process|architecture|mermaid)\b/gm) ?? []).length;
  const sheets = s.tables?.length ?? 0;
  const parts = [
    sections ? `${sections} ${s.format === "pptx" ? "slide" : "section"}${sections === 1 ? "" : "s"}` : "",
    visuals ? `${visuals} exhibit${visuals === 1 ? "" : "s"}` : "",
    sheets ? `${sheets} ${s.format === "csv" ? "table" : "data sheet"}${sheets === 1 ? "" : "s"}` : "",
  ];
  return parts.filter(Boolean).join(" · ");
}

function FileCard({ spec }: { spec: FileSpec }) {
  const selected = useContext(TemplateContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadDeliverable(spec.format, { title: spec.title, subtitle: spec.subtitle, markdown: spec.markdown, tables: spec.tables, templateId: spec.templateId || selected || undefined });
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="file-card">
      <svg className="file-icon" viewBox="0 0 40 48" aria-hidden="true">
        <path d="M6 2h20l10 10v32a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M26 2v10h10" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="20" y="36" textAnchor="middle">{spec.format.toUpperCase()}</text>
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
        <FileCard key={f.id} spec={f.spec} />
      ))}
    </div>
  );
}
