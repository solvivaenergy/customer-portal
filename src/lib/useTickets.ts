import { useCallback, useEffect, useState } from "react";
import { fetchMyTickets } from "./tickets";
import type { Ticket } from "./types";

const cache = new Map<string, { at: number; tickets: Ticket[] }>();
const TTL_MS = 60_000;

export function useTickets(email: string | null | undefined) {
  const [tickets, setTickets] = useState<Ticket[] | null>(() => (email && cache.get(email)?.tickets) || null);
  const [loading, setLoading] = useState(!tickets);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (force = false) => {
      if (!email) return;
      const hit = cache.get(email);
      if (!force && hit && Date.now() - hit.at < TTL_MS) {
        setTickets(hit.tickets);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const t = await fetchMyTickets(email);
        cache.set(email, { at: Date.now(), tickets: t });
        setTickets(t);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [email],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return { tickets, loading, error, refresh: () => load(true) };
}

export function invalidateTickets(email: string) {
  cache.delete(email);
}
