/**
 * Access control for the Console API.
 *
 *   bind     The server listens on loopback unless VOLT_HOST says otherwise.
 *   token    When VOLT_ACCESS_TOKEN is set, every /api route except /api/healthz needs it: as
 *            "Authorization: Bearer <token>", or through the HttpOnly cookie that
 *            GET /api/login?token=<token> sets (so the browser app needs no code change).
 *   origin   A state-changing request that carries an Origin header must come from the page's own host
 *            (or VOLT_ALLOWED_ORIGINS; loopback origins outside production, for the Vite dev proxy).
 *   rate     Routes that spend Claude tokens are limited per client (VOLT_RATE_LIMIT per minute).
 *
 * Exposing the server beyond loopback without a token is refused at start-up.
 */
import crypto from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

export const COOKIE = "volt_token";
const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export interface SecurityConfig {
  host: string;
  token?: string;
  production: boolean;
  allowedOrigins: string[];
  rateLimitPerMinute: number;
}

export function securityConfig(env: NodeJS.ProcessEnv = process.env): SecurityConfig {
  const limit = Number(env.VOLT_RATE_LIMIT ?? 30);
  return {
    host: env.VOLT_HOST || "127.0.0.1",
    token: env.VOLT_ACCESS_TOKEN || undefined,
    production: env.NODE_ENV === "production",
    allowedOrigins: (env.VOLT_ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim().toLowerCase()).filter(Boolean),
    rateLimitPerMinute: Number.isFinite(limit) && limit > 0 ? limit : 30,
  };
}

/** Throws when the configuration would expose an unauthenticated API beyond this machine. */
export function assertSafeToListen(cfg: SecurityConfig): void {
  if (!LOOPBACK.has(cfg.host) && !cfg.token) {
    throw new Error(`Refusing to listen on ${cfg.host} without VOLT_ACCESS_TOKEN. Set a long random token, or keep VOLT_HOST=127.0.0.1.`);
  }
  if (cfg.token && cfg.token.length < 16) throw new Error("VOLT_ACCESS_TOKEN must be at least 16 characters.");
}

const digest = (s: string) => crypto.createHash("sha256").update(s).digest();
export function tokenMatches(given: string | undefined, expected: string): boolean {
  return !!given && crypto.timingSafeEqual(digest(given), digest(expected));
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export function requestToken(req: Pick<Request, "headers">): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return cookieValue(req.headers.cookie, COOKIE);
}

/** Login route: GET /api/login?token=... sets the cookie and redirects to the app. */
export function loginHandler(cfg: SecurityConfig): RequestHandler {
  return (req, res) => {
    if (!cfg.token) return void res.redirect("/");
    const given = typeof req.query.token === "string" ? req.query.token : undefined;
    if (!tokenMatches(given, cfg.token)) return void res.status(401).json({ error: "Invalid access token." });
    res.cookie(COOKIE, cfg.token, { httpOnly: true, sameSite: "strict", secure: req.secure || req.get("x-forwarded-proto") === "https", maxAge: 12 * 60 * 60 * 1000, path: "/" });
    res.redirect("/");
  };
}

/** Rejects /api requests without the token. Health checks stay open. */
export function requireToken(cfg: SecurityConfig): RequestHandler {
  return (req, res, next) => {
    if (!cfg.token || req.path === "/api/healthz" || req.path === "/api/login" || !req.path.startsWith("/api")) return next();
    if (tokenMatches(requestToken(req), cfg.token)) return next();
    res.status(401).json({ error: "Access token required.", code: "unauthorized" });
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Blocks cross-site writes: an Origin that is not this host (or an allowed origin) is refused. */
export function sameOriginWrites(cfg: SecurityConfig): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("origin");
    if (SAFE_METHODS.has(req.method) || !origin) return next();
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      return void res.status(403).json({ error: "Bad Origin header.", code: "bad_origin" });
    }
    const ok =
      url.host.toLowerCase() === (req.get("host") ?? "").toLowerCase() ||
      cfg.allowedOrigins.includes(origin.toLowerCase()) ||
      (!cfg.production && LOOPBACK.has(url.hostname.replace(/^\[|\]$/g, "")));
    if (ok) return next();
    res.status(403).json({ error: "Cross-origin request refused.", code: "bad_origin" });
  };
}

/** Fixed-window per-client limiter for the routes that call Claude. */
export function rateLimit(perMinute: number, now: () => number = Date.now): RequestHandler {
  const hits = new Map<string, { start: number; n: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const t = now();
    for (const [k, v] of hits) if (t - v.start >= 60_000) hits.delete(k);
    const key = req.ip ?? "unknown";
    const h = hits.get(key);
    if (!h) hits.set(key, { start: t, n: 1 });
    else if (++h.n > perMinute) {
      res.setHeader("Retry-After", String(Math.ceil((60_000 - (t - h.start)) / 1000)));
      return void res.status(429).json({ error: "Too many requests. Try again shortly.", code: "rate_limited" });
    }
    next();
  };
}

/** The cost-bearing routes: model runs, live filing search and extraction, the CopilotKit agent. */
export const COSTLY = [/^\/api\/run$/, /^\/api\/finance-architecture\/sources\/(find|extract)$/, /^\/api\/copilotkit(\/|$)/];
export function limitCostly(perMinute: number): RequestHandler {
  const limiter = rateLimit(perMinute);
  return (req, res, next) => (req.method !== "GET" && COSTLY.some((re) => re.test(req.path)) ? limiter(req, res, next) : next());
}
