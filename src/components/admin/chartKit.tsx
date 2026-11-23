import type { ReactNode } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

/**
 * One look for every chart in the owner's admin (recharts).
 * Colours come from --chart-1..8 in index.css: a fixed set checked for colour-blind
 * readers on the admin's light and dark cards. Give series their slot in this order
 * and never cycle past eight. One series on a chart takes slot 1.
 */
export const SERIES = [1, 2, 3, 4, 5, 6, 7, 8].map(i => `var(--chart-${i})`);

/** Solid hairline grid, horizontal only. */
export const gridProps = { stroke: 'var(--chart-grid)', strokeWidth: 1, vertical: false } as const;

/** Quiet axes: muted ink, no tick marks. */
export const xAxisProps = {
  stroke: 'var(--chart-axis)',
  tickLine: false,
  tick: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
} as const;
export const yAxisProps = { ...xAxisProps, axisLine: false } as const;

/** Hover: a hairline crosshair on line/area charts, a light wash on bar charts. */
export const crosshair = { stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeOpacity: 0.45 };
export const barHover = { fill: 'hsl(var(--muted))', fillOpacity: 0.7 };

/** Area mark: 2px line, a ~10% wash under it, a ringed dot where the pointer is. */
export function areaProps(color: string) {
  return {
    type: 'monotone' as const,
    stroke: color,
    strokeWidth: 2,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    fill: color,
    fillOpacity: 0.1,
    dot: false as const,
    activeDot: { r: 4, fill: color, stroke: 'hsl(var(--card))', strokeWidth: 2 },
    isAnimationActive: false,
  };
}

/** Bar mark: at most 24px thick, 4px round end, square on the baseline. */
export const barProps = { maxBarSize: 24, radius: [4, 4, 0, 0] as [number, number, number, number], isAnimationActive: false };

/** Axis ticks: in full under 1,000, then 1.5K / 12K / 1.2M. */
export function compact(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${+(v / 1_000).toFixed(a >= 10_000 ? 0 : 1)}K`;
  return `${v}`;
}

/** The points worth a printed value: the peak and the latest non-zero point. */
export function keyPoints<T>(rows: T[], get: (row: T) => number): Set<number> {
  let peak = -1;
  let max = 0;
  let last = -1;
  rows.forEach((row, i) => {
    const v = Number(get(row)) || 0;
    if (v > max) { max = v; peak = i; }
    if (v > 0) last = i;
  });
  return new Set([peak, last].filter(i => i >= 0));
}

/**
 * A recharts LabelList `content` that prints a value only at the key points, in text
 * ink (never the series colour), kept inside the plot at the first and last points.
 */
export function keyPointLabel(points: Set<number>, count: number, text: (value: number, index: number) => string) {
  return function KeyPointLabel(props: { x?: number | string; y?: number | string; value?: unknown; index?: number }) {
    const index = props.index ?? -1;
    const value = Number(props.value) || 0;
    if (!points.has(index) || value <= 0) return null;
    const anchor = index === 0 ? 'start' : index === count - 1 ? 'end' : 'middle';
    return (
      <text
        x={Number(props.x) || 0}
        y={(Number(props.y) || 0) - 10}
        textAnchor={anchor}
        fontSize={11}
        fontWeight={600}
        fill="hsl(var(--foreground))"
      >
        {text(value, index)}
      </text>
    );
  };
}

export type TipRow = { name: ReactNode; value: ReactNode; color?: string };

/** Tooltip body: the value leads, the name follows, keyed by a short line in the series colour. */
export function TipBox({ title, rows, footer }: { title: ReactNode; rows: TipRow[]; footer?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg min-w-[130px]">
      <p className="text-muted-foreground mb-1">{title}</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="h-0.5 w-3 rounded-full shrink-0" style={{ background: r.color ?? 'transparent' }} />
          <span className="font-semibold tabular-nums">{r.value}</span>
          <span className="text-muted-foreground">{r.name}</span>
        </div>
      ))}
      {footer && <div className="mt-1 pt-1 border-t font-medium">{footer}</div>}
    </div>
  );
}

/** A colour key for a legend row: a short line for lines/areas, a small square for bars. */
export function Key({ color, label, shape = 'line' }: { color: string; label: ReactNode; shape?: 'line' | 'box' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {shape === 'line'
        ? <span className="h-0.5 w-3 rounded-full shrink-0" style={{ background: color }} />
        : <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: color }} />}
      {label}
    </span>
  );
}

type PerfRow = { revenue?: number; orders?: number; visitors?: number } & Record<string, unknown>;

/**
 * Revenue and visitors over one time line. They are different measures, so they get two
 * small charts that share the time axis (never two scales on one chart). Hovering either
 * chart shows one readout for that point.
 */
export function RevenueVisitorsCharts({ data, xKey, interval, money, num, syncId }: {
  data: PerfRow[];
  xKey: string;
  interval: number | 'preserveStartEnd';
  money: (n: number) => string;
  num: (n: number) => string;
  syncId: string;
}) {
  const margin = { left: 0, right: 8, top: 6, bottom: 0 };
  return (
    <div className="space-y-1">
      <Key color={SERIES[0]} label="আয়" />
      <ResponsiveContainer width="100%" height={96}>
        <AreaChart data={data} syncId={syncId} margin={margin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} hide />
          <YAxis {...yAxisProps} width={38} allowDecimals={false} tickFormatter={compact} />
          <Tooltip cursor={crosshair} content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload as PerfRow | undefined;
            return (
              <TipBox title={label} rows={[
                { color: SERIES[0], value: money(d?.revenue || 0), name: 'আয়' },
                { value: num(d?.orders || 0), name: 'অর্ডার' },
                { color: SERIES[1], value: num(d?.visitors || 0), name: 'ভিজিটর' },
              ]} />
            );
          }} />
          <Area dataKey="revenue" {...areaProps(SERIES[0])} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="pt-1"><Key color={SERIES[1]} label="ভিজিটর" /></div>
      <ResponsiveContainer width="100%" height={112}>
        <AreaChart data={data} syncId={syncId} margin={margin}>
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...xAxisProps} interval={interval} />
          <YAxis {...yAxisProps} width={38} allowDecimals={false} tickFormatter={compact} />
          <Tooltip cursor={crosshair} content={() => null} />
          <Area dataKey="visitors" {...areaProps(SERIES[1])} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
