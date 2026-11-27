import type { Run } from "../runState";
import { fxNote } from "../../shared/fx";
import { cad, usdCadRate, chatUsage, compact, costByDay, modelName, modelsLine, modelsOf, usageTotals, type ChatUsage } from "../usage";
import { useSort } from "../useSort";

interface Props {
  history: Run[];
  onOpenChat: (runs: Run[]) => void;
}

const n = (v: number) => v.toLocaleString();
const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const COLUMNS = {
  chat: (c: ChatUsage) => c.title.toLowerCase(),
  runs: (c: ChatUsage) => c.runs.length,
  input: (c: ChatUsage) => c.input,
  output: (c: ChatUsage) => c.output,
  cached: (c: ChatUsage) => c.cacheRead,
  total: (c: ChatUsage) => c.total,
  last: (c: ChatUsage) => c.lastAt,
};

/** Bars for the last 30 days with spend, in CAD at the live rate; the figure sits on each bar's tooltip. */
function CostOverTime({ history }: { history: Run[] }) {
  const days = costByDay(history).slice(-30);
  // Demo runs cost nothing: no chart until there is spend to show.
  if (!days.some((d) => d.cost > 0)) return null;
  const max = Math.max(...days.map((d) => d.cost));
  const w = 640;
  const h = 140;
  const bw = w / days.length;
  return (
    <figure className="card usage-chart">
      <figcaption className="micro">Estimated cost per day (CAD)</figcaption>
      <svg viewBox={`0 0 ${w} ${h + 18}`} role="img" aria-label={`Estimated cost per day for ${days.length} days`}>
        {days.map((d, i) => {
          const bh = Math.max(1, (d.cost / max) * h);
          return (
            <g key={d.day}>
              <rect className="bar" x={i * bw + 2} y={h - bh} width={Math.max(2, bw - 4)} height={bh} rx={2}>
                <title>{`${d.day}: ${cad(d.cost)} · ${compact(d.tokens)} tokens`}</title>
              </rect>
              {(i === 0 || i === days.length - 1) && <text x={i * bw + bw / 2} y={h + 14} textAnchor="middle">{d.day.slice(5)}</text>}
            </g>
          );
        })}
      </svg>
      <span className="muted">Peak {cad(max)} a day, at {fxNote(usdCadRate())}.</span>
    </figure>
  );
}

/** One bar per model, by estimated cost. */
function ByModel({ models }: { models: { model: string; tokens: number; cost: number }[] }) {
  if (!models.length) return null;
  const max = Math.max(...models.map((m) => m.cost), 1e-9);
  return (
    <figure className="card usage-chart">
      <figcaption className="micro">Cost by model (CAD)</figcaption>
      {models.map((m) => (
        <div key={m.model} className="usage-model">
          <span>{modelName(m.model)}</span>
          <span className="usage-bar"><i style={{ width: `${Math.max(2, (m.cost / max) * 100)}%` }} /><b>{cad(m.cost)}</b></span>
          <span className="muted num">{compact(m.tokens)} tokens</span>
        </div>
      ))}
    </figure>
  );
}

const secs = (r: Run) => Math.round(((r.finishedAt ?? r.startedAt) - r.startedAt) / 1000);

export function Usage({ history, onOpenChat }: Props) {
  const chats = chatUsage(history);
  const totals = usageTotals(chats);
  const max = Math.max(1, ...chats.map((c) => c.total));
  const { rows, header } = useSort<ChatUsage, keyof typeof COLUMNS>(chats, COLUMNS, { key: "last", dir: "desc" });
  const col = (key: keyof typeof COLUMNS, label: string, num = false) => {
    const h = header(key);
    return (
      <span className={num ? "num" : undefined}>
        <button type="button" className="sort-btn" aria-label={`Sort by ${label}${h["aria-sort"] === "none" ? "" : `, ${h["aria-sort"]}`}`} onClick={h.onClick}>{label}{h.marker}</button>
      </span>
    );
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Token usage</h1>
        <p className="page-sub">
          Tokens used by each chat, counted from the runs saved in this browser (the last 30; see History). Cost is an estimate at list price for the model that served each step; the Anthropic Console shows the actual bill.
        </p>
      </div>
      {chats.length === 0 ? (
        <div className="card empty">No usage yet. Finished runs appear here with their tokens.</div>
      ) : (
        <>
          <div className="stats">
            {[
              ["Chats", n(totals.chats)],
              ["Runs", n(totals.runs)],
              ["Input tokens", compact(totals.input)],
              ["Output tokens", compact(totals.output)],
              ["Cached input", compact(totals.cacheRead)],
              ["Input + output", compact(totals.total)],
              ["Est. cost (CAD)", cad(totals.cost)],
            ].map(([label, value]) => (
              <div key={label} className="card stat">
                <span className="micro">{label}</span>
                <span className="v">{value}</span>
              </div>
            ))}
          </div>

          <div className="usage-charts">
            <CostOverTime history={history} />
            <ByModel models={totals.models} />
          </div>
          {totals.models.length > 0 && (
            <p className="page-sub">
              By model: {totals.models.map((m) => `${modelName(m.model)} ${compact(m.tokens)} tokens, ${cad(m.cost)}`).join(" · ")}. Estimated at list price, at {fxNote(usdCadRate())}.
            </p>
          )}

          <div className="card usage-table">
            <div className="usage-head micro">
              {col("chat", "Chat")}
              {col("runs", "Runs", true)}
              {col("input", "Input", true)}
              {col("output", "Output", true)}
              {col("cached", "Cached", true)}
              {col("total", "Share of all tokens")}
            </div>
            {rows.map((c) => (
              <details key={c.id} className="usage-chat">
                <summary className="usage-row">
                  <span className="usage-title">
                    {c.title}
                    <small className="muted">
                      {when(c.startedAt)}
                      {c.demo ? " · demo (no tokens)" : c.cost > 0 ? ` · est. ${cad(c.cost)}` : ""}
                    </small>
                    {c.models.length > 0 && <small className="muted">Models: {modelsLine(c.models)}</small>}
                  </span>
                  <span className="num">{c.runs.length}</span>
                  <span className="num">{n(c.input)}</span>
                  <span className="num">{n(c.output)}</span>
                  <span className="num">{n(c.cacheRead)}</span>
                  <span className="usage-bar" title={`${n(c.total)} input + output tokens`}>
                    <i style={{ width: `${Math.max(2, (c.total / max) * 100)}%` }} />
                    <b>{compact(c.total)}</b>
                  </span>
                </summary>
                <div className="usage-runs">
                  {c.runs.map((r) => (
                    <div key={r.id} className="usage-run">
                      <span>
                        {r.prompt.replace(/\s+/g, " ").slice(0, 110)}
                        {r.usage.models && <small className="muted"> · {modelsLine(modelsOf([r]))}</small>}
                      </span>
                      <span className="num muted">{secs(r)}s</span>
                      <span className="num">{n(r.usage.input)}</span>
                      <span className="num">{n(r.usage.output)}</span>
                      <span className="num">{n(r.usage.cacheRead)}</span>
                      <span />
                    </div>
                  ))}
                  <button className="btn sm" onClick={() => onOpenChat(c.runs)}>
                    Open this chat
                  </button>
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
