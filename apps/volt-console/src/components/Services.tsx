import { useMemo, useState } from "react";
import type { CatalogResponse, RunKind, RunRequest } from "../../shared/events";
import { WorkflowLauncher } from "./Workflows";

interface Props {
  catalog: CatalogResponse;
  live: boolean;
  onOpenAgent: (id: string) => void;
  onLaunch: (req: RunRequest, title: string, kind: RunKind) => void;
}

/** VOLT consulting services catalogue: practice → sub-practice → service, with agent/workflow coverage. */
export function Services({ catalog, live, onOpenAgent, onLaunch }: Props) {
  const [practice, setPractice] = useState("");
  const [selection, setSelection] = useState<{workflow: string; service: string} | null>(null);
  const practices = useMemo(() => [...new Set(catalog.services.map((s) => s.practice))], [catalog]);
  const services = catalog.services.filter((s) => !practice || s.practice === practice);
  const bySub = new Map<string, typeof services>();
  for (const s of services) bySub.set(`${s.practice} › ${s.subPractice}`, [...(bySub.get(`${s.practice} › ${s.subPractice}`) ?? []), s]);
  const agentName = (id: string) => catalog.agents.find((a) => a.id === id)?.name ?? id;
  const wf = (id: string) => catalog.workflows.find((w) => w.id === id);
  const selected = selection && wf(selection.workflow);
  if (selection && selected) return <WorkflowLauncher catalog={catalog} live={live} wf={selected}
    initialPrompt={`${selection.service}: `} backLabel="Back to services" onBack={() => setSelection(null)}
    onOpenAgent={onOpenAgent} onLaunch={onLaunch} />;

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Consulting Services</h1>
        <p className="page-sub">
          The {catalog.services.length} services in VOLT's catalogue, each mapped to the agents, workflows and skills that deliver it.
          Coverage: {Object.entries(catalog.health.servicesByCoverage).map(([k, v]) => `${v} ${k}`).join(" · ")}.
        </p>
      </div>
      <div className="row">
        <button type="button" className={`chip click${!practice ? " on" : ""}`} aria-pressed={!practice} onClick={() => setPractice("")}>
          All
        </button>
        {practices.map((p) => (
          <button type="button" key={p} className={`chip click${practice === p ? " on" : ""}`} aria-pressed={practice === p} onClick={() => setPractice(p)}>
            {p}
          </button>
        ))}
      </div>
      {[...bySub.entries()].map(([group, list]) => (
        <div key={group} className="stack" style={{ gap: 8 }}>
          <div className="micro">{group}</div>
          <div className="card table-wrap" style={{ padding: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Coverage</th>
                  <th>Agents</th>
                  <th>Run</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.code}>
                    <td style={{ minWidth: 240 }}>
                      <b>{s.name}</b> <span className="muted">{s.code}</span>
                      <div className="body" style={{ fontSize: "var(--fs-3)" }}>
                        {s.description}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.coverage}`}>{s.coverage}</span>
                    </td>
                    <td>
                      <div className="row">
                        {s.agents.map((a) => (
                          <button type="button" key={a} className="chip click" onClick={() => onOpenAgent(a)}>
                            {agentName(a)}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="stack" style={{ gap: 4 }}>
                        {s.workflows.filter(wf).map((w) => (
                          <button
                            key={w}
                            className="btn sm"
                            onClick={() => setSelection({ workflow: w, service: s.name })}
                          >
                            ▸ {wf(w)!.name}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
