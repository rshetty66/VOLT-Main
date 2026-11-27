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

const RUDRA = { id: "rudra", name: "All specialists (Rudra leads)", layer: "" };
export interface PickerRow { group: string; id: string; name: string }

/** What the picker lists, in order: Rudra, then recent agents (when not searching), then each layer; filtered by the query. */
export function pickerRows(agents: Pick<CatalogAgent, "id" | "name" | "layer">[], q: string, recent: string[]): PickerRow[] {
  const needle = q.trim().toLowerCase();
  const byId = new Map(agents.map((a) => [a.id, a]));
  const match = (a: { name: string; layer: string }) => !needle || a.name.toLowerCase().includes(needle) || a.layer.toLowerCase().includes(needle);
  const out: PickerRow[] = [];
  if (match(RUDRA)) out.push({ group: "", id: RUDRA.id, name: RUDRA.name });
  if (!needle) for (const id of recent) { const a = byId.get(id); if (a && id !== RUDRA.id) out.push({ group: "Recent", id, name: a.name }); }
  for (const layer of [...new Set(agents.map((a) => a.layer))]) {
    for (const a of agents) if (a.layer === layer && a.id !== RUDRA.id && match(a)) out.push({ group: layer, id: a.id, name: a.name });
  }
  return out;
}

/** The highlighted row after a key press, or undefined for a key the list does not handle. */
export function moveCursor(key: string, cursor: number, count: number): number | undefined {
  const last = Math.max(0, count - 1);
  if (key === "ArrowDown") return Math.min(last, cursor + 1);
  if (key === "ArrowUp") return Math.max(0, cursor - 1);
  if (key === "Home") return 0;
  if (key === "End") return last;
  if (key === "PageDown") return Math.min(last, cursor + 8);
  if (key === "PageUp") return Math.max(0, cursor - 8);
  return undefined;
}

/** Searchable replacement for the long "Talk to" dropdown: type to filter, recent agents first, arrow keys and Enter. */
export function AgentPicker({ agents, value, onChange }: { agents: CatalogAgent[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const label = value === RUDRA.id ? RUDRA.name : byId.get(value)?.name ?? value;
  const rows = useMemo(() => pickerRows(agents, q, readRecent()), [agents, q]);
  const button = useRef<HTMLButtonElement>(null);
  const optId = (i: number) => `picker-opt-${i}`;

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
    if (id !== RUDRA.id) {
      try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 5))); } catch { /* storage unavailable */ }
    }
    setOpen(false);
    setQ("");
    button.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); button.current?.focus(); return; }
    if (e.key === "Enter") { e.preventDefault(); if (rows[cursor]) pick(rows[cursor].id); return; }
    const next = moveCursor(e.key, cursor, rows.length);
    if (next !== undefined) { e.preventDefault(); setCursor(next); }
  };

  let lastGroup: string | null = null;
  return (
    <div className="picker" ref={root} onKeyDown={onKey}>
      <button ref={button} type="button" className="select picker-btn" aria-label={`Talk to: ${label}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="picker-pop">
          <input ref={input} className="input" role="combobox" aria-expanded="true" aria-controls="picker-list" aria-autocomplete="list" aria-activedescendant={rows[cursor] ? optId(cursor) : undefined} placeholder={`Search ${agents.length} agents…`} aria-label="Search agents" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="picker-list" id="picker-list" role="listbox" aria-label="Agents">
            {rows.length === 0 && <div className="picker-empty">No agent matches “{q}”.</div>}
            {rows.map((r, i) => {
              const header = r.group !== lastGroup && r.group ? <div className="picker-group" role="presentation" key={`g-${r.group}-${i}`}>{r.group}</div> : null;
              lastGroup = r.group;
              return (
                <div key={`${r.group}-${r.id}`} style={{ display: "contents" }}>
                  {header}
                  <button type="button" role="option" id={optId(i)} tabIndex={-1} aria-selected={r.id === value} className={`picker-opt ${i === cursor ? "on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => pick(r.id)}>
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
