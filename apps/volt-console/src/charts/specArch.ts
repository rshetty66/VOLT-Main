import type { ArchSpec } from "../../shared/viz";
import type { Palette } from "./palette";

/**
 * An architecture option as an isometric stack: each layer is a slab with a top and two side faces, the foundation at the
 * bottom. Items sit on the slab as numbered tiles; the layer's name, badge and item names are listed to the right.
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

export function archSvg(spec: ArchSpec, p: Palette): string {
  const colours = p.bg.toLowerCase() === "#ffffff" ? LAYER_COLOURS.light : LAYER_COLOURS.dark;
  const n = spec.layers.length;
  const top = spec.title ? 64 : 24;
  const H = top + B + (n - 1) * PITCH + B + T + (spec.note ? 44 : 28);
  const cx = 150 + 20;
  const baseY = H - (spec.note ? 44 : 28) - B - T;
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="${p.bg}" rx="8"/>`];
  const text = (x: number, y: number, s: string, o: { size?: number; fill?: string; weight?: number } = {}) =>
    `<text x="${x}" y="${y}" font-family="${esc(p.font)}" font-size="${o.size ?? 12}" fill="${o.fill ?? p.muted}"${o.weight ? ` font-weight="${o.weight}"` : ""}>${esc(s)}</text>`;
  if (spec.title) parts.push(text(24, 34, spec.title, { size: 16, fill: p.ink, weight: 600 }));

  spec.layers.forEach((layer, i) => {
    const yc = baseY - i * PITCH;
    const base = colours[i % colours.length];
    const poly = (pts: [number, number][], fill: string) => `<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${fill}" stroke="${p.bg}" stroke-width="1.5" stroke-linejoin="round"/>`;
    parts.push(
      poly([[cx - A, yc], [cx, yc + B], [cx, yc + B + T], [cx - A, yc + T]], shade(base, -0.32)),
      poly([[cx, yc + B], [cx + A, yc], [cx + A, yc + T], [cx, yc + B + T]], shade(base, -0.16)),
      poly([[cx, yc - B], [cx + A, yc], [cx, yc + B], [cx - A, yc]], base),
    );
    // Items: numbered tiles along the slab's long axis, in the front half so the slab above does not cover them.
    const m = layer.items.length;
    layer.items.forEach((_, k) => {
      const x = cx + (k - (m - 1) / 2) * 46;
      const y = yc + 8;
      parts.push(
        poly([[x, y - 9], [x + 17, y], [x, y + 9], [x - 17, y]], "#ffffff"),
        `<text x="${x}" y="${y + 4}" text-anchor="middle" font-family="${esc(p.font)}" font-size="11" font-weight="700" fill="#0a0d14">${k + 1}</text>`,
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
    const lines = wrap(layer.items.map((it, k) => `${k + 1} ${it}`).join("  \u00b7  "), 56, 2);
    lines.forEach((l, k) => parts.push(text(lx, yc + 14 + k * 15, l, { size: 12 })));
  });
  if (spec.note) parts.push(text(24, H - 14, spec.note, { size: 11 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(spec.title || "Architecture option")}">${parts.join("")}</svg>`;
}
