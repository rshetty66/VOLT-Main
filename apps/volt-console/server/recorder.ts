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
import { appendEvents, createRun, finishRun, type NewRun } from "./store.js";

export interface Recorder {
  emit: (e: VoltEvent) => void;
  finish: (opts: { aborted: boolean }) => Promise<void>;
}

export async function recordRun(db: Db, run: NewRun, downstream: (e: VoltEvent) => void, flushMs = 1000): Promise<Recorder> {
  await createRun(db, run);
  const pending: VoltEvent[] = [];
  let nextSeq = 0;
  let finalText = "";
  let leadError: string | undefined;
  const usage = { input: 0, output: 0, cacheRead: 0 };
  let writes = Promise.resolve();

  const flush = () => {
    if (pending.length === 0) return writes;
    const batch = pending.splice(0);
    const first = nextSeq;
    nextSeq += batch.length;
    writes = writes
      .then(() => appendEvents(db, run.id, first, batch))
      .catch((err) => console.error(`Could not save events for run ${run.id}:`, err));
    return writes;
  };
  const timer = setInterval(flush, flushMs);

  const emit = (e: VoltEvent) => {
    downstream(e);
    if (e.type === "text_delta" && e.lane === ORCHESTRATOR_LANE) finalText += e.text;
    if (e.type === "error" && e.lane === ORCHESTRATOR_LANE) leadError ??= e.message;
    if (e.type === "usage") {
      usage.input += e.inputTokens;
      usage.output += e.outputTokens;
      usage.cacheRead += e.cacheReadTokens;
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
    await finishRun(db, run.id, {
      status,
      finalText,
      error: leadError,
      inputTokens: usage.input,
      outputTokens: usage.output,
      cacheReadTokens: usage.cacheRead,
    });
  };

  return { emit, finish };
}
