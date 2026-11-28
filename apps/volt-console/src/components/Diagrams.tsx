import { useMemo, useState } from "react";
import { type DiagramSpec } from "../../shared/diagram";
import {financeStories,financeDiagram,type FinanceProfile} from "../../shared/financeStories";
import {optimizeDiagramBrief} from "../../shared/diagramBrief";
import template from "../diagrams/template.html?raw";
import { downloadText, voltFileName } from "../download";
import { REFERENCE_MODEL } from "../../shared/financeReference";
import { financeViewsHtml } from "../diagrams/financeViews";
import { toast } from "../ui";

/** Builds the standalone HTML for a spec: the same file the agentic-diagrams skill produces. */
export function diagramHtml(spec: DiagramSpec): string {
  const title=spec.title.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  return template.replaceAll("__TITLE__", () => title).replace("__SPEC__", () => JSON.stringify(spec).replace(/</g, "\\u003c"));
}

const EXAMPLES = ["Show how bank statements and cash ledger extracts flow through reconciliation, independent verification and controller review."];

const FRAME = { width: "100%", border: "1px solid var(--line, #2a3550)", borderRadius: 10, background: "#000" } as const;

/** Two tabs: the linked finance views (reference architecture, process taxonomy, business architecture) and the scenario flow builder. */
export function Diagrams() {
  const [tab, setTab] = useState<"views" | "flow">("views");
  return (
    <div className="stack">
      <div>
        <h2 className="page-title">Diagram builder</h2>
        <p className="page-sub">{tab === "views" ? "One future-state model in three linked views. Press Tour for a one-minute guide." : "Follow a business record from source to decision. Select a narrated synthetic case or describe your own process."}</p>
      </div>
      <div className="run-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "views"} onClick={() => setTab("views")}>Finance views</button>
        <button role="tab" aria-selected={tab === "flow"} onClick={() => setTab("flow")}>Scenario flow</button>
      </div>
      {tab === "views" ? <FinanceViews /> : <ScenarioFlow />}
    </div>
  );
}

function FinanceViews() {
  const html = useMemo(() => financeViewsHtml(REFERENCE_MODEL), []);
  return (
    <>
      <div className="row">
        <button className="btn" onClick={() => downloadText(voltFileName(REFERENCE_MODEL.title, "html", html), html, "text/html")}>Download HTML</button>
        <span className="usage">Illustrative reference model. Agent placement and maturity are hypotheses until a design workshop confirms them.</span>
      </div>
      <iframe title={REFERENCE_MODEL.title} srcDoc={html} sandbox="allow-scripts allow-modals" style={{ ...FRAME, height: "calc(100vh - 210px)", minHeight: 560 }} />
    </>
  );
}

/** Describe a system, get an interactive animated diagram. Runs in a sandboxed frame; exports as HTML or JSON. */
function ScenarioFlow() {
  const [text, setText] = useState("");
  const [systems,setSystems]=useState(""),[requirements,setRequirements]=useState(""),[review,setReview]=useState<string|null>(null);
  const [spec, setSpec] = useState<DiagramSpec>(()=>financeDiagram("p2p_ap_3way_match"));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("Synthetic invoice case. Use Play or Next to follow the decision.");
  const html = useMemo(() => diagramHtml(spec), [spec]);

  async function build() {
    if(!review||review.trim().length<10)return;
    setBusy(true);
    try {
      const r = await fetch("/api/diagrams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: review.trim() }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `Could not build the diagram (${r.status})`);
      setSpec(body.spec);
      setReview(null);
      setNote(body.demo ? "Demo mode: showing the sample. Connect a Claude key to build from your description." : `Built with ${body.model}. Use Play or Next to step through the scenarios.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not build the diagram.", "error");
    } finally {
      setBusy(false);
    }
  }
  const slug = spec.title.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "") || "diagram";

  return (
    <>
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <div className="row gyan-wrap" aria-label="Synthetic business scenarios">{(Object.keys(financeStories) as FinanceProfile[]).map(k=><button className="btn" key={k} disabled={busy} onClick={()=>{setSpec(financeDiagram(k));setNote("Synthetic example · no operational action. Use Play or Next to follow the record.")}}>{financeStories[k].title}</button>)}</div>
        <label>Business decision or process<textarea className="input" rows={3} maxLength={4000} disabled={busy} value={text} onChange={(e) => {setText(e.target.value);setReview(null)}} placeholder={EXAMPLES[0]} /></label>
        <label>Systems in scope (if known)<input className="input" maxLength={1000} disabled={busy} value={systems} placeholder="For example: SAP S/4HANA, Coupa, bank statement feed" onChange={e=>{setSystems(e.target.value);setReview(null)}}/></label>
        <label>Mandatory requirements (if known)<textarea className="input" maxLength={1800} disabled={busy} value={requirements} placeholder="For example: read-only access; controller approval before posting" onChange={e=>{setRequirements(e.target.value);setReview(null)}}/></label>
        {review!==null&&<label>Review optimized prompt, including assumptions<textarea className="input" rows={12} maxLength={10000} disabled={busy} value={review} onChange={e=>setReview(e.target.value)}/></label>}
        <div className="row">
          {review===null?<button className="btn primary" disabled={busy||text.trim().length<10} onClick={()=>setReview(optimizeDiagramBrief(text,systems,requirements))}>Optimize prompt</button>:<><button className="btn primary" disabled={busy||review.trim().length<10} onClick={build}>{busy?"Building…":"Confirm and build diagram"}</button><button className="btn" disabled={busy} onClick={()=>setReview(null)}>Cancel</button></>}
          <button className="btn" onClick={() => downloadText(`${slug}.html`, html, "text/html")}>Download HTML</button>
          <button className="btn" onClick={() => downloadText(`${slug}.json`, JSON.stringify(spec, null, 2), "application/json")}>Download JSON</button>
          <span className="usage">{note}</span>
        </div>
      </div>
      <iframe title={spec.title} srcDoc={html} sandbox="allow-scripts allow-downloads allow-modals" style={{ ...FRAME, height: "70vh", minHeight: 420, background: "#0b0f17" }} />
    </>
  );
}
