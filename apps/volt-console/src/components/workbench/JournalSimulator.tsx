import { addLine, removeLine, withUsDeltaOverlay, type JournalDoc, type JournalLine, type Report } from "../../workbench/logic";
import { AllowancePanel, ReportView, money, type Allowance } from "./ReportView";

interface Props {
  doc: JournalDoc;
  golden: JournalDoc;
  setDoc: (d: JournalDoc) => void;
  report?: Report;
  busy: boolean;
  onValidate: () => void;
  allowance: Allowance;
}

/** Phase 2: multi-journal simulator over the skill's golden case, validated by validate_journals.py (0 model tokens). */
export function JournalSimulator({ doc, golden, setDoc, report, busy, onValidate, allowance }: Props) {
  const journals = [...new Set(doc.lines.map((l) => l.journal_id))];
  const edit = (id: string, field: "account" | "debit" | "credit", value: string) =>
    setDoc({ ...doc, lines: doc.lines.map((l) => (l.line_id === id ? { ...l, [field]: value } : l)) });
  const total = (lines: JournalLine[], side: "debit" | "credit") => lines.reduce((s, l) => s + (Number(l[side]) || 0), 0);
  const hasOverlay = journals.includes("J-USDELTA-001");

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="micro">Journals ({journals.length}) · CAD · period 2026-10</div>
          <div className="row">
            <button className="btn sm ghost" onClick={() => setDoc(structuredClone(golden))}>Reset to IFRS golden case</button>
            <button className="btn sm" onClick={() => setDoc(withUsDeltaOverlay(doc))} disabled={hasOverlay}>
              Add US CECL delta overlay
            </button>
            <button className="btn sm primary" onClick={onValidate} disabled={busy}>{busy ? "Validating…" : "Validate journals"}</button>
          </div>
        </div>
        {journals.map((j) => {
          const lines = doc.lines.filter((l) => l.journal_id === j);
          return (
            <div key={j} className="stack" style={{ gap: 6 }}>
              <div className="row">
                <code>{j}</code>
                <span className="badge partial">{lines[0]?.basis}</span>
                <span className="muted" style={{ fontSize: 12 }}>ledger {lines[0]?.ledger}</span>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: 60 }}>Line</th>
                      <th>Account role</th>
                      <th style={{ textAlign: "right", width: 170 }}>Debit</th>
                      <th style={{ textAlign: "right", width: 170 }}>Credit</th>
                      <th style={{ width: 40 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.line_id}>
                        <td>{l.line_id}</td>
                        <td><input className="input" value={l.account} onChange={(e) => edit(l.line_id, "account", e.target.value)} aria-label={`${l.line_id} account`} /></td>
                        <td><input className="input num" value={l.debit} onChange={(e) => edit(l.line_id, "debit", e.target.value)} aria-label={`${l.line_id} debit`} /></td>
                        <td><input className="input num" value={l.credit} onChange={(e) => edit(l.line_id, "credit", e.target.value)} aria-label={`${l.line_id} credit`} /></td>
                        <td>
                          <button className="btn sm ghost" onClick={() => setDoc(removeLine(doc, l.line_id))} aria-label={`Remove ${l.line_id}`} title="Remove line">×</button>
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={2}>
                        <button className="btn sm ghost" onClick={() => setDoc(addLine(doc, j))}>+ Add line</button>
                      </td>
                      <td className="num"><b>{money(String(total(lines, "debit")))}</b></td>
                      <td className="num"><b>{money(String(total(lines, "credit")))}</b></td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
        <p className="body" style={{ fontSize: 13, margin: 0 }}>
          Totals are display only; the validator checks exact decimals per journal, entity, basis, ledger, period and currency. A balanced journal can still be
          wrong: account roles and amounts must match an independently approved golden case.
        </p>
        {report && <ReportView title="Journal validator" report={report} />}
      </div>
      <AllowancePanel a={allowance} />
    </div>
  );
}
