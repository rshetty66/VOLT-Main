import { afterEach, describe, expect, it } from "vitest";
import { FALLBACK_FX, fxNote, parseValet } from "../shared/fx";
import { fxRate, refreshFx, setFxForTest } from "../server/fx";
import { benchmarks, compareToBenchmark } from "../server/analytics";

const valet = (v: string, d = "2026-11-25") => ({ observations: [{ d: "2026-11-24", FXUSDCAD: { v: "1.3900" } }, { d, FXUSDCAD: { v } }] });
const reply = (body: unknown, ok = true) => (async () => ({ ok, status: ok ? 200 : 503, json: async () => body })) as unknown as typeof fetch;

describe("USD to CAD rate", () => {
  afterEach(() => setFxForTest(FALLBACK_FX));

  it("reads the latest Bank of Canada observation and rejects a bad one", () => {
    expect(parseValet(valet("1.4012"))).toEqual({ cadPerUsd: 1.4012, date: "2026-11-25", source: "Bank of Canada" });
    expect([parseValet({}), parseValet(valet("abc")), parseValet(valet("40"))]).toEqual([null, null, null]);
  });

  it("uses the live rate once read, and keeps the last rate when a read fails", async () => {
    expect(fxRate()).toEqual(FALLBACK_FX);
    await refreshFx(reply(valet("1.4012")));
    expect(fxRate().cadPerUsd).toBe(1.4012);
    await refreshFx(reply({}, false));
    await refreshFx((async () => { throw new Error("offline"); }) as unknown as typeof fetch);
    expect(fxRate()).toMatchObject({ cadPerUsd: 1.4012, source: "Bank of Canada" });
  });

  it("says which rate it used", () => {
    expect(fxNote({ cadPerUsd: 1.4012, date: "2026-11-25", source: "Bank of Canada" })).toBe("1.4012 CAD per USD (Bank of Canada, 2026-11-25)");
    expect(fxNote(FALLBACK_FX)).toContain("fallback rate");
  });

  it("shows benchmark money in CAD at the rate in use, and leaves ratios and days alone", () => {
    setFxForTest({ cadPerUsd: 1.5, date: "2026-11-25", source: "Bank of Canada" });
    const b = Object.fromEntries(benchmarks().map((x) => [x.key, x]));
    expect(b.cost_per_invoice_ap).toMatchObject({ unit: "CAD", top25: 3, median: 12, bottom25: 22.5 });
    expect(b.finance_ftes_per_billion).toMatchObject({ metric: "Finance FTEs per CAD 1B Revenue", top25: 26.7, median: 46.7, bottom25: 80 });
    expect(b.days_to_close).toMatchObject({ top25: 4, median: 6.5, bottom25: 10 });
    expect(benchmarks().some((x) => x.unit === "USD")).toBe(false);
    expect(compareToBenchmark("cost_per_invoice_ap", 10)).toMatchObject({ benchmark: { unit: "CAD", median: 12 }, quartile: "Second quartile" });
  });
});
