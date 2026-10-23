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
import { callCost } from "./cost.js";
import { MODEL, errorMessage, getSession, runLive, type Emit } from "./orchestrator.js";
import { recordRun } from "./recorder.js";
import { fileAccess } from "./files.js";
import { getSettings } from "./settings.js";
import { getEngagement, loadSession, saveSession } from "./store.js";
import { formattingFor } from "./templates.js";
import { budgetFor, budgetGuard } from "./usage.js";
import type { StoredRun } from "../shared/records.js";
import { log } from "./log.js";

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
  opts: { reuse?: Map<string, string>; autoResumed?: boolean } = {},
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
  const runTitle = opts.autoResumed ? `${title} (resumed after restart)` : body.resumeFrom ? `${title} (resumed)` : title;
  const runId = crypto.randomUUID();
  const model = runMode === "live" ? MODEL : "simulator";

  const listeners = new Set([listener]);
  const broadcast: Emit = (e) => {
    for (const l of listeners) {
      try {
        l(e);
      } catch (err) {
        log.error("a run listener failed", { runId, err });
      }
    }
  };
  const recorder = await recordRun(
    db,
    { id: runId, engagementId: body.engagementId, userId: ctx.userId, sessionId: session.id, kind, prompt: body.prompt, workflowId: body.workflowId, agentId: body.agentId, intake: body.intake, mode: runMode, model, title: runTitle, resumedFrom: body.resumeFrom, autoResumed: opts.autoResumed },
    broadcast,
  );
  const controller = new AbortController();
  active.set(runId, controller);

  // Price every model call as it lands, and stop the run at its own or the person's monthly budget.
  const settings = await getSettings(db);
  const guard = runMode === "live" && ctx.userId ? budgetGuard(await budgetFor(db, settings, ctx.userId), { resumable: kind === "workflow" }) : null;
  const emit: Emit = (e) => {
    if (e.type !== "usage") return recorder.emit(e);
    const costUsd = callCost(settings.prices, e.model ?? model, e);
    recorder.emit({ ...e, costUsd });
    const check = guard?.add(costUsd);
    if (check?.warn) recorder.emit({ type: "status", lane: ORCHESTRATOR_LANE, text: check.warn });
    if (check?.stop && !controller.signal.aborted) {
      recorder.emit({ type: "error", lane: ORCHESTRATOR_LANE, message: check.stop });
      controller.abort();
    }
  };

  const t0 = Date.now();
  log.info("run started", { runId, kind, workflowId: body.workflowId, agentId: body.agentId, engagementId: body.engagementId, userId: ctx.userId, mode: runMode, resumedFrom: body.resumeFrom, autoResumed: opts.autoResumed || undefined });
  const finished = (async () => {
    emit({ type: "run_start", runId, sessionId: session.id, mode: runMode, model, kind, title: runTitle });
    if (opts.autoResumed) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: "Resumed automatically: the server restarted while this workflow was running" });
    if (opts.reuse?.size) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: `Resuming: reusing ${opts.reuse.size} finished specialist output(s) from the earlier run` });
    try {
      const files = await fileAccess(db, body.engagementId);
      if (files) emit({ type: "files", files: files.files.map(({ ref, id, name, summary }) => ({ ref, id, name, summary })) });
      const formatting = body.engagementId ? await formattingFor(db, (await getEngagement(db, body.engagementId))?.templateId) : null;
      if (formatting) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: `Formatting template "${formatting.name}" applied` });
      if (runMode === "demo") await runDemo(catalog, body, emit, controller.signal, files);
      else await runLive(catalog, body, session, emit, controller.signal, { reuse: opts.reuse, specialistModel: settings.specialistModel, specialistMaxSteps: settings.specialistMaxSteps, files, formatting: formatting ?? undefined });
    } catch (err) {
      if (!controller.signal.aborted) emit({ type: "error", lane: ORCHESTRATOR_LANE, message: errorMessage(err) });
    }
    emit({ type: "done", sessionId: session.id });
    try {
      if (runMode === "live") await saveSession(db, { ...session, userId: ctx.userId });
      const end = await recorder.finish({ aborted: controller.signal.aborted });
      log.info("run finished", { runId, status: end.status, seconds: Math.round((Date.now() - t0) / 1000), costUsd: Math.round(end.usage.costUsd * 1000) / 1000, inputTokens: end.usage.inputTokens, cacheReadTokens: end.usage.cacheReadTokens, cacheWriteTokens: end.usage.cacheWriteTokens, outputTokens: end.usage.outputTokens });
    } catch (err) {
      log.error("could not save run", { runId, err });
    } finally {
      active.delete(runId);
    }
  })();

  return { runId, detach: () => listeners.delete(listener), finished };
}
