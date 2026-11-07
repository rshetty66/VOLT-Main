import { SAMPLE_CSV, type MappingCsv, type Report } from "../../workbench/logic";
import { ReportView } from "./ReportView";

interface Props {
  csv: MappingCsv;
  setCsv: (c: MappingCsv) => void;
  errors: string[];
  report?: Report;
  busy: boolean;
  onValidate: () => void;
  /** The synthetic sample is offered only in illustrative mode. */
  allowSample: boolean;
}

const FIELDS: { key: keyof MappingCsv; label: string; hint: string }[] = [
  { key: "legacy", label: "Legacy balances", hint: "entity, basis, currency, period, account, balance (signed)" },
  { key: "mapping", label: "Account mapping", hint: "source, target_account, weight (weights per source sum to 1; RETIRE for a zero-balance account)" },
  { key: "target", label: "Target balances (independent source)", hint: "entity, basis, currency, period, account, balance; its accounts are the target chart" },
];

/** Phase 2: legacy-to-target COA proof from CSV, validated by validate_mapping.py (0 model tokens). */
export function MappingProver({ csv, setCsv, errors, report, busy, onValidate, allowSample }: Props) {
  const load = async (key: keyof MappingCsv, file?: File) => {
    if (!file) return;
    setCsv({ ...csv, [key]: await file.text() });
  };
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="micro">Mapping proof at entity / basis / currency / period / account grain</div>
        <div className="row">
          {allowSample && <button className="btn sm ghost" onClick={() => setCsv(SAMPLE_CSV)}>Load illustrative sample</button>}
          <button className="btn sm primary" onClick={onValidate} disabled={busy || !csv.legacy.trim() || !csv.target.trim()}>{busy ? "Validating…" : "Prove mapping"}</button>
        </div>
      </div>
      <div className="csv-grid">
        {FIELDS.map((f) => (
          <div key={f.key} className="stack" style={{ gap: 6 }}>
            <label className="micro" htmlFor={`csv-${f.key}`}>{f.label}</label>
            <textarea id={`csv-${f.key}`} className="input csv" value={csv[f.key]} onChange={(e) => setCsv({ ...csv, [f.key]: e.target.value })} spellCheck={false} />
            <span className="muted" style={{ fontSize: 11 }}>{f.hint}</span>
            <input id={`file-${f.key}`} type="file" accept=".csv,text/csv" onChange={(e) => load(f.key, e.target.files?.[0])} aria-label={`Upload ${f.label} CSV`} style={{ fontSize: 12 }} />
          </div>
        ))}
      </div>
      <p className="body" style={{ fontSize: 13, margin: 0 }}>
        The target balances must come from an independent source, such as the target ledger's trial balance. A target produced by this same mapping proves nothing.
        Files are read in your browser and sent only to this console's validator.
      </p>
      {errors.length > 0 && (
        <ul className="body" style={{ fontSize: 13, margin: 0 }}>
          {errors.map((e) => (
            <li key={e}>CSV problem: {e}</li>
          ))}
        </ul>
      )}
      {report && <ReportView title="Mapping validator" report={report} />}
    </div>
  );
}
