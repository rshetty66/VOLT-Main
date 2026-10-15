"use client";

/**
 * Chart component template — copy into web/src/components/<area>/<name>.tsx.
 *
 * Palette, grid, axis, and tooltip values are copied from
 * web/src/components/chat/visual-outputs.tsx so a new chart matches the rest of
 * the app. Do not retune them here; change them there and propagate.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// The app-wide contract. Import it from visual-outputs.tsx rather than
// redeclaring it once that export exists.
export interface ChartData {
  type: "bar" | "line" | "pie";
  title: string;
  data: Record<string, string | number>[];
  keys?: string[];
  colors?: string[];
}

const CHART_COLORS = ["#f8fafc", "#cbd5e1", "#94a3b8", "#64748b", "#475569"];

const GRID = { strokeDasharray: "3 3", stroke: "#334155" } as const;
const TICK = { fill: "#94a3b8", fontSize: 10 } as const;
const TOOLTIP = {
  contentStyle: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    fontSize: 11,
  },
  labelStyle: { color: "#f8fafc" },
} as const;

/** One-line summary of the takeaway, for screen readers. */
function summarize(chart: ChartData): string {
  const key = chart.keys?.[0] ?? "value";
  const top = [...chart.data].sort(
    (a, b) => Number(b[key] ?? 0) - Number(a[key] ?? 0),
  )[0];
  return top
    ? `${chart.title}. Highest: ${top.name} at ${top[key]}.`
    : chart.title;
}

export function ChartViz({ chart }: { chart: ChartData }) {
  const keys = chart.keys?.length ? chart.keys : ["value"];

  // Guard before rendering: Recharts draws empty axes rather than failing, which
  // reads to the user as a broken panel.
  if (!chart.data?.length) {
    return (
      <p className="text-xs text-slate-400">No data for {chart.title}.</p>
    );
  }
  const allZero = chart.data.every((row) =>
    keys.every((k) => Number(row[k] ?? 0) === 0),
  );
  if (allZero) {
    return (
      <p className="text-xs text-slate-400">
        {chart.title}: all values are zero.
      </p>
    );
  }

  return (
    <div className="w-full">
      <p className="mb-2 text-xs font-medium text-slate-200">{chart.title}</p>
      <div
        className="w-full h-[220px]"
        role="img"
        aria-label={summarize(chart)}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === "line" ? (
            <LineChart data={chart.data}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" tick={TICK} />
              <YAxis tick={TICK} />
              <Tooltip {...TOOLTIP} />
              {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {keys.map((k, i) => (
                <Line
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS[i % CHART_COLORS.length], r: 3 }}
                />
              ))}
            </LineChart>
          ) : chart.type === "pie" ? (
            <PieChart>
              <Tooltip {...TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Pie
                data={chart.data}
                dataKey={keys[0]}
                nameKey="name"
                outerRadius={80}
                label={{ fill: "#94a3b8", fontSize: 10 }}
              >
                {chart.data.map((row, i) => (
                  <Cell
                    key={String(row.name ?? i)}
                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <BarChart data={chart.data}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="name" tick={TICK} />
              <YAxis tick={TICK} />
              <Tooltip {...TOOLTIP} />
              {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {keys.map((k, i) => (
                <Bar
                  key={k}
                  dataKey={k}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
