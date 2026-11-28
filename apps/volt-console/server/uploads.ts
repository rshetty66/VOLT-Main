/**
 * The uploads library: every file attached in any chat is kept on the data disk, so it can be attached again as a source
 * in other chats without uploading or re-reading it. Each entry is the original file plus the text read from it.
 *
 * Each upload belongs to a project (older ones, with none, to "general"): a project's uploads are its knowledge base.
 * A web page added by URL is kept the same way, with its URL.
 *
 * A file can be in a folder, and can be shared with every project (allProjects). A file unused for VOLT_ARCHIVE_DAYS (30),
 * or archived by hand, is left out of the knowledge base search and the main list; it is kept and can be restored.
 *
 * Layout under <data>/uploads/: <id>.json (metadata), <id>.txt (extracted text), <id>.bin (original bytes).
 * Limits: VOLT_UPLOADS_MAX_FILES (default 200) and VOLT_UPLOADS_MAX_MB (default 300). Nothing is dropped automatically:
 * a new file over the limits is refused (UploadsFullError) and the user removes files to make room.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Extracted } from "./attachments.js";
import { DEFAULT_PROJECT_ID } from "../shared/projects.js";
import { archiveDays } from "./projects.js";

export interface UploadMeta {
  id: string;
  name: string;
  ext: string;
  bytes: number;
  chars: number;
  truncated: boolean;
  createdAt: number;
  /** How many times it has been attached to a run; informational. */
  uses: number;
  /** The project whose knowledge base it belongs to; absent means "general". */
  projectId?: string;
  /** For a web source: the page's URL. */
  url?: string;
  /** For a web source: when the page was last read (added or refreshed). */
  readAt?: number;
  /** Set when the file is kept but its content was not (fully) read: audio, video, other types, part of a zip. */
  note?: string;
  /** Folder name in the knowledge base (one level); absent means no folder. */
  folder?: string;
  /** Also part of every other project's knowledge base. */
  allProjects?: boolean;
  /** Set when archived by hand. */
  archivedAt?: number;
  /** Last attached to a chat or found by a knowledge base search; starts the archive clock with createdAt/readAt. */
  usedAt?: number;
  /** Computed on listing: archived by hand, or unused for VOLT_ARCHIVE_DAYS. */
  archived?: boolean;
}

export class UploadsFullError extends Error {}

const DAY = 86_400_000;
const projectOf = (m: UploadMeta) => m.projectId ?? DEFAULT_PROJECT_ID;
const lastUsed = (m: UploadMeta) => Math.max(m.createdAt, m.readAt ?? 0, m.usedAt ?? 0);
export const isArchived = (m: UploadMeta, now = Date.now()) => !!m.archivedAt || now - lastUsed(m) > archiveDays() * DAY;

const root = () => path.join(process.env.VOLT_DATA_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data"), "uploads");
const ID = /^[0-9a-f-]{36}$/;
const num = (v: string | undefined, d: number) => (Number(v) > 0 ? Number(v) : d);

function readMeta(id: string): UploadMeta | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(root(), `${id}.json`), "utf8")) as UploadMeta;
  } catch {
    return undefined;
  }
}

/**
 * Every upload (archived too), newest first. With a project id: that project's knowledge base, that is its own files and
 * those shared with all projects, active only; `archived: true` gives the archived ones instead.
 */
export function listUploads(projectId?: string, opts: { archived?: boolean; now?: number } = {}): UploadMeta[] {
  const now = opts.now ?? Date.now();
  try {
    return fs
      .readdirSync(root())
      .filter((f) => f.endsWith(".json"))
      .map((f) => readMeta(f.slice(0, -5)))
      .filter((m): m is UploadMeta => !!m && (!projectId || ((projectOf(m) === projectId || !!m.allProjects) && isArchived(m, now) === !!opts.archived)))
      .map((m) => ({ ...m, archived: isArchived(m, now) }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

const writeMeta = (m: UploadMeta) => {
  const { archived: _computed, ...rest } = m;
  fs.writeFileSync(path.join(root(), `${m.id}.json`), JSON.stringify(rest));
};

/** Folder, sharing and archive changes from the knowledge base page. Restoring restarts the archive clock. */
export function updateUpload(id: string, change: { folder?: string | null; allProjects?: boolean; archived?: boolean }): UploadMeta | undefined {
  const m = ID.test(id) ? readMeta(id) : undefined;
  if (!m) return undefined;
  if (change.folder !== undefined) {
    const f = (change.folder ?? "").replace(/[\u0000-\u001f\u007f/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (f) m.folder = f;
    else delete m.folder;
  }
  if (change.allProjects !== undefined) {
    if (change.allProjects) m.allProjects = true;
    else delete m.allProjects;
  }
  if (change.archived === true) m.archivedAt = Date.now();
  if (change.archived === false) {
    delete m.archivedAt;
    m.usedAt = Date.now();
  }
  writeMeta(m);
  return { ...m, archived: isArchived(m) };
}

/** Marks files as used (a knowledge base search found them), so files in use are not archived. */
export function touchUploads(ids: string[]): void {
  const now = Date.now();
  for (const id of new Set(ids)) {
    const m = ID.test(id) ? readMeta(id) : undefined;
    if (m && now - (m.usedAt ?? 0) > DAY) writeMeta({ ...m, usedAt: now });
  }
}

export function removeUpload(id: string): boolean {
  if (!ID.test(id) || !readMeta(id)) return false;
  for (const ext of ["json", "txt", "bin"]) fs.rmSync(path.join(root(), `${id}.${ext}`), { force: true });
  return true;
}

/** `keep` refreshes an existing entry in place: same id and first-added time, so chats that cite it still find it. */
export function saveUpload(extracted: Extracted, original: Uint8Array, opts: { projectId?: string; url?: string; keep?: UploadMeta; folder?: string } = {}): UploadMeta {
  fs.mkdirSync(root(), { recursive: true });
  const projectId = opts.projectId ?? DEFAULT_PROJECT_ID;
  // The same name (or URL) in the same project replaces the older copy, so the library does not fill with versions of one file.
  const all = listUploads();
  const replaced = all.filter((m) => projectOf(m) === projectId && (opts.url ? m.url === opts.url : !m.url && m.name === extracted.name));
  const prior = opts.keep ?? replaced[0];
  // Nothing is dropped to make room: over the limits, the new file is refused.
  const maxFiles = num(process.env.VOLT_UPLOADS_MAX_FILES, 200);
  const maxMb = num(process.env.VOLT_UPLOADS_MAX_MB, 300);
  const kept = all.filter((m) => !replaced.includes(m) && m.id !== opts.keep?.id);
  const used = kept.reduce((n, m) => n + m.bytes, 0);
  if (kept.length + 1 > maxFiles || used + original.length > maxMb * 1024 * 1024) {
    throw new UploadsFullError(`The knowledge base is full (${(used / 1048576).toFixed(0)} of ${maxMb} MB, ${kept.length} of ${maxFiles} files). Remove files you no longer need to make room; archiving keeps a file, so it does not free space.`);
  }
  for (const m of replaced) removeUpload(m.id);
  const id = opts.keep?.id ?? crypto.randomUUID();
  const ext = opts.url ? "url" : extracted.name.includes(".") ? extracted.name.split(".").pop()!.toLowerCase() : "";
  const folder = opts.folder ?? prior?.folder;
  const meta: UploadMeta = { id, name: extracted.name, ext, bytes: original.length, chars: extracted.chars, truncated: extracted.truncated, createdAt: opts.keep?.createdAt ?? Math.max(Date.now(), (all[0]?.createdAt ?? 0) + 1), uses: opts.keep?.uses ?? 0, projectId, ...(extracted.note ? { note: extracted.note } : {}), ...(opts.url ? { url: opts.url, readAt: Date.now() } : {}), ...(folder ? { folder } : {}), ...(prior?.allProjects ? { allProjects: true } : {}) };
  fs.writeFileSync(path.join(root(), `${id}.bin`), original);
  fs.writeFileSync(path.join(root(), `${id}.txt`), extracted.text);
  writeMeta(meta);
  return { ...meta, archived: false };
}

export function uploadMeta(id: string): UploadMeta | undefined {
  return ID.test(id) ? readMeta(id) : undefined;
}

export function readUpload(id: string): { meta: UploadMeta; text: string } | undefined {
  const meta = ID.test(id) ? readMeta(id) : undefined;
  if (!meta) return undefined;
  try {
    const text = fs.readFileSync(path.join(root(), `${id}.txt`), "utf8");
    const next = { ...meta, uses: meta.uses + 1, usedAt: Date.now() };
    writeMeta(next);
    return { meta: next, text };
  } catch {
    return undefined;
  }
}

/** The stored text, without counting a use (for the knowledge base search). */
export function readUploadText(id: string): string | undefined {
  try {
    return ID.test(id) ? fs.readFileSync(path.join(root(), `${id}.txt`), "utf8") : undefined;
  } catch {
    return undefined;
  }
}

export function originalPath(id: string): string | undefined {
  const p = ID.test(id) ? path.join(root(), `${id}.bin`) : "";
  return p && fs.existsSync(p) ? p : undefined;
}
