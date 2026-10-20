/**
 * Embedded Postgres (PGlite) for the console's saved engagements and runs.
 *
 * Data lives in VOLT_DATA_DIR (default apps/volt-console/.volt-data). Without a
 * directory the database is in memory, which the tests use. Migrations are the
 * numbered .sql files in server/migrations, applied once each, in order.
 * The Db interface is the query/exec subset node-postgres also offers, so a
 * hosted Postgres can replace PGlite later without touching the store.
 */
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { DEFAULT_DATA_DIR, MIGRATIONS_DIR } from "./paths.js";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  /** Runs fn in one transaction: all its queries apply, or none if it throws. */
  transaction<T>(fn: (tx: Pick<Db, "query" | "exec">) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export { DEFAULT_DATA_DIR };

export async function openDb(dataDir?: string): Promise<Db> {
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir);
  await migrate(db);
  return db as unknown as Db;
}

async function migrate(db: PGlite) {
  await db.exec("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const applied = new Set((await db.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into schema_migrations (name) values ($1)", [file]);
    });
  }
}
