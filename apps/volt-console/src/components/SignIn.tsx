import { useState } from "react";
import { signIn } from "../api";

/** Shown when the server asks for the access token. The token goes to /api/login, never into a URL. */
export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    const message = await signIn(token);
    setBusy(false);
    if (message) setError(message);
    else onSignedIn();
  };

  return (
    <div className="signin">
      <form className="card signin-card" onSubmit={submit}>
        <img className="signin-logo" src="/brand/volt-logo-black.png" alt="VOLT" />
        <h1 className="page-title">Sign in</h1>
        <p className="page-sub">Enter the access token for this VOLT Console.</p>
        <input className="input" type="password" name="token" autoComplete="current-password" autoFocus placeholder="Access token" value={token} onChange={(e) => setToken(e.target.value)} aria-label="Access token" />
        {error && <div className="run-errors" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={!token.trim() || busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
