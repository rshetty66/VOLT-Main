import type { Run } from "./runState";

/** Saved conversations live in this browser (localStorage). They are not shared between devices. */
export const HISTORY_KEY = "volt.history.v1";
export const HISTORY_MAX = 30;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What is kept of a finished run: the answer, the evidence and the specialists' notes, without the bulky tool traces. */
export function slim(run: Run): Run {
  const lanes = Object.fromEntries(Object.entries(run.lanes).map(([id, l]) => [id, { ...l, activity: l.activity.map(({ data: _d, detail: _x, ...rest }) => rest) }]));
  return { ...run, lanes, activity: run.activity.map(({ data: _d, detail: _x, ...rest }) => rest) };
}

/** Finished runs only (a run still working is not history), newest first, merged by id, capped. */
export function mergeHistory(saved: Run[], runs: Run[], max = HISTORY_MAX): Run[] {
  const byId = new Map(saved.map((r) => [r.id, r]));
  for (const r of runs) if (r.state !== "running" && r.text.trim()) byId.set(r.id, slim(r));
  return [...byId.values()].sort((a, b) => b.startedAt - a.startedAt).slice(0, max);
}

export function loadHistory(storage: StorageLike | undefined = safeStorage()): Run[] {
  try {
    const parsed = JSON.parse(storage?.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    // A run that was still working when the page closed is shown as stopped.
    return parsed.filter((r) => r && typeof r.id === "string" && typeof r.text === "string").map((r) => (r.state === "running" ? { ...r, state: "stopped" } : r));
  } catch {
    return [];
  }
}

/** Saves, dropping the oldest runs until the browser accepts it. Never throws. */
export function saveHistory(runs: Run[], storage: StorageLike | undefined = safeStorage()): void {
  if (!storage) return;
  for (let n = runs.length; n >= 0; n--) {
    try {
      storage.setItem(HISTORY_KEY, JSON.stringify(runs.slice(0, n)));
      return;
    } catch {
      /* quota: try with fewer */
    }
  }
}

function safeStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
