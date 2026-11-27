import type { ProcessSpec } from "../../shared/viz";
import type { Palette } from "./palette";
import { textWidth, wrapLabel } from "./specChart";

/**
 * SVG for a process flow: lanes as rows, stages as columns, each step a card with its system and a status tag, and
 * the hand-offs as curved arrows. Every step and link carries data attributes, so the HTML deliverable can make the
 * same drawing interactive (select a step, play the walkthrough) without redrawing it.
 */
const LANE_W = 124;
/** The width every flow is drawn for: a page or a slide. Wider flows are scaled down on screen, never scrolled. */
const FIT_W = 1160;
const NAME = 11;
const LINE = 13.5;
const HEAD = 34;
const GAP = 8;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n1 = (v: number) => +v.toFixed(1);

const STATUS_LABEL = { manual: "Manual", automated: "Automated", new: "New" } as const;

export function processSvg(spec: ProcessSpec, p: Palette): string {
  const parts: string[] = [];
  const text = (x: number, y: number, s: string, f: { size?: number; anchor?: string; fill?: string; weight?: number } = {}) =>
    `<text x="${n1(x)}" y="${n1(y)}" font-family="${esc(p.font)}" font-size="${f.size ?? 12}" fill="${f.fill ?? p.muted}" text-anchor="${f.anchor ?? "start"}"${f.weight ? ` font-weight="${f.weight}"` : ""}>${esc(s)}</text>`;
  const cols = spec.stages.length;
  // Steps sharing a lane and a stage: their order in that cell, and how many share it.
  const slot = spec.steps.map((s, i) => spec.steps.slice(0, i).filter((o) => o.lane === s.lane && o.stage === s.stage).length);
  const share = spec.steps.map((s) => spec.steps.filter((o) => o.lane === s.lane && o.stage === s.stage).length);
  // A stage is as many units wide as the most steps any lane puts in it.
  const units = spec.stages.map((_, c) => Math.max(1, ...spec.steps.map((s, i) => (s.stage === c ? share[i] : 1))));
  const total = units.reduce((x, y) => x + y, 0);
  // Fit the page width (FIT_W): a unit of 96 to 220 px, so a two-stage flow does not stretch its cards and a long one
  // stays readable when the screen scales it down.
  const unit = Math.max(96, Math.min(220, (FIT_W - LANE_W - 24) / total));
  const W = LANE_W + 24 + total * unit;
  const colX = units.map((_, c) => LANE_W + 12 + units.slice(0, c).reduce((x, y) => x + y, 0) * unit);
  const boxW = (i: number) => (units[spec.steps[i].stage] * unit - 12 - (share[i] - 1) * 8) / share[i];
  // Names start after the step number, a little further in once numbers have two digits.
  const NX = spec.steps.length > 9 ? 27 : 22;
  const names = spec.steps.map((s, i) => fitLines(s.name, boxW(i) - NX - 8, NAME, 4));
  // A step citing the APQC PCF shows its hierarchy ID on a line of its own, so every card makes room for it.
  const pcfLine = spec.steps.some((s) => s.pcf) ? 15 : 0;
  const BOX_H = 30 + Math.max(2, ...names.map((l) => l.length)) * LINE + pcfLine;

  let y = 32;
  if (spec.title) parts.push(text(24, y, spec.title, { size: 14, fill: p.ink, weight: 650 }));
  if (spec.note) parts.push(text(24, (y += 18), spec.note, { size: 11, fill: p.series }));
  const top = y + 18;
  const laneH = BOX_H + 2 * GAP;
  const laneTop = spec.lanes.map((_, l) => top + HEAD + l * (laneH + 4));
  const H = top + HEAD + spec.lanes.length * (laneH + 4) + (spec.source ? 28 : 10);

  // Stage headers and lane bands.
  spec.stages.forEach((st, c) => parts.push(text(colX[c] + (units[c] * unit) / 2, top + 21, st, { size: 11, anchor: "middle", fill: p.ink, weight: 700 })));
  spec.lanes.forEach((lane, l) => {
    const h = laneH;
    parts.push(`<rect x="12" y="${n1(laneTop[l])}" width="${W - 24}" height="${n1(h)}" rx="8" fill="${l % 2 ? p.bg : p.tile}" stroke="${p.grid}"/>`);
    const words = fitLines(lane, LANE_W - 20, NAME, 3);
    parts.push(`<g class="vp-lane" data-lane="${l}">`, ...words.map((w, i) => text(24, laneTop[l] + h / 2 + 4 + (i - (words.length - 1) / 2) * LINE, w, { size: NAME, fill: p.ink, weight: 600 })), "</g>");
  });

  const box = spec.steps.map((s, i) => ({ x: colX[s.stage] + 6 + slot[i] * (boxW(i) + 8), y: laneTop[s.lane] + GAP, w: boxW(i) }));

  // Hand-offs, drawn under the cards.
  const mk = `vpa${spec.steps.length}${spec.links.length}${p.bg.replace(/\W/g, "")}`;
  parts.push(`<defs><marker id="${mk}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10Z" fill="${p.muted}"/></marker></defs>`);
  const placed: { x0: number; x1: number; y: number }[] = [];
  spec.links.forEach((l, i) => {
    const a = box[l.from], b = box[l.to];
    const forward = b.x > a.x + a.w - 1, back = b.x + b.w < a.x + 1;
    let d: string, mx: number, my: number;
    if (forward || back) {
      const x1 = forward ? a.x + a.w : a.x, x2 = forward ? b.x : b.x + b.w, y1 = a.y + BOX_H / 2, y2 = b.y + BOX_H / 2, dx = Math.max(24, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1);
      d = `M${n1(x1)},${n1(y1)} C${n1(x1 + dx)},${n1(y1)} ${n1(x2 - dx)},${n1(y2)} ${n1(x2)},${n1(y2)}`;
      mx = (x1 + x2) / 2;
      my = (y1 + y2) / 2;
    } else {
      const down = b.y > a.y, x = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2, y1 = down ? a.y + BOX_H : a.y, y2 = down ? b.y : b.y + BOX_H;
      d = `M${n1(x)},${n1(y1)} L${n1(x)},${n1(y2)}`;
      mx = x + 6;
      my = (y1 + y2) / 2;
    }
    // A label is drawn only on a straight hand-off between neighbouring cards with room for it, so none sits on a card
    // or on another label. Every hand-off label is in the walkthrough panel ("Receives", "Hands off").
    const gapX = forward ? b.x - (a.x + a.w) : back ? a.x - (b.x + b.w) : 0;
    const lo = Math.min(a.x + a.w, b.x + b.w), hi = Math.max(a.x, b.x), lw = l.label ? textWidth(l.label, 9.5) : 0;
    const blocked = box.some((o, k) => k !== l.from && k !== l.to && Math.abs(o.y - a.y) < 1 && o.x < hi && o.x + o.w > lo);
    const clash = placed.some((q) => Math.abs(q.y - my) < 14 && q.x0 < mx + lw / 2 && q.x1 > mx - lw / 2);
    const fits = !!l.label && (forward || back) && Math.abs(b.y - a.y) < 1 && !blocked && !clash && lw + 10 <= gapX;
    if (fits) placed.push({ x0: mx - lw / 2, x1: mx + lw / 2, y: my });
    parts.push(`<g class="vp-link" data-link="${i}" data-from="${l.from}" data-to="${l.to}"><path d="${d}" fill="none" stroke="${p.muted}" stroke-width="1.6" marker-end="url(#${mk})"/>${fits ? `<text class="vp-ll" x="${n1(mx)}" y="${n1(my - 5)}" font-family="${esc(p.font)}" font-size="9.5" fill="${p.ink}" text-anchor="middle" paint-order="stroke" stroke="${p.bg}" stroke-width="3">${esc(l.label!)}</text>` : ""}</g>`);
  });

  // Step cards.
  spec.steps.forEach((s, i) => {
    const { x, y: by, w: boxW } = box[i];
    const fill = s.status === "automated" ? p.series : s.status === "new" ? p.series2 : p.tile;
    const tint = s.status === "automated" || s.status === "new" ? 0.16 : 1;
    const stroke = s.issue ? p.negative : s.status === "new" ? p.series2 : s.status === "automated" ? p.series : p.grid;
    const tip = [s.name, spec.lanes[s.lane], spec.stages[s.stage], s.system, s.pcf && `APQC PCF ${s.pcf}`, s.control && `Control: ${s.control}`, s.issue && `Issue: ${s.issue}`].filter(Boolean).join(" | ");
    const pcfId = s.pcf?.match(/^\d+(?:\.\d+)*/)?.[0];
    const lines = names[i];
    const tag = s.status ? STATUS_LABEL[s.status] : "";
    // The system gets its own line under the name, the status tag the line below it.
    const tagW = tag ? textWidth(tag, 9.5) + 12 : 0;
    const system = s.system ? wrapLabel(s.system, boxW - 18 - tagW, 10, 1)[0] : "";
    parts.push(
      `<g class="vp-step" style="--vp-i:${s.stage}" data-step="${i}" data-lane="${s.lane}"${s.issue ? ' data-issue="1"' : ""} tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title>`,
      `<rect x="${n1(x)}" y="${n1(by)}" width="${n1(boxW)}" height="${BOX_H}" rx="8" fill="${p.bg}"/><rect class="vp-card" x="${n1(x)}" y="${n1(by)}" width="${n1(boxW)}" height="${BOX_H}" rx="8" fill="${fill}" fill-opacity="${tint}" stroke="${stroke}" stroke-width="${s.issue ? 2 : 1.2}"/>`,
      text(x + 8, by + 17, `${i + 1}`, { size: 9.5, fill: p.muted, weight: 700 }),
      ...lines.map((ln, k) => text(x + NX, by + 18 + k * LINE, ln, { size: NAME, fill: p.ink, weight: 600 })),
      pcfId ? text(x + NX, by + 18 + lines.length * LINE, `PCF ${pcfId}`, { size: 9.5, fill: p.series, weight: 700 }) : "",
      system && textWidth(system, 10) <= boxW - 18 - tagW ? text(x + 8, by + BOX_H - 8, system, { size: 10 }) : "",
      tag ? text(x + boxW - 8, by + BOX_H - 8, tag, { size: 9.5, anchor: "end", fill: p.ink, weight: 600 }) : "",
      s.issue ? `<circle cx="${n1(x + boxW - 2)}" cy="${n1(by + 2)}" r="8" fill="${p.negative}"/>` + text(x + boxW - 2, by + 6, "!", { size: 11, anchor: "middle", fill: "#ffffff", weight: 800 }) : "",
      "</g>",
    );
  });

  if (spec.source) parts.push(text(24, H - 12, `Source: ${spec.source}`, { size: 10 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" class="vp" viewBox="0 0 ${W} ${n1(H)}" width="${W}" height="${n1(H)}" role="img" aria-label="${esc(spec.title || "Process flow")}"><rect width="${W}" height="${n1(H)}" fill="${p.bg}" rx="10"/>${parts.join("")}</svg>`;
}

/**
 * A label over at most `lines` lines that each fit `maxW` at `size`: words wrap, and what does not fit ends in "...".
 * The card's tooltip and the walkthrough panel carry the full name.
 */
export function fitLines(s: string, maxW: number, size: number, lines: number): string[] {
  const out = wrapLabel(s, maxW, size, lines);
  return out.map((ln, k) => {
    if (textWidth(ln, size) <= maxW) return ln;
    let cut = ln;
    while (cut.length > 1 && textWidth(`${cut}...`, size) > maxW) cut = cut.slice(0, -1);
    return k === out.length - 1 || textWidth(ln, size) > maxW ? `${cut.trimEnd()}...` : ln;
  });
}
