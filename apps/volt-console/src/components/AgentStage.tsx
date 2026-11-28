import { useEffect, useRef, useState } from "react";
import type { Run } from "../runState";
import { COLUMNS, FLOW_H, FLOW_W, clip, edgeEnds, edgePath, flowScene, mergeHandoffs, toolCalls, type FlowNode, type HandoffChip, type IconId } from "../agentStage";

/**
 * The Agent Stage: a compact agent-flow graph under a running chat. Each agent lights up in its own colour when it is
 * called on, reasoning agents show a Think loop, and every hand-off sends a dot along the link (and a dot back with
 * the result). Drawn in SVG from the run state alone, so it spends no tokens. Reduced motion keeps the lights and
 * the words but drops the moving dots and flowing links.
 */

const ICONS: Record<IconId, string> = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c0-4 3.4-6 7.5-6s7.5 2 7.5 6",
  bot: "M6 9h12v10H6zM12 5v4M12 4.5h.01M9.5 13.5h.01M14.5 13.5h.01M9.5 16.5h5M4 13v3M20 13v3",
  brain: "M9.5 4A3 3 0 0 0 6.6 7.4 3 3 0 0 0 5 12.6a3 3 0 0 0 2.5 4.9A3 3 0 0 0 12 19V5.6A2.4 2.4 0 0 0 9.5 4zM14.5 4a3 3 0 0 1 2.9 3.4 3 3 0 0 1 1.6 5.2 3 3 0 0 1-2.5 4.9A3 3 0 0 1 12 19",
  web: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
  tool: "M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.4-.6-.6-2.4z",
  file: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4",
  shield: "M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  out: "M4 13l3-8h10l3 8v6H4zM4 13h5l1 2h4l1-2h5M12 4v6M9.5 7.5L12 10l2.5-2.5",
};

interface Handoff {
  key: string;
  from: string;
  to: string;
  label: string;
}

interface Packet {
  key: string;
  edge: string;
  back: boolean;
  color: string;
}

/** Whether the user asked the system for less motion. */
function reducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AgentStage({ run, gates }: { run: Run; gates?: { passed: number; total: number } }) {
  const flow = flowScene(run, gates);
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const shell = useRef<HTMLDivElement>(null);
  const paths = useRef(new Map<string, SVGPathElement>());
  const [inView, setInView] = useState(true);
  const [ticker, setTicker] = useState<HandoffChip[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const seen = useRef<Set<string> | null>(null);

  // Pause the animations while the stage is scrolled out of view.
  useEffect(() => {
    const el = shell.current;
    if (!el || typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // New hand-offs (a specialist briefed, a tool called, a result back) feed the chips and send a dot along the link.
  useEffect(() => {
    const events: (Handoff & { back: boolean })[] = [];
    for (const id of run.laneOrder) {
      const l = run.lanes[id];
      if (l) events.push({ key: `lane:${id}`, from: "rudra", to: id, label: l.brief, back: false });
    }
    for (const c of toolCalls(run)) {
      events.push({ key: `call:${c.id}`, from: c.from, to: c.to, label: c.label, back: false });
      if (!c.pending) events.push({ key: `result:${c.id}`, from: c.from, to: c.to, label: "", back: true });
    }
    if (seen.current === null) {
      // Runs loaded from history start settled: nothing flies.
      seen.current = new Set(events.map((e) => e.key));
      return;
    }
    const fresh = events.filter((e) => !seen.current!.has(e.key));
    if (!fresh.length) return;
    fresh.forEach((e) => seen.current!.add(e.key));
    const named = (e: Handoff) => ({ ...e, from: byId.get(e.from)?.name ?? "Rudra", to: byId.get(e.to)?.name ?? e.to });
    const said = fresh.filter((e) => !e.back && e.label);
    if (said.length) setTicker((t) => mergeHandoffs(t, said.map(named)));
    if (reducedMotion()) return;
    const add = fresh
      .map((e) => {
        const from = byId.has(e.from) ? e.from : "rudra";
        return { key: e.key, edge: `${from}>${e.to}`, back: e.back, color: byId.get(e.back ? e.to : from)?.color ?? "#fff" };
      });
    setPackets((p) => [...p, ...add]);
    const t = setTimeout(() => setPackets((p) => p.filter((x) => !add.includes(x))), 900);
    return () => clearTimeout(t);
  }, [run]);

  const active = flow.nodes.filter((n) => n.state === "active").map((n) => n.name);

  return (
    <div className={`agent-stage${inView ? "" : " paused"}`} ref={shell}>
      <svg className="as-flow" viewBox={`0 0 ${FLOW_W} ${FLOW_H}`} aria-hidden="true">
        {COLUMNS.map(([x, label]) => (
          <text key={label} className="as-col" x={x} y={12} textAnchor="middle">
            {label.toUpperCase()}
          </text>
        ))}
        {flow.edges.map((e) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);
          if (!a || !b) return null;
          const ends = edgeEnds(a, b);
          return [
            <path
              key={e.id}
              ref={(el) => {
                if (el) paths.current.set(e.id, el);
                else paths.current.delete(e.id);
              }}
              className={`as-edge ${e.state}`}
              style={{ ["--c" as string]: e.color }}
              d={edgePath(a, b)}
            />,
            ...ends.map(([x, y], i) => <circle key={`${e.id}:${i}`} className="as-pin" cx={x} cy={y} r={2.2} />),
          ];
        })}
        {flow.nodes.map((n) => (
          <Node key={n.id} n={n} />
        ))}
        {packets.map((p) => (
          <Dot key={p.key} p={p} path={paths.current.get(p.edge)} />
        ))}
      </svg>
      {ticker.length > 0 && (
        <div className="as-ticker" aria-hidden="true">
          {ticker.map((h) => (
            <span key={h.key} className="as-hand">
              <b>{h.from}</b> {"→"} <b>{h.to}</b>: {clip(h.label, 40)}
              {h.count > 1 && <b className="as-count"> ×{h.count}</b>}
            </span>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {active.length ? `Working: ${active.join(", ")}` : run.state === "running" ? "Working" : "Done"}
      </p>
    </div>
  );
}

function Node({ n }: { n: FlowNode }) {
  const r = n.id === "rudra" ? 16 : 13;
  const s = (r * 1.05) / 12;
  const lx = n.side ? n.x - 18 : n.x;
  const anchor = n.side ? "end" : "middle";
  const ny = n.side ? n.y - 1 : n.y + r + 11;
  return (
    <g className={`as-node ${n.state}`} style={{ ["--c" as string]: n.color }}>
      <circle className="as-halo" cx={n.x} cy={n.y} r={r} />
      {n.agent && (
        <>
          <path className="as-think" d={`M${n.x - 8},${n.y - r - 1} C${n.x - 14},${n.y - r - 17} ${n.x + 14},${n.y - r - 17} ${n.x + 8},${n.y - r - 1}`} />
          <text className="as-think-l" x={n.x + 14} y={n.y - r - 9}>
            Think
          </text>
        </>
      )}
      <circle className="as-ring" cx={n.x} cy={n.y} r={r} />
      <path className="as-ico" d={ICONS[n.icon]} transform={`translate(${n.x - 12 * s},${n.y - 12 * s}) scale(${s})`} strokeWidth={1.6 / s} />
      {(n.state === "done" || n.state === "failed") && (
        <text className="as-tick" x={n.x + r - 2} y={n.y + r + 2}>
          {n.state === "done" ? "✓" : "!"}
        </text>
      )}
      <text className="as-name" x={lx} y={ny} textAnchor={anchor}>
        {n.name}
      </text>
      <text className="as-cap" x={lx} y={ny + 10} textAnchor={anchor}>
        {n.caption}
      </text>
    </g>
  );
}

/** A dot that runs once along a link (or back along it with a result), then the parent removes it. */
function Dot({ p, path }: { p: Packet; path?: SVGPathElement }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!path || typeof path.getTotalLength !== "function") return;
    const len = path.getTotalLength();
    const t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      const q = path.getPointAtLength(p.back ? len * (1 - k) : len * k);
      setAt({ x: q.x, y: q.y });
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [path, p.back]);
  if (!at) return null;
  return <circle className="as-dot" cx={at.x} cy={at.y} r={3.5} style={{ ["--c" as string]: p.color }} />;
}
