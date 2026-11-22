/**
 * store.ts — per-user Builder history persistence (D10).
 *
 * Three tables (see db/schema.ts): builder_projects (one per generated app
 * name), builder_sessions (one per workspace/session id), builder_artifacts
 * (one per finished build, holding the gate report). The filesystem
 * workspace stays the source of truth for code — these rows are the index
 * that lets a user see every app they asked for and how each build verified.
 *
 * Same deployment contract as api/queries/conversations.ts: the bundle ships
 * no migrations folder, tables are created lazily and idempotently on first
 * use, and when no DATABASE_URL is provisioned every function here is a
 * no-op (the Builder keeps working browser-side; history is simply absent).
 * Callers fire-and-forget with .catch(log.error) — persistence must never
 * break a build.
 */
import { createHash } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "../queries/connection";
import { historyEnabled } from "../queries/conversations";
import type { BuildOutcome } from "./codegen";
import type { BuildSpec } from "./spec";

/** Idempotent bootstrap DDL — mirrors db/schema.ts. Exported for tests. */
export function builderTablesDDL(): string[] {
  return [
    `CREATE TABLE IF NOT EXISTS builder_projects (
  id varchar(64) NOT NULL PRIMARY KEY,
  userId bigint unsigned NOT NULL,
  name varchar(255) NOT NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX builder_projects_userId_idx (userId)
)`,
    `CREATE TABLE IF NOT EXISTS builder_sessions (
  id varchar(64) NOT NULL PRIMARY KEY,
  projectId varchar(64) NOT NULL,
  userId bigint unsigned NOT NULL,
  prompt text NOT NULL,
  status enum('spec','building','passed','failed') NOT NULL DEFAULT 'spec',
  spec json,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX builder_sessions_userId_idx (userId),
  INDEX builder_sessions_projectId_idx (projectId)
)`,
    `CREATE TABLE IF NOT EXISTS builder_artifacts (
  id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sessionId varchar(64) NOT NULL,
  kind enum('build') NOT NULL DEFAULT 'build',
  summary varchar(255) NOT NULL,
  rounds json,
  gateResults json,
  events json,
  ok boolean NOT NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX builder_artifacts_sessionId_idx (sessionId)
)`,
  ];
}

let ensurePromise: Promise<void> | null = null;

function ensureTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      const db = getDb();
      for (const ddl of builderTablesDDL()) {
        await db.execute(sql.raw(ddl));
      }
    })().catch((err) => {
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

/** Stable project id for a (user, appName) pair so recompiles converge. */
export function projectIdFor(userId: number, appName: string): string {
  return createHash("sha256")
    .update(`${userId}:${appName.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 24);
}

/** Record a spec compile: upserts the project and the session row. */
export async function recordSpecCompile(
  userId: number,
  sessionId: string,
  prompt: string,
  spec: BuildSpec,
): Promise<void> {
  if (!historyEnabled()) return;
  await ensureTables();
  const db = getDb();
  const projectId = projectIdFor(userId, spec.appName);
  await db
    .insert(schema.builderProjects)
    .values({ id: projectId, userId, name: spec.appName.slice(0, 255) })
    .onDuplicateKeyUpdate({
      set: { name: spec.appName.slice(0, 255) },
    });
  await db
    .insert(schema.builderSessions)
    .values({
      id: sessionId.slice(0, 64),
      projectId,
      userId,
      prompt: prompt.slice(0, 16_000),
      status: "spec",
      spec,
    })
    .onDuplicateKeyUpdate({
      set: {
        prompt: prompt.slice(0, 16_000),
        status: "spec",
        spec,
      },
    });
}

/** Mark a session as building (build endpoint entered). */
export async function recordBuildStart(
  userId: number,
  sessionId: string,
): Promise<void> {
  if (!historyEnabled()) return;
  await ensureTables();
  await getDb()
    .update(schema.builderSessions)
    .set({ status: "building" })
    .where(
      and(
        eq(schema.builderSessions.id, sessionId.slice(0, 64)),
        eq(schema.builderSessions.userId, userId),
      ),
    );
}

/** Store the finished build's gate report and settle the session status. */
export async function recordBuildEnd(
  userId: number,
  sessionId: string,
  outcome: BuildOutcome,
): Promise<void> {
  if (!historyEnabled()) return;
  await ensureTables();
  const db = getDb();
  const ok = outcome.results.every((r) => r.status !== "fail");
  await db.insert(schema.builderArtifacts).values({
    sessionId: sessionId.slice(0, 64),
    kind: "build",
    summary: outcome.summary.slice(0, 255),
    rounds: outcome.rounds,
    gateResults: outcome.results,
    events: outcome.events.slice(-200),
    ok,
  });
  await db
    .update(schema.builderSessions)
    .set({ status: ok ? "passed" : "failed" })
    .where(
      and(
        eq(schema.builderSessions.id, sessionId.slice(0, 64)),
        eq(schema.builderSessions.userId, userId),
      ),
    );
}

export interface BuilderSessionSummary {
  id: string;
  projectName: string;
  prompt: string;
  status: "spec" | "building" | "passed" | "failed";
  updatedAt: Date;
}

/** Newest-first session list for the Builder surface, with project names. */
export async function listBuilderSessions(
  userId: number,
): Promise<BuilderSessionSummary[]> {
  if (!historyEnabled()) return [];
  await ensureTables();
  const rows = await getDb()
    .select({
      id: schema.builderSessions.id,
      projectName: schema.builderProjects.name,
      prompt: schema.builderSessions.prompt,
      status: schema.builderSessions.status,
      updatedAt: schema.builderSessions.updatedAt,
    })
    .from(schema.builderSessions)
    .innerJoin(
      schema.builderProjects,
      eq(schema.builderSessions.projectId, schema.builderProjects.id),
    )
    .where(eq(schema.builderSessions.userId, userId))
    .orderBy(desc(schema.builderSessions.updatedAt))
    .limit(50);
  return rows;
}

export interface BuilderSessionDetail extends BuilderSessionSummary {
  spec: BuildSpec | null;
  lastBuild: {
    summary: string;
    ok: boolean;
    rounds: unknown;
    gateResults: unknown;
    events: unknown;
    createdAt: Date;
  } | null;
}

/** One session with its spec and latest build artifact. */
export async function getBuilderSession(
  userId: number,
  sessionId: string,
): Promise<BuilderSessionDetail | null> {
  if (!historyEnabled()) return null;
  await ensureTables();
  const db = getDb();
  const sessions = await db
    .select({
      id: schema.builderSessions.id,
      projectName: schema.builderProjects.name,
      prompt: schema.builderSessions.prompt,
      status: schema.builderSessions.status,
      updatedAt: schema.builderSessions.updatedAt,
      spec: schema.builderSessions.spec,
    })
    .from(schema.builderSessions)
    .innerJoin(
      schema.builderProjects,
      eq(schema.builderSessions.projectId, schema.builderProjects.id),
    )
    .where(
      and(
        eq(schema.builderSessions.id, sessionId.slice(0, 64)),
        eq(schema.builderSessions.userId, userId),
      ),
    )
    .limit(1);
  const row = sessions.at(0);
  if (!row) return null;
  const artifacts = await db
    .select({
      summary: schema.builderArtifacts.summary,
      ok: schema.builderArtifacts.ok,
      rounds: schema.builderArtifacts.rounds,
      gateResults: schema.builderArtifacts.gateResults,
      events: schema.builderArtifacts.events,
      createdAt: schema.builderArtifacts.createdAt,
    })
    .from(schema.builderArtifacts)
    .where(eq(schema.builderArtifacts.sessionId, sessionId.slice(0, 64)))
    .orderBy(desc(schema.builderArtifacts.id))
    .limit(1);
  const art = artifacts.at(0) ?? null;
  return {
    id: row.id,
    projectName: row.projectName,
    prompt: row.prompt,
    status: row.status,
    updatedAt: row.updatedAt,
    spec: (row.spec as BuildSpec | null) ?? null,
    lastBuild: art
      ? {
          summary: art.summary,
          ok: art.ok,
          rounds: art.rounds,
          gateResults: art.gateResults,
          events: art.events,
          createdAt: art.createdAt,
        }
      : null,
  };
}
