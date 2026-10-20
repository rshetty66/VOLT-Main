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
  /** Estimated USD cost of all its runs. */
  costUsd: number;
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
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Estimated USD cost from the price table. */
  costUsd: number;
  startedAt: string;
  finishedAt: string | null;
}

export interface StoredRun extends RunSummary {
  intake: Record<string, string> | null;
  finalText: string;
  events: VoltEvent[];
}

// ── Cost control (A2) ────────────────────────────────────────────────────────

/** USD per million tokens. */
export interface Rates {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

export interface Price extends Rates {
  /** A model priced higher above a prompt size (all input, including cache): the size, and the rates there. */
  longAbove?: number;
  long?: Rates;
}

export interface CostSettings {
  /** USD per million tokens, by model id. */
  prices: Record<string, Price>;
  /** Stop a run once its estimated cost reaches this; 0 means no limit. */
  runBudgetUsd: number;
  /** Default monthly limit per person (a person can have their own); 0 means no limit. */
  monthlyBudgetUsd: number;
  /** Share of a budget at which the run shows a warning, 0.5 to 0.99. */
  warnAt: number;
  /** Model for specialists; the lead agent (Rudra or the chosen agent) always uses the console model. */
  specialistModel: string;
  /** Cap on each specialist's model calls; the last call is asked to answer without more tools. */
  specialistMaxSteps: number;
}

export interface BudgetStatus {
  runBudgetUsd: number;
  /** This person's monthly limit (their own, or the default); 0 means no limit. */
  monthlyBudgetUsd: number;
  monthSpentUsd: number;
  /** Null when there is no monthly limit. */
  monthRemainingUsd: number | null;
  warnAt: number;
}

export interface Estimate {
  usd: number;
  low: number;
  high: number;
  /** "history": median of recent finished runs of the same kind; "rough": from typical token counts. */
  basis: "history" | "rough";
  runs: number;
}

export interface UsageSummary {
  month: string;
  scope: "everyone" | "you";
  monthTotalUsd: number;
  monthRuns: number;
  budget: BudgetStatus;
  byPerson: { userId: string; name: string; email: string; disabled: boolean; spentUsd: number; runs: number; budgetUsd: number; ownBudget: boolean }[];
  byEngagement: { engagementId: string | null; clientName: string; title: string; spentUsd: number; runs: number }[];
  byMonth: { month: string; usd: number; runs: number }[];
  topRuns: {
    id: string;
    title: string;
    engagementId: string | null;
    clientName: string | null;
    userName: string | null;
    startedAt: string;
    status: string;
    costUsd: number;
    inputTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    outputTokens: number;
  }[];
}

// ── Client files (A3) ────────────────────────────────────────────────────────

export type FileKind = "csv" | "xlsx" | "pdf" | "docx";

/** A file uploaded to an engagement. `ref` (F1, F2…) is how agents and outputs cite it. */
export interface ClientFile {
  id: string;
  ref: string;
  engagementId: string;
  name: string;
  kind: FileKind;
  sizeBytes: number;
  /** What was read from it, e.g. "Excel, 2 sheets, 412 rows". */
  summary: string;
  /** Some rows or text were beyond the limits and are not given to agents. */
  truncated: boolean;
  /** Parts agents read it in. */
  parts: number;
  addedBy: string | null;
  createdAt: string;
}
