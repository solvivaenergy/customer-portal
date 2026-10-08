import { useEffect, useState } from "react";

/**
 * Current temperature for the system's city via Open-Meteo (free, no key). The city is
 * guessed from the address: the first comma-separated part, scanning from the end, that
 * geocodes inside the Philippines. Fails silently — the chip is simply hidden.
 */
export type Weather = { city: string; temperatureC: number; code: number };

const cache = new Map<string, Promise<Weather | null>>();

function candidates(address: string): string[] {
  const parts = address
    .split(/[,\n]/)
    .map((s) => s.replace(/\b\d{4}\b/g, "").replace(/\b(Philippines|PH|Metro Manila|NCR)\b/gi, "").trim())
    .filter((s) => s.length > 2 && !/^\d/.test(s));
  const withCity = parts.filter((p) => /city|municipality/i.test(p));
  return [...withCity.reverse(), ...parts.reverse()].map((p) => p.replace(/\bcity of\b/i, "").trim());
}

async function lookup(address: string): Promise<Weather | null> {
  for (const name of candidates(address).slice(0, 4)) {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&country=PH&language=en`).then((r) => r.json()).catch(() => null);
    const hit = geo?.results?.[0];
    if (!hit) continue;
    const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,weather_code&timezone=Asia%2FManila`)
      .then((r) => r.json())
      .catch(() => null);
    if (!wx?.current) continue;
    return { city: hit.name, temperatureC: Math.round(wx.current.temperature_2m), code: wx.current.weather_code };
  }
  return null;
}

export function useWeather(address: string | null | undefined): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null);
  useEffect(() => {
    if (!address) return;
    let p = cache.get(address);
    if (!p) {
      p = lookup(address);
      cache.set(address, p);
    }
    let alive = true;
    p.then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [address]);
  return weather;
}
