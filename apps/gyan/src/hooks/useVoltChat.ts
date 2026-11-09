/**
 * useVoltChat — conversation state + streaming orchestration for the VOLT assistant.
 * Side effects stay out of state updaters (StrictMode double-invokes them);
 * a ref mirrors messages so send() can build history without a stale closure.
 * Completed turns persist to browser-local storage (see lib/store) and every
 * finished answer registers as a Studio deliverable.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  streamChat,
  type AgentRef,
  type ChatErrorKind,
  type HistoryMessage,
} from '@/lib/stream';
import { foldAttachments, type Attachment } from '@/lib/attachments';
import {
  addDeliverable,
  conversationTitle,
  saveConversation,
  type StoredConversation,
} from '@/lib/store';
import { deliverableName } from '@/lib/exporters';

export interface AttachmentMeta {
  name: string;
  size: number;
  kind: Attachment['kind'];
  summary?: string;
  truncated?: boolean;
}

export interface VoltMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** the user question that produced this answer (assistant messages) */
  prompt?: string;
  /** files the user attached with this message (user messages) */
  attachments?: AttachmentMeta[];
  agents?: AgentRef[];
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  errorKind?: ChatErrorKind;
  errorMessage?: string;
  streaming?: boolean;
  incomplete?: boolean;
}

let seq = 0;
const nextId = () => `m${++seq}-${Date.now()}`;
const newConvId = () => `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Strip runtime-only flags so restored conversations render as finished. */
function restorable(messages: VoltMessage[]): VoltMessage[] {
  return messages.map((m) =>
    m.streaming || m.incomplete ? { ...m, streaming: false } : m,
  );
}

export function useVoltChat() {
  const [messages, setMessages] = useState<VoltMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<VoltMessage[]>([]);
  const convRef = useRef<{ id: string; createdAt: number }>({
    id: newConvId(),
    createdAt: Date.now(),
  });

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Persist finished turns (never mid-stream) — debounced, browser-local only.
  useEffect(() => {
    if (messages.length === 0 || messages.some((m) => m.streaming)) return;
    const t = setTimeout(() => {
      saveConversation({
        id: convRef.current.id,
        title: conversationTitle(messages),
        createdAt: convRef.current.createdAt,
        updatedAt: Date.now(),
        messages: restorable(messages),
      });
    }, 300);
    return () => clearTimeout(t);
  }, [messages]);

  const patch = useCallback((id: string, p: Partial<VoltMessage>) => {
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }, []);

  const send = useCallback(
    (
      text: string,
      opts?: { architecture?: boolean; attachments?: Attachment[] },
    ) => {
      const content = text.trim();
      const atts = (opts?.attachments ?? []).filter(
        (a) => a.status === 'ready' && a.text,
      );
      if ((!content && atts.length === 0) || busy) return;

      const userMsg: VoltMessage = {
        id: nextId(),
        role: 'user',
        content: content || 'Analyze the attached file(s).',
        attachments:
          atts.length > 0
            ? atts.map((a) => ({
                name: a.name,
                size: a.size,
                kind: a.kind,
                summary: a.summary,
                truncated: a.truncated,
              }))
            : undefined,
      };
      const asstId = nextId();
      const asstMsg: VoltMessage = {
        id: asstId,
        role: 'assistant',
        content: '',
        prompt: userMsg.content,
        streaming: true,
      };

      const history: HistoryMessage[] = [...messagesRef.current, userMsg].map(
        (m, i, arr) => {
          const base = { role: m.role, content: m.content };
          // fold attachment text only into the message just sent
          if (i === arr.length - 1 && atts.length > 0) {
            return { ...base, content: foldAttachments(base.content, atts) };
          }
          return base;
        },
      );
      setMessages((ms) => [...ms, userMsg, asstMsg]);
      setBusy(true);

      const run = async () => {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        let finalText = '';
        let failed = false;
        let squad: AgentRef[] | undefined;
        const terminal = await streamChat(
          history,
          {
            onRun: (agents) => {
              squad = agents;
              patch(asstId, { agents });
            },
            onDelta: (d) => {
              finalText += d;
              setMessages((ms) =>
                ms.map((m) =>
                  m.id === asstId ? { ...m, content: m.content + d } : m,
                ),
              );
            },
            onDone: ({ model, usage }) =>
              patch(asstId, { model, usage, streaming: false }),
            onError: (kind, message) => {
              failed = true;
              patch(asstId, {
                errorKind: kind,
                errorMessage: message,
                streaming: false,
              });
            },
          },
          ctrl.signal,
          opts?.architecture ? { visualMode: 'architecture' } : undefined,
        );
        if (terminal === 'broken') {
          patch(asstId, { streaming: false, incomplete: true });
        }
        // A finished, non-empty answer becomes a Studio deliverable.
        if (!failed && finalText.trim()) {
          addDeliverable({
            id: asstId,
            name: deliverableName(finalText, userMsg.content),
            prompt: userMsg.content,
            content: finalText,
            agents: squad?.map((a) => ({ id: a.id, name: a.name })),
            at: Date.now(),
          });
        }
        abortRef.current = null;
        setBusy(false);
      };
      void run();
    },
    [busy, patch],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    convRef.current = { id: newConvId(), createdAt: Date.now() };
    setMessages([]);
    setBusy(false);
  }, []);

  /** Restore a stored conversation (aborts any in-flight stream). */
  const load = useCallback((conv: StoredConversation) => {
    abortRef.current?.abort();
    abortRef.current = null;
    convRef.current = { id: conv.id, createdAt: conv.createdAt };
    setMessages(restorable(conv.messages));
    setBusy(false);
  }, []);

  return { messages, busy, send, reset, load };
}
