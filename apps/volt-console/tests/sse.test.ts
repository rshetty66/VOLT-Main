import { afterEach, describe, expect, it, vi } from "vitest";
import { startHeartbeat } from "../server/sse.js";

afterEach(() => vi.useRealTimers());

describe("SSE heartbeat", () => {
  const fake = () => {
    const out = { chunks: [] as string[], closeCb: () => {}, writableEnded: false };
    return {
      out,
      res: {
        get writableEnded() { return out.writableEnded; },
        write: (c: string) => void out.chunks.push(c),
        on: (_: "close", cb: () => void) => void (out.closeCb = cb),
      },
    };
  };

  it("writes a comment line on an interval, which the run reader ignores", () => {
    vi.useFakeTimers();
    const { out, res } = fake();
    startHeartbeat(res, 1000);
    vi.advanceTimersByTime(3500);
    expect(out.chunks).toEqual([": ping\n\n", ": ping\n\n", ": ping\n\n"]);
    expect(out.chunks.every((c) => !c.includes("data:"))).toBe(true);
  });

  it("stops when the connection closes or the response has ended", () => {
    vi.useFakeTimers();
    const a = fake();
    startHeartbeat(a.res, 1000);
    a.out.closeCb();
    vi.advanceTimersByTime(5000);
    expect(a.out.chunks).toHaveLength(0);

    const b = fake();
    startHeartbeat(b.res, 1000);
    b.out.writableEnded = true;
    vi.advanceTimersByTime(5000);
    expect(b.out.chunks).toHaveLength(0);
  });
});
