import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb, type Db } from "../server/db";
import { createApp } from "../server/app";
import { loadCatalog } from "../server/catalog";
import { createEngagement, getEngagement } from "../server/store";

let db: Db;
let server: Server;
let base = "";

beforeAll(async () => {
  db = await openDb();
  server = createApp({ db, catalog: loadCatalog(), mode: "demo" }).listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await db.close();
});

/** A browser stand-in: keeps its own session cookie. */
class Client {
  cookie = "";
  async call(method: string, path: string, body?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json", ...(this.cookie ? { Cookie: this.cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const set = r.headers.get("set-cookie");
    if (set) this.cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    const text = await r.text();
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* SSE or file */
    }
    return { status: r.status, data, text, type: r.headers.get("content-type") ?? "" };
  }
  get = (p: string) => this.call("GET", p);
  post = (p: string, b?: unknown) => this.call("POST", p, b ?? {});
  async login(email: string, password = "correct-horse-battery") {
    const r = await this.post("/api/auth/login", { email, password });
    expect(r.status).toBe(200);
    return this;
  }
  /** Starts a run and reads its stream to the end; returns the run id. */
  async run(body: Record<string, unknown>) {
    const r = await this.post("/api/run", body);
    if (r.status !== 200) return { status: r.status, runId: "", data: r.data };
    const start = r.text.split("\n").find((l) => l.includes('"run_start"'));
    return { status: 200, runId: JSON.parse(start!.slice(6)).runId as string, data: null };
  }
}

const admin = new Client();
const ana = new Client(); // consultant, owns the engagement
const ben = new Client(); // consultant, not on it
const vic = new Client(); // viewer, added to it
let engagementId = "";
let runId = "";
let stoppedRunId = "";
let preExisting = "";

describe("first-run setup", () => {
  it("requires sign-in everywhere except health and sign-in itself", async () => {
    expect((await new Client().get("/api/healthz")).status).toBe(200);
    expect((await new Client().get("/api/engagements")).status).toBe(401);
    expect((await new Client().get("/api/catalog")).status).toBe(401);
    expect((await new Client().get("/api/auth/status")).data.setupRequired).toBe(true);
  });

  it("creates the first admin, who inherits data saved before sign-in existed", async () => {
    preExisting = (await createEngagement(db, { clientName: "Before sign-in", title: "Old" })).id;
    expect((await admin.post("/api/auth/setup", { name: "Vishnu", email: "Admin@Example.com", password: "short" })).status).toBe(400);
    const r = await admin.post("/api/auth/setup", { name: "Vishnu", email: "Admin@Example.com", password: "correct-horse-battery" });
    expect(r.status).toBe(201);
    expect(r.data).toMatchObject({ role: "admin", email: "admin@example.com" });
    expect((await getEngagement(db, preExisting))?.ownerId).toBe(r.data.id);
    expect((await admin.get("/api/auth/me")).data.name).toBe("Vishnu");
    expect((await new Client().post("/api/auth/setup", { name: "X", email: "x@example.com", password: "correct-horse-battery" })).status).toBe(409);
  });

  it("lets the admin add people", async () => {
    for (const [name, email, role] of [["Ana", "ana@example.com", "consultant"], ["Ben", "ben@example.com", "consultant"], ["Vic", "vic@example.com", "viewer"]]) {
      expect((await admin.post("/api/users", { name, email, role, password: "correct-horse-battery" })).status).toBe(201);
    }
    expect((await admin.post("/api/users", { name: "Dup", email: "ANA@example.com", role: "viewer", password: "correct-horse-battery" })).status).toBe(409);
    await ana.login("ana@example.com");
    await ben.login("BEN@example.com");
    await vic.login("vic@example.com");
    expect((await ana.post("/api/users", { name: "X", email: "x@example.com", role: "admin", password: "correct-horse-battery" })).status).toBe(403);
  });
});

describe("exit check: a second user cannot see or download the first user's runs", () => {
  it("Ana's engagement and runs are hers", async () => {
    const e = await ana.post("/api/engagements", { clientName: "Maple Harbour", title: "Close" });
    expect(e.status).toBe(201);
    engagementId = e.data.id;
    expect(e.data.ownerName).toBe("Ana");
    const run = await ana.run({ prompt: "11-day close", workflowId: "close-optimization", engagementId });
    expect(run.status).toBe(200);
    runId = run.runId;
    expect((await ana.get(`/api/runs/${runId}`)).data.userId).toBeTruthy();
  });

  it("Ben can neither list, open, download, stop, resume nor continue them", async () => {
    expect((await ben.get("/api/engagements")).data.map((e: any) => e.id)).not.toContain(engagementId);
    expect((await ben.get(`/api/engagements/${engagementId}`)).status).toBe(404);
    expect((await ben.get("/api/runs")).data.map((r: any) => r.id)).not.toContain(runId);
    expect((await ben.get(`/api/runs/${runId}`)).status).toBe(404);
    for (const f of ["docx", "xlsx", "pptx"]) {
      const r = await ben.get(`/api/runs/${runId}/export/${f}`);
      expect([r.status, r.type.startsWith("text/plain")]).toEqual([404, true]);
    }
    expect((await ben.get(`/api/runs/${runId}/markdown`)).status).toBe(404);
    expect((await ben.post(`/api/runs/${runId}/stop`)).status).toBe(404);
    expect((await ben.run({ prompt: "x", resumeFrom: runId })).status).toBe(404);
    expect((await ben.run({ prompt: "x", engagementId })).status).toBe(404);
    const sessionId = (await ana.get(`/api/runs/${runId}`)).data.sessionId;
    expect((await ben.run({ prompt: "x", sessionId })).status).toBe(403);
    expect((await ben.call("PATCH", `/api/engagements/${engagementId}`, { templateId: null })).status).toBe(404);
  });

  it("an admin sees everything; adding Ben as a member gives him access", async () => {
    expect((await admin.get(`/api/runs/${runId}`)).status).toBe(200);
    expect((await admin.get("/api/engagements")).data.map((e: any) => e.id)).toEqual(expect.arrayContaining([engagementId, preExisting]));
    const users = (await ana.get("/api/users")).data;
    expect(users[0]).not.toHaveProperty("lastLoginAt"); // a directory, not the admin list
    const benId = users.find((u: any) => u.name === "Ben").id;
    expect((await ana.post(`/api/engagements/${engagementId}/members`, { userId: benId })).status).toBe(200);
    expect((await ben.get(`/api/runs/${runId}/export/docx`)).status).toBe(200);
    expect((await ben.post(`/api/engagements/${engagementId}/members`, { userId: benId })).status).toBe(403); // only the owner or an admin
    await ana.call("DELETE", `/api/engagements/${engagementId}/members/${benId}`);
    expect((await ben.get(`/api/runs/${runId}`)).status).toBe(404);
  });
});

describe("exit check: a viewer cannot start, stop or resume runs", () => {
  it("Vic, added as a member, can read and download but not change anything", async () => {
    const vicId = (await ana.get("/api/users")).data.find((u: any) => u.name === "Vic").id;
    await ana.post(`/api/engagements/${engagementId}/members`, { userId: vicId });
    const detail = await vic.get(`/api/engagements/${engagementId}`);
    expect(detail.status).toBe(200);
    expect(detail.data.access).toBe("read");
    expect((await vic.get(`/api/runs/${runId}/export/pptx`)).status).toBe(200);
    expect((await vic.run({ prompt: "x", engagementId })).status).toBe(403);
    expect((await vic.run({ prompt: "x" })).status).toBe(403);
    expect((await vic.post(`/api/runs/${runId}/stop`)).status).toBe(403);

    // A stopped run Vic could see but not resume.
    const started = ana.post("/api/run", { prompt: "11-day close", workflowId: "close-optimization", engagementId });
    await new Promise((r) => setTimeout(r, 300));
    stoppedRunId = (await ana.get(`/api/runs?engagementId=${engagementId}`)).data.find((r: any) => r.status === "running").id;
    expect((await vic.post(`/api/runs/${stoppedRunId}/stop`)).status).toBe(403);
    expect((await ana.post(`/api/runs/${stoppedRunId}/stop`)).status).toBe(200);
    await started;
    expect((await vic.run({ prompt: "x", resumeFrom: stoppedRunId })).status).toBe(403);
    expect((await ana.run({ prompt: "x", resumeFrom: stoppedRunId })).status).toBe(200);

    expect((await vic.call("PATCH", `/api/engagements/${engagementId}`, { templateId: null })).status).toBe(403);
    expect((await vic.post("/api/engagements", { clientName: "X", title: "Y" })).status).toBe(403);
    expect((await vic.post("/api/templates", { name: "T", primaryColor: "000000", accentColor: "000000", headingFont: "Arial", bodyFont: "Arial" })).status).toBe(403);
  });
});

describe("accounts and the activity log", () => {
  it("throttles repeated failed sign-ins", async () => {
    const c = new Client();
    for (let i = 0; i < 5; i++) expect((await c.post("/api/auth/login", { email: "ana@example.com", password: "wrong-password-1" })).status).toBe(401);
    expect((await c.post("/api/auth/login", { email: "ana@example.com", password: "correct-horse-battery" })).status).toBe(429);
  });

  it("keeps at least one admin, and a disabled user's session stops working", async () => {
    const adminId = (await admin.get("/api/auth/me")).data.id;
    expect((await admin.call("PATCH", `/api/users/${adminId}`, { role: "consultant" })).status).toBe(409);
    const benId = (await admin.get("/api/users")).data.find((u: any) => u.name === "Ben").id;
    expect((await admin.call("PATCH", `/api/users/${benId}`, { disabled: true })).status).toBe(200);
    expect((await ben.get("/api/engagements")).status).toBe(401);
  });

  it("changing your password keeps your session; a reset ends the other person's", async () => {
    expect((await ana.post("/api/auth/password", { current: "wrong", password: "another-long-password" })).status).toBe(400);
    expect((await ana.post("/api/auth/password", { current: "correct-horse-battery", password: "another-long-password" })).status).toBe(200);
    expect((await ana.get("/api/auth/me")).status).toBe(200);
    const vicId = (await admin.get("/api/users")).data.find((u: any) => u.name === "Vic").id;
    expect((await admin.post(`/api/users/${vicId}/password`, { password: "reset-by-admin-123" })).status).toBe(200);
    expect((await vic.get("/api/auth/me")).status).toBe(401);
  });

  it("records who did what", async () => {
    const actions = (await admin.get("/api/audit")).data.map((a: any) => a.action);
    for (const a of ["setup", "user_created", "login", "login_failed", "engagement_created", "run_started", "member_added", "export", "run_stopped", "run_resumed", "user_updated", "password_reset"]) expect(actions).toContain(a);
    expect((await ana.get("/api/audit")).status).toBe(403);
  });

  it("signs out", async () => {
    expect((await admin.post("/api/auth/logout")).status).toBe(200);
    expect((await admin.get("/api/auth/me")).status).toBe(401);
  });
});
