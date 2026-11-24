import type { ChartSpec } from "../../shared/viz";
import type { Palette } from "./palette";

/**
 * SVG for a chart spec, as a string: the console shows it (dark palette) and downloads embed it (light palette).
 * `t` is the animation progress from 0 to 1: the console and the GIF download draw frames at rising t, so bars grow,
 * lines draw in, slices sweep and numbers count up; every static download draws t = 1.
 */
export interface DrawOptions {
  t?: number;
}

const W = 720;
const BASE_H = 400;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n1 = (v: number) => +v.toFixed(1);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Exponential ease-out: a confident arrival that settles, with no bounce. */
const ease = (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x));
/** Progress of the i-th of n marks: each starts a little after the one before. */
const stagger = (t: number, i: number, n: number, spread = 0.35) => ease(clamp01((t - (n > 1 ? (spread * i) / (n - 1) : 0)) / (1 - spread)));

export function fmt(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4) return `${+(v / 1e3).toFixed(0)}K`;
  return `${+v.toFixed(a < 10 ? 2 : a < 100 ? 1 : 0)}`;
}
/** Approximate rendered width of a label in the chart font, from character classes (no DOM in downloads). */
export function textWidth(s: string, size = 12): number {
  let w = 0;
  for (const ch of s) w += /[ilj.,:;'|!]/.test(ch) ? 0.28 : /[ftr() -]/.test(ch) ? 0.36 : /[MWmw@%]/.test(ch) ? 0.86 : /[A-Z0-9#$&]/.test(ch) ? 0.64 : 0.54;
  return w * size;
}
const signed = (v: number) => (v > 0 ? `+${fmt(v)}` : fmt(v));

/** A "nice" axis range and step, so gridlines land on round numbers. */
function niceScale(min: number, max: number, zero = true): { lo: number; hi: number; step: number } {
  const hi0 = zero ? Math.max(max, 0) : max;
  const lo0 = zero ? Math.min(min, 0) : min;
  const span = hi0 - lo0 || 1;
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  return { lo: Math.floor(lo0 / step) * step, hi: Math.ceil(hi0 / step) * step, step };
}
const ticksOf = ({ lo, hi, step }: { lo: number; hi: number; step: number }) => {
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
};

/** A bar with only its far end rounded. */
function barPath(x: number, y: number, w: number, h: number, r: number, side: "t" | "b" | "l" | "r"): string {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const [X, Y, Wd, Ht, R] = [x, y, w, h, r].map(n1);
  if (side === "t") return `M${X},${n1(Y + Ht)}V${n1(Y + R)}Q${X},${Y} ${n1(X + R)},${Y}H${n1(X + Wd - R)}Q${n1(X + Wd)},${Y} ${n1(X + Wd)},${n1(Y + R)}V${n1(Y + Ht)}Z`;
  if (side === "b") return `M${X},${Y}V${n1(Y + Ht - R)}Q${X},${n1(Y + Ht)} ${n1(X + R)},${n1(Y + Ht)}H${n1(X + Wd - R)}Q${n1(X + Wd)},${n1(Y + Ht)} ${n1(X + Wd)},${n1(Y + Ht - R)}V${Y}Z`;
  if (side === "r") return `M${X},${Y}H${n1(X + Wd - R)}Q${n1(X + Wd)},${Y} ${n1(X + Wd)},${n1(Y + R)}V${n1(Y + Ht - R)}Q${n1(X + Wd)},${n1(Y + Ht)} ${n1(X + Wd - R)},${n1(Y + Ht)}H${X}Z`;
  return `M${n1(X + Wd)},${Y}H${n1(X + R)}Q${X},${Y} ${X},${n1(Y + R)}V${n1(Y + Ht - R)}Q${X},${n1(Y + Ht)} ${n1(X + R)},${n1(Y + Ht)}H${n1(X + Wd)}Z`;
}

/** A short id from the spec, so gradients of two charts on one page do not clash. */
function uid(spec: ChartSpec, p: Palette): string {
  let h = 5381;
  for (const ch of JSON.stringify(spec) + p.bg) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return `vz${h.toString(36)}`;
}

/** A plain-text summary of the data for screen readers: the type, the takeaway and each series' values. */
function describe(spec: ChartSpec): string {
  const u = spec.unit ? ` ${spec.unit}` : "";
  const series = spec.series.map((s) => `${s.name}: ${s.values.map((v, i) => `${spec.labels[i]} ${fmt(v)}${u}`).join(", ")}`).join(". ");
  return `${spec.type} chart. ${spec.note ? `${spec.note}. ` : ""}${series}.`.slice(0, 600);
}

const RAG = ["#e5534b", "#f0b429", "#3fb67a"];
const RAG_INK = "#10131c";

export function specSvg(spec: ChartSpec, p: Palette, o: DrawOptions = {}): string {
  const t = clamp01(o.t ?? 1);
  const id = uid(spec, p);
  const parts: string[] = [];
  const defs: string[] = [];
  const cs = spec.series.length > 3 || spec.type === "stacked" ? p.cats : [p.series, p.series2, p.cats[2], p.cats[3]];
  const text = (x: number, y: number, s: string, f: { size?: number; anchor?: string; fill?: string; weight?: number; opacity?: number } = {}) =>
    `<text x="${n1(x)}" y="${n1(y)}" font-family="${esc(p.font)}" font-size="${f.size ?? 12}" fill="${f.fill ?? p.muted}" text-anchor="${f.anchor ?? "start"}"${f.weight ? ` font-weight="${f.weight}"` : ""}${f.opacity !== undefined && f.opacity < 1 ? ` opacity="${n1(f.opacity)}"` : ""}>${esc(s)}</text>`;
  const tip = (s: string) => `<title>${esc(s)}</title>`;
  const unit = spec.unit ? ` ${spec.unit}` : "";
  /** A low-to-high ramp of one colour (the heatmap legend), returned as a fill reference. */
  const grad = (colour: string, horizontal = false) => {
    const gid = `${id}g${defs.length}`;
    defs.push(`<linearGradient id="${gid}" x1="0" y1="${horizontal ? 0 : 0}" x2="${horizontal ? 1 : 0}" y2="${horizontal ? 0 : 1}"><stop offset="0" stop-color="${colour}" stop-opacity="0.12"/><stop offset="1" stop-color="${colour}" stop-opacity="1"/></linearGradient>`);
    return `url(#${gid})`;
  };
  const fade = (colour: string) => {
    const gid = `${id}g${defs.length}`;
    defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${colour}" stop-opacity="0.28"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></linearGradient>`);
    return `url(#${gid})`;
  };
  /** A rounded label pill, for call-outs and the target line. */
  const pill = (x: number, y: number, s: string, colour: string, anchor: "start" | "middle" | "end" = "middle") => {
    const w = textWidth(s, 11) + 26;
    const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    return `<rect x="${n1(x0)}" y="${n1(y - 13)}" width="${n1(w)}" height="18" rx="9" fill="${p.ink}"/><circle cx="${n1(x0 + 9)}" cy="${n1(y - 4)}" r="3" fill="${colour}"/>` + text(x0 + w / 2 + 4, y, s, { size: 11, anchor: "middle", fill: p.bg, weight: 700 });
  };

  // Heading: title, the takeaway and the legend.
  let y = 32;
  if (spec.title) parts.push(text(24, y, spec.title + (spec.unit && spec.type !== "kpi" ? ` (${spec.unit})` : ""), { size: 17, fill: p.ink, weight: 650 }));
  if (spec.note) parts.push(text(24, (y += 20), spec.note, { size: 12.5, fill: p.series }));
  const legend = spec.series.length > 1 && !["donut", "kpi", "heatmap", "waterfall"].includes(spec.type);
  if (legend) {
    let x = 24;
    y += 24;
    for (const [i, s] of spec.series.entries()) {
      const name = spec.type === "combo" && i === 1 && spec.unit2 ? `${s.name} (${spec.unit2}, right axis)` : s.name;
      parts.push(spec.type === "line" || (spec.type === "combo" && i === 1) ? `<line x1="${x}" y1="${y - 4}" x2="${x + 14}" y2="${y - 4}" stroke="${cs[i]}" stroke-width="3" stroke-linecap="round"/>` : `<rect x="${x}" y="${y - 10}" width="12" height="12" rx="3" fill="${cs[i]}"/>`, text(x + 19, y, name, { size: 12, fill: p.ink }));
      x += 19 + textWidth(name) + 22;
    }
  }
  const top = y + 24;
  const foot = spec.source ? 30 : 14;
  let H = BASE_H;

  if (spec.type === "donut") donut();
  else if (spec.type === "kpi") kpi();
  else if (spec.type === "heatmap") heatmap();
  else cartesian();

  if (spec.source) parts.push(text(24, H - 11, `Source: ${spec.source}`, { size: 11 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${id}t ${id}d" style="font-variant-numeric:tabular-nums"><title id="${id}t">${esc(spec.title || "Chart")}</title><desc id="${id}d">${esc(describe(spec))}</desc><defs>${defs.join("")}</defs><rect width="${W}" height="${H}" fill="${p.bg}" rx="10"/>${parts.join("")}</svg>`;

  function donut() {
    const vals = spec.series[0].values;
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const cx = 200, cy = top + (H - top - foot) / 2, R = Math.min(128, (H - top - foot) / 2 - 6), r = R * 0.62;
    const sweep = ease(t) * Math.PI * 2;
    let a0 = -Math.PI / 2;
    const end = a0 + sweep;
    const slice = (i: number) => p.cats[i % p.cats.length];
    const positive = vals.filter((v) => v > 0).length;
    vals.forEach((v, i) => {
      const full = (v / total) * Math.PI * 2;
      const s0 = a0, s1 = Math.min(a0 + full, end);
      a0 += full;
      if (v <= 0 || s1 <= s0) return;
      const mid = (s0 + s1) / 2, out = spec.highlight === i ? 8 : 0;
      const ox = Math.cos(mid) * out, oy = Math.sin(mid) * out;
      const pt = (rad: number, a: number) => `${n1(cx + ox + rad * Math.cos(a))} ${n1(cy + oy + rad * Math.sin(a))}`;
      const big = s1 - s0 > Math.PI ? 1 : 0;
      const label = `${spec.labels[i]}: ${fmt(v)}${unit} (${Math.round((v / total) * 100)}%)`;
      const mark = positive === 1 && s1 - s0 >= Math.PI * 2 - 1e-6
        ? `<circle cx="${cx}" cy="${n1(cy)}" r="${n1((R + r) / 2)}" fill="none" stroke="${slice(i)}" stroke-width="${n1(R - r)}"/>`
        : `<path d="M ${pt(R, s0)} A ${R} ${R} 0 ${big} 1 ${pt(R, s1)} L ${pt(r, s1)} A ${r} ${r} 0 ${big} 0 ${pt(r, s0)} Z" fill="${slice(i)}" stroke="${p.bg}" stroke-width="2"/>`;
      parts.push(`<g>${tip(label)}${mark}</g>`);
    });
    parts.push(text(cx, cy + 4, fmt(total * ease(t)), { size: 26, anchor: "middle", fill: p.ink, weight: 700 }), text(cx, cy + 24, spec.unit ?? "total", { size: 12, anchor: "middle" }));
    const rows = Math.min(vals.length, Math.floor((H - top - foot) / 26));
    vals.slice(0, rows).forEach((v, i) => {
      const ly = top + 16 + i * 26, k = stagger(t, i, vals.length), share = v / total;
      const hl = spec.highlight === i;
      parts.push(
        `<rect x="380" y="${ly - 11}" width="12" height="12" rx="3" fill="${slice(i)}"/>`,
        text(400, ly, spec.labels[i], { size: 13, fill: p.ink, weight: hl ? 700 : undefined }),
        `<rect x="560" y="${ly - 7}" width="70" height="5" rx="2.5" fill="${p.grid}"/><rect x="560" y="${ly - 7}" width="${n1(70 * share * k)}" height="5" rx="2.5" fill="${slice(i)}"/>`,
        text(696, ly, `${Math.round(share * 100 * k)}%`, { size: 13, anchor: "end", fill: hl ? p.ink : p.muted, weight: hl ? 700 : undefined }),
      );
    });
  }

  function kpi() {
    const n = spec.labels.length, cols = n <= 3 ? n : 3, rows = Math.ceil(n / cols);
    const gap = 14, tileW = (W - 48 - gap * (cols - 1)) / cols, tileH = spec.trends ? 136 : 108;
    H = top + rows * tileH + (rows - 1) * gap + foot + 10;
    const cur = spec.series[0], cmp = spec.series[1];
    spec.labels.forEach((label, i) => {
      const x = 24 + (i % cols) * (tileW + gap), y0 = top + Math.floor(i / cols) * (tileH + gap), k = stagger(t, i, n);
      const v = cur.values[i];
      const hl = spec.highlight === i;
      parts.push(`<g opacity="${n1(0.25 + 0.75 * k)}">${tip(`${label}: ${fmt(v)}${unit}`)}<rect x="${n1(x)}" y="${n1(y0)}" width="${n1(tileW)}" height="${tileH}" rx="10" fill="${p.tile}" stroke="${hl ? p.series : p.grid}" stroke-width="${hl ? 2 : 1}"/>`);
      parts.push(text(x + 14, y0 + 29, label, { size: 12.5, fill: p.muted, weight: 600 }));
      parts.push(text(x + 14, y0 + 66, fmt(v * k), { size: 30, fill: p.ink, weight: 700 }) + (spec.unit ? text(x + 20 + fmt(v).length * 18, y0 + 66, spec.unit, { size: 13 }) : ""));
      if (cmp) {
        const d = v - cmp.values[i];
        const good = d === 0 ? null : (d > 0) === (spec.better !== "down");
        const colour = good === null ? p.muted : good ? p.positive : p.negInk;
        const pct = cmp.values[i] ? ` (${signed(Math.round((d / Math.abs(cmp.values[i])) * 1000) / 10)}%)` : "";
        const ax = x + 14, ay = y0 + 88;
        parts.push(d === 0 ? "" : `<path d="${d > 0 ? `M${ax},${ay}L${ax + 5},${ay - 8}L${ax + 10},${ay}Z` : `M${ax},${ay - 8}L${ax + 5},${ay}L${ax + 10},${ay - 8}Z`}" fill="${colour}"/>`);
        parts.push(text(ax + (d === 0 ? 0 : 15), ay, `${signed(d)}${pct} vs ${cmp.name}`, { size: 12, fill: colour, weight: 600 }));
      }
      const tr = spec.trends?.[i];
      if (tr && tr.length >= 2) {
        const lo = Math.min(...tr), hi = Math.max(...tr), sx0 = x + 14, sx1 = x + tileW - 14, sy0 = y0 + tileH - 32, sy1 = y0 + tileH - 10;
        const pts = tr.map((u, j) => [sx0 + ((sx1 - sx0) * j) / (tr.length - 1), sy1 - ((u - lo) / (hi - lo || 1)) * (sy1 - sy0)]);
        const shown = Math.max(2, Math.ceil(pts.length * k));
        const line = pts.slice(0, shown).map(([a, b]) => `${n1(a)},${n1(b)}`).join(" ");
        parts.push(`<polygon points="${n1(sx0)},${n1(sy1)} ${line} ${n1(pts[shown - 1][0])},${n1(sy1)}" fill="${fade(cs[0])}"/>`, `<polyline points="${line}" fill="none" stroke="${cs[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
      }
      parts.push("</g>");
    });
  }

  function heatmap() {
    const rows = spec.series.length, cols = spec.labels.length;
    const left = Math.min(200, 32 + Math.max(...spec.series.map((s) => s.name.length)) * 6.6);
    const cellW = (W - left - 24) / cols, cellH = Math.min(40, Math.max(26, 260 / rows));
    const gridTop = top + 22;
    H = gridTop + rows * cellH + foot + 30;
    const all = spec.series.flatMap((s) => s.values);
    const lo = Math.min(...all), hi = Math.max(...all);
    spec.labels.forEach((l, j) => parts.push(text(left + cellW * (j + 0.5), gridTop - 8, l.length > 14 && cols > 6 ? `${l.slice(0, 13)}...` : l, { size: 11.5, anchor: "middle", fill: spec.highlight === j ? p.ink : p.muted, weight: spec.highlight === j ? 700 : undefined })));
    spec.series.forEach((s, i) => {
      const cy = gridTop + i * cellH;
      parts.push(text(left - 10, cy + cellH / 2 + 4, s.name, { size: 12, anchor: "end", fill: p.ink }));
      s.values.forEach((v, j) => {
        const k = stagger(t, i * cols + j, rows * cols, 0.5);
        let fill: string, ink: string, alpha = 1;
        if (spec.scale === "rag") {
          const r = Math.max(1, Math.min(3, Math.round(v)));
          fill = RAG[r - 1];
          ink = RAG_INK;
        } else {
          alpha = 0.12 + 0.88 * ((v - lo) / (hi - lo || 1));
          fill = p.series;
          ink = alpha > 0.55 ? p.bg : p.ink;
        }
        const label = spec.scale === "rag" ? ["Red", "Amber", "Green"][Math.max(1, Math.min(3, Math.round(v))) - 1] : fmt(v);
        parts.push(`<g opacity="${n1(k)}">${tip(`${s.name} / ${spec.labels[j]}: ${spec.scale === "rag" ? label : `${fmt(v)}${unit}`}`)}<rect x="${n1(left + j * cellW + 2)}" y="${n1(cy + 2)}" width="${n1(cellW - 4)}" height="${n1(cellH - 4)}" rx="5" fill="${fill}" fill-opacity="${n1(alpha * 100) / 100}"/>${cellW > 34 ? text(left + (j + 0.5) * cellW, cy + cellH / 2 + 4, spec.scale === "rag" ? label[0] : fmt(v), { size: 11.5, anchor: "middle", fill: ink, weight: 600 }) : ""}</g>`);
      });
    });
    const ly = gridTop + rows * cellH + 20;
    if (spec.scale === "rag") ["Red", "Amber", "Green"].forEach((l, i) => parts.push(`<rect x="${left + i * 76}" y="${ly - 10}" width="12" height="12" rx="3" fill="${RAG[i]}"/>`, text(left + i * 76 + 18, ly, l, { size: 11.5 })));
    else parts.push(text(left, ly, fmt(lo), { size: 11 }), `<rect x="${left + 34}" y="${ly - 9}" width="120" height="10" rx="5" fill="${grad(p.series, true)}"/>`, text(left + 162, ly, fmt(hi), { size: 11 }));
  }

  function cartesian() {
    const horizontal = spec.type === "hbar";
    const n = spec.labels.length;
    const s0 = spec.series[0].values;
    // The value range each type needs.
    let range: number[];
    const cum: number[] = [];
    if (spec.type === "waterfall") {
      let run = 0;
      // Totals stand on the axis; each change floats from the running total before it.
      s0.forEach((v, i) => {
        const total = i === 0 || i === n - 1;
        cum.push(total ? 0 : run);
        run = total ? v : run + v;
      });
      range = s0.flatMap((v, i) => (i === 0 || i === n - 1 ? [0, v] : [cum[i], cum[i] + v]));
    } else if (spec.type === "stacked") {
      range = spec.labels.flatMap((_, i) => [spec.series.reduce((a, s) => a + Math.max(0, s.values[i]), 0), spec.series.reduce((a, s) => a + Math.min(0, s.values[i]), 0)]);
    } else if (spec.type === "combo") range = [...s0];
    else range = spec.series.flatMap((s) => s.values);
    if (spec.target) range.push(spec.target.value);
    // Every level a bridge reaches, leaving out the zero its totals stand on.
    const levels = spec.type === "waterfall" ? [...s0.flatMap((v, i) => (i === 0 || i === n - 1 ? [v] : [cum[i], cum[i] + v])), ...(spec.target ? [spec.target.value] : [])] : [];
    // Bars measure from zero. A trend line and a bridge zoom to their data: a walk from 500 to 513 drawn from zero
    // would hide every change in it, so its totals stand on the axis floor instead.
    const zoom = (lo: number, hi: number) => {
      const pad = (hi - lo || Math.abs(hi) || 1) * (spec.type === "waterfall" ? 1.2 : 0.25);
      return lo >= 0 && lo - pad > 0 ? niceScale(lo - pad, hi + pad * 0.3, false) : niceScale(lo, hi);
    };
    const sc = spec.type === "line" ? zoom(Math.min(...range), Math.max(...range)) : spec.type === "waterfall" ? zoom(Math.min(...levels), Math.max(...range)) : niceScale(Math.min(...range), Math.max(...range));
    const sc2 = spec.type === "combo" ? niceScale(Math.min(...spec.series[1].values), Math.max(...spec.series[1].values)) : null;
    const left = horizontal ? Math.min(220, 40 + Math.max(...spec.labels.map((l) => l.length)) * 6.4) : 60;
    const x0 = left, x1 = W - (sc2 ? 64 : 30), y0 = top, y1 = H - foot - (horizontal ? 22 : 36);
    const val = (v: number, s = sc) => (horizontal ? x0 + ((v - s.lo) / (s.hi - s.lo || 1)) * (x1 - x0) : y1 - ((v - s.lo) / (s.hi - s.lo || 1)) * (y1 - y0));

    for (const tk of ticksOf(sc)) {
      const zero = tk === 0;
      const dash = zero ? "" : ` stroke-dasharray="3 4"`;
      if (horizontal) parts.push(`<line x1="${n1(val(tk))}" y1="${y0}" x2="${n1(val(tk))}" y2="${y1}" stroke="${zero ? p.muted : p.grid}"${dash}/>`, text(val(tk), y1 + 16, fmt(tk), { size: 11, anchor: "middle" }));
      else parts.push(`<line x1="${x0}" y1="${n1(val(tk))}" x2="${x1}" y2="${n1(val(tk))}" stroke="${zero ? p.muted : p.grid}"${dash}/>`, text(x0 - 10, val(tk) + 4, fmt(tk), { size: 11, anchor: "end" }));
    }
    if (sc2) for (const tk of ticksOf(sc2)) parts.push(text(x1 + 10, val(tk, sc2) + 4, fmt(tk), { size: 11 }));

    const band = (horizontal ? y1 - y0 : x1 - x0) / n;
    const mid = (i: number) => (horizontal ? y0 : x0) + band * (i + 0.5);
    const dim = (i: number) => (spec.highlight === undefined || spec.highlight === i ? 1 : 0.42);
    spec.labels.forEach((label, i) => {
      const bold = spec.highlight === i ? 700 : undefined;
      if (horizontal) parts.push(text(x0 - 10, mid(i) + 4, label, { size: 12, anchor: "end", fill: p.ink, weight: bold }));
      else parts.push(text(mid(i), y1 + 18, label.length > 14 && n > 6 ? `${label.slice(0, 13)}...` : label, { size: 12, anchor: "middle", fill: p.ink, weight: bold }));
    });

    const lines = spec.type === "line" ? spec.series.map((_, i) => i) : spec.type === "combo" ? [1] : [];
    const bars = spec.type === "line" ? [] : spec.type === "combo" ? [0] : spec.series.map((_, i) => i);
    const callout: { x: number; y: number; s: string }[] = [];

    if (spec.type === "stacked") {
      spec.labels.forEach((label, i) => {
        const k = stagger(t, i, n);
        let pos = 0, neg = 0;
        const bw = Math.min(54, band * 0.62);
        const top0 = spec.series.reduce((a, s) => a + Math.max(0, s.values[i]), 0);
        spec.series.forEach((s, si) => {
          const v = s.values[i] * k;
          const from = v >= 0 ? pos : neg, to = from + v;
          if (v >= 0) pos = to;
          else neg = to;
          const yA = val(Math.max(from, to)), yB = val(Math.min(from, to));
          const last = v >= 0 ? spec.series.slice(si + 1).every((x) => x.values[i] <= 0) : false;
          const d = last ? barPath(mid(i) - bw / 2, yA, bw, Math.max(1, yB - yA), 4, "t") : `M${n1(mid(i) - bw / 2)},${n1(yA)}h${n1(bw)}v${n1(Math.max(1, yB - yA))}h${n1(-bw)}Z`;
          parts.push(`<g opacity="${dim(i)}">${tip(`${label} / ${s.name}: ${fmt(s.values[i])}${unit}`)}<path d="${d}" fill="${cs[si]}" stroke="${p.bg}" stroke-width="1"/>${yB - yA > 18 && bw > 30 ? text(mid(i), (yA + yB) / 2 + 4, fmt(v), { size: 10.5, anchor: "middle", fill: p.bg, weight: 600 }) : ""}</g>`);
        });
        parts.push(text(mid(i), val(top0 * k) - 7, fmt(top0 * k), { size: 11.5, anchor: "middle", fill: dim(i) < 1 ? p.muted : p.ink, weight: 600 }));
        if (spec.highlight === i) callout.push({ x: mid(i), y: val(top0) - 26, s: `${label}: ${fmt(top0)}${unit}` });
      });
    } else if (spec.type === "waterfall") {
      const bw = Math.min(56, band * 0.6);
      s0.forEach((v, i) => {
        const k = stagger(t, i, n);
        const total = i === 0 || i === n - 1;
        const from = total ? Math.max(0, sc.lo) : cum[i], to = total ? from + (v - from) * k : from + v * k;
        const colour = total ? cs[0] : v >= 0 ? p.positive : p.negative;
        const yA = val(Math.max(from, to)), yB = val(Math.min(from, to));
        parts.push(`<g opacity="${dim(i)}">${tip(`${spec.labels[i]}: ${total ? fmt(v) : signed(v)}${unit}`)}<path d="${barPath(mid(i) - bw / 2, yA, bw, Math.max(1, yB - yA), 4, v >= 0 || total ? "t" : "b")}" fill="${colour}"/></g>`);
        parts.push(text(mid(i), v >= 0 || total ? yA - 7 : yB + 15, total ? fmt(v * k) : signed(v * k), { size: 11.5, anchor: "middle", fill: dim(i) < 1 ? p.muted : (total ? p.ink : v >= 0 ? p.positive : p.negInk), weight: 650 }));
        if (i < n - 1 && k >= 1) {
          const level = total ? v : cum[i] + v;
          parts.push(`<line x1="${n1(mid(i) + bw / 2)}" y1="${n1(val(level))}" x2="${n1(mid(i + 1) - bw / 2)}" y2="${n1(val(level))}" stroke="${p.muted}" stroke-dasharray="2 3"/>`);
        }
        if (spec.highlight === i) callout.push({ x: mid(i), y: (v >= 0 || total ? yA : yB) - 26, s: `${spec.labels[i]}: ${total ? fmt(v) : signed(v)}${unit}` });
      });
    } else {
      const k = bars.length;
      const bw = Math.min(46, (band * 0.7) / Math.max(1, k));
      bars.forEach((si, bi) =>
        spec.series[si].values.forEach((v, i) => {
          const e = stagger(t, i, n);
          const off = (bi - (k - 1) / 2) * bw;
          const m = mid(i) + off;
          const base = val(0), end = val(v * e);
          // One series: a negative bar turns orange. Several: each keeps its series colour, and its sign shows below the axis.
          const colour = v < 0 && spec.series.length === 1 ? p.negative : cs[si];
          const neg = v < 0;
          const d = horizontal
            ? barPath(Math.min(base, end), m - bw / 2 + 1, Math.max(1, Math.abs(end - base)), bw - 2, 4, neg ? "l" : "r")
            : barPath(m - bw / 2 + 1, Math.min(base, end), bw - 2, Math.max(1, Math.abs(end - base)), 4, neg ? "b" : "t");
          parts.push(`<g opacity="${dim(i)}">${tip(`${spec.labels[i]}${spec.series.length > 1 ? ` / ${spec.series[si].name}` : ""}: ${fmt(v)}${unit}`)}<path d="${d}" fill="${colour}"/></g>`);
          if (horizontal) parts.push(text(Math.max(base, end) + 6, m + 4, fmt(v * e), { size: 11, fill: dim(i) < 1 ? p.muted : p.ink }));
          else if (n * k <= 18) parts.push(text(m, neg ? end + 14 : end - 7, fmt(v * e), { size: 11, anchor: "middle", fill: dim(i) < 1 ? p.muted : p.ink, weight: 600 }));
          if (spec.highlight === i && bi === 0) callout.push(horizontal ? { x: Math.max(base, val(v)) + 60, y: m - bw / 2 - 6, s: `${fmt(v)}${unit}` } : { x: m, y: Math.min(val(0), val(v)) - 26, s: `${spec.labels[i]}: ${fmt(v)}${unit}` });
        }),
      );
    }

    for (const si of lines) {
      const s = spec.series[si];
      const scale = spec.type === "combo" ? sc2! : sc;
      const pts = s.values.map((v, i) => [mid(i), val(v, scale)] as const);
      const e = ease(t);
      const str = pts.map(([a, b]) => `${n1(a)},${n1(b)}`).join(" ");
      const draw = t < 1 ? ` pathLength="1" stroke-dasharray="1" stroke-dashoffset="${n1((1 - e) * 1000) / 1000}"` : "";
      if (spec.series.length === 1 && spec.type === "line") parts.push(`<polygon points="${n1(pts[0][0])},${y1} ${str} ${n1(pts[pts.length - 1][0])},${y1}" fill="${fade(cs[si])}" opacity="${n1(e)}"/>`);
      parts.push(`<polyline points="${str}" fill="none" stroke="${cs[si]}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"${draw}/>`);
      pts.forEach(([a, b], i) => {
        const shown = e >= (n > 1 ? i / (n - 1) : 0) - 1e-9;
        if (!shown) return;
        const hl = spec.highlight === i;
        parts.push(`<g>${tip(`${spec.labels[i]} / ${s.name}: ${fmt(s.values[i])}${si === 1 && spec.unit2 ? ` ${spec.unit2}` : unit}`)}<circle cx="${n1(a)}" cy="${n1(b)}" r="${hl ? 7 : 4.5}" fill="${hl ? cs[si] : p.bg}" stroke="${cs[si]}" stroke-width="2.5"/></g>`);
        if (n <= 10 && spec.series.length <= 2 && spec.type === "line") parts.push(text(a, b - 11, fmt(s.values[i]), { size: 11, anchor: "middle", fill: p.ink, weight: hl ? 700 : 500 }));
        if (hl && si === lines[0]) {
          parts.push(`<line x1="${n1(a)}" y1="${y0}" x2="${n1(a)}" y2="${y1}" stroke="${cs[si]}" stroke-opacity="0.35" stroke-dasharray="3 3"/>`);
          callout.push({ x: a, y: b - 30, s: `${spec.labels[i]}: ${fmt(s.values[i])}` });
        }
      });
    }

    if (spec.target && t >= 0.6) {
      const tv = spec.target.value, label = `${spec.target.label ?? "Target"} ${fmt(tv)}${unit}`;
      if (horizontal) parts.push(`<line x1="${n1(val(tv))}" y1="${y0 - 6}" x2="${n1(val(tv))}" y2="${y1}" stroke="${p.series2}" stroke-width="2" stroke-dasharray="6 4"/>`, pill(val(tv), y0 - 8, label, p.series2));
      else parts.push(`<line x1="${x0}" y1="${n1(val(tv))}" x2="${x1}" y2="${n1(val(tv))}" stroke="${p.series2}" stroke-width="2" stroke-dasharray="6 4"/>`, pill(x1, val(tv) - 6, label, p.series2, "end"));
    }
    if (t >= 1) for (const c of callout) parts.push(pill(Math.max(70, Math.min(W - 70, c.x)), Math.max(top - 4, c.y), c.s, p.series));
  }
}
