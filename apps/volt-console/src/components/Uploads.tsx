import { useEffect, useState } from "react";
import { deleteUpload, listUploads, type UploadMeta } from "../api";

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The uploads library: every file attached in any chat, kept on the server so other chats can use it as a source. */
export function Uploads({ onChange }: { onChange?: () => void }) {
  const [items, setItems] = useState<UploadMeta[] | null>(null);
  const load = () => void listUploads().then(setItems);
  useEffect(load, []);

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Uploads</h1>
        <p className="page-sub">
          Every file you attach is kept here (PDF, JPEG, PNG, Word, Excel, PowerPoint, text). In any chat, choose "From uploads" next to Attach files to use one again as a source. Images are read once into text, so reuse costs no extra reading.
        </p>
      </div>
      {items === null ? (
        <div className="card empty"><span className="spinner" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="card empty">Nothing uploaded yet. Files you attach in the Agent Console appear here.</div>
      ) : (
        items.map((u) => (
          <div key={u.id} className="card history-item">
            <div className="history-main">
              <div className="micro">
                {u.ext.toUpperCase()} · {size(u.bytes)} · {u.chars.toLocaleString()} characters read{u.truncated ? " (truncated)" : ""} · {when(u.createdAt)} · used {u.uses}×
              </div>
              <div className="history-prompt">{u.name}</div>
            </div>
            <div className="row">
              <a className="btn sm" href={`/api/uploads/${u.id}/file`}>
                Download
              </a>
              <button
                className="btn ghost sm"
                onClick={() =>
                  window.confirm(`Remove ${u.name} from the library?`) &&
                  void deleteUpload(u.id).then(() => {
                    load();
                    onChange?.();
                  })
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
