import type { RunnableConfig } from "@langchain/core/runnables";
import { SystemMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
import { END, START, StateGraph } from "@langchain/langgraph";
import { convertActionsToDynamicStructuredTools, CopilotKitStateAnnotation } from "@copilotkit/sdk-js/langgraph";

// CopilotKitStateAnnotation adds `state.copilotkit` (frontend actions and the shared app context) to the graph state.
const AgentStateAnnotation = CopilotKitStateAnnotation;
type AgentState = typeof AgentStateAnnotation.State;

/** Must match the description the console registers with useAgentContext. */
const CATALOG_CONTEXT_DESCRIPTION = "VOLT Console agent catalog: the specialist agents the user can see on this page";

interface CatalogAgentContext {
  id: string;
  name: string;
  layer: string;
  description: string;
  skills: string[];
}

/** Context values arrive as JSON strings; parse before reading fields. */
function readCatalogAgents(state: AgentState): CatalogAgentContext[] {
  const item = (state.copilotkit?.context ?? []).find((c) => c.description === CATALOG_CONTEXT_DESCRIPTION);
  if (!item) return [];
  try {
    const parsed: unknown = JSON.parse(item.value);
    return Array.isArray(parsed) ? (parsed as CatalogAgentContext[]) : [];
  } catch {
    return [];
  }
}

function buildSystemPrompt(agents: CatalogAgentContext[]): string {
  const base = [
    "You are the VOLT Console copilot, a concise assistant for finance transformation work.",
    "You help the user find the VOLT specialist agent that fits a task and explain what each agent does.",
    "Answer only from the agent catalog the page shares with you below. Do not invent agents, ids, layers, or skills.",
    "When you recommend or describe one agent, call the show_agent_card tool with that agent's id, exactly as it appears in the catalog.",
  ];
  if (agents.length === 0) {
    base.push(
      "The page has sent no agent catalog, so you hold no agents to describe or recommend.",
      "Say that the page sent no agent catalog, and do not guess at agents or fill the gap from memory.",
    );
  } else {
    base.push(
      "If the user names an agent or topic that matches none of the agents below, say that the request names something the page does not hold, and list the agent names the page did send.",
      "Do not call show_agent_card for an id that is not in the catalog.",
      "",
      "Catalog shared by the page:",
      ...agents.map((a) => `- ${a.id} | ${a.name} | layer ${a.layer} | ${a.description} | skills: ${a.skills.join(", ") || "none"}`),
    );
  }
  return base.join("\n");
}

async function chatNode(state: AgentState, config: RunnableConfig) {
  const model = new ChatAnthropic({ model: process.env.VOLT_COPILOT_MODEL ?? "claude-sonnet-4-6" });
  const modelWithTools = model.bindTools!(convertActionsToDynamicStructuredTools(state.copilotkit?.actions ?? []));
  const response = await modelWithTools.invoke(
    [new SystemMessage({ content: buildSystemPrompt(readCatalogAgents(state)) }), ...state.messages],
    config,
  );
  return { messages: response };
}

// No checkpointer: the LangGraph API server supplies persistence at run time.
export const graph = new StateGraph(AgentStateAnnotation)
  .addNode("chat_node", chatNode)
  .addEdge(START, "chat_node")
  .addEdge("chat_node", END)
  .compile();
