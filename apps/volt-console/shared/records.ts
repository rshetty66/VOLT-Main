/** Saved engagements and runs, as the API returns them. */
import type { RunKind, RunMode, VoltEvent } from "./events";

export interface Engagement {
  id: string;
  clientName: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  runCount: number;
  lastRunAt: string | null;
  /** The engagement's output template; null means the application standard. */
  templateId: string | null;
  templateName: string | null;
}

/** An output template (brand profile). The built-in standard has id "standard" and cannot be changed. */
export interface Template {
  id: string;
  builtIn: boolean;
  name: string;
  description: string;
  organisation: string;
  primaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  footerText: string;
  confidentiality: string;
  hasLogo: boolean;
  engagementCount: number;
  updatedAt: string | null;
}

export type RunStatus = "running" | "done" | "error" | "stopped";

export interface RunSummary {
  id: string;
  engagementId: string | null;
  sessionId: string;
  kind: RunKind;
  title: string;
  prompt: string;
  workflowId: string | null;
  agentId: string | null;
  mode: RunMode;
  model: string;
  status: RunStatus;
  error: string | null;
  inputTokens: number;
  outputTokens: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface StoredRun extends RunSummary {
  intake: Record<string, string> | null;
  finalText: string;
  events: VoltEvent[];
}
