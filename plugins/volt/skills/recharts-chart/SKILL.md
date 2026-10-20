---
name: recharts-chart
description: Add or change a Recharts visualization in the Next.js frontend, matching this app's dark slate palette, axis and tooltip styling, ResponsiveContainer sizing, and ChartData contract. Use when building a chart, graph, or dashboard tile in web/src.
category: Engineering Practice
disable-model-invocation: true
---

# Recharts charts in the VOLT frontend

Charts live in `web/src/components/` and render inside `ResponsiveContainer`. The canonical
reference implementation is `web/src/components/chat/visual-outputs.tsx` — read it before
adding a new chart type, and copy its styling rather than inventing a second look.

Recharts is already a dependency (`^2.15.0`). Do not add another charting library.

## Chart form — pick by the question, not by looks

| The question | Form |
|---|---|
| Compare magnitudes across a few named categories | bar |
| A value over time, or a trend | line |
| Composition of a whole, ≤5 slices | pie |
| One entity scored on 4–8 dimensions | radar |
| A single number against a target | gauge / KPI tile |
| Several headline numbers at once | KPI grid |

If a chart needs more than ~12 categories, it is a table. If a pie has more than 5 slices,
it is a bar chart. Do not make a chart out of two numbers — write the two numbers.

## The data contract

Charts consume the `ChartData` shape already defined in `visual-outputs.tsx`:

```ts
export interface ChartData {
  type: "bar" | "radar" | "pie" | "line" | "gauge" | "kpi_grid";
  title: string;
  data: Record<string, string | number>[];
  keys?: string[];     // series to plot; first key is the primary series
  colors?: string[];   // optional override
}
```

Every row carries a `name` field for the category axis. Extend this interface rather than
declaring a parallel one — the backend emits this shape and a second contract means the two
drift.

## Palette — use these exact values

```ts
const COLORS       = ["#ffffff", "#e2e8f0", "#94a3b8", "#64748b", "#475569", "#334155"];
const CHART_COLORS = ["#f8fafc", "#cbd5e1", "#94a3b8", "#64748b", "#475569"];
```

The app is a dark slate theme. Series colours are a light-to-mid monochrome ramp, brightest
first — the primary series is the brightest (`#f8fafc`), and later series step down. Do not
introduce hues for decoration. Reserve colour for a genuine semantic signal (a threshold
breach, a variance sign), and when you do, say so in a comment.

## Required styling

Apply consistently — these are what make a new chart look like it belongs:

```tsx
<CartesianGrid strokeDasharray="3 3" stroke="#334155" />
<XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 10 }} />
<YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
<Tooltip
  contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, fontSize: 11 }}
  labelStyle={{ color: "#f8fafc" }}
/>
<Bar dataKey={dataKey} fill="#f8fafc" radius={[4, 4, 0, 0]} />
```

- Grid stroke `#334155`, dashed `3 3`.
- Axis ticks `#94a3b8` at `fontSize: 10`.
- Tooltip on dark `#1e293b` with a `#334155` border and 8px radius.
- Bars get `radius={[4, 4, 0, 0]}`; lines get `strokeWidth={2}` and small dots.
- `<Legend />` only with two or more series. One series needs no legend.

## Sizing

Wrap in a fixed-height div and let `ResponsiveContainer` own the width:

```tsx
<div className="w-full h-[220px]">
  <ResponsiveContainer width="100%" height="100%">
    ...
  </ResponsiveContainer>
</div>
```

Heights in use: `220px` bar/line, `250px` radar/pie. `ResponsiveContainer` with a
percentage height inside a parent that has no height collapses to zero — this is the most
common Recharts bug, and it renders as a blank space with no error.

## Client component

Recharts needs the DOM. Any file containing a chart starts with:

```tsx
"use client";
```

Omitting it in the App Router produces a build-time or hydration failure, not a runtime one.

## Empty and degenerate data

Never render a chart on an empty array — Recharts draws axes with no marks and it reads as
a bug. Guard first:

```tsx
if (!chart.data?.length) {
  return <p className="text-xs text-slate-400">No data for {chart.title}.</p>;
}
```

Also handle: all values zero (say so, do not draw a flat line), a single data point (render
the number), and non-numeric values arriving in a numeric series (coerce and log, or drop).

## Accessibility

- The chart's `title` renders as visible text above it, not only inside the SVG.
- Do not encode meaning by colour alone — the monochrome ramp is close to indistinguishable
  for some viewers. Label series directly or use a legend.
- Give the wrapper `role="img"` and an `aria-label` summarising the takeaway, not the
  chart type: `aria-label="Match rate by ledger area; premium lowest at 82%"`.

Accessibility basics are not a simplification to skip.

## Adding a new chart type

1. Add the variant to `ChartData["type"]`.
2. Write `function <Type>ChartViz({ chart }: { chart: ChartData })` next to the existing
   ones, reusing the palette and styling constants above.
3. Add the dispatch line where the others are:
   `{v.chart.type === "<type>" && <<Type>ChartViz chart={v.chart} />}`
4. If the backend must emit it, update the producer too — a type the frontend renders but
   nothing emits is dead code.

Starting point: [`references/chart-template.tsx`](references/chart-template.tsx)

## Checklist

- [ ] `"use client"` at the top of the file
- [ ] Chart form matches the question being asked
- [ ] Uses `ChartData`, not a parallel interface
- [ ] Exact palette, grid, axis, and tooltip values from above
- [ ] Fixed-height wrapper around `ResponsiveContainer`
- [ ] Empty / all-zero / single-point data handled explicitly
- [ ] `aria-label` states the takeaway; meaning is not colour-only
- [ ] Legend only when there are ≥2 series
