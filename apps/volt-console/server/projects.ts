/**
 * Projects and saved chats, kept on the data disk so they survive restarts and open on any device.
 *
 * Layout under <data>/projects/: projects.json (every project with its memory) and chats/<run id>.json.
 * A chat untouched for VOLT_ARCHIVE_DAYS (default 30) is archived: left out of the main list, still searchable and
 * restorable. Nothing is deleted automatically.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PROJECT_ID, MEMORY_MAX_CHARS, MEMORY_MAX_ITEMS, type MemoryItem, type Project, type SavedChat } from "../shared/projects.js";

const ID = /^[0-9a-f-]{36}$/;
const PROJECT_ID = /^(general|[0-9a-f-]{36})$/;
const DAY = 24 * 60 * 60 * 1000;

const root = () => path.join(process.env.VOLT_DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data"), "projects");
const chatsDir = () => path.join(root(), "chats");
export const archiveDays = () => (Number(process.env.VOLT_ARCHIVE_DAYS) > 0 ? Number(process.env.VOLT_ARCHIVE_DAYS) : 30);

/** Writes through a temporary file, so a crash mid-write never leaves half a file. */
function writeJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  fs.renameSync(tmp, file);
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

export function isProjectId(id: unknown): id is string {
  return typeof id === "string" && PROJECT_ID.test(id);
}

/** Every project, oldest first. "General" always exists. */
export function listProjects(): Project[] {
  const saved = readJson<Project[]>(path.join(root(), "projects.json")) ?? [];
  if (saved.some((p) => p.id === DEFAULT_PROJECT_ID)) return saved;
  return [{ id: DEFAULT_PROJECT_ID, name: "General", createdAt: 0, memory: [] }, ...saved];
}

export function getProject(id: string): Project | undefined {
  return listProjects().find((p) => p.id === id);
}

const cleanName = (name: string) => name.replace(/\s+/g, " ").trim().slice(0, 80);

export function createProject(name: string): Project {
  const p: Project = { id: crypto.randomUUID(), name: cleanName(name) || "Untitled project", createdAt: Date.now(), memory: [] };
  writeJson(path.join(root(), "projects.json"), [...listProjects(), p]);
  return p;
}

/** Renames a project or replaces its memory list. Returns undefined for an unknown project. */
export function updateProject(id: string, change: { name?: string; memory?: Partial<MemoryItem>[] }): Project | undefined {
  const all = listProjects();
  const i = all.findIndex((p) => p.id === id);
  if (i < 0) return undefined;
  const p = { ...all[i] };
  if (change.name !== undefined && cleanName(change.name)) p.name = cleanName(change.name);
  if (change.memory) p.memory = cleanMemory(change.memory, p.memory);
  all[i] = p;
  writeJson(path.join(root(), "projects.json"), all);
  return p;
}

/** Keeps ids and dates of unchanged items, stamps new or edited ones, and enforces the caps. */
function cleanMemory(items: Partial<MemoryItem>[], before: MemoryItem[]): MemoryItem[] {
  const out: MemoryItem[] = [];
  let chars = 0;
  for (const it of items) {
    const text = String(it.text ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
    if (!text || out.length >= MEMORY_MAX_ITEMS || chars + text.length > MEMORY_MAX_CHARS) continue;
    const kind = it.kind === "decision" || it.kind === "client" ? it.kind : "fact";
    const old = before.find((b) => b.id === it.id);
    const same = old && old.text === text && old.kind === kind;
    out.push({ id: old?.id ?? crypto.randomUUID(), kind, text, at: same ? old.at : Date.now() });
    chars += text.length;
  }
  return out;
}

// ── Saved chats ──────────────────────────────────────────────────────────────

interface ChatFile {
  projectId: string;
  updatedAt: number;
  run: { id: string; startedAt?: number };
}

const isArchived = (c: ChatFile, now: number) => now - c.updatedAt > archiveDays() * DAY;

/** Saves a finished run in a project. The save time starts its archive clock. */
export function saveChat(projectId: string, run: { id: string; startedAt?: number }): void {
  if (!ID.test(run.id) || !isProjectId(projectId)) throw new Error("invalid chat");
  writeJson(path.join(chatsDir(), `${run.id}.json`), { projectId, updatedAt: Date.now(), run } satisfies ChatFile);
}

/** A project's chats, newest first: the active ones, or with `archived` the archived ones only. */
export function listChats(projectId: string, archived = false, now = Date.now()): SavedChat[] {
  let files: string[] = [];
  try {
    files = fs.readdirSync(chatsDir()).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  return files
    .map((f) => readJson<ChatFile>(path.join(chatsDir(), f)))
    .filter((c): c is ChatFile => !!c && c.projectId === projectId && isArchived(c, now) === archived)
    .sort((a, b) => (b.run.startedAt ?? b.updatedAt) - (a.run.startedAt ?? a.updatedAt))
    .map((c) => ({ projectId: c.projectId, updatedAt: c.updatedAt, archived, run: c.run }));
}

/** Brings an archived chat back to the main list. */
export function restoreChat(id: string): boolean {
  const file = ID.test(id) ? path.join(chatsDir(), `${id}.json`) : "";
  const c = file ? readJson<ChatFile>(file) : undefined;
  if (!c) return false;
  writeJson(file, { ...c, updatedAt: Date.now() });
  return true;
}

/** Deletes a chat on the user's request (archiving never deletes). */
export function deleteChat(id: string): boolean {
  const file = ID.test(id) ? path.join(chatsDir(), `${id}.json`) : "";
  if (!file || !fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}
