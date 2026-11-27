import { useState, type ReactNode } from "react";
import { DELIVERABLES, MAX_KPIS, MAX_OUTCOMES, OUTCOME_GROUPS, OUTCOMES, RECOMMEND, CLIENT_TYPES, type Kpi, type Scope } from "../../shared/scope";
import { GOAL_TYPES, OTHER_GOAL, goalType } from "../../shared/goalTypes";
import { parseKpiList, suggestKpis, type KpiDef } from "../../shared/kpis";

/**
 * The intake, kept short: pick what the chat is for, answer up to two questions for that goal (each can be skipped),
 * and start. A question that takes several answers has Select all, and every question has Other for the client's own
 * words. Finance transformation adds its outcomes and an optional KPI step. "Skip all" sends the message with no
 * scope. Nothing is preselected, so no default steers the answer.
 */
export function IntakeCard({ draft, onChange, starting, onConfirm, onSkip }: { draft: Scope; onChange: (s: Scope) => void; starting: boolean; onConfirm: () => void; onSkip: () => void }) {
  const [step, setStep] = useState<"goal" | "kpis">("goal");
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const set = (patch: Partial<Scope>) => onChange({ ...draft, ...patch });
  const goal = goalType(draft.goal);
  const ft = draft.goal === "finance_transformation";
  const outcomes = draft.outcomes ?? [];
  const kpis = draft.kpis ?? [];
  const answers = draft.goal_answers ?? {};
  const other = draft.other ?? {};
  /** The scope with one Other answer set (a string, even empty, while its box is open) or removed (undefined). */
  const withOther = (key: string, v: string | undefined): Partial<Scope> => {
    const { [key]: _drop, ...rest } = other;
    return { other: v === undefined ? rest : { ...rest, [key]: v } };
  };

  const toggle = (list: string[] | undefined, key: string, multi: boolean, max = Infinity): string[] => {
    const l = list ?? [];
    if (l.includes(key)) return l.filter((k) => k !== key);
    if (!multi || key === RECOMMEND) return [key];
    const rest = l.filter((k) => k !== RECOMMEND);
    return rest.length < max ? [...rest, key] : rest;
  };
  const chip = (on: boolean, label: string, onClick: () => void, rec = false) => (
    <button key={label} type="button" role="checkbox" aria-checked={on} className={`chip click intake-chip${on ? " on" : ""}${rec ? " rec" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
  const skip = (key: string, clear: () => void) => {
    clear();
    setSkipped((s) => new Set(s).add(key));
  };
  const unskip = (key: string) => setSkipped((s) => { const n = new Set(s); n.delete(key); return n; });

  /** Select all / Clear for a question that takes several answers ("Not sure, recommend" is never part of all). */
  const selectAll = (label: string, picked: string[] | undefined, all: string[], pick: (l: string[] | undefined) => void) => {
    const on = all.length > 0 && all.every((k) => picked?.includes(k));
    return (
      <button type="button" className="btn ghost sm" aria-label={`${on ? "Clear" : "Select all"}: ${label}`} onClick={() => pick(on ? undefined : all)}>
        {on ? "Clear" : "Select all"}
      </button>
    );
  };
  /** The Other chip and, once picked, a one-line box for the client's own words. */
  const otherChip = (key: string, label: string, patchOn: Partial<Scope> = {}) => {
    const on = other[key] !== undefined;
    return (
      <>
        {chip(on, "Other", () => set(on ? withOther(key, undefined) : { ...patchOn, ...withOther(key, "") }))}
        {on && <input className="input intake-other" autoFocus maxLength={160} aria-label={`${label}: other`} placeholder="Say it in your own words" value={other[key]} onChange={(e) => set(withOther(key, e.target.value))} />}
      </>
    );
  };

  /** One question: its label, a Skip button, and its chips; once skipped, a single line with Undo. */
  const question = (key: string, label: string, note: string, body: ReactNode, clear: () => void, actions?: ReactNode) =>
    skipped.has(key) ? (
      <div key={key} className="intake-q intake-skipped">
        <span>{label}</span>
        <span className="muted">Skipped</span>
        <button type="button" className="btn ghost sm" onClick={() => unskip(key)}>Answer</button>
      </div>
    ) : (
      <div key={key} className="intake-q">
        <div className="intake-ql">
          <b>{label}</b>
          <span>{note}</span>
          <span className="intake-qa">
            {actions}
            <button type="button" className="btn ghost sm intake-skip" aria-label={`Skip: ${label}`} onClick={() => skip(key, clear)}>Skip</button>
          </span>
        </div>
        {body}
      </div>
    );

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
  const deliverables = question(
    "deliverables",
    "How should VOLT hand it back?",
    "pick any",
    <div className="intake-chips">{Object.entries(DELIVERABLES).map(([k, label]) => chip(Boolean(draft.deliverables?.includes(k)), label, () => set({ deliverables: toggle(draft.deliverables, k, true) })))}</div>,
    () => set({ deliverables: undefined }),
    selectAll("How should VOLT hand it back?", draft.deliverables, Object.keys(DELIVERABLES), (l) => set({ deliverables: l })),
  );

  return (
    <div className="card intake-card" role="group" aria-labelledby="intake-title">
      {step === "goal" && (
        <>
          <div className="intake-head">
            <h2 id="intake-title">What is this chat for?</h2>
            <span className="muted">A few taps, all optional</span>
          </div>
          <div className="intake-chips intake-goals" role="radiogroup" aria-label="Goal">
            {GOAL_TYPES.map((g) => (
              <button key={g.id} type="button" role="radio" aria-checked={draft.goal === g.id} title={g.hint} className={`chip click intake-chip${draft.goal === g.id ? " on" : ""}`} onClick={() => onChange(draft.goal === g.id ? {} : { goal: g.id, deliverables: draft.deliverables, ...(g.id === "other" ? { other: { [OTHER_GOAL]: "" } } : {}) })}>
                {g.label}
              </button>
            ))}
          </div>
          {ft && (
            <>
              {question(
                "outcomes",
                "Which outcomes matter most?",
                `pick up to ${MAX_OUTCOMES}`,
                <>
                  <div className="intake-groups">
                    {OUTCOME_GROUPS.map((g) => (
                      <div key={g.label} className="intake-group">
                        <div className="intake-gt">{g.label}</div>
                        <div className="intake-chips">{Object.entries(g.options).map(([k, label]) => chip(outcomes.includes(k), label, () => set({ outcomes: toggle(outcomes, k, true, MAX_OUTCOMES) })))}</div>
                      </div>
                    ))}
                  </div>
                  <div className="intake-chips">
                    {otherChip("outcomes", "Which outcomes matter most?", { outcomes: outcomes.filter((o) => o !== RECOMMEND) })}
                    {chip(outcomes.includes(RECOMMEND), OUTCOMES[RECOMMEND], () => set({ outcomes: toggle(outcomes, RECOMMEND, true), ...(outcomes.includes(RECOMMEND) ? {} : withOther("outcomes", undefined)) }), true)}
                  </div>
                </>,
                () => set({ outcomes: undefined, ...withOther("outcomes", undefined) }),
              )}
              {question(
                "client",
                "Who is the client?",
                "pick one",
                <div className="intake-chips">
                  {Object.entries(CLIENT_TYPES).map(([k, label]) => chip(draft.client_type === k, label, () => set({ client_type: draft.client_type === k ? undefined : k, ...withOther("client", undefined) })))}
                  {otherChip("client", "Who is the client?", { client_type: undefined })}
                </div>,
                () => set({ client_type: undefined, ...withOther("client", undefined) }),
              )}
            </>
          )}
          {draft.goal === "other" &&
            question(
              OTHER_GOAL,
              "What is this chat for?",
              "one line",
              <input className="input intake-other" maxLength={160} aria-label="What is this chat for?" placeholder="For example: a board paper on outsourcing the payables team" value={other[OTHER_GOAL] ?? ""} onChange={(e) => set(withOther(OTHER_GOAL, e.target.value))} />,
              () => set(withOther(OTHER_GOAL, undefined)),
            )}
          {goal?.questions.map((q) => {
            const pick = (l: string[] | undefined) => { const { [q.key]: _drop, ...rest } = answers; set({ goal_answers: l?.length ? { ...rest, [q.key]: l } : rest }); };
            const all = Object.keys(q.options).filter((k) => k !== RECOMMEND);
            const choose = (k: string) => {
              const next = toggle(answers[q.key], k, q.multi);
              const { [q.key]: _drop, ...rest } = answers;
              // A single answer, or "Not sure, recommend", replaces Other.
              set({ goal_answers: next.length ? { ...rest, [q.key]: next } : rest, ...(!q.multi || k === RECOMMEND ? withOther(q.key, undefined) : {}) });
            };
            return question(
              q.key,
              q.label,
              q.multi ? "pick any" : "pick one",
              <div className="intake-chips">
                {Object.entries(q.options).filter(([k]) => k !== RECOMMEND).map(([k, label]) => chip(Boolean(answers[q.key]?.includes(k)), label, () => choose(k)))}
                {otherChip(q.key, q.label, { goal_answers: (() => { const l = (answers[q.key] ?? []).filter((k) => q.multi && k !== RECOMMEND); const { [q.key]: _d, ...rest } = answers; return l.length ? { ...rest, [q.key]: l } : rest; })() })}
                {RECOMMEND in q.options && chip(Boolean(answers[q.key]?.includes(RECOMMEND)), q.options[RECOMMEND], () => choose(RECOMMEND), true)}
              </div>,
              () => { const { [q.key]: _d, ...rest } = answers; set({ goal_answers: rest, ...withOther(q.key, undefined) }); },
              q.multi ? selectAll(q.label, answers[q.key], all, pick) : undefined,
            );
          })}
          {goal && deliverables}
        </>
      )}
      {step === "kpis" && (
        <>
          <div className="intake-head">
            <h2 id="intake-title">How will you know it worked?</h2>
            <span className="muted">Optional. Blank figures stay unknown: VOLT never invents one.</span>
          </div>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Suggested KPIs</b>
              <button type="button" className="btn ghost sm" onClick={() => addKpis(suggested)}>
                Add all {suggested.length}
              </button>
            </div>
            <div className="intake-chips">{suggested.map((k) => chip(kpis.some((x) => x.id === k.id), k.name, () => (kpis.some((x) => x.id === k.id) ? set({ kpis: kpis.filter((x) => x.id !== k.id) }) : addKpis([k]))))}</div>
          </div>
          <div className="intake-q">
            <div className="intake-ql">
              <b>Your own KPIs</b>
              <span>comma separated</span>
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
      <div className="row intake-actions">
        <span className="intake-hint" />
        {step === "kpis" && (
          <button type="button" className="btn ghost" onClick={() => setStep("goal")}>
            Back
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onSkip}>
          {starting ? "Skip all and send" : "Cancel"}
        </button>
        {step === "goal" && ft && (
          <button type="button" className="btn" onClick={() => setStep("kpis")}>
            Add KPIs{kpis.length ? ` (${kpis.length})` : ""}
          </button>
        )}
        <button type="button" className="btn primary" onClick={onConfirm}>
          {starting ? "Start" : "Save scope"}
        </button>
      </div>
    </div>
  );
}
