import type { Palette } from "../charts/palette";
import type { Diagram } from "./data";
import { columnLayout } from "./layout";

let seq = 0;

/** A column diagram (layers or a pattern) drawn from columnLayout, in the given palette. */
export function ColumnDiagram({ d, p }: { d: Diagram; p: Palette }) {
  const l = columnLayout(d);
  const id = `arrow-${d.name}-${++seq}`;
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${l.w} ${l.h}`} width={l.w} height={l.h} role="img" aria-label={d.caption} style={{ width: "100%", height: "auto", maxWidth: l.w }} fontFamily={p.font}>
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={p.series} />
        </marker>
        <marker id={`${id}-x`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={p.muted} />
        </marker>
      </defs>
      <rect x={0} y={0} width={l.w} height={l.h} rx={6} fill={p.bg} />
      {l.titles.map((t) => (
        <text key={t.text + t.x} x={t.x} y={t.y} fontSize={10} fontWeight={600} letterSpacing="0.06em" fill={p.series}>
          {t.text.toUpperCase()}
        </text>
      ))}
      {l.links.map((k, i) => (
        <path key={i} d={k.path} fill="none" stroke={k.dashed ? p.muted : p.series} strokeWidth={1.4} strokeDasharray={k.dashed ? "4 3" : undefined} markerEnd={`url(#${id}${k.dashed ? "-x" : ""})`} />
      ))}
      {l.boxes.map((b, i) => {
        const fill = b.k === "a" ? p.boxAccent : b.k === "h" ? p.boxHighlight : p.box;
        const stroke = b.k === "a" ? p.series : b.k === "h" ? p.highlight : p.boxLine;
        return (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={fill} stroke={stroke} />
            {b.s ? (
              <>
                <text x={b.x + 8} y={b.y + 16} fontSize={12} fill={p.ink}>{b.t}</text>
                <text x={b.x + 8} y={b.y + 31} fontSize={10.5} fill={p.muted}>{b.s}</text>
              </>
            ) : (
              <text x={b.x + 8} y={b.y + b.h / 2 + 4} fontSize={12} fill={p.ink}>{b.t}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
