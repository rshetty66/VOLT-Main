import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogResponse, RunKind, RunRequest } from "../shared/events";
import type { Engagement, RunSummary } from "../shared/records";
import { fetchCatalog, listEngagements, streamRun } from "./api";
import { applyEvent, newRun, type Run } from "./runState";
import { Console } from "./components/Console";
import { Workflows } from "./components/Workflows";
import { Agents, AgentDrawer } from "./components/Agents";
import { SkillFinder } from "./components/SkillFinder";
import { Services } from "./components/Services";
import { Analytics } from "./components/Analytics";
import { Health } from "./components/Health";
import { Engagements } from "./components/Engagements";

const ENGAGEMENT_KEY = "volt.engagementId";
const readStored = () => {
  try {
    return localStorage.getItem(ENGAGEMENT_KEY) ?? "";
  } catch {
    return "";
  }
};

export type View = "console" | "engagements" | "workflows" | "agents" | "skills" | "services" | "analytics" | "health";

export function App() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<View>("console");
  const [runs, setRuns] = useState<Run[]>([]);
  const [target, setTarget] = useState<string>("rudra");
  const [forceDemo, setForceDemo] = useState(false);
  const [openAgent, setOpenAgent] = useState<string | null>(null);
  const sessions = useRef(new Map<string, string>());
  const controllers = useRef(new Map<string, AbortController>());
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [engagementId, setEngagementIdState] = useState<string>(readStored);

  const setEngagementId = useCallback((id: string) => {
    setEngagementIdState(id);
    try {
      localStorage.setItem(ENGAGEMENT_KEY, id);
    } catch {
      /* the choice just won't be remembered */
    }
  }, []);
  const refreshEngagements = useCallback(() => {
    listEngagements().then(setEngagements, () => {});
  }, []);

  useEffect(() => {
    fetchCatalog().then(setCatalog, (e) => setLoadError(String(e)));
    refreshEngagements();
  }, [refreshEngagements]);

  // Forget a remembered engagement that no longer exists.
  useEffect(() => {
    if (engagementId && engagements.length && !engagements.some((e) => e.id === engagementId)) setEngagementId("");
  }, [engagements, engagementId, setEngagementId]);

  const start = useCallback(
    async (req: RunRequest, title: string, kind: RunKind) => {
      const scope = engagementId || "none";
      const sessionKey = `${scope}:${req.workflowId ? `workflow:${crypto.randomUUID()}` : req.agentId && req.agentId !== "rudra" ? `agent:${req.agentId}` : "rudra"}`;
      const run = newRun(req.prompt, title, kind);
      const controller = new AbortController();
      controllers.current.set(run.id, controller);
      setRuns((rs) => [...rs, run]);
      setView("console");
      const update = (fn: (r: Run) => Run) => setRuns((rs) => rs.map((r) => (r.id === run.id ? fn(r) : r)));
      try {
        const body = { ...req, sessionId: sessions.current.get(sessionKey), demo: forceDemo || undefined, engagementId: engagementId || undefined };
        for await (const e of streamRun(body, controller.signal)) {
          if (e.type === "done") {
            sessions.current.set(sessionKey, e.sessionId);
            // Follow-ups to Rudra continue from a finished workflow's synthesis.
            if (req.workflowId) sessions.current.set(`${scope}:rudra`, e.sessionId);
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
        refreshEngagements();
      }
    },
    [forceDemo, engagementId, refreshEngagements],
  );

  /** Reopens a saved conversation: the next message to that agent continues it. */
  const continueRun = (run: RunSummary) => {
    const scope = run.engagementId ?? "none";
    const agentRun = run.kind === "agent" && run.agentId;
    sessions.current.set(`${scope}:${agentRun ? `agent:${run.agentId}` : "rudra"}`, run.sessionId);
    setEngagementId(run.engagementId ?? "");
    setTarget(agentRun ? run.agentId! : "rudra");
    setView("console");
  };

  const stop = (runId: string) => {
    controllers.current.get(runId)?.abort();
    setRuns((rs) => rs.map((r) => (r.id === runId ? { ...r, state: "stopped", finishedAt: Date.now() } : r)));
  };

  if (loadError) return <div className="empty">Could not load the VOLT catalog: {loadError}</div>;
  if (!catalog) return <div className="empty"><span className="spinner" /> Loading VOLT capabilities…</div>;

  const live = catalog.mode === "live" && !forceDemo;
  const nav: [View, string, number | string][] = [
    ["console", "Agent Console", runs.length || ""],
    ["engagements", "Engagements", engagements.length || ""],
    ["workflows", "Workflows", catalog.workflows.length],
    ["agents", "Agents", catalog.agents.length],
    ["skills", "Skill Finder", catalog.skills.length],
    ["services", "Services", catalog.services.length],
    ["analytics", "Analytics", catalog.benchmarks.length],
    ["health", "Capability Health", catalog.health.missingSkills.length],
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <b>VOLT</b>
          <span>Agentic Console · Vision, Orchestrate, Launch, Transform</span>
        </div>
        <select
          className="select"
          style={{ width: "auto", maxWidth: 280 }}
          aria-label="Current engagement"
          title="New runs are saved under this engagement"
          value={engagementId}
          onChange={(e) => (e.target.value === "__new" ? setView("engagements") : setEngagementId(e.target.value))}
        >
          <option value="">No engagement</option>
          {engagements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.clientName} - {e.title}
            </option>
          ))}
          <option value="__new">+ New engagement...</option>
        </select>
        <span className={`badge ${live ? "live" : ""}`}>{live ? "Live" : "Demo"}</span>
        <span className="usage">{live ? catalog.model : "offline simulator"}</span>
        {catalog.mode === "live" && (
          <label className="row body" style={{ fontSize: 12 }}>
            <input type="checkbox" checked={forceDemo} onChange={(e) => setForceDemo(e.target.checked)} /> demo
          </label>
        )}
        <span className="usage" title={catalog.source.ref}>
          {catalog.source.name}@{catalog.source.commit?.slice(0, 7)}
        </span>
      </header>
      <nav className="nav">
        {nav.map(([id, label, count], i) => (
          <div key={id} style={{ display: "contents" }}>
            {i === 2 && <div className="sep" />}
            <button className={view === id ? "active" : ""} onClick={() => setView(id)}>
              {label} <span className="count">{count}</span>
            </button>
          </div>
        ))}
      </nav>
      <main className="main">
        {view === "console" && (
          <Console catalog={catalog} runs={runs} target={target} setTarget={setTarget} live={live} onStart={start} onStop={stop} onOpenAgent={setOpenAgent} />
        )}
        {view === "engagements" && (
          <Engagements
            catalog={catalog}
            engagements={engagements}
            currentId={engagementId}
            onSelect={setEngagementId}
            onCreated={(e) => {
              setEngagementId(e.id);
              refreshEngagements();
            }}
            onContinue={continueRun}
            onOpenAgent={setOpenAgent}
          />
        )}
        {view === "workflows" && <Workflows catalog={catalog} onLaunch={start} onOpenAgent={setOpenAgent} />}
        {view === "agents" && <Agents catalog={catalog} onOpen={setOpenAgent} />}
        {view === "skills" && <SkillFinder catalog={catalog} onOpenAgent={setOpenAgent} />}
        {view === "services" && <Services catalog={catalog} onOpenAgent={setOpenAgent} onLaunch={start} />}
        {view === "analytics" && <Analytics catalog={catalog} />}
        {view === "health" && <Health catalog={catalog} onOpenAgent={setOpenAgent} />}
      </main>
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
