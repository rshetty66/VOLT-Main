import type { Run } from "../runState";
import { chatUsage, compact, usageTotals, usd } from "../usage";

interface Props {
  history: Run[];
  onOpenChat: (runs: Run[]) => void;
}

const n = (v: number) => v.toLocaleString();
const when = (t: number) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const secs = (r: Run) => Math.round(((r.finishedAt ?? r.startedAt) - r.startedAt) / 1000);

export function Usage({ history, onOpenChat }: Props) {
  const chats = chatUsage(history);
  const totals = usageTotals(chats);
  const max = Math.max(1, ...chats.map((c) => c.total));

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
              ["Est. cost", usd(totals.cost)],
            ].map(([label, value]) => (
              <div key={label} className="card stat">
                <span className="micro">{label}</span>
                <span className="v">{value}</span>
              </div>
            ))}
          </div>

          {totals.models.length > 0 && (
            <p className="page-sub">By model: {totals.models.map((m) => `${m.model} ${compact(m.tokens)} tokens, ${usd(m.cost)}`).join(" · ")}</p>
          )}

          <div className="card usage-table">
            <div className="usage-head micro">
              <span>Chat</span>
              <span className="num">Runs</span>
              <span className="num">Input</span>
              <span className="num">Output</span>
              <span className="num">Cached</span>
              <span>Share of all tokens</span>
            </div>
            {chats.map((c) => (
              <details key={c.id} className="usage-chat">
                <summary className="usage-row">
                  <span className="usage-title">
                    {c.title}
                    <small className="muted">
                      {when(c.startedAt)}
                      {c.demo ? " · demo (no tokens)" : c.cost > 0 ? ` · est. ${usd(c.cost)}` : ""}
                    </small>
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
                      <span>{r.prompt.replace(/\s+/g, " ").slice(0, 110)}</span>
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
