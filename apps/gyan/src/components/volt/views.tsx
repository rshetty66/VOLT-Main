/**
 * VOLT surfaces — Marketplace, Blueprint, Studio, Workspace, Control.
 * Shared visual grammar: micro labels, tnum metrics, amber accents,
 * one evidence drawer for every drill-down.
 */
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Search, ArrowRight, FileText, Check, X, Download, Sparkles } from 'lucide-react';
import serviceLines from '@/data/service_lines.json';
import layersData from '@/data/layers.json';
import { CloseTrend, ProgressDonut, HBars } from './charts';
import {
  exporters,
  EXPORT_LABELS,
  type ExportFormat,
} from '@/lib/exporters';
import {
  listDeliverables,
  subscribeStore,
  type StoredDeliverable,
} from '@/lib/store';
import { mdComponents } from './markdown';

/* ---------- shared ---------- */

export function SurfaceHeader({
  kicker,
  title,
  right,
}: {
  kicker: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--volt-line-soft)] px-5">
      <div className="flex items-baseline gap-3">
        <span className="text-[15px] font-semibold tracking-tight">{title}</span>
        <span className="micro">{kicker}</span>
      </div>
      {right}
    </header>
  );
}

export interface DrawerData {
  kicker: string;
  title: string;
  body: React.ReactNode;
}

export function EvidenceDrawer({
  data,
  onClose,
}: {
  data: DrawerData | null;
  onClose: () => void;
}) {
  return (
    <aside
      className={`drawer-slide w-[340px] shrink-0 border-l border-[var(--volt-line)] bg-[var(--volt-panel)] ${
        data ? 'translate-x-0' : 'translate-x-full'
      }`}
      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 20 }}
    >
      {data && (
        <div className="flex h-full flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--volt-line-soft)] px-4">
            <span className="micro !text-[var(--volt-amber)]">{data.kicker}</span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-[var(--volt-faint)] hover:text-[var(--volt-text)]"
            >
              <X size={15} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <h3 className="text-[15px] font-semibold tracking-tight">
              {data.title}
            </h3>
            <div className="mt-3 text-[13px] leading-relaxed text-[var(--volt-dim)]">
              {data.body}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'amber' | 'green' | 'red';
}) {
  const color =
    tone === 'green'
      ? 'var(--volt-green)'
      : tone === 'red'
        ? 'var(--volt-red)'
        : 'var(--volt-text)';
  return (
    <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4">
      <div className="micro">{label}</div>
      <div className="tnum mt-2 text-[26px] font-semibold leading-none" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs text-[var(--volt-dim)]">{sub}</div>}
    </div>
  );
}

/* ---------- Marketplace ---------- */

interface AgentRow {
  id: string;
  name: string;
  role: string;
  tools: string[];
  model: { id: string; name: string; kind: 'core' | 'dedicated' | 'retrieval'; base: string; blurb: string };
  line: string;
  sub: string;
}

export function MarketplaceView({
  onEngage,
}: {
  onEngage: (prompt: string) => void;
}) {
  const [q, setQ] = useState('');
  const [drawer, setDrawer] = useState<DrawerData | null>(null);

  // One pool: service lines stay in the data as capability tags, never as
  // grouping or filters (VOLT directive — no practice silos).
  const all = useMemo<AgentRow[]>(
    () =>
      (serviceLines as any[])
        .flatMap((l) =>
          l.subCategories.flatMap((sc: any) =>
            sc.agents.map((a: any) => ({
              id: a.id,
              name: a.name,
              role: a.role,
              tools: a.tools ?? [],
              model: a.model ?? { id: 'gyan-core', name: 'Gyan Core', kind: 'core', base: '', blurb: '' },
              line: l.label,
              sub: sc.label,
            })),
          ),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  const filtered = all.filter(
    (a) =>
      !q ||
      `${a.name} ${a.role} ${a.sub}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      <SurfaceHeader
        title="Marketplace"
        kicker="every specialist · one pool"
        right={
          <div className="flex items-center gap-2 rounded-md border border-[var(--volt-line)] bg-[var(--volt-panel)] px-2.5 py-1.5">
            <Search size={13} className="text-[var(--volt-faint)]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search agents"
              className="w-44 bg-transparent text-[13px] outline-none placeholder:text-[var(--volt-faint)]"
            />
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1080px] px-6 py-5">
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() =>
                setDrawer({
                  kicker: a.sub,
                  title: a.name,
                  body: (
                    <div>
                      <p>{a.role}</p>
                      <div className="mt-4 rounded-md border border-[var(--volt-line)] bg-[var(--volt-panel-2)] p-3">
                        <div className="micro mb-1.5">Runs on</div>
                        <div className="text-[13px] font-medium"
                          style={{
                            color:
                              a.model.kind === 'dedicated'
                                ? 'var(--volt-amber)'
                                : a.model.kind === 'retrieval'
                                  ? 'var(--volt-green)'
                                  : 'var(--volt-text)',
                          }}
                        >
                          ◆ {a.model.name}
                        </div>
                        <div className="mt-1 text-xs leading-relaxed text-[var(--volt-dim)]">
                          {a.model.kind === 'dedicated'
                            ? `Dedicated ${a.model.base} · ${a.model.blurb}`
                            : a.model.kind === 'retrieval'
                              ? a.model.blurb
                              : a.model.blurb}
                        </div>
                      </div>
                      {a.tools.length > 0 && (
                        <div className="mt-4">
                          <div className="micro mb-2">Toolchain</div>
                          <div className="flex flex-wrap gap-1.5">
                            {a.tools.map((t) => (
                              <span
                                key={t}
                                className="rounded border border-[var(--volt-line)] bg-[var(--volt-panel-2)] px-2 py-1 font-mono text-[11px] text-[var(--volt-dim)]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() =>
                          onEngage(
                            `Engage the ${a.name}: ${a.role}. Start by asking me what you need scoped.`,
                          )
                        }
                        className="micro mt-5 flex items-center gap-1.5 rounded-md px-3 py-2 font-medium"
                        style={{ background: 'var(--volt-amber)', color: '#141414' }}
                      >
                        Engage in chat <ArrowRight size={12} />
                      </button>
                    </div>
                  ),
                })
              }
              className="lift rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4 text-left hover:border-[var(--volt-amber)]"
            >
              <div className="micro tnum flex items-center justify-between">
                <span>{a.id}</span>
                <span>{a.sub}</span>
              </div>
              <div className="mt-2 text-[14px] font-medium leading-snug">
                {a.name}
              </div>
              <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--volt-dim)]">
                {a.role}
              </div>
              {a.model.kind !== 'core' && (
                <div
                  className="micro mt-2.5"
                  style={{
                    color:
                      a.model.kind === 'dedicated'
                        ? 'var(--volt-amber)'
                        : 'var(--volt-green)',
                  }}
                >
                  ◆ {a.model.kind === 'dedicated' ? 'dedicated model' : 'data service'} · {a.model.name}
                </div>
              )}
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="micro py-16 text-center">No agents match</div>
        )}
        </div>
      </div>
      <EvidenceDrawer data={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

/* ---------- Blueprint ---------- */

const KIND_COLOR: Record<string, string> = {
  ui: 'var(--volt-amber)',
  agent: '#8b7ce8',
  svc: '#46a758',
  gateway: '#4c9be8',
  system: '#9b9d95',
};

export function BlueprintView() {
  const layers = layersData as any[];
  const [drawer, setDrawer] = useState<DrawerData | null>(null);
  const total = layers.reduce((n, l) => n + l.nodes.length, 0);

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      <SurfaceHeader
        title="Blueprint"
        kicker={`6 layers · ${total} nodes · reference architecture`}
        right={
          <div className="micro flex items-center gap-3">
            {Object.entries(KIND_COLOR).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                {k}
              </span>
            ))}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1080px] px-6 py-6">
          {layers.map((l, i) => (
            <div key={l.id} className="relative flex gap-0">
              {/* spine */}
              <div className="flex w-10 shrink-0 flex-col items-center">
                <div
                  className="tnum z-10 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-[11px]"
                  style={{
                    borderColor: 'var(--volt-amber)',
                    color: 'var(--volt-amber)',
                    background: 'var(--volt-bg)',
                  }}
                >
                  {l.tag}
                </div>
                {i < layers.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--volt-line)]" />
                )}
              </div>
              {/* band */}
              <div className="min-w-0 flex-1 pb-6">
                <div className="rounded-xl border border-[var(--volt-line)] bg-[var(--volt-panel)] p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="micro mr-2 !text-[var(--volt-amber)]">
                        Layer {l.tag}
                      </span>
                      <span className="text-[16px] font-semibold tracking-tight">
                        {l.name}
                      </span>
                    </div>
                    <span className="micro tnum">{l.nodes.length} nodes</span>
                  </div>
                  <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--volt-dim)]">
                    {l.blurb}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {l.nodes.map((n: any) => (
                      <button
                        key={n.id}
                        onClick={() =>
                          setDrawer({
                            kicker: `Layer ${l.tag} · ${n.kind}`,
                            title: n.name,
                            body: <p>{n.note}</p>,
                          })
                        }
                        className="lift flex items-center gap-2 rounded-md border border-[var(--volt-line-soft)] bg-[var(--volt-panel-2)] px-3 py-2 text-left hover:border-[var(--volt-amber)]"
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: KIND_COLOR[n.kind] ?? '#666' }}
                        />
                        <span className="text-[12.5px] font-medium leading-none">
                          {n.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <EvidenceDrawer data={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

/* ---------- Studio ---------- */

/** Export row for a chat-born deliverable — same five formats as chat. */
function DeliverableExports({ d }: { d: StoredDeliverable }) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const run = async (fmt: ExportFormat) => {
    setBusy(fmt);
    try {
      const ok = (await exporters[fmt](d.content, d.name)) as unknown;
      if (ok === false)
        window.alert('No markdown tables in this deliverable — nothing to send to Excel.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {(Object.keys(EXPORT_LABELS) as ExportFormat[]).map((fmt) => (
        <button
          key={fmt}
          onClick={() => void run(fmt)}
          className="micro flex items-center gap-1.5 rounded-md border border-[var(--volt-line)] px-2.5 py-1.5 text-[var(--volt-dim)] hover:border-[var(--volt-amber)] hover:text-[var(--volt-amber)]"
        >
          <Download size={11} />
          {busy === fmt ? 'Exporting…' : EXPORT_LABELS[fmt]}
        </button>
      ))}
    </div>
  );
}

/** Deliverables produced by chat answers — browser-local, like conversations. */
function LiveDeliverables() {
  const [items, setItems] = useState<StoredDeliverable[]>(listDeliverables);
  const [drawer, setDrawer] = useState<StoredDeliverable | null>(null);
  useEffect(() => subscribeStore(() => setItems(listDeliverables())), []);

  if (items.length === 0) return null;
  return (
    <>
      <div className="micro mb-2.5 flex items-center gap-2">
        <Sparkles size={11} className="text-[var(--volt-amber)]" />
        From your chats · {items.length} · saved in this browser only
      </div>
      <div className="mb-8 grid grid-cols-1 gap-2 xl:grid-cols-3">
        {items.map((d) => (
          <button
            key={d.id}
            onClick={() => setDrawer(d)}
            className="lift rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4 text-left hover:border-[var(--volt-amber)]"
          >
            <div className="micro tnum flex items-center justify-between">
              <span>{new Date(d.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              <span style={{ color: 'var(--volt-amber)' }}>chat</span>
            </div>
            <div className="mt-2 flex items-start gap-2 text-[14px] font-medium leading-snug">
              <FileText size={15} className="mt-0.5 shrink-0 text-[var(--volt-faint)]" />
              {d.name.replace(/^VOLT - /, '')}
            </div>
            {d.prompt && (
              <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--volt-dim)]">
                {d.prompt}
              </div>
            )}
          </button>
        ))}
      </div>
      <EvidenceDrawer
        data={
          drawer && {
            kicker: `chat deliverable · ${drawer.agents?.length ?? 0} agents engaged`,
            title: drawer.name.replace(/^VOLT - /, ''),
            body: (
              <div>
                <DeliverableExports d={drawer} />
                <div className="md mt-4 border-t border-[var(--volt-line-soft)] pt-4">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {drawer.content}
                  </ReactMarkdown>
                </div>
              </div>
            ),
          }
        }
        onClose={() => setDrawer(null)}
      />
    </>
  );
}

const DELIVERABLES = [
  {
    id: 'D-01',
    name: 'D-SIB Chart of Accounts — Design Workbook',
    kind: 'xlsx',
    detail:
      '9 sheets · 12 segments (44-char combination) · 199 key accounts · 24 natural-account blocks · 10 cross-validation rules · 15 sample journal entries · 115 live formulas, gate-clean',
    status: 'Delivered',
    gate: 'recalc libreoffice · verify pass · 0 errors',
  },
  {
    id: 'D-02',
    name: 'Gauntlet Task 1 — Scorecard',
    kind: 'md',
    detail:
      'Self-score 90.5/100 (provisional, pre blind grading) · Finding F-01: golden-reference block defect caught by workbook COUNTIFS · Finding F-02: header collision · 5 attack questions for the blind grader',
    status: 'Delivered',
    gate: 'self-scored · awaiting blind grade',
  },
  {
    id: 'D-03',
    name: 'Gyan Gauntlet — Protocol',
    kind: 'md',
    detail:
      '6-task blind A/B/C bake-off harness · weighted rubric (domain 30 / evidence 20 / artifact 20 / completeness 15 / judgment 15) · cost ledger · model-routing decision rule',
    status: 'Active',
    gate: 'governing tasks 1–6',
  },
];

const INBOX = [
  {
    id: 'W-101',
    title: 'Widen block 500000–599999 to absorb FVA/DVA/CVA (Finding F-01)',
    ctx: 'Golden reference placed account 550000 outside its own declared block. Widening preserves all 199 account codes.',
    kind: 'Design decision',
  },
  {
    id: 'W-102',
    title: 'Approve CVR-07: intercompany pairs must share ledger & calendar',
    ctx: 'Prevents the most expensive retrofit in multi-LE rollouts — intercompany balancing defined after go-live.',
    kind: 'Rule approval',
  },
  {
    id: 'W-103',
    title: 'Confirm ECL stage-transfer signage convention for sample journals',
    ctx: 'Stage 2→3 transfer posts allowance build before write-off; signs follow the workbook convention.',
    kind: 'Methodology',
  },
];

export function StudioView() {
  const [drawer, setDrawer] = useState<DrawerData | null>(null);
  const [decided, setDecided] = useState<Record<string, string>>({});

  return (
    <div className="relative flex h-full min-w-0 flex-1 flex-col">
      <SurfaceHeader title="Studio" kicker="delivery workbench · evidence-first" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1080px] px-6 py-5">
        {/* engagement pipeline */}
        <div className="mb-8 flex items-stretch">
          {[
            ['Protocol', 'done'],
            ['Task 1 · D-SIB COA', 'done'],
            ['Blind grading', 'active'],
            ['Tasks 2–6', 'next'],
            ['Routing decision', 'next'],
          ].map(([label, state], i, arr) => (
            <div key={label} className="flex min-w-0 flex-1 items-center">
              <div className="min-w-0">
                <div
                  className="tnum flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[10px]"
                  style={{
                    borderColor:
                      state === 'done'
                        ? 'var(--volt-green)'
                        : state === 'active'
                          ? 'var(--volt-amber)'
                          : 'var(--volt-line)',
                    color:
                      state === 'done'
                        ? 'var(--volt-green)'
                        : state === 'active'
                          ? 'var(--volt-amber)'
                          : 'var(--volt-faint)',
                  }}
                >
                  {state === 'done' ? '✓' : `0${i + 1}`}
                </div>
                <div className="micro mt-1.5 whitespace-nowrap">{label}</div>
              </div>
              {i < arr.length - 1 && (
                <div
                  className="mx-2 mb-5 h-px min-w-3 flex-1"
                  style={{
                    background:
                      state === 'done' ? 'var(--volt-green)' : 'var(--volt-line)',
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <LiveDeliverables />
        <div className="micro mb-2.5">Engagement showcase</div>
        <div className="grid grid-cols-1 gap-2 xl:grid-cols-3">
          {DELIVERABLES.map((d) => (
            <button
              key={d.id}
              onClick={() =>
                setDrawer({
                  kicker: `${d.id} · ${d.kind} · ${d.status}`,
                  title: d.name,
                  body: (
                    <div>
                      <p>{d.detail}</p>
                      <div className="mt-4 rounded-md border border-[var(--volt-line)] bg-[var(--volt-panel-2)] p-3">
                        <div className="micro mb-1.5">Quality gate</div>
                        <div className="tnum font-mono text-[12px] text-[var(--volt-green)]">
                          {d.gate}
                        </div>
                      </div>
                    </div>
                  ),
                })
              }
              className="lift rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4 text-left hover:border-[var(--volt-amber)]"
            >
              <div className="micro flex items-center justify-between">
                <span className="tnum">{d.id}</span>
                <span
                  style={{
                    color: d.status === 'Delivered' ? 'var(--volt-green)' : 'var(--volt-amber)',
                  }}
                >
                  {d.status}
                </span>
              </div>
              <div className="mt-2 flex items-start gap-2 text-[14px] font-medium leading-snug">
                <FileText size={15} className="mt-0.5 shrink-0 text-[var(--volt-faint)]" />
                {d.name}
              </div>
              <div className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[var(--volt-dim)]">
                {d.detail}
              </div>
            </button>
          ))}
        </div>

        <div className="micro mb-2.5 mt-8">
          Workflow inbox · {INBOX.length} awaiting decision
        </div>
        <div className="space-y-2">
          {INBOX.map((w) => {
            const d = decided[w.id];
            return (
              <div
                key={w.id}
                className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="micro">{w.id} · {w.kind}</div>
                    <div className="mt-1.5 text-[14px] font-medium leading-snug">
                      {w.title}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-[var(--volt-dim)]">
                      {w.ctx}
                    </div>
                  </div>
                  {d ? (
                    <span
                      className="micro shrink-0 rounded-full border px-3 py-1.5"
                      style={{
                        color: d === 'approved' ? 'var(--volt-green)' : 'var(--volt-red)',
                        borderColor: 'var(--volt-line)',
                      }}
                    >
                      {d}
                    </span>
                  ) : (
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() =>
                          setDecided((s) => ({ ...s, [w.id]: 'approved' }))
                        }
                        aria-label="Approve"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--volt-line)] text-[var(--volt-green)] hover:bg-[var(--volt-panel-2)]"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() =>
                          setDecided((s) => ({ ...s, [w.id]: 'rejected' }))
                        }
                        aria-label="Reject"
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--volt-line)] text-[var(--volt-red)] hover:bg-[var(--volt-panel-2)]"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>
      <EvidenceDrawer data={drawer} onClose={() => setDrawer(null)} />
    </div>
  );
}

/* ---------- Workspace (CFO cockpit) ---------- */

const CLOSE_TREND = [
  { period: 'Jun', actual: 8.0, target: 4.0 },
  { period: 'Jul', actual: 7.6, target: 4.0 },
  { period: 'Aug', actual: 7.1, target: 4.0 },
  { period: 'Sep', actual: 6.8, target: 4.0 },
  { period: 'Oct', actual: 6.4, target: 4.0 },
  { period: 'Nov', actual: 6.2, target: 4.0 },
];

const CASH_AGING = [
  { name: '0–7 days', value: 0.4 },
  { name: '8–30 days', value: 0.7 },
  { name: '31–60 days', value: 0.5 },
  { name: '60+ days', value: 0.3 },
];

type CockpitTab = 'overview' | 'close' | 'cash';

export function WorkspaceView() {
  const [tab, setTab] = useState<CockpitTab>('overview');
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <SurfaceHeader
        title="Workspace"
        kicker="CFO cockpit · close cycle in flight"
        right={
          <div className="flex gap-1 rounded-md border border-[var(--volt-line)] bg-[var(--volt-panel)] p-0.5">
            {(['overview', 'close', 'cash'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`micro rounded px-3 py-1.5 ${tab === t ? 'bg-[var(--volt-panel-2)] text-[var(--volt-amber)]' : 'text-[var(--volt-dim)]'}`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1080px] px-6 py-5">
          {tab === 'overview' && (
            <>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <Tile label="Close day" value="6.2" sub="target 4.0 · plan in Studio" tone="amber" />
                <Tile label="Subledger accounting" value="98.4%" sub="create-accounting first-pass" />
                <Tile label="Suspense balance" value="0" sub="cleared daily · policy W-102" tone="green" />
                <Tile label="Open intercompany breaks" value="3" sub="2 awaiting counterparty" tone="red" />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 xl:grid-cols-2">
                <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4">
                  <div className="micro mb-2 flex justify-between">
                    <span>Close cycle · business days</span>
                    <span className="!text-[var(--volt-amber)]">-1.8 since Jun</span>
                  </div>
                  <CloseTrend data={CLOSE_TREND} />
                </div>
                <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4">
                  <div className="micro mb-2">AP touchless rate · 3-way match</div>
                  <ProgressDonut value={74} target={85} label="touchless" />
                </div>
              </div>
              <div className="micro mb-2.5 mt-6">Runway narrative</div>
              <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-5 text-[13.5px] leading-relaxed text-[var(--volt-dim)]">
                Close acceleration is the binding constraint: receipt-accrual
                automation and CVR-07 intercompany governance remove an estimated
                1.4 days; the balance comes from parallelizing FA and Projects
                accounting inside the same window. The two ECL overlays stay under
                quarterly review — ask Gyan for the watchlist memo when you need it.
              </div>
            </>
          )}
          {tab === 'close' && (
            <>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <Tile label="Close day" value="6.2" sub="target 4.0" tone="amber" />
                <Tile label="Journal auto-post" value="81%" sub="recurring + allocations" />
                <Tile label="Recon auto-match" value="93%" sub="bank · intercompany" />
                <Tile label="Open tasks day 2" value="14" sub="of 61 close tasks" />
              </div>
              <div className="mt-2 rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4">
                <div className="micro mb-2 flex justify-between">
                  <span>Close cycle · 6-month trend</span>
                  <span>dashed = 4.0 target</span>
                </div>
                <CloseTrend data={CLOSE_TREND} />
              </div>
              <div className="micro mb-2.5 mt-6">Where the days go</div>
              <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4">
                <HBars
                  unit=" days"
                  labelWidth={185}
                  max={2}
                  data={[
                    { name: 'Receipt accruals', value: 1.4 },
                    { name: 'Intercompany matching', value: 1.1 },
                    { name: 'FA + Projects accounting', value: 0.9 },
                    { name: 'Review & sign-off', value: 0.8 },
                    { name: 'Consolidation & reporting', value: 0.7 },
                    { name: 'Subledger close', value: 0.7 },
                    { name: 'Revaluation & translation', value: 0.6 },
                  ]}
                />
              </div>
            </>
          )}
          {tab === 'cash' && (
            <>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <Tile label="Unapplied cash" value="$1.9M" sub="auto-match rate 91%" />
                <Tile label="DSO" value="41.3" sub="days · -2.1 QoQ" tone="green" />
                <Tile label="DPO" value="38.7" sub="days · policy 40" />
                <Tile label="ECL overlays" value="2" sub="stage-2 watchlist sectors" />
              </div>
              <div className="mt-2 rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4">
                <div className="micro mb-2">Unapplied cash by aging bucket · $M</div>
                <HBars unit="M" data={CASH_AGING} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Control (Gauntlet ledger) ---------- */

const RUBRIC = [
  ['Domain correctness', 30],
  ['Evidence integrity', 20],
  ['Artifact quality', 20],
  ['Completeness', 15],
  ['Practitioner judgment', 15],
] as const;

export function ControlView() {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <SurfaceHeader title="Control" kicker="gauntlet ledger · model routing" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1080px] px-6 py-5">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-5">
            <div className="micro mb-3">Rubric weights · %</div>
            <HBars
              unit="%"
              max={35}
              data={RUBRIC.map(([k, w]) => ({ name: k, value: w }))}
            />
          </div>
          <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-5">
            <div className="micro mb-3">Run log</div>
            <div className="rounded-md border border-[var(--volt-line)] bg-[var(--volt-panel-2)] p-4">
              <div className="flex items-baseline justify-between">
                <span className="tnum font-mono text-[13px]">R-001</span>
                <span
                  className="tnum text-[22px] font-semibold"
                  style={{ color: 'var(--volt-amber)' }}
                >
                  90.5
                </span>
              </div>
              <div className="mt-1 text-xs leading-relaxed text-[var(--volt-dim)]">
                Kimi · grounded arm · Task 1 D-SIB COA · provisional, pre blind
                grading · 0 interventions · 2 self-detected rework loops
              </div>
            </div>
            <div className="micro mb-2 mt-5">R-001 dimension scores · provisional</div>
            <HBars
              labelWidth={190}
              max={30}
              data={[
                { name: 'Domain correctness /30', value: 28 },
                { name: 'Evidence integrity /20', value: 18.5 },
                { name: 'Artifact quality /20', value: 18 },
                { name: 'Completeness /15', value: 13 },
                { name: 'Practitioner judgment /15', value: 13 },
              ]}
            />
            <div className="micro mb-2 mt-5">Findings</div>
            <div className="space-y-2 text-[12.5px] leading-relaxed text-[var(--volt-dim)]">
              <div>
                <span className="tnum font-mono text-[var(--volt-text)]">F-01</span>{' '}
                Golden reference defect — account 550000 placed outside its own
                declared block; caught by the workbook's own COUNTIFS, fixed by
                widening, logged not hidden.
              </div>
              <div>
                <span className="tnum font-mono text-[var(--volt-text)]">F-02</span>{' '}
                Header literal collided with a spreadsheet error token; renamed,
                gate re-run clean.
              </div>
            </div>
          </div>
        </div>
        <div className="micro mb-2.5 mt-6">Decision rule</div>
        <div className="rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-5 text-[13.5px] leading-relaxed text-[var(--volt-dim)]">
          Route production work to the model that wins the Gauntlet on weighted
          score, provided the margin is ≥ 5 points and evidence integrity is
          not the losing dimension. Below that margin, route by task class:
          long-context evidence tasks to the grounded winner, greenfield app
          builds to the artifact-quality winner. All six tasks and both arms
          must complete before routing changes.
        </div>
        </div>
      </div>
    </div>
  );
}
