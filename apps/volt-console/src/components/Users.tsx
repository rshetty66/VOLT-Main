import { useEffect, useState } from "react";
import type { AuditEntry, Role, User } from "../../shared/records";
import { addUser, listAudit, listUsers, resetPassword, updateUser } from "../api";
import { useUser } from "../user";

const ROLES: { value: Role; label: string; hint: string }[] = [
  { value: "admin", label: "Admin", hint: "Everything, including people and all engagements" },
  { value: "consultant", label: "Consultant", hint: "Own and shared engagements: run, resume, export, templates" },
  { value: "viewer", label: "Viewer", hint: "Read and download shared engagements only" },
];
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "never");

/** Admin screen: people, their roles and passwords, and recent activity. */
export function Users() {
  const me = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [err, setErr] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [note, setNote] = useState("");
  const load = () => {
    listUsers().then(setUsers, (e) => setErr(String(e)));
    listAudit(100).then(setAudit, () => {});
  };
  useEffect(load, []);
  const act = (p: Promise<unknown>, done?: string) =>
    p.then(
      () => {
        setErr("");
        if (done) setNote(done);
        load();
      },
      (e) => setErr(e instanceof Error ? e.message : String(e)),
    );
  const name = (id: string | null) => users.find((u) => u.id === id)?.name ?? "someone";

  return (
    <div className="stack" style={{ maxWidth: 1100 }}>
      <div>
        <h1 className="page-title">Users</h1>
        <p className="page-sub">People who can sign in to this VOLT console, their roles, and recent activity. Accounts are disabled rather than deleted, so their history stays.</p>
      </div>
      <NewUser onAdded={(u) => act(Promise.resolve(), `${u.name} added. Share their email and temporary password with them; they can change it from the user menu.`)} />
      {err && <div className="card body">{err}</div>}
      {note && <div className="card body">{note}</div>}
      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={u.disabled ? { opacity: 0.55 } : undefined}>
                <td>
                  <b>{u.name}</b>
                  {u.id === me?.id && <span className="muted"> (you)</span>}
                </td>
                <td>{u.email}</td>
                <td>
                  <select className="select" style={{ width: "auto" }} aria-label={`Role for ${u.name}`} value={u.role} onChange={(e) => act(updateUser(u.id, { role: e.target.value as Role }))}>
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.disabled ? "Disabled" : "Active"}</td>
                <td className="muted">{when(u.lastLoginAt)}</td>
                <td>
                  <div className="row" style={{ gap: 4, flexWrap: "nowrap" }}>
                    {resetFor === u.id ? (
                      <>
                        <input className="input" type="password" aria-label={`New password for ${u.name}`} placeholder="New password" style={{ width: 160 }} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        <button
                          className="btn sm"
                          disabled={newPassword.length < 10}
                          onClick={() => act(resetPassword(u.id, newPassword).then(() => (setResetFor(null), setNewPassword(""))), `New password set for ${u.name}; their other sessions were signed out.`)}
                        >
                          Save
                        </button>
                        <button className="btn ghost sm" onClick={() => setResetFor(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button className="btn sm" onClick={() => (setResetFor(u.id), setNewPassword(""))}>
                        Set password
                      </button>
                    )}
                    {u.id !== me?.id && (
                      <button className="btn ghost sm" onClick={() => act(updateUser(u.id, { disabled: !u.disabled }))}>
                        {u.disabled ? "Enable" : "Disable"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="micro">Roles</div>
      <div className="row" style={{ gap: 16 }}>
        {ROLES.map((r) => (
          <span key={r.value} className="body" style={{ fontSize: 12 }}>
            <b>{r.label}:</b> {r.hint}
          </span>
        ))}
      </div>
      <div className="micro" style={{ marginTop: 8 }}>Recent activity</div>
      <div className="card table-wrap" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {audit.map((a) => (
              <tr key={a.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{when(a.at)}</td>
                <td>{a.userName ?? (a.userId ? name(a.userId) : "-")}</td>
                <td>{a.action.replace(/_/g, " ")}</td>
                <td className="muted" style={{ fontSize: 12 }}>
                  {a.detail ? Object.entries(a.detail).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}: ${String(v)}`).join(", ") : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewUser({ onAdded }: { onAdded: (u: User) => void }) {
  const [f, setF] = useState({ name: "", email: "", role: "consultant" as Role, password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      onAdded(await addUser(f));
      setF({ name: "", email: "", role: "consultant", password: "" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack">
      <div className="micro">Add a person</div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <input className="input" style={{ flex: 1, minWidth: 160 }} aria-label="New user name" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" style={{ flex: 1, minWidth: 200 }} aria-label="New user email" placeholder="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <select className="select" style={{ width: "auto" }} aria-label="New user role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input className="input" style={{ flex: 1, minWidth: 180 }} aria-label="Temporary password" placeholder="Temporary password (10+ characters)" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button className="btn primary" disabled={busy || !f.name || !f.email || f.password.length < 10} onClick={submit}>
          Add
        </button>
      </div>
      {err && <span className="body" style={{ fontSize: 12 }}>{err}</span>}
    </div>
  );
}
