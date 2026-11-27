import type { ArchSpec, ArchStatus } from "../../shared/viz";
import { iconAt, iconFor, type IconName } from "../../shared/icons";
import type { Palette } from "./palette";
import { textWidth, wrapLabel } from "./specChart";

/**
 * An architecture option as a stack of full-width layers, the foundation at the bottom. Each layer is a slab with a
 * shallow depth face (the 3D cue), an icon and its name on the left and its systems as chips across the rest of the
 * width, each chip marked by what happens to it (new, kept, retired). Data flows are arrows between chips, listed
 * again under the stack. Labels wrap rather than being cut, so the drawing stays readable when a slide shows it full
 * width. Each layer carries its position from the top as --va-i, so the console and HTML pages can build the stack in.
 */
const W = 1160;
const X0 = 24;
const X1 = W - 24;
const NAME_W = 290;
const DEPTH = 9;
/** Space between slabs: the connectors and their labels run here, never across a system's card. */
const GAP = 40;
const CHIP_PAD = 46;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n1 = (v: number) => +v.toFixed(1);

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Layer accents from the brand board; the light set is for white pages, the dark set for the console. */
const LAYER_COLOURS = {
  dark: ["#00e5ff", "#8c9eff", "#d4af37", "#3a8fa3", "#a9b1c7", "#ff5722", "#2fd49a"],
  light: ["#0097a7", "#3d4a8f", "#b8921c", "#5a6278", "#00838f", "#e64a19", "#1b8a5a"],
};

/** What happens to a system: new is cyan, kept is neutral, retired is orange and struck through. */
const STATUS_ICON: Record<ArchStatus, IconName> = { new: "sparkles", keep: "check", retire: "x" };
const STATUS_WORD: Record<ArchStatus, string> = { new: "New", keep: "Kept", retire: "Retire" };

interface Chip {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function archSvg(spec: ArchSpec, p: Palette): string {
  const light = p.bg.toLowerCase() === "#ffffff";
  const colours = light ? LAYER_COLOURS.light : LAYER_COLOURS.dark;
  const statusColour: Record<ArchStatus, string> = { new: light ? "#00838f" : "#00e5ff", keep: p.muted, retire: light ? "#e64a19" : "#ff5722" };
  const text = (x: number, y: number, s: string, o: { size?: number; fill?: string; weight?: number; anchor?: string; halo?: boolean } = {}) =>
    `<text x="${n1(x)}" y="${n1(y)}" font-family="${esc(p.font)}" font-size="${o.size ?? 12}" fill="${o.fill ?? p.muted}"${o.weight ? ` font-weight="${o.weight}"` : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.halo ? ` stroke="${p.bg}" stroke-width="4" paint-order="stroke" stroke-linejoin="round"` : ""}>${esc(s)}</text>`;

  // Chip sizes: each layer's systems share the width right of the name; a long name wraps onto a second line.
  // When a layer's systems do not fit one row in two lines each, they go two to a row.
  const room = X1 - 16 - (X0 + NAME_W);
  // Chip text is measured a little wide (15.4 for 14 px): bold names and fallback fonts run wider than the estimate.
  const fits = (t: string[], cap: number) => t.length <= 2 && t.every((l) => textWidth(l, 15.4) <= cap);
  const perRow = spec.layers.map((l) => {
    const cap = (room - (l.items.length - 1) * 12) / l.items.length - CHIP_PAD;
    return l.items.every((it) => fits(wrapLabel(it.name, cap, 15.4, 2), cap)) ? l.items.length : 2;
  });
  const chipText = spec.layers.map((l, i) => {
    const cap = (room - (perRow[i] - 1) * 12) / perRow[i] - CHIP_PAD;
    return l.items.map((it) => wrapLabel(it.name, cap, 15.4, 3));
  });
  const lines = Math.max(1, ...chipText.flat().map((t) => t.length));
  const chipH = 22 + lines * 17;
  const chipRows = Math.max(1, ...spec.layers.map((l, i) => Math.ceil(l.items.length / perRow[i])));
  const nameLines = spec.layers.map((l) => wrapLabel(l.name, NAME_W - 76 - (l.badge ? textWidth(l.badge, 10.5) + 22 : 0), 17, 2));
  const BH = Math.max(72, chipRows * chipH + (chipRows - 1) * 10 + 26, ...nameLines.map((l) => 30 + l.length * 21));

  const top = spec.title ? 60 : 20;
  const n = spec.layers.length;
  // The foundation (layer 0) is drawn at the bottom.
  const bandY = (i: number) => top + (n - 1 - i) * (BH + GAP);
  const stackH = n * (BH + GAP) - GAP + DEPTH;
  const statuses = [...new Set(spec.layers.flatMap((l) => l.items.map((i) => i.status)))];
  const showLegend = statuses.some((s) => s !== "keep") || spec.flows.length > 0;
  // The foot (legend, the list of flows whose label did not fit, the note) is sized once the flows are routed.
  const footOf = (listed: number) => (showLegend ? 30 : 0) + (listed ? 8 + listed * 17 : 0) + (spec.note ? 24 : 0) + 12;
  let H = top + stackH + 32 + footOf(spec.flows.length);

  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${p.bg}" rx="10"/>`];
  if (spec.title) parts.push(text(X0, 36, spec.title, { size: 17, fill: p.ink, weight: 650 }));

  const chips = new Map<string, Chip>();
  const bands: string[] = [];
  spec.layers.forEach((layer, i) => {
    const y = bandY(i);
    const accent = colours[i % colours.length];
    const hot = Boolean(layer.badge);
    const face = light ? (hot ? "#fbf6e6" : "#f4f6fa") : hot ? "#2a2716" : "#20263a";
    const g: string[] = [];
    // The slab: a depth face under the top face, then the top face with an accent edge.
    g.push(`<polygon points="${X0},${y + BH} ${X1},${y + BH} ${X1 + DEPTH},${y + BH + DEPTH} ${X0 + DEPTH},${y + BH + DEPTH}" fill="${light ? shade(face, -0.12) : shade(face, -0.45)}"/>`);
    g.push(`<polygon points="${X1},${y} ${X1 + DEPTH},${y + DEPTH} ${X1 + DEPTH},${y + BH + DEPTH} ${X1},${y + BH}" fill="${light ? shade(face, -0.2) : shade(face, -0.55)}"/>`);
    g.push(`<rect x="${X0}" y="${y}" width="${X1 - X0}" height="${BH}" rx="6" fill="${face}" stroke="${hot ? p.series2 : p.grid}" stroke-width="${hot ? 1.5 : 1}"/>`);
    g.push(`<rect x="${X0}" y="${y}" width="5" height="${BH}" rx="2" fill="${hot ? p.series2 : accent}"/>`);
    g.push(iconAt(iconFor(layer.name), X0 + 22, y + BH / 2 - 14, 28, hot ? p.series2 : accent));
    const nl = nameLines[i];
    nl.forEach((ln, k) => g.push(text(X0 + 64, y + BH / 2 + 6 + (k - (nl.length - 1) / 2) * 21, ln, { size: 17, fill: p.ink, weight: 650 })));
    if (layer.badge) {
      const bx = X0 + 64 + Math.max(...nl.map((l) => textWidth(l, 17))) + 12, bw = textWidth(layer.badge, 10.5) + 16;
      g.push(`<rect x="${n1(bx)}" y="${n1(y + BH / 2 - 10)}" width="${n1(bw)}" height="20" rx="4" fill="${p.series2}"/>`, text(bx + bw / 2, y + BH / 2 + 4, layer.badge, { size: 10.5, fill: light ? "#ffffff" : "#111318", weight: 800, anchor: "middle" }));
    }
    // Chips, left to right.
    const rowsHere = Math.ceil(layer.items.length / perRow[i]);
    const block = rowsHere * chipH + (rowsHere - 1) * 10;
    let x = X0 + NAME_W;
    layer.items.forEach((item, k) => {
      if (k && k % perRow[i] === 0) x = X0 + NAME_W;
      const t = chipText[i][k];
      const w = Math.max(...t.map((l) => textWidth(l, 15.4))) + CHIP_PAD;
      const cy = y + (BH - block) / 2 + Math.floor(k / perRow[i]) * (chipH + 10);
      const c = statusColour[item.status];
      chips.set(item.name.toLowerCase(), { x, y: cy, w, h: chipH });
      g.push(`<rect x="${n1(x)}" y="${n1(cy)}" width="${n1(w)}" height="${chipH}" rx="5" fill="${item.status === "new" ? (light ? "#e0f7fa" : "#0f2a33") : light ? "#ffffff" : "#141927"}" stroke="${item.status === "keep" ? p.grid : c}" stroke-width="1.2"/>`);
      g.push(iconAt(STATUS_ICON[item.status], x + 12, cy + chipH / 2 - 8, 16, c, 2.2));
      t.forEach((ln, j) => {
        const ty = cy + chipH / 2 + 5 + (j - (t.length - 1) / 2) * 17;
        g.push(text(x + 36, ty, ln, { size: 14, fill: item.status === "retire" ? c : p.ink, weight: item.status === "new" ? 600 : undefined }));
        if (item.status === "retire") g.push(`<line x1="${n1(x + 36)}" y1="${n1(ty - 5)}" x2="${n1(x + 36 + textWidth(ln, 14))}" y2="${n1(ty - 5)}" stroke="${c}" stroke-width="1.4"/>`);
      });
      x += w + 12;
    });
    bands.push(`<g class="va-band" style="--va-i:${n - 1 - i}"><title>${esc(`${layer.name}: ${layer.items.map((it) => `${it.name} (${STATUS_WORD[it.status].toLowerCase()})`).join(", ")}`)}</title>${g.join("")}</g>`);
  });
  parts.push(...bands);

  // Data flows, routed around the cards. A flow leaves its system through the top or bottom edge into the gap
  // between slabs, runs along that gap to a lane that no card blocks in the slabs it has to cross, and enters the other
  // system from the gap next to it. Systems on the same slab are joined through the gap below it. A label goes in a gap
  // only where it clears every card and every other label; otherwise the flow gets a number, listed under the stack.
  const clear = GAP - DEPTH;
  const layerOf = new Map<string, number>();
  spec.layers.forEach((l, i) => l.items.forEach((it) => layerOf.set(it.name.toLowerCase(), i)));
  const below = (i: number) => bandY(i) + BH + DEPTH + clear / 2; // middle of the gap under slab i
  const above = (i: number) => bandY(i) - clear / 2; // middle of the gap over slab i
  const boxes: { x0: number; y0: number; x1: number; y1: number }[] = [...chips.values()].map((c) => ({ x0: c.x - 4, y0: c.y - 3, x1: c.x + c.w + 4, y1: c.y + c.h + 3 }));
  const hits = (r: { x0: number; y0: number; x1: number; y1: number }) => boxes.some((b) => r.x0 < b.x1 && r.x1 > b.x0 && r.y0 < b.y1 && r.y1 > b.y0);
  // Free x ranges on a slab: right of the layer name and clear of its cards.
  const free = (i: number): [number, number][] => {
    const cs = spec.layers[i].items.map((it) => chips.get(it.name.toLowerCase())!).sort((a, b) => a.x - b.x);
    const out: [number, number][] = [];
    let x = X0 + NAME_W - 10;
    for (const c of cs) {
      if (c.x - 8 > x + 6) out.push([x, c.x - 8]);
      x = Math.max(x, c.x + c.w + 8);
    }
    if (X1 - 12 > x + 6) out.push([x, X1 - 12]);
    return out;
  };
  const usedLanes: number[] = [];
  const gapUse = new Map<number, number>();
  const lane = (from: number, to: number, want: number): number => {
    const crossed = spec.layers.map((_, i) => i).filter((i) => i > Math.min(from, to) && i < Math.max(from, to));
    let ranges: [number, number][] = [[X0 + NAME_W - 10, X1 - 12]];
    for (const i of crossed) {
      const f = free(i);
      ranges = ranges.flatMap(([a, b]) => f.map(([c, d]): [number, number] => [Math.max(a, c), Math.min(b, d)]).filter(([c, d]) => d - c > 8));
    }
    if (!ranges.length) return want;
    const options = ranges.flatMap(([a, b]) => [Math.min(b - 4, Math.max(a + 4, want)), ...[-1, 1].map((k) => Math.min(b - 4, Math.max(a + 4, want + k * 12)))]);
    options.sort((u, v) => Math.abs(u - want) + (usedLanes.some((l) => Math.abs(l - u) < 9) ? 400 : 0) - (Math.abs(v - want) + (usedLanes.some((l) => Math.abs(l - v) < 9) ? 400 : 0)));
    usedLanes.push(options[0]);
    return options[0];
  };
  // Each flow takes its own track in a gap, so two flows in one gap do not draw over each other.
  const track = (y: number) => {
    const k = gapUse.get(Math.round(y)) ?? 0;
    gapUse.set(Math.round(y), k + 1);
    return y + [0, -7, 7, -12, 12][k % 5];
  };
  const r6 = (pts: [number, number][]) => {
    // An orthogonal path with small rounded corners.
    let d = `M ${n1(pts[0][0])} ${n1(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
      const r = Math.min(6, Math.abs(x - px) / 2 + Math.abs(y - py) / 2, Math.abs(nx - x) / 2 + Math.abs(ny - y) / 2);
      const ax = x - Math.sign(x - px) * r, ay = y - Math.sign(y - py) * r, bx = x + Math.sign(nx - x) * r, by = y + Math.sign(ny - y) * r;
      d += ` L ${n1(ax)} ${n1(ay)} Q ${n1(x)} ${n1(y)} ${n1(bx)} ${n1(by)}`;
    }
    const [lx, ly] = pts[pts.length - 1];
    return `${d} L ${n1(lx)} ${n1(ly)}`;
  };
  const arrows: string[] = [];
  const tags: string[] = [];
  const numbered: number[] = [];
  // Ports: flows that share a card edge leave or enter it side by side, ordered by where they go, so they never
  // start on one point and run over each other.
  const sideOf = (f: ArchSpec["flows"][number], end: "from" | "to") => {
    const la = layerOf.get(f.from.toLowerCase())!, lb = layerOf.get(f.to.toLowerCase())!;
    const up = lb > la;
    return la === lb ? "b" : (end === "from") === up ? "t" : "b";
  };
  const portUse = new Map<string, { k: number; toward: number }[]>();
  spec.flows.forEach((f, k) => {
    for (const end of ["from", "to"] as const) {
      const other = chips.get((end === "from" ? f.to : f.from).toLowerCase())!;
      const key = `${(end === "from" ? f.from : f.to).toLowerCase()}|${sideOf(f, end)}`;
      portUse.set(key, [...(portUse.get(key) ?? []), { k, toward: other.x + other.w / 2 }]);
    }
  });
  const port = (name: string, side: string, k: number) => {
    const c = chips.get(name.toLowerCase())!;
    const list = [...(portUse.get(`${name.toLowerCase()}|${side}`) ?? [])].sort((u, v) => u.toward - v.toward);
    const i = list.findIndex((e) => e.k === k);
    const step = Math.min(18, c.w / (list.length + 1));
    return c.x + c.w / 2 + (i - (list.length - 1) / 2) * step;
  };
  spec.flows.forEach((f, k) => {
    const a = chips.get(f.from.toLowerCase())!;
    const b = chips.get(f.to.toLowerCase())!;
    const la = layerOf.get(f.from.toLowerCase())!, lb = layerOf.get(f.to.toLowerCase())!;
    const sx = port(f.from, sideOf(f, "from"), k), ex = port(f.to, sideOf(f, "to"), k);
    let pts: [number, number][];
    let gaps: { y: number; x0: number; x1: number }[];
    if (la === lb) {
      const y = track(below(la));
      pts = [[sx, a.y + a.h], [sx, y], [ex, y], [ex, b.y + b.h]];
      gaps = [{ y, x0: Math.min(sx, ex), x1: Math.max(sx, ex) }];
    } else {
      const up = lb > la; // layer 0 is the foundation, drawn at the bottom
      const y1 = track(up ? above(la) : below(la));
      const y2 = track(up ? below(lb) : above(lb));
      const lx = Math.abs(lb - la) > 1 ? lane(la, lb, (sx + ex) / 2) : sx;
      pts = Math.abs(lb - la) > 1
        ? [[sx, up ? a.y : a.y + a.h], [sx, y1], [lx, y1], [lx, y2], [ex, y2], [ex, up ? b.y + b.h : b.y]]
        : [[sx, up ? a.y : a.y + a.h], [sx, y1], [ex, y1], [ex, up ? b.y + b.h : b.y]];
      gaps = Math.abs(lb - la) > 1
        ? [{ y: y1, x0: Math.min(sx, lx), x1: Math.max(sx, lx) }, { y: y2, x0: Math.min(lx, ex), x1: Math.max(lx, ex) }]
        : [{ y: y1, x0: Math.min(sx, ex), x1: Math.max(sx, ex) }];
    }
    // Drop repeated points (a straight run) so the corners stay clean.
    pts = pts.filter((pt, i) => i === 0 || Math.abs(pt[0] - pts[i - 1][0]) > 0.5 || Math.abs(pt[1] - pts[i - 1][1]) > 0.5);
    const d = r6(pts);
    const [hx, hy] = pts[pts.length - 1];
    const [px, py] = pts[pts.length - 2];
    const dir = Math.sign(hy - py) || 1;
    const head = Math.abs(hx - px) > Math.abs(hy - py)
      ? `${n1(hx)},${n1(hy)} ${n1(hx - Math.sign(hx - px) * 8)},${n1(hy - 4.5)} ${n1(hx - Math.sign(hx - px) * 8)},${n1(hy + 4.5)}`
      : `${n1(hx)},${n1(hy)} ${n1(hx - 4.5)},${n1(hy - dir * 8)} ${n1(hx + 4.5)},${n1(hy - dir * 8)}`;
    arrows.push(
      `<g><title>${esc(`${f.from} -> ${f.to}${f.label ? `: ${f.label}` : ""}`)}</title>`,
      `<path d="${d}" fill="none" stroke="${p.bg}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<polygon points="${head}" fill="${p.ink}"/></g>`,
    );
    // The label: on a gap run where it clears every card and label, else beside the run, else a number.
    let placed = false;
    if (f.label) {
      const w = textWidth(f.label, 11.5) + 8;
      for (const g of [...gaps].sort((u, v) => v.x1 - v.x0 - (u.x1 - u.x0))) {
        const mid = (g.x0 + g.x1) / 2;
        for (const cx of [mid, g.x1 + w / 2 + 6, g.x0 - w / 2 - 6]) {
          const r = { x0: cx - w / 2, y0: g.y - 8, x1: cx + w / 2, y1: g.y + 7 };
          if (r.x0 < X0 + NAME_W - 10 || r.x1 > X1 - 4 || hits(r)) continue;
          boxes.push(r);
          tags.push(`<rect x="${n1(r.x0)}" y="${n1(r.y0)}" width="${n1(w)}" height="15" rx="3" fill="${p.bg}"/>`, text(cx, g.y + 3.5, f.label, { size: 11.5, fill: p.ink, anchor: "middle" }));
          placed = true;
          break;
        }
        if (placed) break;
      }
    }
    if (f.label && !placed) {
      numbered.push(k);
      const g = gaps[0];
      const cx = (g.x0 + g.x1) / 2 || g.x0;
      tags.push(`<circle cx="${n1(cx)}" cy="${n1(g.y)}" r="7.5" fill="${p.ink}"/>`, text(cx, g.y + 3.5, String(numbered.length), { size: 10, fill: p.bg, anchor: "middle", weight: 700 }));
    }
  });
  if (arrows.length) parts.push(`<g class="va-flows">${arrows.join("")}${tags.join("")}</g>`);
  // Every label sits on the drawing, so only the numbered flows are listed under it (all of them stay in the title).
  H = top + stackH + 32 + footOf(numbered.length);
  parts[0] = `<rect width="${W}" height="${H}" fill="${p.bg}" rx="10"/>`;

  // Legend and the flow list under the stack.
  let y = top + stackH + 44;
  if (showLegend) {
    let x = X0;
    for (const s of (["new", "keep", "retire"] as ArchStatus[]).filter((s) => statuses.includes(s) && (s !== "keep" || statuses.length > 1))) {
      parts.push(iconAt(STATUS_ICON[s], x, y - 12, 16, statusColour[s], 2.2), text(x + 22, y, STATUS_WORD[s], { size: 12.5, fill: p.ink }));
      x += 22 + textWidth(STATUS_WORD[s], 12.5) + 22;
    }
    if (spec.flows.length) parts.push(`<path d="M ${x} ${y - 4} L ${x + 22} ${y - 4}" stroke="${p.ink}" stroke-width="1.8"/>`, `<polygon points="${x + 26},${y - 4} ${x + 18},${y - 8.5} ${x + 18},${y + 0.5}" fill="${p.ink}"/>`, text(x + 34, y, "Data flow", { size: 12.5, fill: p.ink }));
    y += 14;
  }
  numbered.forEach((k, no) => {
    const f = spec.flows[k];
    parts.push(text(X0, y + 10 + no * 17, `(${no + 1}) ${f.from} -> ${f.to}: ${f.label}`, { size: 12.5 }));
  });
  if (spec.note) parts.push(text(X0, H - 14, spec.note, { size: 12 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" class="va" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.title || "Architecture option")}">${parts.join("")}</svg>`;
}
