/**
 * AnimationChart (animationchart.com) as an opt-in MCP server for the lead agent: animated diagrams and charts
 * that open in the AnimationChart editor.
 *
 * On only when ANIMATIONCHART_API_KEY is set (a key from AnimationChart: Profile, Connect AI, Create key) and the
 * request asks for an animated chart or diagram. Claude's MCP connector calls the server from Anthropic's side,
 * so the key travels in the API request and never reaches the browser. When it is off, or the server fails,
 * the agent draws VOLT's own ```chart and ```mermaid blocks instead.
 *
 * Data leaves VOLT for a third party here: AnimationChart stores the diagrams in its own cloud. The guide below
 * keeps client names and identifiers out of what is sent.
 */
import type Anthropic from "@anthropic-ai/sdk";

export const ANIMATIONCHART_URL = "https://app.animationchart.com/mcp";
export const ANIMATIONCHART_SERVER = "animationchart";
export const MCP_BETA = "mcp-client-2025-11-20" as Anthropic.Beta.AnthropicBeta;

const key = () => process.env.ANIMATIONCHART_API_KEY?.trim() ?? "";
export const animationChartEnabled = () => key().length > 0;

/** True when the request asks for motion: an animated chart or diagram, or AnimationChart by name. */
export function asksForAnimation(prompt: string): boolean {
  return /\banimat(e|ed|ion|ions|ing)\b|animationchart/i.test(prompt);
}

export const ANIMATION_GUIDE = `AnimationChart is on for this request: its MCP tools make animated charts and diagrams.
- Use it for the animated chart or diagram the user asked for. Build it from a template or as a new animated diagram, then get its editor link.
- Give the user the editor link exactly as the tool returned it. Never type or guess a link.
- AnimationChart is an outside service that stores what you send. Send only the labels and figures the chart needs: no client or person names, account or customer numbers, or other identifiers. Use generic labels such as "Bank A" or "Segment 1".
- If an AnimationChart tool fails, say so in one line and draw the chart as a VOLT \`\`\`chart or \`\`\`mermaid block instead.`;

/** The request fields that add the AnimationChart server and its tools. */
export function animationChartParams(): { mcp_servers: Anthropic.Beta.BetaRequestMCPServerURLDefinition[]; tools: Anthropic.Beta.BetaToolUnion[] } {
  return {
    mcp_servers: [{ type: "url", url: ANIMATIONCHART_URL, name: ANIMATIONCHART_SERVER, authorization_token: key() }],
    tools: [{ type: "mcp_toolset", mcp_server_name: ANIMATIONCHART_SERVER } as Anthropic.Beta.BetaToolUnion],
  };
}

const MCP_TYPES = new Set(["mcp_tool_use", "mcp_tool_result", "mcp_tool_listing"]);

function asText(b: { type: string; name?: string; content?: unknown }): Anthropic.Beta.BetaTextBlockParam | null {
  if (b.type === "mcp_tool_use") return { type: "text", text: `(Called AnimationChart ${b.name ?? "tool"}.)` };
  if (b.type === "mcp_tool_result") {
    const c = b.content;
    const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((x: { text?: string }) => x.text ?? "").join("\n") : "";
    return { type: "text", text: `(AnimationChart result: ${text.slice(0, 2000)})` };
  }
  return null;
}

/**
 * Replaces AnimationChart blocks in the history with short text notes, in place. A request without the MCP server
 * (a later turn that does not ask for animation, or the fallback after the server failed) is refused by the API
 * if the history still holds them. Returns true if anything changed.
 */
export function stripMcpBlocks(messages: Anthropic.Beta.BetaMessageParam[]): boolean {
  let changed = false;
  for (const m of messages) {
    if (typeof m.content === "string" || !m.content.some((b) => MCP_TYPES.has(b.type))) continue;
    const kept = m.content.flatMap((b) => (MCP_TYPES.has(b.type) ? (asText(b as never) ?? []) : [b]));
    m.content = kept.length ? (kept as typeof m.content) : [{ type: "text", text: "(AnimationChart)" }];
    changed = true;
  }
  return changed;
}
