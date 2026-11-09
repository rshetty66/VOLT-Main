/**
 * conversations-router.ts — per-user chat history over tRPC.
 * Every procedure degrades cleanly when the platform hasn't provisioned a
 * database: the client then stays on browser-local history and nothing here
 * is reachable in practice.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import * as q from "./queries/conversations";

const idInput = z.object({ id: z.string().min(1).max(64) });

// The client owns the VoltMessage shape; the server stores it opaquely and
// only bounds it so a runaway client can't write unbounded rows.
const saveInput = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(600),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
  messages: z.array(z.record(z.string(), z.unknown())).max(500),
});

const MAX_SERIALIZED = 1024 * 1024; // 1 MB of conversation JSON per row

export const conversationsRouter = createRouter({
  /** Lets the UI label history honestly: "synced" vs "this browser only". */
  enabled: publicQuery.query(() => ({ enabled: q.historyEnabled() })),

  list: authedQuery.query(async ({ ctx }) => {
    if (!q.historyEnabled()) return [];
    return q.listConversations(ctx.user.id);
  }),

  get: authedQuery.input(idInput).query(async ({ ctx, input }) => {
    if (!q.historyEnabled()) return null;
    return q.getConversation(ctx.user.id, input.id);
  }),

  save: authedQuery.input(saveInput).mutation(async ({ ctx, input }) => {
    if (!q.historyEnabled()) return { ok: false as const, reason: "disabled" };
    if (JSON.stringify(input.messages).length > MAX_SERIALIZED) {
      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message: "Conversation exceeds the 1 MB history limit.",
      });
    }
    await q.saveConversation(ctx.user.id, input);
    return { ok: true as const };
  }),

  remove: authedQuery.input(idInput).mutation(async ({ ctx, input }) => {
    if (!q.historyEnabled()) return { ok: false as const, reason: "disabled" };
    await q.deleteConversation(ctx.user.id, input.id);
    return { ok: true as const };
  }),
});
