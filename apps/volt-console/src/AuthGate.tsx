import { useEffect, useState, type ReactNode } from "react";
import type { User } from "../shared/records";
import { SIGNED_OUT, authStatus, changePassword, setUp, signIn } from "./api";
import { UserContext } from "./user";
import { App } from "./App";

type State = { phase: "loading" } | { phase: "setup" } | { phase: "signin"; notice?: string } | { phase: "in"; user: User };

/** Shows first-run setup or sign-in until there is a signed-in user, then the app. */
export function AuthGate() {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [error, setError] = useState("");

  useEffect(() => {
    authStatus().then(
      (s) => setState(s.user ? { phase: "in", user: s.user } : s.setupRequired ? { phase: "setup" } : { phase: "signin" }),
      (e) => setError(String(e)),
    );
    const out = () => setState((s) => (s.phase === "in" ? { phase: "signin", notice: "Your session ended. Please sign in again." } : s));
    window.addEventListener(SIGNED_OUT, out);
    return () => window.removeEventListener(SIGNED_OUT, out);
  }, []);

  if (error) return <div className="empty">Could not reach the VOLT server: {error}</div>;
  if (state.phase === "loading") return <div className="empty"><span className="spinner" /> Loading...</div>;
  if (state.phase === "setup") return <SetupScreen onDone={(user) => setState({ phase: "in", user })} />;
  if (state.phase === "signin") return <SignInScreen notice={state.notice} onDone={(user) => setState({ phase: "in", user })} />;
  return (
    <UserContext.Provider value={state.user}>
      <App onSignedOut={() => setState({ phase: "signin", notice: "You are signed out." })} />
    </UserContext.Provider>
  );
}

function Screen({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="card stack" style={{ width: "min(420px, 100%)", padding: 24 }}>
        <div>
          <div className="brand" style={{ marginBottom: 8 }}>
            <b>VOLT</b> <span className="muted">Agentic Console</span>
          </div>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">{sub}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

const Field = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label className="stack" style={{ gap: 4 }}>
    <span className="micro">{label}</span>
    <input className="input" aria-label={label} {...props} />
  </label>
);

function SignInScreen({ notice, onDone }: { notice?: string; onDone: (u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      onDone(await signIn(email, password));
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Sign in" sub={notice ?? "Use the account your VOLT admin set up for you."}>
      <form className="stack" onSubmit={submit}>
        <Field label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <div className="body" style={{ fontSize: 13 }}>{err}</div>}
        <button className="btn primary" disabled={busy || !email || !password}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <span className="muted" style={{ fontSize: 12 }}>Forgot your password? Ask an admin to set a new one.</span>
      </form>
    </Screen>
  );
}

function SetupScreen({ onDone }: { onDone: (u: User) => void }) {
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.confirm) return setErr("The two passwords don't match.");
    setBusy(true);
    setErr("");
    try {
      onDone(await setUp(f.name, f.email, f.password));
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Create the admin account" sub="This is the first sign-in for this VOLT console. The admin can add other people, and owns the engagements and runs saved so far.">
      <form className="stack" onSubmit={submit}>
        <Field label="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        <Field label="Email" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="Password (at least 10 characters)" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <Field label="Confirm password" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        {err && <div className="body" style={{ fontSize: 13 }}>{err}</div>}
        <button className="btn primary" disabled={busy || !f.name || !f.email || f.password.length < 10}>
          {busy ? "Creating..." : "Create admin account"}
        </button>
      </form>
    </Screen>
  );
}

/** Change-your-own-password panel, shown from the user menu. */
export function ChangePassword({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ current: "", password: "", confirm: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.password !== f.confirm) return setMsg("The two new passwords don't match.");
    setBusy(true);
    try {
      await changePassword(f.current, f.password);
      setMsg("Password changed. Other signed-in sessions were signed out.");
      setF({ current: "", password: "", confirm: "" });
    } catch (x) {
      setMsg(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Change password" style={{ width: "min(420px, 100vw)" }}>
        <div className="drawer-head">
          <h2 className="page-title">Change password</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <form className="stack" onSubmit={submit}>
          <Field label="Current password" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
          <Field label="New password (at least 10 characters)" type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Field label="Confirm new password" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          {msg && <div className="body" style={{ fontSize: 13 }}>{msg}</div>}
          <button className="btn primary" disabled={busy || !f.current || f.password.length < 10}>
            Change password
          </button>
        </form>
      </aside>
    </>
  );
}
