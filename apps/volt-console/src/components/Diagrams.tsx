import { useMemo, useRef, useState } from "react";
import { type DiagramSpec } from "../../shared/diagram";
import {financeStories,financeDiagram,type FinanceProfile} from "../../shared/financeStories";
import {optimizeDiagramBrief} from "../../shared/diagramBrief";
import template from "../diagrams/template.html?raw";
import { downloadText, voltFileName } from "../download";
import { REFERENCE_MODEL, validateFinanceModel, type FinanceModel } from "../../shared/financeReference";
import type { ChatLink } from "../../shared/financeChat";
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
        <p className="page-sub">{tab === "views" ? "Talk through a future-state scenario; the reference architecture, process taxonomy and business architecture update with each turn. Press Tour for a one-minute guide." : "Follow a business record from source to decision. Select a narrated synthetic case or describe your own process."}</p>
      </div>
      <div className="run-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "views"} onClick={() => setTab("views")}>Finance views</button>
        <button role="tab" aria-selected={tab === "flow"} onClick={() => setTab("flow")}>Scenario flow</button>
      </div>
      {tab === "views" ? <FinanceViews /> : <ScenarioFlow />}
    </div>
  );
}

type Turn = { role: "user" | "assistant"; text: string; bullets?: string[]; links?: ChatLink[]; applied?: string[]; rejected?: string[] };
const SAVED = "volt.financeViews.v1";
const STARTERS = [
  "Mid-size Canadian bank, IFRS main ledger with a US GAAP difference ledger, close takes 9 days. Where do agents fit?",
  "What if we add an agent that drafts accrual estimates from contract data?",
  "Intercompany is our biggest pain. What changes in the future state?",
  "Which capabilities should move first, and why?",
];

function loadSaved(): { model: FinanceModel; turns: Turn[] } {
  try {
    const s = JSON.parse(localStorage.getItem(SAVED) ?? "null") as { model: FinanceModel; turns: Turn[] } | null;
    if (s && Array.isArray(s.turns) && validateFinanceModel(s.model).length === 0) return s;
  } catch {
    /* blocked storage or an old shape: start from the reference model */
  }
  return { model: REFERENCE_MODEL, turns: [] };
}

/** Scenario chat on the left, the three linked views on the right. Each turn can change the model; the views redraw. */
function FinanceViews() {
  const [state, setState] = useState(loadSaved);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<string | null>(null);
  const { model, turns } = state;
  const html = useMemo(() => financeViewsHtml(model), [model]);
  const changed = model !== REFERENCE_MODEL;

  function save(next: { model: FinanceModel; turns: Turn[] }) {
    setState(next);
    try {
      localStorage.setItem(SAVED, JSON.stringify({ model: next.model, turns: next.turns.slice(-30) }));
    } catch {
      /* private window: keep it for this visit only */
    }
  }
  const goTo = (target: string) => frame.current?.contentWindow?.postMessage({ type: "volt-go", target }, "*");

  async function send(message: string) {
    const msg = message.trim();
    if (msg.length < 3 || busy) return;
    const asked: Turn[] = [...turns, { role: "user", text: msg }];
    setState({ model, turns: asked });
    setText("");
    setBusy(true);
    try {
      const history = turns.map((t) => ({ role: t.role, text: t.role === "user" ? t.text : (t.bullets ?? []).join("\n") }));
      const r = await fetch("/api/finance-model/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, history, message: msg }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `The assistant could not answer (${r.status})`);
      const reply: Turn = { role: "assistant", text: "", bullets: body.bullets, links: body.links, applied: body.applied, rejected: body.rejected };
      if (body.applied?.length) pending.current = body.links?.[0]?.target ?? null;
      else if (body.links?.[0]) goTo(body.links[0].target);
      save({ model: body.applied?.length ? body.model : model, turns: [...asked, reply] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "The assistant could not answer.", "error");
      setState({ model, turns });
      setText(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="row">
        <button className="btn" onClick={() => downloadText(voltFileName(model.title, "html", html), html, "text/html")}>Download HTML</button>
        {(changed || turns.length > 0) && <button className="btn" disabled={busy} onClick={() => save({ model: REFERENCE_MODEL, turns: [] })}>Reset to reference model</button>}
        <span className="usage">Illustrative model. Agent placement, ratings and maturity are hypotheses until a design workshop confirms them.</span>
      </div>
      <div className="fv-wrap">
        <aside className="fv-chat" aria-label="Scenario assistant">
          <div className="fv-msgs">
            <div className="fv-h">Scenario assistant</div>
            {turns.length === 0 && <p className="usage">Describe a business scenario or ask a what-if. Answers link into the views, and changes redraw them.</p>}
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="fv-m fv-u">{t.text}</div>
              ) : (
                <div key={i} className="fv-m">
                  <ul>{(t.bullets ?? []).map((b, j) => <li key={j}>{b}</li>)}</ul>
                  {!!t.links?.length && <div className="fv-links">{t.links.map((l) => <button key={l.target} className="fv-lk" onClick={() => goTo(l.target)}>{l.label}</button>)}</div>}
                  {!!t.applied?.length && <div className="fv-upd">Model updated: {t.applied.join("; ")}</div>}
                  {!!t.rejected?.length && <div className="fv-rej">Not applied: {t.rejected.join("; ")}</div>}
                </div>
              ),
            )}
            {busy && <div className="usage">Thinking...</div>}
            {turns.length === 0 && <div className="fv-sugg">{STARTERS.map((q) => <button key={q} className="fv-lk" disabled={busy} onClick={() => send(q)}>{q}</button>)}</div>}
          </div>
          <div className="fv-box">
            <textarea className="input" rows={3} maxLength={4000} disabled={busy} value={text} placeholder="Describe a business scenario, or ask about a component, agent or activity" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }} />
            <button className="btn primary" disabled={busy || text.trim().length < 3} onClick={() => send(text)}>{busy ? "Working..." : "Send"}</button>
          </div>
        </aside>
        <iframe ref={frame} title={model.title} srcDoc={html} sandbox="allow-scripts allow-modals" onLoad={() => { if (pending.current) { goTo(pending.current); pending.current = null; } }} style={{ ...FRAME, height: "calc(100vh - 210px)", minHeight: 560 }} />
      </div>
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
