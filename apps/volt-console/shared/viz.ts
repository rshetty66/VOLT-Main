/**
 * Data charts the agents write as a fenced ```chart block holding JSON. Unlike a Mermaid diagram (which needs a
 * browser to draw), a chart is plain data: the console draws it, and every download embeds it as a picture.
 *
 *   {"type":"bar","title":"Close days by entity","unit":"days","labels":["EMEA","APAC"],
 *    "series":[{"name":"Today","values":[12,9]},{"name":"Target","values":[5,5]}],"source":"Client data [S01]"}
 */
export type ChartKind = "bar" | "hbar" | "line" | "donut";

export interface ChartSpec {
  type: ChartKind;
  title: string;
  unit?: string;
  labels: string[];
  series: { name: string; values: number[] }[];
  source?: string;
}

const KINDS: ChartKind[] = ["bar", "hbar", "line", "donut"];

/** A valid spec, or null. Strict on purpose: a half-written block while an answer streams is simply not a chart yet. */
export function parseChartSpec(json: string): ChartSpec | null {
  let o: unknown;
  try {
    o = JSON.parse(json);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  const type = KINDS.find((k) => k === r.type);
  const labels = Array.isArray(r.labels) ? r.labels.map(String) : [];
  const series = Array.isArray(r.series)
    ? r.series.map((s) => {
        const x = (s ?? {}) as Record<string, unknown>;
        return { name: String(x.name ?? ""), values: Array.isArray(x.values) ? x.values.map(Number) : [] };
      })
    : [];
  if (!type || labels.length < 2 || labels.length > 12 || series.length < 1 || series.length > 3) return null;
  if (series.some((s) => s.values.length !== labels.length || s.values.some((v) => !Number.isFinite(v)))) return null;
  if (type === "donut" && series[0].values.some((v) => v < 0)) return null;
  return {
    type,
    title: String(r.title ?? "").slice(0, 120),
    unit: typeof r.unit === "string" ? r.unit.slice(0, 20) : undefined,
    labels: labels.map((l) => l.slice(0, 40)),
    series: series.map((s) => ({ ...s, name: s.name.slice(0, 40) })),
    source: typeof r.source === "string" ? r.source.slice(0, 160) : undefined,
  };
}

/** The ```chart blocks of a markdown text in document order; null where a block is not a valid spec. The server numbers them the same way. */
export function chartBlocks(markdown: string): (ChartSpec | null)[] {
  return [...markdown.matchAll(/^```chart[^\n]*\n([\s\S]*?)^```/gm)].map((m) => parseChartSpec(m[1]));
}

/** Fenced visuals (charts and Mermaid diagrams) in a text: how many pictures the deliverable carries. */
export const countVisuals = (markdown: string): number => (markdown.match(/^```(chart|mermaid|architecture)\b/gm) ?? []).length;

// ── Architecture options, drawn as a 3D (isometric) layered stack ──────────────────────────────────────────

/**
 * An architecture option as data: a fenced ```architecture block holding JSON. Layers are listed from the foundation
 * (sources) up to the consumption layer (reporting); each is drawn as a slab of the stack. Each system is a numbered tile
 * on its slab, coloured by what happens to it (new, kept or retired), and "flows" are the integrations between systems.
 *
 *   {"title":"Option B: Consolidation platform","layers":[
 *      {"name":"Sources","items":[{"name":"SAP ECC","status":"retire"},"Oracle EBS"]},
 *      {"name":"Consolidation","items":[{"name":"OneStream","status":"new"}],"badge":"Recommended"}],
 *    "flows":[{"from":"SAP ECC","to":"OneStream","label":"journals"}],"note":"Illustrative"}
 */
export type ArchStatus = "new" | "keep" | "retire";

export interface ArchItem {
  name: string;
  status: ArchStatus;
}

export interface ArchLayer {
  name: string;
  items: ArchItem[];
  badge?: string;
}

export interface ArchFlow {
  from: string;
  to: string;
  label?: string;
}

export interface ArchSpec {
  title: string;
  layers: ArchLayer[];
  flows: ArchFlow[];
  note?: string;
}

const STATUSES: ArchStatus[] = ["new", "keep", "retire"];

/** A valid option, or null. A flow that names a system not in the stack is dropped, not an error. */
export function parseArchSpec(json: string): ArchSpec | null {
  let o: unknown;
  try {
    o = JSON.parse(json);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const r = o as Record<string, unknown>;
  if (!Array.isArray(r.layers) || r.layers.length < 2 || r.layers.length > 7) return null;
  const layers: ArchLayer[] = [];
  for (const l of r.layers) {
    const x = (l ?? {}) as Record<string, unknown>;
    const name = typeof x.name === "string" ? x.name.trim() : "";
    const raw = Array.isArray(x.items) ? x.items : [];
    const items: ArchItem[] = raw
      .map((i): ArchItem => {
        if (i && typeof i === "object") {
          const it = i as Record<string, unknown>;
          return { name: String(it.name ?? "").trim().slice(0, 36), status: STATUSES.find((st) => st === it.status) ?? "keep" };
        }
        return { name: String(i).trim().slice(0, 36), status: "keep" };
      })
      .filter((i) => i.name);
    if (!name || items.length < 1 || items.length > 4) return null;
    layers.push({ name: name.slice(0, 40), items, badge: typeof x.badge === "string" && x.badge.trim() ? x.badge.trim().slice(0, 16) : undefined });
  }
  const known = new Set(layers.flatMap((l) => l.items.map((i) => i.name.toLowerCase())));
  const flows: ArchFlow[] = (Array.isArray(r.flows) ? r.flows : [])
    .map((f) => {
      const x = (f ?? {}) as Record<string, unknown>;
      return { from: String(x.from ?? "").trim(), to: String(x.to ?? "").trim(), label: typeof x.label === "string" && x.label.trim() ? x.label.trim().slice(0, 24) : undefined };
    })
    .filter((f) => known.has(f.from.toLowerCase()) && known.has(f.to.toLowerCase()) && f.from.toLowerCase() !== f.to.toLowerCase())
    .slice(0, 10);
  return { title: String(r.title ?? "").slice(0, 120), layers, flows, note: typeof r.note === "string" ? r.note.slice(0, 160) : undefined };
}

/** The ```architecture blocks of a markdown text in document order; null where a block is not a valid spec. */
export function archBlocks(markdown: string): (ArchSpec | null)[] {
  return [...markdown.matchAll(/^```architecture[^\n]*\n([\s\S]*?)^```/gm)].map((m) => parseArchSpec(m[1]));
}
