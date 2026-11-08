import type { ReactElement } from "react";
import type { Run } from "../runState";
import type { Palette } from "./palette";
import { BenchmarkChart, MaturityChart, ValueCaseChart } from "./Charts";
import { ChartFrame } from "./Visual";
import { chartableResults, type ChartableResult } from "./results";

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

/** Results strip under a run: charts drawn from the deterministic tools' data (0 model tokens). */
export function RunVisuals({ run }: { run: Run }) {
  const results = chartableResults(run);
  if (!results.length) return null;
  return (
    <section className="run-visuals" aria-label="Results">
      <div className="micro">Results · drawn from the analytics tools</div>
      <div className="visual-grid">
        {results.map((r) => {
          const c = chartFor(r);
          return <ChartFrame key={r.id} name={c.name} render={c.render} />;
        })}
      </div>
    </section>
  );
}
