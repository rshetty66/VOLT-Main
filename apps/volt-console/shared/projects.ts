/** Projects: each one holds its chats, its knowledge base (uploads tagged with the project) and its memory. */

export const DEFAULT_PROJECT_ID = "general";
export const MEMORY_KINDS = ["fact", "decision", "client"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];
export const MEMORY_KIND_LABEL: Record<MemoryKind, string> = { fact: "Fact", decision: "Decision", client: "Client context" };
/** Memory items and their total length are capped: the list is read into every chat of the project. */
export const MEMORY_MAX_ITEMS = 40;
export const MEMORY_MAX_CHARS = 6000;

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  text: string;
  /** When it was added or last edited (ms). */
  at: number;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  memory: MemoryItem[];
}

/** A saved chat: the finished run (as the browser shows it) and when it was last saved or restored. */
export interface SavedChat<R = unknown> {
  projectId: string;
  updatedAt: number;
  /** Untouched for the archive period (VOLT_ARCHIVE_DAYS, default 30): hidden from the main list, never deleted. */
  archived: boolean;
  run: R;
}
