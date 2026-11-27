/** Diagram spec for the Diagrams builder: typed nodes and edges plus named scenarios. Shared by server and client. */
export const NODE_TYPES = ["agent", "tool", "model", "prompt", "skill", "output", "user", "human", "memory", "knowledge", "environment", "aggregator", "gateway", "router", "channel", "trigger", "guardrail", "observability"] as const;
export const EDGE_KINDS = ["request", "response", "async", "streaming", "event", "error"] as const;
export const MAX_NODES = 14;

export interface DiagramNode { id: string; type: (typeof NODE_TYPES)[number]; label: string; sub?: string; detail?: string }
export interface DiagramEdge { from: string; to: string; kind?: (typeof EDGE_KINDS)[number]; label?: string }
export interface DiagramStep { edge?: string; edges?: string[]; note: string; payload?: unknown }
export interface DiagramSpec {
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups?: { id: string; label: string; nodes: string[] }[];
  scenarios?: { name: string; steps: DiagramStep[] }[];
}

/** The renderer also escapes every string it inserts as HTML; angle brackets are removed here as a second layer. */
const clean = (s: unknown, max = 200): string => String(s ?? "").replace(/[<>`]/g, "").slice(0, max);
const rec = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

/** Validates and normalises a spec. Throws an Error with a message fit to show the user. */
export function validateSpec(raw: unknown): DiagramSpec {
  const r = rec(raw);
  if (!Array.isArray(r.nodes) || r.nodes.length === 0) throw new Error("The diagram has no nodes.");
  if (r.nodes.length > MAX_NODES) throw new Error(`The diagram has ${r.nodes.length} nodes; the limit is ${MAX_NODES}. Describe one subsystem at a time.`);
  const ids = new Set<string>();
  const nodes: DiagramNode[] = r.nodes.map((n) => {
    const o = rec(n);
    const id = clean(o.id, 40).replace(/[^\w-]/g, "");
    if (!id || ids.has(id)) throw new Error(`Node id "${id}" is missing or duplicated.`);
    ids.add(id);
    const type = (NODE_TYPES as readonly string[]).includes(String(o.type)) ? (o.type as DiagramNode["type"]) : "agent";
    return { id, type, label: clean(o.label || id, 30), sub: o.sub ? clean(o.sub, 40) : undefined, detail: o.detail ? clean(o.detail, 400) : undefined };
  });
  const keys = new Set<string>();
  const edges: DiagramEdge[] = (Array.isArray(r.edges) ? r.edges : []).map((e) => {
    const o = rec(e);
    const from = String(o.from), to = String(o.to);
    if (!ids.has(from) || !ids.has(to)) throw new Error(`An edge points at an unknown node (${from} to ${to}).`);
    keys.add(`${from}>${to}`);
    const kind = (EDGE_KINDS as readonly string[]).includes(String(o.kind)) ? (o.kind as DiagramEdge["kind"]) : "request";
    return { from, to, kind, label: o.label ? clean(o.label, 20) : undefined };
  });
  const scenarios = (Array.isArray(r.scenarios) ? r.scenarios : []).slice(0, 6).map((s) => {
    const o = rec(s);
    const steps = (Array.isArray(o.steps) ? o.steps : []).slice(0, 20).map((st) => {
      const p = rec(st);
      const list = (Array.isArray(p.edges) ? p.edges : [p.edge]).map(String);
      for (const k of list) if (!keys.has(k)) throw new Error(`A scenario step uses an edge that does not exist (${k}).`);
      let payload: unknown = undefined;
      if (p.payload !== undefined) {
        const str = (typeof p.payload === "string" ? p.payload : JSON.stringify(p.payload)).replace(/[<>`]/g, "");
        try { payload = typeof p.payload === "string" || str.length > 400 ? str.slice(0, 400) : JSON.parse(str); } catch { payload = str.slice(0, 400); }
      }
      return list.length > 1 ? { edges: list, note: clean(p.note, 160), payload } : { edge: list[0], note: clean(p.note, 160), payload };
    });
    return { name: clean(o.name || "Scenario", 40), steps };
  });
  const groups = (Array.isArray(r.groups) ? r.groups : []).map((g) => {
    const o = rec(g);
    return { id: clean(o.id, 40), label: clean(o.label, 30), nodes: (Array.isArray(o.nodes) ? o.nodes : []).map(String).filter((i) => ids.has(i)) };
  }).filter((g) => g.nodes.length > 0);
  return { title: clean(r.title || "Diagram", 80), nodes, edges, groups, scenarios };
}

/** Pulls the first JSON object out of model text (it may arrive fenced). */
export function extractJson(text: string): unknown {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("The model did not return a diagram.");
  try { return JSON.parse(text.slice(a, b + 1)); } catch { throw new Error("The model's diagram could not be read. Try again."); }
}

/** The sample shown in demo mode and as the starting point in the builder. */
export const SAMPLE_SPEC: DiagramSpec = validateSpec({
  title: "Invoice triage agent",
  nodes: [
    { id: "u", type: "user", label: "AP clerk", sub: "Uploads invoice" },
    { id: "gw", type: "gateway", label: "API gateway", sub: "Auth, rate limits" },
    { id: "ag", type: "agent", label: "Triage agent", sub: "Plans and calls tools", detail: "Orchestrates extraction, matching and approval." },
    { id: "gr", type: "guardrail", label: "Policy check", sub: "Limits, SoD" },
    { id: "m", type: "model", label: "LLM", sub: "Extraction" },
    { id: "t", type: "tool", label: "ERP lookup", sub: "PO and vendor" },
    { id: "kb", type: "knowledge", label: "Policy KB" },
    { id: "h", type: "human", label: "Approver", sub: "Over-limit only" },
    { id: "o", type: "output", label: "Posted entry" },
  ],
  edges: [
    { from: "u", to: "gw", label: "upload" }, { from: "gw", to: "ag" }, { from: "ag", to: "m", kind: "streaming", label: "extract" },
    { from: "ag", to: "t", label: "match PO" }, { from: "ag", to: "kb", label: "retrieve" }, { from: "ag", to: "gr" },
    { from: "gr", to: "h", kind: "async", label: "escalate" }, { from: "gr", to: "o", label: "pass" },
    { from: "h", to: "ag", kind: "event", label: "decision" }, { from: "t", to: "ag", kind: "error", label: "no PO" },
  ],
  groups: [{ id: "g", label: "Agent runtime", nodes: ["ag", "m", "t", "kb"] }],
  scenarios: [
    { name: "Happy path", steps: [
      { edge: "u>gw", note: "Clerk uploads PDF", payload: { file: "inv-1042.pdf" } }, { edge: "gw>ag", note: "Request authenticated" },
      { edges: ["ag>m", "ag>t", "ag>kb"], note: "Parallel: extract, match, retrieve policy", payload: { vendor: "Acme", total: 1840 } },
      { edge: "ag>gr", note: "Validate against limits" }, { edge: "gr>o", note: "Within limit, entry posted" } ] },
    { name: "Over limit", steps: [
      { edge: "u>gw", note: "Upload" }, { edge: "gw>ag", note: "Authenticated" }, { edge: "ag>gr", note: "Amount exceeds limit" },
      { edge: "gr>h", note: "Escalate to approver" }, { edge: "h>ag", note: "Approver signs off" } ] },
  ],
});
