/**
 * ChatView — the VOLT assistant. Chat is the front door: agent runs render
 * inline, deliverable-grade markdown streams live, usage lands in mono tnum.
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  AlertTriangle,
  Copy,
  Check,
  Download,
  ChevronDown,
  Network,
  Paperclip,
  Square,
  X,
  FileText,
  History,
  Trash2,
  Plus,
} from 'lucide-react';
import type { VoltMessage } from '@/hooks/useVoltChat';
import { errorCopy } from '@/lib/stream';
import {
  exporters,
  EXPORT_LABELS,
  deliverableName,
  type ExportFormat,
} from '@/lib/exporters';
import {
  extractFile,
  acceptsFile,
  ACCEPT_STRING,
  MAX_FILES,
  type Attachment,
} from '@/lib/attachments';
import {
  deleteConversation,
  listConversations,
  subscribeStore,
  type StoredConversation,
} from '@/lib/store';
import { trpc } from '@/providers/trpc';
import { AgentRun } from './AgentRun';
import { mdComponents } from './markdown';

const SUGGESTIONS = [
  'Design a chart of accounts for a Canadian bank with IFRS 9 ECL staging',
  'Automate AP invoice matching — which agents do you engage, and how?',
  'Cut our close cycle from 8 days to 4. Give me the plan and the risks.',
  'Draft a transfer-pricing policy for cross-border intercompany charges',
];

function AttachmentChip({
  name,
  summary,
  status,
  truncated,
  onRemove,
}: {
  name: string;
  summary?: string;
  status?: 'reading' | 'ready' | 'error';
  truncated?: boolean;
  onRemove?: () => void;
}) {
  return (
    <span
      className={`flex max-w-56 items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] ${
        status === 'error'
          ? 'border-[#4a2c2c] text-[#e5484d]'
          : 'border-[var(--volt-line)] text-[var(--volt-dim)]'
      }`}
      title={summary}
    >
      <FileText size={10} className="shrink-0" />
      <span className="truncate">{name}</span>
      {status === 'reading' && (
        <span className="shimmer h-1.5 w-6 rounded" />
      )}
      {truncated && <span className="shrink-0 text-[var(--volt-faint)]">[cut]</span>}
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="shrink-0 hover:text-[var(--volt-text)]"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function UsageLine({ m }: { m: VoltMessage }) {
  if (!m.usage && !m.model) return null;
  const u = m.usage;
  return (
    <span className="micro tnum flex gap-3 !text-[var(--volt-faint)]">
      {m.model && <span>{m.model}</span>}
      {u && (
        <span>
          {(u.inputTokens ?? 0).toLocaleString()} in ·{' '}
          {(u.outputTokens ?? 0).toLocaleString()} out
        </span>
      )}
    </span>
  );
}

function ExportMenu({ m }: { m: VoltMessage }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const name = deliverableName(m.content, m.prompt);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const run = async (fmt: ExportFormat) => {
    setOpen(false);
    setBusy(fmt);
    try {
      const ok = (await exporters[fmt](m.content, name)) as unknown;
      if (ok === false) {
        window.alert(
          'No markdown tables in this answer — nothing to send to Excel.',
        );
      }
    } finally {
      setBusy(null);
    }
  };
  return (
    <span className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Export deliverable"
        aria-label="Export deliverable"
        className="flex h-6 items-center gap-0.5 rounded px-1.5 text-[var(--volt-faint)] hover:bg-[var(--volt-panel-2)] hover:text-[var(--volt-text)]"
      >
        <Download size={12} />
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <span
            className="fixed inset-0 z-[90] cursor-default"
            onClick={() => setOpen(false)}
          />
          <span className="absolute bottom-full right-0 z-[100] mb-1 block w-56 rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            <span className="micro block px-3 pb-1 pt-1.5 !text-[var(--volt-faint)]">
              Export as
            </span>
            {(Object.keys(EXPORT_LABELS) as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => void run(fmt)}
                className="block w-full px-3 py-1.5 text-left font-mono text-[11px] tracking-[0.02em] text-[var(--volt-dim)] hover:bg-[var(--volt-panel-2)] hover:text-[var(--volt-text)]"
              >
                {busy === fmt ? 'Exporting…' : EXPORT_LABELS[fmt]}
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}

function MessageActions({ m }: { m: VoltMessage }) {
  const [copied, setCopied] = useState(false);
  if (!m.content || m.errorKind) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <span className="flex items-center gap-1">
      <button
        onClick={copy}
        title="Copy as markdown"
        aria-label="Copy as markdown"
        className="flex h-6 w-6 items-center justify-center rounded text-[var(--volt-faint)] hover:bg-[var(--volt-panel-2)] hover:text-[var(--volt-text)]"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
      <ExportMenu m={m} />
    </span>
  );
}

function ErrorBanner({ m }: { m: VoltMessage }) {
  if (!m.errorKind) return null;
  const copy = errorCopy(m.errorKind);
  return (
    <div className="rounded-lg border border-[#4a2c2c] bg-[#221715] px-4 py-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-[#e5484d]">
        <AlertTriangle size={14} /> {copy.title}
      </div>
      <div className="mt-1 text-[13px] text-[var(--volt-dim)]">{copy.body}</div>
    </div>
  );
}

function AssistantBody({ m }: { m: VoltMessage }) {
  return (
    <div>
      {m.agents && m.agents.length > 0 && (
        <AgentRun agents={m.agents} working={!!m.streaming} />
      )}
      {m.errorKind ? (
        <ErrorBanner m={m} />
      ) : m.streaming ? (
        /* mid-stream markdown is syntactically broken (half-written tables) —
           render raw text while deltas arrive, parse once when done */
        <div className="md stream-caret whitespace-pre-wrap">{m.content}</div>
      ) : (
        <div className="md">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={mdComponents}
          >
            {m.content}
          </ReactMarkdown>
        </div>
      )}
      {m.incomplete && !m.errorKind && (
        <div className="micro mt-2 !text-[#e5484d]">
          {m.stopped
            ? 'Stopped — partial answer kept. Ask again to continue.'
            : 'Stream interrupted — answer may be incomplete. Ask again to retry.'}
        </div>
      )}
      {!m.streaming && (
        <div className="mt-2 flex items-center justify-between">
          <UsageLine m={m} />
          <MessageActions m={m} />
        </div>
      )}
    </div>
  );
}

/** One row in the history panel, regardless of where it is stored. */
interface HistoryRow {
  id: string;
  title: string;
  updatedAt: number;
  asks: number;
}

function formatWhen(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * HistoryPanel — slide-over conversation history.
 * Signed in: reads/writes the per-user server history (survives browsers and
 * devices). Signed out or sync unavailable: the browser-local store, labeled
 * honestly. Loading a row restores the whole conversation into the chat.
 */
function HistoryPanel({
  open,
  currentId,
  onClose,
  onLoad,
  onNew,
}: {
  open: boolean;
  currentId?: string;
  onClose: () => void;
  onLoad: (c: StoredConversation) => void;
  onNew: () => void;
}) {
  const me = trpc.auth.me.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const authed = !!me.data;
  const utils = trpc.useUtils();
  const remote = trpc.conversations.list.useQuery(undefined, {
    enabled: authed && open,
    retry: false,
  });
  const removeRemote = trpc.conversations.remove.useMutation({
    onSuccess: () => void utils.conversations.list.invalidate(),
  });

  const [localRows, setLocalRows] = useState<StoredConversation[]>(listConversations);
  useEffect(() => subscribeStore(() => setLocalRows(listConversations())), []);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Remote is the source of truth only when it answered; any failure falls
  // back to this browser's store so history never appears to vanish.
  const useRemote = authed && remote.isSuccess;
  const rows: HistoryRow[] = useRemote
    ? remote.data.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: new Date(c.updatedAt).getTime(),
        asks: Math.round(c.messageCount / 2),
      }))
    : localRows.map((c) => ({
        id: c.id,
        title: c.title,
        updatedAt: c.updatedAt,
        asks: c.messages.filter((m) => m.role === 'user').length,
      }));

  const openRow = async (id: string) => {
    setLoadingId(id);
    try {
      if (useRemote) {
        const full = await utils.conversations.get.fetch({ id });
        if (full) {
          onLoad({
            id: full.id,
            title: full.title,
            createdAt: new Date(full.createdAt).getTime(),
            updatedAt: new Date(full.updatedAt).getTime(),
            messages: full.messages as VoltMessage[],
          });
        }
      } else {
        const full = localRows.find((c) => c.id === id);
        if (full) onLoad(full);
      }
      onClose();
    } catch {
      /* row vanished or network dropped — leave the list as-is */
    } finally {
      setLoadingId(null);
    }
  };

  const removeRow = (id: string) => {
    if (useRemote) {
      removeRemote.mutate({ id });
    } else {
      deleteConversation(id);
    }
  };

  return (
    <>
      <span
        className="fixed inset-0 z-[90] bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed left-0 top-0 z-[100] flex h-full w-80 max-w-[85vw] flex-col border-r border-[var(--volt-line)] bg-[var(--volt-panel)]">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--volt-line-soft)] px-4">
          <span className="text-[13px] font-semibold tracking-tight">
            Conversations
          </span>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--volt-faint)] hover:bg-[var(--volt-panel-2)] hover:text-[var(--volt-text)]"
          >
            <X size={13} />
          </button>
        </div>
        <div className="shrink-0 px-3 pt-3">
          <button
            onClick={() => {
              onNew();
              onClose();
            }}
            className="lift flex w-full items-center gap-2 rounded-lg border border-[var(--volt-line)] px-3 py-2 text-[12.5px] text-[var(--volt-dim)] hover:border-[var(--volt-amber)] hover:text-[var(--volt-text)]"
          >
            <Plus size={12} /> New conversation
          </button>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {rows.length === 0 && (
            <div className="px-2 py-6 text-center text-[12px] text-[var(--volt-faint)]">
              Nothing yet — finished turns are kept here.
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              className={`group flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-[var(--volt-panel-2)] ${
                r.id === currentId ? 'bg-[var(--volt-panel-2)]' : ''
              }`}
            >
              <button
                onClick={() => void openRow(r.id)}
                disabled={loadingId === r.id}
                className="min-w-0 flex-1 py-1 text-left"
              >
                <span
                  className={`block truncate text-[12.5px] ${
                    r.id === currentId
                      ? 'text-[var(--volt-amber)]'
                      : 'text-[var(--volt-text)]'
                  }`}
                >
                  {loadingId === r.id ? 'Opening…' : r.title}
                </span>
                <span className="micro tnum block !text-[var(--volt-faint)]">
                  {formatWhen(r.updatedAt)} · {r.asks} {r.asks === 1 ? 'ask' : 'asks'}
                </span>
              </button>
              <button
                onClick={() => removeRow(r.id)}
                aria-label={`Delete ${r.title}`}
                className="hidden h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--volt-faint)] hover:text-[var(--volt-red)] group-hover:flex"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
        <div className="micro shrink-0 border-t border-[var(--volt-line-soft)] px-4 py-2.5 !text-[var(--volt-faint)]">
          {useRemote ? (
            'Synced to your account'
          ) : authed ? (
            'Sync unavailable — this browser only'
          ) : (
            <>
              This browser only ·{' '}
              <Link to="/login" className="underline hover:text-[var(--volt-amber)]">
                Sign in to sync
              </Link>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

export function ChatView({
  messages,
  busy,
  currentId,
  onSend,
  onStop,
  onLoad,
  onNew,
}: {
  messages: VoltMessage[];
  busy: boolean;
  currentId?: string;
  onSend: (
    text: string,
    opts?: { architecture?: boolean; attachments?: Attachment[] },
  ) => void;
  onStop: () => void;
  onLoad: (c: StoredConversation) => void;
  onNew: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [arch, setArch] = useState(false);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files).slice(0, MAX_FILES)) {
      if (!acceptsFile(file.name)) {
        setAtts((as) => [
          ...as,
          {
            id: `bad-${Date.now()}-${file.name}`,
            name: file.name,
            size: file.size,
            kind: 'text' as const,
            status: 'error' as const,
            text: '',
            truncated: false,
            error: 'Unsupported type',
          },
        ]);
        continue;
      }
      const placeholder: Attachment = {
        id: `reading-${Date.now()}-${file.name}`,
        name: file.name,
        size: file.size,
        kind: 'text',
        status: 'reading',
        text: '',
        truncated: false,
      };
      setAtts((as) => [...as.filter((a) => a.status !== 'error'), placeholder].slice(-MAX_FILES));
      const extracted = await extractFile(file);
      setAtts((as) => as.map((a) => (a.id === placeholder.id ? extracted : a)));
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = () => {
    const ready = atts.filter((a) => a.status === 'ready');
    const reading = atts.some((a) => a.status === 'reading');
    if ((!draft.trim() && ready.length === 0) || busy || reading) return;
    onSend(draft, {
      architecture: arch || undefined,
      attachments: ready.length ? ready : undefined,
    });
    setDraft('');
    setAtts([]);
    if (taRef.current) taRef.current.style.height = 'auto';
  };

  const empty = messages.length === 0;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* top strip */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--volt-line-soft)] px-5">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-semibold tracking-tight">Gyan</span>
          <span className="micro">VOLT · live assistant</span>
        </div>
        <div className="micro tnum flex items-center gap-2">
          <button
            onClick={() => setHistoryOpen(true)}
            title="Conversation history"
            aria-label="Conversation history"
            className="flex h-6 items-center gap-1.5 rounded-md border border-[var(--volt-line)] px-2 text-[var(--volt-dim)] hover:border-[var(--volt-amber)] hover:text-[var(--volt-text)]"
          >
            <History size={12} />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]">
              History
            </span>
          </button>
          <span
            className={`h-1.5 w-1.5 rounded-full ${busy ? 'shimmer' : 'bg-[var(--volt-green)]'}`}
            style={busy ? { width: 10, borderRadius: 3 } : undefined}
          />
          {busy ? 'working' : 'ready'}
        </div>
      </header>
      <HistoryPanel
        open={historyOpen}
        currentId={currentId}
        onClose={() => setHistoryOpen(false)}
        onLoad={onLoad}
        onNew={onNew}
      />

      {/* conversation */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {empty ? (
          <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-6 pb-24">
            <div className="micro mb-4">VOLT · Gyan</div>
            <h1 className="text-[40px] font-semibold leading-[1.1] tracking-tight">
              Energize your AI outcomes.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-[var(--volt-dim)]">
              Specialist agents, live plans, client-ready work — streamed on
              every run.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  className="lift group rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4 text-left hover:border-[var(--volt-amber)]"
                >
                  <div className="micro tnum mb-2">0{i + 1}</div>
                  <div className="text-[13px] leading-snug text-[var(--volt-dim)] group-hover:text-[var(--volt-text)]">
                    {s}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-8">
            {messages.map((m) => (
              <div key={m.id} className="rise mb-7">
                {m.role === 'user' ? (
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="max-w-[80%] rounded-xl border border-[var(--volt-line)] bg-[var(--volt-panel-2)] px-4 py-2.5 text-[14px] leading-relaxed">
                      {m.content}
                    </div>
                    {m.attachments && m.attachments.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {m.attachments.map((a) => (
                          <AttachmentChip
                            key={a.name}
                            name={a.name}
                            summary={a.summary}
                            truncated={a.truncated}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <AssistantBody m={m} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* composer */}
      <div className="shrink-0 px-6 pb-5 pt-2">
        <div className="mx-auto max-w-3xl rounded-xl border border-[var(--volt-line)] bg-[var(--volt-panel)] focus-within:border-[var(--volt-amber)]">
          {atts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
              {atts.map((a) => (
                <AttachmentChip
                  key={a.id}
                  name={a.name}
                  summary={a.summary}
                  status={a.status}
                  truncated={a.truncated}
                  onRemove={() =>
                    setAtts((as) => as.filter((x) => x.id !== a.id))
                  }
                />
              ))}
            </div>
          )}
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              const ta = e.target;
              ta.style.height = 'auto';
              ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Ask Gyan — finance transformation, ERP, banking, tax…"
            className="w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] outline-none placeholder:text-[var(--volt-faint)]"
          />
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <span className="flex items-center gap-2 pl-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ACCEPT_STRING}
                className="hidden"
                onChange={(e) => void addFiles(e.target.files)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                title="Attach files — csv, xlsx, docx, pdf, txt (max 4)"
                aria-label="Attach files"
                className="flex h-6 w-6 items-center justify-center rounded text-[var(--volt-faint)] hover:bg-[var(--volt-panel-2)] hover:text-[var(--volt-amber)]"
              >
                <Paperclip size={12} />
              </button>
              <span className="micro">
                {busy ? 'streaming…' : 'every specialist · one pool'}
              </span>
              <button
                onClick={() => setArch((a) => !a)}
                title="Architecture mode — multi-diagram, chart-heavy answers"
                aria-pressed={arch}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] transition-colors ${
                  arch
                    ? 'border-[var(--volt-amber)] text-[var(--volt-amber)]'
                    : 'border-[var(--volt-line)] text-[var(--volt-faint)] hover:text-[var(--volt-dim)]'
                }`}
              >
                <Network size={10} />
                Arch mode
              </button>
            </span>
            {busy ? (
              <button
                onClick={onStop}
                aria-label="Stop generating"
                title="Stop generating — keep the partial answer"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#4a2c2c] bg-[#221715] text-[#e5484d] hover:border-[#e5484d]"
              >
                <Square size={12} fill="currentColor" strokeWidth={0} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!draft.trim()}
                aria-label="Send"
                className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30"
                style={{ background: 'var(--volt-amber)', color: '#141414' }}
              >
                <ArrowUp size={16} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
