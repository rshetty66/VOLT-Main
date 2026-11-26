import { confirmDialog, toast } from "../ui";
import { useEffect, useState } from "react";
import type { Run } from "../runState";
import { deleteChat, listChats, restoreChat } from "../projects";

interface Props {
  projectId: string;
  projectName: string;
  history: Run[];
  onOpen: (run: Run) => void;
  onDeleted: (id: string) => void;
  onRestored: () => void;
}

const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const matches = (r: Run, q: string) => !q || `${r.prompt}\n${r.title}\n${r.text}`.toLowerCase().includes(q.toLowerCase());

/** The project's saved chats. Active ones by default; chats untouched for 30 days are under Archived, never deleted. */
export function History({ projectId, projectName, history, onOpen, onDeleted, onRestored }: Props) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [archived, setArchived] = useState<Run[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setArchived(null);
    if (tab === "archived") void listChats(projectId, true).then((cs) => setArchived(cs.map((c) => c.run)), () => setArchived([]));
  }, [tab, projectId]);

  const list = (tab === "active" ? history : archived ?? []).filter((r) => matches(r, query));
  const open = async (r: Run) => {
    if (tab === "archived") {
      await restoreChat(r.id);
      onRestored();
    }
    onOpen(r);
  };
  const remove = async (r: Run) => {
    if (!(await confirmDialog("Delete this chat for good? Archived chats are kept; this one will not be.", "Delete"))) return;
    await deleteChat(r.id);
    if (tab === "archived") setArchived((a) => a?.filter((x) => x.id !== r.id) ?? null);
    onDeleted(r.id);
    toast("Chat deleted");
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Chats</h1>
        <p className="page-sub">
          Every chat in {projectName}, saved on the server and kept for good: it opens on any device. A chat untouched for 30 days moves to Archived, where you can still search it and open it again.
        </p>
      </div>
      <div className="row">
        <button className={`btn sm ${tab === "active" ? "primary" : "ghost"}`} onClick={() => setTab("active")}>
          Active
        </button>
        <button className={`btn sm ${tab === "archived" ? "primary" : "ghost"}`} onClick={() => setTab("archived")}>
          Archived
        </button>
        <input className="input" style={{ flex: 1, minWidth: 160 }} placeholder="Search chats" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {tab === "archived" && archived === null ? (
        <div className="card empty"><span className="spinner" /> Loading…</div>
      ) : list.length === 0 ? (
        <div className="card empty">{query ? "No chat matches." : tab === "active" ? "Nothing saved yet. Finished chats appear here." : "No archived chats."}</div>
      ) : (
        list.map((r) => (
          <div key={r.id} className="card history-item">
            <div className="history-main">
              <div className="micro">
                {r.title} · {when(r.startedAt)}
                {r.tier ? ` · ${r.tier}` : ""}
              </div>
              <div className="history-prompt">{r.prompt}</div>
            </div>
            <div className="row">
              <button className="btn sm" onClick={() => void open(r)}>
                {tab === "archived" ? "Restore and open" : "Open"}
              </button>
              <button className="btn ghost sm" onClick={() => void remove(r)}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
