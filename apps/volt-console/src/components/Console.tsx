import { toast } from "../ui";
import { useEffect, useRef, useState } from "react";
import type { CatalogResponse, RunKind, RunRequest } from "../../shared/events";
import { evidenceGates } from "../../shared/research";
import { RUN_STATUS_LABEL, runStatus, summariseWork, type Run } from "../runState";
import { cad, modelName, modelsLine, modelsOf } from "../usage";
import { Markdown } from "./Markdown";
import { RunVisuals } from "../charts/RunVisuals";
import { DownloadMenu } from "./DownloadMenu";
import { addMemory } from "../projects";
import { FileCards } from "./FileCards";
import { runDeliverable } from "../exports";
import { getUpload, listUploads, uploadAttachment, type UploadMeta } from "../api";
import { scopeLabel, type Scope } from "../../shared/scope";
import { directAsk, quickAsk } from "../../shared/asks";
import { IntakeCard } from "./IntakeCard";
import { AgentPicker } from "./AgentPicker";
import { GetStarted } from "./GetStarted";
import type { SetupStep } from "../setup";
import { ATTACH_EXTENSIONS, ATTACH_MAX_BYTES, ATTACH_MAX_CHARS_TOTAL, ATTACH_MAX_FILES } from "../../shared/attachments";

interface Props {
  /** Setup checklist for the empty home screen, and where its steps lead. */
  setup?: SetupStep[];
  onNavigate?: (view: string) => void;
  /** The latest saved chats, shown on the empty home screen. */
  recent?: Run[];
  onOpenRecent?: (run: Run) => void;
  catalog: CatalogResponse;
  runs: Run[];
  target: string;
  setTarget: (id: string) => void;
  live: boolean;
  onStart: (req: RunRequest, title: string, kind: RunKind) => void;
  onStop: (runId: string) => void;
  onOpenAgent: (id: string) => void;
}

export function Console({ catalog, runs, target, setTarget, live, onStart, onStop, onOpenAgent, recent = [], onOpenRecent, setup, onNavigate }: Props) {
  const [prompt, setPrompt] = useState("");
  const [files, setFiles] = useState<{ name: string; text: string; chars: number; truncated: boolean; id?: string }[]>([]);
  const [reading, setReading] = useState(0);
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const promptBox = useRef<HTMLTextAreaElement>(null);
  // The pinned message box's height pads the end of the chat, so the last lines of an answer are never hidden under it.
  const composer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = composer.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const set = () => document.documentElement.style.setProperty("--composer-h", `${el.offsetHeight}px`);
    const ro = new ResizeObserver(set);
    ro.observe(el);
    set();
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--composer-h");
    };
  }, []);
  const [library, setLibrary] = useState<UploadMeta[] | null>(null);
  // The chat's scope: asked once before the first message of each chat, then sent with every message.
  const [scope, setScope] = useState<Scope | null>(null);
  const [scoping, setScoping] = useState<{ draft: Scope; pending?: string } | null>(null);
  useEffect(() => {
    if (runs.length === 0) setScope(null);
  }, [runs.length]);
  const running = runs.some((r) => r.state === "running");
  const targetAgent = catalog.agents.find((a) => a.id === target);

  // A new run scrolls into view at its start, so the answer is read from the top.
  useEffect(() => {
    const last = runs[runs.length - 1];
    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (last) document.getElementById(`run-${last.id}`)?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  }, [runs.length]);

  const addFile = (got: { name: string; text: string; chars: number; truncated: boolean; id?: string }) =>
    setFiles((fs) => {
      const total = fs.filter((f) => f.name !== got.name).reduce((n, f) => n + f.chars, 0) + got.chars;
      if (total > ATTACH_MAX_CHARS_TOTAL) {
        setFileError("The attached files are too long in total. Remove one or attach a shorter file.");
        return fs;
      }
      return [...fs.filter((f) => f.name !== got.name), got];
    });

  const openLibrary = () => (library ? setLibrary(null) : void listUploads().then(setLibrary));
  const useUpload = async (u: UploadMeta) => {
    setFileError("");
    if (files.length >= ATTACH_MAX_FILES && !files.some((f) => f.name === u.name)) return void setFileError(`At most ${ATTACH_MAX_FILES} files per request.`);
    try {
      addFile(await getUpload(u.id));
      setLibrary(null);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : String(e));
    }
  };

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
        addFile(await uploadAttachment(file));
      } catch (e) {
        setFileError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setReading((n) => n - 1);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const submit = (text = prompt, chosen: Scope | null | undefined = scope) => {
    if (!text.trim() || reading > 0) return;
    // First message of a chat: run the intake before any work starts, unless it is a lookup or a quick ask, which VOLT
    // answers straight away. Skip sends without a scope.
    if (chosen === null && runs.length === 0 && !directAsk(text) && !quickAsk(text)) return void setScoping((s) => ({ draft: s?.draft ?? {}, pending: text }));
    setScoping(null);
    const agentMode = target !== "rudra";
    onStart({ prompt: text.trim(), agentId: agentMode ? target : undefined, scope: chosen ?? undefined, attachments: files.length ? files.map(({ name, text, id }) => ({ name, text, uploadId: id })) : undefined }, agentMode ? targetAgent?.name ?? target : "All specialists", agentMode ? "agent" : "orchestrate");
    setPrompt("");
    setFiles([]);
    setFileError("");
  };

  return (
    <div className="console">
      {runs.length === 0 && (
        <div className="stack">
          {setup && setup.some((s) => !s.done) && (
            <GetStarted
              steps={setup}
              onGo={(s) => {
                if (s.view) onNavigate?.(s.view);
                else promptBox.current?.focus();
              }}
            />
          )}
          {recent.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              <div className="micro">Pick up where you left off</div>
              {recent.map((r) => (
                <button key={r.id} className="recent" onClick={() => onOpenRecent?.(r)}>
                  <span className="recent-title">{r.prompt}</span>
                  <span className="muted">{new Date(r.startedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {runs.map((run) => (
        <RunView key={run.id} run={run} onStop={() => onStop(run.id)} />
      ))}
      <div ref={composer} className={`composer ${runs.length === 0 ? "home" : ""}`}>
        {scoping && (
          <IntakeCard
            key={scoping.pending ? "start" : "edit"}
            draft={scoping.draft}
            onChange={(draft) => setScoping({ ...scoping, draft })}
            starting={Boolean(scoping.pending)}
            onConfirm={() => {
              setScope(scoping.draft);
              if (scoping.pending) submit(scoping.pending, scoping.draft);
              else setScoping(null);
            }}
            onSkip={() => {
              if (scoping.pending) submit(scoping.pending, undefined);
              else setScoping(null);
            }}
          />
        )}
        <div className="card">
          <div className="row">
            <span className="micro">Talk to</span>
            <AgentPicker agents={catalog.agents} value={target} onChange={setTarget} />
            {scope && (
              <button className="chip click" title="Change the scope for this chat" onClick={() => setScoping({ draft: scope })}>
                Scope: {scopeLabel(scope)}
              </button>
            )}
            {target !== "rudra" && (
              <button className="btn ghost sm" onClick={() => onOpenAgent(target)}>
                About this agent
              </button>
            )}
          </div>
          <textarea
            ref={promptBox}
            className="textarea"
            aria-label="Message"
            placeholder={target === "rudra" ? "Describe the client situation and what you need, in your own words" : `Ask ${targetAgent?.name ?? target}`}
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
                  <button className="btn ghost sm icon" aria-label={`Remove ${f.name}`} onClick={() => setFiles((fs) => fs.filter((x) => x.name !== f.name))}>
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              ))}
              {reading > 0 && (
                <span className="muted" style={{ fontSize: "var(--fs-3)" }} role="status">
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
          {library && (
            <div className="stack" style={{ gap: 4 }}>
              {library.length === 0 ? (
                <span className="muted" style={{ fontSize: "var(--fs-3)" }}>The uploads library is empty. Attach a file first.</span>
              ) : (
                library.map((u) => (
                  <button key={u.id} className="btn ghost sm" style={{ justifyContent: "flex-start", textAlign: "left" }} onClick={() => void useUpload(u)}>
                    {u.name} · {u.chars.toLocaleString()} chars
                  </button>
                ))
              )}
            </div>
          )}
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="muted" style={{ fontSize: "var(--fs-3)" }}>
              Ctrl/⌘ + Enter to send{runs.length > 0 ? " · follow-ups keep the conversation" : ""}
            </span>
            <div className="row">
              <input ref={fileInput} type="file" multiple hidden accept={ATTACH_EXTENSIONS.map((e) => `.${e}`).join(",")} onChange={(e) => void attach(e.target.files)} />
              <button className="btn" disabled={running} onClick={openLibrary} title="Reuse a file you uploaded in any chat">
                From uploads
              </button>
              <button className="btn" disabled={running || files.length >= ATTACH_MAX_FILES} onClick={() => fileInput.current?.click()} title="PDF, JPEG, PNG, Word, Excel, PowerPoint, CSV, text, Markdown or JSON, up to 4 MB each. Kept in Uploads for other chats.">
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

/**
 * When a run finishes, brings its end into view just above the pinned message box. It runs after the new-run scroll
 * settles, and only when the end is within a screen of view, so it never pulls a reader away from a long answer.
 */
function scrollEndIntoView(runId: string) {
  const run = document.getElementById(`run-${runId}`);
  const main = run?.closest(".main");
  if (!run || !main) return;
  const box = document.querySelector(".composer")?.getBoundingClientRect();
  const pinned = box && getComputedStyle(document.querySelector(".composer")!).position === "sticky";
  const floor = pinned ? box.top : main.getBoundingClientRect().bottom;
  const by = run.getBoundingClientRect().bottom + 16 - floor;
  if (by > 0 && by < main.clientHeight) main.scrollBy({ top: by, behavior: "smooth" });
}

function RunView({ run, onStop }: { run: Run; onStop: () => void }) {
  const work = summariseWork(run);
  const status = runStatus(run);
  // The research engine's gates, run on the finished answer against the run's source register.
  const gates = run.state !== "running" && run.tier && run.text.trim() ? evidenceGates(run.text, run.sources, run.tier) : [];
  const openGates = gates.filter((g) => !g.pass);
  // Each specialist's finished workstream, readable while the lead is still writing the summary.
  const readySections = run.laneOrder.map((id) => run.lanes[id]).filter((l) => l && l.state === "done" && l.text.trim());
  const elapsed = Math.round(((run.finishedAt ?? Date.now()) - run.startedAt) / 1000);
  // Which models answered this message (Haiku triage, Sonnet, Opus), from the run's usage events.
  const models = modelsOf([run]);
  // Text selected in this answer is offered as the memory item; otherwise the user types it.
  const saveToMemory = async () => {
    const sel = window.getSelection();
    const inRun = sel && sel.anchorNode && document.getElementById(`run-${run.id}`)?.contains(sel.anchorNode);
    const text = window.prompt("Save to project memory (a fact, decision or client context VOLT should always know)", inRun ? sel.toString().trim().slice(0, 600) : "")?.trim();
    if (!text) return;
    try {
      window.dispatchEvent(new CustomEvent("volt:project", { detail: await addMemory(text) }));
      toast("Saved to project memory");
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };
  // When a run finishes, bring its end into view above the pinned message box.
  const wasRunning = useRef(run.state === "running");
  useEffect(() => {
    if (wasRunning.current && run.state !== "running") setTimeout(() => scrollEndIntoView(run.id), 450);
    wasRunning.current = run.state === "running";
  }, [run.state, run.id]);
  const [, tick] = useState(0);
  useEffect(() => {
    if (run.state !== "running") return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [run.state]);

  return (
    <section className="run" id={`run-${run.id}`}>
      <div className="run-head">
        <span className={`status-pill ${status}`} role="status">
          <span className={`dot ${status === "working" ? "running" : status === "failed" ? "failed" : "done"}`} aria-hidden="true" />
          {RUN_STATUS_LABEL[status]}
        </span>
        <span className="micro">{run.title}</span>
        <div className="prompt">
          {run.prompt}
          {run.attachments?.length ? <div className="muted" style={{ fontSize: "var(--fs-3)", fontWeight: 400 }}>Attached: {run.attachments.join(", ")}</div> : null}
        </div>
        <span className="usage" title={models.length ? models.map((m) => `${modelName(m.model)}: ${m.tokens.toLocaleString()} tokens, est. ${cad(m.cost)}`).join("\n") : undefined}>
          {elapsed}s{run.mode === "demo" ? " · demo" : ""}
          {models.length > 0 && ` · ${modelsLine(models)} · est. ${cad(run.usage.cost ?? 0)}`}
        </span>
        {run.state === "running" && (
          <button className="btn sm" onClick={onStop}>
            Stop
          </button>
        )}
        {run.state !== "running" && run.text.trim() && (
          <button className="btn ghost sm" title="Save a key fact or decision from this answer to the project memory" onClick={() => void saveToMemory()}>
            Save to memory
          </button>
        )}
        {run.state !== "running" && run.text.trim() && (
          <DownloadMenu formats={["docx", "pptx", "xlsx", "md", "html", "slides", ...(run.tier ? (["zip"] as const) : [])]} build={(lanes) => runDeliverable(run, lanes)} option={run.laneOrder.length ? "Include specialist notes as an appendix" : undefined} />
        )}
      </div>
      <div className="run-body single">
        {(work.specialists > 0 || work.toolCalls > 0 || run.tier) && (
          <div className="work-strip" role="status">
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
        <RunVisuals run={run} />
        <div className="answer">
          {run.text ? <Markdown text={run.text} /> : run.state === "running" ? <p className="muted"><span className="spinner" /> Rudra is working…</p> : null}
        </div>
        <FileCards run={run} />
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
  return parts.join(" · ") || (running ? "Working" : "Answered directly");
}
