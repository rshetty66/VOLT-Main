import { useRef, useState } from "react";
import type { CoaEvent } from "../../shared/events";
import { streamAssist } from "../api";
import { Markdown } from "./Markdown";

interface Proposal { kind: "coa" | "legacy"; csv: string }
interface Turn { role: "user" | "assistant"; text: string; status?: string; proposals?: Proposal[]; error?: string }

export function Assistant({ coaCsv, legacyCsv, onLoad }: { coaCsv: string; legacyCsv: string; onLoad: (p: Proposal) => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const patchLast = (fn: (t: Turn) => Turn) => setTurns((ts) => ts.map((t, i) => (i === ts.length - 1 ? fn(t) : t)));
  const apply = (e: CoaEvent) => {
    if (e.type === "text_delta") patchLast((t) => ({ ...t, text: t.text + e.text }));
    else if (e.type === "status") patchLast((t) => ({ ...t, status: e.text }));
    else if (e.type === "tool_call") patchLast((t) => ({ ...t, status: `Running ${e.name}` }));
    else if (e.type === "tool_result") patchLast((t) => ({ ...t, status: `${e.name}: ${e.summary}` }));
    else if (e.type === "proposal") patchLast((t) => ({ ...t, proposals: [...(t.proposals ?? []), { kind: e.kind, csv: e.csv }] }));
    else if (e.type === "error") patchLast((t) => ({ ...t, error: e.message }));
  };

  async function send() {
    const text = prompt.trim();
    if (!text || busy) return;
    const history = turns.filter((t) => t.text).map((t) => ({ role: t.role, content: t.text }));
    setTurns((ts) => [...ts, { role: "user", text }, { role: "assistant", text: "" }]);
    setPrompt("");
    setBusy(true);
    abort.current = new AbortController();
    try {
      for await (const e of streamAssist({ prompt: text, history, coaCsv, legacyCsv }, abort.current.signal)) apply(e);
    } catch (err) {
      if (!abort.current.signal.aborted) patchLast((t) => ({ ...t, error: err instanceof Error ? err.message : String(err) }));
    } finally {
      patchLast((t) => ({ ...t, status: undefined }));
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="page-title">Assistant</h1>
      <p className="page-sub">Ask for a chart design, a rationalisation or a legacy mapping. The assistant works on what is in Design and Mapping, and a chart is only offered for loading after it has passed the checks.</p>
      <div className="chat">
        {turns.length === 0 && <div className="card muted">Try: "Propose a COA for a 12-entity manufacturer on Oracle Cloud ERP with product-line and cost-centre segments."</div>}
        {turns.map((t, i) => (
          <div key={i} className={`card turn ${t.role}`}>
            <span className="micro">{t.role === "user" ? "You" : "Assistant"}</span>
            {t.text && (t.role === "assistant" ? <Markdown text={t.text} /> : <div>{t.text}</div>)}
            {t.status && <div className="status muted">{t.status}</div>}
            {t.error && <div className="errors">{t.error}</div>}
            {t.proposals?.map((p, j) => (
              <div key={j} className="proposal row between">
                <span>Verified {p.kind === "coa" ? "chart" : "legacy mapping"} ({p.csv.trim().split("\n").length - 1} rows)</span>
                <button onClick={() => onLoad(p)}>Load into {p.kind === "coa" ? "Design" : "Mapping"}</button>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="composer">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ask the COA designer" aria-label="Message"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
        <div className="row">
          <button className="primary" onClick={send} disabled={busy || !prompt.trim()}>{busy ? "Working" : "Send"}</button>
          {busy && <button onClick={() => abort.current?.abort()}>Stop</button>}
          <span className="muted">Ctrl+Enter to send</span>
        </div>
      </div>
    </>
  );
}
