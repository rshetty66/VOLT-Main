/**
 * The USD to CAD rate VOLT shows money with. The server reads the Bank of Canada's latest daily rate (Valet API,
 * series FXUSDCAD) and sends it with the catalog; this fallback is used only until that first read succeeds or when
 * the Bank of Canada cannot be reached, and every place that shows the rate says which one it used.
 */
export interface FxRate {
  /** Canadian dollars for one US dollar. */
  cadPerUsd: number;
  /** The Bank of Canada observation date (YYYY-MM-DD), or "" for the fallback. */
  date: string;
  source: "Bank of Canada" | "fallback";
}

export const FALLBACK_FX: FxRate = { cadPerUsd: 1.38, date: "", source: "fallback" };

/** "1.3975 CAD per USD (Bank of Canada, 2026-11-25)" or "1.38 CAD per USD (fallback rate, Bank of Canada not reached)". */
export const fxNote = (fx: FxRate) =>
  `${fx.cadPerUsd} CAD per USD (${fx.source === "fallback" ? "fallback rate, Bank of Canada not reached" : `Bank of Canada, ${fx.date}`})`;

/** The latest observation from a Valet response, or null when the response holds none. */
export function parseValet(json: unknown): FxRate | null {
  const obs = (json as { observations?: { d?: string; FXUSDCAD?: { v?: string } }[] })?.observations;
  const last = Array.isArray(obs) ? obs[obs.length - 1] : undefined;
  const v = Number(last?.FXUSDCAD?.v);
  if (!last?.d || !Number.isFinite(v) || v < 0.5 || v > 3) return null;
  return { cadPerUsd: v, date: last.d, source: "Bank of Canada" };
}
