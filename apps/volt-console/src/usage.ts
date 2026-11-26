import type { ModelUse, Run } from "./runState";

/** One chat: the runs that share a conversation (follow-ups carry the same session; New chat starts another). */
export interface ChatUsage {
  id: string;
  title: string;
  startedAt: number;
  lastAt: number;
  runs: Run[];
  input: number;
  output: number;
  cacheRead: number;
  /** Input plus output; cached input is shown apart because it is billed differently. */
  total: number;
  /** Estimated USD at list price; runs saved before model routing count as 0. */
  cost: number;
  /** Models this chat used, largest cost first. */
  models: ModelRow[];
  demo: boolean;
}

export interface ModelRow {
  model: string;
  tokens: number;
  cost: number;
}

export interface UsageTotals {
  chats: number;
  runs: number;
  input: number;
  output: number;
  cacheRead: number;
  total: number;
  cost: number;
  /** Tokens and estimated cost per model, largest cost first. */
  models: ModelRow[];
}

/** Adds up the per-model use of some runs, largest cost first (then most tokens). */
export function modelsOf(runs: Run[]): ModelRow[] {
  const models = new Map<string, ModelUse>();
  for (const r of runs)
    for (const [model, u] of Object.entries(r.usage.models ?? {})) {
      const m = models.get(model) ?? { tokens: 0, cost: 0 };
      models.set(model, { tokens: m.tokens + u.tokens, cost: m.cost + u.cost });
    }
  return [...models.entries()].map(([model, u]) => ({ model, ...u })).sort((a, b) => b.cost - a.cost || b.tokens - a.tokens);
}

/** "claude-sonnet-5-5" -> "Sonnet 5.5"; an unknown id is shown as it is. */
export function modelName(id: string): string {
  const m = /^claude-(haiku|sonnet|opus|fable|mythos)-(\d+)(?:-(\d+))?/.exec(id);
  return m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? `.${m[3]}` : ""}` : id;
}

/** "Opus 5.5 12.3K · Sonnet 5.5 40K · Haiku 5.5 90": which models a run or chat used, with their tokens. */
export const modelsLine = (rows: ModelRow[]) => rows.map((m) => `${modelName(m.model)} ${compact(m.tokens)}`).join(" · ");

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3).trimEnd()}...` : s);

/** Groups finished runs into chats and adds up their tokens. Newest chat first; runs inside a chat oldest first. */
export function chatUsage(runs: Run[]): ChatUsage[] {
  const byChat = new Map<string, Run[]>();
  for (const r of runs) {
    const key = r.sessionId ?? r.id;
    byChat.set(key, [...(byChat.get(key) ?? []), r]);
  }
  return [...byChat.entries()]
    .map(([id, group]) => {
      const sorted = [...group].sort((a, b) => a.startedAt - b.startedAt);
      const sum = (pick: (r: Run) => number) => sorted.reduce((n, r) => n + pick(r), 0);
      const input = sum((r) => r.usage.input);
      const output = sum((r) => r.usage.output);
      return {
        id,
        title: clip(sorted[0].prompt.replace(/\s+/g, " ").trim(), 90),
        startedAt: sorted[0].startedAt,
        lastAt: Math.max(...sorted.map((r) => r.finishedAt ?? r.startedAt)),
        runs: sorted,
        input,
        output,
        cacheRead: sum((r) => r.usage.cacheRead),
        total: input + output,
        cost: sum((r) => r.usage.cost ?? 0),
        models: modelsOf(sorted),
        demo: sorted.every((r) => r.mode === "demo"),
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

export function usageTotals(chats: ChatUsage[]): UsageTotals {
  const sum = (pick: (c: ChatUsage) => number) => chats.reduce((n, c) => n + pick(c), 0);
  return {
    chats: chats.length,
    runs: sum((c) => c.runs.length),
    input: sum((c) => c.input),
    output: sum((c) => c.output),
    cacheRead: sum((c) => c.cacheRead),
    total: sum((c) => c.total),
    cost: sum((c) => c.cost),
    models: modelsOf(chats.flatMap((c) => c.runs)),
  };
}

/** 1,234 -> "1.2K", 1,234,567 -> "1.23M": for tiles and bars; the table shows exact figures. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return String(n);
}

/**
 * Costs are estimated in USD at Anthropic's list prices (server/router.ts) and shown in Canadian dollars at this
 * assumed rate. An estimate only: the Anthropic Console shows the actual bill, in USD.
 */
export const CAD_PER_USD = 1.38;

/** USD in, "CA$0.58" out, or "<CA$0.01" for a small non-zero cost. */
export const cad = (usd: number) => {
  const v = usd * CAD_PER_USD;
  return v > 0 && v < 0.01 ? "<CA$0.01" : `CA$${v.toFixed(2)}`;
};
