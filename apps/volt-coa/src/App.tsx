import { useEffect, useState } from "react";
import { SAMPLE_COA_CSV, SAMPLE_LEGACY_CSV } from "../shared/coa";
import type { Health } from "../shared/events";
import { getHealth } from "./api";
import { Assistant } from "./components/Assistant";
import { Design } from "./components/Design";
import { Mapping } from "./components/Mapping";

type View = "design" | "mapping" | "assistant";
const VIEWS: { id: View; label: string }[] = [
  { id: "design", label: "Design" },
  { id: "mapping", label: "Mapping" },
  { id: "assistant", label: "Assistant" },
];

export function App() {
  const [view, setView] = useState<View>("design");
  const [coaCsv, setCoaCsv] = useState(SAMPLE_COA_CSV);
  const [legacyCsv, setLegacyCsv] = useState(SAMPLE_LEGACY_CSV);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => { getHealth().then(setHealth).catch(() => setHealth(null)); }, []);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><b>VOLT</b><span>COA Designer</span></div>
        <span className={`badge ${health?.mode === "live" ? "good" : ""}`}>{health ? `${health.mode} mode` : "API offline"}</span>
        {health?.mode === "live" && <span className="muted">{health.model}</span>}
      </header>
      <nav className="nav">
        {VIEWS.map((v) => (
          <button key={v.id} className={view === v.id ? "active" : ""} onClick={() => setView(v.id)}>{v.label}</button>
        ))}
      </nav>
      <main className="main">
        {view === "design" && <Design csv={coaCsv} onChange={setCoaCsv} />}
        {view === "mapping" && <Mapping coaCsv={coaCsv} csv={legacyCsv} onChange={setLegacyCsv} />}
        {view === "assistant" && (
          <Assistant coaCsv={coaCsv} legacyCsv={legacyCsv}
            onLoad={(p) => { if (p.kind === "coa") { setCoaCsv(p.csv); setView("design"); } else { setLegacyCsv(p.csv); setView("mapping"); } }} />
        )}
      </main>
    </div>
  );
}
