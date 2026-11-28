/**
 * Two executive views every finance transformation deliverable carries, beside the process flow and the reference
 * architectures (Rakesh, 2026-11-27). Each is a fenced block holding one JSON object:
 *
 * ```taxonomy: the process taxonomy, L1 cycle to L4 activity, with APQC PCF ids and where the change lands.
 *   {"title":"Record to report: where the 5-day close changes the work","l1":"Record to report","pcf":"9.0 Manage financial resources",
 *    "groups":[{"name":"Perform general accounting","pcf":"9.3","processes":[{"name":"Reconcile accounts","pcf":"9.3.2.6",
 *      "activities":[{"name":"Match intercompany balances","impact":"high"},"Review reconciliations"]}]}],
 *    "note":"...","source":"APQC PCF v8.0 [S02]"}
 *
 * ```lifecycle: a product's lifecycle and what the transformation changes at each stage for finance.
 *   {"title":"Residential mortgage: where finance changes","product":"Residential mortgage",
 *    "stages":[{"name":"Originate","finance":["Fees deferred (EIR)","IFRS 9 stage 1 ECL"],"today":"Fees booked by spreadsheet",
 *               "change":"Rules engine posts fees and ECL at booking","impact":"high"}],"note":"...","source":"..."}
 *
 * ```fim: the finance information model, lineage from source and instrument to GL balance and report, with
 * adjustments at instrument and GL level and the keys carried end to end.
 *   {"title":"Finance information model: every mortgage balance traces to its contracts","balance":{"account":
 *    "13900 Residential mortgages","value":"CAD 4.2bn","status":"ties"},"chain":[{"level":"Source","items":["Core banking"]},
 *    {"level":"Instrument","items":["Mortgage contract"]},{"level":"GL balance","items":["13900 Residential mortgages"]}],
 *    "adjustments":[{"level":"instrument","name":"EIR fee deferral","value":"-CAD 3.1M"}],"keys":["Entity","Product"],
 *    "change":"Lineage reaches the instrument at D+1","note":"...","source":"..."}
 */
export type Impact = "high" | "moderate" | "low";
const IMPACTS: Impact[] = ["high", "moderate", "low"];

export interface TaxActivity {
  name: string;
  impact: Impact;
}
export interface TaxProcess {
  name: string;
  pcf?: string;
  activities: TaxActivity[];
}
export interface TaxGroup {
  name: string;
  pcf?: string;
  processes: TaxProcess[];
}
export interface TaxonomySpec {
  title: string;
  l1: string;
  pcf?: string;
  groups: TaxGroup[];
  note?: string;
  source?: string;
}

export interface LifecycleStage {
  name: string;
  finance: string[];
  today?: string;
  change: string;
  impact: Impact;
}
export interface LifecycleSpec {
  title: string;
  product: string;
  stages: LifecycleStage[];
  note?: string;
  source?: string;
}

const str = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown) => (Array.isArray(v) ? v : []);
const impact = (v: unknown): Impact => IMPACTS.find((i) => i === v) ?? "low";
const json = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

/** A valid taxonomy, or null: two to six L2 groups, one to six L3 processes each, up to six L4 activities each, 60 in all. */
export function parseTaxonomySpec(text: string): TaxonomySpec | null {
  const r = obj(json(text));
  const l1 = str(r.l1, 60);
  const raw = arr(r.groups);
  if (!l1 || raw.length < 2 || raw.length > 6) return null;
  const groups: TaxGroup[] = [];
  for (const g of raw) {
    const x = obj(g);
    const name = str(x.name, 60);
    const procs = arr(x.processes);
    if (!name || procs.length < 1 || procs.length > 6) return null;
    const processes: TaxProcess[] = [];
    for (const p of procs) {
      const y = obj(p);
      const pn = str(y.name, 60);
      if (!pn) return null;
      const acts = arr(y.activities)
        .map((a): TaxActivity | null => (typeof a === "string" ? (a.trim() ? { name: a.trim().slice(0, 60), impact: "low" } : null) : str(obj(a).name, 60) ? { name: str(obj(a).name, 60)!, impact: impact(obj(a).impact) } : null))
        .filter((a): a is TaxActivity => !!a);
      if (acts.length > 6) return null;
      processes.push({ name: pn, pcf: str(y.pcf, 24), activities: acts });
    }
    groups.push({ name, pcf: str(x.pcf, 24), processes });
  }
  if (groups.flatMap((g) => g.processes.flatMap((p) => p.activities)).length > 60) return null;
  return { title: str(r.title, 140) ?? l1, l1, pcf: str(r.pcf, 60), groups, note: str(r.note, 160), source: str(r.source, 160) };
}

/** A valid lifecycle, or null: three to seven stages, each with what changes and up to three finance touchpoints. */
export function parseLifecycleSpec(text: string): LifecycleSpec | null {
  const r = obj(json(text));
  const product = str(r.product, 60);
  const raw = arr(r.stages);
  if (!product || raw.length < 3 || raw.length > 7) return null;
  const stages: LifecycleStage[] = [];
  for (const s of raw) {
    const x = obj(s);
    const name = str(x.name, 32);
    const change = str(x.change, 140);
    if (!name || !change) return null;
    stages.push({ name, change, today: str(x.today, 140), impact: impact(x.impact), finance: arr(x.finance).map((f) => str(f, 60)).filter((f): f is string => !!f).slice(0, 3) });
  }
  return { title: str(r.title, 140) ?? product, product, stages, note: str(r.note, 160), source: str(r.source, 160) };
}

export type FimStatus = "ties" | "break" | "partly_traced" | "gl_only";
export interface FimLevel {
  level: string;
  items: string[];
}
export interface FimAdjustment {
  level: "instrument" | "gl";
  name: string;
  value?: string;
}
export interface FimSpec {
  title: string;
  balance?: { account: string; value?: string; status?: FimStatus };
  chain: FimLevel[];
  adjustments: FimAdjustment[];
  keys: string[];
  change?: string;
  note?: string;
  source?: string;
}
const FIM_STATUS: FimStatus[] = ["ties", "break", "partly_traced", "gl_only"];

/** A valid information model, or null: three to six levels of one to four items, up to six adjustments and eight keys. */
export function parseFimSpec(text: string): FimSpec | null {
  const r = obj(json(text));
  const raw = arr(r.chain);
  if (raw.length < 3 || raw.length > 6) return null;
  const chain: FimLevel[] = [];
  for (const c of raw) {
    const x = obj(c);
    const level = str(x.level, 28);
    const items = arr(x.items).map((i) => str(i, 48)).filter((i): i is string => !!i);
    if (!level || items.length < 1 || items.length > 4) return null;
    chain.push({ level, items });
  }
  const b = obj(r.balance);
  const account = str(b.account, 60);
  const adjustments = arr(r.adjustments)
    .map((a): FimAdjustment | null => {
      const x = obj(a);
      const name = str(x.name, 48);
      return name ? { level: x.level === "gl" ? "gl" : "instrument", name, value: str(x.value, 20) } : null;
    })
    .filter((a): a is FimAdjustment => !!a)
    .slice(0, 6);
  return {
    title: str(r.title, 140) ?? "Finance information model",
    balance: account ? { account, value: str(b.value, 24), status: FIM_STATUS.find((s) => s === b.status) } : undefined,
    chain,
    adjustments,
    keys: arr(r.keys).map((k) => str(k, 28)).filter((k): k is string => !!k).slice(0, 8),
    change: str(r.change, 160),
    note: str(r.note, 160),
    source: str(r.source, 160),
  };
}

export type ViewSpec = { kind: "taxonomy"; spec: TaxonomySpec } | { kind: "lifecycle"; spec: LifecycleSpec } | { kind: "fim"; spec: FimSpec };

/** One view block by its fence name; null when the JSON is not valid (yet, while an answer streams). */
export function parseView(kind: string, text: string): ViewSpec | null {
  if (kind === "taxonomy") {
    const spec = parseTaxonomySpec(text);
    return spec && { kind, spec };
  }
  if (kind === "lifecycle") {
    const spec = parseLifecycleSpec(text);
    return spec && { kind, spec };
  }
  if (kind === "fim") {
    const spec = parseFimSpec(text);
    return spec && { kind, spec };
  }
  return null;
}

/** The ```taxonomy, ```lifecycle and ```fim blocks of a markdown text in document order; null where a block is not valid. */
export function viewBlocks(markdown: string): (ViewSpec | null)[] {
  return [...markdown.matchAll(/^```(taxonomy|lifecycle|fim)[^\n]*\n([\s\S]*?)^```/gm)].map((m) => parseView(m[1], m[2]));
}

/** The counts a taxonomy's legend and KPI strip show. */
export function taxonomyCounts(t: TaxonomySpec) {
  const acts = t.groups.flatMap((g) => g.processes.flatMap((p) => p.activities));
  const high = acts.filter((a) => a.impact === "high").length;
  const moderate = acts.filter((a) => a.impact === "moderate").length;
  return { l2: t.groups.length, l3: t.groups.reduce((n, g) => n + g.processes.length, 0), l4: acts.length, high, moderate };
}

// ── The required views of a finance transformation deliverable (Rakesh, 2026-11-27) ────────────────────────────

/** Whether a deliverable is a finance transformation piece, which must carry the required views. */
export const isFinanceTransformation = (text: string): boolean =>
  /\b(transform\w*|close|ledger|sub-?ledger|accounting hub|chart of accounts|reconcil\w*|consolidat\w*|ERP|EPM|finance operating model|record to report)\b/i.test(text);

const archTitles = (markdown: string) => [...markdown.matchAll(/^```architecture[^\n]*\n([\s\S]*?)^```/gm)].map((m) => /"title"\s*:\s*"([^"]*)"/.exec(m[1])?.[1] ?? "");

/** What a finance transformation deliverable lacks of the required views, in words the writer can act on. */
export function missingViews(markdown: string): string[] {
  const gaps: string[] = [];
  const titles = archTitles(markdown);
  if (!/^```process\b/m.test(markdown)) gaps.push("a process view: the end-to-end process as a ```process block (swimlanes, with APQC PCF ids from apqc_pcf on the steps)");
  if (!/^```taxonomy\b/m.test(markdown)) gaps.push("the process taxonomy: a ```taxonomy block, L1 cycle to L4 activities with APQC PCF ids and where the change lands");
  if (!titles.some((t) => /business reference architecture/i.test(t))) gaps.push('a business reference architecture: an ```architecture block titled "Business reference architecture: ..." whose layers hold capabilities');
  if (!titles.some((t) => /technology reference architecture/i.test(t))) gaps.push('a technology reference architecture: an ```architecture block titled "Technology reference architecture: ..." whose layers hold the systems and the data flows between them');
  if (!/^```lifecycle\b/m.test(markdown)) gaps.push("a product lifecycle view: a ```lifecycle block showing, stage by stage, the finance touchpoints and what the transformation changes");
  if (!/^```fim\b/m.test(markdown)) gaps.push("the finance information model: a ```fim block tracing a key GL balance to its instruments and source, with adjustments at instrument and GL level and the keys carried end to end");
  return gaps;
}
