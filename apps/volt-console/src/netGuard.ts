/**
 * Browsers report a dropped connection as a bare "TypeError: Load failed" (Safari) or "Failed to fetch" (Chrome).
 * This wraps fetch so that (1) a failed request says what happened, and (2) a request that is safe to repeat is
 * retried while the host restarts: Render answers 502 or 503 for a minute during a deploy or a cold start.
 * Retried: reads (GET/HEAD) on a network error or 502/503/504, and starting a run on 502/503/504 only (the app
 * never saw it). Nothing else is repeated, so no write or run is done twice.
 */
export const NETWORK_MESSAGE = "Could not reach VOLT. Check your connection and try again. If the app was just updated, wait a minute and retry.";
const RETRY_STATUS = new Set([502, 503, 504]);
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function guardedFetch(base: typeof fetch, sleep: (ms: number) => Promise<void> = wait, delayMs = 2500): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : input.url;
    const read = method === "GET" || method === "HEAD";
    const startsRun = method === "POST" && /\/api\/run$/.test(url);
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await base(input, init);
        if (RETRY_STATUS.has(r.status) && attempt < 2 && (read || startsRun) && !init?.signal?.aborted) {
          await sleep(delayMs * (attempt + 1));
          continue;
        }
        return r;
      } catch (e) {
        if (init?.signal?.aborted || (e instanceof Error && e.name === "AbortError")) throw e;
        if (!(e instanceof TypeError)) throw e;
        if (read && attempt < 2) {
          await sleep(delayMs * (attempt + 1));
          continue;
        }
        throw new Error(NETWORK_MESSAGE);
      }
    }
  };
}

/** An error as text for the screen, without the "TypeError: " prefix a bare String(err) adds. */
export function errText(e: unknown): string {
  if (e instanceof TypeError && /load failed|failed to fetch|networkerror/i.test(e.message)) return NETWORK_MESSAGE;
  return e instanceof Error ? e.message : String(e);
}
