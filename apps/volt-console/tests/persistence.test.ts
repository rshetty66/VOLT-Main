import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb, type Db } from "../server/db";
import {
  createEngagement,
  getEngagement,
  getRun,
  listEngagements,
  listRuns,
  loadSession,
  markInterruptedRuns,
  saveSession,
  createRun,
} from "../server/store";
import { recordRun } from "../server/recorder";
import { runToMarkdown } from "../server/export";
import { runDemo } from "../server/demo";
import { getSession } from "../server/orchestrator";
import { loadCatalog } from "../server/catalog";
import { applyEvent, newRun } from "../src/runState";
import type { VoltEvent } from "../shared/events";

const catalog = loadCatalog();
let db: Db;

beforeAll(async () => {
  db = await openDb();
});
afterAll(async () => {
  await db.close();
});

/** Runs a demo workflow through the recorder, returning what the client saw. */
async function recordedDemo(req: Parameters<typeof runDemo>[1], engagementId?: string, abortAfter?: number) {
  const seen: VoltEvent[] = [];
  const controller = new AbortController();
  const id = crypto.randomUUID();
  const rec = await recordRun(
    db,
    { id, engagementId, sessionId: "s-" + id, kind: req.workflowId ? "workflow" : "orchestrate", title: "Test run", prompt: req.prompt, workflowId: req.workflowId, intake: req.intake, mode: "demo", model: "simulator" },
    (e) => {
      seen.push(e);
      if (abortAfter && seen.length === abortAfter) controller.abort();
    },
    20,
  );
  rec.emit({ type: "run_start", runId: id, sessionId: "s-" + id, mode: "demo", model: "simulator", kind: "workflow", title: "Test run" });
  try {
    await runDemo(catalog, req, rec.emit, controller.signal);
  } catch {
    /* aborted */
  }
  rec.emit({ type: "done", sessionId: "s-" + id });
  await rec.finish({ aborted: controller.signal.aborted });
  return { id, seen };
}

describe("database", () => {
  it("applies migrations once and keeps data across reopen", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "volt-db-"));
    try {
      const a = await openDb(dir);
      await createEngagement(a, { clientName: "Acme", title: "Close review" });
      await a.close();
      const b = await openDb(dir);
      expect((await listEngagements(b)).map((e) => e.clientName)).toEqual(["Acme"]);
      const applied = await b.query<{ n: number }>("select count(*)::int as n from schema_migrations");
      expect(applied.rows[0].n).toBe(fs.readdirSync(path.resolve("server/migrations")).length);
      await b.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("engagements", () => {
  it("creates, lists and reads engagements; rejects unknown ids", async () => {
    const e = await createEngagement(db, { clientName: "Maple Harbour Financial", title: "Close optimization", description: "Fictional" });
    expect(e.runCount).toBe(0);
    expect((await getEngagement(db, e.id))?.title).toBe("Close optimization");
    expect(await getEngagement(db, "not-a-uuid")).toBeNull();
    expect(await getEngagement(db, crypto.randomUUID())).toBeNull();
    expect((await listEngagements(db)).some((x) => x.id === e.id)).toBe(true);
  });
});

describe("run recording", () => {
  it("saves a workflow run so its replay matches what the client saw", async () => {
    const eng = await createEngagement(db, { clientName: "Maple Harbour Financial", title: "Close" });
    const { id, seen } = await recordedDemo(
      { prompt: "Close takes 11 days across SAP and Oracle", workflowId: "close-optimization", intake: { audience: "C-Suite / Board" } },
      eng.id,
    );
    const run = (await getRun(db, id))!;
    expect(run.status).toBe("done");
    expect(run.engagementId).toBe(eng.id);
    expect(run.intake).toEqual({ audience: "C-Suite / Board" });
    expect(run.finalText).toMatch(/Finance Close Optimization/);
    expect(run.events.length).toBeLessThan(seen.length); // text deltas merged

    const fold = (events: VoltEvent[]) => events.reduce(applyEvent, newRun("p", "t", "workflow"));
    const live = fold(seen);
    const replay = fold(run.events);
    expect(replay.text).toBe(live.text);
    expect(replay.laneOrder).toEqual(live.laneOrder);
    expect(replay.laneOrder.map((l) => replay.lanes[l].text)).toEqual(live.laneOrder.map((l) => live.lanes[l].text));
    expect(replay.phases.map((p) => p.name)).toEqual(["Diagnosis", "Target Model", "Roadmap", "Deliverable"]);

    expect((await getEngagement(db, eng.id))?.runCount).toBe(1);
    expect((await listRuns(db, { engagementId: eng.id })).map((r) => r.id)).toEqual([id]);
  }, 60_000);

  it("marks a run the user stopped as stopped", async () => {
    const { id } = await recordedDemo({ prompt: "Close takes 11 days", workflowId: "close-optimization" }, undefined, 5);
    expect((await getRun(db, id))?.status).toBe("stopped");
  }, 60_000);

  it("marks runs left running by a stopped server", async () => {
    const id = crypto.randomUUID();
    await createRun(db, { id, sessionId: "x", kind: "orchestrate", title: "t", prompt: "p", mode: "demo", model: "simulator" });
    expect(await markInterruptedRuns(db)).toBeGreaterThanOrEqual(1);
    const run = await getRun(db, id);
    expect(run?.status).toBe("error");
    expect(run?.error).toMatch(/server stopped/);
  });

  it("exports a run as Markdown with deliverable and specialist sections", async () => {
    const eng = await createEngagement(db, { clientName: "Maple Harbour Financial", title: "Close" });
    const { id } = await recordedDemo({ prompt: "Close takes 11 days", workflowId: "close-optimization" }, eng.id);
    const md = runToMarkdown((await getRun(db, id))!, eng);
    expect(md).toMatch(/^# Test run/);
    expect(md).toMatch(/\*\*Engagement:\*\* Maple Harbour Financial - Close/);
    expect(md).toMatch(/## Deliverable/);
    expect(md).toMatch(/### APQC Researcher/);
    expect(md).toMatch(/demo mode/);
  }, 60_000);
});

describe("sessions", () => {
  it("rebuilds a lead-agent conversation from the database after a restart", async () => {
    const id = crypto.randomUUID();
    const messages = [
      { role: "user", content: "Assess our close" },
      { role: "assistant", content: [{ type: "text", text: "Bottom quartile at 11 days." }] },
    ];
    await saveSession(db, { id, agentId: "coa-designer", messages });
    const saved = await loadSession(db, id);
    expect(saved).toEqual({ agentId: "coa-designer", messages });
    const session = getSession(id, saved);
    expect(session.messages).toEqual(messages);
    expect(session.agentId).toBe("coa-designer");
    expect(await loadSession(db, "missing")).toBeNull();
  });
});
