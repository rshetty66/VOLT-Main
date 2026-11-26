import { confirmDialog, toast } from "../ui";
import { useEffect, useRef, useState } from "react";
import { addUrlSource, deleteUpload, listUploads, uploadAttachment, type UploadMeta } from "../api";

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const MAX_MB = 25;

/** The project's knowledge base: the uploads library for this project, plus web pages added by URL. VOLT searches it in every chat. */
export function Uploads({ projectName }: { projectName: string }) {
  const [items, setItems] = useState<UploadMeta[] | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const load = () => void listUploads().then(setItems);
  useEffect(load, []);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setError("");
    setBusy(label);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("");
    }
  };
  const addFiles = (list: FileList | null) =>
    void run("Reading", async () => {
      for (const f of Array.from(list ?? [])) {
        if (f.size > MAX_MB * 1048576) throw new Error(`${f.name} is larger than ${MAX_MB} MB.`);
        await uploadAttachment(f);
      }
      if (fileInput.current) fileInput.current.value = "";
    });
  const addUrl = () => url.trim() && void run("Fetching", async () => (await addUrlSource(url.trim()), setUrl("")));

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Knowledge base</h1>
        <p className="page-sub">
          The documents and web pages of {projectName}. Every chat in this project searches them and cites the passages it uses, with file and page. Files you attach in a chat land here too. Web pages are read once when you add them.
        </p>
      </div>
      <div className="card stack">
        <div className="row">
          <input ref={fileInput} type="file" multiple hidden accept=".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.tsv,.json,.jpg,.jpeg,.png" onChange={(e) => addFiles(e.target.files)} />
          <button className="btn primary sm" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            Add files
          </button>
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="https://… a web page or PDF to add" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUrl()} />
          <button className="btn sm" disabled={!!busy || !url.trim()} onClick={addUrl}>
            Add link
          </button>
        </div>
        {busy && <div className="muted"><span className="spinner" /> {busy}…</div>}
        {error && <div className="upload-error" role="alert">{error}</div>}
      </div>
      {items === null ? (
        <div className="card empty"><span className="spinner" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="card empty">Nothing here yet. Add files or a link above, or attach a file in a chat.</div>
      ) : (
        items.map((u) => (
          <div key={u.id} className="card history-item">
            <div className="history-main">
              <div className="micro">
                {u.url ? "WEB" : u.ext.toUpperCase()} · {size(u.bytes)} · {u.chars.toLocaleString()} characters read{u.truncated ? " (truncated)" : ""} · {when(u.createdAt)}
              </div>
              <div className="history-prompt">{u.name}</div>
            </div>
            <div className="row">
              {u.url ? (
                <a className="btn sm" href={u.url} target="_blank" rel="noopener noreferrer">
                  Open page
                </a>
              ) : (
                <a className="btn sm" href={`/api/uploads/${u.id}/file`}>
                  Download
                </a>
              )}
              <button className="btn ghost sm" onClick={async () => {
                if (!(await confirmDialog(`Remove ${u.name} from the knowledge base?`, "Remove"))) return;
                await deleteUpload(u.id).then(load);
                toast(`Removed ${u.name}`);
              }}>
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
