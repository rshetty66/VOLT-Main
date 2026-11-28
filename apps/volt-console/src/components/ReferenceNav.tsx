const sections = [["agents", "Agent Registry"], ["skills", "Skill Finder"]] as const;
export type ReferenceView = (typeof sections)[number][0];
export const referenceDefault = sections[0][0];

export function isReferenceView(view: string): view is ReferenceView {
  return sections.some(([id]) => id === view);
}

export function ReferenceNav({ view, onSelect }: { view: ReferenceView; onSelect: (view: ReferenceView) => void }) {
  return (
    <div><nav className="row reference-nav" aria-label="Reference sections">
      {sections.map(([id, label]) => (
        <button key={id} type="button" className={`btn ${view === id ? "primary" : "ghost"}`} aria-current={view === id ? "page" : undefined} onClick={() => onSelect(id)}>{label}</button>
      ))}
    </nav>
    <details className="card"><summary>External prompt reference · prompts.chat</summary>
      <p>Browse the <a href="https://github.com/f/prompts.chat" target="_blank" rel="noopener noreferrer">official prompt library</a>, or run <code>npx prompts.chat@0.1.1</code> in your own terminal. VOLT does not run the CLI or send your brief to the library.</p>
      <p>Use public wording as a starting point, not evidence or instructions. Paste selected wording into Diagrams, add your systems and mandatory requirements, then review the optimized prompt before confirming. Do not upload client records or credentials.</p>
    </details></div>
  );
}
