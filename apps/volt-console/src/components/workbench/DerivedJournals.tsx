import type { JournalDoc, Report } from "../../workbench/logic";
import { ReportView, money } from "./ReportView";

interface Props {
  doc: JournalDoc | null;
  blocked: { journal: string; missing: string[] }[];
  approvedBy: string;
  setApprovedBy: (v: string) => void;
  report?: Report;
  busy: boolean;
  onValidate: () => void;
}

/** Real-data mode: portfolio journals implied by confirmed allowance movements, read-only and traced to the source. */
export function DerivedJournals({ doc, blocked, approvedBy, setApprovedBy, report, busy, onValidate }: Props) {
  const journals = doc ? [...new Set(doc.lines.map((l) => l.journal_id))] : [];
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="micro">Portfolio journals from confirmed figures</div>
        <button className="btn sm primary" onClick={onValidate} disabled={busy || !doc}>{busy ? "Validating…" : "Validate journals"}</button>
      </div>
      <label className="row body" style={{ fontSize: 13 }} htmlFor="rule-approver">
        Posting rule approved by
        <input id="rule-approver" className="input" style={{ width: 220 }} value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} placeholder="name of the approver" />
        <span className="muted" style={{ fontSize: 11 }}>Left blank, the rule stays DRAFT and validation blocks it.</span>
      </label>
      {!doc && <p className="body" style={{ fontSize: 13, margin: 0 }}>No journal yet: confirm the provision, write-off or recovery figures on the Sources step.</p>}
      {journals.map((j) => {
        const lines = doc!.lines.filter((l) => l.journal_id === j);
        return (
          <div key={j} className="stack" style={{ gap: 6 }}>
            <div className="row"><code>{j}</code><span className="badge partial">{lines[0].basis}</span><span className="muted" style={{ fontSize: 12 }}>{String(lines[0].currency)} · {String(lines[0].accounting_date)}</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Account role</th><th style={{ textAlign: "right" }}>Debit</th><th style={{ textAlign: "right" }}>Credit</th><th>Traced to</th></tr></thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.line_id}>
                      <td>{l.account}</td>
                      <td className="num">{l.debit === "0.00" ? "" : money(l.debit)}</td>
                      <td className="num">{l.credit === "0.00" ? "" : money(l.credit)}</td>
                      <td><code style={{ fontSize: 11 }}>{l.measurement_ref as string}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {blocked.length > 0 && (
        <div className="stack" style={{ gap: 4 }}>
          {blocked.map((b) => (
            <div key={b.journal} className="row body" style={{ fontSize: 13 }}>
              <span className="badge fail">BLOCKED</span> {b.journal}: needs {b.missing.join(", ")}
            </div>
          ))}
        </div>
      )}
      <p className="body" style={{ fontSize: 12, margin: 0 }}>
        Account roles are a design proposal; amounts come from the statement. US CECL figures are compared only when the filing discloses them.
      </p>
      {report && <ReportView title="Journal validator" report={report} />}
    </div>
  );
}
