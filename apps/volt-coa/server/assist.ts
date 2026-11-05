/**
 * Claude-assisted COA design. A manual streaming tool loop (same shape as volt-console's runAgentLoop) around the
 * VOLT coa-designer agent prompt. The assistant may only present a chart or mapping after check_coa or
 * check_mapping has passed; the server turns a passing call into a "proposal" event.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import type { AssistRequest, CoaEvent } from "../shared/events.js";
import { runTool, toolDefs } from "./tools.js";

export type Emit = (e: CoaEvent) => void;

export const MODEL = process.env.VOLT_COA_MODEL ?? "claude-opus-5-5";
const EFFORT = (process.env.VOLT_COA_EFFORT ?? "high") as "low" | "medium" | "high" | "xhigh" | "max";
const MAX_TURNS = 8;

const here = path.dirname(fileURLToPath(import.meta.url));
const pluginDir = path.resolve(process.env.VOLT_PLUGIN_DIR ?? path.join(here, "../../../plugins/volt"));

/** The coa-designer agent body from the VOLT plugin, without its YAML frontmatter. */
export function loadAgentPrompt(dir = pluginDir): string {
  const file = path.join(dir, "agents", "coa-designer.md");
  if (!fs.existsSync(file)) throw new Error(`coa-designer agent not found at ${file}; set VOLT_PLUGIN_DIR`);
  return fs.readFileSync(file, "utf8").replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

const RULES = `
## How this app works

- The user is working in a COA designer. Their current chart and legacy table (if any) are given below as CSV.
- Charts use the CSV header code,name,type,parent. Legacy tables use code,name,target (target is a new account code, RETIRE, or blank).
- Account types follow the first digit of the code: 1 asset, 2 liability, 3 equity, 4 revenue, 5-9 expense.
- Before you present any chart or mapping, call check_coa or check_mapping on the exact CSV. Fix every FAIL and call again.
  Never state that a chart or mapping passes unless the tool said so.
- Present a final chart or mapping as one fenced csv block, then a short rationale. Label assumptions.`;

let client: Anthropic | undefined;
const getClient = () => (client ??= new Anthropic());

function context(req: AssistRequest): string {
  const parts = [req.prompt];
  if (req.coaCsv?.trim()) parts.push(`Current target chart (CSV):\n${req.coaCsv.trim()}`);
  if (req.legacyCsv?.trim()) parts.push(`Current legacy table (CSV):\n${req.legacyCsv.trim()}`);
  return parts.join("\n\n");
}

export async function runAssist(req: AssistRequest, emit: Emit, signal: AbortSignal): Promise<void> {
  const system = `${loadAgentPrompt()}\n${RULES}`;
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...(req.history ?? []).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: context(req) },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const stream = getClient().beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 32000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages,
        tools: toolDefs(),
        thinking: { type: "adaptive", display: "updates" },
        output_config: { effort: EFFORT },
        betas: ["thinking-display-updates-2026-08-18"],
      },
      { signal },
    );

    let thinking = "";
    for await (const ev of stream) {
      if (ev.type === "content_block_start" && ev.content_block.type === "thinking") thinking = "";
      else if (ev.type === "content_block_delta") {
        if (ev.delta.type === "text_delta") emit({ type: "text_delta", text: ev.delta.text });
        else if (ev.delta.type === "thinking_delta") thinking += ev.delta.thinking;
      } else if (ev.type === "content_block_stop" && thinking.trim()) {
        emit({ type: "status", text: thinking.trim() });
        thinking = "";
      }
    }

    const message = await stream.finalMessage();
    emit({
      type: "usage",
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    });
    if (message.stop_reason === "refusal") { emit({ type: "error", message: "The model declined this request." }); return; }

    const content = message.content as Anthropic.Beta.BetaContentBlockParam[];
    messages.push({ role: "assistant", content });
    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason === "pause_turn") continue;
    if (toolUses.length === 0) return;
    if (message.stop_reason === "max_tokens") { emit({ type: "error", message: "Response hit max_tokens mid tool call." }); return; }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((tu) => {
      emit({ type: "tool_call", callId: tu.id, name: tu.name, input: tu.input });
      const r = runTool(tu.name, tu.input);
      emit({ type: "tool_result", callId: tu.id, name: tu.name, summary: r.summary, isError: !r.ok });
      if (r.proposal) emit({ type: "proposal", ...r.proposal });
      return { type: "tool_result", tool_use_id: tu.id, content: r.content, ...(r.ok ? {} : { is_error: true }) };
    });
    messages.push({ role: "user", content: results });
  }
  emit({ type: "error", message: `Stopped after ${MAX_TURNS} turns without a final answer.` });
}
