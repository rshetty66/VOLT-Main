import type { Diagram } from "./data";

const PAD = 12;
const TOP = 30;
const BOX_H = 40;
const GAP_Y = 10;

/**
 * Geometry for a column diagram: columns spread across the width, boxes centred vertically in each column, and
 * links as cubic curves from a box's right edge to the next box's left edge. When no links are given, each box
 * links to the box at the same index in the next column, or to its first recommended ("a") box.
 */
export function columnLayout(d: Diagram) {
  const n = d.cols.length;
  const colW = d.colW ?? 132;
  const w = d.w ?? 520;
  const gx = n > 1 ? (w - 2 * PAD - colW * n) / (n - 1) : 0;
  const rows = Math.max(...d.cols.map((c) => c.items.length));
  const h = TOP + rows * (BOX_H + GAP_Y) + PAD - GAP_Y + 6;
  const pos = d.cols.map((c, ci) => {
    const x = PAD + ci * (colW + gx);
    const offset = ((rows - c.items.length) * (BOX_H + GAP_Y)) / 2;
    return c.items.map((it, ii) => ({ ...it, x, y: TOP + offset + ii * (BOX_H + GAP_Y), w: colW, h: BOX_H }));
  });
  const links =
    d.links ??
    d.cols.slice(0, -1).flatMap((c, ci) => {
      const next = d.cols[ci + 1].items;
      const target = Math.max(0, next.findIndex((b) => b.k === "a"));
      return c.items.map((_, ii) => [ci, ii, ci + 1, next.length === c.items.length ? ii : target] as [number, number, number, number]);
    });
  return {
    w,
    h,
    titles: d.cols.map((c, ci) => ({ text: c.title, x: PAD + ci * (colW + gx), y: 18 })),
    boxes: pos.flat(),
    links: links.map(([a, ai, b, bi, dashed]) => {
      const from = pos[a][ai];
      const to = pos[b][bi];
      const x1 = from.x + from.w;
      const y1 = from.y + from.h / 2;
      const x2 = to.x - 3;
      const y2 = to.y + to.h / 2;
      const mx = (x1 + x2) / 2;
      return { from: [x1, y1], to: [x2, y2], dashed: dashed === "x", path: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}` };
    }),
  };
}
