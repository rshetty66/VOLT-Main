import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Run } from "../runState";
import { HUB, STATIONS, iso, stageScene, toolStation, type Station, type StationId } from "../agentStage";

/**
 * The Agent Stage: a small isometric floor under a running chat where Rudra plans from the centre, specialists walk to
 * desks, and each tool call sends the agent to its station. Drawn in SVG and CSS 3D (no library); every move comes
 * from the run state. With reduced motion agents jump instead of walking; on a phone it becomes a rail of cards.
 */

const W = 640;
const H = 420;

const ICONS: Record<StationId, string> = {
  web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
  analytics: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  kb: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7",
  files: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4",
  gates: "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
};

const pts = (ps: { x: number; y: number }[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");

function Box({ b, color, top = 0.16 }: { b: { i: number; j: number; w: number; d: number; h: number }; color: string; top?: number }) {
  const { i, j, w, d, h } = b;
  return (
    <g>
      <polygon points={pts([iso(i, j + d, h), iso(i + w, j + d, h), iso(i + w, j + d), iso(i, j + d)])} fill={color} fillOpacity={0.22} stroke="rgba(255,255,255,.12)" />
      <polygon points={pts([iso(i + w, j, h), iso(i + w, j + d, h), iso(i + w, j + d), iso(i + w, j)])} fill={color} fillOpacity={0.32} stroke="rgba(255,255,255,.12)" />
      <polygon className="as-top" points={pts([iso(i, j, h), iso(i + w, j, h), iso(i + w, j + d, h), iso(i, j + d, h)])} fill={color} fillOpacity={top} stroke={color} />
    </g>
  );
}

/** The floor, hub and stations: drawn once, never changes. */
function Floor() {
  const tiles = [];
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++)
      tiles.push(<polygon key={`${i}-${j}`} points={pts([iso(i, j), iso(i + 1, j), iso(i + 1, j + 1), iso(i, j + 1)])} fill={(i + j) % 2 ? "#1b2032" : "#181c2c"} stroke="rgba(0,229,255,.07)" />);
  return (
    <svg className="as-floor" width={W} height={H} aria-hidden="true">
      <polygon points={pts([iso(0, 8), iso(8, 8), iso(8, 8, -14), iso(0, 8, -14)])} fill="#11141f" stroke="rgba(255,255,255,.08)" />
      <polygon points={pts([iso(8, 0), iso(8, 8), iso(8, 8, -14), iso(8, 0, -14)])} fill="#0d1018" stroke="rgba(255,255,255,.08)" />
      {tiles}
      <polygon className="as-ring" points={pts([iso(2.6, 2.6), iso(5.4, 2.6), iso(5.4, 5.4), iso(2.6, 5.4)])} fill="none" />
      <Box b={HUB} color="#d4af37" top={0.2} />
      {STATIONS.map((s) => (
        <Box key={s.id} b={s} color={s.color} />
      ))}
    </svg>
  );
}

function StationMarks({ live }: { live: Set<StationId> }) {
  return (
    <>
      {STATIONS.map((s: Station) => {
        const c = iso(s.i + s.w / 2, s.j + s.d / 2, s.h);
        return (
          <div key={s.id}>
            <div className={`as-icon as-${s.id}${live.has(s.id) ? " live" : ""}`} style={{ left: c.x, top: c.y - 14 }}>
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[s.id]} /></svg>
            </div>
            {/* The low gates sit beside the desks, so their label goes under the station instead of over it. */}
            <div className="as-label" style={{ left: c.x, top: s.id === "gates" ? iso(s.i + s.w / 2, s.j + s.d / 2).y + 22 : c.y - 50 }}>{s.label}</div>
          </div>
        );
      })}
    </>
  );
}

interface Flyer {
  key: string;
  kind: "packet" | "file";
  from: { x: number; y: number };
  to: { x: number; y: number };
  label?: string;
}

/** Whether the user asked the system for less motion. */
function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AgentStage({ run, gates }: { run: Run; gates?: { passed: number; total: number } }) {
  const scene = stageScene(run, gates);
  const live = new Set(scene.live);
  const shell = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tilt, setTilt] = useState("");
  const [inView, setInView] = useState(true);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const seen = useRef<Set<string> | null>(null);

  // Fit the fixed 640 x 420 world to the column.
  useLayoutEffect(() => {
    const el = shell.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1.15, (el.clientWidth || W) / W));
    fit();
    if (typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pause the animations while the stage is scrolled out of view.
  useEffect(() => {
    const el = shell.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // A tool call that just finished sends a packet back to its agent; a finished file rises from the press.
  useEffect(() => {
    const done = [run.activity.map((a) => ({ a, lane: "rudra" })), ...run.laneOrder.map((id) => (run.lanes[id]?.activity ?? []).map((a) => ({ a, lane: id })))]
      .flat()
      .filter(({ a }) => a.kind === "tool" && !a.pending);
    if (seen.current === null) {
      // Runs loaded from history start settled: nothing flies.
      seen.current = new Set(done.map(({ a }) => a.id));
      return;
    }
    const fresh = done.filter(({ a }) => !seen.current!.has(a.id));
    if (!fresh.length) return;
    fresh.forEach(({ a }) => seen.current!.add(a.id));
    if (reducedMotion()) return;
    const add: Flyer[] = [];
    for (const { a, lane } of fresh) {
      const st = STATIONS.find((s) => s.id === toolStation(a.text));
      const agent = scene.agents.find((g) => g.id === lane);
      if (!st || !agent) continue;
      const from = iso(st.i + st.w / 2, st.j + st.d / 2, st.h + 8);
      if (st.id === "files") {
        const ext = /\.([a-z0-9]+)\s*$/i.exec(a.detail ?? "")?.[1]?.toUpperCase() ?? "FILE";
        add.push({ key: `${a.id}-f`, kind: "file", from, to: { x: from.x, y: from.y - 70 }, label: ext });
      }
      add.push({ key: a.id, kind: "packet", from, to: iso(agent.pos[0], agent.pos[1], agent.pos[2] + (agent.lead ? 50 : 38)) });
    }
    if (!add.length) return;
    setFlyers((f) => [...f, ...add]);
    const t = setTimeout(() => setFlyers((f) => f.filter((x) => !add.includes(x))), 1200);
    return () => clearTimeout(t);
  }, [run, scene.agents]);

  const onMove = (e: React.MouseEvent) => {
    if (reducedMotion()) return;
    const r = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width - 0.5;
    const dy = (e.clientY - r.top) / r.height - 0.5;
    setTilt(`perspective(1400px) rotateX(${(-dy * 5).toFixed(2)}deg) rotateY(${(dx * 7).toFixed(2)}deg)`);
  };

  const ringOn = run.state === "running" && run.phases.some((p) => p?.state === "running");

  return (
    <div className="agent-stage">
      <div
        ref={shell}
        className={`as-shell${inView ? "" : " paused"}`}
        style={{ height: H * scale }}
        onMouseMove={onMove}
        onMouseLeave={() => setTilt("")}
        aria-hidden="true"
      >
        <div className="as-world" style={{ transform: `scale(${scale})`, left: `calc(50% - ${(W * scale) / 2}px)` }}>
          <div className={`as-tilt${ringOn ? " ring-on" : ""}`} style={{ transform: tilt }}>
            <Floor />
            <StationMarks live={live} />
            {scene.agents.map((a) => {
              const p = iso(a.pos[0], a.pos[1], a.pos[2]);
              const cls = ["as-bot", a.lead && "lead", a.thinking && "thinking", a.working && "working", a.alert && "alert", a.state !== "running" && a.state].filter(Boolean).join(" ");
              return (
                <div key={a.id} className={cls} style={{ left: p.x, top: p.y, zIndex: Math.round((a.pos[0] + a.pos[1]) * 10) + (a.pos[2] ? 5 : 0), ["--c" as string]: a.color }}>
                  <div className="ring" />
                  <div className="shadow" />
                  <div className="fig">
                    <div className="head">
                      <i className="f1" /><i className="f2" /><i className="f3" /><i className="f4" /><i className="f5" /><i className="f6" />
                    </div>
                    <div className="body" />
                  </div>
                  <div className="dots"><b /><b /><b /></div>
                  {a.state !== "running" && <div className="badge">{a.state === "done" ? "✓" : "!"}</div>}
                  <div className="name">{a.name}</div>
                  {a.bubble && <div className="bubble" key={a.bubble}>{a.bubble}</div>}
                </div>
              );
            })}
            {flyers.map((f) => (
              <Fly key={f.key} f={f} />
            ))}
          </div>
        </div>
      </div>
      <div className="as-rail" aria-hidden="true">
        {scene.agents.map((a) => (
          <div key={a.id} className={`as-card ${a.state}`} style={{ ["--c" as string]: a.color }}>
            <div className="mini" />
            <div>
              <b>{a.name}</b>
              <span>{a.bubble}</span>
            </div>
          </div>
        ))}
      </div>
      <ul className="as-now" aria-label="What each agent is doing">
        {scene.agents.map((a) => (
          <li key={a.id} className={a.state}>
            <i />
            <b>{a.name}</b> <span>{a.bubble}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A packet or file chip that moves from its station to its target once, then is removed by the parent. */
function Fly({ f }: { f: Flyer }) {
  const [at, setAt] = useState(f.from);
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAt(f.to)));
    return () => cancelAnimationFrame(r);
  }, [f.to]);
  return f.kind === "file" ? (
    <div className="as-filechip" style={{ left: at.x, top: at.y, opacity: at === f.from ? 1 : 0 }}>{f.label}</div>
  ) : (
    <div className="as-packet" style={{ left: at.x, top: at.y }} />
  );
}
