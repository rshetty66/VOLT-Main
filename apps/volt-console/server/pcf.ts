/**
 * APQC Process Classification Framework (PCF), Cross-Industry, as a lookup for the agents: by PCF ID (10730), by
 * hierarchy ID (9.3) or by plain words ("reconcile general ledger"). The data is server/knowledge/apqc-pcf.json, built
 * from APQC's Excel file by scripts/import-apqc-pcf.ts. APQC's licence allows copying and derivative works provided
 * every copy carries its notice, so each result carries it and the prompt asks for it wherever PCF elements are shown.
 */
import pcf from "./knowledge/apqc-pcf.json" with { type: "json" };

type ElementRow = [number, string, string, string, number];
type MetricRow = [number, string, number, string, string, string];

export interface PcfElement {
  pcfId: number;
  hierarchyId: string;
  name: string;
  description: string;
  metricsAvailable: boolean;
}

const SOURCE = pcf.source as { name: string; version: string; generated: string; notice: string };
const ELEMENTS: PcfElement[] = (pcf.elements as unknown as ElementRow[]).map(([pcfId, hierarchyId, name, description, m]) => ({ pcfId, hierarchyId, name, description, metricsAvailable: m === 1 }));
const METRICS = pcf.metrics as unknown as MetricRow[];

const byPcfId = new Map(ELEMENTS.map((e) => [e.pcfId, e]));
const byHierarchy = new Map(ELEMENTS.map((e) => [e.hierarchyId, e]));

/** "9.3.2.5" -> "9.3.2"; "9.3" -> "9.0"; a category ("9.0") has no parent. */
function parentId(h: string): string | null {
  const parts = h.split(".");
  if (parts.length === 2) return parts[1] === "0" ? null : `${parts[0]}.0`;
  return parts.slice(0, -1).join(".");
}

const children = new Map<string, PcfElement[]>();
for (const e of ELEMENTS) {
  const p = parentId(e.hierarchyId);
  if (p) children.set(p, [...(children.get(p) ?? []), e]);
}

/** How the deliverables cite an element: "9.3 Perform general accounting and reporting [10730]". */
export const cite = (e: PcfElement) => `${e.hierarchyId} ${e.name} [${e.pcfId}]`;

export const PCF_VERSION = SOURCE.version;
export const PCF_SOURCE_LINE = `Source: ${SOURCE.name} v${SOURCE.version}. ${SOURCE.notice}`;

/** The prompt rule for every agent that names processes. */
export const PCF_GUIDE =
  "When you name a business process (in a brief, process flow, close plan, operating model or KPI set), take it from the APQC PCF with apqc_pcf and cite it as hierarchy ID, name and PCF ID, for example '9.3.2.6 Reconcile general ledger accounts [10824]'. Never write a PCF ID the tool did not return. Where a deliverable lists PCF elements, add APQC's notice from the tool result as its source line.";

const STOP = new Set(["and", "the", "for", "with", "of", "to", "in", "a", "an", "on", "by", "or", "process", "processes", "manage", "management"]);
/** Light stemming so "reconciliation" meets "reconcile" and "closing" meets "close". */
const stem = (w: string) => w.replace(/(ations|ation|ings|ing|ions|ion|ies|es|ed|s|e)$/, "").slice(0, 6);
const terms = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);

const index = ELEMENTS.map((e) => ({ e, name: new Set(terms(e.name)), desc: new Set(terms(e.description)) }));

/** Element for a PCF ID ("10730") or hierarchy ID ("9.3", or "9" for the category), else null. */
export function findPcfElement(id: string): PcfElement | null {
  const q = id.trim().replace(/^\[|\]$/g, "");
  if (/^\d{5,6}$/.test(q)) return byPcfId.get(Number(q)) ?? null;
  if (/^\d{1,2}$/.test(q)) return byHierarchy.get(`${q}.0`) ?? null;
  if (/^\d{1,2}(\.\d+)+$/.test(q)) return byHierarchy.get(q) ?? null;
  return null;
}

/** Elements ranked by how many query words they share, name words counting three times description words. */
export function searchPcf(query: string, limit = 5, within?: string): PcfElement[] {
  const q = [...new Set(terms(query))];
  if (!q.length) return [];
  const scope = within ? findPcfElement(within) : null;
  const prefix = scope ? (scope.hierarchyId.endsWith(".0") ? `${scope.hierarchyId.split(".")[0]}.` : `${scope.hierarchyId}.`) : "";
  return index
    .filter(({ e }) => !scope || e === scope || e.hierarchyId.startsWith(prefix))
    .map(({ e, name, desc }) => {
      const hits = q.filter((t) => name.has(t) || desc.has(t)).length;
      const score = q.reduce((s, t) => s + (name.has(t) ? 3 : desc.has(t) ? 1 : 0), 0) + (hits === q.length ? 2 : 0);
      return { e, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.e.hierarchyId.split(".").length - b.e.hierarchyId.split(".").length)
    .slice(0, limit)
    .map((r) => r.e);
}

/** Parents from the category down, as citations. */
function lineage(e: PcfElement): string[] {
  const out: string[] = [];
  for (let p = parentId(e.hierarchyId); p; p = parentId(p)) {
    const pe = byHierarchy.get(p);
    if (pe) out.unshift(cite(pe));
  }
  return out;
}

/** One element in full: lineage, children and APQC's metric definitions (names and formulas, no benchmark values). */
export function pcfDetail(e: PcfElement, metricLimit = 10) {
  const metrics = METRICS.filter((m) => m[0] === e.pcfId);
  return {
    cite: cite(e),
    pcf_id: e.pcfId,
    hierarchy_id: e.hierarchyId,
    name: e.name,
    description: e.description,
    lineage: lineage(e),
    children: (children.get(e.hierarchyId) ?? []).map(cite),
    metrics: metrics.slice(0, metricLimit).map(([, category, metricId, name, formula, units]) => ({ metric_id: metricId, name, category, formula, units })),
    metrics_total: metrics.length,
  };
}

export function lookupPcf(input: { query: string; within?: string; limit?: number }) {
  const exact = findPcfElement(input.query);
  const source = { framework: `${SOURCE.name} v${SOURCE.version}`, notice: SOURCE.notice };
  if (exact) return { match: pcfDetail(exact), source };
  const hits = searchPcf(input.query, input.limit ?? 5, input.within);
  return {
    matches: hits.map((e) => ({ cite: cite(e), lineage: lineage(e).join(" > "), description: e.description.slice(0, 280), metrics_available: e.metricsAvailable })),
    hint: hits.length ? "Call again with a PCF ID for its children and APQC metric definitions." : "No PCF element matches; try other words or a hierarchy ID such as 9.3.",
    source,
  };
}
