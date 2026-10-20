/**
 * Wraps a run's emit function so every event is also saved.
 *
 * Events go to the client immediately and to the database in batches (once a
 * second and at the end), so saving never slows the stream. Consecutive text
 * deltas on the same lane are merged before saving; replaying them gives the
 * same result as the original stream.
 */
import { ORCHESTRATOR_LANE, type VoltEvent } from "../shared/events.js";
import type { RunStatus } from "../shared/records.js";
import type { Db } from "./db.js";
import { appendEvents, createRun, finishRun, updateRunUsage, type NewRun, type RunUsage } from "./store.js";
import { log } from "./log.js";

export interface Recorder {
  emit: (e: VoltEvent) => void;
  finish: (opts: { aborted: boolean }) => Promise<{ status: RunStatus; usage: Required<RunUsage> }>;
}

export async function recordRun(db: Db, run: NewRun, downstream: (e: VoltEvent) => void, flushMs = 1000): Promise<Recorder> {
  await createRun(db, run);
  const pending: VoltEvent[] = [];
  let nextSeq = 0;
  let finalText = "";
  let leadError: string | undefined;
  const usage: Required<RunUsage> = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
  let usageChanged = false;
  let writes = Promise.resolve();

  const flush = () => {
    if (pending.length === 0) return writes;
    const batch = pending.splice(0);
    const first = nextSeq;
    nextSeq += batch.length;
    // Spend is saved as the run goes, so budgets see runs still in progress and a crash keeps it.
    const snapshot = usageChanged ? { ...usage } : null;
    usageChanged = false;
    writes = writes
      .then(async () => {
        await appendEvents(db, run.id, first, batch);
        if (snapshot) await updateRunUsage(db, run.id, snapshot);
      })
      .catch((err) => log.error("could not save run events", { runId: run.id, err }));
    return writes;
  };
  const timer = setInterval(flush, flushMs);

  const emit = (e: VoltEvent) => {
    downstream(e);
    if (e.type === "text_delta" && e.lane === ORCHESTRATOR_LANE) finalText += e.text;
    if (e.type === "error" && e.lane === ORCHESTRATOR_LANE) leadError ??= e.message;
    if (e.type === "usage") {
      usage.inputTokens += e.inputTokens;
      usage.outputTokens += e.outputTokens;
      usage.cacheReadTokens += e.cacheReadTokens;
      usage.cacheWriteTokens += e.cacheWriteTokens ?? 0;
      usage.costUsd += e.costUsd ?? 0;
      usageChanged = true;
    }
    const last = pending.at(-1);
    if (e.type === "text_delta" && last?.type === "text_delta" && last.lane === e.lane) {
      pending[pending.length - 1] = { ...last, text: last.text + e.text };
    } else {
      pending.push(e);
    }
  };

  const finish = async ({ aborted }: { aborted: boolean }) => {
    clearInterval(timer);
    await flush();
    const status: RunStatus = aborted ? "stopped" : leadError && !finalText ? "error" : "done";
    await finishRun(db, run.id, { status, finalText, error: leadError, ...usage });
    return { status, usage: { ...usage } };
  };

  return { emit, finish };
}
