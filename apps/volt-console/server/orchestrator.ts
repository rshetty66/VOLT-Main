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
import { assessDepth, leadDeliverableGuide, MIN_WORDS, specialistDeliverableGuide, strengthenPrompt, QUICK_GUIDE, quickAsk, wantsDeliverable } from "./deliverable.js";
import { SourceRegistry, WEB_RESEARCH_GUIDE, registerWebBlock, sourceForTool, webCitationKeys } from "./research.js";
import { evidenceGates } from "../shared/research.js";
import { GOAL_GUIDE, PLAN_TOOL, goalToolDefs, planGoal } from "./goals.js";
import { KNOWLEDGE_TOOL, knowledgeNote, knowledgeToolDef, runKnowledgeTool } from "./knowledge.js";
import { memoryBlock } from "./memory.js";
import { listUploads } from "./uploads.js";
import { LEDGER_GUIDE, checkLedgerFigures, isLedgerTool, ledgerEnabled, ledgerToolDefs, runLedgerTool } from "./ledger.js";
import { CONSULTED_TOOLS, ORCHESTRATOR_TOOLS, QUICK_TOOLS, SPECIALIST_TOOLS, type ToolName, runLocalTool, schemas, toolDefs } from "./tools.js";
import { ORCHESTRATOR_LANE, type RunRequest, type VoltEvent } from "../shared/events.js";
import { scopeBrief } from "../shared/scope.js";
import { estimateCost, higher, highStakes, modelFor, routingEnabled, ruleRoute, tierForStep, tierName, triage, type Route, type Tier } from "./router.js";

export type Emit = (e: VoltEvent) => void;

/** A run request after the server has resolved its template. */
export interface RunInput extends RunRequest {
  template?: { id: string; name: string; guide: string };
}

/** The user's request, with its attached files, the chat's scope answers and the selected template's formatting guide. */
export function withTemplate(req: RunInput, text = req.prompt): string {
  const scope = req.scope ? scopeBrief(req.scope) : "";
  const files = `${attachmentsBlock(req.attachments)}${scope ? `\n\n${scope}` : ""}${memoryBlock(req.projectId)}${knowledgeNote(req.projectId)}`;
  if (!req.template) return `${text}${files}`;
  return `${text}${files}

---
Formatting template: "${req.template.name}" (template id ${req.template.id}). Any deliverable you write or specify must follow this formatting guide.

${req.template.guide}`;
}
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** The Opus-tier model: the lead on client deliverables, and every step when VOLT_ROUTING=off (see router.ts). */
export const MODEL = modelFor("opus");
const ORCHESTRATOR_EFFORT = (process.env.VOLT_ORCHESTRATOR_EFFORT ?? "medium") as Effort;
const SPECIALIST_EFFORT = (process.env.VOLT_SPECIALIST_EFFORT ?? "medium") as Effort;
/**
 * Claude's own web_search and web_fetch, opt-in (VOLT_WEB_RESEARCH=on): sources then come from real pages.
 * Cost: each search is billed (USD 10 per 1,000) on top of tokens; a fetch costs only the tokens of the page it reads.
 */
const WEB_RESEARCH = (process.env.VOLT_WEB_RESEARCH ?? "off") === "on";
/** Searches one run may make across all its agents before the agents are told to stop searching. A soft cap: a model turn already under way can overshoot it by a few. */
export const MAX_WEB_SEARCHES = Number(process.env.VOLT_WEB_MAX_SEARCHES) > 0 ? Number(process.env.VOLT_WEB_MAX_SEARCHES) : 20;
const WEB_TOOLS = [
  { type: "web_search_20260209", name: "web_search", max_uses: 5 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5, citations: { enabled: true }, max_content_tokens: 20000 },
] as unknown as Anthropic.Beta.BetaTool[];
const USE_FALLBACKS = (process.env.VOLT_FALLBACKS ?? "on") !== "off";
/** Model turns per agent. A full chart-of-accounts run (load, map, diagnose, design, check, propose, map, report) needs more than a chat answer. */
const MAX_TURNS = Number(process.env.VOLT_MAX_TURNS) > 0 ? Number(process.env.VOLT_MAX_TURNS) : 40;
const MAX_CONSULT_CHARS = 24_000;
/** Specialists a single run may consult. Each one is a full model run, so this bounds the time and the cost. */
export const MAX_CONSULTS = Number(process.env.VOLT_MAX_CONSULTS) > 0 ? Number(process.env.VOLT_MAX_CONSULTS) : 6;

interface Session {
  id: string;
  /** Conversation with the lead agent (Rudra, or the directly-addressed agent). */
  messages: Anthropic.Beta.BetaMessageParam[];
  agentId?: string;
  /** The lead's model tier so far: follow-ups only move up, so the conversation keeps its cache and reasoning. */
  leadTier?: Tier;
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
${ledgerEnabled() ? `\n${GOAL_GUIDE}\n\n${LEDGER_GUIDE}\n` : ""}
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
  /** The model this agent runs on, chosen by the router. */
  model: string;
  effort: Effort;
  emit: Emit;
  signal: AbortSignal;
  /** The run's source register: tool results are recorded in it and cited by key. */
  registry: SourceRegistry;
  /** Offer the VOLT Ledger tools (lead only, and only when the ledger service is configured). */
  ledger?: boolean;
  /** The tier for specialists this agent consults (Opus for high-stakes finance work or the Opus switch). */
  specialistTier?: Tier;
}

/**
 * Runs one agent to completion. Mutates `messages` (appending every assistant
 * turn and tool result) and returns the agent's final text.
 */
async function runAgentLoop(opts: LoopOptions): Promise<string> {
  const { catalog, lane, emit, signal, messages } = opts;
  // Haiku has neither progress-update thinking nor server-side fallbacks.
  const haiku = opts.model.includes("haiku");
  const fallbacks = USE_FALLBACKS && !haiku;
  const betas: Anthropic.Beta.AnthropicBeta[] = haiku ? [] : ["thinking-display-updates-2026-08-18"];
  if (fallbacks) betas.push("server-side-fallback-2026-07-01");
  let finalText = "";
  let jsonRetries = 0;

  for (let turn = 0; turn <= MAX_TURNS; turn++) {
    // The last turn has no tools: the agent writes its answer from what it has instead of stopping mid-way.
    const wrapUp = turn === MAX_TURNS;
    if (wrapUp) emit({ type: "status", lane, text: `Reached ${MAX_TURNS} turns; writing the answer from the results so far` });
    const stream = getClient().beta.messages.stream(
      {
        model: opts.model,
        max_tokens: 64000,
        system: [{ type: "text", text: WEB_RESEARCH ? `${opts.system}\n\n${WEB_RESEARCH_GUIDE}` : opts.system, cache_control: { type: "ephemeral" } }],
        messages,
        tools: [...toolDefs(opts.tools), ...(opts.registry.knowledgeProject ? [knowledgeToolDef()] : []), ...(opts.ledger && ledgerEnabled() ? [...goalToolDefs(), ...ledgerToolDefs()] : []), ...(WEB_RESEARCH ? WEB_TOOLS : [])],
        ...(wrapUp ? { tool_choice: { type: "none" as const } } : {}),
        thinking: haiku ? { type: "adaptive" } : { type: "adaptive", display: "updates" },
        output_config: { effort: opts.effort },
        betas,
        ...(fallbacks ? { fallbacks: "default" as const } : {}),
      },
      { signal },
    );

    let thinkingBuf = "";
    // Web citations on the text block being streamed, and the source keys added after each cited block (by block index).
    let citations: unknown[] = [];
    const keySuffix = new Map<number, string>();
    for await (const ev of stream) {
      if (ev.type === "content_block_start") {
        if (ev.content_block.type === "thinking") thinkingBuf = "";
        if (ev.content_block.type === "text") citations = [];
        if (ev.content_block.type === "fallback") {
          emit({ type: "fallback", lane, from: ev.content_block.from.model, to: ev.content_block.to.model });
        }
        // Search and fetch results arrive whole: record their pages before the text that cites them streams.
        if (WEB_RESEARCH) for (const record of registerWebBlock(ev.content_block, opts.registry)) emit({ type: "source", record });
      } else if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") emit({ type: "text_delta", lane, text: ev.delta.text });
        else if (ev.delta.type === "thinking_delta") thinkingBuf += ev.delta.thinking;
        else if (ev.delta.type === "citations_delta") citations.push(ev.delta.citation);
      } else if (ev.type === "content_block_stop") {
        if (thinkingBuf.trim()) {
          // With display "updates", non-empty thinking blocks are short progress notes.
          emit({ type: "status", lane, text: thinkingBuf.trim() });
          thinkingBuf = "";
        }
        if (citations.length) {
          const keys = webCitationKeys(citations, opts.registry);
          if (keys.length) {
            const suffix = ` ${keys.map((k) => `[${k}]`).join(" ")}`;
            keySuffix.set(ev.index, suffix);
            emit({ type: "text_delta", lane, text: suffix });
          }
          citations = [];
        }
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

    // message.model is the model that served the turn (a fallback can change it).
    const counts = {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    };
    const served = message.model || opts.model;
    emit({ type: "usage", lane, ...counts, model: served, costUsd: estimateCost(served, counts) });

    if (message.stop_reason === "refusal") {
      emit({ type: "error", lane, message: "The model declined this request." });
      return finalText;
    }

    let searchCapNote = "";
    if (WEB_RESEARCH) {
      const before = opts.registry.webSearches;
      opts.registry.webSearches += message.usage.server_tool_use?.web_search_requests ?? 0;
      if (before < MAX_WEB_SEARCHES && opts.registry.webSearches >= MAX_WEB_SEARCHES) {
        emit({ type: "status", lane, text: `Web research: ${opts.registry.webSearches} searches, the cap for this run; the agents stop searching now` });
        searchCapNote = `The web search budget for this run (${MAX_WEB_SEARCHES} searches) is spent. Do not call web_search again; work from the pages already retrieved.`;
      }
    }

    // The history keeps the API's blocks unchanged; only the answer text carries the source keys added for web citations.
    const content = echoableContent(message.content);
    messages.push({ role: "assistant", content });
    finalText = message.content.map((b, i) => (b.type === "text" ? b.text + (keySuffix.get(i) ?? "") : "")).join("");

    if (message.stop_reason === "pause_turn") continue;
    const toolUses = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) return finalText;
    if (message.stop_reason === "max_tokens") {
      emit({ type: "error", lane, message: "Response hit max_tokens mid tool call; stopping this agent." });
      messages.pop();
      return finalText;
    }

    // Execute every tool call of this turn concurrently; reply with all results in one message.
    const results = await Promise.all(toolUses.map((tu) => executeTool(catalog, lane, tu, emit, signal, opts.registry, opts.specialistTier)));
    messages.push({ role: "user", content: searchCapNote ? [...results, { type: "text", text: searchCapNote }] : results });
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
  specialistTier?: Tier,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  const name = tu.name as ToolName;
  emit({ type: "tool_call", lane, callId: tu.id, name, input: tu.input });
  const fail = (error: string): Anthropic.Beta.BetaToolResultBlockParam => {
    emit({ type: "tool_result", lane, callId: tu.id, name, summary: error, isError: true });
    return { type: "tool_result", tool_use_id: tu.id, is_error: true, content: error };
  };

  if (tu.name === PLAN_TOOL) {
    if (lane !== ORCHESTRATOR_LANE || !ledgerEnabled()) return fail(`Unknown tool '${tu.name}'`);
    const r = planGoal(tu.input);
    if (!r.ok) return fail(r.error);
    const { goals, ask, next } = r.plan;
    emit({ type: "tool_result", lane, callId: tu.id, name, summary: `${goals.map((g) => g.goal).join(" + ")}: ${next === "ask" ? `${ask.length} input(s) to ask for` : "ready to run"}` });
    return { type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(r.plan) };
  }

  if (tu.name === KNOWLEDGE_TOOL) {
    if (!registry.knowledgeProject) return fail(`Unknown tool '${tu.name}'`);
    const r = runKnowledgeTool(registry.knowledgeProject, tu.input, registry);
    if (!r.ok) return fail(r.error);
    for (const record of r.added) emit({ type: "source", record });
    emit({ type: "tool_result", lane, callId: tu.id, name, summary: r.summary });
    return { type: "tool_result", tool_use_id: tu.id, content: r.reply };
  }

  if (isLedgerTool(tu.name)) {
    // Ledger tools are offered to the lead only; a specialist naming one is refused.
    if (lane !== ORCHESTRATOR_LANE) return fail(`Unknown tool '${tu.name}'`);
    const r = await runLedgerTool(tu.name, tu.input, registry, signal);
    if (!r.ok) return fail(r.error);
    if (r.newSource) emit({ type: "source", record: r.newSource });
    emit({ type: "tool_result", lane, callId: tu.id, name, summary: r.summary, data: r.envelope.display });
    return { type: "tool_result", tool_use_id: tu.id, is_error: r.envelope.status !== "ok", content: r.content };
  }

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
      const text = await runSpecialist(catalog, agent, brief, tu.id, lane, emit, signal, registry, specialistTier);
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
  const body = r.reply ?? (typeof r.data === "string" ? r.data : JSON.stringify(r.data));
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
  tier: Tier = tierForStep("specialist"),
): Promise<string> {
  emit({ type: "agent_start", lane, parentLane, agentId: agent.id, name: agent.name, layer: agent.layer, icon: agent.icon, brief });
  try {
    const text = await runAgentLoop({
      catalog,
      lane,
      system: specialistSystem(catalog, agent),
      messages: [{ role: "user", content: brief }],
      tools: CONSULTED_TOOLS,
      // A brief in high-stakes finance work runs on Opus even when the lead's run was routed lower.
      model: modelFor(highStakes(brief) ? "opus" : tier),
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
  if (input.projectId && listUploads(input.projectId).length) registry.knowledgeProject = input.projectId;
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
      model: modelFor(req.opus || highStakes(req.prompt) ? "opus" : tierForStep("direct_agent")),
      effort: SPECIALIST_EFFORT,
      emit,
      signal,
      registry,
    });
    emit({ type: "agent_end", lane: ORCHESTRATOR_LANE, agentId: agent.id, ok: true });
    return;
  }

  // A file or a calculation from given figures: Rudra answers alone, without the specialist bench or the partner rewrite.
  const quick = quickAsk(req.prompt);
  if (quick) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: "Quick request: building it directly with the VOLT analytics tools" });
  const leadTier = await routeLead(req, quick, session, emit, signal);
  session.messages.push({ role: "user", content: `${withTemplate(req)}${quick ? `\n\n${QUICK_GUIDE}` : registry.tier === "QUICK" ? "" : `\n\nResearch depth: ${registry.tier}. State it in Scope and method.`}` });
  const lead: LoopOptions = {
    catalog,
    lane: ORCHESTRATOR_LANE,
    system: orchestratorSystem(catalog),
    messages: session.messages,
    tools: quick ? QUICK_TOOLS : ORCHESTRATOR_TOOLS,
    model: modelFor(leadTier),
    effort: ORCHESTRATOR_EFFORT,
    emit,
    signal,
    registry,
    ledger: true,
    specialistTier: req.opus || highStakes(req.prompt) ? "opus" : tierForStep("specialist"),
  };
  const draft = await runAgentLoop(lead);
  // A quick ask still gets the ledger check, but not the full-deliverable depth review.
  if (quick) await reviewDraft(lead, draft, "");
  else await reviewDraft(lead, draft, req.prompt);
}

/**
 * Chooses the lead's model. A quick file or calculation goes to Sonnet without triage; anything else is classified
 * by one Haiku call (the code rule if that fails). A conversation's lead never moves down a tier.
 */
async function routeLead(req: RunInput, quick: boolean, session: Session, emit: Emit, signal: AbortSignal): Promise<Tier> {
  if (!routingEnabled()) return "opus";
  const prompt = req.prompt;
  // The Opus switch and high-stakes finance work skip triage: they always run on Opus.
  const forced: Route | null = req.opus
    ? { tier: "opus", reason: "the Opus switch is on", by: "rule" }
    : highStakes(prompt)
      ? { tier: "opus", reason: "high-stakes finance work (CoA, GAAP, business case or consolidation)", by: "rule" }
      : quick
        ? { tier: tierForStep("quick"), reason: "a quick file or calculation", by: "rule" }
        : null;
  const { route, usage } = forced ? { route: forced, usage: undefined } : await triage(prompt, ruleRoute(wantsDeliverable(prompt)), signal);
  if (usage) {
    const counts = { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cacheReadTokens: 0 };
    emit({ type: "usage", lane: ORCHESTRATOR_LANE, ...counts, model: usage.model, costUsd: estimateCost(usage.model, counts) });
  }
  const tier = higher(session.leadTier, route.tier);
  session.leadTier = tier;
  const kept = tier !== route.tier ? `; kept on ${tierName(tier)} for this conversation` : "";
  const how = route.by === "triage" ? "Haiku triage" : "routing rule";
  const specialists = req.opus || highStakes(prompt) ? "Opus" : `${tierName(tierForStep("specialist"))} (Opus for high-stakes finance briefs)`;
  emit({ type: "status", lane: ORCHESTRATOR_LANE, text: `Model: ${tierName(route.tier)} for the lead (${how}: ${route.reason})${kept}. Specialists run on ${specialists}.` });
  return tier;
}

/**
 * The partner-review pass: when the lead agent's draft of a client deliverable falls short of the depth standard,
 * it is sent back once with the specific gaps, and the screen replaces the draft with the rewrite.
 */
async function reviewDraft(loop: LoopOptions, draft: string, prompt: string, always = false) {
  if (loop.signal.aborted || !draft.trim()) return;
  // G7: a figure in a sentence that cites a VOLT Ledger result must appear in that result's evidence.
  const ledger = loop.ledger ? await checkLedgerFigures(draft, loop.registry, loop.signal) : null;
  const ledgerGap = ledger?.unsupported.length
    ? `${ledger.unsupported.length} figure${ledger.unsupported.length === 1 ? "" : "s"} in sentences citing VOLT Ledger results do not appear in those results (${ledger.unsupported.slice(0, 8).join(", ")}). Quote ledger figures exactly as the display values, or call the ledger tool that computes them; never calculate or round them yourself`
    : null;
  if (ledger) loop.emit({ type: "status", lane: loop.lane, text: ledgerGap ? `Ledger check: ${ledger.unsupported.length} unsupported figure${ledger.unsupported.length === 1 ? "" : "s"} sent back for correction` : `Ledger check: every figure in ${ledger.sentences} ledger-cited sentence${ledger.sentences === 1 ? "" : "s"} traces to its evidence` });
  const deliverable = always || wantsDeliverable(prompt);
  if (!deliverable && !ledgerGap) return;
  const depth = assessDepth(draft);
  const evidence = deliverable ? evidenceGates(draft, loop.registry.sources, loop.registry.tier).filter((g) => !g.pass) : [];
  const report = deliverable
    ? { ...depth, gaps: [...depth.gaps, ...evidence.map((g) => g.detail), ...(ledgerGap ? [ledgerGap] : [])] }
    : { ...depth, gaps: [ledgerGap as string] };
  if (!report.gaps.length) return;
  // A file the user asked for is already built from this draft; a rewrite would replace the chat answer but not the file,
  // and costs minutes more.
  if (!ledgerGap && madeFile(loop.messages)) return;
  // A rewrite costs about two minutes, so it is kept for a draft that is too short, has fewer than two visuals, cites sources that do not exist,
  // or misquotes a ledger figure. Smaller gaps are left to the reader's review.
  if (!ledgerGap && depth.words >= MIN_WORDS && depth.visuals >= 2 && !evidence.some((g) => g.id === "G1")) return;
  if (lateForRewrite(Date.now() - loop.registry.startedAt, runBudgetMs())) {
    loop.emit({ type: "status", lane: loop.lane, text: `Partner review: ${report.gaps.length} gap${report.gaps.length === 1 ? "" : "s"} found, but the run is near its time limit, so the draft is kept as written` });
    return;
  }
  loop.emit({ type: "status", lane: loop.lane, text: `Partner review: strengthening the draft (${report.gaps.length} gap${report.gaps.length === 1 ? "" : "s"})` });
  loop.emit({ type: "text_reset", lane: loop.lane });
  loop.messages.push({
    role: "user",
    content: deliverable ? strengthenPrompt(report) : `Ledger check: ${ledgerGap}. Rewrite your answer in full with those figures corrected, and return only the corrected answer.`,
  });
  await runAgentLoop(loop);
}

/** True when the lead agent called create_file in this conversation turn (since the last user message with text). */
export function madeFile(messages: Anthropic.Beta.BetaMessageParam[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user" && (typeof m.content === "string" || m.content.some((b) => b.type === "text"))) return false;
    if (m.role === "assistant" && Array.isArray(m.content) && m.content.some((b) => b.type === "tool_use" && b.name === "create_file")) return true;
  }
  return false;
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
  const phaseTier: Tier = req.opus || highStakes(context) ? "opus" : tierForStep("workflow_phase");
  if (routingEnabled()) emit({ type: "status", lane: ORCHESTRATOR_LANE, text: `Model: ${tierName(phaseTier)} for each phase, ${tierName(tierForStep("synthesis"))} for the synthesis.` });

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
        const text = await runSpecialist(catalog, agent, brief, `${wf.id}:${index}:${agentId}`, ORCHESTRATOR_LANE, emit, signal, registry, phaseTier);
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
  session.leadTier = higher(session.leadTier, tierForStep("synthesis"));
  const synthesis: LoopOptions = {
    catalog,
    lane: ORCHESTRATOR_LANE,
    system: orchestratorSystem(catalog),
    messages: session.messages,
    tools: ["find_skills", "load_skill", "apqc_benchmark", "score_maturity", "appraise_investment", "build_value_case", "list_templates", "get_template"],
    model: modelFor(session.leadTier),
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
