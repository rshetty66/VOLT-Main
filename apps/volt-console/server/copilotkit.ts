/**
 * CopilotKit Runtime for the VOLT Console chat, run as its own process beside the React dev server.
 *
 *   npm run dev:copilot     http://localhost:8200/api/copilotkit
 *
 * It connects the console to the LangGraph TypeScript agent in ../agent (npm run dev:agent) and to CopilotKit
 * Intelligence for persistent threads. The Express API in server/index.ts is not involved.
 */
// Must stay the first import: loads apps/volt-console/.env (CPK_INTELLIGENCE_API_KEY) before anything reads it.
import "./env.js";
import { createServer } from "node:http";
import { CopilotKitIntelligence, CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotNodeListener } from "@copilotkit/runtime/v2/node";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";

const PORT = Number(process.env.COPILOT_RUNTIME_PORT ?? 8200);
const AGENT_ID = "volt_console_agent";

const intelligence = new CopilotKitIntelligence({
  apiKey: process.env.CPK_INTELLIGENCE_API_KEY!,
  // One Learning Container for every run.
  getLearningContainerId: () => "volt-main",
});

const runtime = new CopilotRuntime({
  agents: {
    [AGENT_ID]: new LangGraphAgent({
      deploymentUrl: process.env.LANGGRAPH_DEPLOYMENT_URL || "http://localhost:8123",
      graphId: AGENT_ID,
      langsmithApiKey: process.env.LANGSMITH_API_KEY || "",
    }),
  },
  intelligence,
  // LOCAL DEVELOPMENT PLACEHOLDER: the console has no sign-in, so every browser shares one fixed user.
  // Production must return the user from a verified session or token, reject requests without one, and
  // enforce thread ownership on threads/events, threads/state and agent/stop.
  identifyUser: () => ({ id: "volt-console-local-user", name: "VOLT Console (local)" }),
});

createServer(
  createCopilotNodeListener({
    runtime,
    basePath: "/api/copilotkit",
    // The SPA (port 5173) and this runtime (port 8200) are different origins.
    cors: true,
  }),
).listen(PORT, () => {
  console.log(`Copilot Runtime listening at http://localhost:${PORT}/api/copilotkit`);
});
