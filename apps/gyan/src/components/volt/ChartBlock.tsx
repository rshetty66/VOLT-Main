/**
 * ChartBlock — renders ```chart fenced blocks from Gyan as themed Recharts.
 * Spec is a single JSON object:
 *   {"type":"bar|line|area|donut","title":"...","unit":"...",
 *    "data":[{"label":"...","value":123}, ...]}
 * Bad specs fall back to the raw code block so nothing ever renders blank.
 */
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

const C = {
  amber: '#d9a527',
  green: '#46a758',
  red: '#e5484d',
  blue: '#5b8bd4',
  dim: '#63655f',
  line: '#2a2a28',
  panel: '#1a1a19',
  text: '#e9ebe5',
};
const SERIES = [C.amber, C.green, C.blue, C.red, '#9b7bc0'];

const axisTick = { fill: C.dim, fontSize: 10, fontFamily: 'Geist Mono' };

interface ChartSpec {
  type: 'bar' | 'line' | 'area' | 'donut';
  title?: string;
  unit?: string;
  data: { label: string; value: number }[];
}

function parseSpec(code: string): ChartSpec | null {
  try {
    const s = JSON.parse(code);
    if (!s || !Array.isArray(s.data) || s.data.length === 0) return null;
    if (!['bar', 'line', 'area', 'donut'].includes(s.type)) return null;
    const data = s.data
      .filter((d: any) => d && d.label !== undefined && isFinite(Number(d.value)))
      .slice(0, 12)
      .map((d: any) => ({ label: String(d.label), value: Number(d.value) }));
    if (data.length === 0) return null;
    return { type: s.type, title: s.title, unit: s.unit, data };
  } catch {
    return null;
  }
}

function VoltTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-[var(--volt-line)] bg-[var(--volt-panel)] px-2.5 py-1.5 font-mono text-[11px]">
      {label !== undefined && (
        <div className="mb-0.5 text-[var(--volt-dim)]">{String(label)}</div>
      )}
      <div className="tnum text-[var(--volt-text)]">
        {Number(payload[0].value).toLocaleString()}
        {unit ? ` ${unit}` : ''}
      </div>
    </div>
  );
}

export function ChartBlock({ code }: { code: string }) {
  const spec = parseSpec(code);
  if (!spec) {
    return (
      <pre className="my-3 overflow-x-auto rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-3 text-[12px] leading-relaxed">
        <code>{code}</code>
      </pre>
    );
  }
  const { type, title, unit, data } = spec;
  const tip = <Tooltip content={<VoltTooltip unit={unit} />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />;
  const grid = <CartesianGrid stroke={C.line} vertical={false} />;
  const yAxis = (
    <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} />
  );

  return (
    <figure className="my-3 rounded-lg border border-[var(--volt-line)] bg-[var(--volt-panel)] p-4">
      {title && (
        <figcaption className="micro mb-3 flex items-baseline justify-between">
          <span>{title}</span>
          {unit && <span className="!text-[var(--volt-faint)]">{unit}</span>}
        </figcaption>
      )}
      <div className="h-[220px] w-full">
        <ResponsiveContainer>
          {type === 'bar' ? (
            <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              {grid}
              <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: C.line }} tickLine={false} />
              {yAxis}
              {tip}
              <Bar dataKey="value" fill={C.amber} radius={[3, 3, 0, 0]} maxBarSize={44} />
            </BarChart>
          ) : type === 'line' ? (
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              {grid}
              <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: C.line }} tickLine={false} />
              {yAxis}
              {tip}
              <Line type="monotone" dataKey="value" stroke={C.amber} strokeWidth={2} dot={{ r: 2.5, fill: C.amber }} />
            </LineChart>
          ) : type === 'area' ? (
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              {grid}
              <XAxis dataKey="label" tick={axisTick} axisLine={{ stroke: C.line }} tickLine={false} />
              {yAxis}
              {tip}
              <Area type="monotone" dataKey="value" stroke={C.amber} strokeWidth={2} fill={C.amber} fillOpacity={0.14} />
            </AreaChart>
          ) : (
            <PieChart>
              {tip}
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius={58}
                outerRadius={78}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((d, i) => (
                  <Cell key={d.label} fill={SERIES[i % SERIES.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
      {type === 'donut' && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {data.map((d, i) => (
            <span key={d.label} className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--volt-dim)]">
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{ background: SERIES[i % SERIES.length] }}
              />
              {d.label} <span className="tnum text-[var(--volt-text)]">{d.value.toLocaleString()}</span>
            </span>
          ))}
        </div>
      )}
    </figure>
  );
}
