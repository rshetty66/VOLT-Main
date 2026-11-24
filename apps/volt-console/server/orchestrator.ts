/**
 * VOLT agentic runtime on the Claude API.
 *
 * Three run kinds, mirroring the capabilities VOLT validates:
 *   - orchestrate: Rudra (VOLT's master orchestrator) plans, finds agents and
 *     skills, and delegates to specialists through `consult_agent` - several
 *     consults in one turn run in parallel.
 *   - agent: talk to one VOLT agent directly with its own system prompt.
 *   - workflow: run one of VOLT's 35 multi-phase workflows. Phases run in
 *     order; agents within a phase run in parallel and see prior phases'
 *     outputs; Rudra then synthesises the executive deliverable.
 *
 * Every agent is a manual streaming tool loop so the UI can show progress
 * updates, tool calls and text as they happen.
 */
import { attachmentsBlock, registerAttachments } from "./attachments.js";
import { lateForRewrite, runBudgetMs } from "./budget.js";
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import type { AgentDef, Catalog, WorkflowDef } from "./catalog.js";
import { assessDepth, leadDeliverableGuide, MIN_WORDS, specialistDeliverableGuide, strengthenPrompt, wantsDeliverable } from "./deliverable.js";
import { SourceRegistry, sourceForTool, sourcesFromWebSearch } from "./research.js";
import { evidenceGates } from "../shared/research.js";
import { ORCHESTRATOR_TOOLS, SPECIALIST_TOOLS, type ToolName, runLocalTool, schemas, toolDefs } from "./tools.js";
import { ORCHESTRATOR_LANE, type RunRequest, type VoltEvent } from "../shared/events.js";

export type Emit = (e: VoltEvent) => void;

/** A run request after the server has resolved its template. */
export interface RunInput extends RunRequest {
  template?: { id: string; name: string; guide: string };
}

/** The user's request, with the selected template's formatting guide attached. */
export function withTemplate(req: RunInput, text = req.prompt): string {
  const files = attachmentsBlock(req.attachments);
  if (!req.template) return `${text}${files}`;
  return `${text}${files}

---
Formatting template: "${req.template.name}" (template id ${req.template.id}). Any deliverable you write or specify must follow this formatting guide.

${req.template.guide}`;
}
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export const MODEL = process.env.VOLT_MODEL ?? "claude-opus-5-5";
const ORCHESTRATOR_EFFORT = (process.env.VOLT_ORCHESTRATOR_EFFORT ?? "medium") as Effort;
const SPECIALIST_EFFORT = (process.env.VOLT_SPECIALIST_EFFORT ?? "medium") as Effort;
/** Claude's own web_search, opt-in: sources then come from real pages. Off by default until it has had a live test. */
const WEB_RESEARCH = (process.env.VOLT_WEB_RESEARCH ?? "off") === "on";
const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 8 } as unknown as Anthropic.Beta.BetaTool;
const USE_FALLBACKS = (process.env.VOLT_FALLBACKS ?? "on") !== "off";
const MAX_TURNS = 16;
const MAX_CONSULT_CHARS = 24_000;
/** Specialists a single run may consult. Each one is a full model run, so this bounds the time and the cost. */
export const MAX_CONSULTS = Number(process.env.VOLT_MAX_CONSULTS) > 0 ? Number(process.env.VOLT_MAX_CONSULTS) : 6;

interface Session {
  id: string;
  /** Conversation with the lead agent (Rudra, or the directly-addressed agent). */
  messages: Anthropic.Beta.BetaMessageParam[];
  agentId?: string;
  /** True while a run is using this conversation; a second run on it is refused (see /api/run). */
  busy?: boolean;
  lastUsed: number;
}

const SESSION_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_SESSIONS = 500;
const sessions = new Map<string, Session>();

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

// ── Prompts ──────────────────────────────────────────────────────────────────

function rosterText(catalog: Catalog): string {
  const byLayer = new Map<string, AgentDef[]>();
  for (const a of catalog.agents) byLayer.set(a.layer, [...(byLayer.get(a.layer) ?? []), a]);
  return [...byLayer.entries()]
    .map(([layer, agents]) => `### ${layer}\n` + agents.map((a) => `- ${a.id}: ${a.description}`).join("\n"))
    .join("\n\n");
}

function orchestratorSystem(catalog: Catalog): string {
  const rudra = catalog.agentById.get("rudra");
  const workflows = catalog.workflows
    .map((w) => `- ${w.id}: ${w.name} - ${w.description} Phases: ${w.phases.map((p) => p.name).join(" → ")}`)
    .join("\n");
  return `${rudra?.systemPrompt ?? "You are Rudra, VOLT's master orchestrator and consulting partner."}

## How you work in this console
You lead a bench of VOLT specialist agents. For any request that spans more than one domain, or needs depth you would otherwise approximate:
1. Decide which workstreams the request really needs. Use find_agents when the right specialist is not obvious from the roster below.
2. Delegate with consult_agent. Give each specialist a self-contained brief (client context, the precise question, the deliverable you need back). Put independent consults in the same turn so they run in parallel. For a client deliverable consult three to six specialists, one per workstream that matters, in parallel in the same turn, so the answer has the depth of a team.
3. Use find_skills then load_skill when a VOLT method or reference pack would sharpen the answer.
4. Never do finance arithmetic in your head: benchmarks, maturity scores, NPV/IRR and value cases come from the apqc_benchmark, score_maturity, appraise_investment and build_value_case tools.
5. Synthesise. The user reads your final answer, not the specialists' raw output: reconcile disagreements, keep what is decision-relevant, and write it as the firm's own work (no references to the specialists).

Write the final answer as an executive-grade consulting deliverable in Markdown: a one-paragraph answer first, then structured sections and tables. Where a picture clarifies an architecture, process, roadmap or prioritisation, include Mermaid diagrams (up to four) in \`\`\`mermaid code blocks (flowchart, gantt, quadrantChart or pie; short plain labels, no styling); the console draws them and carries them into downloads. State assumptions and data gaps plainly instead of inventing client facts. If a simple question needs no delegation, answer it directly.

${leadDeliverableGuide()}

When a request matches one of the VOLT workflows below, mention it by name so the user can launch it as a full multi-phase run.

## VOLT workflows
${workflows}

## VOLT agent roster (id: remit)
${rosterText(catalog)}`;
}

function specialistSystem(catalog: Catalog, agent: AgentDef): string {
  const shipped = agent.skills.filter((s) => catalog.skillById.has(s));
  return `${agent.systemPrompt}

## Working inside VOLT
You are the ${agent.name} agent (${agent.layer}). ${agent.description}
You have been brought in on a workstream. Answer the brief with a practitioner-grade deliverable in Markdown, typically 700 to 1,000 words, at the depth of a senior practitioner's client workpaper: quantified findings with the arithmetic, options with their trade-offs, risks with mitigations, assumptions and data gaps, and at least two exhibits (tables with a Source line). You may add up to two short Mermaid diagrams (flowchart, gantt, quadrantChart or pie) in \`\`\`mermaid blocks when they clarify a flow or a plan. Lead with the answer. Be explicit about assumptions, risks and the data you would need to firm up the view.
Use tools for numbers (apqc_benchmark, score_maturity, appraise_investment, build_value_case) and the Skill Finder (find_skills, load_skill) for VOLT method packs.${shipped.length ? `\nYour registered VOLT skills: ${shipped.join(", ")}.` : ""}${specialistDeliverableGuide() ? `\n\n${specialistDeliverableGuide()}` : ""}`;
}

// ── Streaming tool loop ──────────────────────────────────────────────────────

interface LoopOptions {
  catalog: Catalog;
  lane: string;
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  tools: ToolName[];
  effort: Effort;
  emit: Emit;
  signal: AbortSignal;
  /** The run's source register: tool results are recorded in it and cited by key. */
  registry: SourceRegistry;
}

/**
 * Runs one agent to completion. Mutates `messages` (appending every assistant
 * turn and tool result) and returns the agent's final text.
 */
async function runAgentLoop(opts: LoopOptions): Promise<string> {
  const { catalog, lane, emit, signal, messages } = opts;
  const betas: Anthropic.Beta.AnthropicBeta[] = ["thinking-display-updates-2026-08-18"];
  if (USE_FALLBACKS) betas.push("server-side-fallback-2026-07-01");
  let finalText = "";
  let jsonRetries = 0;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = getClient().beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages,
        tools: [...toolDefs(opts.tools), ...(WEB_RESEARCH ? [WEB_SEARCH_TOOL] : [])],
        thinking: { type: "adaptive", display: "updates" },
        output_config: { effort: opts.effort },
        betas,
        ...(USE_FALLBACKS ? { fallbacks: "default" as const } : {}),
      },
      { signal },
    );

    let thinkingBuf = "";
    for await (const ev of stream) {
      if (ev.type === "content_block_start") {
        if (ev.content_block.type === "thinking") thinkingBuf = "";
        if (ev.content_block.type === "fallback") {
          emit({ type: "fallback", lane, from: ev.content_block.from.model, to: ev.content_block.to.model });
        }
      } else if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") emit({ type: "text_delta", lane, text: ev.delta.text });
        else if (ev.delta.type === "thinking_delta") thinkingBuf += ev.delta.thinking;
      } else if (ev.type === "content_block_stop" && thinkingBuf.trim()) {
        // With display "updates", non-empty thinking blocks are short progress notes.
        emit({ type: "status", lane, text: thinkingBuf.trim() });
        thinkingBuf = "";
      }
    }

    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await stream.finalMessage();
      jsonRetries = 0;
    } catch (err) {
      // Only an unparseable streamed tool input is retried; API errors propagate.
      if (err instanceof Anthropic.APIError || signal.aborted || jsonRetries++ >= 2) throw err;
      emit({ type: "status", lane, text: "Re-issuing turn after a malformed tool input" });
      continue;
    }

    emit({
      type: "usage",
      lane,
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    });

    if (message.stop_reason === "refusal") {
      emit({ type: "error", lane, message: "The model declined this request." });
      return finalText;
    }

    if (WEB_RESEARCH) {
      for (const b of message.content as { type: string; content?: unknown }[]) {
        if (b.type !== "web_search_tool_result") continue;
        for (const src of sourcesFromWebSearch(b.content)) {
          const { record, isNew } = opts.registry.add(src);
          if (isNew) emit({ type: "source", record });
        }
      }
    }

    const content = echoableContent(message.content);
    messages.push({ role: "assistant", content });
    finalText = content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");

    if (message.stop_reason === "pause_turn") continue;
    const toolUses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) return finalText;
    if (message.stop_reason === "max_tokens") {
      emit({ type: "error", lane, message: "Response hit max_tokens mid tool call; stopping this agent." });
      messages.pop();
      return finalText;
    }

    // Execute every tool call of this turn concurrently; reply with all results in one message.
    const results = await Promise.all(toolUses.map((tu) => executeTool(catalog, lane, tu, emit, signal, opts.registry)));
    messages.push({ role: "user", content: results });
  }
  emit({ type: "error", lane, message: `Stopped after ${MAX_TURNS} turns.` });
  return finalText;
}

/**
 * After a mid-output fallback, blocks before the last `fallback` marker other
 * than text are not echoed back (and their tool calls are never executed).
 */
function echoableContent(content: Anthropic.Beta.BetaContentBlock[]): Anthropic.Beta.BetaContentBlockParam[] {
  const lastFallback = content.map((b) => b.type).lastIndexOf("fallback");
  if (lastFallback < 0) return content as Anthropic.Beta.BetaContentBlockParam[];
  return [
    ...content.slice(0, lastFallback).filter((b) => b.type === "text"),
    ...content.slice(lastFallback + 1),
  ] as Anthropic.Beta.BetaContentBlockParam[];
}

async function executeTool(
  catalog: Catalog,
  lane: string,
  tu: Anthropic.Beta.BetaToolUseBlock,
  emit: Emit,
  signal: AbortSignal,
  registry: SourceRegistry,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const name = tu.name as ToolName;
  emit({ type: "tool_call", lane, callId: tu.id, name, input: tu.input });
  const fail = (error: string): Anthropic.Beta.BetaToolResultBlockParam => {
    emit({ type: "tool_result", lane, callId: tu.id, name, summary: error, isError: true });
    return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: error };
  };

  const schema = schemas[name];
  if (!schema) return fail(`Unknown tool '${tu.name}'`);
  // Eager input streaming means the server no longer validates inputs: do it here.
  const parsed = schema.safeParse(tu.input);
  if (!parsed.success) return fail(`Invalid input for ${name}: ${parsed.error.message}`);

  if (name === "consult_agent") {
    const { agent_id, brief } = parsed.data as { agent_id: string; brief: string };
    const agent = catalog.agentById.get(agent_id);
    if (!agent) return fail(`Unknown agent '${agent_id}'. Use find_agents to look it up.`);
    if (registry.consults >= MAX_CONSULTS) return fail(`Consult limit reached (${MAX_CONSULTS} specialists per run). Do not consult more: write the answer from the work you already have.`);
    registry.consults++;
    try {
      const text = await runSpecialist(catalog, agent, brief, tu.id, lane, emit, signal, registry);
      emit({ type: "tool_result", lane, callId: tu.id, name, summary: `${agent.name} delivered ${text.length.toLocaleString()} chars` });
      return { type: "tool_result", tool_use_id: tu.id, content: `## ${agent.name} (${agent.layer})\n\n${text.slice(0, MAX_CONSULT_CHARS)}` };
    } catch (err) {
      if (signal.aborted) throw err;
      return fail(`${agent.name} failed: ${errorMessage(err)}`);
    }
  }

  const r = runLocalTool(catalog, name, parsed.data);
  if (!r.ok) return fail(r.error);
  emit({ type: "tool_result", lane, callId: tu.id, name, summary: r.summary, data: name === "load_skill" || name === "get_template" ? undefined : r.data });
  const body = typeof r.data === "string" ? r.data : JSON.stringify(r.data);
  // Evidence is cited by key: record the result and tell the model its key.
  const src = sourceForTool(name, parsed.data);
  if (!src) return { type: "tool_result", tool_use_id: tu.id, content: body };
  const { record, isNew } = registry.add(src);
  if (isNew) emit({ type: "source", record });
  return { type: "tool_result", tool_use_id: tu.id, content: `${body}\n\n[Source key: ${record.key}] Cite this result as [${record.key}].` };
}

async function runSpecialist(
  catalog: Catalog,
  agent: AgentDef,
  brief: string,
  lane: string,
  parentLane: string,
  emit: Emit,
  signal: AbortSignal,
  registry: SourceRegistry,
): Promise<string> {
  emit({ type: "agent_start", lane, parentLane, agentId: agent.id, name: agent.name, layer: agent.layer, icon: agent.icon, brief });
  try {
    const text = await runAgentLoop({
      catalog,
      lane,
      system: specialistSystem(catalog, agent),
      messages: [{ role: "user", content: brief }],
      tools: SPECIALIST_TOOLS,
      effort: SPECIALIST_EFFORT,
      emit,
      signal,
      registry,
    });
    emit({ type: "agent_end", lane, agentId: agent.id, ok: true });
    return text;
  } catch (err) {
    emit({ type: "agent_end", lane, agentId: agent.id, ok: false });
    throw err;
  }
}

// ── Run kinds ────────────────────────────────────────────────────────────────

/**
 * Returns the conversation for a server-issued id. Ids are never chosen by the client: an unknown or missing
 * id starts a new session with a fresh random id. Idle sessions expire and the store is capped.
 */
export function getSession(id?: string): Session {
  const now = Date.now();
  for (const [key, s] of sessions) if (!s.busy && now - s.lastUsed > SESSION_TTL_MS) sessions.delete(key);
  const existing = id ? sessions.get(id) : undefined;
  if (existing) {
    existing.lastUsed = now;
    return existing;
  }
  while (sessions.size >= MAX_SESSIONS) {
    const oldest = [...sessions.values()].find((s) => !s.busy);
    if (!oldest) break;
    sessions.delete(oldest.id);
  }
  const s: Session = { id: crypto.randomUUID(), messages: [], lastUsed: now };
  sessions.set(s.id, s);
  return s;
}

export async function runLive(catalog: Catalog, input: RunInput, session: Session, emit: Emit, signal: AbortSignal) {
  const registry = new SourceRegistry(input.prompt);
  // Each attached file is client data in the source register, so the answer can cite it.
  const req: RunInput = { ...input, attachments: registerAttachments(registry, input.attachments) };
  emit({ type: "research", tier: registry.tier });
  for (const record of registry.sources) emit({ type: "source", record });
  if (req.workflowId) {
    const wf = catalog.workflowById.get(req.workflowId);
    if (!wf) throw new Error(`Unknown workflow '${req.workflowId}'`);
    await runWorkflow(catalog, wf, req, session, emit, signal, registry);
    return;
  }

  const agent = req.agentId ? catalog.agentById.get(req.agentId) : undefined;
  if (req.agentId && !agent) throw new Error(`Unknown agent '${req.agentId}'`);
  if (agent && agent.id !== "rudra") {
    session.agentId = agent.id;
    session.messages.push({ role: "user", content: withTemplate(req) });
    emit({ type: "agent_start", lane: ORCHESTRATOR_LANE, parentLane: "", agentId: agent.id, name: agent.name, layer: agent.layer, icon: agent.icon, brief: req.prompt });
    await runAgentLoop({
      catalog,
      lane: ORCHESTRATOR_LANE,
      system: specialistSystem(catalog, agent),
      messages: session.messages,
      tools: SPECIALIST_TOOLS,
      effort: SPECIALIST_EFFORT,
      emit,
      signal,
      registry,
    });
    emit({ type: "agent_end", lane: ORCHESTRATOR_LANE, agentId: agent.id, ok: true });
    return;
  }

  session.messages.push({ role: "user", content: `${withTemplate(req)}${registry.tier === "QUICK" ? "" : `\n\nResearch depth: ${registry.tier}. State it in Scope and method.`}` });
  const lead: LoopOptions = {
    catalog,
    lane: ORCHESTRATOR_LANE,
    system: orchestratorSystem(catalog),
    messages: session.messages,
    tools: ORCHESTRATOR_TOOLS,
    effort: ORCHESTRATOR_EFFORT,
    emit,
    signal,
    registry,
  };
  await reviewDraft(lead, await runAgentLoop(lead), req.prompt);
}

/**
 * The partner-review pass: when the lead agent's draft of a client deliverable falls short of the depth standard,
 * it is sent back once with the specific gaps, and the screen replaces the draft with the rewrite.
 */
async function reviewDraft(loop: LoopOptions, draft: string, prompt: string, always = false) {
  if (loop.signal.aborted || !draft.trim() || (!always && !wantsDeliverable(prompt))) return;
  const depth = assessDepth(draft);
  const evidence = evidenceGates(draft, loop.registry.sources, loop.registry.tier).filter((g) => !g.pass);
  const report = { ...depth, gaps: [...depth.gaps, ...evidence.map((g) => g.detail)] };
  if (!report.gaps.length) return;
  // A rewrite costs about two minutes, so it is kept for a draft that is too short, has fewer than two visuals, or cites sources that do not exist.
  // Smaller gaps are left to the reader's review.
  if (depth.words >= MIN_WORDS && depth.visuals >= 2 && !evidence.some((g) => g.id === "G1")) return;
  if (lateForRewrite(Date.now() - loop.registry.startedAt, runBudgetMs())) {
    loop.emit({ type: "status", lane: loop.lane, text: `Partner review: ${report.gaps.length} gap${report.gaps.length === 1 ? "" : "s"} found, but the run is near its time limit, so the draft is kept as written` });
    return;
  }
  loop.emit({ type: "status", lane: loop.lane, text: `Partner review: strengthening the draft (${report.gaps.length} gap${report.gaps.length === 1 ? "" : "s"})` });
  loop.emit({ type: "text_reset", lane: loop.lane });
  loop.messages.push({ role: "user", content: strengthenPrompt(report) });
  await runAgentLoop(loop);
}

export function intakeFor(catalog: Catalog, workflowId: string) {
  return catalog.intake[workflowId] ?? catalog.intake["default"] ?? [];
}

function intakeText(catalog: Catalog, wf: WorkflowDef, answers: Record<string, string> = {}) {
  const lines = intakeFor(catalog, wf.id)
    .filter((q) => answers[q.key])
    .map((q) => `- ${q.question} ${answers[q.key]}`);
  return lines.length ? `\n\nEngagement intake:\n${lines.join("\n")}` : "";
}

async function runWorkflow(catalog: Catalog, wf: WorkflowDef, req: RunInput, session: Session, emit: Emit, signal: AbortSignal, registry: SourceRegistry) {
  const context = withTemplate(req, `${req.prompt}${intakeText(catalog, wf, req.intake)}`);
  const outputs: { phase: string; agent: AgentDef; text: string }[] = [];

  for (const [index, phase] of wf.phases.entries()) {
    emit({ type: "phase_start", index, name: phase.name, agents: phase.agents });
    const prior = outputs.length
      ? `\n\n## Outputs from earlier phases\n${outputs.map((o) => `### ${o.phase} — ${o.agent.name}\n${o.text.slice(0, 5000)}`).join("\n\n")}`
      : "";
    const settled = await Promise.allSettled(
      phase.agents.map(async (agentId) => {
        const agent = catalog.agentById.get(agentId);
        if (!agent) throw new Error(`Agent ${agentId} missing from registry`);
        const brief = `VOLT workflow: ${wf.name} — phase ${index + 1}/${wf.phases.length}: ${phase.name}.
Workflow purpose: ${wf.description}

Client request:
${context}${prior}

Deliver your ${phase.name} contribution from the ${agent.name} perspective. Build on earlier phases rather than repeating them.`;
        const text = await runSpecialist(catalog, agent, brief, `${wf.id}:${index}:${agentId}`, ORCHESTRATOR_LANE, emit, signal, registry);
        outputs.push({ phase: phase.name, agent, text });
      }),
    );
    for (const s of settled) if (s.status === "rejected" && !signal.aborted) emit({ type: "error", lane: ORCHESTRATOR_LANE, message: errorMessage(s.reason) });
    if (signal.aborted) return;
    emit({ type: "phase_end", index, name: phase.name });
  }

  const synthesisPrompt = `You have just run the VOLT "${wf.name}" workflow for this client request:

${context}

Specialist outputs, by phase:
${outputs.map((o) => `### ${o.phase} — ${o.agent.name}\n${o.text.slice(0, 16000)}`).join("\n\n")}

Synthesise the final executive deliverable for the client: an executive summary, the integrated findings by phase, a recommendations table (recommendation, owner workstream, priority, value/risk), key risks and assumptions, and next steps. Number the sections, follow the depth and differentiation standard, and follow the evidence rules (source keys, confidence labels, and the Evidence and method section). Research depth: ${registry.tier}. Write it for the client: do not name the specialists or describe how the work was done, and where they disagreed state the position taken and why. Use the analytics tools for any figures you add.`;
  session.messages.push({ role: "user", content: synthesisPrompt });
  emit({ type: "status", lane: ORCHESTRATOR_LANE, text: "Rudra is synthesising the workflow deliverable" });
  const synthesis: LoopOptions = {
    catalog,
    lane: ORCHESTRATOR_LANE,
    system: orchestratorSystem(catalog),
    messages: session.messages,
    tools: ["find_skills", "load_skill", "apqc_benchmark", "score_maturity", "appraise_investment", "build_value_case", "list_templates", "get_template"],
    effort: ORCHESTRATOR_EFFORT,
    emit,
    signal,
    registry,
  };
  await reviewDraft(synthesis, await runAgentLoop(synthesis), req.prompt, true);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Claude API authentication failed - check ANTHROPIC_API_KEY (or run in demo mode).";
  if (err instanceof Anthropic.RateLimitError) return "Claude API rate limit reached - retry shortly.";
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
