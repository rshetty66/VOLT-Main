import type { ProcessSpec } from "../../shared/viz";
import type { Palette } from "./palette";

/**
 * SVG for a process flow: lanes as rows, stages as columns, each step a card with its system and a status tag, and
 * the hand-offs as curved arrows. Every step and link carries data attributes, so the HTML deliverable can make the
 * same drawing interactive (select a step, play the walkthrough) without redrawing it.
 */
const LANE_W = 150;
const HEAD = 34;
const BOX_H = 60;
const GAP = 14;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n1 = (v: number) => +v.toFixed(1);

/** Split a step name over at most two lines of about `max` characters. */
function wrap(s: string, max: number): string[] {
  if (s.length <= max) return [s];
  const words = s.split(/\s+/);
  let a = "";
  let i = 0;
  while (i < words.length && (a + (a ? " " : "") + words[i]).length <= max) a += (a ? " " : "") + words[i++];
  if (!a) return [s.slice(0, max - 3) + "...", ""].filter(Boolean);
  const b = words.slice(i).join(" ");
  return [a, b.length > max ? b.slice(0, max - 3) + "..." : b];
}

const STATUS_LABEL = { manual: "Manual", automated: "Automated", new: "New" } as const;

export function processSvg(spec: ProcessSpec, p: Palette): string {
  const parts: string[] = [];
  const text = (x: number, y: number, s: string, f: { size?: number; anchor?: string; fill?: string; weight?: number } = {}) =>
    `<text x="${n1(x)}" y="${n1(y)}" font-family="${esc(p.font)}" font-size="${f.size ?? 12}" fill="${f.fill ?? p.muted}" text-anchor="${f.anchor ?? "start"}"${f.weight ? ` font-weight="${f.weight}"` : ""}>${esc(s)}</text>`;
  const cols = spec.stages.length;
  // At least 150 px a stage, so a card holds its name; the page scales the drawing down to fit.
  const W = Math.max(1000, LANE_W + 24 + cols * 150);
  const colW = (W - LANE_W - 24) / cols;
  const boxW = Math.min(180, colW - 16);

  // Steps sharing a lane and a stage stack in that cell.
  const slot = spec.steps.map((s, i) => spec.steps.slice(0, i).filter((o) => o.lane === s.lane && o.stage === s.stage).length);
  const rows = spec.lanes.map((_, l) => Math.max(1, ...spec.steps.filter((s) => s.lane === l).map((s, _i, arr) => arr.filter((o) => o.stage === s.stage).length)));
  let y = 32;
  if (spec.title) parts.push(text(24, y, spec.title, { size: 17, fill: p.ink, weight: 650 }));
  if (spec.note) parts.push(text(24, (y += 20), spec.note, { size: 12.5, fill: p.series }));
  const top = y + 18;
  const laneTop: number[] = [];
  let ly = top + HEAD;
  for (const r of rows) {
    laneTop.push(ly);
    ly += r * (BOX_H + GAP) + GAP;
  }
  const H = ly + (spec.source ? 34 : 16);

  // Stage headers and lane bands.
  spec.stages.forEach((st, c) => parts.push(text(LANE_W + 12 + colW * (c + 0.5), top + 21, st, { size: 12, anchor: "middle", fill: p.ink, weight: 600 })));
  spec.lanes.forEach((lane, l) => {
    const h = rows[l] * (BOX_H + GAP) + GAP;
    parts.push(`<rect x="12" y="${n1(laneTop[l])}" width="${W - 24}" height="${n1(h)}" rx="8" fill="${l % 2 ? p.bg : p.tile}" stroke="${p.grid}"/>`);
    const words = wrap(lane, 18);
    words.forEach((w, i) => parts.push(text(26, laneTop[l] + h / 2 + 4 + (i - (words.length - 1) / 2) * 15, w, { size: 12.5, fill: p.ink, weight: 600 })));
  });

  const box = spec.steps.map((s, i) => ({ x: LANE_W + 12 + colW * s.stage + (colW - boxW) / 2, y: laneTop[s.lane] + GAP + slot[i] * (BOX_H + GAP) }));

  // Hand-offs, drawn under the cards.
  const mk = `vpa${spec.steps.length}${spec.links.length}${p.bg.replace(/\W/g, "")}`;
  parts.push(`<defs><marker id="${mk}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10Z" fill="${p.muted}"/></marker></defs>`);
  spec.links.forEach((l, i) => {
    const a = box[l.from], b = box[l.to];
    const forward = b.x > a.x + 1, back = b.x < a.x - 1;
    let d: string, mx: number, my: number;
    if (forward || back) {
      const x1 = forward ? a.x + boxW : a.x, x2 = forward ? b.x : b.x + boxW, y1 = a.y + BOX_H / 2, y2 = b.y + BOX_H / 2, dx = Math.max(24, Math.abs(x2 - x1) / 2) * (forward ? 1 : -1);
      d = `M${n1(x1)},${n1(y1)} C${n1(x1 + dx)},${n1(y1)} ${n1(x2 - dx)},${n1(y2)} ${n1(x2)},${n1(y2)}`;
      mx = (x1 + x2) / 2;
      my = (y1 + y2) / 2;
    } else {
      const down = b.y > a.y, x = a.x + boxW / 2, y1 = down ? a.y + BOX_H : a.y, y2 = down ? b.y : b.y + BOX_H;
      d = `M${n1(x)},${n1(y1)} L${n1(x)},${n1(y2)}`;
      mx = x + 6;
      my = (y1 + y2) / 2;
    }
    parts.push(`<g class="vp-link" data-link="${i}" data-from="${l.from}" data-to="${l.to}"><path d="${d}" fill="none" stroke="${p.muted}" stroke-width="1.6" marker-end="url(#${mk})"/>${l.label ? `<text x="${n1(mx)}" y="${n1(my - 5)}" font-family="${esc(p.font)}" font-size="10.5" fill="${p.ink}" text-anchor="middle" paint-order="stroke" stroke="${p.bg}" stroke-width="3">${esc(l.label)}</text>` : ""}</g>`);
  });

  // Step cards.
  spec.steps.forEach((s, i) => {
    const { x, y: by } = box[i];
    const fill = s.status === "automated" ? p.series : s.status === "new" ? p.series2 : p.tile;
    const tint = s.status === "automated" || s.status === "new" ? 0.16 : 1;
    const stroke = s.issue ? p.negative : s.status === "new" ? p.series2 : s.status === "automated" ? p.series : p.grid;
    const tip = [s.name, spec.lanes[s.lane], spec.stages[s.stage], s.system, s.control && `Control: ${s.control}`, s.issue && `Issue: ${s.issue}`].filter(Boolean).join(" | ");
    const lines = wrap(s.name, Math.floor((boxW - 34) / 6.4));
    const tag = s.status ? STATUS_LABEL[s.status] : "";
    const sysMax = Math.floor((boxW - 22 - (tag ? tag.length * 6 + 8 : 0)) / 5.8);
    parts.push(
      `<g class="vp-step" data-step="${i}" tabindex="0" role="button" aria-label="${esc(tip)}"><title>${esc(tip)}</title>`,
      `<rect x="${n1(x)}" y="${n1(by)}" width="${n1(boxW)}" height="${BOX_H}" rx="8" fill="${p.bg}"/><rect class="vp-card" x="${n1(x)}" y="${n1(by)}" width="${n1(boxW)}" height="${BOX_H}" rx="8" fill="${fill}" fill-opacity="${tint}" stroke="${stroke}" stroke-width="${s.issue ? 2 : 1.2}"/>`,
      text(x + 10, by + 17, `${i + 1}`, { size: 10.5, fill: p.muted, weight: 700 }),
      ...lines.map((ln, k) => text(x + 24, by + 17 + k * 14, ln, { size: 11.5, fill: p.ink, weight: 600 })),
      s.system ? text(x + 10, by + BOX_H - 10, s.system.length > sysMax ? s.system.slice(0, Math.max(1, sysMax - 3)) + "..." : s.system, { size: 10.5 }) : "",
      tag ? text(x + boxW - 8, by + BOX_H - 10, tag, { size: 10, anchor: "end", fill: p.ink, weight: 600 }) : "",
      s.issue ? `<circle cx="${n1(x + boxW - 2)}" cy="${n1(by + 2)}" r="8" fill="${p.negative}"/>` + text(x + boxW - 2, by + 6, "!", { size: 11, anchor: "middle", fill: "#ffffff", weight: 800 }) : "",
      "</g>",
    );
  });

  if (spec.source) parts.push(text(24, H - 12, `Source: ${spec.source}`, { size: 11 }));
  return `<svg xmlns="http://www.w3.org/2000/svg" class="vp" viewBox="0 0 ${W} ${n1(H)}" width="${W}" height="${n1(H)}" role="img" aria-label="${esc(spec.title || "Process flow")}"><rect width="${W}" height="${n1(H)}" fill="${p.bg}" rx="10"/>${parts.join("")}</svg>`;
}
