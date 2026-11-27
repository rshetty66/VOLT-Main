/**
 * Password accounts for VOLT_AUTH_MODE=password.
 *
 *   store     <data>/users.json: { "<username>": { salt, hash, createdAt } }. Passwords are scrypt-hashed and never stored,
 *             logged or returned. The file lives on the data disk, not in git.
 *   session   An HMAC-signed cookie (volt_session) holding the username and an expiry, signed with VOLT_SESSION_SECRET.
 *   lockout   Five wrong passwords for one username lock it for 15 minutes (on top of the per-client login rate limit).
 *   accounts  `npm run add-user -- <name>` (password read from stdin), or VOLT_BOOTSTRAP_USERS="name:password,..." on
 *             start, which adds only names that do not exist yet.
 *
 * Usernames are the same names used before (the ledger reviewer name, for example), so nothing recorded under a name moves.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SESSION_COOKIE = "volt_session";
export const USERNAME = /^[A-Za-z0-9][A-Za-z0-9 ._@-]{0,39}$/;
export const MIN_PASSWORD = 10;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

interface Account {
  salt: string;
  hash: string;
  createdAt: number;
}

const file = () => path.join(process.env.VOLT_DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data"), "users.json");
const key = (name: string) => name.trim().toLowerCase();

function readAll(): Record<string, Account> {
  try {
    const v = JSON.parse(fs.readFileSync(file(), "utf8"));
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Account>): void {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  const tmp = `${file()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(all, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file());
}

const scrypt = (password: string, salt: string) => crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");

export function hasAccounts(): boolean {
  return Object.keys(readAll()).length > 0;
}

export function listUsernames(): string[] {
  return Object.keys(readAll());
}

/** Adds or replaces an account. Throws a plain message for a bad name or a short password. */
export function setPassword(name: string, password: string): void {
  if (!USERNAME.test(name.trim())) throw new Error("Usernames are letters, numbers, space, . _ @ - (up to 40 characters).");
  if (password.length < MIN_PASSWORD) throw new Error(`Passwords need at least ${MIN_PASSWORD} characters.`);
  const salt = crypto.randomBytes(16).toString("hex");
  const all = readAll();
  all[name.trim()] = { salt, hash: scrypt(password, salt), createdAt: all[name.trim()]?.createdAt ?? Date.now() };
  writeAll(all);
}

/** Adds the VOLT_BOOTSTRAP_USERS accounts that do not exist yet; never changes an existing password. Returns the names added. */
export function bootstrapUsers(spec: string | undefined): string[] {
  const added: string[] = [];
  const existing = new Set(listUsernames().map(key));
  for (const pair of (spec ?? "").split(",")) {
    const i = pair.indexOf(":");
    if (i <= 0) continue;
    const name = pair.slice(0, i).trim();
    if (existing.has(key(name))) continue;
    setPassword(name, pair.slice(i + 1));
    existing.add(key(name));
    added.push(name);
  }
  return added;
}

const fails = new Map<string, { n: number; until: number }>();

/** Checks a password. Returns the account's stored name, or why it failed. Same work for unknown names, so timing reveals nothing. */
export function verifyPassword(name: unknown, password: unknown, now = Date.now()): { ok: true; username: string } | { ok: false; locked: boolean } {
  if (typeof name !== "string" || typeof password !== "string" || password.length > 200) return { ok: false, locked: false };
  const k = key(name);
  const f = fails.get(k);
  if (f && f.until > now) return { ok: false, locked: true };
  const all = readAll();
  const stored = Object.keys(all).find((n) => key(n) === k);
  const acct = stored ? all[stored] : undefined;
  const got = Buffer.from(scrypt(password, acct?.salt ?? "no-such-user-salt"), "hex");
  const ok = !!acct && crypto.timingSafeEqual(got, Buffer.from(acct.hash, "hex"));
  if (ok) {
    fails.delete(k);
    return { ok: true, username: stored! };
  }
  const n = (f?.n ?? 0) + 1;
  fails.set(k, n >= MAX_FAILS ? { n: 0, until: now + LOCK_MS } : { n, until: 0 });
  return { ok: false, locked: n >= MAX_FAILS };
}

export function resetLockouts(): void {
  fails.clear();
}

const sign = (secret: string, body: string) => crypto.createHmac("sha256", secret).update(body).digest("base64url");

/** A session value: base64url(username) . expiry . signature. */
export function makeSession(secret: string, username: string, ttlMs: number, now = Date.now()): string {
  const body = `${Buffer.from(username).toString("base64url")}.${now + ttlMs}`;
  return `${body}.${sign(secret, body)}`;
}

/** The username in a valid, unexpired session value whose account still exists, or undefined. */
export function readSession(secret: string, value: string | undefined, now = Date.now()): string | undefined {
  const parts = (value ?? "").split(".");
  if (parts.length !== 3) return undefined;
  const [user, exp, mac] = parts;
  const want = Buffer.from(sign(secret, `${user}.${exp}`));
  const given = Buffer.from(mac);
  if (want.length !== given.length || !crypto.timingSafeEqual(want, given)) return undefined;
  if (!(Number(exp) > now)) return undefined;
  const name = Buffer.from(user, "base64url").toString("utf8");
  return listUsernames().includes(name) ? name : undefined;
}
