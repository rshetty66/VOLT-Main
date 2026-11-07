import type { Check } from "../../shared/coa";

export function Checks({ checks, title }: { checks: Check[]; title: string }) {
  const failing = checks.filter((c) => !c.ok).length;
  return (
    <div className="card">
      <div className="row between">
        <span className="micro">{title}</span>
        <span className={failing ? "badge bad" : "badge good"}>{checks.length === 0 ? "no data" : failing ? `${failing} failing` : "all pass"}</span>
      </div>
      <ul className="checks">
        {checks.map((c) => (
          <li key={c.id} className={c.ok ? "pass" : "fail"}>
            <span className="verdict">{c.ok ? "PASS" : "FAIL"}</span>
            <span><code>{c.id}</code> <span className="body">{c.detail}</span></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
