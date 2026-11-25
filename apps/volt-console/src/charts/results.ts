import type { ActivityItem, Run } from "../runState";

/** Tool results the console can chart, in the order they happened (Rudra first, then each specialist lane). */
export type ChartableResult =
  | { id: string; kind: "benchmark"; data: BenchmarkData }
  | { id: string; kind: "maturity"; data: MaturityData }
  | { id: string; kind: "valueCase"; data: ValueCaseData };

export interface BenchmarkData {
  benchmark: { key: string; metric: string; top25: number; median: number; bottom25: number; unit: string; lowerIsBetter: boolean };
  clientValue?: number;
  quartile?: string;
  gapToTop25?: number;
}

export interface MaturityData {
  overall: number;
  overallLevel: string;
  dimensions: { dimension: string; current: number; target: number; gap: number }[];
  priorityGaps: string[];
}

export interface ValueCaseData {
  /** The tool's inputs (absent on runs saved before they were recorded). */
  inputs?: { financeFtes: number; loadedCostPerFte: number; automationPct: number; oneTimeInvestment: number; annualRunCost: number; rampYears: number; horizonYears: number; discountRate: number };
  oneTimeInvestment: number;
  steadyStateAnnualSaving: number;
  npv: number;
  irrPct: number | null;
  paybackYears: number | null;
  yearly: { year: number; realisationPct: number; grossBenefit: number; runCost: number; netBenefit: number }[];
}

const KIND: Record<string, ChartableResult["kind"]> = { apqc_benchmark: "benchmark", score_maturity: "maturity", build_value_case: "valueCase" };

export function chartableResults(run: Run): ChartableResult[] {
  const items: ActivityItem[] = [...run.activity, ...run.laneOrder.flatMap((id) => run.lanes[id]?.activity ?? [])];
  const out: ChartableResult[] = [];
  for (const it of items) {
    const kind = it.kind === "tool" && !it.isError && it.data ? KIND[it.text] : undefined;
    if (kind) out.push({ id: it.id, kind, data: it.data } as ChartableResult);
  }
  return out;
}

const MAX_VALUE_CASES = 3;

/**
 * The charts worth putting in a download's appendix. An agent may call the same tool several times (the same benchmark
 * from three workstreams, a value case for each scenario), and the console shows every call, but a document should not
 * repeat itself: one chart per benchmark metric, one maturity chart, and up to three value cases that differ.
 */
export function exportCharts(results: ChartableResult[]): ChartableResult[] {
  const seenMetric = new Set<string>();
  const seenCase = new Set<string>();
  let maturity = false;
  return results.filter((r) => {
    if (r.kind === "benchmark") {
      const key = r.data.benchmark.key || r.data.benchmark.metric;
      if (seenMetric.has(key)) return false;
      seenMetric.add(key);
      return true;
    }
    if (r.kind === "maturity") {
      if (maturity) return false;
      maturity = true;
      return true;
    }
    const key = `${Math.round(r.data.npv)}|${r.data.paybackYears}`;
    if (seenCase.has(key) || seenCase.size >= MAX_VALUE_CASES) return false;
    seenCase.add(key);
    return true;
  });
}
