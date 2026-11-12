import { useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/energy";
import { php, phpShort, num } from "@/lib/format";

const COLORS = { grid: "#1f522b", solar: "#8be114", battery: "#def0d8", line: "#15803d", fill: "#f0fdf4", production: "#8be114", divider: "#98a2b3" };

const axisStyle = { fontSize: 12, fill: "#667085" };
/* On a phone the plot is ~300px wide: smaller tick type and a narrower value axis so the bars get the room (Alden, 2026-11-09). */
const tickStyle = (compact?: boolean) => (compact ? { ...axisStyle, fontSize: 11 } : axisStyle);
// Twelve month names across a ~260px plot need the smaller type (the Figma mobile frame uses it too).
const xTickStyle = (compact?: boolean) => (compact ? { ...axisStyle, fontSize: 10 } : axisStyle);
// Short ease when the period changes; the data arrays are memoised so an unrelated re-render does not replay it.
const ANIM = { isAnimationActive: true, animationDuration: 500, animationEasing: "ease-out" } as const;

/** Vertical year marker: drawn at the start of the `x` category (i.e. between December and January). */
export type YearDivider = { x: string; year: string };

function YearLine({ divider }: { divider?: YearDivider | null }) {
  if (!divider) return null;
  return <ReferenceLine x={divider.x} position="start" stroke={COLORS.divider} strokeDasharray="4 4" label={{ value: divider.year, position: "insideTopLeft", fill: "#667085", fontSize: 12, offset: 8 }} />;
}

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-neutral-800">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-neutral-600">
          {r.color && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />}
          <span className="flex-1">{r.label}</span>
          <span className="font-medium text-neutral-800">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function SavingsChart({ points, interval, divider, compact }: { points: SeriesPoint[]; interval?: number; divider?: YearDivider | null; compact?: boolean }) {
  const data = useMemo(() => points.map((p) => ({ ...p, savings: Math.round(p.savings * 100) / 100 })), [points]);
  return (
    <div className="anim-fade-in h-64 w-full">
      <ResponsiveContainer>
        {/* accessibilityLayer off: it makes the surface focusable, and a click then draws the browser's focus box around the plot. */}
        <AreaChart data={data} margin={{ top: 8, right: compact ? 4 : 8, left: 0, bottom: 0 }} accessibilityLayer={false}>
          <defs>
            <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.line} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS.line} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f2f4f7" />
          {/* Band scale so a ReferenceLine with position="start" can sit between two months. */}
          <XAxis dataKey="label" scale="band" tick={xTickStyle(compact)} axisLine={false} tickLine={false} interval={interval ?? "preserveStartEnd"} />
          <YAxis tick={tickStyle(compact)} axisLine={false} tickLine={false} tickFormatter={(v: number) => phpShort(v)} width={compact ? 44 : 64} />
          <Tooltip
            cursor={{ stroke: "#d0d5dd" }}
            content={({ active, payload }) =>
              active && payload?.length ? <TooltipBox title={String(payload[0].payload.label)} rows={[{ label: "Savings", value: php(Number(payload[0].value)), color: COLORS.line }, { label: "Production", value: `${num(payload[0].payload.production, 1)} kWh` }]} /> : null
            }
          />
          <YearLine divider={divider} />
          <Area type="monotone" dataKey="savings" stroke={COLORS.line} strokeWidth={2} fill="url(#savingsFill)" dot={false} activeDot={{ r: 4 }} {...ANIM} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * `xLabel` names the x-axis under the ticks ("Month" in the Figma "Homepage"; the Home page passes Hour / Day / Month by range).
 * `hasBattery` false drops the Battery stack and tooltip row: a system without a battery shows Grid and Solar only.
 */
export function ConsumptionChart({ points, hasConsumption, hasBattery = true, interval, divider, xLabel, compact }: { points: SeriesPoint[]; hasConsumption: boolean; hasBattery?: boolean; interval?: number; divider?: YearDivider | null; xLabel?: string; compact?: boolean }) {
  const data = useMemo(() => points.map((p) => ({ ...p, grid: round1(p.grid), solar: round1(p.solar), battery: round1(p.battery), production: round1(p.production) })), [points]);
  return (
    <div className="anim-fade-in w-full">
      {/* On a phone the unit sits above the axis (as in the Figma "Homepage" mobile frame) instead of rotated beside it. */}
      {compact && <p className="mb-1 text-[11px] text-neutral-500">kWh</p>}
      <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: compact ? 4 : 8, left: 0, bottom: xLabel ? 18 : 0 }} barCategoryGap="30%" accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="#f2f4f7" />
          <XAxis dataKey="label" tick={xTickStyle(compact)} axisLine={false} tickLine={false} interval={interval ?? "preserveStartEnd"} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -16, style: axisStyle } : undefined} />
          {/* Wide enough for four-digit ticks ("3,600") with the kWh caption clear of them. The rotated caption is
              centred on its x, so an offset under ~7 pushes half the glyphs outside the SVG and they get clipped. */}
          <YAxis tick={tickStyle(compact)} axisLine={false} tickLine={false} width={compact ? 40 : 66} tickFormatter={(v: number) => num(v)} label={compact ? undefined : { value: "kWh", angle: -90, position: "insideLeft", offset: 9, style: axisStyle }} />
          <Tooltip
            cursor={{ fill: "#f9fafb" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as SeriesPoint;
              const rows = hasConsumption
                ? [
                    // Top to bottom as the bar is stacked: Battery, Solar, Grid (review 2026-11-12).
                    ...(hasBattery ? [{ label: "Battery", value: `${num(p.battery, 1)} kWh`, color: COLORS.battery }] : []),
                    { label: "Solar", value: `${num(p.solar, 1)} kWh`, color: COLORS.solar },
                    { label: "Grid", value: `${num(p.grid, 1)} kWh`, color: COLORS.grid },
                    { label: "Total", value: `${num(p.consumption ?? 0, 1)} kWh` },
                  ]
                : [{ label: "Production", value: `${num(p.production, 1)} kWh`, color: COLORS.production }];
              return <TooltipBox title={p.label} rows={rows} />;
            }}
          />
          <YearLine divider={divider} />
          {hasConsumption ? (
            <>
              <Bar dataKey="grid" stackId="c" fill={COLORS.grid} {...ANIM} />
              {/* The rounded corners belong to the top of the stack. */}
              <Bar dataKey="solar" stackId="c" fill={COLORS.solar} radius={hasBattery ? undefined : [4, 4, 0, 0]} {...ANIM} />
              {hasBattery && <Bar dataKey="battery" stackId="c" fill={COLORS.battery} radius={[4, 4, 0, 0]} {...ANIM} />}
            </>
          ) : (
            <Bar dataKey="production" fill={COLORS.production} radius={[4, 4, 0, 0]} {...ANIM} />
          )}
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** In the order the bar is stacked, top to bottom, the same as the tooltip. */
export const LEGEND = [
  { key: "battery", label: "Battery", color: COLORS.battery },
  { key: "solar", label: "Solar", color: COLORS.solar },
  { key: "grid", label: "Grid", color: COLORS.grid },
];
