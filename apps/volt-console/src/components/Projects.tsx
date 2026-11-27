import { useState } from "react";
import { MEMORY_KINDS, MEMORY_KIND_LABEL, MEMORY_MAX_CHARS, type MemoryKind, type Project } from "../../shared/projects";
import { updateProject } from "../projects";

interface Props {
  projects: Project[];
  projectId: string;
  onChange: (p: Project) => void;
}

/** The active project's name and memory: key facts, decisions and client context that VOLT reads in every chat here. */
export function Projects({ projects, projectId, onChange }: Props) {
  const project = projects.find((p) => p.id === projectId);
  const [kind, setKind] = useState<MemoryKind>("fact");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  if (!project) return <div className="card empty"><span className="spinner" /> Loading…</div>;

  const used = project.memory.reduce((n, m) => n + m.text.length, 0);
  const save = async (memory: Project["memory"], name?: string) => {
    setError("");
    try {
      onChange(await updateProject(project.id, { name, memory: memory.map(({ id, kind, text }) => ({ id, kind, text })) }));
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };
  const add = async () => {
    if (!text.trim()) return;
    if (await save([...project.memory, { id: "", kind, text: text.trim(), at: Date.now() }])) setText("");
  };
  const rename = () => {
    const name = window.prompt("Project name", project.name)?.trim();
    if (name && name !== project.name) void save(project.memory, name);
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">
          Project memory · {project.name}{" "}
          {project.id !== "general" && (
            <button className="btn ghost sm" onClick={rename}>
              Rename
            </button>
          )}
        </h1>
        <p className="page-sub">
          Key facts, decisions and client context for this project. VOLT reads them at the start of every chat in the project, so you do not repeat them. Keep each item short: up to {MEMORY_MAX_CHARS.toLocaleString()} characters in all ({used.toLocaleString()} used).
        </p>
      </div>
      <div className="card stack">
        <div className="row">
          <select className="select" aria-label="Memory type" value={kind} onChange={(e) => setKind(e.target.value as MemoryKind)}>
            {MEMORY_KINDS.map((k) => (
              <option key={k} value={k}>
                {MEMORY_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <input className="input" style={{ flex: 1, minWidth: 200 }} maxLength={600} placeholder="For example: IFRS is the primary ledger; US GAAP via difference ledgers" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void add()} />
          <button className="btn primary sm" disabled={!text.trim()} onClick={() => void add()}>
            Add
          </button>
        </div>
        {error && <div className="upload-error" role="alert">{error}</div>}
      </div>
      {project.memory.length === 0 ? (
        <div className="card empty-state">
          <b>No memory yet</b>
          <p>Project memory holds the facts every chat in this project should know, so you do not repeat them.</p>
          <p className="muted">Examples: "IFRS is the primary ledger; US GAAP via difference ledgers." "Fiscal year ends 31 October." Add one above, or select text in an answer and use Save to memory.</p>
        </div>
      ) : (
        project.memory.map((m) => (
          <div key={m.id} className="card history-item">
            <div className="history-main">
              <div className="micro">
                {MEMORY_KIND_LABEL[m.kind]} · {new Date(m.at).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </div>
              <div className="history-prompt">{m.text}</div>
            </div>
            <div className="row">
              <button
                className="btn sm"
                onClick={() => {
                  const next = window.prompt("Edit memory item", m.text)?.trim();
                  if (next && next !== m.text) void save(project.memory.map((x) => (x.id === m.id ? { ...x, text: next } : x)));
                }}
              >
                Edit
              </button>
              <button className="btn ghost sm" onClick={() => void save(project.memory.filter((x) => x.id !== m.id))}>
                Remove
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
