import { Suspense, lazy, useState } from "react";
import { ChartFrame } from "../charts/Visual";
import { ColumnDiagram } from "../architecture/ColumnDiagram";
import { CAPABILITIES, COMPARISON, INDUSTRIES, PATTERNS, REFERENCE, SEGMENTS, STACKS, architectureMarkdown, industryDiagram, stackDiagram, type Diagram } from "../architecture/data";
import type { Deliverable } from "../exports";
import { DownloadMenu } from "./DownloadMenu";

const Scene3D = lazy(() => import("../architecture/Scene3D"));

type Tab = "reference" | "patterns" | "platforms" | "industries" | "3d";
const TABS: [Tab, string][] = [["reference", "Reference"], ["patterns", "Patterns"], ["platforms", "Platform stacks"], ["industries", "Industries"], ["3d", "3D view"]];

const Figure = ({ d }: { d: Diagram }) => (
  <div className="stack" style={{ gap: 6 }}>
    <ChartFrame name={d.name} render={(p) => <ColumnDiagram d={d} p={p} />} />
    <div className="muted" style={{ fontSize: 12 }}>{d.caption}</div>
  </div>
);

/** The whole tab as one deliverable: summary tables plus every diagram as a picture. */
function deliverable(): Deliverable {
  const diagrams = [...REFERENCE, ...PATTERNS, ...STACKS.map(stackDiagram), ...INDUSTRIES.map(industryDiagram)];
  return {
    title: "Finance reference architecture",
    subtitle: "VOLT Console | Canadian bank with a US subsidiary (D-SIB pattern) | illustrative, no bank data",
    markdown: architectureMarkdown(),
    figuresTitle: "Diagrams",
    visuals: diagrams.map((d) => ({ caption: d.caption, render: (p) => <ColumnDiagram d={d} p={p} /> })),
  };
}

export function Architecture() {
  const [tab, setTab] = useState<Tab>("reference");
  const [stack, setStack] = useState(STACKS[0].id);
  const current = STACKS.find((s) => s.id === stack)!;

  return (
    <div className="stack" style={{ maxWidth: 1180 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">Finance Architecture</h1>
          <p className="page-sub">
            Reference architecture for a large Canadian bank with a US subsidiary, seven design patterns, the target on three platform stacks, and the same frame for
            other industries. Illustrative: no bank figures, names or branding. Every vendor capability must be verified in the client's licensed release.
          </p>
        </div>
        <DownloadMenu formats={["pptx", "docx", "xlsx", "md", "html"]} build={deliverable} label="Download all" />
      </div>

      <div className="seg-tabs" role="tablist" aria-label="Architecture views">
        {TABS.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "reference" && (
        <div className="stack">
          <div className="card stack">
            <div className="micro">Capability map by operating segment</div>
            <div className="table-wrap">
              <table className="table arch-cap">
                <thead>
                  <tr>
                    <th>Capability</th>
                    {SEGMENTS.map((s) => <th key={s}>{s}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITIES.map((c) => (
                    <tr key={c.name}>
                      <td><b>{c.name}</b></td>
                      {typeof c.cells === "string" ? <td colSpan={SEGMENTS.length} className="arch-shared">{c.cells}</td> : c.cells.map((x, i) => <td key={i}>{x}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {REFERENCE.map((d) => <div key={d.name} className="card"><Figure d={d} /></div>)}
        </div>
      )}

      {tab === "patterns" && (
        <div className="arch-grid">
          {PATTERNS.map((p, i) => (
            <article key={p.name} className="card stack">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{i + 1}. {p.name}</b>
                <span className={`badge ${p.fit === "Strong" ? "full" : p.fit === "Partial" ? "partial" : "fail"}`}>{p.fit} D-SIB fit</span>
              </div>
              <Figure d={p} />
              <div className="body" style={{ fontSize: 13 }}><b>Use when:</b> {p.use}</div>
              <div className="body" style={{ fontSize: 13 }}><b>Trade-off:</b> {p.trade}</div>
            </article>
          ))}
        </div>
      )}

      {tab === "platforms" && (
        <div className="stack">
          <div className="row">
            {STACKS.map((s) => (
              <button key={s.id} className={`btn sm ${s.id === stack ? "primary" : ""}`} aria-pressed={s.id === stack} onClick={() => setStack(s.id)}>
                {s.label}
              </button>
            ))}
            <span className="muted" style={{ fontSize: 12 }}>Not a ranking: selection needs an RFP, fit-gap and a proof of concept on the bank's own events.</span>
          </div>
          <div className="card stack">
            <Figure d={stackDiagram(current)} />
            <div className="body arch-caveat">{current.caveat}</div>
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr><th>Concern</th><th>Oracle</th><th>SAP</th><th>Best-of-breed</th></tr>
              </thead>
              <tbody>
                {COMPARISON.map((r) => (
                  <tr key={r.concern}><td><b>{r.concern}</b></td><td>{r.oracle}</td><td>{r.sap}</td><td>{r.bob}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "industries" && (
        <div className="stack">
          <p className="body" style={{ fontSize: 13, margin: 0 }}>
            Highlighted layers differ from the bank pattern. Insurer, utility and public-sector views are practitioner patterns, not VOLT method packs: build a
            source-backed policy matrix, lifecycle catalog and golden cases for each.
          </p>
          {INDUSTRIES.map((d) => (
            <div key={d.name} className="card stack">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{d.name}</b>
                <span className="badge">{d.tag}</span>
              </div>
              <Figure d={industryDiagram(d)} />
              <div className="body" style={{ fontSize: 13 }}><b>Signature events:</b> {d.events.join(" · ")}</div>
              <div className="body" style={{ fontSize: 13 }}><b>Reports to:</b> {d.reportsTo}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "3d" && (
        <Suspense fallback={<div className="card muted"><span className="spinner" /> Loading the 3D view</div>}>
          <Scene3D />
        </Suspense>
      )}
    </div>
  );
}
