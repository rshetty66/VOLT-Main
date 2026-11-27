import type { ActivityItem, Run } from "./runState";

/**
 * The Agent Stage scene: where each agent stands and what it says, derived from the run state the console already
 * keeps (no extra events). Pure, so the component only draws it and the tests check it.
 */

export type StationId = "web" | "analytics" | "kb" | "files" | "gates";

/** A station on the 8 x 8 isometric floor: tile origin (i, j), footprint (w, d), height h, and where an agent stands to use it. */
export interface Station {
  id: StationId;
  label: string;
  i: number;
  j: number;
  w: number;
  d: number;
  h: number;
  color: string;
  stand: [number, number];
}

export const STATIONS: Station[] = [
  { id: "web", label: "Web research", i: 0, j: 0, w: 1, d: 1, h: 16, color: "#00e5ff", stand: [1.5, 1.4] },
  { id: "analytics", label: "Analytics & benchmarks", i: 7, j: 0, w: 1, d: 1, h: 16, color: "#2dd4bf", stand: [6.7, 1.5] },
  { id: "kb", label: "Skills & knowledge", i: 0, j: 7, w: 1, d: 1, h: 16, color: "#9b8cff", stand: [1.5, 6.7] },
  { id: "files", label: "File builder", i: 7, j: 7, w: 1, d: 1, h: 16, color: "#d4af37", stand: [6.7, 6.7] },
  { id: "gates", label: "Evidence gates", i: 7, j: 3, w: 1, d: 2, h: 10, color: "#00e5ff", stand: [6.6, 4] },
];
export const HUB = { i: 3, j: 3, w: 2, d: 2, h: 18 };
/** Desks around the hub, kept clear of the station labels and of Rudra's head. */
export const SLOTS: [number, number][] = [[3.2, 1], [5.2, 1.6], [1.6, 5.2], [5.9, 5.9], [1, 3.2], [6.1, 4.6], [4, 6.3], [2.6, 6.6]];

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
    case "web_search": return d ? `Searching the web: "${d}"` : "Searching the web";
    case "web_fetch": return "Reading a source";
    case "apqc_benchmark": return d ? `Pulling APQC benchmark: ${d}` : "Pulling an APQC benchmark";
    case "apqc_pcf": return d ? `Looking up APQC process: ${d}` : "Looking up an APQC process";
    case "score_maturity": return "Scoring maturity";
    case "build_value_case": return "Modelling the value case";
    case "appraise_investment": return "Appraising the investment";
    case "find_agents": return "Choosing specialists";
    case "find_skills": return "Finding playbooks";
    case "load_skill": return d ? `Loading playbook: ${d}` : "Loading a playbook";
    case "get_template": case "list_templates": return "Opening your templates";
    case "create_file": return "Building the file";
    case "build_accounting_hub": return "Building the Accounting Hub page";
    case "consult_agent": return d ? `Briefing ${d}` : "Briefing a specialist";
    default: return name.replace(/_/g, " ");
  }
}

export type AgentState = "running" | "done" | "failed";

export interface StageAgent {
  id: string;
  name: string;
  lead: boolean;
  color: string;
  state: AgentState;
  /** Floor position (x, y) and height z. */
  pos: [number, number, number];
  thinking: boolean;
  working: boolean;
  alert: boolean;
  bubble: string;
}

export interface Scene {
  agents: StageAgent[];
  live: StationId[];
}

const LAYER_COLORS = ["#00e5ff", "#2dd4bf", "#9b8cff"];
const GOLD = "#d4af37";

function layerColor(layer: string): string {
  let h = 0;
  for (const c of layer) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return LAYER_COLORS[h % LAYER_COLORS.length];
}

const BUBBLE_MAX = 60;
function clip(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > BUBBLE_MAX ? `${t.slice(0, BUBBLE_MAX - 1).trimEnd()}\u2026` : t;
}

function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1];
}

/** What an agent is doing now: the station of its pending tool call (if any) and its bubble text. */
function current(activity: ActivityItem[], fallback: string): { station?: StationId; bubble: string; working: boolean; alert: boolean } {
  const pending = [...activity].reverse().find((a) => a.kind === "tool" && a.pending);
  if (pending) return { station: toolStation(pending.text), bubble: describeTool(pending.text, pending.detail), working: true, alert: false };
  const a = last(activity);
  if (!a) return { bubble: fallback, working: false, alert: false };
  if (a.kind === "tool") return { bubble: a.detail || describeTool(a.text), working: false, alert: !!a.isError };
  if (a.kind === "fallback") return { bubble: "Retrying on a backup model", working: false, alert: true };
  return { bubble: a.text, working: false, alert: a.kind === "error" };
}

/**
 * Builds the scene for a run. Finished agents from earlier workflow phases leave the floor so the next phase has room.
 * `gates` is the client-side evidence-gate result, shown once the answer is finished.
 */
export function stageScene(run: Run, gates?: { passed: number; total: number }): Scene {
  const running = run.state === "running";
  const live = new Set<StationId>();
  const stationPos = (id: StationId): [number, number, number] => {
    const s = STATIONS.find((x) => x.id === id)!;
    return [s.stand[0], s.stand[1], 0];
  };

  const lead = current(run.activity, running ? "Planning" : "Done");
  if (lead.station) live.add(lead.station);
  const showGates = !running && !!gates && gates.total > 0;
  const rudra: StageAgent = {
    id: "rudra",
    name: "Rudra",
    lead: true,
    color: GOLD,
    state: running ? "running" : run.state === "stopped" ? "failed" : "done",
    pos: lead.station && running ? stationPos(lead.station) : [4, 4, HUB.h],
    thinking: running && !lead.working,
    working: running && lead.working,
    alert: lead.alert,
    bubble: showGates ? `${gates!.passed} of ${gates!.total} evidence gates passed` : running ? lead.bubble : run.state === "stopped" ? "Stopped" : "Done",
  };
  if (showGates) live.add("gates");

  const currentPhase = run.phases.length - 1;
  const lanes = run.laneOrder.map((id) => run.lanes[id]).filter(Boolean);
  const onFloor = lanes.filter((l) => !(l.state !== "running" && l.phase !== undefined && l.phase < currentPhase));
  const agents: StageAgent[] = onFloor.map((l, i) => {
    const c = current(l.activity, l.brief || "Starting");
    const isRunning = l.state === "running" && running;
    if (c.station && isRunning) live.add(c.station);
    const home = SLOTS[i % SLOTS.length];
    return {
      id: l.id,
      name: l.name,
      lead: false,
      color: layerColor(l.layer || l.name),
      state: l.state === "running" && !running ? "done" : l.state,
      pos: c.station && isRunning ? stationPos(c.station) : [home[0], home[1], 0],
      thinking: isRunning && !c.working,
      working: isRunning && c.working,
      alert: c.alert,
      bubble: l.state === "failed" ? "Failed" : l.state === "done" ? "Done" : c.bubble,
    };
  });
  // Bubbles are glanceable: long briefs and results are cut; the full text is in the answer and the sections.
  const all = [rudra, ...agents].map((a) => ({ ...a, bubble: clip(a.bubble) }));
  return { agents: all, live: [...live] };
}

/** Isometric projection of floor coordinates onto the 640 x 420 stage. */
export const TILE_W = 64;
export const TILE_H = 32;
export function iso(x: number, y: number, z = 0): { x: number; y: number } {
  return { x: 320 + ((x - y) * TILE_W) / 2, y: 112 + ((x + y) * TILE_H) / 2 - z };
}
