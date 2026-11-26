/**
 * The KPIs the intake suggests for each outcome. A KPI with a `benchmark` key has a built-in APQC sample benchmark
 * (server/analytics.ts), so the KPI scorecard can chart it; the others are tracked in the brief only.
 */
export interface KpiDef {
  id: string;
  name: string;
  unit: string;
  /** The apqc_benchmark key, when the built-in sample set has one. */
  benchmark?: string;
  /** Outcome keys (shared/scope.ts) the KPI measures. */
  outcomes: string[];
}

export const KPI_LIBRARY: KpiDef[] = [
  { id: "days_to_close", name: "Days to close the books", unit: "days", benchmark: "days_to_close", outcomes: ["close", "close_quality", "advisory"] },
  { id: "late_adjustments", name: "Post-close adjustments per month", unit: "count", outcomes: ["close_quality", "controls"] },
  { id: "journal_entries_per_fte", name: "Journal entries per FTE", unit: "entries/FTE", benchmark: "journal_entries_per_fte", outcomes: ["close", "recs", "ai"] },
  { id: "recs_auto_matched", name: "Reconciliations auto-matched", unit: "%", outcomes: ["recs", "ai"] },
  { id: "intercompany_automated", name: "Intercompany transactions automated", unit: "%", benchmark: "intercompany_transactions_pct_automated", outcomes: ["recs", "close"] },
  { id: "reg_filing_days", name: "Days to file regulatory returns", unit: "days", outcomes: ["reg"] },
  { id: "reg_resubmissions", name: "Regulatory resubmissions per year", unit: "count", outcomes: ["reg", "controls"] },
  { id: "cost_allocated_pct", name: "Costs allocated to segments", unit: "%", outcomes: ["segment_profitability"] },
  { id: "segment_pl_days", name: "Days to produce segment P&L", unit: "days", outcomes: ["segment_profitability", "ops_reports"] },
  { id: "budget_accuracy", name: "Budget accuracy (variance)", unit: "% variance", benchmark: "budget_accuracy", outcomes: ["fpa"] },
  { id: "forecast_cycle_days", name: "Forecast cycle time", unit: "days", outcomes: ["fpa"] },
  { id: "finance_cost_pct_revenue", name: "Cost of finance (% of revenue)", unit: "% of revenue", benchmark: "total_cost_finance_pct_revenue", outcomes: ["cost", "tom", "advisory"] },
  { id: "finance_ftes_per_billion", name: "Finance FTEs per CAD 1B revenue", unit: "FTEs", benchmark: "finance_ftes_per_billion", outcomes: ["cost", "tom"] },
  { id: "finance_cost_per_employee", name: "Finance cost per employee", unit: "CAD", benchmark: "finance_cost_per_employee", outcomes: ["cost"] },
  { id: "ap_invoice_cost", name: "Cost to process an AP invoice", unit: "CAD", benchmark: "cost_per_invoice_ap", outcomes: ["cost", "ai"] },
  { id: "ops_pack_hours", name: "Hours to build the monthly ops pack", unit: "hours", outcomes: ["ops_reports"] },
  { id: "natural_accounts", name: "Active natural accounts", unit: "count", outcomes: ["coa_design"] },
  { id: "gaap_manual_entries", name: "Manual GAAP difference entries per month", unit: "count", outcomes: ["multi_gaap"] },
  { id: "gl_traced_pct", name: "GL balances traced to instrument", unit: "%", outcomes: ["lineage", "multi_gaap"] },
  { id: "open_control_deficiencies", name: "Open control deficiencies", unit: "count", outcomes: ["controls"] },
  { id: "vendor_decision_weeks", name: "Weeks to an ERP or EPM decision", unit: "weeks", outcomes: ["erp_epm"] },
  { id: "tasks_automated_pct", name: "Finance tasks automated", unit: "%", outcomes: ["ai", "tom"] },
  { id: "dso", name: "Days sales outstanding (DSO)", unit: "days", benchmark: "dso", outcomes: ["cost"] },
];

/** The KPIs to suggest for the chosen outcomes; all of them when no outcome is chosen. */
export function suggestKpis(outcomes: readonly string[]): KpiDef[] {
  return outcomes.length ? KPI_LIBRARY.filter((k) => k.outcomes.some((o) => outcomes.includes(o))) : KPI_LIBRARY;
}

/** Custom KPIs typed as one comma- or line-separated list, so several are added at once. */
export function parseKpiList(text: string): string[] {
  return [...new Set(text.split(/[,;\n]/).map((s) => s.trim().slice(0, 80)).filter(Boolean))];
}
