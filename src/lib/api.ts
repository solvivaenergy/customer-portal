import { supabase } from "./supabase";
import { env } from "./env";
import type { HourBucket, LiveData } from "./types";

/**
 * Monitoring API (FastAPI on Render). Authenticated with the Supabase JWT; the API
 * resolves the station from the login (own primary station, else the oldest grant),
 * so it always answers for that station regardless of the selected site.
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
};
