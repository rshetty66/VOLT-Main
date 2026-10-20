/**
 * Local sign-in: users with scrypt-hashed passwords, cookie sessions, the audit
 * log, and the access rules every API route applies.
 *
 * Roles: admins see and change everything; consultants work on engagements they
 * own or were added to (and their own runs outside any engagement); viewers can
 * read and download what they were given, but not start, stop or resume runs,
 * or change engagements and templates.
 */
import crypto from "node:crypto";
import { promisify } from "node:util";
import type { AuditEntry, Role, RunSummary, User } from "../shared/records.js";
import type { Db } from "./db.js";
import { isMember, isUuid, type Scope } from "./store.js";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
export const SESSION_DAYS = 14;
export const COOKIE = "volt_session";

type Row = Record<string, any>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const toUser = (r: Row): User => ({ id: r.id, email: r.email, name: r.name, role: r.role, disabled: r.disabled, createdAt: iso(r.created_at)!, lastLoginAt: iso(r.last_login_at) });

// ── Passwords ────────────────────────────────────────────────────────────────

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Passwords need at least 10 characters.";
  if (pw.length > 200) return "Passwords can be at most 200 characters.";
  return null;
}

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(pw, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(pw, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(actual, expected);
}

/** A hash to compare against when the email is unknown, so a failed sign-in takes the same time either way. */
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword("not-a-real-password"));

// ── Users ────────────────────────────────────────────────────────────────────

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export async function countUsers(db: Db): Promise<number> {
  return (await db.query<{ n: number }>("select count(*)::int as n from users")).rows[0].n;
}

export async function listUsers(db: Db): Promise<User[]> {
  return (await db.query<Row>("select * from users order by lower(name)")).rows.map(toUser);
}

export async function getUser(db: Db, id: string): Promise<User | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<Row>("select * from users where id = $1", [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function createUser(db: Db, u: { email: string; name: string; role: Role; password: string }): Promise<User> {
  const { rows } = await db.query<Row>("insert into users (email, name, role, password_hash) values ($1, $2, $3, $4) returning *", [
    normaliseEmail(u.email),
    u.name.trim(),
    u.role,
    await hashPassword(u.password),
  ]);
  return toUser(rows[0]);
}

export async function updateUser(db: Db, id: string, patch: { name?: string; role?: Role; disabled?: boolean }): Promise<User | null> {
  const user = await getUser(db, id);
  if (!user) return null;
  const { rows } = await db.query<Row>("update users set name = $2, role = $3, disabled = $4 where id = $1 returning *", [
    id,
    patch.name?.trim() || user.name,
    patch.role ?? user.role,
    patch.disabled ?? user.disabled,
  ]);
  if (patch.disabled) await endSessions(db, id);
  return toUser(rows[0]);
}

export async function setPassword(db: Db, id: string, password: string, keepTokenHash?: string): Promise<void> {
  await db.query("update users set password_hash = $2 where id = $1", [id, await hashPassword(password)]);
  await endSessions(db, id, keepTokenHash);
}

/** Admins other than `exceptId` who can still sign in. */
export async function otherActiveAdmins(db: Db, exceptId: string): Promise<number> {
  return (await db.query<{ n: number }>("select count(*)::int as n from users where role = 'admin' and not disabled and id <> $1", [exceptId])).rows[0].n;
}

/** Checks an email and password; null when either is wrong or the account is disabled. */
export async function checkCredentials(db: Db, email: string, password: string): Promise<User | null> {
  const { rows } = await db.query<Row>("select * from users where email = $1", [normaliseEmail(email)]);
  const row = rows[0];
  const ok = await verifyPassword(password, row?.password_hash ?? (await dummy()));
  if (!row || !ok || row.disabled) return null;
  await db.query("update users set last_login_at = now() where id = $1", [row.id]);
  return toUser(row);
}

/** Hands engagements, runs and conversations saved before sign-in existed to the first admin. */
export async function claimUnownedData(db: Db, adminId: string): Promise<void> {
  await db.query("update engagements set owner_id = $1 where owner_id is null", [adminId]);
  await db.query("update runs set user_id = $1 where user_id is null", [adminId]);
  await db.query("update sessions set user_id = $1 where user_id is null", [adminId]);
}

// ── Sessions ─────────────────────────────────────────────────────────────────

export const tokenHash = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function startSession(db: Db, userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.query(`insert into auth_sessions (token_hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [tokenHash(token), userId]);
  return token;
}

/** The signed-in user for a cookie token. Sessions slide: each use (at most every 5 minutes) pushes expiry out again. */
export async function userForToken(db: Db, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const { rows } = await db.query<Row>(
    `select u.*, s.last_seen_at < now() - interval '5 minutes' as stale from auth_sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() and not u.disabled`,
    [tokenHash(token)],
  );
  if (!rows[0]) return null;
  if (rows[0].stale) {
    await db.query(`update auth_sessions set last_seen_at = now(), expires_at = now() + interval '${SESSION_DAYS} days' where token_hash = $1`, [tokenHash(token)]);
  }
  return toUser(rows[0]);
}

export async function endSession(db: Db, token: string): Promise<void> {
  await db.query("delete from auth_sessions where token_hash = $1", [tokenHash(token)]);
}

export async function endSessions(db: Db, userId: string, keepTokenHash?: string): Promise<void> {
  await db.query("delete from auth_sessions where user_id = $1 and token_hash <> $2", [userId, keepTokenHash ?? ""]);
}

/** Reads one cookie from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`;
}
export const clearCookie = `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;

// ── Sign-in throttling ───────────────────────────────────────────────────────

const FAILURES_ALLOWED = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; first: number }>();

/** Minutes left on a lock for this email and address, or 0. */
export function lockedFor(key: string, now = Date.now()): number {
  const f = failures.get(key);
  if (!f || now - f.first > LOCK_MS) return 0;
  return f.count >= FAILURES_ALLOWED ? Math.ceil((LOCK_MS - (now - f.first)) / 60000) : 0;
}

export function recordFailure(key: string, now = Date.now()) {
  const f = failures.get(key);
  if (!f || now - f.first > LOCK_MS) failures.set(key, { count: 1, first: now });
  else f.count++;
}

export const clearFailures = (key: string) => failures.delete(key);

// ── Access rules ─────────────────────────────────────────────────────────────

export type Access = "none" | "read" | "write";

export const scopeFor = (user: User): Scope => (user.role === "admin" ? { all: true } : { userId: user.id });
export const canWrite = (user: User) => user.role !== "viewer";

/** What a user may do with an engagement. */
export async function engagementAccess(db: Db, user: User, engagementId: string): Promise<Access> {
  if (user.role === "admin") return "write";
  if (!(await isMember(db, engagementId, user.id))) return "none";
  return canWrite(user) ? "write" : "read";
}

/** What a user may do with a run: through its engagement, or as its starter when it has none. */
export async function runAccess(db: Db, user: User, run: Pick<RunSummary, "engagementId" | "userId">): Promise<Access> {
  if (user.role === "admin") return "write";
  if (run.engagementId) return engagementAccess(db, user, run.engagementId);
  if (run.userId !== user.id) return "none";
  return canWrite(user) ? "write" : "read";
}

// ── Audit log ────────────────────────────────────────────────────────────────

export async function audit(db: Db, userId: string | null, action: string, target?: { type: string; id: string }, detail?: Record<string, unknown>): Promise<void> {
  try {
    await db.query("insert into audit_log (user_id, action, target_type, target_id, detail) values ($1, $2, $3, $4, $5)", [
      userId,
      action,
      target?.type ?? null,
      target?.id ?? null,
      detail ? JSON.stringify(detail) : null,
    ]);
  } catch (err) {
    console.error(`Could not write audit entry ${action}:`, err);
  }
}

export async function listAudit(db: Db, limit = 200): Promise<AuditEntry[]> {
  const { rows } = await db.query<Row>(
    "select a.*, u.name as user_name from audit_log a left join users u on u.id = a.user_id order by a.at desc, a.id desc limit $1",
    [Math.min(Math.max(limit, 1), 1000)],
  );
  return rows.map((r) => ({ id: Number(r.id), at: iso(r.at)!, userId: r.user_id, userName: r.user_name, action: r.action, targetType: r.target_type, targetId: r.target_id, detail: r.detail }));
}
