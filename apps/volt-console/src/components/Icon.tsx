// Small outline icons (24px grid, 1.8 stroke) for the navigation rail and status pills.
const PATHS: Record<string, string> = {
  console: "M4 5h16v11H9l-5 4zM8 9h8M8 12h5",
  workflows: "M5 4l14 8-14 8zM5 4v16",
  agents: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z",
  skills: "M10 4a6 6 0 100 12 6 6 0 000-12zM15 15l5 5",
  services: "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  templates: "M4 4h16v16H4zM4 9h16M10 9v11",
  analytics: "M5 20V12M12 20V5M19 20v-9",
  projects: "M6 3h12v18l-6-4-6 4z",
  history: "M4 13l2-8h12l2 8v6H4zM4 13h5l1 2h4l1-2h5",
  uploads: "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  ledger: "M5 4h14v16H5zM9 9l2 2 4-4M9 16h6",
  usage: "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v5c0 1.7 3.6 3 8 3M4 12v5c0 1.7 3.6 3 8 3",
  health: "M3 12h4l2-6 4 12 2-6h6",
  plus: "M12 5v14M5 12h14",
  search: "M10 4a6 6 0 100 12 6 6 0 000-12zM15 15l5 5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  chevron: "M9 6l6 6-6 6",
  down: "M6 9l6 6 6-6",
  coin: "M12 4c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 7v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7",
  warn: "M12 4l9 16H3zM12 10v4M12 17v.5",
};

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name] ?? PATHS.console} />
    </svg>
  );
}

/** A progress ring: the arc fills as steps are completed. */
export function Ring({ done, total, size = 18 }: { done: number; total: number; size?: number }) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ok-ring, #3fb950)" strokeWidth="2" strokeDasharray={c} strokeDashoffset={c * (1 - (total ? done / total : 0))} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}
