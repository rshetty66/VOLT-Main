/**
 * Claude prices and per-call cost.
 *
 * Prices are USD per million tokens. The defaults are Anthropic list prices (checked
 * 20 October 2026); an admin can change them, or add models, under Usage. Input is split
 * the way the API reports it: uncached input, cache writes (5-minute) and cache reads.
 */
import type { Price, Rates } from "../shared/records.js";

export type { Price, Rates };

export const DEFAULT_PRICES: Record<string, Price> = {
  "claude-opus-5-5": { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
  "claude-haiku-5-5": {
    input: 0.1,
    cacheWrite: 0.125,
    cacheRead: 0.01,
    output: 0.5,
    longAbove: 100_000,
    long: { input: 0.5, cacheWrite: 0.625, cacheRead: 0.05, output: 2.5 },
  },
  "claude-fable-5-1": { input: 10, cacheWrite: 12.5, cacheRead: 0.25, output: 50 },
  "claude-opus-5": { input: 5, cacheWrite: 6.25, cacheRead: 0.5, output: 25 },
  "claude-sonnet-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
};

export interface CallUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens?: number;
}

/** The price for a model id; a dated id (claude-opus-5-5-20261001) uses its family's entry. */
export function priceFor(prices: Record<string, Price>, model: string | undefined): Price | undefined {
  if (!model) return undefined;
  if (prices[model]) return prices[model];
  const family = Object.keys(prices)
    .filter((k) => model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return family ? prices[family] : undefined;
}

/** Estimated USD cost of one model call; 0 for a model with no price (such as the offline simulator). */
export function callCost(prices: Record<string, Price>, model: string | undefined, u: CallUsage): number {
  const price = priceFor(prices, model);
  if (!price) return 0;
  const write = u.cacheWriteTokens ?? 0;
  const promptSize = u.inputTokens + u.cacheReadTokens + write;
  const r: Rates = price.long && price.longAbove !== undefined && promptSize > price.longAbove ? price.long : price;
  return (u.inputTokens * r.input + write * r.cacheWrite + u.cacheReadTokens * r.cacheRead + u.outputTokens * r.output) / 1_000_000;
}

/** Rounds to a tenth of a cent for storage and display. */
export const roundUsd = (n: number) => Math.round(n * 1000) / 1000;
