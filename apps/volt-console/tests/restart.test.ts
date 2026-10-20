/**
 * The A5 exit check: kill the server mid-workflow and the run completes after restart.
 * Runs the real server as a child process against the mock Messages API.
 */
import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startMockAnthropic } from "./mockAnthropic";
import type { VoltEvent } from "../shared/events";
import type { StoredRun } from "../shared/records";

let mock: Awaited<ReturnType<typeof startMockAnthropic>>;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "volt-restart-"));
const port = 18000 + Math.floor(Math.random() * 2000);
const base = `http://127.0.0.1:${port}`;
let server: ChildProcess | null = null;
let log = "";

function start(extra: Record<string, string> = {}) {
  server = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, PORT: String(port), VOLT_DATA_DIR: dataDir, VOLT_MODE: "live", ANTHROPIC_API_KEY: "test-key", ANTHROPIC_BASE_URL: mock.url, NODE_ENV: "test", ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout!.on("data", (d) => (log += d));
  server.stderr!.on("data", (d) => (log += d));
}
async function until<T>(what: string, fn: () => Promise<T | undefined | null | false>, ms = 30_000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {
      /* not up yet */
    }
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}\n${log}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}
const up = () => until("the server", async () => (await fetch(`${base}/api/healthz`)).ok);

beforeAll(async () => {
  mock = await startMockAnthropic();
});
afterAll(() => {
  server?.kill("SIGKILL");
  mock.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe("a server restart mid-workflow", () => {
  it("resumes the run automatically, reusing the specialists that had finished", async () => {
    start();
    await up();
    const setup = await fetch(`${base}/api/auth/setup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Admin", email: "admin@example.com", password: "correct-horse-battery" }) });
    const cookie = setup.headers.get("set-cookie")!.split(";")[0];
    const get = async <T>(p: string) => (await fetch(base + p, { headers: { Cookie: cookie } })).json() as Promise<T>;
    const eng = await (await fetch(`${base}/api/engagements`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ clientName: "Maple Harbour (fictional)", title: "Close" }) })).json();

    // Start a workflow, slowly enough to interrupt it after the first phase.
    mock.options.delayMs = 250;
    const res = await fetch(`${base}/api/run`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify({ prompt: "11-day close", workflowId: "close-optimization", engagementId: eng.id }) });
    const reader = res.body!.getReader();
    let buf = "";
    const runId = await until("run_start", async () => {
      buf += new TextDecoder().decode((await reader.read()).value);
      return buf.match(/"runId":"([^"]+)"/)?.[1];
    });
    const before = await until("phase 1 to finish", async () => {
      const run = await get<StoredRun>(`/api/runs/${runId}`);
      const done = run.events.filter((e) => e.type === "agent_end" && e.ok).length;
      return done >= 3 && run.status === "running" ? run : null;
    });
    server!.kill("SIGKILL");
    await new Promise((r) => server!.once("exit", r));
    await reader.cancel().catch(() => {});

    // Restart: the interrupted run is resumed as a new run, which finishes.
    mock.options.delayMs = 0;
    start();
    await up();
    expect(log).toContain("Resumed after restart: Finance Close Optimization");
    const resumed = await until("the resumed run to finish", async () => {
      const runs = await get<{ id: string; autoResumed: boolean; status: string; resumedFrom: string }[]>(`/api/runs?limit=10`);
      const r = runs.find((x) => x.autoResumed);
      return r && r.status !== "running" ? r : null;
    });
    expect(resumed).toMatchObject({ status: "done", resumedFrom: runId });
    const full = await get<StoredRun>(`/api/runs/${resumed.id}`);
    expect(full.title).toBe("Finance Close Optimization (resumed after restart)");
    const finishedBefore = before.events.filter((e) => e.type === "agent_end" && e.ok).length;
    const reused = full.events.filter((e): e is Extract<VoltEvent, { type: "status" }> => e.type === "status" && e.text.startsWith("Reused from the earlier run")).length;
    expect(reused).toBeGreaterThanOrEqual(finishedBefore);
    expect(full.events.filter((e) => e.type === "agent_end" && e.ok)).toHaveLength(10);
    expect(full.finalText.length).toBeGreaterThan(0);
    const original = await get<StoredRun>(`/api/runs/${runId}`);
    expect(original.status).toBe("error");
    expect(original.error).toMatch(/resumed automatically as a new run/);
    server!.kill("SIGKILL");
    await new Promise((r) => server!.once("exit", r));
  }, 90_000);
});

describe("which interrupted runs are resumed", () => {
  it("skips old runs, non-workflow runs, live runs on a demo server, and long chains", async () => {
    const { openDb } = await import("../server/db");
    const store = await import("../server/store");
    const { resumeInterrupted, MAX_AUTO_RESUMES } = await import("../server/recovery");
    const { loadCatalog } = await import("../server/catalog");
    const db = await openDb();
    const catalog = loadCatalog();
    const make = async (over: Partial<Parameters<typeof store.createRun>[1]> = {}) => {
      const id = crypto.randomUUID();
      await store.createRun(db, { id, sessionId: "s", kind: "workflow", title: "Finance Close Optimization", prompt: "p", workflowId: "close-optimization", mode: "demo", model: "simulator", ...over });
      return id;
    };
    const fresh = await make();
    const old = await make();
    await db.query("update runs set started_at = now() - interval '2 days' where id = $1", [old]);
    const chat = await make({ kind: "orchestrate", workflowId: undefined, title: "Rudra orchestration" });
    const live = await make({ mode: "live", model: "claude-opus-5-5" });
    let chain = await make();
    for (let i = 0; i < MAX_AUTO_RESUMES; i++) chain = await make({ resumedFrom: chain, autoResumed: true });
    const ids = await store.markInterruptedRuns(db);
    const r = await resumeInterrupted({ db, catalog, mode: "demo" }, ids);
    expect(r.resumed.map((x) => x.from)).toEqual(expect.arrayContaining([fresh]));
    const why = Object.fromEntries(r.skipped.map((s) => [s.id, s.why]));
    expect(why[old]).toMatch(/more than 12 hours ago/);
    expect(why[chat]).toMatch(/only workflow runs/);
    expect(why[live]).toMatch(/server is now in demo mode/);
    expect(why[chain]).toMatch(/already resumed automatically 3 times/);
    process.env.VOLT_AUTO_RESUME = "off";
    expect((await resumeInterrupted({ db, catalog, mode: "demo" }, [fresh])).resumed).toHaveLength(0);
    delete process.env.VOLT_AUTO_RESUME;
    await new Promise((res) => setTimeout(res, 300));
    await db.close().catch(() => {});
  }, 60_000);
});
