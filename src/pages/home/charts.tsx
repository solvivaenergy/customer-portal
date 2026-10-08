import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SeriesPoint } from "@/lib/energy";
import { php, phpShort, num } from "@/lib/format";

const COLORS = { grid: "#1f522b", solar: "#8be114", battery: "#def0d8", line: "#15803d", fill: "#f0fdf4", production: "#8be114" };

const axisStyle = { fontSize: 12, fill: "#667085" };

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

export function SavingsChart({ points, interval }: { points: SeriesPoint[]; interval?: number }) {
  const data = points.map((p) => ({ ...p, savings: Math.round(p.savings * 100) / 100 }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.line} stopOpacity={0.18} />
              <stop offset="100%" stopColor={COLORS.line} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#f2f4f7" />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval={interval ?? "preserveStartEnd"} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v: number) => phpShort(v)} width={64} />
          <Tooltip
            cursor={{ stroke: "#d0d5dd" }}
            content={({ active, payload }) =>
              active && payload?.length ? <TooltipBox title={String(payload[0].payload.label)} rows={[{ label: "Savings", value: php(Number(payload[0].value)), color: COLORS.line }, { label: "Production", value: `${num(payload[0].payload.production, 1)} kWh` }]} /> : null
            }
          />
          <Area type="monotone" dataKey="savings" stroke={COLORS.line} strokeWidth={2} fill="url(#savingsFill)" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConsumptionChart({ points, hasConsumption, interval }: { points: SeriesPoint[]; hasConsumption: boolean; interval?: number }) {
  const data = points.map((p) => ({ ...p, grid: round1(p.grid), solar: round1(p.solar), battery: round1(p.battery), production: round1(p.production) }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="#f2f4f7" />
          <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} interval={interval ?? "preserveStartEnd"} />
          <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={48} tickFormatter={(v: number) => num(v)} label={{ value: "kWh", angle: -90, position: "insideLeft", style: axisStyle }} />
          <Tooltip
            cursor={{ fill: "#f9fafb" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as SeriesPoint;
              const rows = hasConsumption
                ? [
                    { label: "Grid", value: `${num(p.grid, 1)} kWh`, color: COLORS.grid },
                    { label: "Solar", value: `${num(p.solar, 1)} kWh`, color: COLORS.solar },
                    { label: "Battery", value: `${num(p.battery, 1)} kWh`, color: COLORS.battery },
                    { label: "Total", value: `${num(p.consumption ?? 0, 1)} kWh` },
                  ]
                : [{ label: "Production", value: `${num(p.production, 1)} kWh`, color: COLORS.production }];
              return <TooltipBox title={p.label} rows={rows} />;
            }}
          />
          {hasConsumption ? (
            <>
              <Bar dataKey="grid" stackId="c" fill={COLORS.grid} isAnimationActive={false} />
              <Bar dataKey="solar" stackId="c" fill={COLORS.solar} isAnimationActive={false} />
              <Bar dataKey="battery" stackId="c" fill={COLORS.battery} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </>
          ) : (
            <Bar dataKey="production" fill={COLORS.production} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export const LEGEND = [
  { key: "grid", label: "Grid", color: COLORS.grid },
  { key: "solar", label: "Solar", color: COLORS.solar },
  { key: "battery", label: "Battery", color: COLORS.battery },
];
