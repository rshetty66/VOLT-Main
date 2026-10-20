/**
 * Request-level protection for the API: a request id and access log, a same-origin
 * check on requests that change things, and simple per-user rate limits. All in
 * memory: right for one console process on one machine.
 */
import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { log } from "./log.js";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const REQ_ID = /^[A-Za-z0-9._-]{1,64}$/;

/** Gives each request an id (kept from X-Request-Id when sensible) and logs it when it ends. */
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const given = req.get("x-request-id");
  const id = given && REQ_ID.test(given) ? given : crypto.randomUUID();
  res.locals.reqId = id;
  res.setHeader("X-Request-Id", id);
  const t0 = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const fields = { reqId: id, method: req.method, path: req.originalUrl.split("?")[0], status: res.statusCode, ms: Math.round(ms), userId: res.locals.user?.id };
    // Changes and failures at info; reads (the UI polls) only at debug.
    if (res.statusCode >= 500) log.warn("request", fields);
    else if (UNSAFE.has(req.method) || res.statusCode >= 400) log.info("request", fields);
    else log.debug("request", fields);
  });
  next();
}

const hostOf = (origin: string) => {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return null;
  }
};
const loopback = (host: string | null | undefined) => !!host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);

export function allowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set((env.VOLT_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim().toLowerCase().replace(/\/$/, "")).filter(Boolean));
}

/**
 * Refuses requests that change data when the browser says they come from another site.
 * The session cookie is SameSite=Lax already; this is the second lock. Requests without an
 * Origin (curl, scripts) pass unless the browser marks them cross-site.
 */
export function originCheck(allowed: Set<string>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!UNSAFE.has(req.method)) return next();
    const origin = req.get("origin");
    const site = req.get("sec-fetch-site");
    if (!origin || origin === "null") {
      if (site === "cross-site") return void res.status(403).json({ error: "Cross-site requests are not allowed." });
      return next();
    }
    const host = (req.get("x-forwarded-host") ?? req.get("host") ?? "").toLowerCase();
    const oHost = hostOf(origin);
    // Same host; or the Vite dev server (another localhost port) proxying to this one.
    if (oHost && (oHost === host || (loopback(oHost) && loopback(req.get("host"))))) return next();
    if (allowed.has(origin.toLowerCase())) return next();
    log.warn("origin refused", { reqId: res.locals.reqId, origin, host, path: req.path });
    res.status(403).json({ error: "This request came from another site and was refused. An admin can allow it with VOLT_ALLOWED_ORIGINS." });
  };
}

/** A fixed one-minute window per key. `limit` requests per minute. */
export function rateLimit(name: string, limit: number, keyOf: (req: Request, res: Response) => string) {
  const hits = new Map<string, { n: number; reset: number }>();
  let sweep = Date.now() + 60_000;
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (now > sweep) {
      for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      sweep = now + 60_000;
    }
    const key = keyOf(req, res);
    let h = hits.get(key);
    if (!h || h.reset <= now) hits.set(key, (h = { n: 0, reset: now + 60_000 }));
    h.n++;
    res.setHeader("RateLimit-Limit", String(limit));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, limit - h.n)));
    if (h.n <= limit) return next();
    const wait = Math.ceil((h.reset - now) / 1000);
    res.setHeader("Retry-After", String(wait));
    if (h.n === limit + 1) log.warn("rate limited", { reqId: res.locals.reqId, limiter: name, key, limit });
    res.status(429).json({ error: `Too many requests; try again in ${wait} s.` });
  };
}

export const byUserOrIp = (req: Request, res: Response) => (res.locals.user?.id as string | undefined) ?? `ip:${req.ip}`;
export const byIp = (req: Request) => `ip:${req.ip}`;

/** Requests per minute for the general API, from VOLT_RATE_LIMIT (default 600). */
export const generalLimit = (env: NodeJS.ProcessEnv = process.env) => Number(env.VOLT_RATE_LIMIT) || 600;
