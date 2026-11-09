/**
 * stream.ts — VOLT chat transport. NDJSON reader for POST /api/chat.
 * One fetch() + ReadableStream, no dependencies.
 */

export interface AgentRef {
  id: string;
  name: string;
  lineLabel: string;
  role: string;
  /** Dedicated model backing this specialist (absent on old saved conversations). */
  model?: { id: string; name: string; kind: 'core' | 'dedicated' | 'retrieval' };
}

export type ChatErrorKind =
  | 'unavailable'
  | 'rejected'
  | 'misconfigured'
  | 'invalid'
  | 'transient';

export interface ChatEvents {
  onRun?: (agents: AgentRef[]) => void;
  onDelta?: (delta: string) => void;
  onDone?: (info: {
    model?: string;
    usage?: { inputTokens?: number; outputTokens?: number };
  }) => void;
  onError?: (kind: ChatErrorKind, message: string) => void;
}

interface WireEvent {
  t: 'run' | 'delta' | 'done' | 'error';
  agents?: AgentRef[];
  d?: string;
  model?: string;
  usage?: { inputTokens?: number; outputTokens?: number };
  kind?: ChatErrorKind;
  message?: string;
}

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Stream a chat turn. Returns 'done' | 'error' | 'broken' — 'broken' means the
 * stream ended without a terminal event (treated as incomplete by the UI).
 */
export async function streamChat(
  messages: HistoryMessage[],
  events: ChatEvents,
  signal?: AbortSignal,
  opts?: { visualMode?: 'architecture' },
): Promise<'done' | 'error' | 'broken'> {
  let res: Response;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, visualMode: opts?.visualMode }),
      signal,
    });
  } catch {
    events.onError?.('transient', 'Network error — check the connection and retry.');
    return 'error';
  }
  if (!res.ok || !res.body) {
    events.onError?.('transient', `Chat request failed (HTTP ${res.status}).`);
    return 'error';
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal: 'done' | 'error' | 'broken' = 'broken';

  const handle = (line: string) => {
    if (!line.trim()) return;
    let ev: WireEvent;
    try {
      ev = JSON.parse(line) as WireEvent;
    } catch {
      return;
    }
    switch (ev.t) {
      case 'run':
        if (ev.agents?.length) events.onRun?.(ev.agents);
        break;
      case 'delta':
        if (ev.d) events.onDelta?.(ev.d);
        break;
      case 'done':
        terminal = 'done';
        events.onDone?.({ model: ev.model, usage: ev.usage });
        break;
      case 'error':
        terminal = 'error';
        events.onError?.(ev.kind ?? 'transient', ev.message ?? 'AI call failed.');
        break;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      handle(buffer.slice(0, idx));
      buffer = buffer.slice(idx + 1);
    }
  }
  if (buffer.trim()) handle(buffer);
  return terminal;
}

/** User-facing copy for each typed AI failure (see website-ai skill). */
export function errorCopy(kind: ChatErrorKind): { title: string; body: string } {
  switch (kind) {
    case 'unavailable':
      return {
        title: 'AI quota exhausted',
        body: 'This feature is unavailable until the site owner tops up credits on kimi.com.',
      };
    case 'rejected':
      return {
        title: 'Content rejected',
        body: 'The request was refused by the content filter. Please rephrase and try again.',
      };
    case 'misconfigured':
      return {
        title: 'AI not provisioned',
        body: 'The gateway credential is missing. Publish (or reopen) the site once, then retry.',
      };
    case 'invalid':
      return {
        title: 'Invalid request',
        body: 'The model rejected the request parameters. This is a build issue — it has been logged.',
      };
    default:
      return {
        title: 'Temporary AI hiccup',
        body: 'The gateway was rate-limited or briefly unavailable. Retry in a few seconds.',
      };
  }
}
