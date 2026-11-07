/** Wire types shared by the API and the UI. */
export type RunMode = "live" | "demo";

export interface AssistRequest {
  prompt: string;
  /** Earlier turns of this conversation, text only. */
  history?: { role: "user" | "assistant"; content: string }[];
  /** The user's current chart and legacy table, as CSV, so the assistant works on what is on screen. */
  coaCsv?: string;
  legacyCsv?: string;
}

export type CoaEvent =
  | { type: "status"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; callId: string; name: string; input: unknown }
  | { type: "tool_result"; callId: string; name: string; summary: string; isError?: boolean }
  /** A chart or legacy table the assistant produced that passed every check. The UI offers to load it. */
  | { type: "proposal"; kind: "coa" | "legacy"; csv: string }
  | { type: "usage"; inputTokens: number; outputTokens: number; cacheReadTokens: number }
  | { type: "error"; message: string }
  | { type: "done" };

export interface Health { ok: boolean; mode: RunMode; model: string }
