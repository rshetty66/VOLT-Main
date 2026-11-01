/**
 * CopilotKit layer for the Finance Workbench, alongside the assistant-ui panel. The copilot sees the
 * workbench state and operates the workbench through its own buttons, registered as frontend tools.
 * Confirming figures is human-in-the-loop: the copilot proposes, the person approves in the chat.
 * Loaded lazily, and only in live mode, so the CopilotKit bundle never ships to demo users.
 */
import type { RefObject } from "react";
import { z } from "zod";
import { CopilotKitProvider, CopilotPopup, ToolCallStatus, useAgentContext, useFrontendTool, useHumanInTheLoop } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import type { WorkbenchApi } from "./Workbench";

const STEP_IDS = ["sources", "events", "journal", "mapping", "crosswalk", "evidence"] as const;
const summarise = (r: { status: string; blockers: string[] }) => ({ status: r.status, failures: r.blockers.slice(0, 20) });

function Tools({ api, state }: { api: RefObject<WorkbenchApi | null>; state: Record<string, unknown> }) {
  const call = () => {
    if (!api.current) throw new Error("The workbench is not ready yet.");
    return api.current;
  };

  useAgentContext({ description: "Current Finance Workbench state (data mode, source document, figures with page and quote, proofs)", value: JSON.parse(JSON.stringify(state)) });

  useFrontendTool({
    name: "go_to_step",
    description: "Show one workbench step to the user.",
    parameters: z.object({ step: z.enum(STEP_IDS) }),
    handler: async ({ step }) => { call().goTo(step); return `Showing ${step}.`; },
  });
  useFrontendTool({
    name: "find_filings",
    description: "Search the web for an issuer's published annual report or audited financial statements. Returns candidate documents, best first.",
    parameters: z.object({ issuer: z.string().describe("Legal name, e.g. Royal Bank of Canada"), period: z.string().describe("e.g. fiscal 2025") }),
    handler: async ({ issuer, period }) => ({ candidates: await call().find(issuer, period) }),
  });
  useFrontendTool({
    name: "extract_figures",
    description: "Fetch one filing by its https URL, extract the residential-mortgage figures with page and quote, and check each against the document. Use a URL from find_filings.",
    parameters: z.object({ url: z.string().url() }),
    handler: async ({ url }) => {
      call().goTo("sources");
      return summarise(await call().extract({ url }));
    },
  });
  useFrontendTool({
    name: "check_figures",
    description: "Re-check the figures on the Sources step against the source document's page text (no model tokens).",
    handler: async () => summarise(await call().checkFigures()),
  });
  useFrontendTool({
    name: "validate_journals",
    description: "Validate the journals derived from confirmed figures with the deterministic journal validator.",
    handler: async () => { call().goTo("journal"); return summarise(await call().validate("journal")); },
  });
  useHumanInTheLoop({
    name: "confirm_figures",
    description: "Ask the user to confirm (accept as maker) specific figures. Only the user can approve; you cannot confirm on their behalf.",
    parameters: z.object({ ids: z.array(z.string()).describe("Figure ids from the workbench state"), reason: z.string() }),
    render: ({ args, status, respond, result }) => (
      <div className="aui-tool">
        <div className="micro">Confirm figures</div>
        <div className="body" style={{ fontSize: 13 }}>{args.reason}</div>
        <code style={{ fontSize: 12 }}>{(args.ids ?? []).join(", ")}</code>
        {status === ToolCallStatus.Executing && respond && (
          <div className="row">
            <button className="btn sm primary" onClick={() => { call().confirm(args.ids ?? []); respond({ confirmed: args.ids, by: "user" }); }}>I confirm these figures</button>
            <button className="btn sm ghost" onClick={() => respond({ confirmed: [], declined: true })}>Not yet</button>
          </div>
        )}
        {status === ToolCallStatus.Complete && <span className="muted" style={{ fontSize: 12 }}>{result}</span>}
      </div>
    ),
  });
  return null;
}

export default function WorkbenchCopilot({ api, state }: { api: RefObject<WorkbenchApi | null>; state: Record<string, unknown> }) {
  return (
    // No developer inspector: it is a debugging aid and fetches notifications from cdn.copilotkit.ai.
    <CopilotKitProvider runtimeUrl="/api/copilotkit" enableInspector={false}>
      <Tools api={api} state={state} />
      <CopilotPopup
        labels={{ modalHeaderTitle: "Workbench copilot (CopilotKit)", chatInputPlaceholder: "e.g. Pull RBC's fiscal 2025 mortgage figures" }}
        defaultOpen={false}
      />
    </CopilotKitProvider>
  );
}
