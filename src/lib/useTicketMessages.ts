import { useCallback, useEffect, useState } from "react";
import { env } from "./env";
import { fetchTicketMessages, postTicketReply } from "./tickets";
import type { TicketMessage } from "./types";

/**
 * A ticket's customer-visible chatter, newest first, and a `reply` that posts to it. The reply
 * shows up at once; with submissions enabled the thread is then re-read so the entry carries
 * Odoo's id and timestamp (with them disabled the local copy is all there is).
 */
export function useTicketMessages(email: string | null | undefined, ticketId: number | null, partnerId: number | null) {
  const [messages, setMessages] = useState<TicketMessage[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!email || ticketId == null) return;
    setLoading(true);
    setError(null);
    try {
      setMessages(await fetchTicketMessages(email, ticketId, { partnerId }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [email, ticketId, partnerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reply = useCallback(
    async (body: string) => {
      if (!email || ticketId == null) throw new Error("Not signed in");
      await postTicketReply(email, ticketId, body);
      const local: TicketMessage = { id: -Date.now(), body, author: "You", email, date: new Date().toISOString(), mine: true, staff: false };
      setMessages((m) => [local, ...(m ?? [])]);
      if (env.submissionsEnabled) void load();
    },
    [email, ticketId, load],
  );

  return { messages, loading, error, reply, refresh: load };
}
