import { useState } from "react";
import { DELIVERABLE_CHOICES, PROMPT_SECTIONS, deliverablesOf, joinSections, splitSections, withDeliverables, type Optimized, type SectionKey, type Sections } from "../../shared/optimize";
import { Icon } from "./Icon";

interface Props {
  result: Optimized;
  /** The prompt as it will be sent; the parent keeps it so Send always sends what is on screen. */
  text: string;
  onText: (text: string) => void;
  files: string[];
  disabled: boolean;
  onSend: () => void;
  onSendOriginal: () => void;
  onCancel: () => void;
}

/**
 * The optimized prompt as an input screen: the business ask on top, then one editable field per section. A section can
 * be skipped (Undo brings it back), Select all restores every section, and the Output Format field has deliverable chips
 * with Other. "Plain text" shows the same prompt as one box, so nothing is lost if the reply had no known headings.
 */
export function PromptReview({ result, text, onText, files, disabled, onSend, onSendOriginal, onCancel }: Props) {
  const sections = splitSections(text);
  const [plain, setPlain] = useState(!sections);
  const [skipped, setSkipped] = useState<Sections>({});
  const [other, setOther] = useState<string | null>(null);
  const write = (next: Sections) => onText(joinSections(next));
  const set = (key: SectionKey, value: string) => sections && write({ ...sections, [key]: value });
  const skip = (key: SectionKey) => {
    if (!sections) return;
    setSkipped((s) => ({ ...s, [key]: sections[key] ?? "" }));
    write({ ...sections, [key]: "" });
  };
  const undo = (keys: SectionKey[]) => {
    if (!sections) return;
    const next = { ...sections };
    for (const k of keys) next[k] = skipped[k] ?? "";
    setSkipped((s) => Object.fromEntries(Object.entries(s).filter(([k]) => !keys.includes(k as SectionKey))));
    write(next);
  };
  const skippedKeys = Object.keys(skipped) as SectionKey[];
  const picked = deliverablesOf(sections?.output ?? "");
  const toggle = (d: string) => set("output", withDeliverables(sections?.output ?? "", picked.includes(d) ? picked.filter((x) => x !== d) : [...picked, d]));
  const custom = picked.filter((d) => !DELIVERABLE_CHOICES.includes(d));

  return (
    <div className="card optimize-card pr" role="region" aria-label="Review your prompt">
      <div className="pr-head">
        <span className="pr-badge" aria-hidden="true"><Icon name="spark" size={16} /></span>
        <div className="pr-ask">
          <div className="micro">Review your prompt · business ask</div>
          <h2>{result.ask}</h2>
        </div>
        <div className="pr-mode" role="radiogroup" aria-label="View">
          <button type="button" role="radio" aria-checked={!plain} className={`chip click intake-chip${!plain ? " on" : ""}`} disabled={!sections} onClick={() => setPlain(false)}>Form</button>
          <button type="button" role="radio" aria-checked={plain} className={`chip click intake-chip${plain ? " on" : ""}`} onClick={() => setPlain(true)}>Plain text</button>
        </div>
      </div>
      {result.assumptions.length > 0 && (
        <div className="pr-assume"><span className="micro">Assumed</span>{result.assumptions.map((a) => <span key={a} className="chip">{a}</span>)}</div>
      )}

      {plain || !sections ? (
        <textarea className="textarea pr-plain" aria-label="Optimized prompt" value={text} onChange={(e) => onText(e.target.value)} />
      ) : (
        <div className="pr-grid">
          {PROMPT_SECTIONS.map((s, i) => {
            const isSkipped = s.key in skipped;
            return (
              <div key={s.key} className={`pr-field${s.key === "context" ? " wide" : ""}${isSkipped ? " off" : ""}`}>
                <div className="pr-label">
                  <span className="pr-num">{i + 1}</span>
                  <b>{s.title}</b>
                  <span className="pr-hint">{s.hint}</span>
                  {isSkipped
                    ? <button type="button" className="btn ghost sm" onClick={() => undo([s.key])}>Undo</button>
                    : <button type="button" className="btn ghost sm" aria-label={`Skip: ${s.title}`} onClick={() => skip(s.key)}>Skip</button>}
                </div>
                {isSkipped ? <div className="muted pr-skipped">Skipped. Left out of the prompt.</div> : (
                  <>
                    {s.key === "output" && (
                      <div className="intake-chips pr-chips">
                        {DELIVERABLE_CHOICES.map((d) => (
                          <button key={d} type="button" role="checkbox" aria-checked={picked.includes(d)} className={`chip click intake-chip${picked.includes(d) ? " on" : ""}`} onClick={() => toggle(d)}>{d}</button>
                        ))}
                        {custom.map((d) => <button key={d} type="button" role="checkbox" aria-checked className="chip click intake-chip on" onClick={() => toggle(d)}>{d}</button>)}
                        {other === null
                          ? <button type="button" className="chip click intake-chip" onClick={() => setOther("")}>Other</button>
                          : <input className="input intake-other" autoFocus maxLength={60} aria-label="Other deliverable" placeholder="Type and press Enter" value={other}
                              onChange={(e) => setOther(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && other.trim()) { toggle(other.trim()); setOther(null); }
                                if (e.key === "Escape") setOther(null);
                              }} />}
                      </div>
                    )}
                    <textarea className="textarea pr-input" aria-label={s.title} value={sections[s.key] ?? ""} onChange={(e) => set(s.key, e.target.value)} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="row pr-foot">
        <span className="muted pr-note">
          {files.length > 0 ? `Attached: ${files.join(", ")} · ` : ""}Nothing runs until you send.
          {!plain && sections && skippedKeys.length > 0 && <> · <button type="button" className="btn ghost sm" onClick={() => undo(skippedKeys)}>Select all</button></>}
        </span>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={disabled} onClick={onSendOriginal}>Skip all, send my original</button>
        <button className="btn primary" disabled={disabled || !text.trim()} onClick={onSend}><Icon name="send" size={14} /> Send prompt</button>
      </div>
    </div>
  );
}
