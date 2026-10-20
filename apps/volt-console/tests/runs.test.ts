import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb, type Db } from "../server/db";
import { getRun } from "../server/store";
import { isRunActive, startRun, stopRun } from "../server/runs";
import { loadCatalog } from "../server/catalog";
import type { VoltEvent } from "../shared/events";

const catalog = loadCatalog();
let db: Db;
beforeAll(async () => {
  db = await openDb();
});
afterAll(async () => {
  await db.close();
});

const workflow = { prompt: "Close takes 11 days across SAP and Oracle", workflowId: "close-optimization" };

describe("runs outlive the browser connection", () => {
  it("finishes and saves a run after the page that started it goes away", async () => {
    const seen: VoltEvent[] = [];
    const run = await startRun({ db, catalog, mode: "demo" }, workflow, (e) => seen.push(e));
    run.detach(); // the tab closes as soon as the run has started
    const seenAtClose = seen.length;
    expect(isRunActive(run.runId)).toBe(true);
    await run.finished;

    expect(seen.length).toBe(seenAtClose); // nothing more reached the closed page
    expect(seen.some((e) => e.type === "done")).toBe(false);
    expect(isRunActive(run.runId)).toBe(false);
    const saved = (await getRun(db, run.runId))!;
    expect(saved.status).toBe("done");
    expect(saved.finalText).toMatch(/Finance Close Optimization/);
    expect(saved.events.length).toBeGreaterThan(3);
    expect(saved.events.at(-1)?.type).toBe("done");
  }, 60_000);

  it("halts only when asked to stop", async () => {
    let runId = "";
    let stopped = false;
    const run = await startRun({ db, catalog, mode: "demo" }, workflow, (e) => {
      if (e.type === "run_start") runId = e.runId;
      if (e.type === "agent_start" && !stopped) stopped = stopRun(runId);
    });
    await run.finished;
    expect(stopped).toBe(true);
    expect((await getRun(db, run.runId))?.status).toBe("stopped");
    expect(stopRun(run.runId)).toBe(false); // nothing left to stop
  }, 60_000);
});
