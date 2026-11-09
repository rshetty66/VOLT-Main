import { authRouter } from "./auth-router";
import { conversationsRouter } from "./conversations-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  conversations: conversationsRouter,
});

export type AppRouter = typeof appRouter;
