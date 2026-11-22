/**
 * Rail — 56px icon rail, the VOLT desktop-app chrome.
 */
import {
  MessageSquare,
  Store,
  Layers,
  Hammer,
  Briefcase,
  Gauge,
  RotateCcw,
  Zap,
  Factory,
} from 'lucide-react';

export type Surface =
  | 'chat'
  | 'marketplace'
  | 'blueprint'
  | 'studio'
  | 'workspace'
  | 'control'
  | 'builder';

const ITEMS: { id: Surface; label: string; icon: typeof Store }[] = [
  { id: 'chat', label: 'Assistant', icon: MessageSquare },
  { id: 'builder', label: 'Builder', icon: Factory },
  { id: 'marketplace', label: 'Marketplace', icon: Store },
  { id: 'blueprint', label: 'Blueprint', icon: Layers },
  { id: 'studio', label: 'Studio', icon: Hammer },
  { id: 'workspace', label: 'Workspace', icon: Briefcase },
  { id: 'control', label: 'Control', icon: Gauge },
];

export function Rail({
  surface,
  onSurface,
  onReset,
}: {
  surface: Surface;
  onSurface: (s: Surface) => void;
  onReset: () => void;
}) {
  return (
    <nav className="flex h-full w-14 shrink-0 flex-col items-center border-r border-[var(--volt-line-soft)] bg-[#111110] py-3">
      <div
        className="mb-4 flex h-9 w-9 items-center justify-center rounded-md"
        style={{ background: 'var(--volt-amber)' }}
        title="VOLT"
      >
        <Zap size={18} strokeWidth={2.4} color="#141414" fill="#141414" />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = surface === id;
          return (
            <button
              key={id}
              onClick={() => onSurface(id)}
              title={label}
              aria-label={label}
              className={`lift flex h-10 w-10 items-center justify-center rounded-md border ${
                active
                  ? 'border-[var(--volt-line)] bg-[var(--volt-panel-2)] text-[var(--volt-amber)]'
                  : 'border-transparent text-[var(--volt-faint)] hover:text-[var(--volt-text)]'
              }`}
            >
              <Icon size={17} strokeWidth={1.8} />
            </button>
          );
        })}
      </div>
      <button
        onClick={onReset}
        title="New conversation"
        aria-label="New conversation"
        className="lift flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-[var(--volt-faint)] hover:text-[var(--volt-text)]"
      >
        <RotateCcw size={16} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
