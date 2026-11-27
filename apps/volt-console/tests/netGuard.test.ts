import { describe, expect, it, vi } from "vitest";
import { errText, guardedFetch, NETWORK_MESSAGE } from "../src/netGuard";

const res = (status: number) => new Response("x", { status });
const noWait = async () => undefined;

describe("guardedFetch", () => {
  it("passes a good response through", async () => {
    const base = vi.fn(async () => res(200));
    expect((await guardedFetch(base as never, noWait)("/api/catalog")).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(1);
  });
  it("retries a read while the host answers 502, then succeeds", async () => {
    const base = vi.fn().mockResolvedValueOnce(res(502)).mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200));
    expect((await guardedFetch(base as never, noWait)("/api/catalog")).status).toBe(200);
    expect(base).toHaveBeenCalledTimes(3);
  });
  it("retries a read after a network error", async () => {
    const base = vi.fn().mockRejectedValueOnce(new TypeError("Load failed")).mockResolvedValueOnce(res(200));
    expect((await guardedFetch(base as never, noWait)("/api/catalog")).status).toBe(200);
  });
  it("says what happened instead of 'TypeError: Load failed'", async () => {
    const base = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    await expect(guardedFetch(base as never, noWait)("/api/catalog")).rejects.toThrow(NETWORK_MESSAGE);
    expect(base).toHaveBeenCalledTimes(3);
  });
  it("never repeats a write after a network error", async () => {
    const base = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    await expect(guardedFetch(base as never, noWait)("/api/uploads", { method: "POST" })).rejects.toThrow(NETWORK_MESSAGE);
    expect(base).toHaveBeenCalledTimes(1);
  });
  it("retries starting a run on 502 only, not on a network error", async () => {
    const a = vi.fn().mockResolvedValueOnce(res(502)).mockResolvedValueOnce(res(200));
    expect((await guardedFetch(a as never, noWait)("/api/run", { method: "POST" })).status).toBe(200);
    const b = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    await expect(guardedFetch(b as never, noWait)("/api/run", { method: "POST" })).rejects.toThrow(NETWORK_MESSAGE);
    expect(b).toHaveBeenCalledTimes(1);
  });
  it("leaves an abort alone", async () => {
    const c = new AbortController();
    c.abort();
    const base = vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    await expect(guardedFetch(base as never, noWait)("/api/run", { method: "POST", signal: c.signal })).rejects.toThrow("aborted");
  });
});

describe("errText", () => {
  it("hides the TypeError prefix", () => {
    expect(errText(new TypeError("Load failed"))).toBe(NETWORK_MESSAGE);
    expect(errText(new Error("boom"))).toBe("boom");
  });
});
