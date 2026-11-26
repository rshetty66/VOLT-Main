import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogAgent } from "../../shared/events";

const RECENT_KEY = "volt.recentAgents";
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
};

/** Searchable replacement for the long "Talk to" dropdown: type to filter, recent agents first, arrow keys and Enter. */
export function AgentPicker({ agents, value, onChange }: { agents: CatalogAgent[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const rudra = { id: "rudra", name: "All specialists (Rudra leads)", layer: "" };
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const label = value === "rudra" ? rudra.name : byId.get(value)?.name ?? value;

  // Flat, ordered list of what is shown: Rudra, recents, then each layer; filtered by the query.
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (a: { name: string; layer: string }) => !needle || a.name.toLowerCase().includes(needle) || a.layer.toLowerCase().includes(needle);
    const out: { group: string; id: string; name: string }[] = [];
    if (match(rudra)) out.push({ group: "", id: rudra.id, name: rudra.name });
    if (!needle) for (const id of readRecent()) { const a = byId.get(id); if (a && id !== "rudra") out.push({ group: "Recent", id, name: a.name }); }
    for (const layer of [...new Set(agents.map((a) => a.layer))]) {
      for (const a of agents) if (a.layer === layer && a.id !== "rudra" && match(a)) out.push({ group: layer, id: a.id, name: a.name });
    }
    return out;
  }, [agents, byId, q]);

  useEffect(() => setCursor(0), [q, open]);
  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  useEffect(() => {
    document.querySelector(".picker-opt.on")?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const pick = (id: string) => {
    onChange(id);
    if (id !== "rudra") {
      try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 5))); } catch { /* storage unavailable */ }
    }
    setOpen(false);
    setQ("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(rows.length - 1, c + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (rows[cursor]) pick(rows[cursor].id); }
  };

  let lastGroup: string | null = null;
  return (
    <div className="picker" ref={root} onKeyDown={onKey}>
      <button type="button" className="select picker-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="picker-pop">
          <input ref={input} className="input" placeholder={`Search ${agents.length} agents…`} aria-label="Search agents" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="picker-list" role="listbox" aria-label="Agents">
            {rows.length === 0 && <div className="picker-empty">No agent matches “{q}”.</div>}
            {rows.map((r, i) => {
              const header = r.group !== lastGroup && r.group ? <div className="picker-group" key={`g-${r.group}-${i}`}>{r.group}</div> : null;
              lastGroup = r.group;
              return (
                <div key={`${r.group}-${r.id}`} style={{ display: "contents" }}>
                  {header}
                  <button type="button" role="option" aria-selected={r.id === value} className={`picker-opt ${i === cursor ? "on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => pick(r.id)}>
                    {r.name}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
