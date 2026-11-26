import type { ReactElement } from "react";
import type { Run } from "../runState";
import type { Palette } from "./palette";
import { BenchmarkChart, MaturityChart, ValueCaseChart } from "./Charts";
import { ChartFrame } from "./Visual";
import type { ChartableResult } from "./results";

/** Chart renderer and file name for one tool result; shared by the Results strip and the downloads. */
export function chartFor(r: ChartableResult): { name: string; render: (p: Palette) => ReactElement } {
  switch (r.kind) {
    case "benchmark":
      return { name: `benchmark-${r.data.benchmark.key}`, render: (p) => <BenchmarkChart data={r.data} p={p} /> };
    case "maturity":
      return { name: "maturity", render: (p) => <MaturityChart data={r.data} p={p} /> };
    case "valueCase":
      return { name: "value-case", render: (p) => <ValueCaseChart data={r.data} p={p} /> };
  }
}

/**
 * The KPI scorecard under a run: the chat's chosen KPIs against their built-in benchmarks (0 model tokens). Shown only
 * when the user picked a KPI that has a benchmark; charts for metrics the agents looked up on their own are left out.
 */
export function RunVisuals({ run }: { run: Run }) {
  const results = run.scorecard ?? [];
  if (!results.length) return null;
  return (
    <section className="run-visuals" aria-label="KPI scorecard">
      <div className="micro">KPI scorecard · your chosen KPIs against the built-in APQC sample benchmarks</div>
      <div className="visual-grid">
        {results.map((r) => {
          const c = chartFor(r);
          return <ChartFrame key={r.id} name={c.name} render={c.render} />;
        })}
      </div>
    </section>
  );
}
