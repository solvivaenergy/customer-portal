import { supabase, fetchAll } from "./supabase";
import { api } from "./api";
import { addDays, dateFromKey, manilaDateKey, manilaMidnight, manilaParts, manilaToday } from "./format";
import { rateFor } from "./savings";
import type { DailyReading, FiveMinuteRow, HourBucket, Rate, SolarSystem } from "./types";

/* ------------------------------------------------------------------ fetching */

const dailyCache = new Map<string, Promise<DailyReading[]>>();

/** Every daily row of a system, oldest first (cached for the session). */
export function fetchDailyReadings(systemId: string): Promise<DailyReading[]> {
  let p = dailyCache.get(systemId);
  if (!p) {
    p = fetchAll<DailyReading>((from, to) =>
      supabase
        .from("energy_readings")
        .select("timestamp,production_kwh,consumption_kwh,grid_import_kwh,grid_export_kwh,battery_level,battery_status,battery_charge_kwh,battery_discharge_kwh")
        .eq("system_id", systemId)
        .order("timestamp", { ascending: true })
        .range(from, to),
    ).catch((e) => {
      dailyCache.delete(systemId);
      throw e;
    });
    dailyCache.set(systemId, p);
  }
  return p;
}

export function invalidateDaily(systemId: string) {
  dailyCache.delete(systemId);
}

/** 24 Manila-hour buckets for one day. Today comes live from the API, other days from the hourly table. */
export async function fetchDayHours(system: SolarSystem, dateKey: string, viaApi: boolean): Promise<HourBucket[]> {
  const today = manilaDateKey(new Date());
  if (dateKey === today && viaApi) {
    try {
      return (await api.hourly()).hours;
    } catch {
      /* fall through to the table (today's closed hours are rolled up there) */
    }
  }
  const [y, m, d] = dateKey.split("-").map(Number);
  const start = manilaMidnight(y, m - 1, d);
  const end = addDays(start, 1);
  const { data, error } = await supabase
    .from("energy_readings_hourly")
    .select("hour_start,production_kwh,consumption_kwh,grid_import_kwh,grid_export_kwh,peak_power_kw,battery_level_end,points")
    .eq("system_id", system.id)
    .gte("hour_start", start.toISOString())
    .lt("hour_start", end.toISOString())
    .order("hour_start");
  if (error) throw new Error(error.message);
  const hours: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    hour_start: new Date(start.getTime() + h * 3_600_000).toISOString(),
    production_kwh: null,
    consumption_kwh: null,
    grid_import_kwh: null,
    grid_export_kwh: null,
    peak_power_kw: null,
    battery_level_end: null,
    points: 0,
    partial: false,
  }));
  for (const r of data ?? []) {
    const h = manilaParts(new Date(r.hour_start)).hour;
    hours[h] = { ...hours[h], ...r, hour: h, points: r.points ?? 0, partial: (r.points ?? 0) > 0 && (r.points ?? 0) < 12 };
  }
  return hours;
}

/** Latest five-minute sample of today (battery state, timestamp of last data). */
export async function fetchLatestFiveMinute(systemId: string): Promise<FiveMinuteRow | null> {
  const { data, error } = await supabase
    .from("energy_readings_five_minutes")
    .select("timestamp,battery_level,battery_status,production_kwh,consumption_kwh")
    .eq("system_id", systemId)
    .order("timestamp", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/* --------------------------------------------------------------- aggregation */

export type RangeId = "1D" | "1W" | "1M" | "1Y" | "YTD";
export const RANGES: { id: RangeId; label: string }[] = [
  { id: "1D", label: "1D" },
  { id: "1W", label: "1W" },
  { id: "1M", label: "1M" },
  { id: "1Y", label: "1Y" },
  { id: "YTD", label: "YTD" },
];

export type Period = { range: RangeId; anchor: string /* Manila date key */ };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtLong = (k: string) => dateFromKey(k).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const fmtShort = (k: string) => dateFromKey(k).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Inclusive Manila date bounds + labels for a period. */
export function periodBounds(p: Period) {
  const today = manilaDateKey(new Date());
  const anchor = dateFromKey(p.anchor);
  const y = anchor.getUTCFullYear();
  const m = anchor.getUTCMonth();
  switch (p.range) {
    case "1D":
      return { start: p.anchor, end: p.anchor, title: fmtLong(p.anchor), subtitle: `As of ${fmtLong(p.anchor)}`, canNav: true };
    case "1W": {
      // ISO week (Mon–Sun) containing the anchor.
      const dow = (anchor.getUTCDay() + 6) % 7; // Mon = 0
      const start = manilaDateKey(addDays(anchor, -dow));
      const end = manilaDateKey(addDays(anchor, 6 - dow));
      return { start, end, title: `${fmtShort(start)} – ${fmtShort(end)}`, subtitle: `${fmtLong(start)} – ${fmtLong(end)}`, canNav: true };
    }
    case "1M": {
      const start = manilaDateKey(new Date(Date.UTC(y, m, 1, 4)));
      const end = manilaDateKey(new Date(Date.UTC(y, m + 1, 0, 4)));
      const label = anchor.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      return { start, end, title: label, subtitle: `${fmtShort(start)} – ${fmtShort(end)}, ${y}`, canNav: true };
    }
    case "1Y": {
      // Trailing 12 calendar months ending this month.
      const t = dateFromKey(today);
      const ty = t.getUTCFullYear();
      const tm = t.getUTCMonth();
      const start = manilaDateKey(new Date(Date.UTC(ty, tm - 11, 1, 4)));
      return { start, end: today, title: "Last 12 months", subtitle: `${MONTHS[(tm + 1) % 12]} ${tm === 11 ? ty : ty - 1} – ${MONTHS[tm]} ${ty}`, canNav: false };
    }
    case "YTD": {
      const t = dateFromKey(today);
      const ty = t.getUTCFullYear();
      const start = `${ty}-01-01`;
      return { start, end: today, title: `Jan ${ty} – Present`, subtitle: `Since Jan ${ty}`, canNav: false };
    }
  }
}

export function shiftPeriod(p: Period, dir: 1 | -1): Period {
  const anchor = dateFromKey(p.anchor);
  const today = manilaDateKey(new Date());
  let next: string;
  if (p.range === "1D") next = manilaDateKey(addDays(anchor, dir));
  else if (p.range === "1W") next = manilaDateKey(addDays(anchor, 7 * dir));
  else if (p.range === "1M") next = manilaDateKey(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + dir, 1, 4)));
  else return p;
  return { ...p, anchor: next > today ? today : next };
}

export type SeriesPoint = {
  key: string; // bucket id
  label: string; // x-axis label
  production: number;
  consumption: number | null;
  grid: number;
  solar: number;
  battery: number;
  savings: number;
  hasData: boolean;
};

export type Aggregate = {
  points: SeriesPoint[];
  production: number;
  consumption: number | null; // null when the system has no consumption data in the period
  grid: number;
  solar: number;
  battery: number;
  savings: number;
  estimatedRate: boolean;
  days: number; // days with data
};

const n = (v: number | null | undefined) => (v == null ? 0 : Number(v));

function splitConsumption(consumption: number | null, grid: number, battery: number) {
  if (consumption == null) return { grid, solar: 0, battery };
  const solar = Math.max(consumption - grid - battery, 0);
  return { grid: Math.min(grid, consumption), solar, battery: Math.min(battery, Math.max(consumption - grid, 0)) };
}

function sumPoints(points: SeriesPoint[], estimatedRate: boolean): Aggregate {
  const withData = points.filter((p) => p.hasData);
  const hasConsumption = withData.some((p) => p.consumption != null);
  return {
    points,
    production: withData.reduce((s, p) => s + p.production, 0),
    consumption: hasConsumption ? withData.reduce((s, p) => s + n(p.consumption), 0) : null,
    grid: withData.reduce((s, p) => s + p.grid, 0),
    solar: withData.reduce((s, p) => s + p.solar, 0),
    battery: withData.reduce((s, p) => s + p.battery, 0),
    savings: withData.reduce((s, p) => s + p.savings, 0),
    estimatedRate,
    days: withData.length,
  };
}

/** Daily rows → one point per day / per month depending on the range. */
export function aggregateDaily(rows: DailyReading[], period: Period, rates: Rate[], providerId: number | null): Aggregate {
  const { start, end } = periodBounds(period);
  const inRange = rows.filter((r) => {
    const k = manilaDateKey(r.timestamp);
    return k >= start && k <= end;
  });
  let estimatedRate = false;
  const perDay = new Map<string, SeriesPoint>();
  for (const r of inRange) {
    const key = manilaDateKey(r.timestamp);
    const { rate, estimated } = rateFor(rates, providerId, key);
    estimatedRate ||= estimated;
    const production = n(r.production_kwh);
    const consumption = r.consumption_kwh == null ? null : Number(r.consumption_kwh);
    const split = splitConsumption(consumption, n(r.grid_import_kwh), n(r.battery_discharge_kwh));
    perDay.set(key, {
      key,
      label: fmtShort(key),
      production,
      consumption,
      ...split,
      savings: production * rate,
      hasData: production > 0 || (consumption ?? 0) > 0,
    });
  }

  let points: SeriesPoint[];
  if (period.range === "1Y" || period.range === "YTD") {
    const byMonth = new Map<string, SeriesPoint>();
    // seed every month in range so the axis is complete
    for (let k = start; k <= end; ) {
      const d = dateFromKey(k);
      const mk = k.slice(0, 7);
      byMonth.set(mk, { key: mk, label: `${MONTHS[d.getUTCMonth()]}${period.range === "1Y" && d.getUTCMonth() === 0 ? ` ${d.getUTCFullYear()}` : ""}`, production: 0, consumption: null, grid: 0, solar: 0, battery: 0, savings: 0, hasData: false });
      k = manilaDateKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 4)));
    }
    for (const p of perDay.values()) {
      const mk = p.key.slice(0, 7);
      const t = byMonth.get(mk);
      if (!t) continue;
      t.production += p.production;
      if (p.consumption != null) t.consumption = n(t.consumption) + p.consumption;
      t.grid += p.grid;
      t.solar += p.solar;
      t.battery += p.battery;
      t.savings += p.savings;
      t.hasData ||= p.hasData;
    }
    points = [...byMonth.values()];
  } else {
    points = [];
    for (let k = start; k <= end; k = manilaDateKey(addDays(dateFromKey(k), 1))) {
      const d = dateFromKey(k);
      const label = period.range === "1W" ? d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }) : String(d.getUTCDate());
      points.push(perDay.get(k) ?? { key: k, label, production: 0, consumption: null, grid: 0, solar: 0, battery: 0, savings: 0, hasData: false });
      if (period.range === "1W") points[points.length - 1].label = label;
    }
  }
  return sumPoints(points, estimatedRate);
}

/** Hour buckets of one day → 24 points. */
export function aggregateHours(hours: HourBucket[], dateKey: string, rates: Rate[], providerId: number | null): Aggregate {
  const { rate, estimated } = rateFor(rates, providerId, dateKey);
  const points: SeriesPoint[] = hours.map((h) => {
    const production = n(h.production_kwh);
    const consumption = h.consumption_kwh == null ? null : Number(h.consumption_kwh);
    const split = splitConsumption(consumption, n(h.grid_import_kwh), 0);
    const hh = h.hour % 12 === 0 ? 12 : h.hour % 12;
    return {
      key: String(h.hour),
      label: `${hh}${h.hour < 12 ? "AM" : "PM"}`,
      production,
      consumption,
      ...split,
      savings: production * rate,
      hasData: h.points > 0,
    };
  });
  return sumPoints(points, estimated);
}

/** Lifetime totals from all daily rows. */
export function lifetime(rows: DailyReading[], rates: Rate[], providerId: number | null) {
  let production = 0;
  let savings = 0;
  let estimatedRate = false;
  let first: string | null = null;
  for (const r of rows) {
    const key = manilaDateKey(r.timestamp);
    const p = n(r.production_kwh);
    if (p > 0 && !first) first = key;
    const { rate, estimated } = rateFor(rates, providerId, key);
    estimatedRate ||= estimated && p > 0;
    production += p;
    savings += p * rate;
  }
  return { production, savings, estimatedRate, since: first };
}

export const todayKey = () => manilaDateKey(manilaToday());
