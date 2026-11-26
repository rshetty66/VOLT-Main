// Tiny pub/sub behind toasts and confirmation dialogs, so any component can call toast() or confirmDialog()
// without prop drilling. <Overlays/> (components/Overlays.tsx) renders them.
export interface Toast { id: number; text: string; tone: "info" | "error" }
export interface ConfirmRequest { id: number; message: string; confirmLabel: string; resolve: (ok: boolean) => void }

type Listener = () => void;
const listeners = new Set<Listener>();
let toasts: Toast[] = [];
let pending: ConfirmRequest | null = null;
let seq = 0;
const emit = () => listeners.forEach((l) => l());

export const subscribe = (l: Listener) => (listeners.add(l), () => void listeners.delete(l));
export const getToasts = () => toasts;
export const getConfirm = () => pending;

export function dismissToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

/** Shows a short message that clears itself after a few seconds (errors stay longer). */
export function toast(text: string, tone: Toast["tone"] = "info", ms = tone === "error" ? 8000 : 3500): number {
  const id = ++seq;
  toasts = [...toasts.slice(-3), { id, text, tone }];
  emit();
  if (ms > 0) setTimeout(() => dismissToast(id), ms);
  return id;
}

/** Asks the user to confirm. Resolves true on confirm, false on cancel or when another question replaces it. */
export function confirmDialog(message: string, confirmLabel = "Confirm"): Promise<boolean> {
  pending?.resolve(false);
  return new Promise((resolve) => {
    pending = {
      id: ++seq,
      message,
      confirmLabel,
      resolve: (ok) => {
        pending = null;
        emit();
        resolve(ok);
      },
    };
    emit();
  });
}
