import type { CatalogResponse, RunRequest, VoltEvent } from "../shared/events";
import type { AuditEntry, BudgetStatus, ClientFile, CostSettings, Engagement, Estimate, Role, RunSummary, StoredRun, Template, UsageSummary, User } from "../shared/records";

/** Fired when the server answers 401: the session ended, so the app shows the sign-in screen. */
export const SIGNED_OUT = "volt:signed-out";
function watch(r: Response): Response {
  if (r.status === 401) window.dispatchEvent(new Event(SIGNED_OUT));
  return r;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
}
export type EngagementDetail = Engagement & { runs: RunSummary[]; members: Member[]; access: "read" | "write" };

export const listEngagements = () => getJSON<Engagement[]>("/api/engagements");
export const getEngagementDetail = (id: string) => getJSON<EngagementDetail>(`/api/engagements/${id}`);
export const getStoredRun = (id: string) => getJSON<StoredRun>(`/api/runs/${id}`);
export const runMarkdownUrl = (id: string) => `/api/runs/${id}/markdown`;
export const runExportUrl = (id: string, format: "docx" | "xlsx" | "pptx") => `/api/runs/${id}/export/${format}`;

/** Asks the server to halt a run; closing the page alone does not stop it. */
export async function stopRun(id: string): Promise<void> {
  await fetch(`/api/runs/${id}/stop`, { method: "POST" });
}

export async function createEngagement(input: { clientName: string; title: string; description?: string; templateId?: string | null }): Promise<Engagement> {
  const r = watch(await fetch("/api/engagements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
  if (!r.ok) throw new Error(`Could not create the engagement (${r.status})`);
  return r.json();
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = watch(await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }));
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${r.status})`);
  return data as T;
}

// Sign-in and accounts
export const authStatus = () => fetch("/api/auth/status").then((r) => r.json() as Promise<{ setupRequired: boolean; user: User | null }>);
export const signIn = (email: string, password: string) => send<User>("POST", "/api/auth/login", { email, password });
export const setUp = (name: string, email: string, password: string) => send<User>("POST", "/api/auth/setup", { name, email, password });
export const signOut = () => send<{ ok: boolean }>("POST", "/api/auth/logout");
export const changePassword = (current: string, password: string) => send<{ ok: boolean }>("POST", "/api/auth/password", { current, password });
export const listUsers = () => getJSON<User[]>("/api/users");
export const addUser = (u: { name: string; email: string; role: Role; password: string }) => send<User>("POST", "/api/users", u);
export const updateUser = (id: string, patch: { name?: string; role?: Role; disabled?: boolean }) => send<User>("PATCH", `/api/users/${id}`, patch);
export const resetPassword = (id: string, password: string) => send<{ ok: boolean }>("POST", `/api/users/${id}/password`, { password });
export const listAudit = (limit = 200) => getJSON<AuditEntry[]>(`/api/audit?limit=${limit}`);
export const addMember = (engagementId: string, userId: string) => send<Member[]>("POST", `/api/engagements/${engagementId}/members`, { userId });
export const removeMember = (engagementId: string, userId: string) => send<Member[]>("DELETE", `/api/engagements/${engagementId}/members/${userId}`);

// Client files
export const ACCEPTED_FILES = ".csv,.xlsx,.pdf,.docx";
export const MAX_FILE_MB = 10;
export const listFiles = (engagementId: string) => getJSON<ClientFile[]>(`/api/engagements/${engagementId}/files`);
export const fileUrl = (id: string) => `/api/files/${id}`;
export const getFileText = (id: string, part = 1) => getJSON<{ file: ClientFile; part: number; parts: number; text: string }>(`/api/files/${id}/text?part=${part}`);
export const deleteFile = (id: string) => send<{ ok: boolean }>("DELETE", `/api/files/${id}`);
export async function uploadFile(engagementId: string, file: File): Promise<ClientFile> {
  const r = watch(
    await fetch(`/api/engagements/${engagementId}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
      body: file,
    }),
  );
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `Upload failed (${r.status})`);
  return data as ClientFile;
}

// Usage and cost control
export const getUsage = () => getJSON<UsageSummary>("/api/usage");
export const getEstimate = (q: { workflowId?: string; agentId?: string }) =>
  getJSON<{ estimate: Estimate; budget: BudgetStatus; mode: string }>(`/api/usage/estimate?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`);
export interface CostSettingsResponse {
  settings: CostSettings;
  defaults: CostSettings;
  leadModel: string;
}
export const getCostSettings = () => getJSON<CostSettingsResponse>("/api/settings/cost");
export const saveCostSettings = (patch: Partial<CostSettings>) => send<CostSettingsResponse>("PUT", "/api/settings/cost", patch);
export const resetCostSettings = (keys: (keyof CostSettings)[]) => send<CostSettingsResponse>("POST", "/api/settings/cost/reset", { keys });
export const setUserBudget = (id: string, monthlyBudgetUsd: number | null) => send<{ ok: boolean }>("PUT", `/api/users/${id}/budget`, { monthlyBudgetUsd });

export const setEngagementTemplate = (id: string, templateId: string | null) => send<Engagement>("PATCH", `/api/engagements/${id}`, { templateId });

export interface TemplateForm {
  name: string;
  description: string;
  organisation: string;
  primaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  footerText: string;
  confidentiality: string;
  /** Data URL of a new logo, null to remove it, undefined to keep it. */
  logo?: string | null;
}

export const listTemplates = () => getJSON<Template[]>("/api/templates");
export const createTemplate = (t: TemplateForm) => send<Template>("POST", "/api/templates", t);
export const updateTemplate = (id: string, t: TemplateForm) => send<Template>("PUT", `/api/templates/${id}`, t);
export const deleteTemplate = (id: string) => send<{ ok: boolean }>("DELETE", `/api/templates/${id}`);
export const templateLogoUrl = (t: Template) => `/api/templates/${t.id}/logo?v=${encodeURIComponent(t.updatedAt ?? "")}`;
export const templatePreviewUrl = (id: string, format: "docx" | "xlsx" | "pptx") => `/api/templates/${id}/preview/${format}`;

export async function fetchCatalog(): Promise<CatalogResponse> {
  const r = watch(await fetch("/api/catalog"));
  if (!r.ok) throw new Error(`Catalog failed: ${r.status}`);
  return r.json();
}

export async function getJSON<T>(url: string): Promise<T> {
  const r = watch(await fetch(url));
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export async function runTool<T = unknown>(name: string, input: unknown): Promise<{ ok: boolean; data?: T; summary?: string; error?: string }> {
  const r = await fetch(`/api/tools/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  return r.json();
}

/** POSTs a run and yields Server-Sent Events as they arrive. */
export async function* streamRun(req: RunRequest, signal: AbortSignal): AsyncGenerator<VoltEvent> {
  const r = watch(
    await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    }),
  );
  if (!r.ok || !r.body) {
    const text = await r.text();
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      /* not JSON */
    }
    throw new Error(message || `Run failed (${r.status})`);
  }
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = frame.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
      if (data) yield JSON.parse(data) as VoltEvent;
    }
  }
}
