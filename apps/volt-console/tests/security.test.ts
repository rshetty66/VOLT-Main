import { describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { SESSION_MS, USER_COOKIE, assertSafeToListen, requestUser, validUsername, loginPostHandler, rateLimit, requestToken, requireToken, sameOriginWrites, securityConfig, tokenMatches } from "../server/security.js";
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

describe("sign-in form", () => {
  const c = cfg({ VOLT_ACCESS_TOKEN: "t".repeat(20) });
  const post = (body: unknown) => {
    const out = { status: 200, json: undefined as unknown, cookie: undefined as unknown[] | undefined };
    const res = {
      status(n: number) { out.status = n; return this; },
      json(b: unknown) { out.json = b; return this; },
      cookie(...a: unknown[]) { out.cookie = a; return this; },
    } as unknown as Response;
    loginPostHandler(c)({ body, secure: true, get: () => undefined } as unknown as Request, res, () => {});
    return out;
  };
  it("sets the HttpOnly cookie for the right token, trimming spaces", () => {
    const out = post({ token: `  ${"t".repeat(20)} ` });
    expect(out.status).toBe(200);
    expect(out.cookie?.[0]).toBe("volt_token");
    expect((out.cookie?.[2] as { httpOnly: boolean }).httpOnly).toBe(true);
    expect((out.cookie?.[2] as { maxAge: number }).maxAge).toBe(SESSION_MS);
    expect(SESSION_MS).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000);
  });
  it("refuses a wrong or missing token and sets no cookie", () => {
    for (const body of [{ token: "nope" }, {}, undefined]) {
      const out = post(body);
      expect(out.status).toBe(401);
      expect(out.cookie).toBeUndefined();
    }
  });
});

describe("username-only sign-in (opt-in)", () => {
  const u = cfg({ VOLT_AUTH_MODE: "username", VOLT_HOST: "0.0.0.0" });
  const run = (c: ReturnType<typeof cfg>, path: string, cookie?: string, auth?: string) => {
    const out = { status: 0, nexted: false, json: undefined as any };
    const res = { status(n: number) { out.status = n; return this; }, json(b: unknown) { out.json = b; return this; } } as unknown as Response;
    requireToken(c)({ path, headers: { cookie, authorization: auth } } as unknown as Request, res, () => { out.nexted = true; });
    return out;
  };
  const login = (c: ReturnType<typeof cfg>, body: unknown) => {
    const out = { status: 200, cookie: undefined as unknown[] | undefined };
    const res = { status(n: number) { out.status = n; return this; }, json() { return this; }, cookie(...a: unknown[]) { out.cookie = a; return this; } } as unknown as Response;
    loginPostHandler(c)({ body, secure: true, get: () => undefined } as unknown as Request, res, () => {});
    return out;
  };

  it("is off by default and needs the explicit mode to allow a public bind without a token", () => {
    expect(cfg().authMode).toBe("token");
    expect(() => assertSafeToListen(cfg({ VOLT_HOST: "0.0.0.0" }))).toThrow(/VOLT_ACCESS_TOKEN/);
    expect(() => assertSafeToListen(u)).not.toThrow();
  });
  it("accepts a plain name and sets an HttpOnly cookie, and rejects empty or odd names", () => {
    const ok = login(u, { username: "  Priya S  " });
    expect(ok.status).toBe(200);
    expect(ok.cookie?.[0]).toBe(USER_COOKIE);
    expect(ok.cookie?.[1]).toBe("Priya S");
    expect((ok.cookie?.[2] as { httpOnly: boolean }).httpOnly).toBe(true);
    for (const body of [{ username: "" }, { username: "<script>" }, { username: "x".repeat(41) }, {}, undefined]) expect(login(u, body).status).toBe(401);
  });
  it("lets only listed names in when VOLT_ALLOWED_USERS is set", () => {
    const a = cfg({ VOLT_AUTH_MODE: "username", VOLT_ALLOWED_USERS: "Asha, Ravi" });
    expect(validUsername(a, "asha")).toBe(true);
    expect(validUsername(a, "Mallory")).toBe(false);
    expect(login(a, { username: "Mallory" }).status).toBe(401);
  });
  it("guards /api with the cookie, but keeps health and login open", () => {
    expect(run(u, "/api/catalog")).toMatchObject({ status: 401, json: { auth: "username" } });
    expect(run(u, "/api/catalog", `${USER_COOKIE}=Priya%20S`).nexted).toBe(true);
    expect(run(u, "/api/healthz").nexted).toBe(true);
    expect(requestUser(u, { headers: { cookie: `${USER_COOKIE}=Priya%20S` } } as never)).toBe("Priya S");
    expect(requestUser(cfg(), { headers: { cookie: `${USER_COOKIE}=Priya` } } as never)).toBeUndefined();
  });
  it("still honours the Bearer token when one is also configured", () => {
    const both = cfg({ VOLT_AUTH_MODE: "username", VOLT_ACCESS_TOKEN: "t".repeat(20) });
    expect(run(both, "/api/catalog", undefined, `Bearer ${"t".repeat(20)}`).nexted).toBe(true);
    expect(run(both, "/api/catalog").status).toBe(401);
  });
});
