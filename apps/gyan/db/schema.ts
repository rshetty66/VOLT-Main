import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  json,
  boolean,
  index,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Chat history, one row per conversation. The full message list is stored as
 * JSON — the client owns the VoltMessage shape and syncs whole conversations,
 * so a separate messages table would only add bookkeeping. Tied to the signed
 *-in user; the app still works (browser-local history) when no DB is
 * provisioned, so this table is created lazily by api/queries/conversations.
 */
export const conversations = mysqlTable(
  "conversations",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    messages: json("messages").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("conversations_userId_idx").on(t.userId)],
);

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

/**
 * Builder (D10) — one project per generated app name, sessions are build
 * attempts, artifacts are the verification output of a build. Same contract
 * as conversations: the deploy bundle ships no migrations folder, so the
 * tables are created lazily by api/builder/store.ts on first use, and the
 * whole Builder history feature is simply disabled when no DATABASE_URL is
 * provisioned. The filesystem workspace under BUILDER_DATA_DIR remains the
 * source of truth for code; these rows are the per-user index and the
 * durable record of what was built and how it verified.
 */
export const builderProjects = mysqlTable(
  "builder_projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("builder_projects_userId_idx").on(t.userId)],
);

export type BuilderProject = typeof builderProjects.$inferSelect;
export type InsertBuilderProject = typeof builderProjects.$inferInsert;

export const builderSessions = mysqlTable(
  "builder_sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    projectId: varchar("projectId", { length: 64 }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    prompt: text("prompt").notNull(),
    status: mysqlEnum("status", ["spec", "building", "passed", "failed"])
      .default("spec")
      .notNull(),
    spec: json("spec"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("builder_sessions_userId_idx").on(t.userId),
    index("builder_sessions_projectId_idx").on(t.projectId),
  ],
);

export type BuilderSession = typeof builderSessions.$inferSelect;
export type InsertBuilderSession = typeof builderSessions.$inferInsert;

export const builderArtifacts = mysqlTable(
  "builder_artifacts",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("sessionId", { length: 64 }).notNull(),
    kind: mysqlEnum("kind", ["build"]).default("build").notNull(),
    summary: varchar("summary", { length: 255 }).notNull(),
    rounds: json("rounds"),
    gateResults: json("gateResults"),
    events: json("events"),
    ok: boolean("ok").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("builder_artifacts_sessionId_idx").on(t.sessionId)],
);

export type BuilderArtifact = typeof builderArtifacts.$inferSelect;
export type InsertBuilderArtifact = typeof builderArtifacts.$inferInsert;
