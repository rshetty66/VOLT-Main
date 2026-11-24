import type { Run } from "../runState";

interface Props {
  history: Run[];
  onOpen: (run: Run) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function History({ history, onOpen, onDelete, onClear }: Props) {
  return (
    <div className="stack">
      <div>
        <h1 className="page-title">History</h1>
        <p className="page-sub">
          Your earlier conversations, saved in this browser (the last 30). They are not shared between devices. Open one to read it again or download it.
        </p>
      </div>
      {history.length === 0 ? (
        <div className="card empty">Nothing saved yet. Finished runs appear here.</div>
      ) : (
        <>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn ghost sm" onClick={() => window.confirm("Delete all saved conversations from this browser?") && onClear()}>
              Clear all
            </button>
          </div>
          {history.map((r) => (
            <div key={r.id} className="card history-item">
              <div className="history-main">
                <div className="micro">
                  {r.title} · {when(r.startedAt)}
                  {r.tier ? ` · ${r.tier}` : ""}
                </div>
                <div className="history-prompt">{r.prompt}</div>
              </div>
              <div className="row">
                <button className="btn sm" onClick={() => onOpen(r)}>
                  Open
                </button>
                <button className="btn ghost sm" onClick={() => onDelete(r.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
