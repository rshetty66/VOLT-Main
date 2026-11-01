import { useEffect, useState } from "react";
import { getJSON } from "../api";
import { Markdown } from "./Markdown";

interface JournalLine {
  line_id: string;
  account: string;
  debit: string;
  credit: string;
  [field: string]: unknown;
}
interface JournalDoc {
  lines: JournalLine[];
  [field: string]: unknown;
}
interface Check {
  check_id: string;
  status: "PASS" | "FAIL" | "NOT_RUN";
  scope: string;
}
interface Report {
  status: string;
  checks: Check[];
  blockers: string[];
  limitations: string[];
  error?: string;
}
interface Allowance {
  ifrsNet: string;
  usNet: string;
  fullBookPosting: string;
  deltaPosting: string;
  doubleCountedNet: string;
}
interface Demo {
  journal: JournalDoc;
  mapping: unknown;
  lifecycle: string;
  allowance: Allowance;
}

const money = (s: string) => Number(s).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

async function validate(kind: "journal" | "mapping", document: unknown): Promise<Report> {
  const r = await fetch("/api/finance-architecture/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, document }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error ?? `Validation failed (${r.status})`);
  return body as Report;
}

/** Mortgage golden case from the design-finance-architecture skill, validated by its offline checkers. */
export function FinanceArchitecture() {
  const [demo, setDemo] = useState<Demo | null>(null);
  const [journal, setJournal] = useState<JournalDoc | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [mappingReport, setMappingReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getJSON<Demo>("/api/finance-architecture/demo").then(
      (d) => {
        setDemo(d);
        setJournal(structuredClone(d.journal));
      },
      (e) => setError(String(e)),
    );
  }, []);

  if (error && !demo) return <div className="empty">Could not load the finance architecture demo: {error}</div>;
  if (!demo || !journal) return <div className="empty"><span className="spinner" /> Loading golden case…</div>;

  const edit = (i: number, field: "account" | "debit" | "credit", value: string) => {
    setJournal((j) => j && { ...j, lines: j.lines.map((l, k) => (k === i ? { ...l, [field]: value } : l)) });
    setReport(null);
  };
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const [j, m] = await Promise.all([validate("journal", journal), validate("mapping", demo.mapping)]);
      setReport(j);
      setMappingReport(m);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const total = (side: "debit" | "credit") => journal.lines.reduce((s, l) => s + (Number(l[side]) || 0), 0);

  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <div>
        <h1 className="page-title">Finance Architecture and Accounting Events</h1>
        <p className="page-sub">
          Synthetic Canadian residential mortgage (IFRS 9 amortised cost, non-POCI). The journal and mapping checks run the{" "}
          <code>design-finance-architecture</code> skill's offline validators. ILLUSTRATIVE_EXAMPLE: not a posting, not policy approval.
        </p>
      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="micro">Origination golden case, journal J-ORIG-001 (CAD)</div>
          <div className="row">
            <button className="btn sm ghost" onClick={() => { setJournal(structuredClone(demo.journal)); setReport(null); }}>
              Reset
            </button>
            <button className="btn sm primary" onClick={run} disabled={busy}>
              {busy ? "Validating…" : "Validate"}
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Line</th>
                <th>Account role</th>
                <th style={{ textAlign: "right" }}>Debit</th>
                <th style={{ textAlign: "right" }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {journal.lines.map((l, i) => (
                <tr key={l.line_id}>
                  <td>{l.line_id}</td>
                  <td>
                    <input className="input" value={l.account} onChange={(e) => edit(i, "account", e.target.value)} aria-label={`${l.line_id} account`} />
                  </td>
                  <td>
                    <input className="input" style={{ textAlign: "right" }} value={l.debit} onChange={(e) => edit(i, "debit", e.target.value)} aria-label={`${l.line_id} debit`} />
                  </td>
                  <td>
                    <input className="input" style={{ textAlign: "right" }} value={l.credit} onChange={(e) => edit(i, "credit", e.target.value)} aria-label={`${l.line_id} credit`} />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2}><b>Total</b> (display only; the validator checks exact decimals per journal/entity/basis/ledger/period/currency)</td>
                <td style={{ textAlign: "right" }}><b>{money(String(total("debit")))}</b></td>
                <td style={{ textAlign: "right" }}><b>{money(String(total("credit")))}</b></td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="body" style={{ fontSize: 13 }}>
          Carrying amount before allowance 500,000 - 3,000 + 1,000 = 498,000; net of the illustrative IFRS allowance {money(demo.allowance.ifrsNet)}. A
          balanced journal can still be wrong: account roles and amounts must match an independently approved golden case.
        </p>
        {error && <div className="body" style={{ color: "var(--primary)" }}>{error}</div>}
        {report && <ReportView title="Journal validator" report={report} />}
        {mappingReport && <ReportView title="Mapping validator (legacy accounts 100-103 to target)" report={mappingReport} />}
      </div>

      <AllowancePanel a={demo.allowance} />

      <details className="card">
        <summary className="micro" style={{ cursor: "pointer" }}>Mortgage lifecycle: business events to accounting events (19 rows)</summary>
        <Markdown text={demo.lifecycle} />
      </details>
    </div>
  );
}

function ReportView({ title, report }: { title: string; report: Report }) {
  const ran = report.checks.filter((c) => c.status !== "NOT_RUN");
  const notRun = report.checks.filter((c) => c.status === "NOT_RUN");
  return (
    <div className="stack">
      <div className="row">
        <div className="micro">{title}</div>
        <span className={`badge ${report.status === "VALIDATED_SCOPED" ? "full" : "fail"}`}>{report.status}</span>
      </div>
      {report.blockers.length > 0 && (
        <ul className="body" style={{ fontSize: 13, margin: 0 }}>
          {report.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {ran.map((c) => (
              <tr key={c.check_id}>
                <td style={{ width: 90 }}><span className={`badge ${c.status === "PASS" ? "full" : "fail"}`}>{c.status}</span></td>
                <td style={{ width: 220 }}><code>{c.check_id}</code></td>
                <td>{c.scope}</td>
              </tr>
            ))}
            {notRun.map((c) => (
              <tr key={c.check_id}>
                <td><span className="badge partial">NOT_RUN</span></td>
                <td><code>{c.check_id}</code></td>
                <td className="body">{c.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllowancePanel({ a }: { a: Allowance }) {
  const [mode, setMode] = useState<"full" | "delta" | "wrong">("delta");
  const posting = mode === "full" ? a.fullBookPosting : mode === "delta" ? a.deltaPosting : a.fullBookPosting;
  const net = mode === "wrong" ? a.doubleCountedNet : a.usNet;
  return (
    <div className="card stack">
      <div className="micro">IFRS 9 versus US CECL: full book or delta overlay</div>
      <p className="body" style={{ fontSize: 13, margin: 0 }}>
        Same 498,000 pre-allowance carrying amount. Illustrative approved allowances: IFRS 2,000, US CECL 10,000. These are not model estimates.
      </p>
      <div className="row">
        <button className={`btn sm ${mode === "full" ? "primary" : ""}`} onClick={() => setMode("full")}>Full US book</button>
        <button className={`btn sm ${mode === "delta" ? "primary" : ""}`} onClick={() => setMode("delta")}>Delta overlay on IFRS</button>
        <button className={`btn sm ${mode === "wrong" ? "primary" : ""}`} onClick={() => setMode("wrong")}>Overlay posts full CECL (error)</button>
      </div>
      <div className="stats">
        <div className="stat"><span className="micro">US allowance journal</span><span className="v">{money(posting)}</span></div>
        <div className="stat"><span className="micro">US net carrying amount</span><span className="v">{money(net)}</span></div>
        <div className="stat"><span className="micro">IFRS net carrying amount</span><span className="v">{money(a.ifrsNet)}</span></div>
      </div>
      <p className="body" style={{ fontSize: 13, margin: 0 }}>
        {mode === "full" && "An independent US book records the whole 10,000 CECL allowance against its own base."}
        {mode === "delta" && "A DELTA representation on the IFRS base records only the additional 8,000, so IFRS + delta = 10,000."}
        {mode === "wrong" && `Error: posting 10,000 on the overlay double counts the IFRS 2,000; the US net becomes ${money(a.doubleCountedNet)} instead of ${money(a.usNet)}.`}
      </p>
    </div>
  );
}
