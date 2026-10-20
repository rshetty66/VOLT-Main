/**
 * Runs execute on the server, independent of the browser request that started them.
 *
 * The request that starts a run subscribes to its events; if that connection
 * closes (tab closed, page refreshed, laptop asleep) the run keeps going and is
 * still saved in full. Only stopRun, called from the Stop button, halts it.
 */
import crypto from "node:crypto";
import { ORCHESTRATOR_LANE, type RunMode, type RunRequest, type VoltEvent } from "../shared/events.js";
import type { Catalog } from "./catalog.js";
import type { Db } from "./db.js";
import { runDemo } from "./demo.js";
import { MODEL, errorMessage, getSession, runLive, type Emit } from "./orchestrator.js";
import { recordRun } from "./recorder.js";
import { loadSession, saveSession } from "./store.js";
import type { StoredRun } from "../shared/records.js";

export interface RunContext {
  db: Db;
  catalog: Catalog;
  mode: RunMode;
  /** Who is starting the run. */
  userId?: string;
}

export interface RunHandle {
  runId: string;
  /** Stop sending events to the listener; the run itself carries on. */
  detach: () => void;
  /** Settles once the run has finished and been saved. */
  finished: Promise<void>;
}

const active = new Map<string, AbortController>();

export const isRunActive = (runId: string) => active.has(runId);

/** Halts a run that is still going. Returns false when no such run is active. */
export function stopRun(runId: string): boolean {
  const controller = active.get(runId);
  if (!controller) return false;
  controller.abort();
  return true;
}

/** Specialist outputs a stopped or failed workflow run finished, keyed by lane id, for resuming it. */
export function finishedOutputs(run: StoredRun): Map<string, string> {
  const text = new Map<string, string>();
  const done = new Set<string>();
  for (const e of run.events) {
    if (e.type === "text_delta" && e.lane !== ORCHESTRATOR_LANE) text.set(e.lane, (text.get(e.lane) ?? "") + e.text);
    if (e.type === "agent_end" && e.ok && e.lane !== ORCHESTRATOR_LANE) done.add(e.lane);
  }
  return new Map([...done].filter((lane) => text.get(lane)?.trim()).map((lane) => [lane, text.get(lane)!]));
}

/** Starts a run; `listener` receives every event from run_start on, until detached. */
export async function startRun(
  ctx: RunContext,
  body: RunRequest,
  listener: (e: VoltEvent) => void,
  opts: { reuse?: Map<string, string> } = {},
): Promise<RunHandle> {
  const { db, catalog } = ctx;
  const runMode: RunMode = body.demo || ctx.mode === "demo" ? "demo" : "live";
  const session = getSession(body.sessionId, body.sessionId ? await loadSession(db, body.sessionId) : null);
  const kind = body.workflowId ? "workflow" : body.agentId && body.agentId !== "rudra" ? "agent" : "orchestrate";
  const title = body.workflowId
    ? catalog.workflowById.get(body.workflowId)?.name ?? body.workflowId
    : body.agentId
      ? catalog.agentById.get(body.agentId)?.name ?? body.agentId
      : "Rudra orchestration";
  const runTitle = body.resumeFrom ? `${title} (resumed)` : title;
  const runId = crypto.randomUUID();
  const model = runMode === "live" ? MODEL : "simulator";

  const listeners = new Set([listener]);
  const broadcast: Emit = (e) => {
    for (const l of listeners) {
      try {
        l(e);
      } catch (err) {
        console.error(`Run ${runId}: a listener failed:`, err);
      }
    }
  };
  const recorder = await recordRun(
    db,
    { id: runId, engagementId: body.engagementId, userId: ctx.userId, sessionId: session.id, kind, prompt: body.prompt, workflowId: body.workflowId, agentId: body.agentId, intake: body.intake, mode: runMode, model, title: runTitle },
    broadcast,
  );
  const controller = new AbortController();
  active.set(runId, controller);
  const emit = recorder.emit;

  const finished = (async () => {
    emit({ type: "run_start", runId, sessionId: session.id, mode: runMode, model, kind, title: runTitle });
    if (opts.reuse?.size) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: `Resuming: reusing ${opts.reuse.size} finished specialist output(s) from the earlier run` });
    try {
      if (runMode === "demo") await runDemo(catalog, body, emit, controller.signal);
      else await runLive(catalog, body, session, emit, controller.signal, opts.reuse);
    } catch (err) {
      if (!controller.signal.aborted) emit({ type: "error", lane: ORCHESTRATOR_LANE, message: errorMessage(err) });
    }
    emit({ type: "done", sessionId: session.id });
    try {
      if (runMode === "live") await saveSession(db, { ...session, userId: ctx.userId });
      await recorder.finish({ aborted: controller.signal.aborted });
    } catch (err) {
      console.error(`Could not save run ${runId}:`, err);
    } finally {
      active.delete(runId);
    }
  })();

  return { runId, detach: () => listeners.delete(listener), finished };
}
