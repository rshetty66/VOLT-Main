import { useState } from "react";
import { DELIVERABLE_CHOICES, PROMPT_SECTIONS, deliverablesOf, joinSections, splitSections, withDeliverables, type Optimized, type SectionKey, type Sections } from "../../shared/optimize";
import { BLUEPRINT, GYAN_AGENTS, blueprintBlock, isBlueprintAsk } from "../../shared/blueprint";
import { Icon } from "./Icon";

interface Props {
  result: Optimized;
  /** The prompt as it will be sent; the parent keeps it so Send always sends what is on screen. */
  text: string;
  onText: (text: string) => void;
  files: string[];
  disabled: boolean;
  /** Sends the final prompt: the sections plus, when included, the blueprint inputs. */
  onSend: (text: string) => void;
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
  const [view, setView] = useState<"form" | "text" | "blueprint">(() => (isBlueprintAsk(`${result.ask}\n${text}`) ? "blueprint" : sections ? "form" : "text"));
  const plain = view === "text";
  const [bpOn, setBpOn] = useState(view === "blueprint");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [bpSkipped, setBpSkipped] = useState<Set<string>>(new Set());
  const answered = Object.values(answers).filter((a) => a.trim()).length;
  const total = BLUEPRINT.reduce((n, b) => n + b.questions.length, 0);
  const [team, setTeam] = useState<string[]>(() => GYAN_AGENTS.map((a) => a.id));
  const finalText = bpOn ? `${text.trim()}\n\n${blueprintBlock(answers, bpSkipped, files, team)}` : text;
  const toggleBp = (id: string) => setBpSkipped((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
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
          <button type="button" role="radio" aria-checked={view === "form"} className={`chip click intake-chip${view === "form" ? " on" : ""}`} disabled={!sections} onClick={() => setView("form")}>Form</button>
          <button type="button" role="radio" aria-checked={view === "blueprint"} className={`chip click intake-chip${view === "blueprint" ? " on" : ""}`} onClick={() => { setView("blueprint"); setBpOn(true); }}><Icon name="spark" size={12} /> Intelligence Brain</button>
          <button type="button" role="radio" aria-checked={plain} className={`chip click intake-chip${plain ? " on" : ""}`} onClick={() => setView("text")}>Plain text</button>
        </div>
      </div>
      {result.assumptions.length > 0 && (
        <div className="pr-assume"><span className="micro">Assumed</span>{result.assumptions.map((a) => <span key={a} className="chip">{a}</span>)}</div>
      )}

      {view === "blueprint" ? (
        <>
          <div className="row pr-bp-bar">
            <span className="muted pr-note">Intelligence Brain · Accounting Rule Engine Blueprint · {answered} of {total} answered · {team.length} agents. Blanks go as [to confirm], never invented; attached files can stand in for a section.</span>
            <button type="button" className="btn ghost sm" disabled={bpSkipped.size === 0} onClick={() => setBpSkipped(new Set())}>Select all</button>
            <button type="button" className="btn ghost sm" onClick={() => setBpSkipped(new Set(BLUEPRINT.filter((b) => b.optional).map((b) => b.id)))}>Skip optional</button>
            <button type="button" className="btn ghost sm" onClick={() => { setBpOn(false); setView(sections ? "form" : "text"); }}>Leave out</button>
          </div>
          <div className="pr-grid">
            <div className="pr-field wide">
              <div className="pr-label">
                <span className="pr-num"><Icon name="agents" size={10} /></span>
                <b>Agent team</b>
                <span className="pr-hint">Gyan finance agents · deep research narrative on how they run the engine</span>
                <button type="button" className="btn ghost sm" onClick={() => setTeam(team.length === GYAN_AGENTS.length ? [] : GYAN_AGENTS.map((a) => a.id))}>{team.length === GYAN_AGENTS.length ? "Clear" : "Select all"}</button>
              </div>
              <div className="intake-chips pr-chips">
                {GYAN_AGENTS.map((a) => {
                  const on = team.includes(a.id);
                  return <button key={a.id} type="button" role="checkbox" aria-checked={on} title={`${a.role} (VOLT: ${a.volt})`} className={`chip click intake-chip${on ? " on" : ""}`} onClick={() => setTeam(on ? team.filter((t) => t !== a.id) : [...team, a.id])}>{a.name}</button>;
                })}
              </div>
            </div>
            {BLUEPRINT.map((b) => {
              const off = bpSkipped.has(b.id);
              const done = b.questions.filter((q) => answers[q.n]?.trim()).length;
              return (
                <div key={b.id} className={`pr-field${off ? " off" : ""}`}>
                  <div className="pr-label">
                    <span className="pr-num">{b.id}</span>
                    <b>{b.title}</b>
                    <span className="pr-hint">{b.optional ? "optional · " : ""}{done}/{b.questions.length}</span>
                    <button type="button" className="btn ghost sm" aria-label={`${off ? "Answer" : "Skip"}: ${b.title}`} onClick={() => toggleBp(b.id)}>{off ? "Undo" : "Skip"}</button>
                  </div>
                  {off ? <div className="muted pr-skipped">Skipped. Labelled defaults or [to confirm] are used.</div> : b.questions.map((q) => (
                    <label key={q.n} className="pr-q">
                      <span>{q.n}. {q.q}</span>
                      <input className="input" value={answers[q.n] ?? ""} placeholder={`[${q.field}]`} onChange={(e) => setAnswers((a) => ({ ...a, [q.n]: e.target.value }))} />
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      ) : plain || !sections ? (
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
          {files.length > 0 ? `Attached: ${files.join(", ")} · ` : ""}{bpOn ? `Intelligence Brain on (${answered}/${total}, ${team.length} agents) · ends in the blueprint, client_config.json and agent operating model · ` : ""}Nothing runs until you send.
          {!plain && sections && skippedKeys.length > 0 && <> · <button type="button" className="btn ghost sm" onClick={() => undo(skippedKeys)}>Select all</button></>}
        </span>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={disabled} onClick={onSendOriginal}>Skip all, send my original</button>
        <button className="btn primary" disabled={disabled || !text.trim()} onClick={() => onSend(finalText)}><Icon name="send" size={14} /> Send prompt</button>
      </div>
    </div>
  );
}
