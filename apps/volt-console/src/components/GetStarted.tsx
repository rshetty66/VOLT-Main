import { useEffect, useState } from "react";
import { setupProgress, type SetupStep } from "../setup";
import { Icon } from "./Icon";

/** A collapsible checklist with a vertical timeline. The first unfinished step is opened with its action. */
export function GetStarted({ steps, onGo }: { steps: SetupStep[]; onGo: (s: SetupStep) => void }) {
  const [open, setOpen] = useState(() => localStorage.getItem("volt.setup.open") !== "no");
  // The setup pill in the top bar opens this list.
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("volt:setup-open", show);
    return () => window.removeEventListener("volt:setup-open", show);
  }, []);
  const { done, total, next } = setupProgress(steps);
  const toggle = () => {
    localStorage.setItem("volt.setup.open", open ? "no" : "yes");
    setOpen(!open);
  };
  return (
    <section className="setup" aria-label="Get started">
      <button className="setup-head" aria-expanded={open} onClick={toggle}>
        <span>Get started · {done} of {total}</span>
        <span className={open ? "flip" : ""}><Icon name="down" /></span>
      </button>
      {open && (
        <ol className="timeline">
          {steps.map((s) => {
            const current = s.id === next?.id;
            return (
              <li key={s.id} className={`tl ${s.done ? "done" : current ? "current" : ""}`}>
                <span className="tl-dot" aria-hidden="true">{s.done && <Icon name="check" size={13} />}</span>
                <div className="tl-body">
                  {current ? (
                    <>
                      <div className="tl-title">{s.title}</div>
                      <p className="tl-hint">{s.hint}</p>
                      <button className="btn light" onClick={() => onGo(s)}>{s.cta}</button>
                    </>
                  ) : (
                    <button className="tl-row" disabled={s.done || !s.cta} onClick={() => onGo(s)}>
                      <span>{s.title}</span>
                      {!s.done && <Icon name="chevron" size={16} />}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
