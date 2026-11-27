import { useMemo, useState } from "react";
import { SAMPLE_SPEC, type DiagramSpec } from "../../shared/diagram";
import template from "../diagrams/template.html?raw";
import { downloadText } from "../download";
import { toast } from "../ui";

/** Builds the standalone HTML for a spec: the same file the agentic-diagrams skill produces. */
export function diagramHtml(spec: DiagramSpec): string {
  const title=spec.title.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  return template.replaceAll("__TITLE__", () => title).replace("__SPEC__", () => JSON.stringify(spec).replace(/</g, "\\u003c"));
}

const EXAMPLES = ["A finance close agent that pulls from the ERP, reconciles, and asks a controller to approve journals over $50k", "RAG assistant for policy questions with retrieval, a guardrail, and human escalation"];

/** Describe a system, get an interactive animated diagram. Runs in a sandboxed frame; exports as HTML or JSON. */
export function Diagrams() {
  const [text, setText] = useState("");
  const [spec, setSpec] = useState<DiagramSpec>(SAMPLE_SPEC);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("Sample diagram. Describe your own system to replace it.");
  const html = useMemo(() => diagramHtml(spec), [spec]);

  async function build() {
    setBusy(true);
    try {
      const r = await fetch("/api/diagrams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: text }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? `Could not build the diagram (${r.status})`);
      setSpec(body.spec);
      setNote(body.demo ? "Demo mode: showing the sample. Connect a Claude key to build from your description." : `Built with ${body.model}. Use Play or Next to step through the scenarios.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not build the diagram.", "error");
    } finally {
      setBusy(false);
    }
  }
  const slug = spec.title.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "") || "diagram";

  return (
    <div className="stack">
      <div>
        <h2 className="page-title">Visual library</h2>
        <p className="page-sub">Describe an agent system or process. VOLT drafts typed nodes, flows and scenarios you can play step by step.</p>
      </div>
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLES[0]} aria-label="Describe the system" />
        <div className="row">
          <button className="btn primary" disabled={busy || text.trim().length < 10} onClick={build}>{busy ? "Building..." : "Build diagram"}</button>
          <button className="btn" onClick={() => downloadText(`${slug}.html`, html, "text/html")}>Download HTML</button>
          <button className="btn" onClick={() => downloadText(`${slug}.json`, JSON.stringify(spec, null, 2), "application/json")}>Download JSON</button>
          <span className="usage">{note}</span>
        </div>
      </div>
      <iframe title={spec.title} srcDoc={html} sandbox="allow-scripts allow-downloads allow-modals" style={{ width: "100%", height: "70vh", minHeight: 420, border: "1px solid var(--line, #2a3550)", borderRadius: 10, background: "#0b0f17" }} />
    </div>
  );
}
