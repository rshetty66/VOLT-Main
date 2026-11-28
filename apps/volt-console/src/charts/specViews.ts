import { taxonomyCounts, type FimSpec, type FimStatus, type Impact, type LifecycleSpec, type TaxonomySpec, type ViewSpec } from "../../shared/views";
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
  // KPI strip, computed from the data (never typed): the size of the taxonomy and how much of it changes.
  const kc = taxonomyCounts(t);
  const kpis: [string, string][] = [[String(kc.l2), "L2 process groups"], [String(kc.l3), "L3 processes"], [String(kc.l4), "L4 activities"], [String(kc.high), "High change"], [String(kc.moderate), "Moderate change"], [`${kc.l4 ? Math.round(((kc.high + kc.moderate) / kc.l4) * 100) : 0}%`, "Of activities change"]];
  const kw = (X1 - X0 - 5 * 8) / 6;
  kpis.forEach(([v, l], i) => {
    const kx = X0 + i * (kw + 8);
    parts.push(`<rect x="${n1(kx)}" y="${y}" width="${n1(kw)}" height="44" rx="3" fill="${p.tile}" stroke="${p.grid}"/>`, `<rect x="${n1(kx)}" y="${y}" width="${n1(kw)}" height="3" fill="${i === 3 ? impactColour("high", p) : accent}"/>`, text(kx + 10, y + 26, v, { size: 17, fill: p.ink, weight: 700 }), text(kx + 10 + textWidth(v, 17) + 6, y + 26, l, { size: 10.5 }));
  });
  y += 54;
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
      const c0 = col.length;
      col.push(`<rect x="${n1(x)}" y="${n1(cy)}" width="${n1(colW)}" height="${n1(h)}" rx="4" fill="none" stroke="${p.grid}"/>`);
      if (high) col.push(`<rect x="${n1(x)}" y="${n1(cy)}" width="3" height="${n1(h)}" rx="1.5" fill="${impactColour("high", p)}"/>`);
      name.forEach((l, k) => col.push(text(x + 9, cy + 15 + k * 13.5, l, { size: 11.5, fill: p.ink, weight: 650 })));
      let ay = cy + 10 + name.length * 13.5;
      if (pr.pcf) {
        col.push(text(x + 9, ay + 9, `L3  PCF ${pr.pcf}`, { size: 9.5 }));
        ay += 12;
      }
      acts.forEach(({ a, lines }) => {
        const a0 = col.length;
        col.push(`<circle cx="${n1(x + 13)}" cy="${n1(ay + 8)}" r="3.2" fill="${impactColour(a.impact, p)}"${a.impact === "low" ? ` stroke="${p.muted}" stroke-width="0.8"` : ""}><title>${esc(`${a.name}: ${IMPACT_WORD[a.impact]} impact`)}</title></circle>`);
        lines.forEach((l, k) => col.push(text(x + 21, ay + 11.5 + k * 12.5, l, { size: 10.5, fill: a.impact === "high" ? p.ink : p.muted })));
        col.splice(a0, col.length - a0, `<g class="vt-act" data-i="${a.impact}" data-t="${esc(a.name.toLowerCase())}">${col.slice(a0).join("")}</g>`);
        ay += lines.length * 12.5 + 4;
      });
      col.splice(c0, col.length - c0, `<g class="vt-proc" data-t="${esc(`${pr.name} ${pr.pcf ?? ""}`.toLowerCase())}">${col.slice(c0).join("")}</g>`);
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

const FIM_WORD: Record<FimStatus, string> = { ties: "Ties to instruments", break: "Break to explain", partly_traced: "Partly traced", gl_only: "GL only" };

/**
 * The finance information model: lineage left to right from source to report, a column per level, the GL balance in
 * focus marked, adjustments under the instrument and GL columns they apply at, and the keys carried end to end.
 */
export function fimSvg(f: FimSpec, p: Palette): string {
  const text = texter(p);
  const parts: string[] = [];
  let y = 22;
  parts.push(text(X0, y + 12, f.title, { size: 15, fill: p.ink, weight: 650 }));
  y += 26;
  if (f.note) {
    parts.push(text(X0, y + 10, f.note, { size: 11.5, fill: p.series }));
    y += 20;
  }
  if (f.balance) {
    const b = f.balance;
    const label = [`GL balance traced: ${b.account}`, b.value, b.status ? FIM_WORD[b.status] : ""].filter(Boolean).join("  |  ");
    const w = textWidth(label, 11.5) + 24;
    const ok = !b.status || b.status === "ties";
    parts.push(`<rect x="${X0}" y="${y}" width="${n1(w)}" height="24" rx="12" fill="none" stroke="${ok ? p.series : p.negInk}"/>`, text(X0 + 12, y + 16, label, { size: 11.5, fill: ok ? p.series : p.negInk, weight: 650 }));
    y += 36;
  }
  const n = f.chain.length;
  const ARROW = 28;
  const colW = (X1 - X0 - (n - 1) * ARROW) / n;
  const inner = colW - 20;
  const isGl = (l: string) => /\b(gl|general ledger|ledger|balance)\b/i.test(l);
  const isInst = (l: string) => /instrument|contract|position|policy|account level/i.test(l);
  const glCol = Math.max(0, f.chain.findIndex((c) => isGl(c.level)));
  const instFound = f.chain.findIndex((c) => isInst(c.level));
  const instCol = instFound >= 0 ? instFound : Math.min(1, n - 1);
  const HEAD = 30;
  let bottom = y;
  const colX = (i: number) => X0 + i * (colW + ARROW);
  f.chain.forEach((c, i) => {
    const x = colX(i);
    const hot = i === glCol && isGl(c.level);
    const g: string[] = [];
    g.push(`<rect x="${n1(x)}" y="${y}" width="${n1(colW)}" height="${HEAD}" rx="4" fill="${hot ? p.series2 : p.tile}" stroke="${hot ? p.series2 : p.grid}"/>`);
    g.push(text(x + 10, y + 19.5, wrapLabel(c.level, colW - 20, 12.5, 1)[0], { size: 12.5, fill: hot ? p.bg : p.ink, weight: 750 }));
    let cy = y + HEAD + 8;
    c.items.forEach((it) => {
      const lines = wrapLabel(it, inner, 11.5, 3);
      const h = 12 + lines.length * 14;
      g.push(`<rect x="${n1(x)}" y="${n1(cy)}" width="${n1(colW)}" height="${n1(h)}" rx="4" fill="none" stroke="${p.grid}"/>`);
      lines.forEach((l, k) => g.push(text(x + 10, cy + 17 + k * 14, l, { size: 11.5, fill: p.ink })));
      cy += h + 6;
    });
    bottom = Math.max(bottom, cy);
    parts.push(`<g class="vf-col" style="--vp-i:${i}">${g.join("")}</g>`);
    if (i < n - 1) {
      const ax = x + colW + 5, ay = y + HEAD / 2;
      parts.push(`<path d="M ${n1(ax)} ${n1(ay)} L ${n1(ax + ARROW - 12)} ${n1(ay)}" stroke="${p.ink}" stroke-width="1.6"/>`, `<polygon points="${n1(ax + ARROW - 8)},${n1(ay)} ${n1(ax + ARROW - 15)},${n1(ay - 4.5)} ${n1(ax + ARROW - 15)},${n1(ay + 4.5)}" fill="${p.ink}"/>`);
    }
  });
  // Adjustments, under the column they apply at.
  const adj = (level: "instrument" | "gl") => f.adjustments.filter((a) => a.level === level);
  let ay = bottom + 8;
  let adjBottom = ay;
  for (const [level, col, word] of [["instrument", instCol, "Instrument-level adjustments"], ["gl", glCol, "GL-level adjustments (top-side)"]] as const) {
    const list = adj(level);
    if (!list.length) continue;
    const x = colX(col);
    const w = Math.max(colW, Math.min(2 * colW + ARROW, 260));
    const ax = Math.min(x, X1 - w);
    let yy = ay;
    parts.push(`<path d="M ${n1(x + colW / 2)} ${n1(bottom - 4)} L ${n1(x + colW / 2)} ${n1(yy + 4)}" stroke="${impactColour("high", p)}" stroke-width="1.2" stroke-dasharray="3 3"/>`);
    parts.push(text(ax, yy + 14, word, { size: 10.5, fill: impactColour("high", p), weight: 700 }));
    yy += 20;
    list.forEach((a) => {
      const lines = wrapLabel(a.name, w - 24 - (a.value ? textWidth(a.value, 11) + 8 : 0), 11, 2);
      const h = 10 + lines.length * 13.5;
      parts.push(`<rect x="${n1(ax)}" y="${n1(yy)}" width="${n1(w)}" height="${n1(h)}" rx="4" fill="none" stroke="${impactColour("high", p)}" stroke-dasharray="4 3"/>`);
      lines.forEach((l, k) => parts.push(text(ax + 10, yy + 16 + k * 13.5, l, { size: 11, fill: p.ink })));
      if (a.value) parts.push(text(ax + w - 10, yy + 16, a.value, { size: 11, fill: p.ink, weight: 700, anchor: "end" }));
      yy += h + 5;
    });
    adjBottom = Math.max(adjBottom, yy);
  }
  y = Math.max(bottom, adjBottom) + 8;
  if (f.keys.length) {
    parts.push(`<rect x="${X0}" y="${n1(y)}" width="${X1 - X0}" height="30" rx="4" fill="${p.tile}" stroke="${p.grid}"/>`, text(X0 + 10, y + 19.5, "Keys carried end to end", { size: 11, fill: p.ink, weight: 700 }));
    let kx = X0 + 22 + textWidth("Keys carried end to end", 11) + 6;
    f.keys.forEach((k) => {
      const w = textWidth(k, 11) + 16;
      if (kx + w > X1 - 8) return;
      parts.push(`<rect x="${n1(kx)}" y="${n1(y + 6)}" width="${n1(w)}" height="18" rx="9" fill="none" stroke="${p.series}"/>`, text(kx + 8, y + 19, k, { size: 11, fill: p.series }));
      kx += w + 6;
    });
    y += 40;
  }
  if (f.change) {
    const lines = wrapLabel(`With the transformation: ${f.change}`, X1 - X0, 11.5, 2);
    lines.forEach((l, k) => parts.push(text(X0, y + 10 + k * 15, l, { size: 11.5, fill: p.series, weight: 600 })));
    y += 8 + lines.length * 15;
  }
  if (f.source) {
    y += 10;
    parts.push(text(X0, y, `Source: ${f.source}`, { size: 10.5 }));
  }
  return svgWrap(y + 14, f.title, parts.join(""), p, "vf");
}

export const viewSvg = (v: ViewSpec, p: Palette): string => (v.kind === "taxonomy" ? taxonomySvg(v.spec, p) : v.kind === "lifecycle" ? lifecycleSvg(v.spec, p) : fimSvg(v.spec, p));
