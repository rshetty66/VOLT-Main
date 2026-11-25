import type { Run } from "./runState";

/** Saved conversations live in this browser (localStorage). They are not shared between devices. */
export const HISTORY_KEY = "volt.history.v1";
export const HISTORY_MAX = 30;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Tool results kept with a saved run: the files it made and the analytics their data sheets come from. */
const KEEP_DATA = new Set(["create_file", "build_value_case", "apqc_benchmark", "score_maturity"]);

/** What is kept of a finished run: the answer, the evidence, the specialists' notes and its files, without the bulky tool traces. */
export function slim(run: Run): Run {
  const item = ({ data, detail: _x, ...rest }: Run["activity"][number]) => (KEEP_DATA.has(rest.text) && data !== undefined ? { ...rest, data } : rest);
  const lanes = Object.fromEntries(Object.entries(run.lanes).map(([id, l]) => [id, { ...l, activity: l.activity.map(item) }]));
  return { ...run, lanes, activity: run.activity.map(item) };
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
