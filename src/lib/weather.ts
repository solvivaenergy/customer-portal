import { useEffect, useState } from "react";
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun, type LucideIcon } from "lucide-react";
import { api } from "./api";
import type { Weather } from "./types";

/**
 * Today's weather for the selected site, exactly as Solis Cloud shows it for the plant: the city
 * set on the plant in Solis, the day's low and high, and the condition. The monitoring API reads
 * it from the Solis station detail (/app/weather), so the chip always agrees with the Solis app;
 * Solis refreshes the forecast around 05:00 Manila. Fails silently — the chip is simply hidden.
 */
const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; promise: Promise<Weather | null> }>();

function fetchWeather(stationId: string): Promise<Weather | null> {
  const hit = cache.get(stationId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = api.weather(stationId).catch((e: Error) => {
    console.warn("weather unavailable:", e.message);
    cache.delete(stationId);
    return null;
  });
  cache.set(stationId, { at: Date.now(), promise });
  return promise;
}

export function useWeather(stationId: string | null | undefined): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    setWeather(null); // a site without a station shows no chip, not the previous site's
    if (!stationId) return;
    let alive = true;
    fetchWeather(stationId).then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [stationId]);
  return weather;
}

/** Solis conditions carry QWeather codes: 1xx clear and cloud, 3xx rain, 4xx snow, 5xx fog and haze. */
export function weatherIcon(code: number | null, isDay: boolean): LucideIcon {
  if (code == null) return isDay ? Sun : Moon;
  if (code === 100 || code === 150 || code === 900) return isDay ? Sun : Moon;
  if (code === 102 || code === 103 || code === 152 || code === 153) return isDay ? CloudSun : CloudMoon;
  if (code < 300) return Cloud;
  if (code >= 302 && code <= 304) return CloudLightning;
  if (code === 309) return CloudDrizzle;
  if (code < 400) return CloudRain;
  if (code < 500) return CloudSnow;
  if (code < 600) return CloudFog;
  return Cloud;
}

/** "24–26°C", or "26°C" when Solis gives the same low and high. */
export function temperatureRange(w: Weather): string {
  return w.temp_min_c === w.temp_max_c ? `${w.temp_max_c}°C` : `${w.temp_min_c}–${w.temp_max_c}°C`;
}
