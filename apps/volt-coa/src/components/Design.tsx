import { useMemo } from "react";
import { coaFromCsv, coaToCsv, validateCoa, type Account } from "../../shared/coa";
import { Checks } from "./Checks";

/** Orders accounts depth-first under their parents so the table reads as a hierarchy. Cycles and orphans are appended. */
function tree(accounts: Account[]): { a: Account; depth: number }[] {
  const kids = new Map<string, Account[]>();
  const codes = new Set(accounts.map((a) => a.code));
  for (const a of accounts) {
    const key = a.parent && codes.has(a.parent) ? a.parent : "";
    kids.set(key, [...(kids.get(key) ?? []), a]);
  }
  const out: { a: Account; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (parent: string, depth: number) => {
    for (const a of (kids.get(parent) ?? []).sort((x, y) => x.code.localeCompare(y.code))) {
      if (seen.has(a.code)) continue;
      seen.add(a.code);
      out.push({ a, depth });
      walk(a.code, depth + 1);
    }
  };
  walk("", 0);
  for (const a of accounts) if (!seen.has(a.code)) out.push({ a, depth: 0 });
  return out;
}

export function Design({ csv, onChange }: { csv: string; onChange: (csv: string) => void }) {
  const parsed = useMemo(() => coaFromCsv(csv), [csv]);
  const checks = useMemo(() => validateCoa(parsed.accounts), [parsed]);
  const rows = useMemo(() => tree(parsed.accounts), [parsed]);
  const parents = new Set(parsed.accounts.map((a) => a.parent));
  const download = () => {
    const url = URL.createObjectURL(new Blob([coaToCsv(parsed.accounts)], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: "chart-of-accounts.csv" }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h1 className="page-title">Design</h1>
      <p className="page-sub">Edit the chart as CSV (code, name, type, parent). The checks run on every keystroke and the hierarchy updates beside it.</p>
      <div className="split">
        <div className="stack">
          <textarea className="editor" spellCheck={false} value={csv} onChange={(e) => onChange(e.target.value)} aria-label="Chart of accounts CSV" />
          <div className="row">
            <button onClick={download} disabled={parsed.accounts.length === 0}>Download CSV</button>
            <span className="muted">{parsed.accounts.length} accounts</span>
          </div>
          {parsed.errors.length > 0 && <div className="card errors">{parsed.errors.map((e) => <div key={e}>{e}</div>)}</div>}
        </div>
        <div className="stack">
          <Checks title="Structure checks" checks={checks} />
          <div className="card tablewrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Type</th></tr></thead>
              <tbody>
                {rows.map(({ a, depth }) => (
                  <tr key={a.code + a.name}>
                    <td><code>{a.code}</code></td>
                    <td style={{ paddingLeft: 8 + depth * 18 }} className={parents.has(a.code) ? "parent" : ""}>{a.name}</td>
                    <td className="muted">{a.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
