/** Reads and writes engagements, runs, run events and lead-agent sessions. */
import type { RunKind, RunMode, VoltEvent } from "../shared/events.js";
import type { Engagement, RunStatus, RunSummary, StoredRun } from "../shared/records.js";
import type { Db } from "./db.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

type Row = Record<string, any>;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));

function toEngagement(r: Row): Engagement {
  return {
    id: r.id,
    clientName: r.client_name,
    title: r.title,
    description: r.description,
    createdAt: iso(r.created_at)!,
    updatedAt: iso(r.updated_at)!,
    runCount: Number(r.run_count ?? 0),
    lastRunAt: iso(r.last_run_at),
    templateId: r.template_id ?? null,
    templateName: r.template_name ?? null,
    ownerId: r.owner_id ?? null,
    ownerName: r.owner_name ?? null,
  };
}

function toRunSummary(r: Row): RunSummary {
  return {
    id: r.id,
    engagementId: r.engagement_id,
    userId: r.user_id ?? null,
    sessionId: r.session_id,
    kind: r.kind,
    title: r.title,
    prompt: r.prompt,
    workflowId: r.workflow_id,
    agentId: r.agent_id,
    mode: r.mode,
    model: r.model,
    status: r.status,
    error: r.error,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    startedAt: iso(r.started_at)!,
    finishedAt: iso(r.finished_at),
  };
}

const ENGAGEMENT_SELECT = `
  select e.*, t.name as template_name, u.name as owner_name, count(r.id)::int as run_count, max(r.started_at) as last_run_at
  from engagements e left join runs r on r.engagement_id = e.id left join templates t on t.id = e.template_id
  left join users u on u.id = e.owner_id`;

/** SQL true when user $N owns or is a member of engagement alias `e`. */
const MEMBER_OF = (n: number) => `(e.owner_id = $${n} or exists (select 1 from engagement_members m where m.engagement_id = e.id and m.user_id = $${n}))`;

/** Whose data a query may return: everything, or what one user owns, shares or started. */
export type Scope = { all: true } | { userId: string };
export const ALL: Scope = { all: true };

export async function createEngagement(
  db: Db,
  input: { clientName: string; title: string; description?: string; templateId?: string | null; ownerId?: string | null },
): Promise<Engagement> {
  const { rows } = await db.query<Row>(
    "insert into engagements (client_name, title, description, template_id, owner_id) values ($1, $2, $3, $4, $5) returning id",
    [input.clientName, input.title, input.description ?? "", input.templateId ?? null, input.ownerId ?? null],
  );
  return (await getEngagement(db, rows[0].id))!;
}

/** Assigns a template to an engagement; null returns it to the application standard. */
export async function setEngagementTemplate(db: Db, id: string, templateId: string | null): Promise<Engagement | null> {
  if (!isUuid(id)) return null;
  await db.query("update engagements set template_id = $2, updated_at = now() where id = $1", [id, templateId]);
  return getEngagement(db, id);
}

export async function listEngagements(db: Db, scope: Scope = ALL): Promise<Engagement[]> {
  const where = "userId" in scope ? `where ${MEMBER_OF(1)}` : "";
  const { rows } = await db.query<Row>(
    `${ENGAGEMENT_SELECT} ${where} group by e.id, t.name, u.name order by coalesce(max(r.started_at), e.created_at) desc`,
    "userId" in scope ? [scope.userId] : [],
  );
  return rows.map(toEngagement);
}

/** True when the user owns or is a member of the engagement. */
export async function isMember(db: Db, engagementId: string, userId: string): Promise<boolean> {
  if (!isUuid(engagementId)) return false;
  const { rows } = await db.query<Row>(`select 1 from engagements e where e.id = $2 and ${MEMBER_OF(1)}`, [userId, engagementId]);
  return rows.length > 0;
}

export async function listMembers(db: Db, engagementId: string): Promise<{ id: string; name: string; email: string; role: string }[]> {
  const { rows } = await db.query<Row>(
    "select u.id, u.name, u.email, u.role from engagement_members m join users u on u.id = m.user_id where m.engagement_id = $1 order by lower(u.name)",
    [engagementId],
  );
  return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, role: r.role }));
}

export async function addMember(db: Db, engagementId: string, userId: string): Promise<void> {
  await db.query("insert into engagement_members (engagement_id, user_id) values ($1, $2) on conflict do nothing", [engagementId, userId]);
}

export async function removeMember(db: Db, engagementId: string, userId: string): Promise<void> {
  await db.query("delete from engagement_members where engagement_id = $1 and user_id = $2", [engagementId, userId]);
}

export async function getEngagement(db: Db, id: string): Promise<Engagement | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<Row>(`${ENGAGEMENT_SELECT} where e.id = $1 group by e.id, t.name, u.name`, [id]);
  return rows[0] ? toEngagement(rows[0]) : null;
}

export interface NewRun {
  id: string;
  engagementId?: string;
  userId?: string;
  sessionId: string;
  kind: RunKind;
  title: string;
  prompt: string;
  workflowId?: string;
  agentId?: string;
  intake?: Record<string, string>;
  mode: RunMode;
  model: string;
}

export async function createRun(db: Db, run: NewRun): Promise<void> {
  await db.query(
    `insert into runs (id, engagement_id, session_id, kind, title, prompt, workflow_id, agent_id, intake, mode, model, user_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [run.id, run.engagementId ?? null, run.sessionId, run.kind, run.title, run.prompt, run.workflowId ?? null, run.agentId ?? null, run.intake ? JSON.stringify(run.intake) : null, run.mode, run.model, run.userId ?? null],
  );
  if (run.engagementId) await db.query("update engagements set updated_at = now() where id = $1", [run.engagementId]);
}

export async function appendEvents(db: Db, runId: string, firstSeq: number, events: VoltEvent[]): Promise<void> {
  if (events.length === 0) return;
  const values = events.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ");
  const params: unknown[] = [runId];
  events.forEach((e, i) => params.push(firstSeq + i, JSON.stringify(e)));
  await db.query(`insert into run_events (run_id, seq, event) values ${values}`, params);
}

export async function finishRun(
  db: Db,
  id: string,
  result: { status: RunStatus; finalText: string; error?: string; inputTokens: number; outputTokens: number; cacheReadTokens: number },
): Promise<void> {
  await db.query(
    `update runs set status = $2, final_text = $3, error = $4, input_tokens = $5, output_tokens = $6, cache_read_tokens = $7, finished_at = now()
     where id = $1`,
    [id, result.status, result.finalText, result.error ?? null, result.inputTokens, result.outputTokens, result.cacheReadTokens],
  );
}

/** Runs left 'running' by a server that stopped mid-run can never finish: mark them. */
export async function markInterruptedRuns(db: Db): Promise<number> {
  const { rows } = await db.query<Row>(
    "update runs set status = 'error', error = 'The server stopped before this run finished.', finished_at = now() where status = 'running' returning id",
  );
  return rows.length;
}

export async function listRuns(db: Db, opts: { engagementId?: string; limit?: number; scope?: Scope } = {}): Promise<RunSummary[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const scope = opts.scope ?? ALL;
  if (opts.engagementId) {
    const { rows } = await db.query<Row>("select * from runs where engagement_id = $1 order by started_at desc limit $2", [opts.engagementId, limit]);
    return rows.map(toRunSummary);
  }
  if ("userId" in scope) {
    // A user's runs: those in engagements they own or share, and their own runs outside any engagement.
    const { rows } = await db.query<Row>(
      `select r.* from runs r left join engagements e on e.id = r.engagement_id
       where (r.engagement_id is null and r.user_id = $1) or (r.engagement_id is not null and ${MEMBER_OF(1)})
       order by r.started_at desc limit $2`,
      [scope.userId, limit],
    );
    return rows.map(toRunSummary);
  }
  const { rows } = await db.query<Row>("select * from runs order by started_at desc limit $1", [limit]);
  return rows.map(toRunSummary);
}

/** The runs that used a lead-agent session (its conversation), for checking who may continue it. */
export async function runsForSession(db: Db, sessionId: string): Promise<RunSummary[]> {
  const { rows } = await db.query<Row>("select * from runs where session_id = $1", [sessionId]);
  return rows.map(toRunSummary);
}

export async function getRun(db: Db, id: string): Promise<StoredRun | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<Row>("select * from runs where id = $1", [id]);
  if (!rows[0]) return null;
  const events = await db.query<{ event: VoltEvent }>("select event from run_events where run_id = $1 order by seq", [id]);
  return { ...toRunSummary(rows[0]), intake: rows[0].intake, finalText: rows[0].final_text, events: events.rows.map((r) => r.event) };
}

export interface StoredSession {
  agentId?: string;
  messages: unknown[];
}

export async function loadSession(db: Db, id: string): Promise<StoredSession | null> {
  const { rows } = await db.query<Row>("select agent_id, messages from sessions where id = $1", [id]);
  return rows[0] ? { agentId: rows[0].agent_id ?? undefined, messages: rows[0].messages } : null;
}

export async function saveSession(db: Db, s: { id: string; agentId?: string; messages: unknown[]; userId?: string }): Promise<void> {
  await db.query(
    `insert into sessions (id, agent_id, messages, user_id, updated_at) values ($1, $2, $3, $4, now())
     on conflict (id) do update set agent_id = excluded.agent_id, messages = excluded.messages, updated_at = now()`,
    [s.id, s.agentId ?? null, JSON.stringify(s.messages), s.userId ?? null],
  );
}
