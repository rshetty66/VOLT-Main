import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogResponse, RunKind, RunRequest } from "../shared/events";
import { fetchCatalog, listTemplates, streamRun, UnauthorizedError } from "./api";
import { SignIn } from "./components/SignIn";
import { History } from "./components/History";
import { Uploads } from "./components/Uploads";
import { LedgerReview } from "./components/LedgerReview";
import { Usage } from "./components/Usage";
import { mergeHistory } from "./history";
import { Projects } from "./components/Projects";
import { setFileClient } from "./download";
import { createProject, listChats, listProjects, loadActiveProject, migrateBrowserHistory, saveChat, setActiveProject } from "./projects";
import type { Project } from "../shared/projects";
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
import { TemplateContext } from "./exports";
import { setUsdCadRate } from "./usage";
import { kpiScorecard } from "./charts/results";

export type View = "console" | "workflows" | "agents" | "skills" | "services" | "templates" | "analytics" | "health" | "history" | "usage" | "uploads" | "ledger" | "projects";

export function App() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [authMode, setAuthMode] = useState<"token" | "username">("token");
  const [view, setView] = useState<View>("console");
  const [runs, setRuns] = useState<Run[]>([]);
  const [history, setHistory] = useState<Run[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(() => loadActiveProject());
  const [target, setTarget] = useState<string>("rudra");
  const [forceDemo, setForceDemo] = useState(false);
  /** "Opus" switch: every step of the next runs on Opus, and the chat stays there (see server/router.ts). */
  const [forceOpus, setForceOpus] = useState(false);
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [activeTemplate, setActiveTemplate] = useState("");
  const sessions = useRef(new Map<string, string>());
  const controllers = useRef(new Map<string, AbortController>());

  const load = useCallback(() => {
    setLoadError("");
    setNeedsSignIn(false);
    fetchCatalog().then((c) => (setUsdCadRate(c.fx), setCatalog(c)), (e) => (e instanceof UnauthorizedError ? (setAuthMode(e.auth), setNeedsSignIn(true)) : setLoadError(String(e))));
    listTemplates().then(setTemplates, () => setTemplates([]));
    // Chats saved in this browser by earlier versions move to the server once, then the project list loads.
    void migrateBrowserHistory()
      .catch(() => 0)
      .then(listProjects)
      .then(setProjects, () => setProjects([]));
  }, []);
  useEffect(load, [load]);
  // Download names carry the project as the client (see the naming convention in shared/export.ts).
  useEffect(() => setFileClient(projects.find((p) => p.id === projectId)?.name ?? ""), [projects, projectId]);

  // "Save to memory" on an answer updates the project list (see RunView).
  useEffect(() => {
    const onProject = (e: Event) => {
      const p = (e as CustomEvent<Project>).detail;
      setProjects((ps) => ps.map((x) => (x.id === p.id ? p : x)));
    };
    window.addEventListener("volt:project", onProject);
    return () => window.removeEventListener("volt:project", onProject);
  }, []);

  // The active project's saved chats, from the server.
  const reloadHistory = useCallback(() => void listChats(projectId).then((cs) => setHistory(cs.map((c) => c.run)), () => setHistory([])), [projectId]);
  useEffect(() => {
    if (!needsSignIn) reloadHistory();
  }, [reloadHistory, needsSignIn]);

  // Each finished run is saved on the server in its project, so chats are kept for good and open on any device.
  const saved = useRef(new Map<string, string>());
  useEffect(() => {
    for (const r of runs) {
      if (r.state === "running" || !r.text.trim()) continue;
      const mark = `${r.state}:${r.text.length}:${r.finishedAt ?? 0}`;
      if (saved.current.get(r.id) === mark) continue;
      saved.current.set(r.id, mark);
      void saveChat(r).then((ok) => ok || saved.current.delete(r.id));
    }
    setHistory((h) => {
      const next = mergeHistory(h, runs.filter((r) => (r.projectId ?? projectId) === projectId), Infinity);
      return next.length === h.length && next.every((r, i) => r === h[i]) ? h : next;
    });
  }, [runs, projectId]);

  // After a deploy, the page still names the old asset files, which the server no longer has. When nothing is running
  // (finished chats are already saved in History), reload once to pick up the new version; otherwise the action that
  // needed the file reports it (see STALE_PAGE).
  const busy = useRef(false);
  busy.current = runs.some((r) => r.state === "running");
  useEffect(() => {
    const onStale = () => {
      if (busy.current) return;
      try {
        const last = Number(sessionStorage.getItem("volt.reloadedAt") ?? 0);
        if (Date.now() - last < 60_000) return;
        sessionStorage.setItem("volt.reloadedAt", String(Date.now()));
      } catch {
        return;
      }
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", onStale);
    return () => window.removeEventListener("vite:preloadError", onStale);
  }, []);

  const refreshTemplates = useCallback(async () => {
    const list = await listTemplates();
    setTemplates(list);
    setActiveTemplate((id) => (list.some((t) => t.id === id) ? id : ""));
  }, []);

  const start = useCallback(
    async (req: RunRequest, title: string, kind: RunKind) => {
      const sessionKey = req.workflowId ? `workflow:${crypto.randomUUID()}` : req.agentId && req.agentId !== "rudra" ? `agent:${req.agentId}` : "rudra";
      const run = { ...newRun(req.prompt, title, kind), attachments: req.attachments?.map((a) => a.name), scorecard: kpiScorecard(req.scope?.kpis, catalog?.benchmarks ?? []), projectId };
      const controller = new AbortController();
      controllers.current.set(run.id, controller);
      setRuns((rs) => [...rs, run]);
      setView("console");
      const update = (fn: (r: Run) => Run) => setRuns((rs) => rs.map((r) => (r.id === run.id ? fn(r) : r)));
      try {
        for await (const e of streamRun({ ...req, projectId, sessionId: sessions.current.get(sessionKey), demo: forceDemo || undefined, opus: forceOpus || undefined, templateId: activeTemplate || undefined }, controller.signal)) {
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
    [forceDemo, forceOpus, activeTemplate, projectId, catalog],
  );

  /** A new chat: the screen is cleared and the next question starts a fresh conversation. Earlier chats stay in History. */
  const newChat = () => {
    const working = runs.some((r) => r.state === "running");
    if (working && !window.confirm("A run is still working. Stop it and start a new chat?")) return false;
    controllers.current.forEach((c) => c.abort());
    sessions.current.clear();
    setRuns([]);
    setOpenAgent(null);
    setView("console");
    return true;
  };

  /** Switching project starts a new chat there, so one project's conversation never carries into another. */
  const switchProject = async (id: string) => {
    if (id === "new") {
      const name = window.prompt("Name of the new project (for example a client or an engagement)")?.trim();
      if (!name) return;
      try {
        const p = await createProject(name);
        setProjects((ps) => [...ps, p]);
        id = p.id;
      } catch (e) {
        return void window.alert(e instanceof Error ? e.message : String(e));
      }
    }
    if (id === projectId || !newChat()) return;
    setActiveProject(id);
    setProjectId(id);
  };

  const stop = (runId: string) => {
    controllers.current.get(runId)?.abort();
    setRuns((rs) => rs.map((r) => (r.id === runId ? { ...r, state: "stopped", finishedAt: Date.now() } : r)));
  };

  if (needsSignIn) return <SignIn mode={authMode} onSignedIn={load} />;
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
    ["projects", "Project memory", projects.find((p) => p.id === projectId)?.memory.length || ""],
    ["history", "Chats", history.length || ""],
    ["uploads", "Knowledge base", ""],
    ["ledger", "Ledger review", ""],
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
        <span className="usage" title={live && catalog.routing ? `VOLT picks the model for each step: Haiku triages, Sonnet answers quick asks and specialist work, Opus leads deliverables. Default tier: ${catalog.model}.` : undefined}>
          {live ? (catalog.routing ? "Auto" : catalog.model) : "offline simulator"}
        </span>
        {catalog.mode === "live" && (
          <label className="row body" style={{ fontSize: 12 }}>
            <input type="checkbox" checked={forceDemo} onChange={(e) => setForceDemo(e.target.checked)} /> demo
          </label>
        )}
        {live && (
          <label className="row body" style={{ fontSize: 12 }} title="Run every step on Opus instead of letting VOLT pick the model. A chat that has used Opus stays on Opus.">
            <input type="checkbox" checked={forceOpus} onChange={(e) => setForceOpus(e.target.checked)} /> Opus
          </label>
        )}
        <label className="row body template-pick" style={{ fontSize: 12 }}>
          Project
          <select className="select" value={projectId} onChange={(e) => void switchProject(e.target.value)}>
            {(projects.length ? projects : [{ id: projectId, name: "General" }]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            <option value="new">+ New project…</option>
          </select>
        </label>
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
      </header>
      <nav className="nav">
        <button className="btn primary new-chat" onClick={newChat}>
          + New chat
        </button>
        {nav.map(([id, label, count], i) => (
          <div key={id} style={{ display: "contents" }}>
            {i === 1 && <div className="sep" />}
            <button className={view === id ? "active" : ""} onClick={() => setView(id)}>
              {label}{" "}
              {id === "health" && Number(count) > 0 ? (
                <span className="count warn" title={`${count} skills are referenced by agents but not shipped in the package. Agents fall back to their system prompt for these.`}>
                  {count}
                </span>
              ) : (
                <span className="count">{count}</span>
              )}
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
        {view === "history" && (
          <History
            projectId={projectId}
            projectName={projects.find((p) => p.id === projectId)?.name ?? "General"}
            history={history}
            onOpen={(run) => {
              saved.current.set(run.id, `${run.state}:${run.text.length}:${run.finishedAt ?? 0}`);
              setRuns((rs) => (rs.some((r) => r.id === run.id) ? rs : [...rs, run]));
              setView("console");
            }}
            onDeleted={(id) => {
              setHistory((h) => h.filter((r) => r.id !== id));
              setRuns((rs) => rs.filter((r) => r.id !== id));
            }}
            onRestored={reloadHistory}
          />
        )}
        {view === "projects" && <Projects projects={projects} projectId={projectId} onChange={(p) => setProjects((ps) => ps.map((x) => (x.id === p.id ? p : x)))} />}
        {view === "uploads" && <Uploads key={projectId} projectName={projects.find((p) => p.id === projectId)?.name ?? "General"} />}
        {view === "ledger" && <LedgerReview />}
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
