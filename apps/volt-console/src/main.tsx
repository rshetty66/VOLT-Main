import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CopilotKitProvider, CopilotChatConfigurationProvider } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { App } from "./App";
import "./styles.css";

// The CopilotKit runtime is a separate process (server/copilotkit.ts), so the URL must be absolute.
const runtimeUrl = import.meta.env.VITE_COPILOT_RUNTIME_URL ?? "http://localhost:8200/api/copilotkit";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CopilotKitProvider runtimeUrl={runtimeUrl} agentId="volt_console_agent" useSingleEndpoint={false}>
      <CopilotChatConfigurationProvider>
        <App />
      </CopilotChatConfigurationProvider>
    </CopilotKitProvider>
  </StrictMode>,
);
