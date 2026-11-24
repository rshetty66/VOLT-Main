/**
 * Pure chart geometry. Every chart in the console is drawn from these functions, so positions,
 * scales and tick labels are unit-tested without a browser.
 */

export const linearScale = ([d0, d1]: [number, number], [r0, r1]: [number, number]) => (v: number) =>
  d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

/** Round ticks (1, 2 or 5 times a power of ten) that cover [min, max]. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const raw = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v / step) * step);
  return ticks;
}

export interface BenchmarkPoints {
  top25: number;
  median: number;
  bottom25: number;
}

/** Quartile bands ordered top quartile (left) to bottom quartile (right), with the client value placed on the same axis. */
export function benchmarkLayout(b: BenchmarkPoints, client: number | undefined, width: number) {
  const values = [b.top25, b.median, b.bottom25, ...(client === undefined || Number.isNaN(client) ? [] : [client])];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  // The top-quartile point is always drawn on the left, whichever direction is "better".
  const domain: [number, number] = b.top25 <= b.bottom25 ? [lo - pad, hi + pad] : [hi + pad, lo - pad];
  const x = linearScale(domain, [0, width]);
  const points = { top25: x(b.top25), median: x(b.median), bottom25: x(b.bottom25) };
  const bands = [
    { label: "Top 25%", from: 0, to: points.top25 },
    { label: "2nd", from: points.top25, to: points.median },
    { label: "3rd", from: points.median, to: points.bottom25 },
    { label: "Bottom", from: points.bottom25, to: width },
  ].map((band) => ({ ...band, width: band.to - band.from }));
  const clientX = client === undefined || Number.isNaN(client) ? undefined : Math.min(width, Math.max(0, x(client)));
  return { points, bands, client: clientX };
}

export interface YearRow {
  year: number;
  grossBenefit: number;
  runCost: number;
  netBenefit: number;
}

/** Net-benefit bars per year, the up-front investment, and the cumulative cash line from year 0. */
export function valueCaseLayout(yearly: YearRow[], investment: number, width: number, height: number) {
  const cumulative: { year: number; value: number }[] = [{ year: 0, value: -investment }];
  for (const y of yearly) cumulative.push({ year: y.year, value: cumulative[cumulative.length - 1].value + y.netBenefit });
  const all = [0, -investment, ...yearly.map((y) => y.netBenefit), ...cumulative.map((c) => c.value)];
  const ticks = niceTicks(Math.min(...all), Math.max(...all), 5);
  const y = linearScale([ticks[0], ticks[ticks.length - 1]], [height, 0]);
  const slots = yearly.length + 1;
  const slot = width / slots;
  const barW = slot * 0.5;
  const cx = (i: number) => slot * i + slot / 2;
  const zeroY = y(0);
  const bar = (i: number, value: number) => ({ x: cx(i) - barW / 2, width: barW, y: Math.min(y(value), zeroY), height: Math.abs(y(value) - zeroY), value });
  return {
    ticks,
    tickY: ticks.map((t) => y(t)),
    zeroY,
    investment: bar(0, -investment),
    bars: yearly.map((row, i) => ({ ...bar(i + 1, row.netBenefit), year: row.year, label: `Y${row.year}` })),
    cumulative: cumulative.map((c, i) => ({ ...c, x: cx(i), y: y(c.value) })),
    slot,
  };
}

export interface MaturityRow {
  dimension: string;
  current: number;
  target: number;
  gap: number;
}

export function maturityLayout(rows: MaturityRow[], width: number) {
  const x = linearScale([1, 5], [0, width]);
  return {
    ticks: [1, 2, 3, 4, 5],
    tickX: [1, 2, 3, 4, 5].map(x),
    rows: rows.map((r) => ({ label: r.dimension, current: r.current, target: r.target, gap: r.gap, currentX: x(r.current), targetX: x(r.target) })),
  };
}

export function checksLayout(counts: { pass: number; fail: number; notRun: number }, width: number) {
  const total = counts.pass + counts.fail + counts.notRun || 1;
  let at = 0;
  return [
    { label: "PASS", count: counts.pass },
    { label: "FAIL", count: counts.fail },
    { label: "NOT_RUN", count: counts.notRun },
  ].map((s) => {
    const seg = { ...s, x: at, width: (s.count / total) * width };
    at += seg.width;
    return seg;
  });
}

/** Compact money label: 1.2M, 450k, -6M. */
export function shortMoney(v: number): string {
  const a = Math.abs(v);
  const sign = v < 0 ? "-" : "";
  if (a >= 1e9) return `${sign}${+(a / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${sign}${+(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}${+(a / 1e3).toFixed(0)}k`;
  return `${sign}${a}`;
}
