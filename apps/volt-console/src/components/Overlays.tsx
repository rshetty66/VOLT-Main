import { useEffect, useRef, useSyncExternalStore } from "react";
import { dismissToast, getConfirm, getToasts, subscribe } from "../ui";

/** Renders toasts and the confirmation dialog. Mounted once, in main.tsx. */
export function Overlays() {
  const toasts = useSyncExternalStore(subscribe, getToasts);
  const ask = useSyncExternalStore(subscribe, getConfirm);
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!ask) return;
    ok.current?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && ask.resolve(false);
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [ask]);
  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role={t.tone === "error" ? "alert" : "status"}>
            <span>{t.text}</span>
            <button className="btn ghost sm" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>×</button>
          </div>
        ))}
      </div>
      {ask && (
        <div className="drawer-backdrop" onMouseDown={() => ask.resolve(false)}>
          <div className="confirm card" role="alertdialog" aria-modal="true" aria-label="Confirm" onMouseDown={(e) => e.stopPropagation()}>
            <p style={{ margin: 0 }}>{ask.message}</p>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={() => ask.resolve(false)}>Cancel</button>
              <button ref={ok} className="btn primary" onClick={() => ask.resolve(true)}>{ask.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
