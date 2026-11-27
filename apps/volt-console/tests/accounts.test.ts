import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { SESSION_COOKIE, bootstrapUsers, listUsernames, makeSession, readSession, resetLockouts, setPassword, verifyPassword } from "../server/accounts";
import { assertSafeToListen, loginPostHandler, requestUser, requireToken, securityConfig } from "../server/security";

const SECRET = "s".repeat(40);
const PW = "correct horse battery";
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "volt-accounts-"));
  process.env.VOLT_DATA_DIR = dir;
  resetLockouts();
});
afterEach(() => {
  delete process.env.VOLT_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});

const cfg = () => securityConfig({ VOLT_AUTH_MODE: "password", VOLT_SESSION_SECRET: SECRET, VOLT_HOST: "0.0.0.0" } as NodeJS.ProcessEnv);

function post(body: unknown) {
  const out = { status: 200, json: undefined as unknown, cookies: {} as Record<string, string> };
  const res = {
    status(n: number) { out.status = n; return this; },
    json(v: unknown) { out.json = v; return this; },
    cookie(k: string, v: string) { out.cookies[k] = v; return this; },
  } as unknown as Response;
  loginPostHandler(cfg())({ body, secure: true, get: () => undefined } as unknown as Request, res, () => {});
  return out;
}

describe("password accounts", () => {
  it("stores a scrypt hash, never the password, and checks it", () => {
    setPassword("Rakesh", PW);
    const raw = fs.readFileSync(path.join(dir, "users.json"), "utf8");
    expect(raw).not.toContain(PW);
    expect(verifyPassword("rakesh", PW)).toEqual({ ok: true, username: "Rakesh" });
    expect(verifyPassword("Rakesh", "wrong password!")).toEqual({ ok: false, locked: false });
    expect(verifyPassword("nobody", PW)).toEqual({ ok: false, locked: false });
  });

  it("refuses short passwords and bad names", () => {
    expect(() => setPassword("a", "short")).toThrow(/10 characters/);
    expect(() => setPassword("../etc", PW)).toThrow(/Usernames/);
  });

  it("locks an account for 15 minutes after five wrong passwords", () => {
    setPassword("ana", PW);
    const t = 1_000_000;
    for (let i = 0; i < 4; i++) expect(verifyPassword("ana", "nope nope nope", t).ok).toBe(false);
    expect(verifyPassword("ana", "nope nope nope", t)).toEqual({ ok: false, locked: true });
    expect(verifyPassword("ana", PW, t + 60_000)).toEqual({ ok: false, locked: true });
    expect(verifyPassword("ana", PW, t + 16 * 60_000).ok).toBe(true);
  });

  it("bootstraps only names that do not exist yet and never resets a password", () => {
    setPassword("rakesh", PW);
    expect(bootstrapUsers("rakesh:another password,ana:ana password 1")).toEqual(["ana"]);
    expect(verifyPassword("rakesh", PW).ok).toBe(true);
    expect(listUsernames().sort()).toEqual(["ana", "rakesh"]);
  });
});

describe("password sessions", () => {
  it("signs the session and rejects a tampered, expired or orphaned one", () => {
    setPassword("rakesh", PW);
    const v = makeSession(SECRET, "rakesh", 60_000, 0);
    expect(readSession(SECRET, v, 1)).toBe("rakesh");
    expect(readSession(SECRET, v, 60_001)).toBeUndefined();
    expect(readSession("x".repeat(40), v, 1)).toBeUndefined();
    const forged = `${Buffer.from("admin").toString("base64url")}.${v.split(".").slice(1).join(".")}`;
    expect(readSession(SECRET, forged, 1)).toBeUndefined();
    expect(readSession(SECRET, makeSession(SECRET, "ghost", 60_000, 0), 1)).toBeUndefined();
  });

  it("signs in through /api/login, then the cookie opens the API and names the user", () => {
    setPassword("rakesh", PW);
    expect(post({ username: "rakesh", password: "wrong one here" }).status).toBe(401);
    const ok = post({ username: "Rakesh", password: PW });
    expect(ok.status).toBe(200);
    const cookie = `${SESSION_COOKIE}=${ok.cookies[SESSION_COOKIE]}`;
    expect(requestUser(cfg(), { headers: { cookie } })).toBe("rakesh");
    let status = 0;
    let passed = false;
    const res = { status(n: number) { status = n; return this; }, json() { return this; } } as unknown as Response;
    requireToken(cfg())({ path: "/api/run", headers: {} } as unknown as Request, res, () => { passed = true; });
    expect([status, passed]).toEqual([401, false]);
    requireToken(cfg())({ path: "/api/run", headers: { cookie } } as unknown as Request, res, () => { passed = true; });
    expect(passed).toBe(true);
  });

  it("refuses to start without a long session secret", () => {
    expect(() => assertSafeToListen(securityConfig({ VOLT_AUTH_MODE: "password", VOLT_SESSION_SECRET: "short" } as NodeJS.ProcessEnv))).toThrow(/VOLT_SESSION_SECRET/);
    expect(() => assertSafeToListen(cfg())).not.toThrow();
  });
});
