import { useContext, useEffect, useRef, useState } from "react";
import { TemplateContext, downloadDeliverable, type Deliverable, type DownloadFormat } from "../exports";
import { errorText } from "../download";

const LABEL: Record<DownloadFormat, string> = { docx: "Word (.docx)", pptx: "PowerPoint (.pptx)", xlsx: "Excel (.xlsx)", md: "Markdown (.md)", html: "Web page (.html)", slides: "Slide deck (.html)", zip: "Research bundle (.zip)", csv: "CSV data (.csv)", pdf: "PDF (print)" };

/**
 * "Download" button with a format menu. `build` assembles the deliverable when a format is chosen, so the
 * menu can offer options (such as including specialist notes) that change it.
 */
export function DownloadMenu({
  build,
  formats = ["docx", "pptx", "xlsx", "md", "html", "slides"],
  option,
  label = "Download",
}: {
  build: (opt: boolean) => Deliverable;
  formats?: DownloadFormat[];
  option?: string;
  label?: string;
}) {
  const templateId = useContext(TemplateContext);
  const [open, setOpen] = useState(false);
  const [opt, setOpt] = useState(false);
  const [busy, setBusy] = useState<DownloadFormat | null>(null);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const go = async (f: DownloadFormat) => {
    setBusy(f);
    setError("");
    try {
      await downloadDeliverable(f, { ...build(opt), templateId: templateId || undefined });
      setOpen(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="download-menu" ref={ref}>
      <button className="btn sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div className="download-pop" role="menu">
          {formats.map((f) => (
            <button key={f} role="menuitem" className="download-item" disabled={!!busy} onClick={() => go(f)}>
              {busy === f ? <><span className="spinner" /> Building {LABEL[f]}</> : LABEL[f]}
            </button>
          ))}
          {option && (
            <label className="download-opt">
              <input type="checkbox" checked={opt} onChange={(e) => setOpt(e.target.checked)} /> {option}
            </label>
          )}
          {templateId && <div className="muted download-note">Styled with the template selected in the top bar.</div>}
          {error && <div className="download-err" role="alert">{error}</div>}
        </div>
      )}
    </div>
  );
}
