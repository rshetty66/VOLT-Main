/**
 * Spend: budgets, the estimate shown before a run, and the Usage view's summaries.
 * Costs are estimates from the price table, not invoices.
 */
import type { Catalog } from "./catalog.js";
import { callCost, roundUsd, type Price } from "./cost.js";
import type { Db } from "./db.js";
import { MODEL } from "./orchestrator.js";
import type { BudgetStatus, CostSettings, Estimate, UsageSummary } from "../shared/records.js";

type Row = Record<string, any>;


/** What a person has spent this calendar month (server time), including runs still going. */
export async function monthSpent(db: Db, userId: string): Promise<number> {
  const { rows } = await db.query<{ usd: number }>(
    "select coalesce(sum(cost_usd), 0)::float8 as usd from runs where user_id = $1 and started_at >= date_trunc('month', now())",
    [userId],
  );
  return Number(rows[0].usd);
}

export async function budgetFor(db: Db, settings: CostSettings, userId: string): Promise<BudgetStatus> {
  const { rows } = await db.query<Row>("select monthly_budget_usd from users where id = $1", [userId]);
  const own = rows[0]?.monthly_budget_usd;
  const monthly = own == null ? settings.monthlyBudgetUsd : Number(own);
  const spent = await monthSpent(db, userId);
  return {
    runBudgetUsd: settings.runBudgetUsd,
    monthlyBudgetUsd: monthly,
    monthSpentUsd: roundUsd(spent),
    monthRemainingUsd: monthly > 0 ? roundUsd(Math.max(0, monthly - spent)) : null,
    warnAt: settings.warnAt,
  };
}

/** Why this person cannot start a live run now, or null. */
export function budgetBlock(b: BudgetStatus): string | null {
  if (b.monthlyBudgetUsd > 0 && b.monthSpentUsd >= b.monthlyBudgetUsd) {
    return `You have used your monthly Claude budget ($${b.monthSpentUsd.toFixed(2)} of $${b.monthlyBudgetUsd.toFixed(2)}). An admin can raise it under Usage, or use demo mode.`;
  }
  return null;
}

/**
 * Watches a run's spend against its own budget and the person's monthly budget. `add` returns
 * a warning to show once, or a reason to stop the run.
 */
export function budgetGuard(b: BudgetStatus, opts: { resumable?: boolean } = {}) {
  const after = opts.resumable ? " Finished specialists are kept: an admin can raise the limit under Usage, then Resume." : " An admin can raise the limit under Usage.";
  let runCost = 0;
  const warned = new Set<string>();
  const limits = [
    { key: "run", limit: b.runBudgetUsd, spent: () => runCost, label: "this run's budget" },
    { key: "month", limit: b.monthlyBudgetUsd, spent: () => b.monthSpentUsd + runCost, label: "your monthly budget" },
  ].filter((l) => l.limit > 0);
  return {
    get cost() {
      return runCost;
    },
    add(usd: number): { warn?: string; stop?: string } {
      runCost += usd;
      for (const l of limits) {
        if (l.spent() >= l.limit) return { stop: `Stopped: ${l.label} of $${l.limit.toFixed(2)} was reached ($${l.spent().toFixed(2)}).${after}` };
      }
      for (const l of limits) {
        if (!warned.has(l.key) && l.spent() >= l.limit * b.warnAt) {
          warned.add(l.key);
          return { warn: `Budget: $${l.spent().toFixed(2)} of ${l.label} ($${l.limit.toFixed(2)}) used` };
        }
      }
      return {};
    },
  };
}

// ── Estimate before a run ────────────────────────────────────────────────────


const cost = (prices: Record<string, Price>, model: string, write: number, read: number, input: number, output: number) =>
  callCost(prices, model, { inputTokens: input, cacheWriteTokens: write, cacheReadTokens: read, outputTokens: output });

/** Typical tokens for one specialist with `prior` earlier handoffs in its brief (about three model calls). */
const specialist = (prices: Record<string, Price>, model: string, prior: number) => {
  const prompt = 2000 + prior * 350;
  return cost(prices, model, prompt + 3000, 2 * prompt + 3000, 300, 5000);
};

export function roughEstimate(catalog: Catalog, settings: CostSettings, q: { workflowId?: string; agentId?: string }): number {
  const { prices, specialistModel } = settings;
  if (q.workflowId) {
    const wf = catalog.workflowById.get(q.workflowId);
    if (!wf) return 0;
    let usd = 0;
    let prior = 0;
    for (const phase of wf.phases) {
      for (let i = 0; i < phase.agents.length; i++) usd += specialist(prices, specialistModel, prior);
      prior += phase.agents.length;
    }
    const synth = 4000 + prior * 2000;
    return usd + cost(prices, MODEL, synth + 4000, 2 * synth + 4000, 300, 12000);
  }
  if (q.agentId && q.agentId !== "rudra") return cost(prices, MODEL, 4000, 8000, 300, 4000);
  // Rudra: a large cached roster, a few consults, then the answer.
  return cost(prices, MODEL, 24000, 40000, 1000, 6000) + 2 * specialist(prices, specialistModel, 0);
}

export async function estimateRun(db: Db, catalog: Catalog, settings: CostSettings, q: { workflowId?: string; agentId?: string }): Promise<Estimate> {
  // Only runs recorded with cache accounting (A2 and later), finished in full, and not resumed.
  const where = q.workflowId ? "workflow_id = $1" : q.agentId && q.agentId !== "rudra" ? "kind = 'agent' and agent_id = $1" : "kind = 'orchestrate' and $1::text is null";
  const { rows } = await db.query<{ usd: number }>(
    `select cost_usd::float8 as usd from runs
     where ${where} and mode = 'live' and status = 'done' and cost_usd > 0 and cache_write_tokens > 0 and resumed_from is null and title not like '% (resumed)'
     order by started_at desc limit 5`,
    [q.workflowId ?? (q.agentId && q.agentId !== "rudra" ? q.agentId : null)],
  );
  const costs = rows.map((r) => Number(r.usd)).sort((a, b) => a - b);
  if (costs.length) {
    const mid = costs[Math.floor(costs.length / 2)];
    return { usd: roundUsd(mid), low: roundUsd(costs[0]), high: roundUsd(costs.at(-1)!), basis: "history", runs: costs.length };
  }
  const usd = roughEstimate(catalog, settings, q);
  return { usd: roundUsd(usd), low: roundUsd(usd * 0.6), high: roundUsd(usd * 1.8), basis: "rough", runs: 0 };
}

// ── Usage view ───────────────────────────────────────────────────────────────


const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

export async function usageSummary(db: Db, settings: CostSettings, me: { id: string; role: string }): Promise<UsageSummary> {
  const everyone = me.role === "admin";
  const who = everyone ? "true" : "r.user_id = $1";
  const args = everyone ? [] : [me.id];
  const month = "r.started_at >= date_trunc('month', now())";

  const total = (await db.query<Row>(`select coalesce(sum(r.cost_usd), 0)::float8 as usd, count(*)::int as n from runs r where ${who} and ${month} and r.mode = 'live'`, args)).rows[0];

  const people = everyone
    ? (
        await db.query<Row>(
          `select u.id, u.name, u.email, u.disabled, u.monthly_budget_usd,
                  coalesce(sum(r.cost_usd) filter (where ${month} and r.mode = 'live'), 0)::float8 as usd,
                  count(r.id) filter (where ${month} and r.mode = 'live')::int as n
           from users u left join runs r on r.user_id = u.id
           group by u.id order by usd desc, lower(u.name)`,
        )
      ).rows
    : [];

  const engagements = (
    await db.query<Row>(
      `select r.engagement_id, e.client_name, e.title, sum(r.cost_usd)::float8 as usd, count(*)::int as n
       from runs r left join engagements e on e.id = r.engagement_id
       where ${who} and ${month} and r.mode = 'live'
       group by r.engagement_id, e.client_name, e.title order by usd desc limit 25`,
      args,
    )
  ).rows;

  const months = (
    await db.query<Row>(
      `select to_char(date_trunc('month', r.started_at), 'YYYY-MM') as m, sum(r.cost_usd)::float8 as usd, count(*)::int as n
       from runs r where ${who} and r.mode = 'live' and r.started_at >= date_trunc('month', now()) - interval '5 months'
       group by m order by m`,
      args,
    )
  ).rows;

  const top = (
    await db.query<Row>(
      `select r.id, r.title, r.engagement_id, e.client_name, u.name as user_name, r.started_at, r.status, r.cost_usd::float8 as usd,
              r.input_tokens, r.cache_write_tokens, r.cache_read_tokens, r.output_tokens
       from runs r left join engagements e on e.id = r.engagement_id left join users u on u.id = r.user_id
       where ${who} and ${month} and r.mode = 'live' order by r.cost_usd desc, r.started_at desc limit 10`,
      args,
    )
  ).rows;

  return {
    month: new Date().toISOString().slice(0, 7),
    scope: everyone ? "everyone" : "you",
    monthTotalUsd: roundUsd(Number(total.usd)),
    monthRuns: total.n,
    budget: await budgetFor(db, settings, me.id),
    byPerson: people.map((p) => ({
      userId: p.id,
      name: p.name,
      email: p.email,
      disabled: p.disabled,
      spentUsd: roundUsd(Number(p.usd)),
      runs: p.n,
      budgetUsd: p.monthly_budget_usd == null ? settings.monthlyBudgetUsd : Number(p.monthly_budget_usd),
      ownBudget: p.monthly_budget_usd != null,
    })),
    byEngagement: engagements.map((e) => ({ engagementId: e.engagement_id, clientName: e.client_name ?? "No engagement", title: e.title ?? "", spentUsd: roundUsd(Number(e.usd)), runs: e.n })),
    byMonth: months.map((m) => ({ month: m.m, usd: roundUsd(Number(m.usd)), runs: m.n })),
    topRuns: top.map((r) => ({
      id: r.id,
      title: r.title,
      engagementId: r.engagement_id,
      clientName: r.client_name,
      userName: r.user_name,
      startedAt: iso(r.started_at),
      status: r.status,
      costUsd: roundUsd(Number(r.usd)),
      inputTokens: r.input_tokens,
      cacheWriteTokens: r.cache_write_tokens,
      cacheReadTokens: r.cache_read_tokens,
      outputTokens: r.output_tokens,
    })),
  };
}

/** Sets or clears (null) a person's own monthly budget. */
export async function setUserBudget(db: Db, userId: string, usd: number | null): Promise<void> {
  await db.query("update users set monthly_budget_usd = $2 where id = $1", [userId, usd]);
}
