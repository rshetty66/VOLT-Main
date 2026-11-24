import { useState } from "react";
import type { Report } from "../../workbench/logic";
import { ChecksChart } from "../../charts/Charts";
import { ChartFrame } from "../../charts/Visual";

export const money = (s: string) => Number(s).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** One validator report: executed checks first, then the honest NOT_RUN scope. */
export function ReportView({ title, report, compact = false }: { title: string; report: Report; compact?: boolean }) {
  const ran = report.checks.filter((c) => c.status !== "NOT_RUN");
  const notRun = report.checks.filter((c) => c.status === "NOT_RUN");
  return (
    <div className="stack">
      <div className="row">
        <div className="micro">{title}</div>
        <span className={`badge ${report.status === "VALIDATED_SCOPED" ? "full" : "fail"}`}>{report.status}</span>
        {!compact && report.run_id && <code className="muted" style={{ fontSize: 11 }}>run {report.run_id.slice(0, 8)}</code>}
      </div>
      {report.blockers.length > 0 && (
        <ul className="body" style={{ fontSize: 13, margin: 0 }}>
          {report.blockers.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {compact ? (
        <div className="body" style={{ fontSize: 12 }}>
          {ran.filter((c) => c.status === "PASS").length} of {ran.length} checks passed; {notRun.length} outside scope (NOT_RUN).
        </div>
      ) : (
        <>
        <ChartFrame
          name={`checks-${title}`}
          render={(p) => <ChecksChart title={title} counts={{ pass: ran.filter((c) => c.status === "PASS").length, fail: ran.filter((c) => c.status !== "PASS").length, notRun: notRun.length }} p={p} />}
        />
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
        </>
      )}
    </div>
  );
}

export interface Allowance {
  ifrsNet: string;
  usNet: string;
  fullBookPosting: string;
  deltaPosting: string;
  doubleCountedNet: string;
}

export function AllowancePanel({ a }: { a: Allowance }) {
  const [mode, setMode] = useState<"full" | "delta" | "wrong">("delta");
  const posting = mode === "delta" ? a.deltaPosting : a.fullBookPosting;
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
        {mode === "wrong" &&
          `Error: posting 10,000 on the overlay double counts the IFRS 2,000; the US net becomes ${money(a.doubleCountedNet)} instead of ${money(a.usNet)}. The structural validator cannot see this: it balances. Only a golden-case comparison catches it.`}
      </p>
    </div>
  );
}
