import type { CatalogResponse, RunRequest, VoltEvent } from "../shared/events";
import type { TemplateProfile, TemplateSummary } from "../shared/templates";

export const listTemplates = () => getJSON<TemplateSummary[]>("/api/templates");
export const getTemplate = (id: string) => getJSON<TemplateProfile>(`/api/templates/${encodeURIComponent(id)}`);

/** Uploads one template file; the server extracts and keeps its formatting profile. */
export async function uploadTemplate(file: File): Promise<TemplateProfile> {
  const r = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
    body: file,
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Upload failed (${r.status})`);
  return body as TemplateProfile;
}

export async function deleteTemplate(id: string): Promise<void> {
  const r = await fetch(`/api/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) throw new Error(`Delete failed (${r.status})`);
}

/** Thrown when the server wants the access token; the app answers with the sign-in screen. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Access token required");
  }
}

/** Reads one attached file to text on the server. Throws the server's message when the file cannot be used. */
export async function extractAttachment(file: File): Promise<{ name: string; text: string; chars: number; truncated: boolean }> {
  const r = await fetch("/api/attachments/extract", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) }, body: file });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? (r.status === 413 ? "That file is too large (4 MB limit)." : `Could not read that file (${r.status})`));
  return body;
}

export async function fetchCatalog(): Promise<CatalogResponse> {
  const r = await fetch("/api/catalog");
  if (r.status === 401) throw new UnauthorizedError();
  if (!r.ok) throw new Error(`Catalog failed: ${r.status}`);
  return r.json();
}

/** Signs in with the access token. Resolves to an empty string on success, or the message to show. */
export async function signIn(token: string): Promise<string> {
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    if (r.ok) return "";
    const body = await r.json().catch(() => ({}));
    return r.status === 429 ? "Too many attempts. Wait a minute and try again." : body.error ?? `Sign-in failed (${r.status})`;
  } catch {
    return "Could not reach the server.";
  }
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
    // A dropped connection surfaces as the browser's bare "TypeError: Load failed"; say what happened instead.
    const { value, done } = await reader.read().catch((e) => {
      if (signal.aborted) throw e;
      throw new Error("The connection dropped before the answer finished. Run it again.");
    });
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
