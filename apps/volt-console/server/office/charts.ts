/**
 * The figures behind the export charts, taken from the agents' own tool results
 * (apqc_benchmark and build_value_case), so every plotted number is one a tool computed.
 */
import type { RunContent, ToolUse } from "./content.js";

export interface BenchmarkChart {
  metric: string;
  unit: string;
  lowerIsBetter: boolean;
  top25: number;
  median: number;
  bottom25: number;
  client: number | null;
  quartile: string;
  by: string;
}

export interface ValueCaseChart {
  /** "Scenario 1" and so on, in the order the Excel workbook numbers them. */
  label: string;
  by: string;
  /** Year 0 (the investment) to the horizon. */
  years: number[];
  net: number[];
  cumulative: number[];
  npv: number | null;
  irrPct: number | null;
  paybackYears: number | null;
  steadyStateSaving: number | null;
  investment: number;
  discountRate: number;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

export function benchmarkCharts(c: RunContent): BenchmarkChart[] {
  return c.benchmarks
    .map((b) => {
      const bm = b.data.benchmark ?? {};
      const [top25, median, bottom25] = [num(bm.top25), num(bm.median), num(bm.bottom25)];
      if (top25 === null || median === null || bottom25 === null) return null;
      return { metric: String(bm.metric ?? bm.key ?? "Benchmark"), unit: String(bm.unit ?? ""), lowerIsBetter: !!bm.lowerIsBetter, top25, median, bottom25, client: num(b.data.clientValue), quartile: String(b.data.quartile ?? ""), by: b.by };
    })
    .filter((x): x is BenchmarkChart => x !== null);
}

/** Every value case, numbered as the workbook numbers them (Scenario 1, 2…). */
export function valueCaseCharts(c: RunContent): ValueCaseChart[] {
  return c.valueCases
    .map((vc: ToolUse, n) => {
      const yearly = Array.isArray(vc.data.yearly) ? vc.data.yearly : [];
      const investment = num(vc.input.one_time_investment);
      if (!yearly.length || investment === null) return null;
      const net = [-investment, ...yearly.map((y: { netBenefit: unknown }) => num(y.netBenefit) ?? 0)];
      let running = 0;
      const cumulative = net.map((v) => Math.round((running += v) * 100) / 100);
      return {
        label: `Scenario ${n + 1}`,
        by: vc.by,
        years: net.map((_, i) => i),
        net,
        cumulative,
        npv: num(vc.data.npv),
        irrPct: num(vc.data.irrPct),
        paybackYears: num(vc.data.paybackYears),
        steadyStateSaving: num(vc.data.steadyStateAnnualSaving),
        investment,
        discountRate: num(vc.input.discount_rate) ?? 0.08,
      };
    })
    .filter((x): x is ValueCaseChart => x !== null);
}

/**
 * The value cases worth a slide: distinct inputs only, Rudra's (the synthesis) first, then in run order.
 * Returns the chosen ones and how many distinct cases there were.
 */
export function deckValueCases(c: RunContent, max = 3): { shown: ValueCaseChart[]; distinct: number } {
  const all = valueCaseCharts(c);
  const seen = new Set<string>();
  const distinct = all.filter((v, i) => {
    const key = JSON.stringify(c.valueCases[Number(v.label.split(" ")[1]) - 1]?.input ?? i);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const ordered = [...distinct.filter((v) => v.by === "Rudra"), ...distinct.filter((v) => v.by !== "Rudra")];
  return { shown: ordered.slice(0, max), distinct: distinct.length };
}

/** Compact money, e.g. $1.2M, -$650K, $9,500. */
export function money(n: number): string {
  const a = Math.abs(n);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e4 ? `${Math.round(a / 1e3)}K` : Math.round(a).toLocaleString("en");
  return `${n < 0 ? "-" : ""}$${s}`;
}
