import { confirmDialog, toast } from "./ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogResponse, RunKind, RunRequest } from "../shared/events";
import { fetchCatalog, fetchMe, listTemplates, listUploads, signOut, streamRun, UnauthorizedError, type AuthMode } from "./api";
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
import { ReferenceNav, isReferenceView, referenceDefault, type ReferenceView } from "./components/ReferenceNav";
import { Services } from "./components/Services";
import { Analytics } from "./components/Analytics";
import { Health } from "./components/Health";
import { Templates } from "./components/Templates";
import { TemplateContext } from "./exports";
import { nextVersion } from "./versions";
import { cad, chatUsage, modelName, setUsdCadRate, usageTotals } from "./usage";
import { Icon, Ring } from "./components/Icon";
import { setupProgress, setupSteps } from "./setup";
import { kpiScorecard } from "./charts/results";
import { errText } from "./netGuard";

export type View = "console" | "workflows" | ReferenceView | "services" | "templates" | "analytics" | "health" | "history" | "usage" | "uploads" | "ledger" | "projects" | "diagrams";
type RailView = Exclude<View, ReferenceView> | "reference";

export function App() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">(() => (localStorage.getItem("volt.theme") === "light" ? "light" : "dark"));
  const [present, setPresent] = useState(() => localStorage.getItem("volt.present") === "on");
  // Set during render, so charts drawn in this same render pick the matching palette (see screenPalette).
  document.documentElement.dataset.theme = theme;
  useEffect(() => {
    document.documentElement.dataset.present = present ? "on" : "off";
    localStorage.setItem("volt.theme", theme);
    localStorage.setItem("volt.present", present ? "on" : "off");
  }, [theme, present]);
  const [uploadCount, setUploadCount] = useState(0);
  const [bannerOff, setBannerOff] = useState(() => sessionStorage.getItem("volt.banner") === "off");
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("token");
  const [me, setMe] = useState<string | null>(null);
  const [view, setView] = useState<View>("console");
  const [runs, setRuns] = useState<Run[]>([]);
  const [history, setHistory] = useState<Run[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState(() => loadActiveProject());
  const [target, setTarget] = useState<string>("rudra");
  const [forceDemo, setForceDemo] = useState(false);
  /** "Opus" switch: every step of the next runs on Opus, and the chat stays there (see server/router.ts). */
  const [forceOpus, setForceOpus] = useState(false);
  const [review, setReview] = useState(false);
  // The top bar's Settings menu closes on a click outside it or on Escape.
  const settings = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const el = settings.current;
      if (el?.open && (e.type === "keydown" ? (e as KeyboardEvent).key === "Escape" : !el.contains(e.target as Node))) el.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  /** Which provider the specialist workstreams run on; the lead stays on Claude. */
  const [engine, setEngine] = useState<"claude" | "auto" | "gpt" | "grok">(() => (localStorage.getItem("volt.engine") as "claude" | "auto" | "gpt" | "grok") || "claude");
  useEffect(() => localStorage.setItem("volt.engine", engine), [engine]);
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [activeTemplate, setActiveTemplate] = useState("");
  const sessions = useRef(new Map<string, string>());
  const controllers = useRef(new Map<string, AbortController>());

  const load = useCallback(() => {
    setLoadError("");
    setNeedsSignIn(false);
    void fetchMe().then((m) => setMe(m.username), () => setMe(null));
    fetchCatalog().then((c) => (setUsdCadRate(c.fx), setCatalog(c)), (e) => (e instanceof UnauthorizedError ? (setAuthMode(e.auth), setNeedsSignIn(true)) : setLoadError(errText(e))));
    listTemplates().then(setTemplates, () => setTemplates([]));
    // Chats saved in this browser by earlier versions move to the server once, then the project list loads.
    void migrateBrowserHistory()
      .catch(() => 0)
      .then(listProjects)
      .then(setProjects, () => setProjects([]));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!catalog) return;
    listUploads().then((u) => setUploadCount(u.length), () => setUploadCount(0));
  }, [catalog, projectId, view]);
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
      setRuns((rs) => [...rs, { ...run, version: nextVersion(rs, req.prompt) }]);
      setView("console");
      const update = (fn: (r: Run) => Run) => setRuns((rs) => rs.map((r) => (r.id === run.id ? fn(r) : r)));
      try {
        for await (const e of streamRun({ ...req, projectId, sessionId: sessions.current.get(sessionKey), demo: forceDemo || undefined, opus: forceOpus || undefined, review: review || undefined, engine: engine !== "claude" ? engine : undefined, templateId: activeTemplate || undefined }, controller.signal)) {
          if (e.type === "done") {
            sessions.current.set(sessionKey, e.sessionId);
            // Follow-ups to Rudra continue from a finished workflow's synthesis.
            if (req.workflowId) sessions.current.set("rudra", e.sessionId);
          }
          update((r) => applyEvent(r, e));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          update((r) => applyEvent(r, { type: "error", lane: "rudra", message: errText(err) }));
        }
        update((r) => ({ ...r, state: controller.signal.aborted ? "stopped" : "done", finishedAt: Date.now() }));
      } finally {
        controllers.current.delete(run.id);
      }
    },
    [forceDemo, forceOpus, review, activeTemplate, projectId, catalog],
  );

  const openRun = (run: Run) => {
    saved.current.set(run.id, `${run.state}:${run.text.length}:${run.finishedAt ?? 0}`);
    setRuns((rs) => (rs.some((r) => r.id === run.id) ? rs : [...rs, run]));
    setView("console");
  };

  /** A new chat: the screen is cleared and the next question starts a fresh conversation. Earlier chats stay in History. */
  const newChat = async (): Promise<boolean> => {
    const working = runs.some((r) => r.state === "running");
    if (working && !(await confirmDialog("A run is still working. Stop it and start a new chat?", "Stop and start"))) return false;
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
        return void toast(e instanceof Error ? e.message : String(e), "error");
      }
    }
    if (id === projectId || !(await newChat())) return;
    setActiveProject(id);
    setProjectId(id);
  };

  const stop = (runId: string) => {
    controllers.current.get(runId)?.abort();
    setRuns((rs) => rs.map((r) => (r.id === runId ? { ...r, state: "stopped", finishedAt: Date.now() } : r)));
  };

  if (needsSignIn) return <SignIn mode={authMode} onSignedIn={load} />;
  if (loadError) return <div className="empty">Could not load the VOLT catalog: {loadError}</div>;
  if (!catalog)
    return (
      <div className="skeleton-page" role="status" aria-label="Loading VOLT capabilities">
        <div className="skeleton" style={{ height: 36, width: 220 }} />
        <div className="skeleton" style={{ height: 18, width: "60%" }} />
        <div className="skeleton-grid">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="skeleton" style={{ height: 96 }} />
          ))}
        </div>
      </div>
    );

  const live = catalog.mode === "live" && !forceDemo;
  const memoryCount = projects.find((p) => p.id === projectId)?.memory.length ?? 0;
  const steps = setupSteps({ uploads: uploadCount, memory: memoryCount, templates: templates.length, chats: history.length + runs.length });
  const progress = setupProgress(steps);
  const spend = usageTotals(chatUsage([...history, ...runs.filter((r) => !history.some((h) => h.id === r.id))])).cost;
  const missing = catalog.health.missingSkills.length;
  // [view, rail label, full name, count shown in the tooltip]
  const activeRail: RailView = isReferenceView(view) ? "reference" : view==="diagrams" ? "workflows" : view;
  const nav: [RailView, string, string, number | string][] = [
    ["console", "Console", "Agent Console", runs.length || ""],
    ["workflows", "Workflows", "Workflows", catalog.workflows.length],
    ["reference", "Reference", "Reference", ""],
    ["services", "Services", "Services", catalog.services.length],
    ["templates", "Templates", "Templates", templates.length || ""],
    ["analytics", "Analytics", "Analytics", catalog.benchmarks.length],
    ["projects", "Memory", "Project memory", memoryCount || ""],
    ["history", "Chats", "Chats", history.length || ""],
    ["uploads", "Knowledge", "Knowledge base", uploadCount || ""],
    ["ledger", "Ledger", "Ledger review", ""],
    ["usage", "Usage", "Token usage", ""],
    ["health", "Health", "Capability Health", missing],
  ];
  const banner = !present && !bannerOff ? (!live ? { text: "VOLT is in demo mode: routing is real, the written analysis is simulated.", cta: "", go: undefined } : null) : null;

  return (
    <div className="app">
      <header className="topbar">
        {banner && (
          <div className="banner" role="status">
            <Icon name="warn" size={16} />
            <span>{banner.text}</span>
            {banner.go && (
              <button className="btn dark sm" onClick={banner.go}>
                {banner.cta}
              </button>
            )}
            <button className="banner-x" aria-label="Dismiss" onClick={() => (sessionStorage.setItem("volt.banner", "off"), setBannerOff(true))}>
              ×
            </button>
          </div>
        )}
        <div className="brand">
          <img className="brand-mark" src="/brand/volt-mark.png" alt="VOLT" />
        </div>
        <div className="pills">
          <span className="pill admin-only" title="Estimated spend on the chats saved in this project and this session, at list price">
            <Icon name="coin" size={16} /> {cad(spend)}
          </span>
          {progress.done < progress.total && (
            <button className="pill" title="Setup progress: open the checklist" onClick={() => (setView("console"), window.dispatchEvent(new Event("volt:setup-open")))}>
              <Ring done={progress.done} total={progress.total} /> ({progress.done}/{progress.total})
            </button>
          )}
          <button className="pill icon plus" aria-label="New chat" title="New chat" onClick={newChat}>
            <Icon name="plus" size={18} />
          </button>
        </div>
        <span className="usage" title={live && catalog.routing ? `VOLT picks the model for each step: Haiku triages, Sonnet answers quick asks and specialist work, Opus leads deliverables. Each answer shows the models that ran it.` : undefined}>
          {live ? (catalog.routing ? "Auto" : modelName(catalog.model)) : "offline simulator"}
        </span>
        <details className="settings-menu admin-only" ref={settings}>
          <summary className="btn ghost sm" aria-label="Run settings">Settings</summary>
          <div className="settings-pop" role="group" aria-label="Run settings">
            <div className="row"><span className={`badge ${live ? "live" : ""}`}>{live ? "Live" : "Demo"}</span><span className="muted" style={{ fontSize: "var(--fs-3)" }}>Default model: {catalog.model}</span></div>
            {catalog.mode === "live" && (
              <label className="row body">
                <input type="checkbox" checked={forceDemo} onChange={(e) => setForceDemo(e.target.checked)} /> Demo mode (simulated answers, no model spend)
              </label>
            )}
            {live && (
              <label className="row body" title="A chat that has used Opus stays on Opus.">
                <input type="checkbox" checked={forceOpus} onChange={(e) => setForceOpus(e.target.checked)} /> Run every step on Opus
              </label>
            )}
            {live && (
              <label className="row body" title="A separate reviewer model checks the answer against your request and hands back gaps. At most three hand-backs, then it stops and says what is left.">
                <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} /> Independent review (max 3 rounds)
              </label>
            )}
            {live && (catalog.engines?.gpt || catalog.engines?.grok) && (
              <label className="row body" title="Which provider runs the specialist workstreams. The lead and high-stakes finance work stay on Claude.">
                Specialists
                <select className="select" value={engine} onChange={(e) => setEngine(e.target.value as typeof engine)}>
                  <option value="claude">Claude</option>
                  <option value="auto">Auto (best across)</option>
                  {catalog.engines?.gpt && <option value="gpt">GPT</option>}
                  {catalog.engines?.grok && <option value="grok">Grok</option>}
                </select>
              </label>
            )}
          </div>
        </details>
        <label className="row body template-pick" style={{ fontSize: "var(--fs-3)" }}>
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
        <label className="row body template-pick" style={{ fontSize: "var(--fs-3)" }}>
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
        <button className="btn ghost sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} title="Switch between the dark and light theme" aria-pressed={theme === "light"}>
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <button className="btn ghost sm" onClick={() => setPresent(!present)} title="Hide cost, tokens, model names and admin screens before showing the console to a client" aria-pressed={present}>
          {present ? "Exit presentation" : "Present"}
        </button>
      </header>
      <nav className="nav rail" aria-label="Main">
        {nav.filter(([id]) => !(present && (id === "usage" || id === "health" || id === "ledger"))).map(([id, label, full, count]) => (
          <div key={id} style={{ display: "contents" }}>
            {(id === "workflows" || id === "history") && <div className="sep" />}
            <button className={activeRail === id ? "active" : ""} aria-current={activeRail === id ? "page" : undefined} onClick={() => setView(id === "reference" ? referenceDefault : id)} title={id === "health" && missing > 0 ? `${missing} skills referenced by agents are missing from this build` : count !== "" ? `${full} (${count})` : full} aria-label={id === "health" && missing > 0 ? `${full}: ${missing} missing skills` : full}>
              <span className="rail-icon">
                <Icon name={id} />
                {id === "health" && missing > 0 && <span className="rail-badge count" aria-hidden="true">{missing > 99 ? "99+" : missing}</span>}
              </span>
              <span className="rail-label">{label}</span>
            </button>
          </div>
        ))}
        <div className="rail-foot">
          <div className="rail-mode" title={live ? "Connected to the live models" : "Demo mode: routing is real, the written analysis is simulated"}>
            <strong>{live ? "Live" : "Demo"}</strong>
            <span>mode</span>
          </div>
          <button onClick={() => { setView("console"); localStorage.setItem("volt.setup.open", "yes"); window.dispatchEvent(new Event("volt:setup-open")); }} title="Help: reopen the Get started checklist" aria-label="Help: reopen the Get started checklist">
            <span className="rail-icon"><Icon name="help" />{steps.some((s) => !s.done) && <span className="rail-badge blue" />}</span>
            <span className="rail-label">Help</span>
          </button>
          {me ? (
            <button className="rail-avatar" title={`Signed in as ${me}. Click to sign out.`} aria-label={`Signed in as ${me}. Sign out`} onClick={async () => {
              if (!(await confirmDialog(`Sign out ${me}?`, "Sign out"))) return;
              await signOut();
              load();
            }}>
              <span aria-hidden="true" style={{ fontWeight: 700 }}>{me.slice(0, 1).toUpperCase()}</span>
              <span className="presence" />
            </button>
          ) : (
            <div className="rail-avatar" title="Signed in" aria-label="Signed in">
              <Icon name="user" size={18} />
              <span className="presence" />
            </div>
          )}
        </div>
      </nav>
      <TemplateContext.Provider value={activeTemplate}>
      <main className="main">
        {view === "console" && (
          <Console setup={steps} onNavigate={(v) => setView(v as View)} recent={history.slice(0, 3)} onOpenRecent={openRun} catalog={catalog} runs={runs} target={target} setTarget={setTarget} live={live} onStart={start} onStop={stop} onOpenAgent={setOpenAgent} userName={me} />
        )}
        {(view === "workflows" || view === "diagrams") && <Workflows key={projectId} projectId={projectId} openStudio={view==="diagrams"} catalog={catalog} live={live} onLaunch={start} onOpenAgent={setOpenAgent} />}
        {isReferenceView(view) && <ReferenceNav view={view} onSelect={setView} />}
        {view === "agents" && <Agents catalog={catalog} onOpen={setOpenAgent} />}
        {view === "skills" && <SkillFinder catalog={catalog} onOpenAgent={setOpenAgent} />}
        {view === "services" && <Services catalog={catalog} live={live} onOpenAgent={setOpenAgent} onLaunch={start} />}
        {view === "templates" && <Templates templates={templates} refresh={refreshTemplates} activeTemplate={activeTemplate} setActiveTemplate={setActiveTemplate} />}
        {view === "analytics" && <Analytics catalog={catalog} />}
        {view === "history" && (
          <History
            projectId={projectId}
            projectName={projects.find((p) => p.id === projectId)?.name ?? "General"}
            history={history}
            onOpen={openRun}
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
