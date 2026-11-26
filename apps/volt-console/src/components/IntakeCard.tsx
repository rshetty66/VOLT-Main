import { useState } from "react";
import { BASES, CLIENT_TYPES, DELIVERABLES, DEPTHS, MAX_KPIS, MAX_OUTCOMES, OUTCOME_GROUPS, OUTCOMES, RECOMMEND, kpiLine, type Kpi, type Scope } from "../../shared/scope";
import { parseKpiList, suggestKpis, type KpiDef } from "../../shared/kpis";

const ROUNDS = ["The goal", "Measurable success", "What comes back"] as const;

/**
 * The intake: up to three short rounds (the goal, how success is measured, what VOLT hands back), then a one-card
 * brief. Nothing is preselected; most questions take several answers; every round can be skipped.
 */
export function IntakeCard({ draft, onChange, starting, onConfirm, onSkip }: { draft: Scope; onChange: (s: Scope) => void; starting: boolean; onConfirm: () => void; onSkip: () => void }) {
  const [round, setRound] = useState(starting ? 0 : 3);
  const [custom, setCustom] = useState("");
  const set = (patch: Partial<Scope>) => onChange({ ...draft, ...patch });
  const outcomes = draft.outcomes ?? [];
  const kpis = draft.kpis ?? [];

  const toggle = <T extends string>(list: T[] | undefined, key: T, max = Infinity): T[] => {
    const l = list ?? [];
    if (l.includes(key)) return l.filter((k) => k !== key);
    // "Not sure, recommend" stands alone: picking it clears the rest, and picking anything else clears it.
    if (key === RECOMMEND) return [key];
    const rest = l.filter((k) => k !== RECOMMEND);
    return rest.length < max ? [...rest, key] : rest;
  };
  const addKpis = (defs: (Pick<KpiDef, "id" | "name"> & Partial<KpiDef>)[]) => {
    const have = new Set(kpis.map((k) => k.id));
    const added = defs.filter((d) => !have.has(d.id)).map(({ id, name, unit, benchmark }): Kpi => ({ id, name, ...(unit ? { unit } : {}), ...(benchmark ? { benchmark } : {}) }));
    set({ kpis: [...kpis, ...added].slice(0, MAX_KPIS) });
  };
  const editKpi = (id: string, patch: Partial<Kpi>) => set({ kpis: kpis.map((k) => (k.id === id ? { ...k, ...patch } : k)) });
  const addCustom = () => {
    addKpis(parseKpiList(custom).map((name) => ({ id: `custom:${name.toLowerCase()}`, name })));
    setCustom("");
  };
  const suggested = suggestKpis(outcomes.filter((o) => o !== RECOMMEND));

  const chip = (on: boolean, label: string, onClick: () => void, rec = false) => (
    <button key={label} type="button" role="checkbox" aria-checked={on} className={`chip click intake-chip${on ? " on" : ""}${rec ? " rec" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
  const many = (labels: Record<string, string>, list: string[] | undefined, apply: (l: string[]) => void) =>
    Object.entries(labels).map(([k, label]) => chip(Boolean(list?.includes(k)), label, () => apply(toggle(list, k)), k === RECOMMEND));

  const header = round < 3 && (
    <div className="intake-step">
      <span className="intake-dots" aria-hidden="true">
        {ROUNDS.map((r, i) => (
          <i key={r} className={i < round ? "done" : i === round ? "on" : ""} />
        ))}
      </span>
      <span className="micro">
        Round {round + 1} of up to 3 · {ROUNDS[round]}
      </span>
    </div>
  );

  return (
    <div className="card intake-card" role="group" aria-labelledby="intake-title">
      {header}
      {round === 0 && (
        <>
          <h2 id="intake-title">What result do you want, and for whom?</h2>
          <p className="intake-why">Pick up to {MAX_OUTCOMES} outcomes. Nothing is preselected, so no default steers the answer.</p>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Outcome</b>
              <span>
                {outcomes.filter((o) => o !== RECOMMEND).length}/{MAX_OUTCOMES} chosen
              </span>
            </div>
            <div className="intake-groups">
              {OUTCOME_GROUPS.map((g) => (
                <div key={g.label} className="intake-group">
                  <div className="intake-gt">{g.label}</div>
                  <div className="intake-chips">{many(g.options, outcomes, (l) => set({ outcomes: l.slice(0, MAX_OUTCOMES) }))}</div>
                </div>
              ))}
            </div>
            <div className="intake-chips">{chip(outcomes.includes(RECOMMEND), OUTCOMES[RECOMMEND], () => set({ outcomes: toggle(outcomes, RECOMMEND) }), true)}</div>
          </div>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Client</b>
              <span>one</span>
            </div>
            <div className="intake-chips">{Object.entries(CLIENT_TYPES).map(([k, label]) => chip(draft.client_type === k, label, () => set({ client_type: draft.client_type === k ? undefined : k })))}</div>
          </div>
          <label className="intake-q">
            <div className="intake-ql">
              <b>What is not working today?</b>
              <span>optional, one line</span>
            </div>
            <input className="input" maxLength={300} value={draft.problem ?? ""} placeholder="For example: 11-day close, manual intercompany, late adjustments from three subledgers" onChange={(e) => set({ problem: e.target.value || undefined })} />
          </label>
        </>
      )}
      {round === 1 && (
        <>
          <h2 id="intake-title">How will you know it worked?</h2>
          <p className="intake-why">Tap several KPIs at once, or type your own. Leave a figure blank when it is unknown: VOLT says so instead of inventing one.</p>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Suggested KPIs</b>
              <button type="button" className="btn ghost sm" onClick={() => addKpis(suggested)}>
                Add all {suggested.length}
              </button>
            </div>
            <div className="intake-chips">
              {suggested.map((k) =>
                chip(
                  kpis.some((x) => x.id === k.id),
                  k.name,
                  () => (kpis.some((x) => x.id === k.id) ? set({ kpis: kpis.filter((x) => x.id !== k.id) }) : addKpis([k])),
                ),
              )}
            </div>
          </div>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Your own KPIs</b>
              <span>comma separated, adds several at once</span>
            </div>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <input className="input" value={custom} aria-label="Your own KPIs" placeholder="For example: Cost-to-income ratio, Days to sign off segment results" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())} />
              <button type="button" className="btn sm" disabled={!custom.trim()} onClick={addCustom}>
                Add
              </button>
            </div>
          </div>
          {kpis.length > 0 && (
            <div className="intake-q intake-table-wrap">
              <table className="intake-table">
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Today</th>
                    <th>Target</th>
                    <th>By</th>
                    <th>Benchmark</th>
                    <th aria-label="Remove" />
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((k) => (
                    <tr key={k.id}>
                      <td>
                        {k.name}
                        {k.unit && <div className="intake-unit">{k.unit}</div>}
                      </td>
                      {(["baseline", "target", "by"] as const).map((f) => (
                        <td key={f}>
                          <input className="input" maxLength={f === "by" ? 20 : 40} aria-label={`${k.name} ${f}`} placeholder={f === "by" ? "date" : "unknown"} value={k[f] ?? ""} onChange={(e) => editKpi(k.id, { [f]: e.target.value || undefined })} />
                        </td>
                      ))}
                      <td className={k.benchmark ? "intake-bm on" : "intake-bm"}>{k.benchmark ? "APQC built-in" : "tracked only"}</td>
                      <td>
                        <button type="button" className="btn ghost sm" aria-label={`Remove ${k.name}`} onClick={() => set({ kpis: kpis.filter((x) => x.id !== k.id) })}>
                          &times;
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {round === 2 && (
        <>
          <h2 id="intake-title">What should VOLT hand back?</h2>
          <p className="intake-why">Pick any that apply. A file or a deep dive runs on the strongest model.</p>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Reporting basis</b>
              <span>any</span>
            </div>
            <div className="intake-chips">{many(BASES, draft.basis, (l) => set({ basis: l }))}</div>
          </div>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Deliverable</b>
              <span>any</span>
            </div>
            <div className="intake-chips">{many(DELIVERABLES, draft.deliverables, (l) => set({ deliverables: l }))}</div>
          </div>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Depth</b>
              <span>one</span>
            </div>
            <div className="intake-chips">{Object.entries(DEPTHS).map(([k, label]) => chip(draft.depth === k, label, () => set({ depth: draft.depth === k ? undefined : k }), k === RECOMMEND))}</div>
          </div>
        </>
      )}
      {round === 3 && <Brief draft={draft} />}
      <div className="row intake-actions">
        <span className="intake-hint">{round === 1 ? `${kpis.length} KPI${kpis.length === 1 ? "" : "s"} chosen. You can skip this round.` : round === 0 ? "Only questions that change the answer are asked." : ""}</span>
        {round > 0 && round < 3 && (
          <button type="button" className="btn ghost" onClick={() => setRound(round - 1)}>
            Back
          </button>
        )}
        {round === 3 && (
          <button type="button" className="btn ghost" onClick={() => setRound(0)}>
            Edit
          </button>
        )}
        {(round === 0 || round === 3) && (
          <button type="button" className="btn ghost" onClick={onSkip}>
            {starting ? "Skip and send" : "Cancel"}
          </button>
        )}
        {round < 3 ? (
          <button type="button" className="btn primary" onClick={() => setRound(round + 1)}>
            {round === 2 ? "Review the brief" : `Next: ${ROUNDS[round + 1].toLowerCase()}`}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={onConfirm}>
            {starting ? "Start" : "Save scope"}
          </button>
        )}
      </div>
    </div>
  );
}

/** The answers as one brief: what VOLT will work to. */
function Brief({ draft }: { draft: Scope }) {
  const outcomes = (draft.outcomes ?? []).map((o) => OUTCOMES[o]).filter(Boolean);
  const rows: [string, string[]][] = [
    ["Problem", [draft.problem || "Not stated; VOLT takes it from your message"]],
    ["Success", draft.kpis?.length ? draft.kpis.map(kpiLine) : ["No KPIs chosen; VOLT proposes measures and marks them as suggestions"]],
    ["Basis", [(draft.basis ?? []).map((b) => BASES[b]).join(", ") || "Not set"]],
    ["Deliverable", [`${(draft.deliverables ?? []).map((d) => DELIVERABLES[d]).join(", ") || "Answer in chat"}${draft.depth ? ` · ${DEPTHS[draft.depth]}` : ""}`]],
  ];
  return (
    <>
      <div className="micro">Outcome brief · VOLT works to this</div>
      <h2 id="intake-title">
        {outcomes.join(" + ") || "No outcome set"}
        {draft.client_type ? ` · ${CLIENT_TYPES[draft.client_type]}` : ""}
      </h2>
      <dl className="intake-brief">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>
              {v.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
