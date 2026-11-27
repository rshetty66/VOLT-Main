import { useEffect, useState } from "react";
import { errText } from "../netGuard";
import { confirmDialog, toast } from "../ui";
import { bulkTargets, confidenceOf, filterQueue, type QueueFilter, type ReviewItem } from "../ledgerQueue";

const KIND: Record<ReviewItem["kind"], string> = {
  mapping: "Mapping", policy_gap: "Policy gap", allocation_rule: "Allocation rule",
  coa_design: "CoA design", coa_decision: "Design decision", coa_mapping: "Old-to-new mapping",
};
interface CoaDesign {
  design_id: string; version: number; name: string;
  decisions: { ref: string; topic: string; engagement_lead: string | null }[];
  mappings: { mapping_id: string }[];
  approved_by_lead: boolean; signed_off_by_client: boolean;
}
const EXPORTS = ["chart", "hierarchy", "mapping", "decisions"] as const;
const LINES = ["Retail", "Commercial", "Wealth", "Treasury", "CorporateCentre"];

function summary(i: ReviewItem): string {
  const p = i.proposal;
  if (i.kind === "coa_design") {
    const d = (p.design ?? {}) as { name?: string; accounts?: unknown[]; segments?: { name: string }[]; decisions?: unknown[] };
    return `${d.name ?? p.design_id} (version ${p.version}): ${d.accounts?.length ?? 0} accounts; segments ${(d.segments ?? []).map((x) => x.name).join(", ")}; ${d.decisions?.length ?? 0} decisions.`;
  }
  if (i.kind === "coa_decision") {
    const d = (p.decision ?? {}) as { topic?: string; choice?: string; rationale?: string; alternatives?: string[] };
    return `${d.topic}: ${d.choice}. ${d.rationale ?? ""}${d.alternatives?.length ? ` Alternatives: ${d.alternatives.join("; ")}.` : ""}`;
  }
  if (i.kind === "coa_mapping") return `${(p.rules as unknown[] | undefined)?.length ?? 0} rules mapping ${p.doc_id} to ${p.design_id} version ${p.version}.`;
  if (i.kind === "mapping") return `${p.account_id} → ${p.concept_id} (confidence ${p.confidence}). ${p.rationale ?? ""}`;
  if (i.kind === "policy_gap") return `${(p.element_ids as string[] | undefined)?.join(", ")}: ${p.gap_type}. Decision needed: ${p.decision_needed}`;
  const r = (p.rule ?? {}) as Record<string, unknown>;
  return `Split ${(r.pool_accounts as string[] | undefined)?.join(", ")} ${JSON.stringify(r.pool_filter)} by ${r.basis} across ${r.target_dimension}: ${(r.targets as string[] | undefined)?.join(", ")}. ${p.rationale ?? ""}`;
}

/** The VOLT Ledger review queue: the engagement lead approves the model's CoA designs, decisions, mappings, gaps and allocation rules here,
 * then the client signs off. Driver values for allocations are entered here too. The model can never do either. */
export function LedgerReview() {
  const [state, setState] = useState<{ enabled: boolean; reviewer?: string; items: ReviewItem[] } | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<QueueFilter>({ status: "open", kind: "", confidence: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [driver, setDriver] = useState({ key: "fte", period: new Date().toISOString().slice(0, 7), line: "Retail", value: "" });
  const [saved, setSaved] = useState("");
  const [designs, setDesigns] = useState<CoaDesign[]>([]);

  const load = () =>
    void fetch("/api/ledger/review")
      .then(async (r) => (r.ok ? setState(await r.json()) : setError((await r.json().catch(() => ({}))).error ?? `Could not load (${r.status})`)))
      .catch((e) => setError(errText(e)));
  useEffect(load, []);
  useEffect(() => {
    void fetch("/api/ledger/coa").then(async (r) => (r.ok ? setDesigns((await r.json()).designs ?? []) : undefined)).catch(() => undefined);
  }, [state]);

  // One decision through the same endpoint as before; the ledger service still refuses anything out of order.
  const post = async (item: ReviewItem, stage: "engagement_lead" | "client", decision: "approve" | "reject", note: string): Promise<string> => {
    const r = await fetch("/api/ledger/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: item.item_id, stage, decision, note }) });
    const body = await r.json().catch(() => ({}));
    return !r.ok || body.status === "refused" ? body.data?.message ?? body.error ?? `Not recorded (${r.status})` : "";
  };
  const decide = async (item: ReviewItem, stage: "engagement_lead" | "client", decision: "approve" | "reject") => {
    setError("");
    const note = decision === "reject" ? window.prompt("Why is this rejected?") ?? "" : "";
    const failed = await post(item, stage, decision, note);
    if (failed) setError(failed);
    load();
  };
  // Bulk decisions: confirm first, then one call per item, so the server-side approval gate applies to each.
  const decideMany = async (stage: "engagement_lead" | "client", decision: "approve" | "reject") => {
    const targets = bulkTargets(state?.items ?? [], selected, stage);
    if (!targets.length) return void toast(stage === "client" ? "None of the selected items is approved by the engagement lead yet." : "The selected items are already decided.", "error");
    const verb = stage === "client" ? "Record client sign-off for" : decision === "approve" ? "Approve" : "Reject";
    if (!(await confirmDialog(`${verb} ${targets.length} item${targets.length === 1 ? "" : "s"}?`, verb.split(" ")[0]))) return;
    const note = decision === "reject" ? window.prompt("Why are these rejected?") ?? "" : "";
    setBusy(true);
    setError("");
    const failures: string[] = [];
    for (const t of targets) {
      const failed = await post(t, stage, decision, note);
      if (failed) failures.push(`${t.item_id}: ${failed}`);
    }
    setBusy(false);
    setSelected(new Set());
    if (failures.length) setError(failures.join("\n"));
    else toast(`${targets.length} recorded`);
    load();
  };

  const saveDriver = async () => {
    setError("");
    setSaved("");
    const r = await fetch("/api/ledger/driver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: driver.key, period: driver.period, dimensions: { BusinessLine: driver.line }, value: driver.value.trim() }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body.status !== "ok") return void setError(body.data?.message ?? body.error ?? `Not saved (${r.status})`);
    setSaved(`Saved ${driver.key} ${driver.value} for ${driver.line}, ${driver.period}.`);
    setDriver((d) => ({ ...d, value: "" }));
  };

  if (!state) return <div className="card empty">{error || <><span className="spinner" /> Loading…</>}</div>;
  if (!state.enabled) return <div className="card empty">VOLT Ledger is not connected to this console. Set VOLT_LEDGER_URL (or deploy the volt-ledger service in render.yaml) and VOLT_LEDGER_TOKEN.</div>;

  const items = filterQueue(state.items, filter);
  const allOn = items.length > 0 && items.every((i) => selected.has(i.item_id));
  const pick = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Ledger review</h1>
        <p className="page-sub">
          The chart-of-accounts brain proposes; people decide. Approve or reject each CoA design, design decision, old-to-new mapping, account mapping, policy gap and allocation rule as engagement lead, then record the client's sign-off. Nothing reaches the client view before the engagement lead approves it. Signed in as {state.reviewer}.
        </p>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <strong>Chart-of-accounts designs</strong>
          <a className="btn ghost sm" href="/api/ledger/data-requirements/export" download>Data requirements for the bank pack's reference chart (CSV)</a>
        </div>
        {designs.length === 0 ? (
          <span className="muted">No design yet. Ask the Agent Console to diagnose a trial balance and design a target chart.</span>
        ) : (
          designs.map((d) => (
            <div key={d.design_id} className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <span>{d.name || d.design_id} <span className="micro">{d.design_id} · version {d.version}</span></span>
                <span className={`badge ${d.approved_by_lead ? "live" : ""}`}>
                  {d.signed_off_by_client ? "Signed off by client" : d.approved_by_lead ? "Approved by engagement lead" : `${d.decisions.filter((x) => x.engagement_lead !== "approve").length} decisions open`}
                </span>
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                {EXPORTS.filter((w) => w !== "mapping" || d.mappings.length > 0).map((w) => (
                  <a key={w} className="btn ghost sm" href={`/api/ledger/coa/export?design_id=${encodeURIComponent(d.design_id)}&what=${w}`} download>
                    Download {w} (CSV)
                  </a>
                ))}
                <a className="btn ghost sm" href={`/api/ledger/data-requirements/export?design_id=${encodeURIComponent(d.design_id)}`} download>
                  Download data requirements (CSV)
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <strong>Allocation drivers</strong>
        <span className="muted">Driver-based allocation splits a cost pool by these values. Enter them from HR or operations data; the model never estimates them.</span>
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <select className="select" style={{ width: "auto" }} value={driver.key} onChange={(e) => setDriver({ ...driver, key: e.target.value })} aria-label="Driver">
            <option value="fte">FTEs</option>
            <option value="transaction_count">Transaction count</option>
            <option value="rwa">RWA</option>
          </select>
          <input className="input" style={{ width: 110 }} value={driver.period} onChange={(e) => setDriver({ ...driver, period: e.target.value })} aria-label="Period (YYYY-MM)" />
          <select className="select" style={{ width: "auto" }} value={driver.line} onChange={(e) => setDriver({ ...driver, line: e.target.value })} aria-label="Business line">
            {LINES.map((l) => <option key={l}>{l}</option>)}
          </select>
          <input className="input num" style={{ width: 120 }} placeholder="Value" value={driver.value} onChange={(e) => setDriver({ ...driver, value: e.target.value })} aria-label="Value" />
          <button className="btn" disabled={!/^[0-9]+(\.[0-9]+)?$/.test(driver.value.trim())} onClick={() => void saveDriver()}>Save driver</button>
        </div>
        {saved && <span className="muted">{saved}</span>}
      </div>

      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
        <strong>{items.length} {filter.status === "open" ? "waiting for a decision" : "items"}</strong>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className={`btn sm ${filter.status === "open" ? "" : "ghost"}`} onClick={() => setFilter({ ...filter, status: "open" })}>Waiting</button>
          <button className={`btn sm ${filter.status === "all" ? "" : "ghost"}`} onClick={() => setFilter({ ...filter, status: "all" })}>All</button>
          <select className="select" style={{ width: "auto" }} aria-label="Filter by type" value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value as QueueFilter["kind"] })}>
            <option value="">All types</option>
            {Object.entries(KIND).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select className="select" style={{ width: "auto" }} aria-label="Filter by confidence" value={filter.confidence} onChange={(e) => setFilter({ ...filter, confidence: e.target.value as QueueFilter["confidence"] })}>
            <option value="">Any confidence</option>
            <option value="low">Below 70%</option>
            <option value="high">70% and above</option>
          </select>
        </div>
      </div>
      {items.length > 0 && (
        <div className="card row ledger-bulk" style={{ flexWrap: "wrap" }}>
          <label className="row body"><input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(items.map((i) => i.item_id)))} /> Select all shown</label>
          <span className="muted">{selected.size} selected</span>
          <button className="btn sm" disabled={busy || !selected.size} onClick={() => void decideMany("engagement_lead", "approve")}>Approve selected</button>
          <button className="btn ghost sm" disabled={busy || !selected.size} onClick={() => void decideMany("engagement_lead", "reject")}>Reject selected</button>
          <button className="btn ghost sm" disabled={busy || !selected.size} onClick={() => void decideMany("client", "approve")}>Record client sign-off</button>
          {busy && <span className="spinner" />}
        </div>
      )}
      {error && <div className="card" role="alert">{error}</div>}
      {items.length === 0 ? (
        <div className="card empty">Nothing waiting. Ask the Agent Console to map a trial balance or propose an allocation.</div>
      ) : (
        items.map((i) => (
          <div key={i.item_id} className="card stack" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="row" style={{ gap: 6 }}>
                <input type="checkbox" aria-label={`Select ${i.item_id}`} checked={selected.has(i.item_id)} onChange={() => pick(i.item_id)} />
                <span className="badge">{KIND[i.kind]}</span>
                <span className="micro">{i.item_id} · {i.ref_id} · {i.reason.replace(/_/g, " ")}</span>
              </div>
              {i.client_visible && <span className="badge live">Client visible</span>}
            </div>
            <div>{summary(i)}</div>
            {confidenceOf(i) !== undefined && (
              <div className="confidence" title="The model's confidence in this proposal">
                <i style={{ width: Math.round(confidenceOf(i)! * 120) }} className={confidenceOf(i)! < 0.7 ? "low" : ""} />
                <span>{Math.round(confidenceOf(i)! * 100)}% confidence</span>
              </div>
            )}
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {i.engagement_lead ? (
                <span className="micro">Engagement lead: {i.engagement_lead.decision} by {i.engagement_lead.by.replace(/^user:/, "")}{i.engagement_lead.note ? ` (${i.engagement_lead.note})` : ""}</span>
              ) : null}
              {i.client ? <span className="micro">Client: {i.client.decision} by {i.client.by.replace(/^user:/, "")}</span> : null}
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn sm" onClick={() => void decide(i, "engagement_lead", "approve")}>Approve as engagement lead</button>
              <button className="btn ghost sm" onClick={() => void decide(i, "engagement_lead", "reject")}>Reject</button>
              {i.engagement_lead?.decision === "approve" && (
                <button className="btn ghost sm" onClick={() => void decide(i, "client", "approve")}>Record client sign-off</button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
