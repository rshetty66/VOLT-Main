import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogResponse, RunKind, RunRequest } from "../shared/events";
import { fetchCatalog, listTemplates, streamRun, UnauthorizedError } from "./api";
import { SignIn } from "./components/SignIn";
import { History } from "./components/History";
import { Uploads } from "./components/Uploads";
import { Usage } from "./components/Usage";
import { loadHistory, mergeHistory, saveHistory } from "./history";
import type { TemplateSummary } from "../shared/templates";
import { applyEvent, newRun, type Run } from "./runState";
import { Console } from "./components/Console";
import { Workflows } from "./components/Workflows";
import { Agents, AgentDrawer } from "./components/Agents";
import { SkillFinder } from "./components/SkillFinder";
import { Services } from "./components/Services";
import { Analytics } from "./components/Analytics";
import { Health } from "./components/Health";
import { Templates } from "./components/Templates";
import { Workbench } from "./components/workbench/Workbench";
import { TemplateContext } from "./exports";

export type View = "console" | "workflows" | "agents" | "skills" | "services" | "templates" | "analytics" | "finance" | "health" | "history" | "usage" | "uploads";

export function App() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [view, setView] = useState<View>("console");
  const [runs, setRuns] = useState<Run[]>([]);
  const [history, setHistory] = useState<Run[]>(() => loadHistory());
  const [target, setTarget] = useState<string>("rudra");
  const [forceDemo, setForceDemo] = useState(false);
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [activeTemplate, setActiveTemplate] = useState("");
  const sessions = useRef(new Map<string, string>());
  const controllers = useRef(new Map<string, AbortController>());

  const load = useCallback(() => {
    setLoadError("");
    setNeedsSignIn(false);
    fetchCatalog().then(setCatalog, (e) => (e instanceof UnauthorizedError ? setNeedsSignIn(true) : setLoadError(String(e))));
    listTemplates().then(setTemplates, () => setTemplates([]));
  }, []);
  useEffect(load, [load]);

  // Finished runs are saved in this browser so a reload does not lose the conversation.
  useEffect(() => {
    setHistory((h) => {
      const next = mergeHistory(h, runs);
      return next.length === h.length && next.every((r, i) => r === h[i]) ? h : next;
    });
  }, [runs]);
  useEffect(() => saveHistory(history), [history]);

  const refreshTemplates = useCallback(async () => {
    const list = await listTemplates();
    setTemplates(list);
    setActiveTemplate((id) => (list.some((t) => t.id === id) ? id : ""));
  }, []);

  const start = useCallback(
    async (req: RunRequest, title: string, kind: RunKind) => {
      const sessionKey = req.workflowId ? `workflow:${crypto.randomUUID()}` : req.agentId && req.agentId !== "rudra" ? `agent:${req.agentId}` : "rudra";
      const run = { ...newRun(req.prompt, title, kind), attachments: req.attachments?.map((a) => a.name) };
      const controller = new AbortController();
      controllers.current.set(run.id, controller);
      setRuns((rs) => [...rs, run]);
      setView("console");
      const update = (fn: (r: Run) => Run) => setRuns((rs) => rs.map((r) => (r.id === run.id ? fn(r) : r)));
      try {
        for await (const e of streamRun({ ...req, sessionId: sessions.current.get(sessionKey), demo: forceDemo || undefined, templateId: activeTemplate || undefined }, controller.signal)) {
          if (e.type === "done") {
            sessions.current.set(sessionKey, e.sessionId);
            // Follow-ups to Rudra continue from a finished workflow's synthesis.
            if (req.workflowId) sessions.current.set("rudra", e.sessionId);
          }
          update((r) => applyEvent(r, e));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          update((r) => applyEvent(r, { type: "error", lane: "rudra", message: String(err) }));
        }
        update((r) => ({ ...r, state: controller.signal.aborted ? "stopped" : "done", finishedAt: Date.now() }));
      } finally {
        controllers.current.delete(run.id);
      }
    },
    [forceDemo, activeTemplate],
  );

  /** A new chat: the screen is cleared and the next question starts a fresh conversation. Earlier chats stay in History. */
  const newChat = () => {
    const working = runs.some((r) => r.state === "running");
    if (working && !window.confirm("A run is still working. Stop it and start a new chat?")) return;
    controllers.current.forEach((c) => c.abort());
    sessions.current.clear();
    setRuns([]);
    setOpenAgent(null);
    setView("console");
  };

  const stop = (runId: string) => {
    controllers.current.get(runId)?.abort();
    setRuns((rs) => rs.map((r) => (r.id === runId ? { ...r, state: "stopped", finishedAt: Date.now() } : r)));
  };

  if (needsSignIn) return <SignIn onSignedIn={load} />;
  if (loadError) return <div className="empty">Could not load the VOLT catalog: {loadError}</div>;
  if (!catalog) return <div className="empty"><span className="spinner" /> Loading VOLT capabilities…</div>;

  const live = catalog.mode === "live" && !forceDemo;
  const nav: [View, string, number | string][] = [
    ["console", "Agent Console", runs.length || ""],
    ["workflows", "Workflows", catalog.workflows.length],
    ["agents", "Agents", catalog.agents.length],
    ["skills", "Skill Finder", catalog.skills.length],
    ["services", "Services", catalog.services.length],
    ["templates", "Templates", templates.length || ""],
    ["analytics", "Analytics", catalog.benchmarks.length],
    ["finance", "Finance Workbench", ""],
    ["history", "History", history.length || ""],
    ["uploads", "Uploads", ""],
    ["usage", "Token usage", ""],
    ["health", "Capability Health", catalog.health.missingSkills.length],
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-mark" src="/brand/volt-mark.png" alt="VOLT" />
          <span>Agentic Console · Vision, Orchestrate, Launch, Transform</span>
        </div>
        <span className={`badge ${live ? "live" : ""}`}>{live ? "Live" : "Demo"}</span>
        <span className="usage">{live ? catalog.model : "offline simulator"}</span>
        {catalog.mode === "live" && (
          <label className="row body" style={{ fontSize: 12 }}>
            <input type="checkbox" checked={forceDemo} onChange={(e) => setForceDemo(e.target.checked)} /> demo
          </label>
        )}
        <label className="row body template-pick" style={{ fontSize: 12 }}>
          Template
          <select className="select" value={activeTemplate} onChange={(e) => setActiveTemplate(e.target.value)}>
            <option value="">None</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.kind === "powerpoint" ? "PowerPoint" : t.kind === "excel" ? "Excel" : "Word"})
              </option>
            ))}
          </select>
        </label>
        <span className="usage" title={catalog.source.ref}>
          {catalog.source.name}@{catalog.source.commit?.slice(0, 7)}
        </span>
      </header>
      <nav className="nav">
        <button className="btn primary new-chat" onClick={newChat}>
          + New chat
        </button>
        {nav.map(([id, label, count], i) => (
          <div key={id} style={{ display: "contents" }}>
            {i === 1 && <div className="sep" />}
            <button className={view === id ? "active" : ""} onClick={() => setView(id)}>
              {label} <span className="count">{count}</span>
            </button>
          </div>
        ))}
      </nav>
      <TemplateContext.Provider value={activeTemplate}>
      <main className="main">
        {view === "console" && (
          <Console catalog={catalog} runs={runs} target={target} setTarget={setTarget} live={live} onStart={start} onStop={stop} onOpenAgent={setOpenAgent} />
        )}
        {view === "workflows" && <Workflows catalog={catalog} onLaunch={start} onOpenAgent={setOpenAgent} />}
        {view === "agents" && <Agents catalog={catalog} onOpen={setOpenAgent} />}
        {view === "skills" && <SkillFinder catalog={catalog} onOpenAgent={setOpenAgent} />}
        {view === "services" && <Services catalog={catalog} onOpenAgent={setOpenAgent} onLaunch={start} />}
        {view === "templates" && <Templates templates={templates} refresh={refreshTemplates} activeTemplate={activeTemplate} setActiveTemplate={setActiveTemplate} />}
        {view === "analytics" && <Analytics catalog={catalog} />}
        {view === "finance" && <Workbench live={live} />}
        {view === "history" && (
          <History
            history={history}
            onOpen={(run) => {
              setRuns((rs) => (rs.some((r) => r.id === run.id) ? rs : [...rs, run]));
              setView("console");
            }}
            onDelete={(id) => {
              setHistory((h) => h.filter((r) => r.id !== id));
              setRuns((rs) => rs.filter((r) => r.id !== id));
            }}
            onClear={() => {
              setHistory([]);
              setRuns((rs) => rs.filter((r) => r.state === "running"));
            }}
          />
        )}
        {view === "uploads" && <Uploads />}
        {view === "usage" && (
          <Usage
            history={history}
            onOpenChat={(chatRuns) => {
              setRuns((rs) => [...rs, ...chatRuns.filter((c) => !rs.some((r) => r.id === c.id))]);
              setView("console");
            }}
          />
        )}
        {view === "health" && <Health catalog={catalog} onOpenAgent={setOpenAgent} />}
      </main>
      </TemplateContext.Provider>
      {openAgent && (
        <AgentDrawer
          catalog={catalog}
          agentId={openAgent}
          onClose={() => setOpenAgent(null)}
          onChat={(id) => {
            setTarget(id);
            setOpenAgent(null);
            setView("console");
          }}
        />
      )}
    </div>
  );
}
