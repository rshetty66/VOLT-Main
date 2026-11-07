import { useMemo } from "react";
import { RETIRE, coaFromCsv, legacyFromCsv, validateMapping } from "../../shared/coa";
import { Checks } from "./Checks";

export function Mapping({ coaCsv, csv, onChange }: { coaCsv: string; csv: string; onChange: (csv: string) => void }) {
  const target = useMemo(() => coaFromCsv(coaCsv), [coaCsv]);
  const leg = useMemo(() => legacyFromCsv(csv), [csv]);
  const checks = useMemo(() => (leg.errors.length ? [] : validateMapping(target.accounts, leg.legacy, leg.mappings)), [target, leg]);
  const mapped = leg.mappings.filter((m) => m.target !== RETIRE).length;
  const retired = leg.mappings.length - mapped;
  const unmapped = leg.legacy.length - leg.mappings.length;

  return (
    <>
      <h1 className="page-title">Mapping</h1>
      <p className="page-sub">Map each legacy account to a posting account in the Design chart, or write RETIRE if it carries no balance forward. Leave target blank while you work.</p>
      <div className="split">
        <div className="stack">
          <textarea className="editor" spellCheck={false} value={csv} onChange={(e) => onChange(e.target.value)} aria-label="Legacy accounts CSV" />
          {leg.errors.length > 0 && <div className="card errors">{leg.errors.map((e) => <div key={e}>{e}</div>)}</div>}
        </div>
        <div className="stack">
          <div className="stats">
            <div className="card"><span className="micro">Mapped</span><b>{mapped}</b></div>
            <div className="card"><span className="micro">Retired</span><b>{retired}</b></div>
            <div className="card"><span className="micro">Unmapped</span><b>{unmapped}</b></div>
          </div>
          <Checks title="Mapping checks" checks={checks} />
          {target.accounts.length === 0 && <div className="card errors">The Design chart is empty or invalid, so every target will fail.</div>}
        </div>
      </div>
    </>
  );
}
