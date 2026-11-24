import { useState } from "react";
import { signIn, signInUser } from "../api";

/** Shown when the server asks for the access token. The token goes to /api/login, never into a URL. */
export function SignIn({ onSignedIn, mode = "token" }: { onSignedIn: () => void; mode?: "token" | "username" }) {
  const byName = mode === "username";
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    const message = await (byName ? signInUser(token.trim()) : signIn(token));
    setBusy(false);
    if (message) setError(message);
    else onSignedIn();
  };

  return (
    <div className="signin">
      <form className="card signin-card" onSubmit={submit}>
        <img className="signin-logo" src="/brand/volt-logo-black.png" alt="VOLT" />
        <h1 className="page-title">Sign in</h1>
        <p className="page-sub">{byName ? "Enter your username to open this VOLT Console." : "Enter the access token for this VOLT Console."}</p>
        <input className="input" type={byName ? "text" : "password"} name={byName ? "username" : "token"} autoComplete={byName ? "username" : "current-password"} autoFocus placeholder={byName ? "Username" : "Access token"} value={token} onChange={(e) => setToken(e.target.value)} aria-label={byName ? "Username" : "Access token"} />
        {error && <div className="run-errors" role="alert">{error}</div>}
        <button className="btn primary" type="submit" disabled={!token.trim() || busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
