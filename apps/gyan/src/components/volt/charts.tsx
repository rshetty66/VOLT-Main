/**
 * charts.tsx — VOLT-themed recharts wrappers. One palette, one grid voice:
 * amber primary, green/red semantics, mono micro axis labels, tnum tooltips.
 */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';

export const C = {
  amber: '#d9a527',
  green: '#46a758',
  red: '#e5484d',
  dim: '#63655f',
  line: '#2a2a28',
  panel: '#1a1a19',
  text: '#e9ebe5',
};

const axisStyle = {
  fontSize: 10,
  fontFamily: 'Geist Mono, monospace',
  fill: C.dim,
  letterSpacing: '0.06em',
} as const;

function VoltTooltip({ active, payload, label, suffix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{ background: C.panel, borderColor: C.line }}
    >
      {label !== undefined && (
        <div className="micro mb-1">{String(label).toUpperCase()}</div>
      )}
      {payload.map((p: any) => (
        <div key={p.dataKey ?? p.name} className="tnum font-mono text-[12px]" style={{ color: p.color ?? C.text }}>
          {p.name}: {p.value}
          {suffix ?? ''}
        </div>
      ))}
    </div>
  );
}

/** Close-cycle trend: actual vs target with a dashed target line. */
export function CloseTrend({
  data,
}: {
  data: { period: string; actual: number; target: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={C.line} vertical={false} />
        <XAxis dataKey="period" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} domain={[0, 9]} />
        <Tooltip content={<VoltTooltip suffix=" days" />} cursor={{ stroke: C.line }} />
        <ReferenceLine y={4} stroke={C.dim} strokeDasharray="3 4" />
        <Line
          type="monotone"
          dataKey="actual"
          name="actual"
          stroke={C.amber}
          strokeWidth={2}
          dot={{ r: 2.5, fill: C.amber, strokeWidth: 0 }}
          activeDot={{ r: 4, fill: C.amber }}
        />
        <Line
          type="monotone"
          dataKey="target"
          name="target"
          stroke={C.dim}
          strokeDasharray="4 4"
          strokeWidth={1}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Progress donut: value vs remainder-to-100, center label. */
export function ProgressDonut({
  value,
  target,
  label,
}: {
  value: number;
  target: number;
  label: string;
}) {
  const data = [
    { name: 'now', v: value },
    { name: 'gap', v: Math.max(0, target - value) },
    { name: 'rest', v: Math.max(0, 100 - target) },
  ];
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            dataKey="v"
            innerRadius={58}
            outerRadius={76}
            startAngle={90}
            endAngle={-270}
            strokeWidth={0}
            isAnimationActive={false}
          >
            <Cell fill={C.amber} />
            <Cell fill="#4d4423" />
            <Cell fill="#222221" />
          </Pie>
          <Tooltip content={<VoltTooltip suffix="%" />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-[24px] font-semibold">{value}%</span>
        <span className="micro mt-0.5">{label}</span>
        <span className="micro mt-0.5 !text-[var(--volt-faint)]">target {target}%</span>
      </div>
    </div>
  );
}

/** Horizontal bars, amber fill — aging buckets, dimension scores, etc. */
export function HBars({
  data,
  unit,
  max,
  labelWidth = 150,
}: {
  data: { name: string; value: number }[];
  unit?: string;
  max?: number;
  labelWidth?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 38 + 16}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={C.line} horizontal={false} />
        <XAxis type="number" hide domain={[0, max ?? 'dataMax']} />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          tick={{ ...axisStyle }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<VoltTooltip suffix={unit} />} cursor={{ fill: '#201f1e' }} />
        <Bar dataKey="value" name="value" fill={C.amber} radius={[0, 3, 3, 0]} barSize={10} />
      </BarChart>
    </ResponsiveContainer>
  );
}
