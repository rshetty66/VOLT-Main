import type { Run } from "./runState";

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
  demo: boolean;
}

export interface UsageTotals {
  chats: number;
  runs: number;
  input: number;
  output: number;
  cacheRead: number;
  total: number;
}

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
        demo: sorted.every((r) => r.mode === "demo"),
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}

export function usageTotals(chats: ChatUsage[]): UsageTotals {
  const sum = (pick: (c: ChatUsage) => number) => chats.reduce((n, c) => n + pick(c), 0);
  return { chats: chats.length, runs: sum((c) => c.runs.length), input: sum((c) => c.input), output: sum((c) => c.output), cacheRead: sum((c) => c.cacheRead), total: sum((c) => c.total) };
}

/** 1,234 -> "1.2K", 1,234,567 -> "1.23M": for tiles and bars; the table shows exact figures. */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${+(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${+(n / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`;
  return String(n);
}
