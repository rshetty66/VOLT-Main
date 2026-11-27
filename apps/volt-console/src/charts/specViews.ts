import { taxonomyCounts, type Impact, type LifecycleSpec, type TaxonomySpec, type ViewSpec } from "../../shared/views";
import type { Palette } from "./palette";
import { textWidth, wrapLabel } from "./specChart";

/**
 * SVG for the two executive views in shared/views.ts, drawn for the same 1160 px width as the architecture stack and
 * the process flow, small type on the page background. Every text is wrapped, never cut.
 */
const W = 1160;
const X0 = 24;
const X1 = W - 24;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n1 = (v: number) => +v.toFixed(1);

/** Where the change lands: gold for high, a darker gold for moderate, the muted grey for limited. */
function impactColour(i: Impact, p: Palette): string {
  const light = p.bg.toLowerCase() === "#ffffff";
  return i === "high" ? (light ? "#b8921c" : "#ffb600") : i === "moderate" ? (light ? "#d8c58a" : "#8a6d1a") : p.grid;
}
const IMPACT_WORD: Record<Impact, string> = { high: "High", moderate: "Moderate", low: "Limited" };

function texter(p: Palette) {
  return (x: number, y: number, s: string, o: { size?: number; fill?: string; weight?: number; anchor?: string } = {}) =>
    `<text x="${n1(x)}" y="${n1(y)}" font-family="${esc(p.font)}" font-size="${o.size ?? 11}" fill="${o.fill ?? p.muted}"${o.weight ? ` font-weight="${o.weight}"` : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""}>${esc(s)}</text>`;
}

const svgWrap = (h: number, label: string, body: string, p: Palette, cls: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="${cls}" viewBox="0 0 ${W} ${n1(h)}" width="${W}" height="${n1(h)}" role="img" aria-label="${esc(label)}"><rect width="${W}" height="${n1(h)}" fill="${p.bg}" rx="10"/>${body}</svg>`;

/** The process taxonomy: the L1 cycle as a bar, an L2 column each, L3 processes as cards, L4 activities as lines. */
export function taxonomySvg(t: TaxonomySpec, p: Palette): string {
  const text = texter(p);
  const accent = p.series;
  const parts: string[] = [];
  let y = 22;
  parts.push(text(X0, y + 12, t.title, { size: 15, fill: p.ink, weight: 650 }));
  y += 26;
  if (t.note) {
    parts.push(text(X0, y + 10, t.note, { size: 11.5, fill: accent }));
    y += 20;
  }
  // L1 bar.
  parts.push(`<rect x="${X0}" y="${y}" width="${X1 - X0}" height="26" rx="4" fill="${p.series2}"/>`);
  parts.push(text(X0 + 12, y + 17, `L1  ${t.l1}`, { size: 12.5, fill: p.bg, weight: 750 }));
  if (t.pcf) parts.push(text(X1 - 12, y + 17, `PCF ${t.pcf}`, { size: 10.5, fill: p.bg, weight: 600, anchor: "end" }));
  y += 36;
  const n = t.groups.length;
  const gap = 10;
  const colW = (X1 - X0 - (n - 1) * gap) / n;
  const inner = colW - 16;
  let bottom = y;
  t.groups.forEach((g, gi) => {
    const x = X0 + gi * (colW + gap);
    const gName = wrapLabel(g.name, inner, 12, 3);
    const headH = 14 + gName.length * 14 + (g.pcf ? 13 : 0);
    const col: string[] = [];
    col.push(`<rect x="${n1(x)}" y="${y}" width="${n1(colW)}" height="${headH}" rx="4" fill="${p.tile}" stroke="${p.grid}"/>`, `<rect x="${n1(x)}" y="${y + headH - 2}" width="${n1(colW)}" height="2" fill="${accent}"/>`);
    gName.forEach((l, k) => col.push(text(x + 8, y + 17 + k * 14, l, { size: 12, fill: p.ink, weight: 700 })));
    if (g.pcf) col.push(text(x + 8, y + 17 + gName.length * 14, `L2  PCF ${g.pcf}`, { size: 9.5 }));
    let cy = y + headH + 8;
    g.processes.forEach((pr) => {
      const name = wrapLabel(pr.name, inner - 6, 11.5, 3);
      const acts = pr.activities.map((a) => ({ a, lines: wrapLabel(a.name, inner - 16, 10.5, 3) }));
      const high = pr.activities.filter((a) => a.impact === "high").length;
      const h = 10 + name.length * 13.5 + (pr.pcf ? 12 : 0) + acts.reduce((s, x) => s + x.lines.length * 12.5 + 4, 0) + 6;
      col.push(`<rect x="${n1(x)}" y="${n1(cy)}" width="${n1(colW)}" height="${n1(h)}" rx="4" fill="none" stroke="${p.grid}"/>`);
      if (high) col.push(`<rect x="${n1(x)}" y="${n1(cy)}" width="3" height="${n1(h)}" rx="1.5" fill="${impactColour("high", p)}"/>`);
      name.forEach((l, k) => col.push(text(x + 9, cy + 15 + k * 13.5, l, { size: 11.5, fill: p.ink, weight: 650 })));
      let ay = cy + 10 + name.length * 13.5;
      if (pr.pcf) {
        col.push(text(x + 9, ay + 9, `L3  PCF ${pr.pcf}`, { size: 9.5 }));
        ay += 12;
      }
      acts.forEach(({ a, lines }) => {
        col.push(`<circle cx="${n1(x + 13)}" cy="${n1(ay + 8)}" r="3.2" fill="${impactColour(a.impact, p)}"${a.impact === "low" ? ` stroke="${p.muted}" stroke-width="0.8"` : ""}><title>${esc(`${a.name}: ${IMPACT_WORD[a.impact]} impact`)}</title></circle>`);
        lines.forEach((l, k) => col.push(text(x + 21, ay + 11.5 + k * 12.5, l, { size: 10.5, fill: a.impact === "high" ? p.ink : p.muted })));
        ay += lines.length * 12.5 + 4;
      });
      cy += h + 6;
    });
    bottom = Math.max(bottom, cy);
    parts.push(`<g class="vt-col" style="--vp-i:${gi}">${col.join("")}</g>`);
  });
  // Legend with the counts, computed from the data.
  const c = taxonomyCounts(t);
  let ly = bottom + 16;
  let lx = X0;
  for (const i of ["high", "moderate", "low"] as Impact[]) {
    parts.push(`<circle cx="${lx + 4}" cy="${ly - 4}" r="4" fill="${impactColour(i, p)}"${i === "low" ? ` stroke="${p.muted}" stroke-width="0.8"` : ""}/>`, text(lx + 13, ly, `${IMPACT_WORD[i]} change`, { size: 11, fill: p.ink }));
    lx += 13 + textWidth(`${IMPACT_WORD[i]} change`, 11) + 18;
  }
  const pct = c.l4 ? Math.round(((c.high + c.moderate) / c.l4) * 100) : 0;
  parts.push(text(lx + 8, ly, `1 L1 · ${c.l2} L2 · ${c.l3} L3 · ${c.l4} L4 activities · ${c.high} high, ${c.moderate} moderate (${pct}% change)`, { size: 11 }));
  if (t.source) {
    ly += 17;
    parts.push(text(X0, ly, `Source: ${t.source}`, { size: 10.5 }));
  }
  return svgWrap(ly + 14, t.title, parts.join(""), p, "vt");
}

/** The product lifecycle: stages as chevrons, then rows for the finance touchpoints, today and what changes. */
export function lifecycleSvg(l: LifecycleSpec, p: Palette): string {
  const text = texter(p);
  const parts: string[] = [];
  let y = 22;
  parts.push(text(X0, y + 12, l.title, { size: 15, fill: p.ink, weight: 650 }));
  y += 26;
  if (l.note) {
    parts.push(text(X0, y + 10, l.note, { size: 11.5, fill: p.series }));
    y += 20;
  }
  const LABEL = 150;
  const n = l.stages.length;
  const colW = (X1 - X0 - LABEL) / n;
  const inner = colW - 18;
  // Chevrons.
  const CH = 40;
  l.stages.forEach((s, i) => {
    const x = X0 + LABEL + i * colW;
    const tip = 12;
    const fill = s.impact === "high" ? impactColour("high", p) : s.impact === "moderate" ? impactColour("moderate", p) : p.tile;
    const ink = s.impact === "high" ? p.bg : p.ink;
    const pts = [[x, y], [x + colW - 4, y], [x + colW - 4 + tip, y + CH / 2], [x + colW - 4, y + CH], [x, y + CH], [x + (i ? tip : 0), y + CH / 2]].map(([a, b]) => `${n1(a)},${n1(b)}`).join(" ");
    const name = wrapLabel(s.name, colW - 30, 12, 2);
    parts.push(`<g class="vl-stage" style="--vp-i:${i}"><polygon points="${pts}" fill="${fill}" stroke="${p.grid}"/>${name.map((t, k) => text(x + colW / 2, y + CH / 2 + 4 + (k - (name.length - 1) / 2) * 13, t, { size: 12, fill: ink, weight: 700, anchor: "middle" })).join("")}<title>${esc(`${s.name}: ${IMPACT_WORD[s.impact]} change`)}</title></g>`);
  });
  parts.push(text(X0, y + CH / 2 + 4, l.product, { size: 12, fill: p.ink, weight: 700 }));
  y += CH + 10;
  // Rows: label on the left, one cell per stage.
  const rows: { label: string; cells: string[][]; ink: string }[] = [
    { label: "Finance touchpoints", cells: l.stages.map((s) => s.finance.flatMap((f) => wrapLabel(`· ${f}`, inner, 10.5, 3))), ink: p.ink },
    { label: "Today", cells: l.stages.map((s) => (s.today ? wrapLabel(s.today, inner, 10.5, 5) : [])), ink: p.negInk },
    { label: "With the transformation", cells: l.stages.map((s) => wrapLabel(s.change, inner, 10.5, 5)), ink: p.series },
  ].filter((r) => r.cells.some((c) => c.length));
  rows.forEach((r) => {
    const h = Math.max(...r.cells.map((c) => c.length)) * 13 + 16;
    parts.push(`<rect x="${X0}" y="${n1(y)}" width="${X1 - X0}" height="${n1(h)}" rx="4" fill="${p.tile}" stroke="${p.grid}"/>`);
    wrapLabel(r.label, LABEL - 16, 11, 2).forEach((t, k) => parts.push(text(X0 + 10, y + 17 + k * 13, t, { size: 11, fill: r.ink, weight: 700 })));
    r.cells.forEach((c, i) => {
      const x = X0 + LABEL + i * colW + 8;
      if (i) parts.push(`<line x1="${n1(x - 8)}" y1="${n1(y + 6)}" x2="${n1(x - 8)}" y2="${n1(y + h - 6)}" stroke="${p.grid}"/>`);
      c.forEach((t, k) => parts.push(text(x, y + 17 + k * 13, t, { size: 10.5, fill: r.label === "Today" ? p.muted : p.ink })));
    });
    y += h + 6;
  });
  let ly = y + 12;
  let lx = X0;
  for (const i of ["high", "moderate", "low"] as Impact[]) {
    parts.push(`<rect x="${lx}" y="${ly - 9}" width="12" height="10" rx="2" fill="${i === "low" ? p.tile : impactColour(i, p)}" stroke="${p.grid}"/>`, text(lx + 17, ly, `${IMPACT_WORD[i]} change`, { size: 11, fill: p.ink }));
    lx += 17 + textWidth(`${IMPACT_WORD[i]} change`, 11) + 18;
  }
  if (l.source) {
    ly += 17;
    parts.push(text(X0, ly, `Source: ${l.source}`, { size: 10.5 }));
  }
  return svgWrap(ly + 14, l.title, parts.join(""), p, "vl");
}

export const viewSvg = (v: ViewSpec, p: Palette): string => (v.kind === "taxonomy" ? taxonomySvg(v.spec, p) : lifecycleSvg(v.spec, p));
