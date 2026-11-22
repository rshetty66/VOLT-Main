import type { Palette } from "./palette";
import { benchmarkLayout, checksLayout, maturityLayout, shortMoney, valueCaseLayout } from "./layout";
import type { BenchmarkData, MaturityData, ValueCaseData } from "./results";

/**
 * Chart components. Each draws a fixed-size SVG from the pure layout functions and takes its colours from a
 * palette, so the same component renders on screen (dark) and in downloads (light).
 */

interface SvgProps {
  w: number;
  h: number;
  p: Palette;
  label: string;
  children: React.ReactNode;
}

function Svg({ w, h, p, label, children }: SvgProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-label={label} style={{ width: "100%", height: "auto", maxWidth: w }} fontFamily={p.font}>
      <rect x={0} y={0} width={w} height={h} fill={p.bg} rx={6} />
      {children}
    </svg>
  );
}

export function BenchmarkChart({ data, p }: { data: BenchmarkData; p: Palette }) {
  const W = 640, H = 128, L = 20, PW = W - 40, BY = 56, BH = 30;
  const b = data.benchmark;
  const l = benchmarkLayout(b, data.clientValue, PW);
  const fmt = (v: number) => `${v} ${b.unit}`;
  return (
    <Svg w={W} h={H} p={p} label={`${b.metric}: client ${data.clientValue ?? "n/a"}, ${data.quartile ?? ""}`}>
      <text x={L} y={22} fontSize={13} fontWeight={600} fill={p.ink}>{b.metric}</text>
      <text x={W - 20} y={22} fontSize={12} fill={p.muted} textAnchor="end">{b.lowerIsBetter ? "lower is better" : "higher is better"}</text>
      {l.bands.map((band, i) => (
        <g key={band.label}>
          <rect x={L + band.from} y={BY} width={Math.max(0, band.width)} height={BH} fill={p.band[i]} />
          {band.width > 44 && <text x={L + band.from + band.width / 2} y={BY + BH / 2 + 4} fontSize={11} fill={p.ink} textAnchor="middle">{band.label}</text>}
        </g>
      ))}
      {(["top25", "median", "bottom25"] as const).map((k) => (
        <g key={k}>
          <line x1={L + l.points[k]} x2={L + l.points[k]} y1={BY} y2={BY + BH + 6} stroke={p.muted} strokeWidth={1} />
          <text x={L + l.points[k]} y={BY + BH + 20} fontSize={11} fill={p.muted} textAnchor="middle">{fmt(b[k])}</text>
        </g>
      ))}
      {l.client !== undefined && (
        <g>
          <line x1={L + l.client} x2={L + l.client} y1={BY - 14} y2={BY + BH} stroke={p.series} strokeWidth={3} />
          <text x={L + l.client} y={BY - 18} fontSize={12} fontWeight={600} fill={p.series} textAnchor={l.client > PW - 60 ? "end" : l.client < 60 ? "start" : "middle"}>
            client {data.clientValue}{data.quartile ? ` (${data.quartile})` : ""}
          </text>
        </g>
      )}
    </Svg>
  );
}

export function ValueCaseChart({ data, p }: { data: ValueCaseData; p: Palette }) {
  const W = 640, H = 300, L = 64, T = 40, PW = W - L - 20, PH = 210;
  const l = valueCaseLayout(data.yearly, data.oneTimeInvestment, PW, PH);
  const line = l.cumulative.map((c, i) => `${i ? "L" : "M"}${(L + c.x).toFixed(1)},${(T + c.y).toFixed(1)}`).join(" ");
  const npv = `NPV ${shortMoney(data.npv)} · IRR ${data.irrPct === null ? "n/a" : `${data.irrPct}%`} · payback ${data.paybackYears === null ? "beyond horizon" : `${data.paybackYears} yrs`}`;
  return (
    <Svg w={W} h={H} p={p} label={`Value case: ${npv}`}>
      <text x={20} y={24} fontSize={13} fontWeight={600} fill={p.ink}>Value case: net benefit by year and cumulative cash</text>
      <text x={W - 20} y={24} fontSize={12} fill={p.muted} textAnchor="end">{npv}</text>
      {l.ticks.map((t, i) => (
        <g key={t}>
          <line x1={L} x2={L + PW} y1={T + l.tickY[i]} y2={T + l.tickY[i]} stroke={t === 0 ? p.muted : p.grid} strokeWidth={1} />
          <text x={L - 8} y={T + l.tickY[i] + 4} fontSize={11} fill={p.muted} textAnchor="end">{shortMoney(t)}</text>
        </g>
      ))}
      <rect x={L + l.investment.x} y={T + l.investment.y} width={l.investment.width} height={l.investment.height} fill={p.negative} />
      <text x={L + l.investment.x + l.investment.width / 2} y={T + PH + 18} fontSize={11} fill={p.muted} textAnchor="middle">Invest</text>
      {l.bars.map((b) => (
        <g key={b.year}>
          <rect x={L + b.x} y={T + b.y} width={b.width} height={b.height} fill={b.value >= 0 ? p.series : p.negative} />
          <text x={L + b.x + b.width / 2} y={T + PH + 18} fontSize={11} fill={p.muted} textAnchor="middle">{b.label}</text>
        </g>
      ))}
      <path d={line} fill="none" stroke={p.series2} strokeWidth={2.5} />
      {l.cumulative.map((c) => (
        <circle key={c.year} cx={L + c.x} cy={T + c.y} r={3.5} fill={p.series2} />
      ))}
      <g fontSize={11} fill={p.muted}>
        <rect x={L} y={H - 16} width={10} height={10} fill={p.series} />
        <text x={L + 14} y={H - 7}>Net benefit</text>
        <rect x={L + 100} y={H - 16} width={10} height={10} fill={p.negative} />
        <text x={L + 114} y={H - 7}>Investment / net cost</text>
        <line x1={L + 260} x2={L + 278} y1={H - 11} y2={H - 11} stroke={p.series2} strokeWidth={2.5} />
        <text x={L + 284} y={H - 7}>Cumulative cash</text>
      </g>
    </Svg>
  );
}

export function MaturityChart({ data, p }: { data: MaturityData; p: Palette }) {
  const W = 640, LW = 230, PW = W - LW - 30, RH = 30, T = 44;
  const l = maturityLayout(data.dimensions, PW);
  const H = T + l.rows.length * RH + 34;
  return (
    <Svg w={W} h={H} p={p} label={`Maturity: overall ${data.overall} (${data.overallLevel})`}>
      <text x={20} y={24} fontSize={13} fontWeight={600} fill={p.ink}>Finance maturity: current and target (1-5)</text>
      <text x={W - 20} y={24} fontSize={12} fill={p.muted} textAnchor="end">overall {data.overall} ({data.overallLevel})</text>
      {l.ticks.map((t, i) => (
        <g key={t}>
          <line x1={LW + l.tickX[i]} x2={LW + l.tickX[i]} y1={T - 6} y2={T + l.rows.length * RH} stroke={p.grid} />
          <text x={LW + l.tickX[i]} y={T + l.rows.length * RH + 16} fontSize={11} fill={p.muted} textAnchor="middle">{t}</text>
        </g>
      ))}
      {l.rows.map((r, i) => {
        const y = T + i * RH + RH / 2;
        return (
          <g key={r.label}>
            <text x={LW - 12} y={y + 4} fontSize={12} fill={p.ink} textAnchor="end">{r.label}</text>
            <line x1={LW + r.currentX} x2={LW + r.targetX} y1={y} y2={y} stroke={p.muted} strokeWidth={2} />
            <circle cx={LW + r.currentX} cy={y} r={6} fill={p.series} />
            <circle cx={LW + r.targetX} cy={y} r={6} fill={p.bg} stroke={p.series2} strokeWidth={2.5} />
          </g>
        );
      })}
      <g fontSize={11} fill={p.muted}>
        <circle cx={LW + 6} cy={H - 10} r={5} fill={p.series} />
        <text x={LW + 16} y={H - 6}>Current</text>
        <circle cx={LW + 86} cy={H - 10} r={5} fill={p.bg} stroke={p.series2} strokeWidth={2} />
        <text x={LW + 96} y={H - 6}>Target</text>
      </g>
    </Svg>
  );
}

export function ChecksChart({ title, counts, p }: { title: string; counts: { pass: number; fail: number; notRun: number }; p: Palette }) {
  const W = 640, H = 92, L = 20, PW = W - 40;
  const segs = checksLayout(counts, PW);
  const fill = [p.pass, p.fail, p.notRun];
  return (
    <Svg w={W} h={H} p={p} label={`${title}: ${counts.pass} pass, ${counts.fail} fail, ${counts.notRun} not run`}>
      <text x={L} y={24} fontSize={13} fontWeight={600} fill={p.ink}>{title}</text>
      <text x={W - 20} y={24} fontSize={12} fill={p.muted} textAnchor="end">{counts.pass} pass · {counts.fail} fail · {counts.notRun} not run</text>
      {segs.map((s, i) =>
        s.width > 0 ? (
          <g key={s.label}>
            <rect x={L + s.x} y={40} width={s.width} height={30} fill={fill[i]} />
            {s.width > 70 && <text x={L + s.x + s.width / 2} y={59} fontSize={11} fill={p.bg} textAnchor="middle" fontWeight={600}>{s.label} {s.count}</text>}
          </g>
        ) : null,
      )}
    </Svg>
  );
}
