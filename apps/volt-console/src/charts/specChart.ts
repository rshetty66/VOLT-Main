import type { ChartSpec } from "../../shared/viz";
import type { Palette } from "./palette";

/** SVG for a chart spec, as a string: the console shows it (dark palette) and downloads embed it (light palette). */
const W = 720;
const H = 380;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${+(v / 1e3).toFixed(0)}K`;
  return `${+v.toFixed(a < 10 ? 2 : a < 100 ? 1 : 0)}`;
}

/** A "nice" axis maximum and step, so gridlines land on round numbers. */
function niceScale(min: number, max: number): { lo: number; hi: number; step: number } {
  const hi0 = Math.max(max, 0);
  const lo0 = Math.min(min, 0);
  const span = hi0 - lo0 || 1;
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return { lo: Math.floor(lo0 / step) * step, hi: Math.ceil(hi0 / step) * step, step };
}

const colours = (p: Palette) => [p.series, p.series2, "#d4af37"];

export function specSvg(spec: ChartSpec, p: Palette): string {
  const cs = colours(p);
  const parts: string[] = [];
  const text = (x: number, y: number, s: string, o: { size?: number; anchor?: string; fill?: string; weight?: number } = {}) =>
    `<text x="${x}" y="${y}" font-family="${esc(p.font)}" font-size="${o.size ?? 12}" fill="${o.fill ?? p.muted}" text-anchor="${o.anchor ?? "start"}"${o.weight ? ` font-weight="${o.weight}"` : ""}>${esc(s)}</text>`;
  parts.push(`<rect width="${W}" height="${H}" fill="${p.bg}" rx="8"/>`);
  if (spec.title) parts.push(text(24, 32, spec.title + (spec.unit ? ` (${spec.unit})` : ""), { size: 16, fill: p.ink, weight: 600 }));

  // Legend (not for a donut, which labels its own slices).
  const showLegend = spec.series.length > 1 && spec.type !== "donut";
  if (showLegend) {
    let x = 24;
    for (const [i, s] of spec.series.entries()) {
      parts.push(`<rect x="${x}" y="46" width="12" height="12" rx="2" fill="${cs[i]}"/>`, text(x + 18, 57, s.name, { size: 12, fill: p.ink }));
      x += 40 + s.name.length * 7;
    }
  }
  const top = showLegend ? 74 : 56;
  const foot = spec.source ? 30 : 12;

  if (spec.type === "donut") {
    const vals = spec.series[0].values;
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = 210, cy = top + (H - top - foot) / 2, R = Math.min(130, (H - top - foot) / 2), r = R * 0.6;
    let a0 = -Math.PI / 2;
    const slice = [cs[0], cs[1], cs[2], "#ff5722", "#0097a7", "#6c7694", "#a9b1c7", "#3a4262", "#8a90a5", "#c9f4fb", "#f4ead0", "#e4e7f1"];
    vals.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const big = a1 - a0 > Math.PI ? 1 : 0;
      const pt = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(1)} ${(cy + rad * Math.sin(a)).toFixed(1)}`;
      if (v > 0) parts.push(vals.filter((x) => x > 0).length === 1 ? `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${slice[i % slice.length]}" stroke-width="${R - r}"/>` : `<path d="M ${pt(R, a0)} A ${R} ${R} 0 ${big} 1 ${pt(R, a1)} L ${pt(r, a1)} A ${r} ${r} 0 ${big} 0 ${pt(r, a0)} Z" fill="${slice[i % slice.length]}" stroke="${p.bg}" stroke-width="2"/>`);
      a0 = a1;
    });
    parts.push(text(cx, cy - 2, fmt(total), { size: 22, anchor: "middle", fill: p.ink, weight: 700 }), text(cx, cy + 16, spec.unit ?? "total", { size: 12, anchor: "middle" }));
    vals.forEach((v, i) => {
      const y = top + 14 + i * 24;
      parts.push(`<rect x="400" y="${y - 11}" width="12" height="12" rx="2" fill="${slice[i % slice.length]}"/>`, text(420, y, `${spec.labels[i]}`, { size: 13, fill: p.ink }), text(690, y, `${fmt(v)}  (${Math.round((v / total) * 100)}%)`, { size: 13, anchor: "end" }));
    });
  } else {
    const all = spec.series.flatMap((s) => s.values);
    const { lo, hi, step } = niceScale(Math.min(...all), Math.max(...all));
    const horizontal = spec.type === "hbar";
    const left = horizontal ? Math.min(220, 40 + Math.max(...spec.labels.map((l) => l.length)) * 6.4) : 56;
    const x0 = left, x1 = W - 28, y0 = top, y1 = H - foot - (horizontal ? 8 : 34);
    const n = spec.labels.length;
    const ticks: number[] = [];
    for (let t = lo; t <= hi + step / 2; t += step) ticks.push(+t.toFixed(6));
    const val = (v: number) => (horizontal ? x0 + ((v - lo) / (hi - lo || 1)) * (x1 - x0) : y1 - ((v - lo) / (hi - lo || 1)) * (y1 - y0));
    for (const t of ticks) {
      if (horizontal) parts.push(`<line x1="${val(t)}" y1="${y0}" x2="${val(t)}" y2="${y1}" stroke="${p.grid}"/>`, text(val(t), y1 + 16, fmt(t), { size: 11, anchor: "middle" }));
      else parts.push(`<line x1="${x0}" y1="${val(t)}" x2="${x1}" y2="${val(t)}" stroke="${p.grid}"/>`, text(x0 - 8, val(t) + 4, fmt(t), { size: 11, anchor: "end" }));
    }
    const band = ((horizontal ? y1 - y0 : x1 - x0) / n);
    const k = spec.series.length;
    const bw = Math.min(46, (band * 0.72) / k);
    spec.labels.forEach((label, i) => {
      const mid = (horizontal ? y0 : x0) + band * (i + 0.5);
      if (horizontal) parts.push(text(x0 - 8, mid + 4, label, { size: 12, anchor: "end", fill: p.ink }));
      else parts.push(text(mid, y1 + 18, label.length > 14 && n > 6 ? `${label.slice(0, 13)}...` : label, { size: 12, anchor: "middle", fill: p.ink }));
    });
    if (spec.type === "line") {
      spec.series.forEach((s, si) => {
        const pts = s.values.map((v, i) => `${(x0 + band * (i + 0.5)).toFixed(1)},${val(v).toFixed(1)}`);
        parts.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${cs[si]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
        s.values.forEach((v, i) => parts.push(`<circle cx="${x0 + band * (i + 0.5)}" cy="${val(v)}" r="4.5" fill="${p.bg}" stroke="${cs[si]}" stroke-width="2.5"/>`, ...(n <= 8 ? [text(x0 + band * (i + 0.5), val(v) - 10, fmt(v), { size: 11, anchor: "middle", fill: p.ink })] : [])));
      });
    } else {
      spec.series.forEach((s, si) =>
        s.values.forEach((v, i) => {
          const off = (si - (k - 1) / 2) * bw;
          const mid = (horizontal ? y0 : x0) + band * (i + 0.5) + off;
          const base = val(0), end = val(v);
          const colour = v < 0 ? p.negative : cs[si];
          if (horizontal) parts.push(`<rect x="${Math.min(base, end)}" y="${mid - bw / 2}" width="${Math.max(1, Math.abs(end - base))}" height="${bw}" rx="3" fill="${colour}"/>`, text(Math.max(base, end) + 6, mid + 4, fmt(v), { size: 11, fill: p.ink }));
          else parts.push(`<rect x="${mid - bw / 2}" y="${Math.min(base, end)}" width="${bw}" height="${Math.max(1, Math.abs(end - base))}" rx="3" fill="${colour}"/>`, ...(n * k <= 16 ? [text(mid, (v < 0 ? end + 14 : end - 6), fmt(v), { size: 11, anchor: "middle", fill: p.ink })] : []));
        }),
      );
    }
  }
  if (spec.source) parts.push(text(24, H - 10, `Source: ${spec.source}`, { size: 11 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.title || "Chart")}">${parts.join("")}</svg>`;
}
