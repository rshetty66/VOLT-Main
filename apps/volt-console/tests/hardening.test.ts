/**
 * A6 local hardening: settings checked at start, readiness, security headers, the
 * cross-site check, rate limits, deleting an engagement and retention.
 */
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../server/db";
import { checkConfig } from "../server/config";

let db: Db;
let server: Server;
let base = "";
let store: typeof import("../server/store");
let auth: typeof import("../server/auth");
let usage: typeof import("../server/usage");
let retention: typeof import("../server/retention");
const ids: Record<string, string> = {};
const PW = "correct-horse-battery";

beforeAll(async () => {
  process.env.VOLT_RATE_LIMIT = "40";
  store = await import("../server/store");
  auth = await import("../server/auth");
  usage = await import("../server/usage");
  retention = await import("../server/retention");
  const catalog = (await import("../server/catalog")).loadCatalog();
  db = await (await import("../server/db")).openDb();
  for (const [key, role] of [["admin", "admin"], ["ana", "consultant"], ["ben", "consultant"], ["rita", "consultant"]] as const) {
    ids[key] = (await auth.createUser(db, { email: `${key}@example.com`, name: key, role, password: PW })).id;
  }
  const { createApp } = await import("../server/app");
  server = createApp({ db, catalog, mode: "demo" }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  delete process.env.VOLT_RATE_LIMIT;
  server.close();
  await db.close();
});

async function as(email: string) {
  const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PW }) });
  expect(r.status).toBe(200);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  return async (method: string, p: string, body?: object, headers: Record<string, string> = {}) => {
    const res = await fetch(base + p, { method, headers: { Cookie: cookie, ...(body ? { "Content-Type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* not JSON */
    }
    return { status: res.status, data, headers: res.headers };
  };
}

/** A saved live run with events and a lead-agent session, as a finished run leaves them. */
async function seedRun(engagementId: string, userId: string, opts: { costUsd?: number; daysAgo?: number; status?: string } = {}) {
  const id = crypto.randomUUID();
  const session = `s-${id}`;
  const when = `now() - make_interval(days => ${opts.daysAgo ?? 0})`;
  await db.query("insert into sessions (id, messages, user_id) values ($1, '[]', $2)", [session, userId]);
  await db.query(
    `insert into runs (id, engagement_id, session_id, kind, title, prompt, mode, model, status, user_id, cost_usd, input_tokens, output_tokens, started_at, finished_at)
     values ($1, $2, $3, 'agent', 'Seeded run', 'Prompt text', 'live', 'claude-opus-5-5', $4, $5, $6, 1000, 500, ${when}, ${opts.status === "running" ? "null" : when})`,
    [id, engagementId, session, opts.status ?? "done", userId, opts.costUsd ?? 0.5],
  );
  await db.query("insert into run_events (run_id, seq, event) values ($1, 0, '{\"type\":\"run_start\"}')", [id]);
  return id;
}

const count = async (sql: string, args: unknown[]) => Number((await db.query<{ n: number }>(`select count(*)::int as n from ${sql}`, args)).rows[0].n);

describe("settings checked at start", () => {
  const dir = path.join(os.tmpdir(), `volt-config-${process.pid}`);
  it("accepts a clean configuration", () => {
    expect(checkConfig({ VOLT_DATA_DIR: dir, PORT: "8787", VOLT_MODE: "demo" }).problems).toEqual([]);
  });
  it("names bad values, quoted keys and live mode without credentials", () => {
    const { problems } = checkConfig({
      VOLT_DATA_DIR: dir,
      PORT: "eighty",
      VOLT_MODE: "production",
      VOLT_SPECIALIST_MAX_STEPS: "40",
      ANTHROPIC_API_KEY: '"sk-ant-abc"',
      VOLT_ALLOWED_ORIGINS: "https://volt.example.com/app",
      VOLT_PLUGIN_DIR: path.join(dir, "missing"),
    });
    const text = problems.join("\n");
    expect(text).toContain("PORT");
    expect(text).toContain('VOLT_MODE="production"');
    expect(text).toContain("VOLT_SPECIALIST_MAX_STEPS");
    expect(text).toContain("quotes");
    expect(text).toContain("VOLT_ALLOWED_ORIGINS");
    expect(text).toContain("No VOLT plugin");
    expect(text).not.toContain("sk-ant-abc"); // never echo the key
  });
  it("warns about near-miss names", () => {
    const { warnings, problems } = checkConfig({ VOLT_DATA_DIR: dir, VOLT_RUN_BUDGET_UDS: "5" });
    expect(problems).toEqual([]);
    expect(warnings.join()).toContain("did you mean VOLT_RUN_BUDGET_USD");
  });
});

describe("readiness and headers", () => {
  it("readyz reports each check, without signing in", async () => {
    const r = await fetch(`${base}/api/readyz`);
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.ready).toBe(true);
    expect(body.checks.migrations.detail).toMatch(/^\d+ applied$/);
    expect(Object.keys(body.checks)).toEqual(["database", "migrations", "catalog", "credentials"]);
  });
  it("sends security headers and a request id", async () => {
    const r = await fetch(`${base}/api/healthz`, { headers: { "X-Request-Id": "trace-123" } });
    expect(r.headers.get("x-request-id")).toBe("trace-123");
    expect(r.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("x-powered-by")).toBeNull();
    const odd = await fetch(`${base}/api/healthz`, { headers: { "X-Request-Id": "bad id\twith spaces" } });
    expect(odd.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("requests from other sites", () => {
  it("refuses changes sent from another origin, allows the same host", async () => {
    const call = await as("ana@example.com");
    const body = { clientName: "Origin Test (fictional)", title: "t" };
    expect((await call("POST", "/api/engagements", body, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await call("POST", "/api/engagements", body, { "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
    expect((await call("POST", "/api/engagements", body, { Origin: base })).status).toBe(201);
    // Reads are not affected.
    expect((await call("GET", "/api/engagements", undefined, { Origin: "https://evil.example" })).status).toBe(200);
  });
});

describe("deleting an engagement", () => {
  it("removes its runs, events, sessions, files and members, and keeps the spend", async () => {
    const e = await store.createEngagement(db, { clientName: "Delete Me (fictional)", title: "Close", ownerId: ids.ana });
    await store.addMember(db, e.id, ids.ben);
    const runIds = [await seedRun(e.id, ids.ana, { costUsd: 1.25 }), await seedRun(e.id, ids.ana, { costUsd: 0.75 })];
    await db.query("insert into client_files (engagement_id, user_id, ref_no, name, kind, size_bytes, sha256, data) values ($1, $2, 1, 'tb.csv', 'csv', 3, 'abc', '\\x616263')", [e.id, ids.ana]);
    const before = await usage.monthSpent(db, ids.ana);

    const ben = await as("ben@example.com");
    expect((await ben("DELETE", `/api/engagements/${e.id}`)).status).toBe(403); // a member, not the owner

    const running = await seedRun(e.id, ids.ana, { status: "running", costUsd: 0 });
    const ana = await as("ana@example.com");
    expect((await ana("DELETE", `/api/engagements/${e.id}`)).status).toBe(409);
    await db.query("update runs set status = 'stopped', finished_at = now() where id = $1", [running]);

    const r = await ana("DELETE", `/api/engagements/${e.id}`);
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ deleted: true, runs: 3, files: 1, sessions: 3 });
    expect(await count("engagements where id = $1", [e.id])).toBe(0);
    expect(await count("runs where id = any($1::uuid[])", [[...runIds, running]])).toBe(0);
    expect(await count("run_events where run_id = any($1::uuid[])", [[...runIds, running]])).toBe(0);
    expect(await count("sessions where id = any($1::text[])", [[...runIds, running].map((id) => `s-${id}`)])).toBe(0);
    expect(await count("client_files where engagement_id = $1", [e.id])).toBe(0);
    expect(await count("engagement_members where engagement_id = $1", [e.id])).toBe(0);
    // Deleting never gives budget back.
    expect(await usage.monthSpent(db, ids.ana)).toBeCloseTo(before, 6);
    expect((await ana("GET", `/api/engagements/${e.id}`)).status).toBe(404);
    const log = (await (await as("admin@example.com"))("GET", "/api/audit")).data as any[];
    expect(log.some((a) => a.action === "engagement_deleted" && a.targetId === e.id)).toBe(true);
  });
});

describe("retention", () => {
  it("only the owner or an admin sets it, to one of the offered periods", async () => {
    const e = await store.createEngagement(db, { clientName: "Keep (fictional)", title: "Close", ownerId: ids.ana });
    await store.addMember(db, e.id, ids.ben);
    const ana = await as("ana@example.com");
    expect((await ana("PATCH", `/api/engagements/${e.id}`, { retentionDays: 45 })).status).toBe(400);
    expect((await (await as("ben@example.com"))("PATCH", `/api/engagements/${e.id}`, { retentionDays: 90 })).status).toBe(403);
    const r = await ana("PATCH", `/api/engagements/${e.id}`, { retentionDays: 90 });
    expect(r.status).toBe(200);
    expect(r.data.retentionDays).toBe(90);
    expect((await ana("PATCH", `/api/engagements/${e.id}`, { retentionDays: null })).data.retentionDays).toBeNull();
  });

  it("purges runs and files older than the period, and nothing newer or elsewhere", async () => {
    const e = await store.createEngagement(db, { clientName: "Retained (fictional)", title: "Close", ownerId: ids.ana });
    const other = await store.createEngagement(db, { clientName: "Unlimited (fictional)", title: "Close", ownerId: ids.ana });
    const old = await seedRun(e.id, ids.ana, { daysAgo: 40 });
    const recent = await seedRun(e.id, ids.ana, { daysAgo: 5 });
    const elsewhere = await seedRun(other.id, ids.ana, { daysAgo: 400 });
    await db.query(
      "insert into client_files (engagement_id, ref_no, name, kind, size_bytes, sha256, data, created_at) values ($1, 1, 'old.csv', 'csv', 1, 'o', '\\x61', now() - interval '40 days'), ($1, 2, 'new.csv', 'csv', 1, 'n', '\\x62', now())",
      [e.id],
    );
    await retention.setRetention(db, e.id, 30);
    const before = await usage.monthSpent(db, ids.ana);
    const purged = await retention.purgeExpired(db);
    expect(purged).toMatchObject({ runs: 1, files: 1 });
    expect(await count("runs where id = $1", [old])).toBe(0);
    expect(await count("runs where id = any($1::uuid[])", [[recent, elsewhere]])).toBe(2);
    expect((await db.query<{ name: string }>("select name from client_files where engagement_id = $1", [e.id])).rows.map((r) => r.name)).toEqual(["new.csv"]);
    expect(await usage.monthSpent(db, ids.ana)).toBeCloseTo(before, 6);
  });
});

// Last: these use up the per-address sign-in allowance for the minute.
describe("rate limits", () => {
  it("limits API calls per person (VOLT_RATE_LIMIT), and not other people", async () => {
    const login = async (email: string) => {
      const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: PW }) });
      return r.headers.get("set-cookie")!.split(";")[0];
    };
    const rita = await login("rita@example.com");
    const ben = await login("ben@example.com");
    let last = 0;
    for (let i = 0; i < 41; i++) last = (await fetch(`${base}/api/engagements`, { headers: { Cookie: rita } })).status;
    expect(last).toBe(429);
    expect((await fetch(`${base}/api/engagements`, { headers: { Cookie: ben } })).status).toBe(200);
  });
  it("limits sign-in attempts per address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) {
      const r = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `nobody${i}@example.com`, password: "wrong-password" }) });
      statuses.push(r.status);
    }
    // Earlier tests signed in from this address too, so the limit arrives sooner than 20.
    const firstLimited = statuses.indexOf(429);
    expect(firstLimited).toBeGreaterThan(0);
    expect(statuses.slice(0, firstLimited).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(firstLimited).every((s) => s === 429)).toBe(true);
  });
});
