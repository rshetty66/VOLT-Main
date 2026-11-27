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
import { AgentStage } from "./AgentStage";
import { keyPoints, SHORT_ANSWER } from "../runDigest";
import type { Lane } from "../runState";
import { runDeliverable } from "../exports";
import { getUpload, listUploads, uploadAttachment, type UploadMeta } from "../api";
import { scopeLabel, type Scope } from "../../shared/scope";
import { directAsk, quickAsk } from "../../shared/asks";
import { IntakeCard } from "./IntakeCard";
import { shouldOptimize, type Optimized } from "../../shared/optimize";
import { AgentPicker } from "./AgentPicker";
import { GetStarted } from "./GetStarted";
import { Icon } from "./Icon";
import { STARTERS } from "../starters";
import { PROMPT_IDEAS } from "../promptIdeas";
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
  /** The signed-in name, for the greeting. */
  userName?: string | null;
}

const greeting = (h = new Date().getHours()) => (h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");

export function Console({ catalog, runs, target, setTarget, live, onStart, onStop, onOpenAgent, recent = [], onOpenRecent, setup, onNavigate, userName }: Props) {
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
  // Every message that is not a lookup or a quick ask is rewritten into an executive prompt first; the user confirms it, edits it or sends the original.
  const [optimizing, setOptimizing] = useState<{ original: string; chosen: Scope | null | undefined; result?: Optimized; text: string } | null>(null);
  const optimized = useRef("");
  const optimize = (text: string, chosen: Scope | null | undefined) => {
    setOptimizing({ original: text, chosen, text: "" });
    fetch("/api/optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: text }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { optimized: Optimized | null } | null) => {
        if (j?.optimized) setOptimizing((o) => (o && o.original === text ? { ...o, result: j.optimized as Optimized, text: (j.optimized as Optimized).prompt } : o));
        else {
          // No rewrite available (demo mode or a failed call): send the message as written.
          setOptimizing(null);
          optimized.current = text;
          submit(text, chosen);
        }
      })
      .catch(() => {
        setOptimizing(null);
        optimized.current = text;
        submit(text, chosen);
      });
  };
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

  // A starter card or a prompt idea fills the message box for editing; nothing is sent until Run.
  const [ideas, setIdeas] = useState(false);
  const fill = (text: string) => {
    setPrompt(text);
    setIdeas(false);
    requestAnimationFrame(() => {
      const box = promptBox.current;
      if (box) (box.focus(), box.setSelectionRange(text.length, text.length));
    });
  };

  // Sends a finished run's message again with the chat's scope, leaving whatever is in the message box alone.
  const regenerate = (text: string) => {
    const agentMode = target !== "rudra";
    onStart({ prompt: text, agentId: agentMode ? target : undefined, scope: scope ?? undefined }, agentMode ? targetAgent?.name ?? target : "All specialists", agentMode ? "agent" : "orchestrate");
  };

  const submit = (text = prompt, chosen: Scope | null | undefined = scope) => {
    if (!text.trim() || reading > 0) return;
    if (live && target === "rudra" && shouldOptimize(text) && text !== optimized.current) return void optimize(text, chosen);
    // First message of a chat: run the intake before any work starts, unless it is a lookup or a quick ask, which VOLT
    // answers straight away. Skip sends without a scope: the intake is already open then, so it must not reopen.
    if (chosen === null && !scoping?.pending && runs.length === 0 && !directAsk(text) && !quickAsk(text)) return void setScoping((s) => ({ draft: s?.draft ?? {}, pending: text }));
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
        <>
          <h1 className="home-greeting">{greeting()}{userName ? `, ${userName}` : ""}</h1>
          <div className="stack home-below">
            <div className="starters">
              {STARTERS.map((st) => (
                <button key={st.title} className="starter" onClick={() => fill(st.prompt)}>
                  <span className="starter-icon" aria-hidden="true"><Icon name={st.icon} size={18} /></span>
                  <span className="micro">{st.category}</span>
                  <span className="starter-title">{st.title}</span>
                  <span className="starter-text">{st.prompt}</span>
                </button>
              ))}
            </div>
            {recent.length > 0 && (
              <div className="stack" style={{ gap: "var(--sp-2)" }}>
                <div className="micro">Recent chats</div>
                {recent.map((r) => (
                  <button key={r.id} className="recent" onClick={() => onOpenRecent?.(r)}>
                    <span className="recent-title">{r.prompt}</span>
                    <span className="muted">{new Date(r.startedAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                  </button>
                ))}
              </div>
            )}
            {setup && setup.some((s) => !s.done) && (
              <GetStarted
                steps={setup}
                onGo={(s) => {
                  if (s.view) onNavigate?.(s.view);
                  else promptBox.current?.focus();
                }}
              />
            )}
          </div>
        </>
      )}

      {runs.map((run) => (
        <RunView key={run.id} run={run} onStop={() => onStop(run.id)} onRegenerate={running ? undefined : () => regenerate(run.prompt)} />
      ))}
      <div ref={composer} className={`composer ${runs.length === 0 ? "home" : ""}`}>
        {optimizing && (
          <div className="card optimize-card" role="region" aria-label="Optimized prompt">
            <div className="micro">Optimized prompt</div>
            {!optimizing.result ? (
              <div className="muted" role="status"><span className="spinner" style={{ width: 10, height: 10 }} /> Sharpening your question...</div>
            ) : (
              <>
                <div className="body"><strong>Business ask:</strong> {optimizing.result.ask}</div>
                {optimizing.result.assumptions.length > 0 && <div className="muted">Assumed: {optimizing.result.assumptions.join("; ")}. Edit below if wrong.</div>}
                <textarea className="textarea" aria-label="Optimized prompt" rows={12} value={optimizing.text} onChange={(e) => setOptimizing({ ...optimizing, text: e.target.value })} />
                <div className="row">
                  <button
                    className="btn primary"
                    disabled={!optimizing.text.trim()}
                    onClick={() => {
                      const { text, chosen } = optimizing;
                      setOptimizing(null);
                      optimized.current = text.trim();
                      submit(text.trim(), chosen);
                    }}
                  >
                    Send optimized
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      const { original, chosen } = optimizing;
                      setOptimizing(null);
                      optimized.current = original;
                      submit(original, chosen);
                    }}
                  >
                    Send my original
                  </button>
                  <button className="btn ghost" onClick={() => setOptimizing(null)}>Cancel</button>
                </div>
              </>
            )}
          </div>
        )}
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
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !optimizing) submit();
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
              <div className="ideas">
                <button className="btn ghost" aria-haspopup="menu" aria-expanded={ideas} onClick={() => setIdeas((o) => !o)}>
                  Prompt ideas
                </button>
                {ideas && (
                  <div className="ideas-pop" role="menu" onKeyDown={(e) => e.key === "Escape" && setIdeas(false)}>
                    {PROMPT_IDEAS.map((g) => (
                      <div key={g.group} role="group" aria-label={g.group}>
                        <div className="micro ideas-group">{g.group}</div>
                        {g.ideas.map((idea) => (
                          <button key={idea} role="menuitem" className="ideas-item" onClick={() => fill(idea)}>
                            {idea}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <input ref={fileInput} type="file" multiple hidden accept={ATTACH_EXTENSIONS.map((e) => `.${e}`).join(",")} onChange={(e) => void attach(e.target.files)} />
              <button className="btn" disabled={running} onClick={openLibrary} title="Reuse a file you uploaded in any chat">
                From uploads
              </button>
              <button className="btn" disabled={running || files.length >= ATTACH_MAX_FILES} onClick={() => fileInput.current?.click()} title="PDF, JPEG, PNG, Word, Excel, PowerPoint, CSV, text, Markdown or JSON, up to 4 MB each. Kept in Uploads for other chats.">
                Attach files
              </button>
              <button className="btn primary" disabled={!prompt.trim() || running || reading > 0 || Boolean(optimizing)} onClick={() => submit()}>
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

function RunView({ run, onStop, onRegenerate }: { run: Run; onStop: () => void; onRegenerate?: () => void }) {
  const [source, setSource] = useState<Run["sources"][number] | null>(null);
  const work = summariseWork(run);
  const status = runStatus(run);
  // The research engine's gates, run on the finished answer against the run's source register.
  const gates = run.state !== "running" && run.tier && run.text.trim() ? evidenceGates(run.text, run.sources, run.tier) : [];
  const openGates = gates.filter((g) => !g.pass);
  const stage = useStageOpen(run.state === "running");
  // Every specialist, shown as a card of key points once its workstream is finished.
  const lanes = run.laneOrder.map((id) => run.lanes[id]).filter(Boolean);
  const running = run.state === "running";
  const [promptOpen, setPromptOpen] = useState(false);
  const longPrompt = run.prompt.length > 110 || run.prompt.includes("\n");
  const [tab, setTab] = useState<"sum" | "spec" | "steps" | "src">("sum");
  // The full answer or a full section opens in a panel over the run instead of making the page longer.
  const [sheet, setSheet] = useState<{ title: string; text: string; visuals?: boolean } | null>(null);
  const shortAnswer = run.text.length <= SHORT_ANSWER;
  const points = shortAnswer ? [] : keyPoints(run.text, 5);
  const stepCount = runSteps(run).length;
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
          <span className={promptOpen ? "" : "clamp"}>{run.prompt}</span>
          {longPrompt && (
            <button className="link-btn" aria-expanded={promptOpen} onClick={() => setPromptOpen((o) => !o)}>
              {promptOpen ? "Show less" : "Show more"}
            </button>
          )}
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
        {(run.state === "running" || work.specialists > 0 || work.toolCalls > 0 || run.tier) && (
          <div className="work-strip" role="status">
            {run.state === "running" ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <span className="dot done" />}
            <span className="work-text">{workLine(work, run.state === "running")}</span>
            {run.tier && (
              <span className={`work-evidence ${openGates.length ? "bad" : ""}`} title={openGates.length ? openGates.map((g) => `${g.id} ${g.name}: ${g.detail}`).join("\n") : "All evidence gates passed"}>
                {run.tier} · {run.sources.length} source{run.sources.length === 1 ? "" : "s"}
                {gates.length ? ` · ${gates.length - openGates.length}/${gates.length} gates` : ""}
              </span>
            )}
            <button className="btn ghost sm stage-toggle" aria-expanded={stage.open} onClick={stage.toggle}>
              {stage.open ? "Hide agents" : "Show agents"}
            </button>
          </div>
        )}
        {(stage.open || (running && lanes.length > 0)) && (
          <div className={`run-live${stage.open && running && lanes.length ? " split" : ""}`}>
            {stage.open && <AgentStage run={run} gates={gates.length ? { passed: gates.length - openGates.length, total: gates.length } : undefined} />}
            {running && lanes.length > 0 && <SectionCards lanes={lanes} onOpen={(l) => setSheet({ title: l.name, text: l.text })} />}
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
        {running ? (
          <p className="muted run-wait">
            <span className="spinner" /> {lanes.length ? "Rudra is writing the summary. It shows here when it is finished." : "Rudra is working. The answer shows here when it is finished."}
            {stepCount > 0 && ` · ${stepCount} steps`}
          </p>
        ) : (
          <>
            {(lanes.length > 0 || stepCount > 0 || run.sources.length > 0) && (
              <div className="run-tabs" role="tablist">
                <button role="tab" aria-selected={tab === "sum"} onClick={() => setTab("sum")}>Summary</button>
                {lanes.length > 0 && <button role="tab" aria-selected={tab === "spec"} onClick={() => setTab("spec")}>Specialists ({lanes.length})</button>}
                {stepCount > 0 && <button role="tab" aria-selected={tab === "steps"} onClick={() => setTab("steps")}>Steps ({stepCount})</button>}
                {run.sources.length > 0 && <button role="tab" aria-selected={tab === "src"} onClick={() => setTab("src")}>Sources ({run.sources.length})</button>}
              </div>
            )}
            {tab === "sum" && (
              <>
                <div className="answer">
                  {shortAnswer ? (
                    run.text && <Markdown text={run.text} />
                  ) : (
                    <div className="key-points">
                      <div className="micro">Key points</div>
                      <ul>
                        {points.map((p, i) => (
                          <li key={i}>{p}</li>
                        ))}
                      </ul>
                      <button className="link-btn" onClick={() => setSheet({ title: "Full answer", text: run.text, visuals: true })}>
                        Read the full answer
                      </button>
                    </div>
                  )}
                </div>
                {shortAnswer && <RunVisuals run={run} />}
                <FileCards run={run} />
                {run.text.trim() && (
                  <div className="answer-foot">
                    <button className="btn ghost sm" onClick={() => void navigator.clipboard?.writeText(run.text).then(() => toast("Answer copied"), () => toast("Copy failed", "error"))}>
                      Copy
                    </button>
                    {onRegenerate && (
                      <button className="btn ghost sm" title="Send the same message again with the same scope" onClick={onRegenerate}>
                        Regenerate
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
            {tab === "spec" && <SectionCards lanes={lanes} wide onOpen={(l) => setSheet({ title: l.name, text: l.text })} />}
            {tab === "steps" && <Steps run={run} />}
            {tab === "src" && (
              <div className="source-chips" aria-label="Sources">
                {run.sources.map((src) => (
                  <button key={src.key} className="chip click" title={src.title} onClick={() => setSource(src)}>
                    {src.key} · {src.publisher || src.title.slice(0, 30)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {sheet && (
        <>
          <div className="drawer-backdrop" onClick={() => setSheet(null)} />
          <div className="run-sheet" role="dialog" aria-label={sheet.title} onKeyDown={(e) => e.key === "Escape" && setSheet(null)}>
            <div className="drawer-head">
              <span className="micro">{sheet.title}</span>
              <button className="btn ghost sm" autoFocus onClick={() => setSheet(null)}>Close</button>
            </div>
            <Markdown text={sheet.text} />
            {sheet.visuals && <RunVisuals run={run} />}
          </div>
        </>
      )}
      {source && (
        <>
          <div className="drawer-backdrop" onClick={() => setSource(null)} />
          <aside className="drawer source-drawer" role="dialog" aria-label={`Source ${source.key}`} onKeyDown={(e) => e.key === "Escape" && setSource(null)}>
            <div className="drawer-head">
              <span className="micro">Source {source.key}</span>
              <button className="btn ghost sm" autoFocus onClick={() => setSource(null)}>Close</button>
            </div>
            <h2 className="page-title">{source.title}</h2>
            <dl className="source-meta">
              <dt>Publisher</dt><dd>{source.publisher || "Not given"}</dd>
              <dt>Date</dt><dd>{source.date || "Not given"}</dd>
              <dt>Type</dt><dd>{source.type}</dd>
              <dt>Authority</dt><dd>{source.authority} of 10</dd>
            </dl>
            {source.url && (
              <a className="btn" href={source.url} target="_blank" rel="noopener noreferrer">Open the source</a>
            )}
          </aside>
        </>
      )}
    </section>
  );
}

const STAGE_PREF = "volt.agentStage";

/**
 * Whether the Agent Stage shows under a run: open while the run works (unless the user hid it, which is remembered),
 * folded 2.5 s after it finishes, and closed for runs loaded from history until the user opens it.
 */
function useStageOpen(running: boolean): { open: boolean; toggle: () => void } {
  const pref = () => {
    try {
      return localStorage.getItem(STAGE_PREF) !== "off";
    } catch {
      return true;
    }
  };
  const [open, setOpen] = useState(() => running && pref());
  const wasRunning = useRef(running);
  useEffect(() => {
    if (running) {
      wasRunning.current = true;
      return;
    }
    if (!wasRunning.current) return;
    const t = setTimeout(() => {
      wasRunning.current = false;
      setOpen(false);
    }, 2500);
    return () => clearTimeout(t);
  }, [running]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (running)
      try {
        localStorage.setItem(STAGE_PREF, next ? "on" : "off");
      } catch {
        /* storage blocked: the choice lasts for this run only */
      }
  };
  return { open, toggle };
}

/** What the run did: each specialist and each tool call, in order. */
function runSteps(run: Run) {
  const lanes = run.laneOrder.map((id) => run.lanes[id]).filter(Boolean);
  return [
    ...run.activity.filter((a) => a.kind !== "status").map((a) => ({ id: a.id, who: "Lead", text: a.text, detail: a.detail, bad: !!a.isError, pending: !!a.pending })),
    ...lanes.flatMap((l) => [
      { id: l.id, who: l.name, text: l.state === "running" ? "working" : l.state === "failed" ? "failed" : "finished its workstream", detail: l.brief, bad: l.state === "failed", pending: l.state === "running" },
      ...l.activity.filter((a) => a.kind === "tool" || a.isError).map((a) => ({ id: `${l.id}:${a.id}`, who: l.name, text: a.text, detail: a.detail, bad: !!a.isError, pending: !!a.pending })),
    ]),
  ];
}

/** The Steps tab: the run's timeline as a numbered list. */
function Steps({ run }: { run: Run }) {
  const steps = runSteps(run);
  if (!steps.length) return null;
  return (
    <div className="steps">
      <ol>
        {steps.map((st) => (
          <li key={st.id} className={st.bad ? "bad" : st.pending ? "pending" : ""}>
            <b>{st.who}</b> {st.text}
            {st.detail && <span className="muted"> · {st.detail.slice(0, 140)}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

const CARD_COLORS = ["#00e5ff", "#e879f9", "#60a5fa", "#34d399"];

/** One card per specialist: three key points cut from its own section (no model call), the full text a click away. */
function SectionCards({ lanes, onOpen, wide }: { lanes: Lane[]; onOpen: (l: Lane) => void; wide?: boolean }) {
  return (
    <div className={`section-cards${wide ? " wide" : ""}`}>
      {lanes.map((l, i) => {
        const pts = l.state === "done" ? keyPoints(l.text, 3) : [];
        return (
          <div key={l.id} className={`section-card ${l.state}`} style={{ ["--c" as string]: CARD_COLORS[i % CARD_COLORS.length] }}>
            <b>
              <i aria-hidden="true" />
              {l.name}
            </b>
            <ul>
              {l.state === "running" ? <li>Still working</li> : l.state === "failed" ? <li>Failed</li> : pts.length ? pts.map((p, k) => <li key={k}>{p}</li>) : <li>No notes</li>}
            </ul>
            {l.state === "done" && l.text.trim() && (
              <button className="link-btn" onClick={() => onOpen(l)}>
                Read full section
              </button>
            )}
          </div>
        );
      })}
    </div>
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
