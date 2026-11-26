/**
 * Live USD to CAD rate from the Bank of Canada (Valet API), read at start and every six hours. Between reads, and when
 * a read fails, the last rate read stays in use (the fallback until the first read succeeds). See shared/fx.ts.
 */
import { FALLBACK_FX, parseValet, type FxRate } from "../shared/fx.js";

const VALET = "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=5";
const REFRESH_MS = 6 * 60 * 60 * 1000;

let current: FxRate = FALLBACK_FX;

export const fxRate = (): FxRate => current;

/** Reads the latest rate; keeps the last one on any failure. Returns the rate in use. */
export async function refreshFx(fetchImpl: typeof fetch = fetch): Promise<FxRate> {
  try {
    const r = await fetchImpl(VALET, { signal: AbortSignal.timeout(8000) });
    const fx = r.ok ? parseValet(await r.json()) : null;
    if (fx) current = fx;
    else console.warn(`[fx] Bank of Canada read gave no rate (HTTP ${r.status}); using ${current.cadPerUsd}`);
  } catch (e) {
    console.warn(`[fx] Bank of Canada not reached (${(e as Error).message}); using ${current.cadPerUsd}`);
  }
  return current;
}

/** Starts the read-at-start-and-every-six-hours loop; the timer does not keep the process alive. */
export function startFx(): void {
  void refreshFx();
  setInterval(() => void refreshFx(), REFRESH_MS).unref();
}

/** For tests: set the rate in use. */
export const setFxForTest = (fx: FxRate) => void (current = fx);
