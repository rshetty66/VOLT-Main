/**
 * AgentRun — inline agent-engagement card inside the conversation.
 * Shimmers while the answer streams, settles to a compact roster when done.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { AgentRef } from '@/lib/stream';

export function AgentRun({
  agents,
  working,
}: {
  agents: AgentRef[];
  working: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3 rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            working ? 'shimmer' : 'bg-[var(--volt-amber)]'
          }`}
          style={working ? { width: 14, borderRadius: 3 } : undefined}
        />
        <span className="micro !text-[var(--volt-dim)]">
          {working ? 'Engaging' : 'Engaged'} {agents.length} agent
          {agents.length > 1 ? 's' : ''}
        </span>
        <span className="flex-1 truncate text-[13px] text-[var(--volt-text)]">
          {agents.map((a) => a.name).join(' · ')}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--volt-faint)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="border-t border-[var(--volt-line-soft)] px-3.5 py-2">
          {agents.map((a) => (
            <div key={a.id} className="flex items-baseline gap-3 py-1.5">
              <span className="tnum micro w-14 shrink-0 !text-[var(--volt-faint)]">
                {a.id}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 text-[13px] font-medium text-[var(--volt-text)]">
                  {a.name}
                  {a.model && (
                    <span
                      className="micro"
                      style={{
                        color:
                          a.model.kind === 'dedicated'
                            ? 'var(--volt-amber)'
                            : a.model.kind === 'retrieval'
                              ? 'var(--volt-green)'
                              : 'var(--volt-faint)',
                      }}
                    >
                      ◆ {a.model.name}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-[var(--volt-dim)]">
                  {a.role}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
