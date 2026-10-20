/** A short sample deliverable, so a template can be previewed before any run uses it. */
import { buildValueCase, compareToBenchmark } from "../analytics.js";
import { parseMarkdown } from "./markdown.js";
import type { RunContent } from "./content.js";

const deliverable = `## Executive summary

**This is a preview of the template, built from sample content.** Headings, body text, tables, the cover, headers and footers all follow the template.
- Primary colour: cover, titles and table headers
- Accent colour: subheadings and highlights
- Logo: cover and page headers

## Sample findings

### Benchmark position

| Metric | Client | Median | Top quartile | Position |
|---|---|---|---|---|
| Days to close | 11 | 6.5 | 4 | Bottom quartile |
| Intercompany automated | 35% | 60% | 90% | Third quartile |

### Recommendations

| # | Recommendation | Owner | Priority |
|---|---|---|---|
| R1 | Redesign the close calendar | Controller | **Critical** |
| R2 | Automate intercompany matching | Intercompany lead | High |

## Next steps

1. Confirm the data request
2. Run the diagnostic workshop
`;

export function sampleContent(): RunContent {
  const vc = buildValueCase({ financeFtes: 95, loadedCostPerFte: 120000, automationPct: 15, oneTimeInvestment: 3200000, annualRunCost: 600000, rampYears: 2, discountRate: 0.09, horizonYears: 5 });
  return {
    title: "Template preview",
    client: "Sample Client Inc.",
    engagementTitle: "Sample engagement",
    date: new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }),
    isDemo: false,
    modeLabel: "Sample content for previewing a template",
    status: "done",
    prompt: "Preview how this template looks.",
    intake: [],
    body: parseMarkdown(deliverable),
    specialists: [{ name: "APQC Researcher", layer: "Enablers", phase: "Diagnosis", blocks: parseMarkdown("Sample specialist output.\n\n| Metric | Value |\n|---|---|\n| Days to close | 11 |") }],
    valueCases: [{ by: "Rudra", input: { finance_ftes: 95, loaded_cost_per_fte: 120000, automation_pct: 15, one_time_investment: 3200000, annual_run_cost: 600000, ramp_years: 2, discount_rate: 0.09, horizon_years: 5 }, data: vc }],
    benchmarks: [{ by: "Rudra", input: { metric: "days_to_close", client_value: 11 }, data: compareToBenchmark("days_to_close", 11) as Record<string, any> }],
    files: [{ ref: "F1", name: "Trial balance FY2026.xlsx", summary: "Excel, 1 sheet, 412 rows", readBy: ["APQC Researcher"] }],
  };
}
