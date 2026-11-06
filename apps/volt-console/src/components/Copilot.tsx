import { createContext, useContext, useMemo } from "react";
import { z } from "zod";
import { CopilotChat, CopilotThreadsDrawer, useAgentContext, useComponent } from "@copilotkit/react-core/v2";
import type { CatalogAgent, CatalogResponse } from "../../shared/events";

/** Must match CATALOG_CONTEXT_DESCRIPTION in agent/src/agent.ts. */
const CATALOG_CONTEXT_DESCRIPTION = "VOLT Console agent catalog: the specialist agents the user can see on this page";

const AgentsById = createContext<Map<string, CatalogAgent>>(new Map());

/**
 * Rendered in the chat when the copilot calls show_agent_card. The model sends only the agent id; every field
 * shown comes from the catalog this page already holds, so an unknown id renders as missing, never as a made-up record.
 */
function AgentCard({ agentId }: { agentId: string }) {
  const agent = useContext(AgentsById).get(agentId);
  if (!agent) {
    return <div className="agent-card missing">No agent with id "{agentId}" is in the catalog this page holds.</div>;
  }
  return (
    <div className="agent-card" style={{ borderLeftColor: agent.color }}>
      <div className="agent-card-head">
        <b>{agent.name}</b>
        <span className="agent-card-layer">{agent.layer}</span>
      </div>
      <div className="agent-card-id">{agent.id}</div>
      <p>{agent.description}</p>
      <div className="agent-card-skills">{agent.skills.length ? `Skills: ${agent.skills.join(", ")}` : "No skills listed"}</div>
    </div>
  );
}

const agentCardProps = z.object({ agentId: z.string().describe("The id of a catalog agent, exactly as shared in the page context") });

export function Copilot({ catalog }: { catalog: CatalogResponse }) {
  const byId = useMemo(() => new Map(catalog.agents.map((a) => [a.id, a])), [catalog.agents]);

  // The agent only sees what is shared here; a rendered list in the DOM is not visible to it.
  useAgentContext({
    description: CATALOG_CONTEXT_DESCRIPTION,
    value: catalog.agents.map((a) => ({ id: a.id, name: a.name, layer: a.layer, description: a.description, skills: a.skills })),
  });

  useComponent({
    name: "show_agent_card",
    description: "Show a card for one VOLT specialist agent from the catalog shared in the page context.",
    parameters: agentCardProps,
    render: AgentCard,
  });

  return (
    <AgentsById.Provider value={byId}>
      <div className="copilot-surface dark">
        <CopilotThreadsDrawer />
        <div className="copilot-chat">
          <CopilotChat />
        </div>
      </div>
    </AgentsById.Provider>
  );
}
