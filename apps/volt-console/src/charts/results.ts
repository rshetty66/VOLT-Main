import type { ActivityItem, Run } from "../runState";
import type { Kpi } from "../../shared/scope";
import type { CatalogResponse } from "../../shared/events";

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

/**
 * The KPI scorecard: one benchmark chart for each chosen KPI that has a built-in benchmark, with the client's figure
 * when it is a number. KPIs without a benchmark, and metrics the user did not pick, get no chart.
 */
export function kpiScorecard(kpis: Kpi[] | undefined, benchmarks: CatalogResponse["benchmarks"]): ChartableResult[] {
  return (kpis ?? []).flatMap((k) => {
    const benchmark = benchmarks.find((b) => b.key === k.benchmark);
    if (!benchmark) return [];
    const v = Number((k.baseline ?? "").replace(/[,\s%]|CAD|\$/gi, ""));
    const clientValue = k.baseline && Number.isFinite(v) ? v : undefined;
    return [{ id: `kpi-${k.id}`, kind: "benchmark" as const, data: { benchmark, clientValue } }];
  });
}
