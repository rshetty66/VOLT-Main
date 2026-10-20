import { useEffect, useState } from "react";
import type { CatalogResponse } from "../../shared/events";
import type { Engagement, RunSummary, StoredRun, Template } from "../../shared/records";
import { addMember, createEngagement, deleteEngagement, getEngagementDetail, setEngagementRetention, getStoredRun, listTemplates, listUsers, removeMember, setEngagementTemplate, stopRun, type EngagementDetail, type Member } from "../api";
import { usd } from "../money";
import { VIEW_ONLY, useCanWrite, useUser } from "../user";
import { Previews } from "./Templates";
import { ClientFiles } from "./ClientFiles";
import { replayRun } from "../runState";
import { ExportLinks, RunView } from "./Console";

interface Props {
  catalog: CatalogResponse;
  engagements: Engagement[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreated: (e: Engagement) => void;
  onDeleted: (id: string) => void;
  onContinue: (run: RunSummary) => void;
  onResume: (run: RunSummary) => void;
  onOpenAgent: (id: string) => void;
  /** Opens a saved run when set (from the Usage view); `n` makes repeat requests distinct. */
  openRun?: { id: string; n: number } | null;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-");

export function Engagements({ catalog, engagements, currentId, onSelect, onCreated, onDeleted, onContinue, onResume, onOpenAgent, openRun }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const canWrite = useCanWrite();
  useEffect(() => {
    listTemplates().then(setTemplates, () => {});
  }, []);
  useEffect(() => {
    if (openRun) setRunId(openRun.id);
  }, [openRun]);

  if (runId) return <SavedRun catalog={catalog} runId={runId} onBack={() => setRunId(null)} onContinue={onContinue} onResume={onResume} onOpenAgent={onOpenAgent} />;
  if (openId)
    return (
      <EngagementPage
        id={openId}
        isCurrent={openId === currentId}
        templates={templates}
        onSelect={() => onSelect(openId)}
        onBack={() => setOpenId(null)}
        onDeleted={() => {
          onDeleted(openId);
          setOpenId(null);
        }}
        onOpenRun={setRunId}
      />
    );

  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <div>
        <h1 className="page-title">Engagements</h1>
        <p className="page-sub">
          Every run is saved. Pick an engagement in the top bar and new runs are filed under it; open one here to reread past
          runs, download them for review, or continue a conversation.
        </p>
      </div>
      {canWrite ? (
        <NewEngagement
          templates={templates}
          onCreated={(e) => {
            onCreated(e);
            setOpenId(e.id);
          }}
        />
      ) : (
        <div className="card body">{VIEW_ONLY} Engagements shared with you are listed below.</div>
      )}
      {engagements.length === 0 ? (
        <div className="card muted">No engagements yet. Create one above.</div>
      ) : (
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Engagement</th>
                <th>Runs</th>
                <th>Cost</th>
                <th>Last run</th>
                <th>Owner</th>
                <th>Template</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {engagements.map((e) => (
                <tr key={e.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(e.id)}>
                  <td>
                    <b>{e.clientName}</b>
                  </td>
                  <td>{e.title}</td>
                  <td>{e.runCount}</td>
                  <td className="muted">{e.costUsd ? usd(e.costUsd) : "-"}</td>
                  <td className="muted">{when(e.lastRunAt)}</td>
                  <td className="muted">{e.ownerName ?? "-"}</td>
                  <td className="muted">{e.templateName ?? "VOLT standard"}</td>
                  <td>{e.id === currentId && <span className="badge live">current</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TemplatePicker({
  templates,
  value,
  onChange,
  label = "Output template",
  disabled = false,
}: {
  templates: Template[];
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className="row" style={{ gap: 6 }}>
      <span className="micro">{label}</span>
      <select className="select" style={{ width: "auto" }} aria-label={label} disabled={disabled} value={value ?? "standard"} onChange={(e) => onChange(e.target.value === "standard" ? null : e.target.value)}>
        {(templates.length ? templates : [{ id: "standard", name: "VOLT standard" } as Template]).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function NewEngagement({ templates, onCreated }: { templates: Template[]; onCreated: (e: Engagement) => void }) {
  const [f, setF] = useState({ clientName: "", title: "", description: "" });
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = f.clientName.trim() && f.title.trim();
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      onCreated(await createEngagement({ clientName: f.clientName.trim(), title: f.title.trim(), description: f.description.trim(), templateId }));
      setF({ clientName: "", title: "", description: "" });
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack">
      <div className="micro">New engagement</div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Client name" value={f.clientName} onChange={(e) => setF({ ...f, clientName: e.target.value })} />
        <input className="input" style={{ flex: 1, minWidth: 200 }} placeholder="Engagement title, e.g. Close optimization" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </div>
      <textarea className="textarea" rows={2} placeholder="Notes (optional): scope, sponsor, key facts" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <div className="row" style={{ justifyContent: "space-between" }}>
        <TemplatePicker templates={templates} value={templateId} onChange={setTemplateId} />
        <span className="muted" style={{ fontSize: 12 }}>{err}</span>
        <button className="btn primary" disabled={!ready || busy} onClick={submit}>
          {busy ? "Creating..." : "Create engagement"}
        </button>
      </div>
    </div>
  );
}

function EngagementPage({
  id,
  isCurrent,
  templates,
  onSelect,
  onBack,
  onDeleted,
  onOpenRun,
}: {
  id: string;
  isCurrent: boolean;
  templates: Template[];
  onSelect: () => void;
  onBack: () => void;
  onDeleted: () => void;
  onOpenRun: (id: string) => void;
}) {
  const [e, setE] = useState<EngagementDetail | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    getEngagementDetail(id).then(setE, (x) => setErr(String(x)));
  }, [id]);
  // While any run is still going on the server, refresh the list every few seconds.
  const anyRunning = e?.runs.some((r) => r.status === "running") ?? false;
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => getEngagementDetail(id).then(setE, () => {}), 4000);
    return () => clearInterval(t);
  }, [id, anyRunning]);

  return (
    <div className="stack" style={{ maxWidth: 1000 }}>
      <button className="btn ghost sm" style={{ alignSelf: "flex-start" }} onClick={onBack}>
        ← All engagements
      </button>
      {err && <div className="card">{err}</div>}
      {!e ? (
        !err && <div className="empty"><span className="spinner" /> Loading...</div>
      ) : (
        <>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 className="page-title">{e.clientName}</h1>
              <p className="page-sub">
                {e.title} · created {when(e.createdAt)}
                {e.costUsd > 0 && ` · ${usd(e.costUsd)} of Claude use so far`}
              </p>
              {e.description && <p className="body" style={{ whiteSpace: "pre-wrap" }}>{e.description}</p>}
              <div className="row" style={{ marginTop: 8 }}>
                <TemplatePicker
                  templates={templates}
                  disabled={e.access !== "write"}
                  value={e.templateId}
                  onChange={(templateId) =>
                    setEngagementTemplate(e.id, templateId).then(
                      (updated) => setE({ ...e, ...updated, runs: e.runs }),
                      (x) => setErr(String(x)),
                    )
                  }
                />
                <Previews id={e.templateId ?? "standard"} />
              </div>
              <p className="muted" style={{ fontSize: 12 }}>Word, Excel and PowerPoint downloads for this engagement use this template.</p>
              <People engagement={e} onChange={(members) => setE({ ...e, members })} onError={setErr} />
            </div>
            {e.access === "read" ? (
              <span className="badge">view only</span>
            ) : isCurrent ? (
              <span className="badge live">current engagement</span>
            ) : (
              <button className="btn primary" onClick={onSelect}>
                File new runs here
              </button>
            )}
          </div>
          <ClientFiles engagementId={e.id} canWrite={e.access === "write"} />
          <div className="micro" style={{ marginTop: 8 }}>Runs</div>
          {e.runs.length === 0 ? (
            <div className="card muted">No runs yet. Make this the current engagement, then run something from the Agent Console or Workflows.</div>
          ) : (
            <div className="card table-wrap" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Run</th>
                    <th>Status</th>
                    <th>Mode</th>
                    <th>Cost</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {e.runs.map((r) => (
                    <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => onOpenRun(r.id)}>
                      <td className="muted" style={{ whiteSpace: "nowrap" }}>{when(r.startedAt)}</td>
                      <td>
                        <b>{r.title}</b>
                        <div className="body" style={{ fontSize: 12 }}>{r.prompt.length > 140 ? `${r.prompt.slice(0, 140)}...` : r.prompt}</div>
                        {r.error && <div className="muted" style={{ fontSize: 12 }}>{r.error}</div>}
                      </td>
                      <td><span className="badge">{r.status}</span></td>
                      <td>{r.mode}</td>
                      <td
                        className="muted"
                        style={{ whiteSpace: "nowrap" }}
                        title={r.mode === "live" ? `Input ${r.inputTokens.toLocaleString()} new, ${r.cacheWriteTokens.toLocaleString()} cache writes, ${r.cacheReadTokens.toLocaleString()} cache reads · output ${r.outputTokens.toLocaleString()}` : undefined}
                      >
                        {r.mode === "live" ? usd(r.costUsd) : "-"}
                        {r.mode === "live" && r.cacheWriteTokens === 0 && r.costUsd > 0 && <span title="Saved before cache writes were recorded; slightly understated"> *</span>}
                      </td>
                      <td>
                        {r.status !== "running" && <ExportLinks runId={r.id} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DataControls engagement={e} onChange={(updated) => setE({ ...e, ...updated, runs: e.runs, members: e.members, access: e.access })} onDeleted={onDeleted} onError={setErr} />
        </>
      )}
    </div>
  );
}

const RETENTION: [number | null, string][] = [
  [null, "Keep until deleted"],
  [30, "30 days"],
  [90, "90 days"],
  [180, "180 days"],
  [365, "1 year"],
  [730, "2 years"],
];

/** How long the engagement's data is kept, and deleting it. Its owner and admins only. */
function DataControls({ engagement, onChange, onDeleted, onError }: { engagement: EngagementDetail; onChange: (e: Engagement) => void; onDeleted: () => void; onError: (msg: string) => void }) {
  const me = useUser();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  if (engagement.access !== "write" || !(me?.role === "admin" || engagement.ownerId === me?.id)) return null;
  const fail = (x: unknown) => onError(x instanceof Error ? x.message : String(x));
  const running = engagement.runs.some((r) => r.status === "running");
  return (
    <div className="card stack" style={{ marginTop: 8 }}>
      <div className="micro">Client data</div>
      <div className="row" style={{ gap: 8 }}>
        <label className="body" htmlFor="retention">Keep runs and client files for</label>
        <select
          id="retention"
          className="select"
          style={{ width: "auto" }}
          value={engagement.retentionDays ?? ""}
          onChange={(ev) => setEngagementRetention(engagement.id, ev.target.value ? Number(ev.target.value) : null).then(onChange, fail)}
        >
          {RETENTION.map(([days, label]) => (
            <option key={label} value={days ?? ""}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        With a period set, runs and client files older than it are deleted automatically (checked every few hours). Their cost still counts toward this month's budgets.
      </p>
      {!confirming ? (
        <button className="btn sm danger" style={{ alignSelf: "flex-start" }} onClick={() => setConfirming(true)}>
          Delete engagement
        </button>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          <p className="body" style={{ margin: 0 }}>
            This permanently deletes the engagement, its {engagement.runs.length} run(s), their outputs and its client files. Type <b>{engagement.clientName}</b> to confirm.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" style={{ maxWidth: 360 }} aria-label="Type the client name to confirm" value={typed} onChange={(ev) => setTyped(ev.target.value)} />
            <button
              className="btn sm danger"
              disabled={busy || running || typed.trim() !== engagement.clientName}
              title={running ? "A run is still going; stop it first." : undefined}
              onClick={() => {
                setBusy(true);
                deleteEngagement(engagement.id).then(onDeleted, (x) => {
                  setBusy(false);
                  fail(x);
                });
              }}
            >
              Delete permanently
            </button>
            <button className="btn sm ghost" onClick={() => (setConfirming(false), setTyped(""))}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SavedRun({
  catalog,
  runId,
  onBack,
  onContinue,
  onResume,
  onOpenAgent,
}: {
  catalog: CatalogResponse;
  runId: string;
  onBack: () => void;
  onContinue: (run: RunSummary) => void;
  onResume: (run: RunSummary) => void;
  onOpenAgent: (id: string) => void;
}) {
  const [stored, setStored] = useState<StoredRun | null>(null);
  const canWrite = useCanWrite();
  const [err, setErr] = useState("");
  const load = () => getStoredRun(runId).then(setStored, (x) => setErr(String(x)));
  useEffect(() => {
    load();
  }, [runId]);
  // A run still going on the server is saved as it goes: reload it every few seconds until it ends.
  const running = stored?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [runId, running]);

  return (
    <div className="console">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost sm" onClick={onBack}>
          ← Back to engagement
        </button>
        {stored && (
          <div className="row">
            {canWrite && stored.kind === "workflow" && (stored.status === "stopped" || stored.status === "error") && (
              <button className="btn primary sm" title="Reuse the specialists that finished; run only the rest and the synthesis" onClick={() => onResume(stored)}>
                Resume
              </button>
            )}
            {canWrite && stored.mode === "live" && stored.status === "done" && (
              <button className="btn sm" onClick={() => onContinue(stored)}>
                Continue this conversation
              </button>
            )}
          </div>
        )}
      </div>
      {err && <div className="card">{err}</div>}
      {stored?.error && <div className="card body">This run ended with a problem: {stored.error}</div>}
      {running && <div className="card body">Still running on the server. This page updates every few seconds; you can leave and come back.</div>}
      {!stored ? !err && <div className="empty"><span className="spinner" /> Loading...</div> : <RunView run={replayRun(stored)} catalog={catalog} onStop={() => void stopRun(stored.id).then(load)} onOpenAgent={onOpenAgent} />}
    </div>
  );
}

/** Owner and members: who can see this engagement. The owner and admins add or remove members. */
function People({ engagement, onChange, onError }: { engagement: EngagementDetail; onChange: (members: Member[]) => void; onError: (msg: string) => void }) {
  const me = useUser();
  const canManage = engagement.access === "write" && (me?.role === "admin" || engagement.ownerId === me?.id);
  const [directory, setDirectory] = useState<Member[]>([]);
  const [pick, setPick] = useState("");
  useEffect(() => {
    if (canManage) listUsers().then((u) => setDirectory(u.filter((x) => !x.disabled)), () => {});
  }, [canManage]);
  const candidates = directory.filter((u) => u.id !== engagement.ownerId && !engagement.members.some((m) => m.id === u.id));
  const run = (p: Promise<Member[]>) => p.then(onChange, (x) => onError(x instanceof Error ? x.message : String(x)));
  return (
    <div className="row" style={{ marginTop: 8, gap: 6 }}>
      <span className="micro">People</span>
      <span className="chip" title="Owner">
        {engagement.ownerName ?? "No owner"} (owner)
      </span>
      {engagement.members.map((m) => (
        <span key={m.id} className="chip" title={`${m.email}, ${m.role}`}>
          {m.name}
          {m.role === "viewer" ? " (viewer)" : ""}
          {canManage && (
            <button className="btn ghost sm" style={{ padding: "0 4px" }} aria-label={`Remove ${m.name}`} onClick={() => run(removeMember(engagement.id, m.id))}>
              x
            </button>
          )}
        </span>
      ))}
      {canManage && candidates.length > 0 && (
        <>
          <select className="select" style={{ width: "auto" }} aria-label="Add a person" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Add a person...</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>
          <button className="btn sm" disabled={!pick} onClick={() => run(addMember(engagement.id, pick)).then(() => setPick(""))}>
            Add
          </button>
        </>
      )}
    </div>
  );
}
