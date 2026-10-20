import { useEffect, useState } from "react";
import type { CatalogResponse } from "../../shared/events";
import type { Engagement, RunSummary, StoredRun } from "../../shared/records";
import { createEngagement, getEngagementDetail, getStoredRun, runMarkdownUrl, stopRun, type EngagementDetail } from "../api";
import { replayRun } from "../runState";
import { RunView } from "./Console";

interface Props {
  catalog: CatalogResponse;
  engagements: Engagement[];
  currentId: string;
  onSelect: (id: string) => void;
  onCreated: (e: Engagement) => void;
  onContinue: (run: RunSummary) => void;
  onResume: (run: RunSummary) => void;
  onOpenAgent: (id: string) => void;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-");

export function Engagements({ catalog, engagements, currentId, onSelect, onCreated, onContinue, onResume, onOpenAgent }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  if (runId) return <SavedRun catalog={catalog} runId={runId} onBack={() => setRunId(null)} onContinue={onContinue} onResume={onResume} onOpenAgent={onOpenAgent} />;
  if (openId)
    return (
      <EngagementPage
        id={openId}
        isCurrent={openId === currentId}
        onSelect={() => onSelect(openId)}
        onBack={() => setOpenId(null)}
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
      <NewEngagement
        onCreated={(e) => {
          onCreated(e);
          setOpenId(e.id);
        }}
      />
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
                <th>Last run</th>
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
                  <td className="muted">{when(e.lastRunAt)}</td>
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

function NewEngagement({ onCreated }: { onCreated: (e: Engagement) => void }) {
  const [f, setF] = useState({ clientName: "", title: "", description: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = f.clientName.trim() && f.title.trim();
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      onCreated(await createEngagement({ clientName: f.clientName.trim(), title: f.title.trim(), description: f.description.trim() }));
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
        <span className="muted" style={{ fontSize: 12 }}>{err}</span>
        <button className="btn primary" disabled={!ready || busy} onClick={submit}>
          {busy ? "Creating..." : "Create engagement"}
        </button>
      </div>
    </div>
  );
}

function EngagementPage({ id, isCurrent, onSelect, onBack, onOpenRun }: { id: string; isCurrent: boolean; onSelect: () => void; onBack: () => void; onOpenRun: (id: string) => void }) {
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
              </p>
              {e.description && <p className="body" style={{ whiteSpace: "pre-wrap" }}>{e.description}</p>}
            </div>
            {isCurrent ? <span className="badge live">current engagement</span> : <button className="btn primary" onClick={onSelect}>File new runs here</button>}
          </div>
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
                    <th>Tokens in / out</th>
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
                      <td className="muted">{r.mode === "live" ? `${r.inputTokens.toLocaleString()} / ${r.outputTokens.toLocaleString()}` : "-"}</td>
                      <td>
                        <a className="btn sm" style={{ textDecoration: "none" }} href={runMarkdownUrl(r.id)} download onClick={(x) => x.stopPropagation()}>
                          Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
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
            {stored.kind === "workflow" && (stored.status === "stopped" || stored.status === "error") && (
              <button className="btn primary sm" title="Reuse the specialists that finished; run only the rest and the synthesis" onClick={() => onResume(stored)}>
                Resume
              </button>
            )}
            {stored.mode === "live" && stored.status === "done" && (
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
