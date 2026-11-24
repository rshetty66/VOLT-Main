/**
 * The uploads library: every file attached in any chat is kept on the data disk, so it can be attached again as a source
 * in other chats without uploading or re-reading it. Each entry is the original file plus the text read from it.
 *
 * Layout under <data>/uploads/: <id>.json (metadata), <id>.txt (extracted text), <id>.bin (original bytes).
 * Limits: VOLT_UPLOADS_MAX_FILES (default 200) and VOLT_UPLOADS_MAX_MB (default 300); the oldest entries go first.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Extracted } from "./attachments.js";

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
}

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

export function listUploads(): UploadMeta[] {
  try {
    return fs
      .readdirSync(root())
      .filter((f) => f.endsWith(".json"))
      .map((f) => readMeta(f.slice(0, -5)))
      .filter((m): m is UploadMeta => !!m)
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function removeUpload(id: string): boolean {
  if (!ID.test(id) || !readMeta(id)) return false;
  for (const ext of ["json", "txt", "bin"]) fs.rmSync(path.join(root(), `${id}.${ext}`), { force: true });
  return true;
}

export function saveUpload(extracted: Extracted, original: Uint8Array): UploadMeta {
  fs.mkdirSync(root(), { recursive: true });
  // The same name replaces the older copy, so the library does not fill with versions of one file.
  for (const m of listUploads()) if (m.name === extracted.name) removeUpload(m.id);
  const id = crypto.randomUUID();
  const ext = extracted.name.includes(".") ? extracted.name.split(".").pop()!.toLowerCase() : "";
  const meta: UploadMeta = { id, name: extracted.name, ext, bytes: original.length, chars: extracted.chars, truncated: extracted.truncated, createdAt: Math.max(Date.now(), (listUploads()[0]?.createdAt ?? 0) + 1), uses: 0 };
  fs.writeFileSync(path.join(root(), `${id}.bin`), original);
  fs.writeFileSync(path.join(root(), `${id}.txt`), extracted.text);
  fs.writeFileSync(path.join(root(), `${id}.json`), JSON.stringify(meta));
  // Keep the library within its limits, oldest first.
  const maxFiles = num(process.env.VOLT_UPLOADS_MAX_FILES, 200);
  const maxBytes = num(process.env.VOLT_UPLOADS_MAX_MB, 300) * 1024 * 1024;
  const all = listUploads();
  let total = all.reduce((n, m) => n + m.bytes, 0);
  for (const m of [...all].reverse()) {
    if (all.length <= 1 || (all.length <= maxFiles && total <= maxBytes)) break;
    if (m.id === id) continue;
    removeUpload(m.id);
    total -= m.bytes;
    all.splice(all.indexOf(m), 1);
  }
  return meta;
}

export function readUpload(id: string): { meta: UploadMeta; text: string } | undefined {
  const meta = ID.test(id) ? readMeta(id) : undefined;
  if (!meta) return undefined;
  try {
    const text = fs.readFileSync(path.join(root(), `${id}.txt`), "utf8");
    fs.writeFileSync(path.join(root(), `${id}.json`), JSON.stringify({ ...meta, uses: meta.uses + 1 }));
    return { meta: { ...meta, uses: meta.uses + 1 }, text };
  } catch {
    return undefined;
  }
}

export function originalPath(id: string): string | undefined {
  const p = ID.test(id) ? path.join(root(), `${id}.bin`) : "";
  return p && fs.existsSync(p) ? p : undefined;
}
