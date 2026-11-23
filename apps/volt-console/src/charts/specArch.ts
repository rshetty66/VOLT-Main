import type { ArchSpec, ArchStatus } from "../../shared/viz";
import type { Palette } from "./palette";

/**
 * An architecture option as an isometric stack: each layer is a slab with a top and two side faces, the foundation at the
 * bottom. Each system is a numbered tile on its slab, coloured by what happens to it (new, kept, retired); arrows between
 * tiles are the data flows. The layer names, systems and flows are listed beside and under the stack.
 */
const W = 720;
const A = 110; // half width of a slab's top face
const B = 55; // half height (2:1 isometric)
const T = 16; // slab thickness
const PITCH = 80;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Layer colours from the brand board; the light set is for white pages, the dark set for the console. */
const LAYER_COLOURS = {
  dark: ["#00e5ff", "#6c7694", "#d4af37", "#3a8fa3", "#a9b1c7", "#ff5722", "#8a90a5"],
  light: ["#0097a7", "#1a1e2e", "#d4af37", "#5a6278", "#00b8d4", "#ff5722", "#8a90a5"],
};

/** Tile fill by what happens to the system: new is cyan, kept is white, retired is orange. */
const STATUS_FILL: Record<ArchStatus, string> = { new: "#00e5ff", keep: "#ffffff", retire: "#ff5722" };
const STATUS_WORD: Record<ArchStatus, string> = { new: "New", keep: "Kept", retire: "Retire" };

/** Wraps `text` to lines of at most `max` characters, at most `lines` of them. */
function wrap(text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if ((cur + " " + word).trim().length > max && cur) {
      out.push(cur);
      cur = word;
    } else cur = (cur + " " + word).trim();
  }
  if (cur) out.push(cur);
  return out.length > lines ? [...out.slice(0, lines - 1), `${out.slice(lines - 1).join(" ").slice(0, max - 3)}...`] : out;
}

interface Tile {
  n: number;
  x: number;
  y: number;
}

export function archSvg(spec: ArchSpec, p: Palette): string {
  const colours = p.bg.toLowerCase() === "#ffffff" ? LAYER_COLOURS.light : LAYER_COLOURS.dark;
  const n = spec.layers.length;
  const statuses = [...new Set(spec.layers.flatMap((l) => l.items.map((i) => i.status)))];
  const showLegend = statuses.some((s) => s !== "keep") || spec.flows.length > 0;
  const top = spec.title ? 64 : 24;
  const stackH = B + (n - 1) * PITCH + B + T;
  const flowsH = spec.flows.length ? 10 + spec.flows.length * 15 : 0;
  const footH = (showLegend ? 26 : 0) + flowsH + (spec.note ? 22 : 0) + 14;
  const H = top + stackH + footH;
  const cx = 170;
  const baseY = top + stackH - B - T;
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${p.bg}" rx="8"/>`];
  const text = (x: number, y: number, s: string, o: { size?: number; fill?: string; weight?: number; anchor?: string; halo?: boolean } = {}) =>
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${esc(p.font)}" font-size="${o.size ?? 12}" fill="${o.fill ?? p.muted}"${o.weight ? ` font-weight="${o.weight}"` : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.halo ? ` stroke="${p.bg}" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round"` : ""}>${esc(s)}</text>`;
  if (spec.title) parts.push(text(24, 34, spec.title, { size: 16, fill: p.ink, weight: 600 }));

  // Systems are numbered across the whole stack, foundation first, so a flow can be read against the list.
  const tiles = new Map<string, Tile>();
  let counter = 0;
  const layerNumbers: number[][] = [];
  spec.layers.forEach((layer, i) => {
    const yc = baseY - i * PITCH;
    const m = layer.items.length;
    layerNumbers.push(
      layer.items.map((item, k) => {
        const num = ++counter;
        tiles.set(item.name.toLowerCase(), { n: num, x: cx + (k - (m - 1) / 2) * 46, y: yc + 8 });
        return num;
      }),
    );
  });

  spec.layers.forEach((layer, i) => {
    const yc = baseY - i * PITCH;
    const base = colours[i % colours.length];
    const poly = (pts: [number, number][], fill: string, stroke = p.bg, w = 1.5) => `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round"/>`;
    parts.push(
      poly([[cx - A, yc], [cx, yc + B], [cx, yc + B + T], [cx - A, yc + T]], shade(base, -0.32)),
      poly([[cx, yc + B], [cx + A, yc], [cx + A, yc + T], [cx, yc + B + T]], shade(base, -0.16)),
      poly([[cx, yc - B], [cx + A, yc], [cx, yc + B], [cx - A, yc]], base),
    );
    layer.items.forEach((item, k) => {
      const t = tiles.get(item.name.toLowerCase())!;
      parts.push(
        poly([[t.x, t.y - 9], [t.x + 17, t.y], [t.x, t.y + 9], [t.x - 17, t.y]], STATUS_FILL[item.status], "#0a0d14", 1.2),
        `<text x="${t.x}" y="${t.y + 4}" text-anchor="middle" font-family="${esc(p.font)}" font-size="11" font-weight="700" fill="#0a0d14">${layerNumbers[i][k]}</text>`,
      );
    });
    // Leader line and the layer's labels.
    const lx = cx + A + 36;
    parts.push(`<line x1="${cx + A + 4}" y1="${yc}" x2="${lx - 8}" y2="${yc}" stroke="${p.grid}" stroke-dasharray="3 3"/>`);
    parts.push(text(lx, yc - 4, layer.name, { size: 14, fill: p.ink, weight: 600 }));
    if (layer.badge) {
      const bx = lx + layer.name.length * 8.4 + 10;
      parts.push(`<rect x="${bx}" y="${yc - 17}" width="${layer.badge.length * 6.6 + 14}" height="18" rx="9" fill="${base}"/>`, `<text x="${bx + 7}" y="${yc - 4.5}" font-family="${esc(p.font)}" font-size="10.5" font-weight="700" fill="${p.bg}">${esc(layer.badge)}</text>`);
    }
    const names = layer.items.map((it, k) => `${layerNumbers[i][k]} ${it.name}${it.status === "new" ? " (new)" : it.status === "retire" ? " (retire)" : ""}`).join("  ·  ");
    wrap(names, 56, 3).forEach((l, k) => parts.push(text(lx, yc + 14 + k * 14, l, { size: 12 })));
  });

  // Data flows: curved arrows between tiles, drawn over the slabs, with a small label when there are few.
  spec.flows.forEach((f) => {
    const a = tiles.get(f.from.toLowerCase())!;
    const b = tiles.get(f.to.toLowerCase())!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const sx = a.x + ux * 14;
    const sy = a.y + uy * 9;
    const ex = b.x - ux * 16;
    const ey = b.y - uy * 11;
    const mx = (sx + ex) / 2 + (-uy) * 22;
    const my = (sy + ey) / 2 + ux * 22;
    const path = `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    // Arrowhead along the curve's end direction.
    const tx = ex - mx;
    const ty = ey - my;
    const tl = Math.hypot(tx, ty) || 1;
    const hx = tx / tl;
    const hy = ty / tl;
    const head = `${ex.toFixed(1)},${ey.toFixed(1)} ${(ex - hx * 9 - hy * 4.5).toFixed(1)},${(ey - hy * 9 + hx * 4.5).toFixed(1)} ${(ex - hx * 9 + hy * 4.5).toFixed(1)},${(ey - hy * 9 - hx * 4.5).toFixed(1)}`;
    parts.push(
      `<path d="${path}" fill="none" stroke="${p.bg}" stroke-width="4.5" stroke-linecap="round"/>`,
      `<path d="${path}" fill="none" stroke="${p.ink}" stroke-width="1.8" stroke-linecap="round"/>`,
      `<polygon points="${head}" fill="${p.ink}" stroke="${p.bg}" stroke-width="1" stroke-linejoin="round"/>`,
    );
    if (f.label && spec.flows.length <= 6) parts.push(text((sx + 2 * mx + ex) / 4 + 6, (sy + 2 * my + ey) / 4 - 2, f.label, { size: 10.5, fill: p.ink, halo: true }));
  });

  // Legend and the flow list under the stack.
  let y = top + stackH + 18;
  if (showLegend) {
    let x = 24;
    for (const s of (["new", "keep", "retire"] as ArchStatus[]).filter((s) => statuses.includes(s) && (s !== "keep" || statuses.length > 1))) {
      parts.push(`<polygon points="${x},${y - 4} ${x + 9},${y - 9} ${x + 18},${y - 4} ${x + 9},${y + 1}" fill="${STATUS_FILL[s]}" stroke="#0a0d14" stroke-width="1"/>`, text(x + 24, y, STATUS_WORD[s], { size: 11.5, fill: p.ink }));
      x += 24 + STATUS_WORD[s].length * 7 + 18;
    }
    if (spec.flows.length) parts.push(`<path d="M ${x} ${y - 4} L ${x + 22} ${y - 4}" stroke="${p.ink}" stroke-width="1.8"/>`, `<polygon points="${x + 24},${y - 4} ${x + 17},${y - 8} ${x + 17},${y}" fill="${p.ink}"/>`, text(x + 30, y, "Data flow", { size: 11.5, fill: p.ink }));
    y += 12;
  }
  spec.flows.forEach((f, k) => {
    const a = tiles.get(f.from.toLowerCase())!;
    const b = tiles.get(f.to.toLowerCase())!;
    parts.push(text(24, y + 8 + k * 15, `${a.n} ${f.from} -> ${b.n} ${f.to}${f.label ? `: ${f.label}` : ""}`, { size: 11.5 }));
  });
  if (spec.note) parts.push(text(24, H - 12, spec.note, { size: 11 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.title || "Architecture option")}">${parts.join("")}</svg>`;
}
