/**
 * store.ts — browser-local persistence for Gyan.
 * Honest contract: conversations and deliverables live in THIS browser's
 * localStorage only — no server copy, lost if site data is cleared.
 */
import type { VoltMessage } from '@/hooks/useVoltChat';

export interface StoredConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: VoltMessage[];
}

export interface StoredDeliverable {
  /** assistant message id — stable, deduped */
  id: string;
  /** deliverable base name, e.g. "VOLT - Close Plan" */
  name: string;
  prompt?: string;
  content: string;
  agents?: { id: string; name: string }[];
  at: number;
}

const CONV_KEY = 'volt.conversations.v1';
const DELIV_KEY = 'volt.deliverables.v1';
const MAX_CONVS = 20;
const MAX_DELIVS = 50;
const EVENT = 'volt-store';

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(key: string, rows: unknown[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
    window.dispatchEvent(new Event(EVENT));
    return true;
  } catch {
    // quota exceeded — drop oldest and retry once
    try {
      localStorage.setItem(key, JSON.stringify(rows.slice(0, Math.max(1, Math.floor(rows.length / 2)))));
      window.dispatchEvent(new Event(EVENT));
      return true;
    } catch {
      return false;
    }
  }
}

/** Re-render helper: fires after every write, same tab only. */
export function subscribeStore(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/* ---------- conversations ---------- */

export function listConversations(): StoredConversation[] {
  return read<StoredConversation>(CONV_KEY);
}

export function saveConversation(c: StoredConversation): void {
  const rest = listConversations().filter((x) => x.id !== c.id);
  write(CONV_KEY, [c, ...rest].slice(0, MAX_CONVS));
}

export function deleteConversation(id: string): void {
  write(CONV_KEY, listConversations().filter((x) => x.id !== id));
}

export function conversationTitle(messages: VoltMessage[]): string {
  const first = messages.find((m) => m.role === 'user')?.content ?? 'Conversation';
  const clean = first.replace(/\s+/g, ' ').trim();
  return clean.length > 64 ? `${clean.slice(0, 61)}…` : clean;
}

/* ---------- deliverables ---------- */

export function listDeliverables(): StoredDeliverable[] {
  return read<StoredDeliverable>(DELIV_KEY);
}

export function addDeliverable(d: StoredDeliverable): void {
  const rest = listDeliverables().filter((x) => x.id !== d.id);
  write(DELIV_KEY, [d, ...rest].slice(0, MAX_DELIVS));
}
