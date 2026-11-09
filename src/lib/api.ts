import { supabase } from "./supabase";
import { env } from "./env";
import type { HourBucket, LiveData, Weather } from "./types";

/**
 * Monitoring API (FastAPI on Render). Authenticated with the Supabase JWT. /app/live and
 * /app/hourly resolve the station from the login (own primary station, else the oldest
 * grant), so they answer for that station regardless of the selected site; /app/weather
 * takes the selected site's station and checks the login may view it.
 */
async function call<T>(path: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch(`${env.monitoringApiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new Error(`Monitoring API ${path}: ${detail}`);
  }
  return (await res.json()) as T;
}

export const api = {
  live: () => call<LiveData>("/app/live"),
  hourly: (dateKey?: string) =>
    call<{ date: string; source: "live" | "stored"; station_id: string; totals: Record<string, number>; hours: HourBucket[] }>(
      `/app/hourly${dateKey ? `?date=${dateKey}` : ""}`,
    ),
  /** Today's forecast as Solis Cloud shows it for the plant; null when Solis has none. */
  weather: (stationId: string) => call<Weather | null>(`/app/weather?station_id=${encodeURIComponent(stationId)}`),
};
