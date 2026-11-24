/**
 * A run's time budget. The host can stop a function mid-answer (Vercel stops one at 300 seconds), which loses the whole
 * answer. With a budget the server ends the run cleanly just before that, so what was written so far is kept, and it
 * skips the optional rewrite when too little time is left for it.
 *
 *   VOLT_RUN_BUDGET_SECONDS   seconds a run may take; 0 turns it off. Default: 270 on Vercel, off elsewhere.
 */
export function runBudgetMs(env: NodeJS.ProcessEnv = process.env): number {
  const set = env.VOLT_RUN_BUDGET_SECONDS;
  const seconds = set !== undefined && set !== "" ? Number(set) : env.VERCEL ? 270 : 0;
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
}

/** True when a rewrite (about two minutes) would not fit: more than half the budget is already used. */
export function lateForRewrite(elapsedMs: number, budgetMs: number): boolean {
  return budgetMs > 0 && elapsedMs > budgetMs * 0.5;
}
