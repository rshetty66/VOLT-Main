/**
 * Deleting client data: a whole engagement on request, and runs and client files older
 * than an engagement's retention period on a schedule. Spend from deleted runs is kept
 * (as monthly totals per person, in deleted_spend) so deleting never gives budget back.
 */
import type { Db } from "./db.js";
import { log } from "./log.js";

type Tx = Pick<Db, "query">;

export const RETENTION_CHOICES = [30, 90, 180, 365, 730] as const;
/** How often the server purges expired data while it runs. */
export const PURGE_EVERY_MS = 6 * 60 * 60 * 1000;

/** Moves the spend of the given runs into deleted_spend; call before deleting them. */
async function keepSpend(tx: Tx, where: string, args: unknown[]): Promise<void> {
  await tx.query(
    `insert into deleted_spend (user_id, month, cost_usd, runs, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens)
     select user_id, date_trunc('month', started_at)::date, sum(cost_usd), count(*), sum(input_tokens), sum(cache_write_tokens), sum(cache_read_tokens), sum(output_tokens)
     from runs where ${where} and mode = 'live' group by user_id, date_trunc('month', started_at)`,
    args,
  );
}

/** Deletes the given runs, then lead-agent conversations no remaining run uses. */
async function dropRuns(tx: Tx, where: string, args: unknown[]): Promise<{ runs: number; sessions: number }> {
  const { rows } = await tx.query<{ session_id: string }>(`delete from runs where ${where} returning session_id`, args);
  const ids = [...new Set(rows.map((r) => r.session_id))];
  const sessions = ids.length
    ? (await tx.query("delete from sessions s where s.id = any($1::text[]) and not exists (select 1 from runs r where r.session_id = s.id) returning s.id", [ids])).rows.length
    : 0;
  return { runs: rows.length, sessions };
}

export interface DeleteCounts {
  runs: number;
  files: number;
  sessions: number;
}

export class BusyError extends Error {}

/** Deletes an engagement and everything in it. Refuses while one of its runs is going. */
export async function deleteEngagement(db: Db, id: string): Promise<DeleteCounts> {
  return db.transaction(async (tx) => {
    const busy = await tx.query("select 1 from runs where engagement_id = $1 and status = 'running' limit 1", [id]);
    if (busy.rows.length) throw new BusyError("A run in this engagement is still going; stop it first.");
    const where = "engagement_id = $1";
    await keepSpend(tx, where, [id]);
    const { runs, sessions } = await dropRuns(tx, where, [id]);
    const files = (await tx.query("delete from client_files where engagement_id = $1 returning id", [id])).rows.length;
    await tx.query("delete from engagement_members where engagement_id = $1", [id]);
    await tx.query("delete from engagements where id = $1", [id]);
    return { runs, files, sessions };
  });
}

export async function setRetention(db: Db, id: string, days: number | null): Promise<void> {
  await db.query("update engagements set retention_days = $2, updated_at = now() where id = $1", [id, days]);
}

/** Deletes finished runs and client files older than their engagement's retention period. */
export async function purgeExpired(db: Db): Promise<DeleteCounts & { engagements: number }> {
  const { rows } = await db.query<{ id: string; days: number }>("select id, retention_days as days from engagements where retention_days is not null");
  const total = { runs: 0, files: 0, sessions: 0, engagements: 0 };
  for (const e of rows) {
    const counts = await db.transaction(async (tx) => {
      const args = [e.id, e.days];
      const where = "engagement_id = $1 and status <> 'running' and coalesce(finished_at, started_at) < now() - make_interval(days => $2::int)";
      await keepSpend(tx, where, args);
      const { runs, sessions } = await dropRuns(tx, where, args);
      const files = (await tx.query("delete from client_files where engagement_id = $1 and created_at < now() - make_interval(days => $2::int) returning id", args)).rows.length;
      return { runs, files, sessions };
    });
    if (counts.runs || counts.files) {
      total.engagements++;
      log.info("retention purge", { engagementId: e.id, days: e.days, ...counts });
    }
    total.runs += counts.runs;
    total.files += counts.files;
    total.sessions += counts.sessions;
  }
  return total;
}

/** Purges now and then every few hours; returns a function that stops the timer. */
export function scheduleRetention(db: Db, every = PURGE_EVERY_MS): () => void {
  const run = () => purgeExpired(db).catch((err) => log.error("retention purge failed", { err }));
  void run();
  const timer = setInterval(run, every);
  timer.unref();
  return () => clearInterval(timer);
}
