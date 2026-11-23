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
export const countVisuals = (markdown: string): number => (markdown.match(/^```(chart|mermaid)\b/gm) ?? []).length;
