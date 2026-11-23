import { useEffect, useRef, useState } from "react";
import type { CatalogResponse, RunKind, RunRequest } from "../../shared/events";
import { evidenceGates } from "../../shared/research";
import { summariseWork, type Run } from "../runState";
import { Markdown } from "./Markdown";
import { RunVisuals } from "../charts/RunVisuals";
import { DownloadMenu } from "./DownloadMenu";
import { runDeliverable } from "../exports";
import { extractAttachment } from "../api";
import { ATTACH_EXTENSIONS, ATTACH_MAX_BYTES, ATTACH_MAX_CHARS_TOTAL, ATTACH_MAX_FILES } from "../../shared/attachments";

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
  onStart: (req: RunRequest, title: string, kind: RunKind) => void;
  onStop: (runId: string) => void;
  onOpenAgent: (id: string) => void;
}

export function Console({ catalog, runs, target, setTarget, live, onStart, onStop, onOpenAgent }: Props) {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<{ name: string; text: string; chars: number; truncated: boolean }[]>([]);
  const [reading, setReading] = useState(0);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const running = runs.some((r) => r.state === "running");
  const targetAgent = catalog.agents.find((a) => a.id === target);

  // A new run scrolls into view at its start, so the answer is read from the top.
  useEffect(() => {
    const last = runs[runs.length - 1];
    if (last) document.getElementById(`run-${last.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [runs.length]);

  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    setFileError("");
    for (const file of Array.from(list)) {
      if (files.length + 1 > ATTACH_MAX_FILES) return void setFileError(`At most ${ATTACH_MAX_FILES} files per request.`);
      if (file.size > ATTACH_MAX_BYTES) {
        setFileError(`${file.name} is larger than 4 MB.`);
        continue;
      }
      setReading((n) => n + 1);
      try {
        const got = await extractAttachment(file);
        setFiles((fs) => {
          const total = fs.reduce((n, f) => n + f.chars, 0) + got.chars;
          if (total > ATTACH_MAX_CHARS_TOTAL) {
            setFileError("The attached files are too long in total. Remove one or attach a shorter file.");
            return fs;
          }
          return [...fs.filter((f) => f.name !== got.name), got];
        });
      } catch (e) {
        setFileError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setReading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = (text = prompt) => {
    if (!text.trim() || reading > 0) return;
    const agentMode = target !== "rudra";
    onStart({ prompt: text.trim(), agentId: agentMode ? target : undefined, attachments: files.length ? files.map(({ name, text }) => ({ name, text })) : undefined }, agentMode ? targetAgent?.name ?? target : "Rudra orchestration", agentMode ? "agent" : "orchestrate");
    setPrompt("");
    setFiles([]);
    setFileError("");
  };

  return (
    <div className="console">
      {runs.length === 0 && (
        <div className="stack">
          {!live && (
            <div className="card body">
              Running in <b>demo mode</b>: routing, Skill Finder, benchmarks and workflow sequencing are real; agent prose is simulated.
              Set <code>ANTHROPIC_API_KEY</code> on the server for live multi-agent reasoning.
            </div>
          )}
          <div className="examples">
            {EXAMPLES.map((e) => (
              <button key={e} className="btn ghost card" onClick={() => submit(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {runs.map((run) => (
        <RunView key={run.id} run={run} onStop={() => onStop(run.id)} />
      ))}
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
            placeholder={target === "rudra" ? "Describe the client situation and what you need… or start with a command such as /compare (type /help for all)" : `Ask ${targetAgent?.name ?? target}…`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          {(files.length > 0 || reading > 0 || fileError) && (
            <div className="row">
              {files.map((f) => (
                <span key={f.name} className="chip" title={f.truncated ? "Long file: only the first part is used" : undefined}>
                  {f.name}
                  {f.truncated ? " (partly)" : ""}
                  <button className="btn ghost sm" aria-label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x.name !== f.name))}>
                    x
                  </button>
                </span>
              ))}
              {reading > 0 && (
                <span className="muted" style={{ fontSize: 12 }}>
                  <span className="spinner" style={{ width: 10, height: 10 }} /> Reading...
                </span>
              )}
              {fileError && (
                <span className="upload-error" role="alert">
                  {fileError}
                </span>
              )}
            </div>
          )}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Ctrl/⌘ + Enter to send{runs.length > 0 ? " · follow-ups keep the conversation" : ""}
            </span>
            <div className="row">
              <input ref={fileInput} type="file" multiple hidden accept={ATTACH_EXTENSIONS.map((e) => `.${e}`).join(",")} onChange={(e) => void attach(e.target.files)} />
              <button className="btn" disabled={running || files.length >= ATTACH_MAX_FILES} onClick={() => fileInput.current?.click()} title="Word, Excel, PowerPoint, CSV, text, Markdown or JSON, up to 4 MB each">
                Attach files
              </button>
              <button className="btn primary" disabled={!prompt.trim() || running || reading > 0} onClick={() => submit()}>
                {running ? "Working…" : "Run"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RunView({ run, onStop }: { run: Run; onStop: () => void }) {
  const work = summariseWork(run);
  // The research engine's gates, run on the finished answer against the run's source register.
  const gates = run.state !== "running" && run.tier && run.text.trim() ? evidenceGates(run.text, run.sources, run.tier) : [];
  const openGates = gates.filter((g) => !g.pass);
  // Each specialist's finished workstream, readable while the lead is still writing the summary.
  const readySections = run.laneOrder.map((id) => run.lanes[id]).filter((l) => l && l.state === "done" && l.text.trim());
  const elapsed = Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000);
  const [, tick] = useState(0);
  useEffect(() => {
    if (run.state !== "running") return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [run.state]);

  return (
    <section className="run" id={`run-${run.id}`}>
      <div className="run-head">
        <span className={`dot ${run.state === "running" ? "running" : "done"}`} />
        <span className="micro">{run.title}</span>
        <div className="prompt">
          {run.prompt}
          {run.attachments?.length ? <div className="muted" style={{ fontSize: 12, fontWeight: 400 }}>Attached: {run.attachments.join(", ")}</div> : null}
        </div>
        <span className="usage">
          {elapsed}s{run.mode === "live" ? ` · ${run.usage.input.toLocaleString()} in / ${run.usage.output.toLocaleString()} out · ${run.usage.cacheRead.toLocaleString()} cached` : run.mode === "demo" ? " · demo" : ""}
        </span>
        {run.state === "running" && (
          <button className="btn sm" onClick={onStop}>
            Stop
          </button>
        )}
        {run.state === "stopped" && <span className="badge">stopped</span>}
        {run.state !== "running" && run.text.trim() && (
          <DownloadMenu formats={["docx", "pptx", "xlsx", "md", "html", ...(run.tier ? (["zip"] as const) : [])]} build={(lanes) => runDeliverable(run, lanes)} option={run.laneOrder.length ? "Include specialist notes as an appendix" : undefined} />
        )}
      </div>
      <div className="run-body single">
        {(work.specialists > 0 || work.toolCalls > 0 || run.tier) && (
          <div className="work-strip">
            {run.state === "running" ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <span className="dot done" />}
            <span className="work-text">{workLine(work, run.state === "running")}</span>
            {run.tier && (
              <span className={`work-evidence ${openGates.length ? "bad" : ""}`} title={openGates.length ? openGates.map((g) => `${g.id} ${g.name}: ${g.detail}`).join("\n") : "All evidence gates passed"}>
                {run.tier} · {run.sources.length} source{run.sources.length === 1 ? "" : "s"}
                {gates.length ? ` · ${gates.length - openGates.length}/${gates.length} gates` : ""}
              </span>
            )}
          </div>
        )}
        {work.errors.length > 0 && (
          <div className="run-errors" role="alert">
            {work.errors.map((m, i) => (
              <div key={i}>{m}</div>
            ))}
          </div>
        )}
        {run.phases.length > 0 && (
          <div className="phases">
            {run.phases.map((p, i) => (
              <div key={i} className={`phase ${p?.state ?? ""}`}>
                {i + 1}. {p?.name}
              </div>
            ))}
          </div>
        )}
        {readySections.length > 0 && (
          <div className="sections">
            <div className="micro">
              Sections ready to review ({readySections.length}){run.state === "running" ? " · the summary is still being written" : ""}
            </div>
            {readySections.map((l) => (
              <details key={l.id} className="section">
                <summary>{l.name}</summary>
                <div className="section-body">
                  <Markdown text={l.text} />
                </div>
              </details>
            ))}
          </div>
        )}
        <div className="answer">
          {run.text ? <Markdown text={run.text} /> : run.state === "running" ? <p className="muted"><span className="spinner" /> Rudra is working…</p> : null}
        </div>
      </div>
    </section>
  );
}

/** "Consulting 3 of 6 specialists: Oracle GL, SAP FI" while running; "Consulted 6 specialists · 4 tool calls" when done. */
function workLine(w: ReturnType<typeof summariseWork>, running: boolean): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts: string[] = [];
  if (w.specialists > 0) {
    if (running) {
      const names = w.working.slice(0, 2).join(", ") + (w.working.length > 2 ? ` +${w.working.length - 2}` : "");
      parts.push(w.working.length > 0 ? `Consulting ${w.finished} of ${plural(w.specialists, "specialist")} done: ${names}` : `Consulted ${plural(w.specialists, "specialist")}, writing up`);
    } else {
      parts.push(`Consulted ${plural(w.specialists, "specialist")}`);
    }
  }
  if (w.toolCalls > 0) parts.push(plural(w.toolCalls, "tool call"));
  if (w.failed > 0) parts.push(`${w.failed} failed`);
  return parts.join(" · ") || "Working";
}
