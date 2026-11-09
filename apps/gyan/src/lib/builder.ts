/**
 * builder.ts — VOLT Builder API client (D9).
 * Thin typed wrapper over /api/builder. Every helper throws Error with the
 * server's message on non-2xx so the surface can show honest failures.
 */

export interface BuilderEntityField {
  name: string;
  type: string;
}
export interface BuilderEntity {
  name: string;
  fields: BuilderEntityField[];
  provenance: string;
}
export interface BuilderScreen {
  name: string;
  purpose: string;
  primaryAction: string;
  reads: string[];
  writes: string[];
}
export interface BuilderSpec {
  appName: string;
  userStories: { id: string; story: string; acceptance: string }[];
  entities: BuilderEntity[];
  screens: BuilderScreen[];
  primaryFlow: string;
  authModel: string;
  unknowns: { decision: string; blocking: boolean; resolvingInput: string }[];
}
export interface GateResult {
  gate: 'G0' | 'G1' | 'G2' | 'G3' | 'G4';
  status: 'pass' | 'fail' | 'skipped';
  durationMs: number;
  errorExcerpt?: string;
  /** Non-failure context for a pass/skip (e.g. browser stages skipped). */
  note?: string;
}
export interface BuildEvent {
  t: string;
  at: number;
  detail?: Record<string, unknown>;
}
export interface BuildOutcome {
  summary: string;
  results: GateResult[];
  rounds: { used: number; repaired: boolean };
  events: BuildEvent[];
}
export interface SessionSummary {
  id: string;
  projectName: string;
  prompt: string;
  status: 'spec' | 'building' | 'passed' | 'failed';
  updatedAt: string;
}
export interface SessionDetail {
  id: string;
  projectName: string;
  prompt: string;
  status: SessionSummary['status'];
  updatedAt: string;
  spec: BuilderSpec | null;
  lastBuild: {
    summary: string;
    ok: boolean;
    rounds: unknown;
    gateResults: GateResult[];
    events: BuildEvent[];
    createdAt: string;
  } | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/builder${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof body.error === 'string' ? body.error : `Request failed (HTTP ${res.status})`,
    );
  }
  return body as T;
}

export function compileSpec(input: {
  prompt: string;
  sessionId?: string;
}): Promise<{ sessionId: string; spec: BuilderSpec; g0: { ok: boolean; issues: string[]; blockingUnknowns: string[] } }> {
  return req('/spec', { method: 'POST', body: JSON.stringify(input) });
}

export function runBuild(
  sessionId: string,
  opts?: { maxRounds?: number },
): Promise<BuildOutcome> {
  return req(`/build/${encodeURIComponent(sessionId)}/run`, {
    method: 'POST',
    body: JSON.stringify(opts ?? {}),
  });
}

export function buildStatus(sessionId: string): Promise<{ events: BuildEvent[]; running: boolean }> {
  return req(`/build/${encodeURIComponent(sessionId)}/status`);
}

export function listFiles(sessionId: string): Promise<{ files: string[] }> {
  return req(`/workspace/${encodeURIComponent(sessionId)}/files`);
}

export function readFile(sessionId: string, path: string): Promise<{ path: string; content: string }> {
  return req(`/workspace/${encodeURIComponent(sessionId)}/file/${path}`);
}

export function listSessions(): Promise<{ sessions: SessionSummary[]; unavailable?: boolean }> {
  return req('/sessions');
}

export function getSession(sessionId: string): Promise<SessionDetail> {
  return req(`/sessions/${encodeURIComponent(sessionId)}`);
}

/** Preview URL for a built session — same origin, auth cookie applies. */
export function previewUrl(sessionId: string): string {
  return `/api/builder/preview/${encodeURIComponent(sessionId)}/`;
}
