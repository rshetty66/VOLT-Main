import { DEFAULT_PROJECT_ID, type MemoryItem, type MemoryKind, type Project, type SavedChat } from "../shared/projects";
import { HISTORY_KEY, loadHistory, slim, type StorageLike } from "./history";
import type { Run } from "./runState";

/** The project chosen in this browser; new chats, uploads and memory go to it. */
const ACTIVE_KEY = "volt.project.v1";
const MIGRATED_KEY = "volt.history.migrated.v1";

let active = DEFAULT_PROJECT_ID;
export const activeProject = () => active;

export function setActiveProject(id: string, storage: StorageLike | undefined = safeStorage()): void {
  active = id;
  try {
    storage?.setItem(ACTIVE_KEY, id);
  } catch {
    /* not remembered; still used for this page */
  }
}

export function loadActiveProject(storage: StorageLike | undefined = safeStorage()): string {
  try {
    active = storage?.getItem(ACTIVE_KEY) || DEFAULT_PROJECT_ID;
  } catch {
    active = DEFAULT_PROJECT_ID;
  }
  return active;
}

async function json<T>(r: Response): Promise<T> {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${r.status})`);
  return body as T;
}
const send = (url: string, method: string, body?: unknown) =>
  fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

export const listProjects = () => fetch("/api/projects").then((r) => json<Project[]>(r));
export const createProject = (name: string) => send("/api/projects", "POST", { name }).then((r) => json<Project>(r));
export const updateProject = (id: string, change: { name?: string; memory?: (Pick<MemoryItem, "kind" | "text"> & { id?: string })[] }) =>
  send(`/api/projects/${encodeURIComponent(id)}`, "PATCH", change).then((r) => json<Project>(r));

/** Adds one item to the active project's memory. */
export async function addMemory(text: string, kind: MemoryKind = "fact"): Promise<Project> {
  const p = (await listProjects()).find((x) => x.id === active);
  if (!p) throw new Error("That project no longer exists.");
  return updateProject(p.id, { memory: [...p.memory, { kind, text }] });
}

export const listChats = (projectId: string, archived = false) =>
  fetch(`/api/chats?projectId=${encodeURIComponent(projectId)}${archived ? "&archived=1" : ""}`).then((r) => json<SavedChat<Run>[]>(r));

/** Saves a finished run on the server, in its project. Never throws: a failed save is retried on the next change. */
export async function saveChat(run: Run, projectId = run.projectId ?? active): Promise<boolean> {
  try {
    const r = await send(`/api/chats/${run.id}`, "PUT", { projectId, run: slim(run) });
    return r.ok;
  } catch {
    return false;
  }
}

export const restoreChat = (id: string) => send(`/api/chats/${id}/restore`, "POST").then((r) => r.ok);
export const deleteChat = (id: string) => send(`/api/chats/${id}`, "DELETE").then((r) => r.ok);

/** Moves chats saved in this browser by earlier versions to the server, in "General", once. */
export async function migrateBrowserHistory(storage: StorageLike | undefined = safeStorage()): Promise<number> {
  if (!storage || storage.getItem(MIGRATED_KEY)) return 0;
  const old = loadHistory(storage);
  let moved = 0;
  for (const run of old) if (await saveChat(run, DEFAULT_PROJECT_ID)) moved++;
  if (moved === old.length) {
    storage.setItem(MIGRATED_KEY, String(Date.now()));
    storage.setItem(HISTORY_KEY, "[]");
  }
  return moved;
}

function safeStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}
