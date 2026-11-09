/**
 * conversations.ts — server-side chat history, one row per conversation.
 *
 * The deploy bundle ships no migrations folder and nothing runs db:push in
 * production, so the table is created lazily (idempotent, cached per process)
 * on first use. When the platform hasn't provisioned a DATABASE_URL the whole
 * feature is simply disabled — the client then keeps its browser-local
 * history and never calls these routes.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import * as schema from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

/** Server-side history only makes sense with a database. */
export const historyEnabled = () => Boolean(env.databaseUrl);

/** Keep the newest N conversations per user. */
const MAX_CONVS_PER_USER = 50;

let ensurePromise: Promise<void> | null = null;

/** Idempotent bootstrap — safe to await on every request. */
function ensureTables(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await getDb().execute(sql.raw(`CREATE TABLE IF NOT EXISTS conversations (
  id varchar(64) NOT NULL PRIMARY KEY,
  userId bigint unsigned NOT NULL,
  title varchar(255) NOT NULL,
  messages json NOT NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX conversations_userId_idx (userId)
)`));
    })().catch((err) => {
      // A failed bootstrap must not poison every later request — retry next time.
      ensurePromise = null;
      throw err;
    });
  }
  return ensurePromise;
}

export interface StoredConversationInput {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: unknown[];
}

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export async function listConversations(
  userId: number,
): Promise<ConversationSummary[]> {
  await ensureTables();
  const rows = await getDb()
    .select({
      id: schema.conversations.id,
      title: schema.conversations.title,
      createdAt: schema.conversations.createdAt,
      updatedAt: schema.conversations.updatedAt,
      messageCount: sql<number>`json_length(${schema.conversations.messages})`,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, userId))
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(MAX_CONVS_PER_USER);
  return rows.map((r) => ({ ...r, messageCount: Number(r.messageCount) }));
}

export async function getConversation(userId: number, id: string) {
  await ensureTables();
  const rows = await getDb()
    .select()
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.userId, userId),
      ),
    )
    .limit(1);
  return rows.at(0) ?? null;
}

export async function saveConversation(
  userId: number,
  conv: StoredConversationInput,
): Promise<void> {
  await ensureTables();
  const db = getDb();
  await db
    .insert(schema.conversations)
    .values({
      id: conv.id,
      userId,
      title: conv.title.slice(0, 255),
      messages: conv.messages,
      createdAt: new Date(conv.createdAt),
      updatedAt: new Date(conv.updatedAt),
    })
    .onDuplicateKeyUpdate({
      set: {
        title: conv.title.slice(0, 255),
        messages: conv.messages,
        updatedAt: new Date(conv.updatedAt),
      },
    });
  // Trim history to the newest N — same cap policy as the browser-local store.
  await db.execute(
    sql`DELETE FROM conversations
        WHERE userId = ${userId}
          AND id NOT IN (
            SELECT id FROM (
              SELECT id FROM conversations
              WHERE userId = ${userId}
              ORDER BY updatedAt DESC
              LIMIT ${MAX_CONVS_PER_USER}
            ) keep
          )`,
  );
}

export async function deleteConversation(
  userId: number,
  id: string,
): Promise<void> {
  await ensureTables();
  await getDb()
    .delete(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, id),
        eq(schema.conversations.userId, userId),
      ),
    );
}
