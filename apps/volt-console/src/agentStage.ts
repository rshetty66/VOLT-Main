import type { ActivityItem, Run } from "./runState";

/**
 * The Agent Stage scene: a compact agent-flow graph (You, Rudra, the specialists, the tool agents, Verifier, Output)
 * derived from the run state the console already keeps. It costs no tokens: no model call and no extra event, only
 * what the run already streams. Pure, so the component only draws it and the tests check it.
 */

export type StationId = "web" | "analytics" | "kb" | "files" | "gates";
export type IconId = "user" | "bot" | "web" | "tool" | "brain" | "file" | "shield" | "out";
export type NodeState = "idle" | "active" | "done" | "failed";

export interface FlowNode {
  id: string;
  name: string;
  caption: string;
  x: number;
  y: number;
  icon: IconId;
  color: string;
  state: NodeState;
  /** Agents that reason (Rudra, specialists) show a Think loop while active. */
  agent: boolean;
  /** Specialists sit 50 apart, so their labels go beside the node instead of under it. */
  side: boolean;
}

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  state: "idle" | "on" | "done";
  /** The sender's colour. */
  color: string;
}

export interface Flow {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** The SVG world the flow is drawn in. */
export const FLOW_W = 760;
export const FLOW_H = 230;
export const COLUMNS: [number, string][] = [[36, "Query"], [130, "Plan"], [290, "Delegate"], [440, "Tools"], [575, "Verify"], [705, "Output"]];

type Fixed = Omit<FlowNode, "caption" | "state" | "side"> & { role: string };
const FIXED: Fixed[] = [
  { id: "user", name: "You", role: "Asked", x: 36, y: 115, icon: "user", color: "#94a3b8", agent: false },
  { id: "rudra", name: "Rudra", role: "Lead", x: 130, y: 115, icon: "bot", color: "#f5c542", agent: true },
  { id: "web", name: "Researcher", role: "Web search", x: 440, y: 45, icon: "web", color: "#38bdf8", agent: false },
  { id: "analytics", name: "Analyst", role: "Benchmarks", x: 440, y: 115, icon: "tool", color: "#2dd4bf", agent: false },
  { id: "kb", name: "Memory", role: "Skills, knowledge", x: 440, y: 185, icon: "brain", color: "#a78bfa", agent: false },
  { id: "files", name: "Builder", role: "Files", x: 575, y: 70, icon: "file", color: "#fb923c", agent: false },
  { id: "gates", name: "Verifier", role: "Evidence gates", x: 575, y: 165, icon: "shield", color: "#4ade80", agent: false },
  { id: "out", name: "Output", role: "Answer", x: 705, y: 115, icon: "out", color: "#f472b6", agent: false },
];
const SPEC_Y = [58, 108, 158, 206];
const SPEC_COLORS = ["#00e5ff", "#e879f9", "#60a5fa", "#34d399"];
const SPEC_X = 290;

const TOOL_STATION: Record<string, StationId> = {
  web_search: "web",
  web_fetch: "web",
  apqc_benchmark: "analytics",
  apqc_pcf: "kb",
  score_maturity: "analytics",
  build_value_case: "analytics",
  appraise_investment: "analytics",
  find_agents: "kb",
  find_skills: "kb",
  load_skill: "kb",
  get_template: "kb",
  list_templates: "kb",
  create_file: "files",
  build_accounting_hub: "files",
};

export function toolStation(name: string): StationId | undefined {
  return TOOL_STATION[name];
}

/** Plain words for a running tool call; `detail` is the short input summary the run state keeps. */
export function describeTool(name: string, detail = ""): string {
  const d = detail.trim();
  switch (name) {
    case "web_search": return d ? `Search: ${d}` : "Searching the web";
    case "web_fetch": return "Reading a source";
    case "apqc_benchmark": return d ? `Benchmark: ${d}` : "Pulling a benchmark";
    case "apqc_pcf": return d ? `Process: ${d}` : "Looking up a process";
    case "score_maturity": return "Scoring maturity";
    case "build_value_case": return "Value case model";
    case "appraise_investment": return "Appraising the investment";
    case "find_agents": return "Choosing specialists";
    case "find_skills": return "Finding playbooks";
    case "load_skill": return d ? `Playbook: ${d}` : "Loading a playbook";
    case "get_template": case "list_templates": return "Opening templates";
    case "create_file": return "Building the file";
    case "build_accounting_hub": return "Building the hub page";
    case "consult_agent": return d ? `Briefing ${d}` : "Briefing a specialist";
    default: return name.replace(/_/g, " ");
  }
}

const CAPTION_MAX = 26;
export function clip(text: string, max = CAPTION_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Status lines that are routing notes ("Model: Opus for the lead ...") say nothing about the work, so they are skipped. */
const isNoise = (a: ActivityItem) => a.kind === "status" && /^Model:/i.test(a.text);

/** What an agent is doing now, in a few words. */
function caption(activity: ActivityItem[], fallback: string): string {
  const items = activity.filter((a) => !isNoise(a));
  const pending = [...items].reverse().find((a) => a.kind === "tool" && a.pending);
  if (pending) return `Waiting on ${STATION_NAME[toolStation(pending.text) ?? "kb"]}`;
  const a = items[items.length - 1];
  if (!a) return fallback;
  if (a.kind === "tool") return a.detail || describeTool(a.text);
  if (a.kind === "fallback") return "Retrying on a backup model";
  return a.text;
}
const STATION_NAME: Record<StationId, string> = { web: "Researcher", analytics: "Analyst", kb: "Memory", files: "Builder", gates: "Verifier" };

/** A tool call seen in the run, with the node that made it. */
export interface Call {
  id: string;
  from: string;
  to: StationId;
  pending: boolean;
  label: string;
  result: string;
}

/** Every mapped tool call, Rudra's first, then each specialist's in start order. */
export function toolCalls(run: Run): Call[] {
  const out: Call[] = [];
  const add = (from: string, items: ActivityItem[]) => {
    for (const a of items) {
      const to = a.kind === "tool" ? toolStation(a.text) : undefined;
      if (to) out.push({ id: a.id, from, to, pending: !!a.pending, label: describeTool(a.text, a.detail), result: a.pending ? "" : a.detail || "" });
    }
  };
  add("rudra", run.activity);
  for (const id of run.laneOrder) if (run.lanes[id]) add(id, run.lanes[id].activity);
  return out;
}

/**
 * Builds the flow for a run. Finished specialists of earlier workflow phases leave the Delegate column so the next
 * phase has room; at most four specialists show, the latest ones. `gates` is the client-side evidence-gate result,
 * shown on the Verifier once the answer is finished.
 */
export function flowScene(run: Run, gates?: { passed: number; total: number }): Flow {
  const running = run.state === "running";
  const finished = run.state === "done";
  const nodes = new Map<string, FlowNode>();
  for (const f of FIXED) nodes.set(f.id, { ...f, caption: f.role, state: "idle", side: false });
  const set = (id: string, patch: Partial<FlowNode>) => {
    const n = nodes.get(id);
    if (n) nodes.set(id, { ...n, ...patch });
  };
  const edges = new Map<string, FlowEdge>();
  const edge = (from: string, to: string, state: FlowEdge["state"]) => {
    const id = `${from}>${to}`;
    const prev = edges.get(id);
    // A link that is busy stays busy; one used once stays lit.
    const rank = { idle: 0, done: 1, on: 2 };
    if (prev && rank[prev.state] >= rank[state]) return;
    edges.set(id, { id, from, to, state, color: nodes.get(from)?.color ?? "#94a3b8" });
  };

  set("user", { state: "done" });
  set("rudra", {
    state: running ? "active" : run.state === "stopped" ? "failed" : "done",
    caption: running ? caption(run.activity, "Planning") : run.state === "stopped" ? "Stopped" : "Done",
  });

  const currentPhase = run.phases.length - 1;
  const lanes = run.laneOrder.map((id) => run.lanes[id]).filter(Boolean);
  const onFloor = lanes.filter((l) => !(l.state !== "running" && l.phase !== undefined && l.phase < currentPhase)).slice(-SPEC_Y.length);
  onFloor.forEach((l, i) => {
    const live = l.state === "running" && running;
    nodes.set(l.id, {
      id: l.id,
      name: clip(l.name, 22),
      caption: l.state === "failed" ? "Failed" : live ? caption(l.activity, l.brief || "Starting") : "Done",
      x: SPEC_X,
      y: SPEC_Y[i],
      icon: "bot",
      color: SPEC_COLORS[i % SPEC_COLORS.length],
      state: l.state === "failed" ? "failed" : live ? "active" : "done",
      agent: true,
      side: true,
    });
  });

  // The faint routes every run can take, so the structure reads before anything happens.
  edge("user", "rudra", "done");
  for (const s of ["web", "analytics", "kb", "files", "gates"]) edge("rudra", s, "idle");
  edge("files", "gates", "idle");
  edge("gates", "out", "idle");
  for (const l of onFloor) edge("rudra", l.id, nodes.get(l.id)!.state === "active" ? "on" : "done");

  for (const c of toolCalls(run)) {
    // Calls from specialists that already left the floor are drawn from Rudra, who briefed them.
    const from = nodes.has(c.from) ? c.from : "rudra";
    const live = c.pending && running;
    edge(from, c.to, live ? "on" : "done");
    const n = nodes.get(c.to)!;
    if (live) set(c.to, { state: "active", caption: clip(c.label) });
    else if (n.state !== "active") set(c.to, { state: "done", caption: clip(c.result || c.label) });
    if (c.to === "files" && !c.pending) edge("files", "gates", "done");
  }

  if (!running && gates && gates.total > 0) {
    set("gates", { state: gates.passed === gates.total ? "done" : "failed", caption: `${gates.passed} of ${gates.total} gates passed` });
    if (!edges.get("files>gates") || edges.get("files>gates")!.state === "idle") edge("rudra", "gates", "done");
  }
  if (finished) {
    set("out", { state: "done", caption: "Answer ready" });
    // The answer always leaves through the Verifier column, so the line never cuts across the tool agents.
    if (nodes.get("gates")!.state === "idle") edge("rudra", "gates", "done");
    edge("gates", "out", "done");
  }

  for (const n of nodes.values()) n.caption = clip(n.caption);
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

type Point = { x: number; y: number; id: string };

/** Where a link meets the rim of each node. */
export function edgeEnds(a: Point, b: Point): [[number, number], [number, number]] {
  const ra = a.id === "rudra" ? 17 : 14;
  const rb = b.id === "rudra" ? 17 : 14;
  const dir = b.x >= a.x ? 1 : -1;
  return [[a.x + ra * dir, a.y], [b.x - rb * dir, b.y]];
}

/** The path of a link: a soft S-curve between the rims of two nodes. */
export function edgePath(a: Point, b: Point): string {
  const [[x1, y1], [x2, y2]] = edgeEnds(a, b);
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}
