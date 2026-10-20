import type { CatalogResponse, RunRequest, VoltEvent } from "../shared/events";
import type { Engagement, RunSummary, StoredRun, Template } from "../shared/records";

export type EngagementDetail = Engagement & { runs: RunSummary[] };

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
  const r = await fetch("/api/engagements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!r.ok) throw new Error(`Could not create the engagement (${r.status})`);
  return r.json();
}

async function send<T>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${r.status})`);
  return data as T;
}

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
  const r = await fetch("/api/catalog");
  if (!r.ok) throw new Error(`Catalog failed: ${r.status}`);
  return r.json();
}

export async function getJSON<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

export async function runTool<T = unknown>(name: string, input: unknown): Promise<{ ok: boolean; data?: T; summary?: string; error?: string }> {
  const r = await fetch(`/api/tools/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  return r.json();
}

/** POSTs a run and yields Server-Sent Events as they arrive. */
export async function* streamRun(req: RunRequest, signal: AbortSignal): AsyncGenerator<VoltEvent> {
  const r = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`Run failed: ${r.status} ${await r.text()}`);
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
