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
  ownerId: string | null;
  ownerName: string | null;
}

export type Role = "admin" | "consultant" | "viewer";

/** A person who signs in. Admins see everything; consultants their own and shared engagements; viewers read and download only. */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AuditEntry {
  id: number;
  at: string;
  userId: string | null;
  userName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: Record<string, unknown> | null;
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
  /** Who started the run. */
  userId: string | null;
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
