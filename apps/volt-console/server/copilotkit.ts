/**
 * CopilotKit runtime for the Finance Workbench: a self-hosted AG-UI endpoint whose built-in agent runs on
 * Claude. It sits alongside the assistant-ui panel. Where that panel answers questions, this agent acts on
 * the screen: the browser registers the workbench's own buttons as frontend tools (find filings, fetch and
 * extract, check figures, confirm, validate, move between steps) and shares the workbench state with it.
 *
 * Mounted only in live mode, before the JSON body parser, at /api/copilotkit. No CopilotKit Cloud account is
 * used, and telemetry is off by default (server/env.ts).
 */
import { BuiltInAgent, CopilotRuntime } from "@copilotkit/runtime/v2";
import { createCopilotExpressHandler } from "@copilotkit/runtime/v2/express";
import { MODEL } from "./orchestrator.js";

export const COPILOTKIT_PATH = "/api/copilotkit";

const PROMPT = `You are the VOLT Finance Workbench copilot for finance architects at banks.
You operate the workbench through its tools; you never invent figures. Every number must come from a client document or a published filing that the workbench has checked against its page.
Order of work: find the issuer's published statements (find_filings), fetch and extract one (extract_figures), run check_figures, show the user any failing figure with its page and quote, and only confirm figures the user has accepted (confirm_figures). Then validate the derived journals (validate_journals) and point out what is still BLOCKED and why.
If the user says real data is not available, tell them to press "Data not available: use illustrative example"; you do not switch it yourself.
Never set an approver name or sign anything off: approvals and sign-off are typed by people.
Keep answers short and cite page numbers from the workbench state.`;

export function copilotkitHandler() {
  const runtime = new CopilotRuntime({
    agents: {
      default: new BuiltInAgent({ model: `anthropic/${MODEL}`, prompt: PROMPT, maxSteps: 8, maxOutputTokens: 8000 }),
    },
  });
  return createCopilotExpressHandler({ runtime, basePath: COPILOTKIT_PATH, cors: false, activateChannels: false });
}
