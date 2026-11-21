import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { assertSafeToListen, rateLimit, requestToken, requireToken, sameOriginWrites, securityConfig, tokenMatches } from "../server/security.js";
import { getSession } from "../server/orchestrator.js";

const cfg = (env: Record<string, string> = {}) => securityConfig({ ...env } as NodeJS.ProcessEnv);

function run(mw: (req: Request, res: Response, next: () => void) => unknown, req: { method?: string; path?: string; ip?: string; headers?: Record<string, string> }) {
  const out = { status: 200, nexted: false, headers: {} as Record<string, string> };
  const res = {
    status(n: number) { out.status = n; return this; },
    json() { return this; },
    setHeader(k: string, v: string) { out.headers[k] = v; },
  } as unknown as Response;
  const headers = req.headers ?? {};
  const full = { method: "GET", path: "/api/x", ...req, headers, get: (h: string) => headers[h.toLowerCase()] } as unknown as Request;
  mw(full, res, () => { out.nexted = true; });
  return out;
}

describe("listen safety", () => {
  it("defaults to loopback", () => expect(cfg().host).toBe("127.0.0.1"));
  it("refuses a public bind without a token", () => expect(() => assertSafeToListen(cfg({ VOLT_HOST: "0.0.0.0" }))).toThrow(/VOLT_ACCESS_TOKEN/));
  it("allows a public bind with a long token", () => expect(() => assertSafeToListen(cfg({ VOLT_HOST: "0.0.0.0", VOLT_ACCESS_TOKEN: "x".repeat(24) }))).not.toThrow());
  it("rejects a short token", () => expect(() => assertSafeToListen(cfg({ VOLT_ACCESS_TOKEN: "short" }))).toThrow(/16/));
});

describe("access token", () => {
  const c = cfg({ VOLT_ACCESS_TOKEN: "t".repeat(20) });
  it("matches exactly", () => {
    expect(tokenMatches("t".repeat(20), c.token!)).toBe(true);
    expect(tokenMatches("t".repeat(19), c.token!)).toBe(false);
    expect(tokenMatches(undefined, c.token!)).toBe(false);
  });
  it("reads bearer and cookie", () => {
    expect(requestToken({ headers: { authorization: "Bearer abc" } })).toBe("abc");
    expect(requestToken({ headers: { cookie: "a=1; volt_token=xyz" } })).toBe("xyz");
  });
  it("blocks /api without it, lets healthz through", () => {
    expect(run(requireToken(c), { path: "/api/run" }).status).toBe(401);
    expect(run(requireToken(c), { path: "/api/healthz" }).nexted).toBe(true);
    expect(run(requireToken(c), { path: "/api/run", headers: { authorization: `Bearer ${c.token}` } }).nexted).toBe(true);
  });
  it("is open when no token is configured", () => expect(run(requireToken(cfg()), { path: "/api/run" }).nexted).toBe(true));
});

describe("cross-site writes", () => {
  const prod = cfg({ NODE_ENV: "production" });
  it("refuses a foreign Origin on POST", () => {
    expect(run(sameOriginWrites(prod), { method: "POST", headers: { origin: "https://evil.example", host: "volt.example" } }).status).toBe(403);
  });
  it("allows the page's own origin, and requests with no Origin", () => {
    expect(run(sameOriginWrites(prod), { method: "POST", headers: { origin: "https://volt.example", host: "volt.example" } }).nexted).toBe(true);
    expect(run(sameOriginWrites(prod), { method: "POST", headers: { host: "volt.example" } }).nexted).toBe(true);
  });
  it("allows loopback origins only outside production (Vite proxy)", () => {
    const h = { origin: "http://localhost:5173", host: "localhost:8787" };
    expect(run(sameOriginWrites(cfg()), { method: "POST", headers: h }).nexted).toBe(true);
    expect(run(sameOriginWrites(prod), { method: "POST", headers: h }).status).toBe(403);
  });
  it("never blocks reads", () => expect(run(sameOriginWrites(prod), { method: "GET", headers: { origin: "https://evil.example", host: "x" } }).nexted).toBe(true));
});

describe("rate limit", () => {
  it("returns 429 after the budget and resets after a minute", () => {
    let t = 0;
    const mw = rateLimit(2, () => t);
    const r = { ip: "1.2.3.4" };
    expect(run(mw, r).nexted).toBe(true);
    expect(run(mw, r).nexted).toBe(true);
    expect(run(mw, r).status).toBe(429);
    t = 61_000;
    expect(run(mw, r).nexted).toBe(true);
  });
});

describe("sessions", () => {
  it("ignores client-chosen ids", () => {
    const s = getSession("attacker-chosen-id");
    expect(s.id).not.toBe("attacker-chosen-id");
    expect(getSession(s.id)).toBe(s);
  });
});
