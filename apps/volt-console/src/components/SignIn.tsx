import { useState } from "react";
import { signIn, signInUser, type AuthMode } from "../api";

/** Shown when the server asks for a sign-in. Credentials go to /api/login in the request body, never into a URL. */
export function SignIn({ onSignedIn, mode = "token" }: { onSignedIn: () => void; mode?: AuthMode }) {
  const byName = mode !== "token";
  const withPassword = mode === "password";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = withPassword ? name.trim() && password : name.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const message = await (byName ? signInUser(name.trim(), withPassword ? password : undefined) : signIn(name));
    setBusy(false);
    if (message) setError(message);
    else onSignedIn();
  };

  return (
    <div className="signin">
      <form className="card signin-card" onSubmit={submit}>
        <img className="signin-logo" src="/brand/volt-logo-black.png" alt="VOLT" />
        <h1 className="page-title">Sign in</h1>
        <p className="page-sub">{withPassword ? "Sign in with your VOLT account." : byName ? "Enter your username to open this VOLT Console." : "Enter the access token for this VOLT Console."}</p>
        <label className="field">
          <span className="micro">{byName ? "Username" : "Access token"}</span>
          <input className="input" type={byName ? "text" : "password"} name={byName ? "username" : "token"} autoComplete={byName ? "username" : "current-password"} autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {withPassword && (
          <label className="field">
            <span className="micro">Password</span>
            <input className="input" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        {error && <div className="run-errors" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={!ready || busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
        {withPassword && <p className="muted" style={{ fontSize: "var(--fs-3)", margin: 0 }}>Forgot your password? Ask the console administrator to set a new one.</p>}
      </form>
    </div>
  );
}
