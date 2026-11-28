/**
 * Scenario assistant changes to the finance reference model (Diagram Builder, PR 2). The model proposes changes as
 * small typed operations; applyChanges applies them one at a time on a copy and keeps an operation only if the model
 * still validates afterwards. So a what-if changes only what it names, and a bad id is rejected with a reason
 * instead of breaking a view.
 */
import type { Impact } from "./views";
import { activities, validateFinanceModel, type Agent, type FinanceModel } from "./financeReference";

export type ModelChange =
  | { op: "add_agent"; agent: Agent }
  | { op: "update_agent"; id: string; on?: string[]; activities?: string[]; approver?: string; does?: string; guardrail?: string; name?: string }
  | { op: "remove_agent"; id: string }
  | { op: "rate_activity"; activity: string; impact: Impact }
  | { op: "set_maturity"; capability: string; today?: 1 | 2 | 3; target?: 1 | 2 | 3 };

export interface ChatLink { label: string; target: string }
export interface ChatTurn { role: "user" | "assistant"; text: string }
export interface ChatReply { bullets: string[]; links: ChatLink[]; changes: ModelChange[] }

const s = (v: unknown, max: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().replace(/[<>]/g, "").slice(0, max) : undefined);
const list = (v: unknown, max: number, len: number): string[] | undefined => (Array.isArray(v) ? v.map((x) => s(x, len)).filter((x): x is string => !!x).slice(0, max) : undefined);
const level = (v: unknown): 1 | 2 | 3 | undefined => (v === 1 || v === 2 || v === 3 ? v : undefined);
const IMPACTS: Impact[] = ["high", "moderate", "low"];

/** One change from untrusted model output, or null when its shape is wrong. Text is trimmed and stripped of markup. */
export function parseChange(raw: unknown): ModelChange | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  switch (r.op) {
    case "add_agent": {
      const a = (r.agent ?? {}) as Record<string, unknown>;
      const id = s(a.id, 40), name = s(a.name, 60), on = list(a.on, 8, 40);
      if (!id || !/^ag_[a-z0-9_]+$/.test(id) || !name || !on?.length) return null;
      return { op: "add_agent", agent: { id, name, on, activities: list(a.activities, 12, 80) ?? [], approver: s(a.approver, 60) ?? "To confirm", does: s(a.does, 300) ?? "", guardrail: s(a.guardrail, 300) ?? "Drafts only; a person approves." } };
    }
    case "update_agent": {
      const id = s(r.id, 40);
      if (!id) return null;
      const c: ModelChange = { op: "update_agent", id };
      const on = list(r.on, 8, 40), acts = list(r.activities, 12, 80);
      if (on) c.on = on;
      if (acts) c.activities = acts;
      for (const k of ["approver", "does", "guardrail", "name"] as const) {
        const v = s(r[k], k === "name" || k === "approver" ? 60 : 300);
        if (v) c[k] = v;
      }
      return Object.keys(c).length > 2 ? c : null;
    }
    case "remove_agent": {
      const id = s(r.id, 40);
      return id ? { op: "remove_agent", id } : null;
    }
    case "rate_activity": {
      const activity = s(r.activity, 80), impact = IMPACTS.find((i) => i === r.impact);
      return activity && impact ? { op: "rate_activity", activity, impact } : null;
    }
    case "set_maturity": {
      const capability = s(r.capability, 60), today = level(r.today), target = level(r.target);
      return capability && (today || target) ? { op: "set_maturity", capability, ...(today && { today }), ...(target && { target }) } : null;
    }
    default:
      return null;
  }
}

/** A link from the reply into the views, kept only if its target exists in the model. */
export function linkExists(m: FinanceModel, target: string): boolean {
  const i = target.indexOf(":"), k = target.slice(0, i), id = target.slice(i + 1);
  if (k === "cmp") return id in m.components;
  if (k === "agent") return m.agents.some((a) => a.id === id);
  if (k === "l4") return activities(m).some((a) => a.name === id);
  if (k === "cap") return m.capabilities.some((c) => c.name === id);
  return false;
}

/** The change in words, for the chat and the audit trail. */
export function describeChange(c: ModelChange, m: FinanceModel): string {
  const agent = (id: string) => m.agents.find((a) => a.id === id)?.name ?? id;
  const cmps = (ids: string[]) => ids.map((k) => m.components[k]?.[0] ?? k).join(", ");
  switch (c.op) {
    case "add_agent": return `Added ${c.agent.name} on ${cmps(c.agent.on)}`;
    case "update_agent": return `Changed ${agent(c.id)}${c.on ? `: now on ${cmps(c.on)}` : ""}${c.activities ? `${c.on ? "," : ":"} covers ${c.activities.length} activities` : ""}`;
    case "remove_agent": return `Removed ${agent(c.id)}`;
    case "rate_activity": return `Rated "${c.activity}" ${c.impact}`;
    case "set_maturity": return `Set ${c.capability} maturity${c.today ? ` today ${c.today}` : ""}${c.target ? ` target ${c.target}` : ""}`;
  }
}

function applyOne(m: FinanceModel, c: ModelChange): string | null {
  switch (c.op) {
    case "add_agent":
      if (m.agents.some((a) => a.id === c.agent.id)) return `Agent id "${c.agent.id}" already exists`;
      m.agents.push(structuredClone(c.agent));
      return null;
    case "update_agent": {
      const a = m.agents.find((x) => x.id === c.id);
      if (!a) return `No agent "${c.id}"`;
      const { op: _op, id: _id, ...rest } = c;
      Object.assign(a, structuredClone(rest));
      return null;
    }
    case "remove_agent": {
      const i = m.agents.findIndex((x) => x.id === c.id);
      if (i < 0) return `No agent "${c.id}"`;
      m.agents.splice(i, 1);
      return null;
    }
    case "rate_activity": {
      const hits = m.taxonomy.flatMap((t) => t.groups.flatMap((g) => g.processes.flatMap((p) => p.activities))).filter((a) => a.name === c.activity);
      if (!hits.length) return `No activity "${c.activity}" in the taxonomy`;
      hits.forEach((a) => (a.impact = c.impact));
      return null;
    }
    case "set_maturity": {
      const cap = m.capabilities.find((x) => x.name === c.capability);
      if (!cap) return `No capability "${c.capability}"`;
      if (c.today) cap.today = c.today;
      if (c.target) cap.target = c.target;
      return null;
    }
  }
}

/**
 * Applies changes in order to a copy of the model. A change is kept only if it applies and adds no validation
 * error; otherwise it is reported in rejected with the reason. The input model is never mutated.
 */
export function applyChanges(model: FinanceModel, changes: ModelChange[]): { model: FinanceModel; applied: string[]; rejected: string[] } {
  let m = structuredClone(model);
  const before = new Set(validateFinanceModel(m));
  const applied: string[] = [], rejected: string[] = [];
  for (const c of changes) {
    const next = structuredClone(m);
    const err = applyOne(next, c) ?? validateFinanceModel(next).find((e) => !before.has(e)) ?? null;
    if (err) rejected.push(`${describeChange(c, m)}: ${err}`);
    else {
      applied.push(describeChange(c, m));
      m = next;
    }
  }
  return { model: m, applied, rejected };
}
