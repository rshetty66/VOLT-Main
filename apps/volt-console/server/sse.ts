/**
 * Keeps a long Server-Sent Events response alive. A run can go quiet for tens of seconds while specialists work, and
 * phones, proxies and the host drop a stream that stays silent. A comment line ("data:" is absent) every few seconds
 * is ignored by the browser's reader but keeps the connection from looking idle.
 */
export interface Writable {
  writableEnded: boolean;
  write(chunk: string): unknown;
  on(event: "close", cb: () => void): unknown;
}

export function startHeartbeat(res: Writable, everyMs = 10_000): () => void {
  const timer = setInterval(() => {
    if (!res.writableEnded) res.write(": ping\n\n");
  }, everyMs);
  const stop = () => clearInterval(timer);
  res.on("close", stop);
  return stop;
}
