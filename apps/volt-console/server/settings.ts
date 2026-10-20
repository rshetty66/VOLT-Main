/**
 * Admin settings for cost control, kept in the `settings` table as one JSON value per key.
 * Anything not saved falls back to the defaults here, so new defaults reach installs that
 * never changed them.
 */
import { z } from "zod";
import type { CostSettings } from "../shared/records.js";
import { DEFAULT_PRICES } from "./cost.js";
import type { Db } from "./db.js";
import { DEFAULT_SPECIALIST_STEPS, MODEL } from "./orchestrator.js";

export type { CostSettings };


export const DEFAULT_SETTINGS: CostSettings = {
  prices: DEFAULT_PRICES,
  runBudgetUsd: Number(process.env.VOLT_RUN_BUDGET_USD ?? 10),
  monthlyBudgetUsd: Number(process.env.VOLT_MONTHLY_BUDGET_USD ?? 100),
  warnAt: 0.8,
  specialistModel: process.env.VOLT_SPECIALIST_MODEL ?? MODEL,
  specialistMaxSteps: DEFAULT_SPECIALIST_STEPS,
};

const Rates = z.object({
  input: z.number().min(0).max(1000),
  cacheWrite: z.number().min(0).max(1000),
  cacheRead: z.number().min(0).max(1000),
  output: z.number().min(0).max(1000),
});
const PriceSchema = Rates.extend({ longAbove: z.number().int().positive().optional(), long: Rates.optional() });

export const SettingsPatch = z
  .object({
    prices: z.record(z.string().trim().regex(/^[a-z0-9][a-z0-9.\-]{1,80}$/, "model ids are lower case letters, digits, dots and dashes"), PriceSchema),
    runBudgetUsd: z.number().min(0).max(100_000),
    monthlyBudgetUsd: z.number().min(0).max(1_000_000),
    warnAt: z.number().min(0.5).max(0.99),
    specialistModel: z.string().trim().min(1).max(100),
    specialistMaxSteps: z.number().int().min(2).max(16),
  })
  .partial()
  .strict()
  .refine((s) => !s.prices || Object.keys(s.prices).length > 0, "keep at least one model in the price table");

const cache = new WeakMap<Db, CostSettings>();

export async function getSettings(db: Db): Promise<CostSettings> {
  const hit = cache.get(db);
  if (hit) return hit;
  const { rows } = await db.query<{ key: string; value: unknown }>("select key, value from settings");
  const saved = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const settings = { ...DEFAULT_SETTINGS, ...(SettingsPatch.safeParse(saved).data ?? {}) } as CostSettings;
  cache.set(db, settings);
  return settings;
}

export async function updateSettings(db: Db, patch: z.infer<typeof SettingsPatch>, userId: string): Promise<CostSettings> {
  for (const [key, value] of Object.entries(patch)) {
    await db.query(
      `insert into settings (key, value, updated_by) values ($1, $2, $3)
       on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
      [key, JSON.stringify(value), userId],
    );
  }
  cache.delete(db);
  return getSettings(db);
}

/** Removes saved values so the defaults apply again. */
export async function resetSettings(db: Db, keys: (keyof CostSettings)[]): Promise<CostSettings> {
  if (keys.length) await db.query("delete from settings where key = any($1)", [keys]);
  cache.delete(db);
  return getSettings(db);
}
