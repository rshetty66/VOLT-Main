/**
 * BuilderView — the VOLT Builder surface (D9 + D13).
 *
 * Chat-first app factory: describe an app, watch the spec compile (G0),
 * approve it, run the full build (codegen + gates + bounded repairs), and
 * read the verification report — then preview the built app, iterate with a
 * follow-up prompt, or send the run to Studio as a deliverable.
 *
 * The surface is honest by contract: gate rows show real status with
 * durations and expandable failure excerpts (or pass notes); a build that
 * never ran G4 says so instead of faking a pass.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowUp,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Hammer,
  Loader2,
  Minus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import {
  buildStatus,
  compileSpec,
  getSession,
  listFiles,
  listSessions,
  previewUrl,
  readFile,
  runBuild,
  type BuilderSpec,
  type BuildEvent,
  type BuildOutcome,
  type GateResult,
  type SessionSummary,
} from '@/lib/builder';
import { addDeliverable } from '@/lib/store';
import { trpc } from '@/providers/trpc';
import { SurfaceHeader } from './views';

/* ---------- small pieces ---------- */

function StatusDot({ status }: { status: SessionSummary['status'] }) {
  const color =
    status === 'passed'
      ? 'bg-[var(--volt-green)]'
      : status === 'failed'
        ? 'bg-[#e5484d]'
        : status === 'building'
          ? 'shimmer'
          : 'bg-[var(--volt-faint)]';
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${color}`} />;
}

function GateIcon({ status }: { status: GateResult['status'] }) {
  if (status === 'pass')
    return <Check size={12} className="text-[var(--volt-green)]" />;
  if (status === 'fail')
    return <X size={12} className="text-[#e5484d]" />;
  return <Minus size={12} className="text-[var(--volt-faint)]" />;
}

function GateReport({ results }: { results: GateResult[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--volt-line)]">
      {results.map((r) => (
        <div key={r.gate} className="border-b border-[var(--volt-line-soft)] last:border-b-0">
          <button
            onClick={() => setOpen(open === r.gate ? null : r.gate)}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-[var(--volt-panel-2)]"
          >
            <GateIcon status={r.status} />
            <span className="w-7 font-mono text-[11px] text-[var(--volt-text)]">{r.gate}</span>
            <span className="micro flex-1 uppercase tracking-[0.08em] !text-[var(--volt-dim)]">
              {r.status === 'pass' ? 'passed' : r.status === 'fail' ? 'failed' : 'skipped'}
            </span>
            <span className="micro tnum !text-[var(--volt-faint)]">
              {r.status === 'skipped' ? '—' : `${r.durationMs}ms`}
            </span>
            {(r.errorExcerpt || r.note) && (
              <ChevronRight size={11} className="text-[var(--volt-faint)]" />
            )}
          </button>
          {open === r.gate && (r.errorExcerpt || r.note) && (
            <pre className="max-h-48 overflow-auto border-t border-[var(--volt-line-soft)] bg-[#111110] px-3 py-2 font-mono text-[10.5px] leading-relaxed text-[var(--volt-dim)]">
              {r.errorExcerpt ?? r.note}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

function SpecCard({
  spec,
  g0,
}: {
  spec: BuilderSpec;
  g0: { ok: boolean; issues: string[]; blockingUnknowns: string[] };
}) {
  const blocking = spec.unknowns.filter((u) => u.blocking);
  return (
    <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold tracking-tight">{spec.appName}</span>
        <span className={`micro uppercase tracking-[0.08em] ${g0.ok ? '!text-[var(--volt-green)]' : '!text-[#e5484d]'}`}>
          G0 {g0.ok ? 'passed' : 'failed'}
        </span>
      </div>
      <div className="micro mt-3 flex flex-wrap gap-x-4 gap-y-1 !text-[var(--volt-dim)]">
        <span>{spec.userStories.length} stories</span>
        <span>{spec.entities.length} entities</span>
        <span>{spec.screens.length} screens</span>
        <span>auth: {spec.authModel}</span>
      </div>
      <div className="mt-3">
        <div className="micro mb-1.5 !text-[var(--volt-faint)]">Screens</div>
        <div className="flex flex-wrap gap-1.5">
          {spec.screens.map((s) => (
            <span
              key={s.name}
              className="rounded border border-[var(--volt-line)] px-2 py-0.5 font-mono text-[10px] text-[var(--volt-dim)]"
              title={s.purpose}
            >
              {s.name}
            </span>
          ))}
        </div>
      </div>
      {blocking.length > 0 && (
        <div className="mt-3 rounded border border-[#4a2c2c] bg-[#221715] px-3 py-2">
          <div className="micro flex items-center gap-1.5 !text-[#e5484d]">
            <AlertTriangle size={10} /> {blocking.length} blocking unknown(s)
          </div>
          {blocking.map((u) => (
            <div key={u.decision} className="mt-1 text-[12px] text-[var(--volt-dim)]">
              {u.decision}
            </div>
          ))}
        </div>
      )}
      {!g0.ok && g0.issues.length > 0 && (
        <div className="mt-3 rounded border border-[#4a2c2c] bg-[#221715] px-3 py-2">
          {g0.issues.slice(0, 5).map((i) => (
            <div key={i} className="text-[12px] text-[#e5484d]">{i}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventTicker({ events }: { events: BuildEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events]);
  if (events.length === 0) return null;
  return (
    <div
      ref={ref}
      className="max-h-32 overflow-y-auto rounded-lg border border-[var(--volt-line)] bg-[#111110] px-3 py-2 font-mono text-[10.5px] leading-relaxed text-[var(--volt-dim)]"
    >
      {events.map((e, i) => (
        <div key={i} className="flex gap-2">
          <span className="tnum shrink-0 text-[var(--volt-faint)]">
            {new Date(e.at).toLocaleTimeString(undefined, { hour12: false })}
          </span>
          <span className="shrink-0 text-[var(--volt-amber)]">{e.t}</span>
          <span className="truncate">
            {typeof e.detail?.summary === 'string' ? e.detail.summary : ''}
            {typeof e.detail?.written === 'number' ? `${e.detail.written} files` : ''}
            {typeof e.detail?.files === 'number' ? `${e.detail.files} files` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

function FileBrowser({ sessionId }: { sessionId: string }) {
  const [files, setFiles] = useState<string[]>([]);
  const [open, setOpen] = useState<{ path: string; content: string } | null>(null);
  useEffect(() => {
    let dead = false;
    listFiles(sessionId)
      .then((r) => !dead && setFiles(r.files.filter((f) => !f.startsWith('dist/'))))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [sessionId]);
  if (files.length === 0) return null;
  return (
    <div>
      <div className="micro mb-1.5 !text-[var(--volt-faint)]">
        Workspace — {files.length} files
      </div>
      <div className="flex flex-wrap gap-1.5">
        {files.slice(0, 40).map((f) => (
          <button
            key={f}
            onClick={async () => {
              try {
                const r = await readFile(sessionId, f);
                setOpen(r);
              } catch {
                /* vanished mid-click */
              }
            }}
            className="flex items-center gap-1 rounded border border-[var(--volt-line)] px-2 py-0.5 font-mono text-[10px] text-[var(--volt-dim)] hover:border-[var(--volt-amber)] hover:text-[var(--volt-text)]"
          >
            <FileText size={9} /> {f}
          </button>
        ))}
      </div>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-6">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)]">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--volt-line-soft)] px-4">
              <span className="font-mono text-[11px] text-[var(--volt-dim)]">{open.path}</span>
              <button
                onClick={() => setOpen(null)}
                aria-label="Close file"
                className="text-[var(--volt-faint)] hover:text-[var(--volt-text)]"
              >
                <X size={13} />
              </button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-[var(--volt-dim)]">
              {open.content.slice(0, 100_000)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function buildDeliverableMarkdown(
  spec: BuilderSpec,
  outcome: BuildOutcome,
  sessionId: string,
): string {
  const rows = outcome.results
    .map(
      (r) =>
        `| ${r.gate} | ${r.status} | ${r.durationMs}ms |${r.errorExcerpt ? ' ⚠' : ''} |`,
    )
    .join('\n');
  return `# ${spec.appName} — VOLT Builder run

- **Spec** — ${spec.userStories.length} stories · ${spec.entities.length} entities · ${spec.screens.length} screens · auth: ${spec.authModel}
- **Verification** — ${outcome.summary}
- **Rounds** — ${outcome.rounds.used} used${outcome.rounds.repaired ? ' (repaired)' : ''}
- **Primary flow** — ${spec.primaryFlow}

| Gate | Status | Duration |
| --- | --- | --- |
${rows}

Preview: [/api/builder/preview/${sessionId}/](/api/builder/preview/${sessionId}/)
`;
}

/* ---------- main surface ---------- */

type Phase =
  | { kind: 'idle' }
  | { kind: 'compiling' }
  | { kind: 'spec'; sessionId: string; spec: BuilderSpec; g0: { ok: boolean; issues: string[]; blockingUnknowns: string[] } }
  | { kind: 'building'; sessionId: string; spec: BuilderSpec }
  | { kind: 'done'; sessionId: string; spec: BuilderSpec; outcome: BuildOutcome }
  | { kind: 'error'; message: string };

export function BuilderView() {
  const me = trpc.auth.me.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: false });
  const authed = !!me.data;
  const [draft, setDraft] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [liveEvents, setLiveEvents] = useState<BuildEvent[]>([]);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshHistory = useCallback(() => {
    if (!authed) return;
    listSessions()
      .then((r) => {
        setHistory(r.sessions);
        setHistoryNote(r.unavailable ? 'Server history unavailable' : null);
      })
      .catch(() => setHistoryNote('Server history unavailable'));
  }, [authed]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Live event polling while a build runs.
  useEffect(() => {
    if (phase.kind !== 'building') {
      stopPolling();
      return;
    }
    const sessionId = phase.sessionId;
    pollRef.current = setInterval(() => {
      buildStatus(sessionId)
        .then((s) => setLiveEvents(s.events))
        .catch(() => {});
    }, 2000);
    return stopPolling;
  }, [phase, stopPolling]);

  const startCompile = async (prompt: string, sessionId?: string) => {
    setPhase({ kind: 'compiling' });
    setLiveEvents([]);
    try {
      const r = await compileSpec({ prompt, sessionId });
      setPhase({ kind: 'spec', sessionId: r.sessionId, spec: r.spec, g0: r.g0 });
      refreshHistory();
    } catch (err) {
      setPhase({ kind: 'error', message: err instanceof Error ? err.message : 'compile failed' });
    }
  };

  const startBuild = async (sessionId: string, spec: BuilderSpec) => {
    setPhase({ kind: 'building', sessionId, spec });
    setLiveEvents([]);
    try {
      const outcome = await runBuild(sessionId);
      setLiveEvents(outcome.events);
      setPhase({ kind: 'done', sessionId, spec, outcome });
      refreshHistory();
    } catch (err) {
      setPhase({
        kind: 'error',
        message: err instanceof Error ? err.message : 'build failed',
      });
    }
  };

  const openSession = async (id: string) => {
    try {
      const d = await getSession(id);
      if (d.spec) {
        setPhase({
          kind: 'spec',
          sessionId: d.id,
          spec: d.spec,
          g0: { ok: true, issues: [], blockingUnknowns: [] },
        });
      } else {
        setPhase({ kind: 'idle' });
      }
      setLiveEvents(d.lastBuild?.events ?? []);
    } catch {
      setPhase({ kind: 'error', message: 'could not load that session' });
    }
  };

  const busy = phase.kind === 'compiling' || phase.kind === 'building';

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <SurfaceHeader
        kicker="VOLT · app factory"
        title="Builder"
        right={
          <span className="micro tnum flex items-center gap-2">
            {phase.kind === 'building' && (
              <>
                <Loader2 size={11} className="animate-spin" /> building
              </>
            )}
            <span
              className={`h-1.5 w-1.5 rounded-full ${busy ? 'shimmer' : 'bg-[var(--volt-green)]'}`}
            />
            {busy ? 'working' : 'ready'}
          </span>
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* session rail */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--volt-line-soft)] md:flex">
          <div className="micro border-b border-[var(--volt-line-soft)] px-4 py-2.5 !text-[var(--volt-faint)]">
            Your builds
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {history.length === 0 && (
              <div className="px-2 py-4 text-[12px] leading-relaxed text-[var(--volt-faint)]">
                {historyNote ?? 'Nothing yet — describe an app below.'}
              </div>
            )}
            {history.map((s) => (
              <button
                key={s.id}
                onClick={() => void openSession(s.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[var(--volt-panel-2)]"
              >
                <StatusDot status={s.status} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-[var(--volt-text)]">
                    {s.projectName}
                  </span>
                  <span className="micro block truncate !text-[var(--volt-faint)]">
                    {s.prompt.slice(0, 60)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl px-6 py-6">
              {!authed ? (
                <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] px-5 py-8 text-center">
                  <Hammer size={18} className="mx-auto text-[var(--volt-amber)]" />
                  <div className="mt-3 text-[14px] font-medium">Sign in to build</div>
                  <p className="mt-1 text-[13px] text-[var(--volt-dim)]">
                    The Builder compiles specs and runs gated builds against your
                    account.{' '}
                    <Link to="/login" className="underline hover:text-[var(--volt-amber)]">
                      Sign in
                    </Link>{' '}
                    to start.
                  </p>
                </div>
              ) : (
                <>
                  {phase.kind === 'spec' && (
                    <div className="rise mb-5">
                      <div className="micro mb-2 !text-[var(--volt-faint)]">
                        Compiled spec — review before building
                      </div>
                      <SpecCard spec={phase.spec} g0={phase.g0} />
                    </div>
                  )}
                  {phase.kind === 'building' && (
                    <div className="rise mb-5">
                      <div className="micro mb-2 flex items-center gap-2 !text-[var(--volt-faint)]">
                        <Loader2 size={11} className="animate-spin" />
                        Building {phase.spec.appName} — codegen, gates, up to three rounds
                      </div>
                      <EventTicker events={liveEvents} />
                    </div>
                  )}
                  {phase.kind === 'done' && (
                    <div className="rise mb-5 space-y-4">
                      <div>
                        <div className="micro mb-2 !text-[var(--volt-faint)]">
                          Verification report — {phase.spec.appName}
                        </div>
                        <GateReport results={phase.outcome.results} />
                        <div className="micro tnum mt-2 !text-[var(--volt-dim)]">
                          {phase.outcome.summary} · {phase.outcome.rounds.used} round
                          {phase.outcome.rounds.used === 1 ? '' : 's'}
                          {phase.outcome.rounds.repaired ? ' (repaired)' : ''}
                        </div>
                      </div>
                      {phase.outcome.results.every((r) => r.status !== 'fail') && (
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={previewUrl(phase.sessionId)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--volt-amber)] px-3 py-1.5 text-[12.5px] text-[var(--volt-amber)] hover:bg-[var(--volt-panel-2)]"
                          >
                            <ExternalLink size={11} /> Open preview
                          </a>
                          <button
                            onClick={() =>
                              addDeliverable({
                                id: `builder-${phase.sessionId}`,
                                name: `${phase.spec.appName} — Builder run`,
                                prompt: phase.spec.appName,
                                content: buildDeliverableMarkdown(
                                  phase.spec,
                                  phase.outcome,
                                  phase.sessionId,
                                ),
                                agents: [{ id: 'builder', name: 'VOLT Builder' }],
                                at: Date.now(),
                              })
                            }
                            className="flex items-center gap-1.5 rounded-lg border border-[var(--volt-line)] px-3 py-1.5 text-[12.5px] text-[var(--volt-dim)] hover:border-[var(--volt-amber)] hover:text-[var(--volt-text)]"
                          >
                            <Send size={11} /> Send to Studio
                          </button>
                        </div>
                      )}
                      <FileBrowser sessionId={phase.sessionId} />
                      {phase.outcome.results.some((r) => r.status === 'fail') && (
                        <div className="rounded-lg border border-[#4a2c2c] bg-[#221715] px-4 py-3 text-[12.5px] text-[var(--volt-dim)]">
                          The build failed verification. Describe what to fix below
                          and rebuild — the spec recompiles and the codegen loop
                          gets another run.
                        </div>
                      )}
                    </div>
                  )}
                  {phase.kind === 'error' && (
                    <div className="rise mb-5 rounded-lg border border-[#4a2c2c] bg-[#221715] px-4 py-3">
                      <div className="flex items-center gap-2 text-[13px] font-medium text-[#e5484d]">
                        <AlertTriangle size={14} /> Builder error
                      </div>
                      <div className="mt-1 text-[13px] text-[var(--volt-dim)]">
                        {phase.message}
                      </div>
                    </div>
                  )}
                  {(phase.kind === 'idle' || phase.kind === 'error') && (
                    <div className="mb-6">
                      <div className="micro mb-2 !text-[var(--volt-faint)]">
                        Describe the app
                      </div>
                      <p className="max-w-lg text-[13.5px] leading-relaxed text-[var(--volt-dim)]">
                        Builder turns a plain-language brief into a spec, generates
                        the app, and verifies it through five gates — typecheck,
                        build, boot, smoke, and a headless-browser check — before
                        you ever see it.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* composer */}
          {authed && (
            <div className="shrink-0 px-6 pb-5 pt-2">
              <div className="mx-auto max-w-2xl rounded-xl border border-[var(--volt-line)] bg-[var(--volt-panel)] focus-within:border-[var(--volt-amber)]">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  rows={2}
                  placeholder={
                    phase.kind === 'done' || phase.kind === 'spec'
                      ? 'Describe changes to iterate — or build as-is with the button above'
                      : 'Describe the app — e.g. "Invoice tracker for my consulting clients"'
                  }
                  className="w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] outline-none placeholder:text-[var(--volt-faint)]"
                />
                <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                  <span className="micro flex items-center gap-1.5 pl-1">
                    {phase.kind === 'building' ? (
                      <>
                        <Clock size={10} /> gates run in order — failures stop the chain honestly
                      </>
                    ) : (
                      <>
                        <Hammer size={10} /> spec → codegen → G0–G4 → preview
                      </>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    {(phase.kind === 'spec' || phase.kind === 'done') && (
                      <button
                        onClick={() =>
                          phase.kind === 'spec'
                            ? void startBuild(phase.sessionId, phase.spec)
                            : null
                        }
                        disabled={phase.kind !== 'spec'}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--volt-line)] px-2.5 py-1.5 text-[12px] text-[var(--volt-dim)] hover:border-[var(--volt-amber)] hover:text-[var(--volt-text)] disabled:opacity-40"
                      >
                        <RefreshCw size={11} />
                        {phase.kind === 'spec' ? 'Build now' : 'Build'}
                      </button>
                    )}
                    <button
                      onClick={() => submit()}
                      disabled={!draft.trim() || busy}
                      aria-label="Send to Builder"
                      className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30"
                      style={{ background: 'var(--volt-amber)', color: '#141414' }}
                    >
                      <ArrowUp size={16} strokeWidth={2.4} />
                    </button>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function submit() {
    const prompt = draft.trim();
    if (!prompt || busy) return;
    setDraft('');
    if (phase.kind === 'spec' || phase.kind === 'done') {
      // Iterate on the same session: recompile the spec from the new brief.
      void startCompile(prompt, phase.sessionId);
    } else {
      void startCompile(prompt);
    }
  }
}
