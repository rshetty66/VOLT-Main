import { useState } from "react";
import { MORTGAGE_FIGURES, type Figure, type Scale } from "../../../shared/mortgageFigures";
import type { Report } from "../../workbench/logic";
import { ReportView } from "./ReportView";

export interface SourceSummary {
  id: string;
  sha256: string;
  title: string;
  url?: string;
  retrievedAt: string;
  evidenceClass: "CLIENT_DOCUMENT" | "PUBLIC_FILING";
  kind: "pdf" | "text";
  pageCount: number;
  emptyPages: number[];
}
export interface Candidate {
  title: string;
  url: string;
  period: string;
  publisher: string;
  primary_source: boolean;
}
export interface Meta {
  issuer: string;
  period_end: string;
  currency: string;
  scale: Scale;
  basis: string;
}

interface Props {
  live: boolean;
  busy: string;
  source?: SourceSummary;
  meta: Meta;
  setMeta: (m: Meta) => void;
  figures: Figure[];
  setFigures: (f: Figure[]) => void;
  confirmed: Set<string>;
  toggleConfirmed: (id: string) => void;
  candidates: Candidate[];
  report?: Report;
  onFind: (issuer: string, period: string) => void;
  onExtract: (target: { url?: string; sourceId?: string }) => void;
  onUpload: (file: File) => void;
  onVerify: () => void;
  onIllustrative: () => void;
}

/** Sources step: real documents first. Public filings via Claude web search, other documents by upload. */
export function SourcesStep(p: Props) {
  const [issuer, setIssuer] = useState(p.meta.issuer || "Royal Bank of Canada");
  const [period, setPeriod] = useState("fiscal 2025");
  const [url, setUrl] = useState("");
  const byId = new Map(p.figures.map((f) => [f.id, f]));
  const failing = (id: string) => p.report?.blockers.filter((b) => b.startsWith(`X_`) && b.includes(`${id}:`)) ?? [];

  const setValue = (id: string, patch: Partial<Figure>) => {
    const existing = byId.get(id);
    const label = MORTGAGE_FIGURES.find((m) => m.id === id)!.label;
    const base: Figure = existing ?? {
      id, label, value: "", scale: p.meta.scale, currency: p.meta.currency, period: p.meta.period_end, page: 1, quote: "",
      evidence_class: p.source?.evidenceClass ?? "CLIENT_DOCUMENT",
    };
    const next = { ...base, ...patch };
    const others = p.figures.filter((f) => f.id !== id);
    p.setFigures(next.value.trim() ? [...others, next].sort((a, b) => order(a.id) - order(b.id)) : others);
  };

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="micro">1 · Find a public filing (Claude web search)</div>
          {!p.live && <span className="badge partial">needs Claude API key</span>}
        </div>
        <div className="row">
          <input className="input" style={{ maxWidth: 280 }} value={issuer} onChange={(e) => setIssuer(e.target.value)} aria-label="Issuer" placeholder="Issuer, e.g. Royal Bank of Canada" />
          <input className="input" style={{ maxWidth: 180 }} value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period" placeholder="fiscal 2025" />
          <button className="btn sm primary" disabled={!p.live || !!p.busy} onClick={() => p.onFind(issuer, period)}>
            {p.busy === "find" ? "Searching…" : "Find filings"}
          </button>
        </div>
        {p.candidates.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {p.candidates.map((c) => (
                  <tr key={c.url}>
                    <td>
                      <div>{c.title}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{c.publisher} · {c.period}</div>
                      <code style={{ fontSize: 11, wordBreak: "break-all" }}>{c.url}</code>
                    </td>
                    <td style={{ width: 110 }}><span className={`badge ${c.primary_source ? "full" : "gap"}`}>{c.primary_source ? "primary" : "secondary"}</span></td>
                    <td style={{ width: 150 }}>
                      <button className="btn sm" disabled={!!p.busy} onClick={() => p.onExtract({ url: c.url })}>Fetch & extract</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row">
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Filing URL" placeholder="…or paste the https URL of a filing PDF" />
          <button className="btn sm" disabled={!p.live || !!p.busy || !url.startsWith("https://")} onClick={() => p.onExtract({ url })}>
            {p.busy === "extract" ? "Extracting…" : "Fetch & extract"}
          </button>
        </div>
      </div>

      <div className="card stack">
        <div className="micro">2 · Or upload a document (client statements, trial balance, loan tape)</div>
        <div className="row">
          <input type="file" accept=".pdf,.txt,.csv,application/pdf,text/plain,text/csv" aria-label="Upload a source document" onChange={(e) => e.target.files?.[0] && p.onUpload(e.target.files[0])} style={{ fontSize: 12 }} />
          {p.source && p.source.evidenceClass === "CLIENT_DOCUMENT" && (
            <button className="btn sm" disabled={!p.live || !!p.busy} onClick={() => p.onExtract({ sourceId: p.source!.id })}>Extract with Claude</button>
          )}
        </div>
        <span className="muted" style={{ fontSize: 11 }}>Without an API key, type the figures below with their page and the exact text you read; the check still runs.</span>
      </div>

      {p.source && (
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="stack" style={{ gap: 2 }}>
              <div className="micro">3 · Review figures</div>
              <div>{p.source.title}</div>
              <div className="muted" style={{ fontSize: 11 }}>
                {p.source.evidenceClass} · {p.source.url ?? "uploaded"} · {p.source.pageCount} pages · retrieved {p.source.retrievedAt.slice(0, 10)} · sha256 {p.source.sha256.slice(0, 12)}…
                {p.source.emptyPages.length > 0 && ` · ${p.source.emptyPages.length} pages have no text layer (scans) and cannot be checked`}
              </div>
            </div>
            <button className="btn sm primary" disabled={!!p.busy || !p.figures.length} onClick={p.onVerify}>{p.busy === "verify" ? "Checking…" : "Check figures (0 tokens)"}</button>
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {(["issuer", "period_end", "currency", "basis"] as const).map((k) => (
              <label key={k} className="row body" style={{ fontSize: 12 }}>
                {k.replace("_", " ")}
                <input className="input" style={{ width: 150 }} value={p.meta[k]} onChange={(e) => p.setMeta({ ...p.meta, [k]: e.target.value })} />
              </label>
            ))}
            <label className="row body" style={{ fontSize: 12 }}>
              scale
              <select className="select" value={p.meta.scale} onChange={(e) => p.setMeta({ ...p.meta, scale: e.target.value as Scale })}>
                {["units", "thousands", "millions", "billions"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Figure</th><th style={{ width: 120 }}>Value</th><th style={{ width: 70 }}>Page</th><th>Exact text on that page</th><th style={{ width: 80 }}>Check</th><th style={{ width: 80 }}>Confirm</th></tr>
              </thead>
              <tbody>
                {MORTGAGE_FIGURES.map((m) => {
                  const f = byId.get(m.id);
                  const fails = failing(m.id);
                  return (
                    <tr key={m.id}>
                      <td><div>{m.label}</div><div className="muted" style={{ fontSize: 11 }}>{m.hint}</div></td>
                      <td><input className="input num" value={f?.value ?? ""} onChange={(e) => setValue(m.id, { value: e.target.value.trim() })} aria-label={`${m.label} value`} /></td>
                      <td><input className="input num" value={f?.page ?? ""} onChange={(e) => setValue(m.id, { page: Number(e.target.value) || 1 })} aria-label={`${m.label} page`} disabled={!f} /></td>
                      <td><input className="input" value={f?.quote ?? ""} onChange={(e) => setValue(m.id, { quote: e.target.value })} aria-label={`${m.label} quote`} disabled={!f} /></td>
                      <td>
                        {!f ? <span className="muted" style={{ fontSize: 11 }}>not stated</span>
                          : !p.report ? <span className="badge">unchecked</span>
                          : fails.length ? <span className="badge fail" title={fails.join("\n")}>FAIL</span>
                          : <span className="badge full">PASS</span>}
                      </td>
                      <td>{f && <input type="checkbox" checked={p.confirmed.has(m.id)} onChange={() => p.toggleConfirmed(m.id)} aria-label={`Confirm ${m.label}`} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {p.report && <ReportView title="Extraction check" report={p.report} />}
          <p className="body" style={{ fontSize: 12, margin: 0 }}>
            Confirming a figure records that you, the maker, accept it. Journals use confirmed figures only; anything missing stays BLOCKED.
          </p>
        </div>
      )}

      <div className="card row" style={{ justifyContent: "space-between" }}>
        <span className="body" style={{ fontSize: 13 }}>No client documents or filings available for this exercise?</span>
        <button className="btn sm ghost" onClick={p.onIllustrative}>Data not available: use illustrative example</button>
      </div>
    </div>
  );
}

const order = (id: string) => MORTGAGE_FIGURES.findIndex((m) => m.id === id);
