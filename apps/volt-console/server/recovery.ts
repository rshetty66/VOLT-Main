/**
 * Resuming workflow runs a server restart cut off.
 *
 * Runs execute inside the server process, so a crash, a laptop restart or a
 * stopped dev server interrupts them. On start, the server marks those runs and
 * resumes each eligible workflow run as a new run that reuses the specialists it
 * had finished, exactly as the Resume button does, on behalf of the person who
 * started it (their budget applies). Other runs stay marked for a person to act on.
 */
import type { RunMode } from "../shared/events.js";
import type { StoredRun } from "../shared/records.js";
import { audit } from "./auth.js";
import type { Catalog } from "./catalog.js";
import type { Db } from "./db.js";
import { finishedOutputs, startRun } from "./runs.js";
import { getSettings } from "./settings.js";
import { getRun } from "./store.js";
import { budgetBlock, budgetFor } from "./usage.js";

/** Only runs started this recently are resumed without asking: older ones may no longer be wanted. */
export const AUTO_RESUME_HOURS = Number(process.env.VOLT_AUTO_RESUME_HOURS ?? 12);
/** Consecutive automatic resumes of one piece of work, so a run that crashes the server cannot loop. */
export const MAX_AUTO_RESUMES = 3;

export interface RecoveryResult {
  resumed: { from: string; to: string; title: string }[];
  skipped: { id: string; title: string; why: string }[];
}

async function autoChainLength(db: Db, run: StoredRun): Promise<number> {
  let n = 0;
  let current: StoredRun | null = run;
  while (current?.autoResumed && current.resumedFrom && n < 10) {
    n++;
    current = await getRun(db, current.resumedFrom);
  }
  return n;
}

export async function resumeInterrupted(ctx: { db: Db; catalog: Catalog; mode: RunMode }, ids: string[], now = Date.now()): Promise<RecoveryResult> {
  const result: RecoveryResult = { resumed: [], skipped: [] };
  if (process.env.VOLT_AUTO_RESUME === "off") {
    for (const id of ids) result.skipped.push({ id, title: "", why: "automatic resume is switched off (VOLT_AUTO_RESUME=off)" });
    return result;
  }
  const settings = await getSettings(ctx.db);
  for (const id of ids) {
    const run = await getRun(ctx.db, id);
    if (!run) continue;
    const skip = (why: string) => result.skipped.push({ id, title: run.title, why });
    if (run.kind !== "workflow" || !run.workflowId || !ctx.catalog.workflowById.has(run.workflowId)) {
      skip("only workflow runs can be resumed");
      continue;
    }
    if (now - Date.parse(run.startedAt) > AUTO_RESUME_HOURS * 3600_000) {
      skip(`started more than ${AUTO_RESUME_HOURS} hours ago; use Resume on its page`);
      continue;
    }
    if (run.mode === "live" && ctx.mode !== "live") {
      skip("a live run, and the server is now in demo mode");
      continue;
    }
    if ((await autoChainLength(ctx.db, run)) >= MAX_AUTO_RESUMES) {
      skip(`already resumed automatically ${MAX_AUTO_RESUMES} times; use Resume on its page`);
      continue;
    }
    if (run.mode === "live" && run.userId) {
      const blocked = budgetBlock(await budgetFor(ctx.db, settings, run.userId));
      if (blocked) {
        skip("its owner's monthly budget is used up");
        continue;
      }
    }
    const reuse = finishedOutputs(run);
    const handle = await startRun(
      { db: ctx.db, catalog: ctx.catalog, mode: ctx.mode, userId: run.userId ?? undefined },
      { prompt: run.prompt, workflowId: run.workflowId, intake: run.intake ?? undefined, engagementId: run.engagementId ?? undefined, demo: run.mode === "demo", resumeFrom: run.id },
      () => {},
      { reuse, autoResumed: true },
    );
    await ctx.db.query("update runs set error = $2 where id = $1", [run.id, "The server stopped before this run finished; it was resumed automatically as a new run."]);
    await audit(ctx.db, run.userId ?? null, "run_auto_resumed", { type: "run", id: handle.runId }, { resumedFrom: run.id, reused: reuse.size });
    result.resumed.push({ from: run.id, to: handle.runId, title: run.title });
  }
  return result;
}
