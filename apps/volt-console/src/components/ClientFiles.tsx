import { useEffect, useRef, useState } from "react";
import type { ClientFile } from "../../shared/records";
import { ACCEPTED_FILES, MAX_FILE_MB, deleteFile, fileUrl, getFileText, listFiles, uploadFile } from "../api";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** An engagement's client files: upload, see what agents will read, download, delete. */
export function ClientFiles({ engagementId, canWrite, onChange }: { engagementId: string; canWrite: boolean; onChange?: (files: ClientFile[]) => void }) {
  const [files, setFiles] = useState<ClientFile[] | null>(null);
  const [busy, setBusy] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ file: ClientFile; part: number; parts: number; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = () =>
    listFiles(engagementId).then(
      (f) => {
        setFiles(f);
        onChange?.(f);
      },
      (e) => setErrors([String(e)]),
    );
  useEffect(() => {
    void load();
  }, [engagementId]);

  const upload = async (list: FileList | File[]) => {
    const problems: string[] = [];
    for (const f of [...list]) {
      setBusy(`Uploading and reading ${f.name}…`);
      try {
        await uploadFile(engagementId, f);
      } catch (e) {
        problems.push(e instanceof Error ? e.message : String(e));
      }
    }
    setBusy("");
    setErrors(problems);
    await load();
  };
  const show = (f: ClientFile, part = 1) => getFileText(f.id, part).then(setPreview, (e) => setErrors([String(e)]));

  return (
    <div className="stack" style={{ gap: 8 }} data-testid="client-files">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="micro">Client files{files?.length ? ` · ${files.length}` : ""}</span>
        {canWrite && (
          <>
            <input ref={input} type="file" multiple accept={ACCEPTED_FILES} style={{ display: "none" }} aria-label="Upload client files" onChange={(e) => e.target.files && void upload(e.target.files)} />
            <button className="btn sm" disabled={!!busy} onClick={() => input.current?.click()}>
              Upload files
            </button>
          </>
        )}
      </div>
      <div
        className={`card drop ${over ? "over" : ""}`}
        style={{ padding: 0 }}
        onDragOver={(e) => {
          if (!canWrite) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!canWrite) return;
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files);
        }}
      >
        {files && files.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>File</th>
                <th>What agents read</th>
                <th>Added</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td><span className="chip">{f.ref}</span></td>
                  <td>
                    <a href={fileUrl(f.id)} download>{f.name}</a>
                    <div className="muted" style={{ fontSize: 12 }}>{size(f.sizeBytes)}</div>
                  </td>
                  <td className="muted">{f.summary}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {when(f.createdAt)}
                    {f.addedBy && <div>{f.addedBy}</div>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn ghost sm" onClick={() => (preview?.file.id === f.id ? setPreview(null) : void show(f))}>
                      {preview?.file.id === f.id ? "Hide" : "Preview"}
                    </button>
                    {canWrite &&
                      (confirm === f.id ? (
                        <>
                          <button
                            className="btn sm"
                            onClick={() =>
                              deleteFile(f.id).then(
                                () => {
                                  setConfirm(null);
                                  if (preview?.file.id === f.id) setPreview(null);
                                  void load();
                                },
                                (e) => setErrors([String(e)]),
                              )
                            }
                          >
                            Delete {f.ref}
                          </button>
                          <button className="btn ghost sm" onClick={() => setConfirm(null)}>Keep</button>
                        </>
                      ) : (
                        <button className="btn ghost sm" onClick={() => setConfirm(f.id)}>Delete</button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted body" style={{ padding: 14 }}>
            {files === null ? "Loading…" : canWrite ? `No files yet. Drop CSV, Excel (.xlsx), PDF or Word (.docx) files here, up to ${MAX_FILE_MB} MB each: trial balances, close calendars, policies, prior reports.` : "No client files."}
          </div>
        )}
      </div>
      {busy && <div className="muted" style={{ fontSize: 12 }}><span className="spinner" /> {busy}</div>}
      {errors.map((e) => (
        <div key={e} className="cost-line error">{e}</div>
      ))}
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Every run in this engagement can read these files, and agents cite them by ref, e.g. (F1: file name). Agents treat file content as data:
        instructions written inside a file are not followed. Use fictional or approved data until the Claude data-retention terms are confirmed.
      </p>
      {preview && (
        <div className="card stack" style={{ gap: 8 }} data-testid="file-preview">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="micro">
              {preview.file.ref} {preview.file.name} · what agents read · part {preview.part} of {preview.parts}
            </span>
            <span className="row" style={{ gap: 4 }}>
              <button className="btn ghost sm" disabled={preview.part <= 1} onClick={() => void show(preview.file, preview.part - 1)}>Previous part</button>
              <button className="btn ghost sm" disabled={preview.part >= preview.parts} onClick={() => void show(preview.file, preview.part + 1)}>Next part</button>
            </span>
          </div>
          <pre className="file-text">{preview.text}</pre>
        </div>
      )}
    </div>
  );
}

/** One line before a run: which of the current engagement's files its agents can read. */
export function FilesNote({ engagementId }: { engagementId?: string }) {
  const [files, setFiles] = useState<ClientFile[]>([]);
  useEffect(() => {
    if (!engagementId) return setFiles([]);
    let current = true;
    listFiles(engagementId).then(
      (f) => current && setFiles(f),
      () => current && setFiles([]),
    );
    return () => {
      current = false;
    };
  }, [engagementId]);
  if (!files.length) return null;
  return (
    <span className="cost-line" data-testid="files-note" title={files.map((f) => `${f.ref} ${f.name}: ${f.summary}`).join("\n")}>
      Agents can read {files.length} client file{files.length === 1 ? "" : "s"}: {files.map((f) => `${f.ref} ${f.name}`).join(", ")}
    </span>
  );
}
