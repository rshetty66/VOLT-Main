import { ago, confirmDialog, toast } from "../ui";
import { useEffect, useRef, useState } from "react";
import { KB_MAX_FILE_MB as MAX_MB } from "../../shared/attachments";
import { addUrlSource, deleteUpload, listUploads, refreshUpload, updateUpload, uploadAttachment, type UploadMeta } from "../api";
import { activeProject } from "../projects";

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const NEW_FOLDER = "__new_folder__";

/**
 * The project's knowledge base: the uploads library for this project, files shared with all projects, and web pages added
 * by URL, in folders. Files unused for 30 days, or archived by hand, move to Archived: kept, not searched, restorable.
 */
export function Uploads({ projectName }: { projectName: string }) {
  const [items, setItems] = useState<UploadMeta[] | null>(null);
  const [archivedItems, setArchivedItems] = useState<UploadMeta[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [folder, setFolder] = useState(""); // "" = all files; also where new files go
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const load = () => {
    void listUploads().then(setItems);
    void listUploads({ archived: true }).then(setArchivedItems);
  };
  useEffect(load, []);

  const all = [...(items ?? []), ...archivedItems];
  const folders = [...new Set([...all.map((u) => u.folder).filter((f): f is string => !!f), ...extraFolders])].sort((a, b) => a.localeCompare(b));
  const shown = (showArchived ? archivedItems : items ?? []).filter((u) => !folder || u.folder === folder);

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
        const got = await uploadAttachment(f, { library: true, folder: folder || undefined });
        if (got.note) toast(`${f.name}: ${got.note}`);
      }
      if (fileInput.current) fileInput.current.value = "";
    });
  const addUrl = () =>
    url.trim() &&
    void run("Fetching", async () => {
      const got = await addUrlSource(url.trim());
      if (folder) await updateUpload(got.id, { folder });
      setUrl("");
    });
  const newFolder = (name: string) => {
    const n = name.replace(/\s+/g, " ").trim().slice(0, 60);
    if (!n) return "";
    setExtraFolders((f) => (f.includes(n) ? f : [...f, n]));
    return n;
  };
  const pickFolder = (u: UploadMeta, value: string) => {
    const target = value === NEW_FOLDER ? newFolder(window.prompt("New folder name") ?? "") : value;
    if (value === NEW_FOLDER && !target) return;
    void run("Moving", () => updateUpload(u.id, { folder: target || null }));
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Knowledge base</h1>
        <p className="page-sub">
          The documents and web pages of {projectName}, plus files shared with all projects. VOLT uses them when a request asks for them, and cites the passages it uses. Any file type up to {MAX_MB} MB: documents and zips are read; audio, video and other files are kept for download and found by name. Files unused for 30 days move to Archived, where they are kept and can be restored.
        </p>
      </div>
      <div className="card stack">
        <div className="row">
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
          <button className="btn primary sm" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            Add files{folder ? ` to ${folder}` : ""}
          </button>
          <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="https://… a web page or PDF to add" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addUrl()} />
          <button className="btn sm" disabled={!!busy || !url.trim()} onClick={addUrl}>
            Add link
          </button>
        </div>
        <div className="row" role="toolbar" aria-label="Folders">
          <button className={`chip click${!folder ? " on" : ""}`} onClick={() => setFolder("")}>All files</button>
          {folders.map((f) => (
            <button key={f} className={`chip click${folder === f ? " on" : ""}`} onClick={() => setFolder(f)}>
              {f}
            </button>
          ))}
          <button className="chip click" title="Create a folder; new files go into the selected folder" onClick={() => {
            const n = newFolder(window.prompt("New folder name") ?? "");
            if (n) setFolder(n);
          }}>
            + Folder
          </button>
          <span style={{ flex: 1 }} />
          <button className={`chip click${showArchived ? " on" : ""}`} onClick={() => setShowArchived((v) => !v)}>
            Archived ({archivedItems.length})
          </button>
        </div>
        {busy && <div className="muted"><span className="spinner" /> {busy}…</div>}
        {error && <div className="upload-error" role="alert">{error}</div>}
      </div>
      {items === null ? (
        <div className="card empty"><span className="spinner" /> Loading…</div>
      ) : shown.length === 0 ? (
        <div className="card empty">{showArchived ? "Nothing archived here." : folder ? `No files in ${folder} yet. Add files above.` : "Nothing here yet. Add files or a link above, or attach a file in a chat."}</div>
      ) : (
        shown.map((u) => {
          const shared = u.projectId !== undefined && u.projectId !== activeProject();
          return (
            <div key={u.id} className="card history-item">
              <div className="history-main">
                <div className="micro">
                  {u.url ? "WEB" : u.ext.toUpperCase()} · {size(u.bytes)} · {u.note ?? `${u.chars.toLocaleString()} characters read${u.truncated ? " (truncated)" : ""}`} · {u.url ? <span title={`Added ${when(u.createdAt)}`}>Last read {ago(u.readAt ?? u.createdAt)}</span> : when(u.createdAt)}
                  {u.folder ? ` · ${u.folder}` : ""}
                  {u.allProjects ? (shared ? " · shared from another project" : " · all projects") : ""}
                </div>
                <div className="history-prompt">{u.name}</div>
              </div>
              <div className="row">
                <select className="select" style={{ width: "auto", maxWidth: 160, padding: "3px 8px" }} aria-label={`Folder of ${u.name}`} value={u.folder ?? ""} disabled={!!busy} onChange={(e) => pickFolder(u, e.target.value)}>
                  <option value="">No folder</option>
                  {folders.map((f) => <option key={f} value={f}>{f}</option>)}
                  <option value={NEW_FOLDER}>New folder…</option>
                </select>
                <button className="btn sm" disabled={!!busy} title={u.allProjects ? "Use this file in this project only" : "Make this file part of every project's knowledge base"} onClick={() => void run("Saving", () => updateUpload(u.id, { allProjects: !u.allProjects }))}>
                  {u.allProjects ? "This project only" : "Use in all projects"}
                </button>
                {u.url ? (
                  <>
                    <button className="btn sm" disabled={!!busy} title="Read this page again, so chats use its current text" onClick={() => void run("Refreshing", async () => (await refreshUpload(u.id), toast(`Refreshed ${u.name}`)))}>
                      Refresh
                    </button>
                    <a className="btn sm" href={u.url} target="_blank" rel="noopener noreferrer">
                      Open page
                    </a>
                  </>
                ) : (
                  <a className="btn sm" href={`/api/uploads/${u.id}/file`}>
                    Download
                  </a>
                )}
                <button className="btn sm" disabled={!!busy} title={u.archived ? "Bring it back into search and the main list" : "Keep it, but leave it out of search and the main list"} onClick={() => void run(u.archived ? "Restoring" : "Archiving", async () => (await updateUpload(u.id, { archived: !u.archived }), toast(`${u.archived ? "Restored" : "Archived"} ${u.name}`)))}>
                  {u.archived ? "Restore" : "Archive"}
                </button>
                <button className="btn ghost sm" onClick={async () => {
                  if (!(await confirmDialog(`Remove ${u.name} from the knowledge base? This deletes it; Archive keeps it.`, "Remove"))) return;
                  await deleteUpload(u.id).then(load);
                  toast(`Removed ${u.name}`);
                }}>
                  Remove
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
