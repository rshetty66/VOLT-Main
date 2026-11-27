import { useEffect, useRef, useState } from "react";
import { GyanStudio } from "./GyanStudio";
import type { CatalogResponse, RunKind, RunRequest } from "../../shared/events";

type Workflow = CatalogResponse["workflows"][number];

interface Props {
  catalog: CatalogResponse;
  live?: boolean;
  onLaunch: (req: RunRequest, title: string, kind: RunKind) => void;
  onOpenAgent: (id: string) => void;
}

export function Workflows({ catalog, live, onLaunch, onOpenAgent, projectId="general",openStudio=false }: Props & {projectId?:string;openStudio?:boolean}) {
  const [studio,setStudio]=useState(openStudio);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Workflow | null>(null);
  const filtered = catalog.workflows.filter((w) => `${w.name} ${w.description} ${w.id}`.toLowerCase().includes(q.toLowerCase()));

  if(studio)return <GyanStudio project={projectId} back={()=>setStudio(false)} />;
  if (selected) return <WorkflowLauncher catalog={catalog} live={live} wf={selected} onBack={() => setSelected(null)} onLaunch={onLaunch} onOpenAgent={onOpenAgent} />;

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Workflows</h1>
        <p className="page-sub">
          VOLT's {catalog.workflows.length} multi-phase workflows. Phases run in order, agents within a phase run in parallel and build on
          earlier phases, and Rudra synthesises the final deliverable.
        </p>
      </div>
      <button className="card interactive card-btn" onClick={()=>setStudio(true)}><strong>Gyan Agents</strong><span className="muted"> · Design, play through and simulate a finance workflow</span></button>
      <input className="input" aria-label="Filter workflows" placeholder="Filter workflows…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="grid">
        {filtered.map((w) => (
          <button type="button" key={w.id} className="card interactive stack card-btn" style={{ gap: 8 }} onClick={() => setSelected(w)}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>
                {w.icon} {w.name}
              </b>
              <span className="micro">{w.phases.length} phases</span>
            </div>
            <div className="body" style={{ fontSize: "var(--fs-4)" }}>
              {w.description}
            </div>
            <div className="row">
              {w.phases.map((p, i) => (
                <span key={i} className="chip">
                  {i + 1}. {p.name}
                </span>
              ))}
            </div>
            <div className="muted" style={{ fontSize: "var(--fs-3)" }}>
              {new Set(w.phases.flatMap((p) => p.agents)).size} agents
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

type ReadyPreview = { kind: "optimized" | "original"; text: string };
type Preview = ReadyPreview | { kind: "loading" | "error" };

export async function prepareWorkflowPreview(prompt: string, workflowId: string, live: boolean, signal: AbortSignal): Promise<ReadyPreview> {
  if (!live) return { kind: "original", text: prompt };
  const response = await fetch("/api/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, workflowId }),
    signal,
  });
  if (!response.ok) throw new Error("Workflow prompt optimization failed.");
  const result = await response.json();
  if (result?.demo === true && result.optimized === null) return { kind: "original", text: prompt };
  if (typeof result?.optimized?.prompt !== "string" || !result.optimized.prompt.trim()) throw new Error("No optimized prompt returned.");
  return { kind: "optimized", text: result.optimized.prompt };
}

type LauncherProps = Props & { wf: Workflow; onBack: () => void; initialPrompt?: string; backLabel?: string };

export function WorkflowLauncher({ catalog, live = catalog.mode === "live", wf, onBack, onLaunch, onOpenAgent, initialPrompt = "", backLabel = "All workflows" }: LauncherProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [preview, setPreview] = useState<Preview | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const cancel = () => {
    pending.current?.abort();
    pending.current = null;
    setPreview(null);
  };
  const review = async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setPreview({ kind: "loading" });
    try {
      const ready = await prepareWorkflowPreview(prompt, wf.id, live, controller.signal);
      if (!controller.signal.aborted) setPreview(ready);
    } catch {
      if (!controller.signal.aborted) setPreview({ kind: "error" });
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  };
  const name = (id: string) => catalog.agents.find((a) => a.id === id);
  const agentCalls = wf.phases.reduce((n, p) => n + p.agents.length, 0);

  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={onBack}>
        ← {backLabel}
      </button>
      <div>
        <h1 className="page-title">
          {wf.icon} {wf.name}
        </h1>
        <p className="page-sub">{wf.description}</p>
      </div>

      <div className="card">
        <div className="micro" style={{ marginBottom: 10 }}>
          Execution plan · {agentCalls} agent runs + Rudra synthesis
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {wf.phases.map((p, i) => (
            <div key={i} className="row" style={{ alignItems: "flex-start" }}>
              <span className="chip" style={{ minWidth: 150 }}>
                {i + 1}. {p.name}
              </span>
              <div className="row">
                {p.agents.map((a) => (
                  <button type="button" key={a} className="chip click" onClick={() => onOpenAgent(a)}>
                    {name(a)?.icon} {name(a)?.name ?? a}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card stack">
        {!preview ? <>
          <label className="stack" style={{ gap: 6 }}>
            <span className="body">Client situation and request</span>
            <textarea className="textarea" rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Client, industry, scale, platforms, pain points, what the deliverable must answer…" />
          </label>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn primary" disabled={!prompt.trim()} onClick={review}>Review workflow prompt</button>
          </div>
        </> : <>
          <div className="micro">Workflow prompt preview</div>
          {preview.kind === "loading" && <div role="status">Preparing the prompt for {wf.name}…</div>}
          {preview.kind === "error" && <div role="alert">The optimizer could not prepare a prompt. Nothing has launched.</div>}
          {"text" in preview && <label className="stack" style={{ gap: 6 }}>
            <span className="body">{preview.kind === "original" ? "Original prompt" : "Optimized prompt"} · review and edit before launching</span>
            <textarea className="textarea" rows={12} value={preview.text} onChange={(e) => setPreview({ ...preview, text: e.target.value })} />
          </label>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={cancel}>Cancel</button>
            {preview.kind === "error" && <button type="button" className="btn" onClick={review}>Retry optimizer</button>}
            {(preview.kind === "error" || preview.kind === "optimized") && <button type="button" className="btn" onClick={() => setPreview({ kind: "original", text: prompt })}>Review original instead</button>}
            {"text" in preview && <button type="button" className="btn primary" disabled={!preview.text.trim()}
              onClick={() => onLaunch({ prompt: preview.text, workflowId: wf.id }, `${wf.icon} ${wf.name}`, "workflow")}>Confirm and launch workflow</button>}
          </div>
        </>}
      </div>
    </div>
  );
}
