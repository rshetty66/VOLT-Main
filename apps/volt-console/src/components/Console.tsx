import { useEffect, useRef, useState } from "react";
import type { CatalogResponse, RunKind, RunRequest } from "../../shared/events";
import type { ActivityItem, Lane, Run } from "../runState";
import { Markdown } from "./Markdown";
import { runExportUrl, runMarkdownUrl } from "../api";
import { VIEW_ONLY, useCanWrite } from "../user";
import { ktok, usd } from "../money";
import { CostEstimate } from "./CostEstimate";
import { FilesNote } from "./ClientFiles";

/** Download links for a saved run: Word report, Excel workbook, PowerPoint deck, Markdown. */
export function ExportLinks({ runId }: { runId: string }) {
  const link = (href: string, label: string, title: string) => (
    <a className="btn sm" style={{ textDecoration: "none" }} href={href} download title={title} onClick={(e) => e.stopPropagation()}>
      {label}
    </a>
  );
  return (
    <span className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
      {link(runExportUrl(runId, "docx"), "Word", "Report with the deliverable and every specialist's output")}
      {link(runExportUrl(runId, "xlsx"), "Excel", "Tables, benchmarks and the value case with live formulas")}
      {link(runExportUrl(runId, "pptx"), "PowerPoint", "Board deck built from the deliverable")}
      {link(runMarkdownUrl(runId), "Markdown", "Plain text with Markdown formatting")}
    </span>
  );
}

const EXAMPLES = [
  "Our month-end close takes 12 days on SAP S/4HANA and DSO is 55. Build a plan to reach a 5-day close.",
  "We are a Canadian bank preparing our OSFI BCAR submission. Where are the biggest capital reporting risks?",
  "Design the Day 1 finance readiness plan for a $2B acquisition with a 12-month TSA.",
  "Build a value case: 140 finance FTEs at $115K loaded cost, 25% automation, $6M one-time investment.",
];

interface Props {
  catalog: CatalogResponse;
  runs: Run[];
  target: string;
  setTarget: (id: string) => void;
  live: boolean;
  /** The current engagement, whose client files the agents can read. */
  engagementId?: string;
  onStart: (req: RunRequest, title: string, kind: RunKind) => void;
  onStop: (runId: string) => void;
  onOpenAgent: (id: string) => void;
}

export function Console({ catalog, runs, target, setTarget, live, engagementId, onStart, onStop, onOpenAgent }: Props) {
  const [prompt, setPrompt] = useState("");
  const [overBudget, setOverBudget] = useState(false);
  const canWrite = useCanWrite();
  const endRef = useRef<HTMLDivElement>(null);
  const running = runs.some((r) => r.state === "running");
  const targetAgent = catalog.agents.find((a) => a.id === target);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [runs.length]);

  const submit = (text = prompt) => {
    if (!text.trim()) return;
    const agentMode = target !== "rudra";
    onStart({ prompt: text.trim(), agentId: agentMode ? target : undefined }, agentMode ? targetAgent?.name ?? target : "Rudra orchestration", agentMode ? "agent" : "orchestrate");
    setPrompt("");
  };

  return (
    <div className="console">
      {runs.length === 0 && (
        <div className="stack">
          <div>
            <h1 className="page-title">Agent Console</h1>
            <p className="page-sub">
              Ask Rudra, VOLT's master orchestrator. It routes your request across {catalog.agents.length} specialist agents, delegates
              workstreams to them in parallel, pulls VOLT skill packs through the Skill Finder, runs APQC benchmarks and value-case
              maths as tools, and synthesises one executive deliverable. Pick an agent to talk to it directly, or launch a full
              multi-phase run from Workflows.
            </p>
          </div>
          {!live && (
            <div className="card body">
              Running in <b>demo mode</b>: routing, Skill Finder, benchmarks and workflow sequencing are real; agent prose is simulated.
              Set <code>ANTHROPIC_API_KEY</code> on the server for live multi-agent reasoning.
            </div>
          )}
          <div className="examples">
            {EXAMPLES.map((e) => (
              <button key={e} className="btn ghost card" disabled={!canWrite} onClick={() => submit(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {runs.map((run) => (
        <RunView key={run.id} run={run} catalog={catalog} onStop={() => onStop(run.id)} onOpenAgent={onOpenAgent} />
      ))}
      <div ref={endRef} />

      <div className="composer">
        <div className="card">
          <div className="row">
            <span className="micro">Talk to</span>
            <select className="select" style={{ width: "auto", maxWidth: "100%" }} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="rudra">Rudra — orchestrate the whole bench</option>
              {[...new Set(catalog.agents.map((a) => a.layer))].map((layer) => (
                <optgroup key={layer} label={layer}>
                  {catalog.agents
                    .filter((a) => a.layer === layer && a.id !== "rudra")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {target !== "rudra" && (
              <button className="btn ghost sm" onClick={() => onOpenAgent(target)}>
                About this agent
              </button>
            )}
          </div>
          <textarea
            className="textarea"
            disabled={!canWrite}
            placeholder={!canWrite ? VIEW_ONLY : target === "rudra" ? "Describe the client situation and what you need…" : `Ask ${targetAgent?.name ?? target}…`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Ctrl/⌘ + Enter to send{runs.length > 0 ? " · follow-ups keep the conversation" : ""}
              {canWrite && engagementId && (
                <>
                  <br />
                  <FilesNote engagementId={engagementId} />
                </>
              )}
              {canWrite && live && (
                <>
                  <br />
                  <CostEstimate live={live} agentId={target === "rudra" ? undefined : target} refresh={running} onBlocked={setOverBudget} />
                </>
              )}
            </span>
            <button className="btn primary" disabled={!prompt.trim() || running || !canWrite || (live && overBudget)} onClick={() => submit()}>
              {running ? "Working…" : "Run"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RunView({ run, catalog, onStop, onOpenAgent }: { run: Run; catalog: CatalogResponse; onStop: () => void; onOpenAgent: (id: string) => void }) {
  const canWrite = useCanWrite();
  const lanes = run.laneOrder.map((id) => run.lanes[id]);
  const elapsed = Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000);
  const [, tick] = useState(0);
  useEffect(() => {
    if (run.state !== "running") return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [run.state]);

  return (
    <section className="run">
      <div className="run-head">
        <span className={`dot ${run.state === "running" ? "running" : "done"}`} />
        <span className="micro">{run.title}</span>
        <div className="prompt">{run.prompt}</div>
        <span
          className="usage"
          title={
            run.mode === "live"
              ? `Input ${run.usage.input.toLocaleString()} new, ${run.usage.cacheWrite.toLocaleString()} written to cache, ${run.usage.cacheRead.toLocaleString()} read from cache · output ${run.usage.output.toLocaleString()} · cost estimated from the price table`
              : undefined
          }
        >
          {elapsed}s
          {run.mode === "live" ? ` · ${usd(run.usage.costUsd)} · ${ktok(run.usage.input + run.usage.cacheWrite + run.usage.cacheRead)} in (${ktok(run.usage.cacheRead)} cached) / ${ktok(run.usage.output)} out` : run.mode === "demo" ? " · demo" : ""}
        </span>
        {run.files.length > 0 && (
          <span className="usage" data-testid="files-read" title={run.files.map((f) => `${f.ref} ${f.name}: ${f.summary}`).join("\n")}>
            {run.filesRead.length ? `Read ${run.filesRead.join(", ")} of ${run.files.length} client file${run.files.length === 1 ? "" : "s"}` : `${run.files.length} client file${run.files.length === 1 ? "" : "s"} available, none read yet`}
          </span>
        )}
        {run.budgetNote && run.state === "running" && <span className="badge warn" title="An admin sets budgets under Usage">{run.budgetNote}</span>}
        {run.state === "running" && canWrite && (
          <button className="btn sm" onClick={onStop}>
            Stop
          </button>
        )}
        {run.state === "stopped" && <span className="badge">stopped</span>}
        {run.serverRunId && run.state !== "running" && <ExportLinks runId={run.serverRunId} />}
      </div>
      <div className="run-body">
        {run.phases.length > 0 && (
          <div className="phases">
            {run.phases.map((p, i) => (
              <div key={i} className={`phase ${p?.state ?? ""}`}>
                {i + 1}. {p?.name}
                <span className="muted"> · {p?.agents.length} agents</span>
              </div>
            ))}
          </div>
        )}
        {lanes.length > 0 && (
          <div className="lanes">
            {lanes.map((l) => (
              <LaneCard key={l.id} lane={l} catalog={catalog} onOpenAgent={onOpenAgent} />
            ))}
          </div>
        )}
        <div className="answer">
          {run.stoppedReason && (
            <div className="card body" style={{ borderColor: "var(--alert)", marginBottom: 12 }}>
              <b>Stopped:</b> {run.stoppedReason}
            </div>
          )}
          {run.text ? <Markdown text={run.text} /> : run.state === "running" ? <p className="muted"><span className="spinner" /> Rudra is working…</p> : null}
        </div>
        <aside>
          <div className="micro" style={{ marginBottom: 8 }}>
            Activity
          </div>
          <Activity items={run.activity} />
        </aside>
      </div>
    </section>
  );
}

function LaneCard({ lane, onOpenAgent }: { lane: Lane; catalog: CatalogResponse; onOpenAgent: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`lane ${expanded ? "expanded" : ""}`}>
      <div className="lane-head" onClick={() => setExpanded((x) => !x)}>
        <span className={`dot ${lane.state}`} />
        {lane.icon && <span>{lane.icon}</span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="name">{lane.name}</div>
          <div className="muted" style={{ fontSize: 11 }}>
            {lane.layer}
          </div>
        </div>
        <button
          className="btn ghost sm"
          onClick={(e) => {
            e.stopPropagation();
            onOpenAgent(lane.agentId);
          }}
        >
          ⓘ
        </button>
      </div>
      <div className="lane-body">
        {lane.activity.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            <Activity items={lane.activity} />
          </div>
        )}
        {lane.text ? <Markdown text={lane.text} /> : lane.state === "running" ? <span className="muted"><span className="spinner" /> thinking…</span> : null}
      </div>
    </div>
  );
}

const ICON: Record<ActivityItem["kind"], string> = { status: "·", tool: "ƒ", error: "!", fallback: "~", phase: "▸" };

function Activity({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) return <div className="muted" style={{ fontSize: 12 }}>—</div>;
  return (
    <div className="activity">
      {items.map((a) => (
        <div key={a.id} className={`act ${a.isError ? "error" : ""}`}>
          <span className="ico">{a.pending ? <span className="spinner" style={{ width: 10, height: 10 }} /> : ICON[a.kind]}</span>
          <div>
            {a.kind === "tool" ? <b>{a.text}</b> : <span>{a.text}</span>}
            {a.detail && <div className="detail">{a.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
