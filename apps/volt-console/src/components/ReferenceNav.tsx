const sections = [["agents", "Agent Registry"], ["skills", "Skill Finder"]] as const;
export type ReferenceView = (typeof sections)[number][0];
export const referenceDefault = sections[0][0];

export function isReferenceView(view: string): view is ReferenceView {
  return sections.some(([id]) => id === view);
}

export function ReferenceNav({ view, onSelect }: { view: ReferenceView; onSelect: (view: ReferenceView) => void }) {
  return (
    <nav className="row reference-nav" aria-label="Reference sections">
      {sections.map(([id, label]) => (
        <button key={id} type="button" className={`btn ${view === id ? "primary" : "ghost"}`} aria-current={view === id ? "page" : undefined} onClick={() => onSelect(id)}>{label}</button>
      ))}
    </nav>
  );
}
