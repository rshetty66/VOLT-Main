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
const GAP = 22;
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
  const fits = (t: string[], cap: number) => t.length <= 2 && t.every((l) => textWidth(l, 14) <= cap);
  const perRow = spec.layers.map((l) => {
    const cap = (room - (l.items.length - 1) * 12) / l.items.length - CHIP_PAD;
    return l.items.every((it) => fits(wrapLabel(it.name, cap, 14, 2), cap)) ? l.items.length : 2;
  });
  const chipText = spec.layers.map((l, i) => {
    const cap = (room - (perRow[i] - 1) * 12) / perRow[i] - CHIP_PAD;
    return l.items.map((it) => wrapLabel(it.name, cap, 14, 3));
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
  const footH = (showLegend ? 30 : 0) + (spec.flows.length ? 8 + spec.flows.length * 17 : 0) + (spec.note ? 24 : 0) + 12;
  const H = top + stackH + 18 + footH;

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
      const w = Math.max(...t.map((l) => textWidth(l, 14))) + CHIP_PAD;
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

  // Data flows: an arrow from chip to chip, leaving the edge that faces the other chip, labelled at its middle.
  const arrows: string[] = [];
  spec.flows.forEach((f) => {
    const a = chips.get(f.from.toLowerCase())!;
    const b = chips.get(f.to.toLowerCase())!;
    const up = b.y < a.y - 1, down = b.y > a.y + 1;
    let sx: number, sy: number, ex: number, ey: number, d: string;
    if (up || down) {
      sx = a.x + a.w / 2;
      ex = b.x + b.w / 2;
      sy = up ? a.y : a.y + a.h;
      ey = up ? b.y + b.h : b.y;
      const my = (sy + ey) / 2;
      d = `M ${n1(sx)} ${n1(sy)} C ${n1(sx)} ${n1(my)} ${n1(ex)} ${n1(my)} ${n1(ex)} ${n1(ey)}`;
    } else {
      const right = b.x > a.x;
      sx = right ? a.x + a.w : a.x;
      ex = right ? b.x : b.x + b.w;
      sy = ey = a.y + a.h / 2;
      d = `M ${n1(sx)} ${n1(sy)} L ${n1(ex)} ${n1(ey)}`;
    }
    const dir = up ? -1 : 1;
    const head = up || down ? `${n1(ex)},${n1(ey)} ${n1(ex - 5)},${n1(ey - dir * 9)} ${n1(ex + 5)},${n1(ey - dir * 9)}` : `${n1(ex)},${n1(ey)} ${n1(ex - Math.sign(ex - sx) * 9)},${n1(ey - 5)} ${n1(ex - Math.sign(ex - sx) * 9)},${n1(ey + 5)}`;
    arrows.push(
      `<path d="${d}" fill="none" stroke="${p.bg}" stroke-width="5" stroke-linecap="round"/>`,
      `<path d="${d}" fill="none" stroke="${p.ink}" stroke-width="1.8" stroke-linecap="round"/>`,
      `<polygon points="${head}" fill="${p.ink}"/>`,
    );
    if (f.label) arrows.push(text((sx + ex) / 2 + 8, (sy + ey) / 2 + 4, f.label, { size: 12, fill: p.ink, halo: true }));
  });
  if (arrows.length) parts.push(`<g class="va-flows">${arrows.join("")}</g>`);

  // Legend and the flow list under the stack.
  let y = top + stackH + 30;
  if (showLegend) {
    let x = X0;
    for (const s of (["new", "keep", "retire"] as ArchStatus[]).filter((s) => statuses.includes(s) && (s !== "keep" || statuses.length > 1))) {
      parts.push(iconAt(STATUS_ICON[s], x, y - 12, 16, statusColour[s], 2.2), text(x + 22, y, STATUS_WORD[s], { size: 12.5, fill: p.ink }));
      x += 22 + textWidth(STATUS_WORD[s], 12.5) + 22;
    }
    if (spec.flows.length) parts.push(`<path d="M ${x} ${y - 4} L ${x + 22} ${y - 4}" stroke="${p.ink}" stroke-width="1.8"/>`, `<polygon points="${x + 26},${y - 4} ${x + 18},${y - 8.5} ${x + 18},${y + 0.5}" fill="${p.ink}"/>`, text(x + 34, y, "Data flow", { size: 12.5, fill: p.ink }));
    y += 14;
  }
  spec.flows.forEach((f, k) => parts.push(text(X0, y + 10 + k * 17, `${f.from} -> ${f.to}${f.label ? `: ${f.label}` : ""}`, { size: 12.5 })));
  if (spec.note) parts.push(text(X0, H - 14, spec.note, { size: 12 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" class="va" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.title || "Architecture option")}">${parts.join("")}</svg>`;
}
