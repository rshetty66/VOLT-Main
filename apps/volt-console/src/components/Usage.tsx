import { useEffect, useState } from "react";
import type { CostSettings, Price, UsageSummary } from "../../shared/records";
import { getCostSettings, getUsage, resetCostSettings, saveCostSettings, setUserBudget, type CostSettingsResponse } from "../api";
import { ktok, usd } from "../money";
import { useUser } from "../user";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const monthName = (ym: string) => new Date(`${ym}-01T12:00:00`).toLocaleString(undefined, { month: "short" });

/** Spend this month, by engagement and person, the costliest runs, and (for admins) budgets, models and prices. */
export function Usage({ live, onOpenRun }: { live: boolean; onOpenRun: (id: string) => void }) {
  const me = useUser();
  const admin = me?.role === "admin";
  const [data, setData] = useState<UsageSummary | null>(null);
  const [err, setErr] = useState("");
  const load = () => getUsage().then(setData, (e) => setErr(String(e)));
  useEffect(() => {
    void load();
  }, []);

  if (!data) return <div className="empty">{err || <><span className="spinner" /> Loading usage…</>}</div>;
  const b = data.budget;
  const share = b.monthlyBudgetUsd > 0 ? Math.min(1, b.monthSpentUsd / b.monthlyBudgetUsd) : 0;
  const peak = Math.max(0.01, ...data.byMonth.map((m) => m.usd));
  const months = lastSixMonths(data.month).map((m) => data.byMonth.find((x) => x.month === m) ?? { month: m, usd: 0, runs: 0 });

  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <div>
        <h1 className="page-title">Usage</h1>
        <p className="page-sub">
          Claude spend {data.scope === "everyone" ? "across everyone" : "on your runs"}, estimated from the price table: the API reports tokens, not dollars, so
          these are estimates, not an invoice.{!live && " The console is in demo mode, which costs nothing."}
        </p>
      </div>

      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="card stat">
          <span className="micro">This month{data.scope === "everyone" ? ", everyone" : ""}</span>
          <span className="v">{usd(data.monthTotalUsd)}</span>
          <span className="muted" style={{ fontSize: 12 }}>{data.monthRuns} live run{data.monthRuns === 1 ? "" : "s"}</span>
        </div>
        <div className="card stat">
          <span className="micro">Your monthly budget</span>
          <span className="v">{b.monthlyBudgetUsd > 0 ? usd(b.monthlyBudgetUsd) : "No limit"}</span>
          <span className="muted" style={{ fontSize: 12 }}>{usd(b.monthSpentUsd)} used{b.monthRemainingUsd !== null ? `, ${usd(b.monthRemainingUsd)} left` : ""}</span>
          {b.monthlyBudgetUsd > 0 && (
            <div className={`meter ${share >= b.warnAt ? "near" : ""}`}>
              <span style={{ width: `${share * 100}%` }} />
            </div>
          )}
        </div>
        <div className="card stat">
          <span className="micro">Per-run limit</span>
          <span className="v">{b.runBudgetUsd > 0 ? usd(b.runBudgetUsd) : "No limit"}</span>
          <span className="muted" style={{ fontSize: 12 }}>A run stops here; finished specialists are kept for Resume</span>
        </div>
        <div className="card stat">
          <span className="micro">Last six months</span>
          <div className="months" aria-label="Spend by month">
            {months.map((m) => (
              <div className="col" key={m.month} title={`${usd(m.usd)} · ${m.runs} runs`}>
                <div className="bar" style={{ height: `${(m.usd / peak) * 70}%` }} />
                <span>{monthName(m.month)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {err && <div className="card body">{err}</div>}

      {data.byEngagement.length > 0 && (
        <Section title="By engagement, this month">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Engagement</th>
                <th className="num">Runs</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.byEngagement.map((e) => (
                <tr key={e.engagementId ?? "none"}>
                  <td><b>{e.clientName}</b></td>
                  <td className="muted">{e.title || "-"}</td>
                  <td className="num">{e.runs}</td>
                  <td className="num">{usd(e.spentUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {admin && <People rows={data.byPerson} onChanged={load} onError={setErr} />}

      <Section title="Costliest runs this month">
        {data.topRuns.length === 0 ? (
          <div className="muted body" style={{ padding: 14 }}>No live runs this month yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Started</th>
                <th>Run</th>
                {admin && <th>Who</th>}
                <th>Status</th>
                <th className="num">Tokens in / out</th>
                <th className="num">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.topRuns.map((r) => (
                <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => onOpenRun(r.id)}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>{when(r.startedAt)}</td>
                  <td>
                    <b>{r.title}</b>
                    <div className="muted" style={{ fontSize: 12 }}>{r.clientName ?? "No engagement"}</div>
                  </td>
                  {admin && <td className="muted">{r.userName ?? "-"}</td>}
                  <td><span className="badge">{r.status}</span></td>
                  <td className="num muted" title={`${r.inputTokens.toLocaleString()} new · ${r.cacheWriteTokens.toLocaleString()} cache writes · ${r.cacheReadTokens.toLocaleString()} cache reads`}>
                    {ktok(r.inputTokens + r.cacheWriteTokens + r.cacheReadTokens)} / {ktok(r.outputTokens)}
                  </td>
                  <td className="num">{usd(r.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {admin && <CostSettingsPanel onSaved={load} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="micro">{title}</div>
      <div className="card table-wrap" style={{ padding: 0 }}>
        {children}
      </div>
    </div>
  );
}

function lastSixMonths(current: string): string[] {
  const [y, m] = current.split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (5 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/** Admin: spend and monthly budget per person. */
function People({ rows, onChanged, onError }: { rows: UsageSummary["byPerson"]; onChanged: () => void; onError: (e: string) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const save = (id: string, value: number | null) =>
    setUserBudget(id, value).then(
      () => {
        setDrafts(({ [id]: _, ...rest }) => rest);
        onError("");
        onChanged();
      },
      (e) => onError(e instanceof Error ? e.message : String(e)),
    );
  return (
    <Section title="By person, this month">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th className="num">Runs</th>
            <th className="num">Spent</th>
            <th>Monthly budget</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const draft = drafts[p.userId];
            const near = p.budgetUsd > 0 && p.spentUsd >= p.budgetUsd * 0.8;
            return (
              <tr key={p.userId}>
                <td>
                  <b>{p.name}</b>
                  {p.disabled && <span className="muted"> (disabled)</span>}
                  <div className="muted" style={{ fontSize: 12 }}>{p.email}</div>
                </td>
                <td className="num">{p.runs}</td>
                <td className="num" style={near ? { color: "var(--alert)" } : undefined}>{usd(p.spentUsd)}</td>
                <td>
                  <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <span className="muted">$</span>
                    <input
                      className="input num-in"
                      aria-label={`Monthly budget for ${p.name}`}
                      inputMode="decimal"
                      value={draft ?? String(p.budgetUsd)}
                      onChange={(e) => setDrafts({ ...drafts, [p.userId]: e.target.value })}
                    />
                    {p.ownBudget ? <span className="chip">own</span> : <span className="muted" style={{ fontSize: 12 }}>default</span>}
                  </span>
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {draft !== undefined && (
                    <button className="btn sm" disabled={!(Number(draft) >= 0) || draft.trim() === ""} onClick={() => save(p.userId, Number(draft))}>
                      Save
                    </button>
                  )}{" "}
                  {p.ownBudget && (
                    <button className="btn ghost sm" onClick={() => save(p.userId, null)}>
                      Use default
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="muted" style={{ fontSize: 12, padding: "8px 14px" }}>0 means no limit. A person with their own budget keeps it when the default changes.</div>
    </Section>
  );
}

const RATE_FIELDS: { key: keyof Price & ("input" | "cacheWrite" | "cacheRead" | "output"); label: string }[] = [
  { key: "input", label: "Input" },
  { key: "cacheWrite", label: "Cache write" },
  { key: "cacheRead", label: "Cache read" },
  { key: "output", label: "Output" },
];

/** Admin: run and monthly budgets, the warning point, specialist model and steps, and the price table. */
function CostSettingsPanel({ onSaved }: { onSaved: () => void }) {
  const [res, setRes] = useState<CostSettingsResponse | null>(null);
  const [form, setForm] = useState<CostSettings | null>(null);
  const [prices, setPrices] = useState<[string, Record<string, string>, Price][]>([]);
  const [newModel, setNewModel] = useState("");
  const [msg, setMsg] = useState("");
  const apply = (r: CostSettingsResponse) => {
    setRes(r);
    setForm(r.settings);
    setPrices(Object.entries(r.settings.prices).map(([m, p]) => [m, Object.fromEntries(RATE_FIELDS.map((f) => [f.key, String(p[f.key])])), p]));
  };
  useEffect(() => {
    getCostSettings().then(apply, (e) => setMsg(String(e)));
  }, []);
  if (!res || !form) return null;

  const done = (p: Promise<CostSettingsResponse>, note: string) =>
    p.then(
      (r) => {
        apply(r);
        setMsg(note);
        onSaved();
      },
      (e) => setMsg(e instanceof Error ? e.message : String(e)),
    );
  const num = (k: "runBudgetUsd" | "monthlyBudgetUsd" | "specialistMaxSteps", v: string) => setForm({ ...form, [k]: Number(v) });
  const priceTable = (): Record<string, Price> | null => {
    const out: Record<string, Price> = {};
    for (const [model, raw, original] of prices) {
      const rates = RATE_FIELDS.map((f) => Number(raw[f.key]));
      if (rates.some((r) => !(r >= 0) || Number.isNaN(r))) return null;
      // Long-prompt tiers are kept as they are; only the base rates are edited here.
      out[model] = { ...original, input: rates[0], cacheWrite: rates[1], cacheRead: rates[2], output: rates[3] };
    }
    return out;
  };
  const d = res.defaults;
  const models = prices.map(([m]) => m);

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="micro">Budgets and models (admin)</div>
      <div className="card stack">
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          <Field label="Per-run limit, USD" hint={`0 = no limit · default ${usd(d.runBudgetUsd)}`}>
            <input className="input" inputMode="decimal" value={form.runBudgetUsd} onChange={(e) => num("runBudgetUsd", e.target.value)} />
          </Field>
          <Field label="Monthly budget per person, USD" hint={`Default for people without their own · default ${usd(d.monthlyBudgetUsd)}`}>
            <input className="input" inputMode="decimal" value={form.monthlyBudgetUsd} onChange={(e) => num("monthlyBudgetUsd", e.target.value)} />
          </Field>
          <Field label="Warn at" hint="Share of a budget at which a run shows a warning">
            <select className="select" value={form.warnAt} onChange={(e) => setForm({ ...form, warnAt: Number(e.target.value) })}>
              {[0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95].map((v) => (
                <option key={v} value={v}>{Math.round(v * 100)}%</option>
              ))}
            </select>
          </Field>
          <Field label="Specialist model" hint={`Rudra and directly addressed agents use ${res.leadModel}`}>
            <select className="select" value={form.specialistModel} onChange={(e) => setForm({ ...form, specialistModel: e.target.value })}>
              {[...new Set([form.specialistModel, ...models])].map((m) => (
                <option key={m} value={m}>{m}{m === res.leadModel ? " (same as lead)" : ""}</option>
              ))}
            </select>
          </Field>
          <Field label="Specialist step limit" hint={`Model calls per specialist; the last is asked to answer · default ${d.specialistMaxSteps}`}>
            <input className="input" inputMode="numeric" value={form.specialistMaxSteps} onChange={(e) => num("specialistMaxSteps", e.target.value)} />
          </Field>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={() => done(resetCostSettings(["runBudgetUsd", "monthlyBudgetUsd", "warnAt", "specialistModel", "specialistMaxSteps"]), "Budgets and models are back to the defaults.")}>
            Reset to defaults
          </button>
          <button
            className="btn primary"
            onClick={() =>
              done(
                saveCostSettings({ runBudgetUsd: form.runBudgetUsd, monthlyBudgetUsd: form.monthlyBudgetUsd, warnAt: form.warnAt, specialistModel: form.specialistModel, specialistMaxSteps: form.specialistMaxSteps }),
                "Saved. New runs use these settings.",
              )
            }
          >
            Save budgets and models
          </button>
        </div>
      </div>

      <div className="micro" style={{ marginTop: 8 }}>Price table, USD per million tokens (admin)</div>
      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Model</th>
              {RATE_FIELDS.map((f) => (
                <th key={f.key} className="num">{f.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {prices.map(([model, raw, original], i) => (
              <tr key={model}>
                <td>
                  <code>{model}</code>
                  {original.long && original.longAbove && (
                    <div className="muted" style={{ fontSize: 11 }}>Higher rates above {ktok(original.longAbove)} prompt tokens are kept</div>
                  )}
                </td>
                {RATE_FIELDS.map((f) => (
                  <td key={f.key} className="num">
                    <input
                      className="input num-in"
                      aria-label={`${model} ${f.label}`}
                      inputMode="decimal"
                      value={raw[f.key]}
                      onChange={(e) => setPrices(prices.map((row, j) => (j === i ? [row[0], { ...row[1], [f.key]: e.target.value }, row[2]] : row)))}
                    />
                  </td>
                ))}
                <td>
                  <button className="btn ghost sm" disabled={model === res.leadModel || model === form.specialistModel || prices.length === 1} title="Models in use cannot be removed" onClick={() => setPrices(prices.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ padding: 12, justifyContent: "space-between" }}>
          <span className="row" style={{ gap: 6 }}>
            <input className="input" style={{ width: 220 }} placeholder="Add a model id, e.g. claude-…" value={newModel} onChange={(e) => setNewModel(e.target.value.trim().toLowerCase())} />
            <button
              className="btn sm"
              disabled={!/^[a-z0-9][a-z0-9.-]{1,80}$/.test(newModel) || models.includes(newModel)}
              onClick={() => {
                setPrices([...prices, [newModel, { input: "0", cacheWrite: "0", cacheRead: "0", output: "0" }, { input: 0, cacheWrite: 0, cacheRead: 0, output: 0 }]]);
                setNewModel("");
              }}
            >
              Add
            </button>
          </span>
          <span className="row" style={{ gap: 6 }}>
            <button className="btn ghost" onClick={() => done(resetCostSettings(["prices"]), "Prices are back to the list prices.")}>
              Reset to list prices
            </button>
            <button
              className="btn primary"
              onClick={() => {
                const table = priceTable();
                if (!table) return setMsg("Each price must be a number of dollars, 0 or more.");
                void done(saveCostSettings({ prices: table }), "Prices saved. Costs of new model calls use them; earlier runs keep their recorded cost.");
              }}
            >
              Save prices
            </button>
          </span>
        </div>
      </div>
      {msg && <div className="card body">{msg}</div>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="stack" style={{ gap: 6 }}>
      <span className="micro">{label}</span>
      {children}
      <span className="muted" style={{ fontSize: 11 }}>{hint}</span>
    </label>
  );
}
