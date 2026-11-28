import type { CatalogResponse, RunRequest, VoltEvent } from "../shared/events";
import type { TemplateProfile, TemplateSummary } from "../shared/templates";
import { activeProject } from "./projects";

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
export type AuthMode = "token" | "username" | "password";
export class UnauthorizedError extends Error {
  constructor(public auth: AuthMode = "token") {
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

export interface UploadMeta { id: string; name: string; ext: string; bytes: number; chars: number; truncated: boolean; createdAt: number; uses: number; projectId?: string; url?: string; readAt?: number; note?: string; folder?: string; allProjects?: boolean; archived?: boolean }

/** Reads a file and keeps it in the active project's knowledge base (the uploads library); returns its text and library id. */
/** `library` is the Knowledge base page: any file type, up to KB_MAX_FILE_MB. A chat attachment stays to the chat types. */
export async function uploadAttachment(file: File, opts: { library?: boolean; folder?: string } = {}): Promise<{ id: string; name: string; text: string; chars: number; truncated: boolean; note?: string }> {
  const r = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name), "X-Project-Id": activeProject(), ...(opts.library ? { "X-Knowledge-Base": "1" } : {}), ...(opts.folder ? { "X-Folder": encodeURIComponent(opts.folder) } : {}) }, body: file });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? (r.status === 413 ? "That file is too large." : `Could not read that file (${r.status})`));
  return body;
}
/** Fetches a web page or PDF once and keeps it in the active project's knowledge base. */
export async function addUrlSource(url: string): Promise<UploadMeta> {
  const r = await fetch("/api/uploads/url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, projectId: activeProject() }) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Could not add that link (${r.status})`);
  return body;
}
/** The active project's uploads (its knowledge base), newest first. */
export async function listUploads(opts: { archived?: boolean } = {}): Promise<UploadMeta[]> {
  const r = await fetch(`/api/uploads?projectId=${encodeURIComponent(activeProject())}${opts.archived ? "&archived=1" : ""}`);
  return r.ok ? r.json() : [];
}
/** Moves a knowledge base file to a folder (null: no folder), shares it with all projects, or archives / restores it. */
export async function updateUpload(id: string, change: { folder?: string | null; allProjects?: boolean; archived?: boolean }): Promise<UploadMeta> {
  const r = await fetch(`/api/uploads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Could not update that file (${r.status})`);
  return body;
}
export async function getUpload(id: string): Promise<UploadMeta & { text: string }> {
  const r = await fetch(`/api/uploads/${id}`);
  if (!r.ok) throw new Error("That upload is no longer in the library.");
  return r.json();
}
/** Reads a web source in the knowledge base again; the old copy stays if that fails. */
export async function refreshUpload(id: string): Promise<UploadMeta> {
  const r = await fetch(`/api/uploads/${id}/refresh`, { method: "POST" });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error ?? `Could not read that page again (${r.status})`);
  return body;
}
export async function deleteUpload(id: string): Promise<void> {
  await fetch(`/api/uploads/${id}`, { method: "DELETE" });
}

export async function fetchCatalog(): Promise<CatalogResponse> {
  const r = await fetch("/api/catalog");
  if (r.status === 401) {
    const auth = (await r.json().catch(() => ({}))).auth;
    throw new UnauthorizedError(auth === "username" || auth === "password" ? auth : "token");
  }
  if (!r.ok) throw new Error(`Catalog failed: ${r.status}`);
  return r.json();
}

/** Signs in with a username (and a password in password mode). Resolves to an empty string on success, or the message to show. */
export async function signInUser(username: string, password?: string): Promise<string> {
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    if (r.ok) return "";
    const body = await r.json().catch(() => ({}));
    return body.error ?? (r.status === 429 ? "Too many attempts. Wait a minute and try again." : `Sign-in failed (${r.status})`);
  } catch {
    return "Could not reach the server.";
  }
}

/** Who is signed in: null in token mode or when nobody is. */
export async function fetchMe(): Promise<{ username: string | null; auth: AuthMode }> {
  const r = await fetch("/api/me");
  return r.ok ? r.json() : { username: null, auth: "token" };
}

export async function signOut(): Promise<void> {
  await fetch("/api/logout", { method: "POST" });
}

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

/** The server sends a heartbeat every 10 seconds; this long with nothing at all means the connection is gone. */
export const STREAM_IDLE_MS = 45_000;
export const CLOSED_EARLY = "The connection to VOLT closed before the answer finished (the server may have restarted, for example during a deploy). Run it again.";

/**
 * POSTs a run and yields Server-Sent Events as they arrive. Throws when the stream ends without the server's "done"
 * event or goes silent past the heartbeat, so a run never stays "running" after the server has stopped.
 */
export async function* streamRun(req: RunRequest, signal: AbortSignal, idleMs = STREAM_IDLE_MS): AsyncGenerator<VoltEvent> {
  const r = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`Run failed: ${r.status} ${await r.text()}`);
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  let finished = false;
  while (true) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const idle = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(CLOSED_EARLY)), idleMs);
    });
    // A dropped connection surfaces as the browser's bare "TypeError: Load failed"; say what happened instead.
    const { value, done } = await Promise.race([reader.read(), idle])
      .catch((e) => {
        if (signal.aborted) throw e;
        void reader.cancel().catch(() => undefined);
        throw e instanceof Error && e.message === CLOSED_EARLY ? e : new Error("The connection dropped before the answer finished. Run it again.");
      })
      .finally(() => clearTimeout(timer));
    if (done) {
      if (!finished && !signal.aborted) throw new Error(CLOSED_EARLY);
      break;
    }
    buf += value;
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = frame.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
      if (!data) continue;
      const e = JSON.parse(data) as VoltEvent;
      if (e.type === "done") finished = true;
      yield e;
    }
  }
}
