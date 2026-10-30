import { env } from "./env";
import { stripHtml } from "./format";
import { customerCategories } from "@/content/ticketCategories";
import type { Ticket, TicketMessage, TicketStatus } from "./types";

/**
 * Tickets go through n8n workflows (see docs/integrations.md):
 *  - POST {n8n}/get-my-tickets            {email} → helpdesk.ticket rows for that partner_email (+ tag names)
 *  - POST {n8n}/webflow-customer-support  Webflow-shaped form → Odoo webhook creates the ticket
 *  - POST {n8n}/get-ticket-messages       {email, ticket_id} → the ticket's customer-visible chatter
 *  - POST {n8n}/ticket-reply              {email, ticket_id, body} → message_post on the ticket
 * The portal never talks to Odoo directly.
 */

type OdooTicket = {
  id: number;
  name: string;
  description: string | false;
  stage_id: [number, string] | false;
  priority: string;
  create_date: string; // "YYYY-MM-DD HH:MM:SS" in UTC
  partner_email: string | false;
  partner_name: string | false;
  // Returned by the staging workflow (and by production once its field list is extended).
  ticket_ref?: string | false;
  team_id?: [number, string] | false;
  tag_ids?: number[];
  /** Tag names, resolved by the staging workflow (helpdesk.tag). */
  tags?: string[];
};

type OdooMessage = {
  id: number;
  body: string | false;
  author_id: [number, string] | false;
  email_from: string | false;
  date: string; // "YYYY-MM-DD HH:MM:SS" in UTC
  message_type: string;
  subtype_id: [number, string] | false;
};

const odooDate = (d: string) => (d.includes("T") ? d : d.replace(" ", "T") + "Z");

export function statusFromStage(stage: string): TicketStatus {
  const s = stage.toLowerCase();
  if (/(resolved|closed|done|solved|complete)/.test(s)) return "Resolved";
  if (/cancel/.test(s)) return "Cancelled";
  if (/^new$|new ticket|unassigned/.test(s)) return "New";
  return "In Progress";
}

function toTicket(t: OdooTicket): Ticket {
  const stage = t.stage_id ? t.stage_id[1] : "New";
  const descriptionHtml = t.description || "";
  const description = stripHtml(descriptionHtml);
  const team = t.team_id ? t.team_id[1] : "";
  const isPms = /\bPMS\b|preventive maintenance/i.test(`${t.name} ${team} ${description.slice(0, 200)}`);
  // Only allow-listed tags reach the portal (content/ticketCategories.ts); internal labels are dropped here.
  const categories = customerCategories((t.tags ?? []).filter(Boolean));
  return {
    id: t.id,
    ref: t.ticket_ref ? `#${t.ticket_ref}` : `${isPms ? "PMS" : "CS"}-${t.id}`,
    subject: t.name,
    category: categories[0] ?? "",
    categories,
    descriptionHtml,
    description,
    stage,
    status: statusFromStage(stage),
    priority: t.priority,
    createdAt: odooDate(t.create_date),
    kind: isPms ? "pms" : "support",
  };
}

function unwrap<T>(json: unknown, what: string): T[] {
  if (json && !Array.isArray(json) && typeof json === "object" && "error" in json) throw new Error(String((json as { error: unknown }).error));
  if (!Array.isArray(json)) throw new Error(`Unexpected ${what} response`);
  return json as T[];
}

/**
 * Plain text of a chatter message: the quoted history a mail client appends is dropped (Odoo marks it
 * with data-o-mail-quote), images and styles go, line breaks and paragraphs are kept.
 */
export function messageText(html: string | false): string {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("[data-o-mail-quote], [data-o-mail-quote-node], blockquote, style, script, img, .o_mail_quote").forEach((el) => el.remove());
  doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  doc.querySelectorAll("p, div, li, tr, h1, h2, h3, h4, h5, h6").forEach((el) => el.append("\n"));
  return (doc.body.textContent ?? "")
    .replace(/[ \t ]+\n/g, "\n")
    .replace(/\n[ \t ]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const addressOf = (from: string | false) => {
  const s = String(from || "");
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase() || null;
};
const displayNameOf = (from: string | false) => String(from || "").replace(/<[^>]*>/, "").replace(/"/g, "").trim();

export async function fetchTicketMessages(email: string, ticketId: number, me: { partnerId: number | null }): Promise<TicketMessage[]> {
  const res = await fetch(`${env.n8nWebhookUrl}/get-ticket-messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, ticket_id: ticketId }),
  });
  if (!res.ok) throw new Error(`Message lookup failed (${res.status})`);
  const rows = unwrap<OdooMessage>(await res.json(), "message");
  const myEmail = email.trim().toLowerCase();
  return rows
    .map((m) => {
      const addr = addressOf(m.email_from);
      const authorId = m.author_id ? m.author_id[0] : null;
      const mine = (me.partnerId != null && authorId === me.partnerId) || (!!addr && addr === myEmail);
      const name = (m.author_id ? m.author_id[1] : displayNameOf(m.email_from)) || "Solviva";
      const staff = !mine && (!addr || /@solvivaenergy\.com$/.test(addr) || /customer care/i.test(name));
      return { id: m.id, body: messageText(m.body), author: mine ? "You" : name, email: addr, date: odooDate(m.date), mine, staff };
    })
    .filter((m) => m.body)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function postTicketReply(email: string, ticketId: number, body: string): Promise<void> {
  if (!env.submissionsEnabled) {
    console.info("[submissions disabled] would POST to n8n ticket-reply:", { ticketId, body });
    await new Promise((r) => setTimeout(r, 600));
    return;
  }
  const res = await fetch(`${env.n8nWebhookUrl}/ticket-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, ticket_id: ticketId, body }),
  });
  if (!res.ok) throw new Error(`Reply failed (${res.status})`);
  const json = (await res.json().catch(() => null)) as { id?: number; error?: unknown } | null;
  if (json?.error) throw new Error(String(json.error));
}

export async function fetchMyTickets(email: string): Promise<Ticket[]> {
  const res = await fetch(`${env.n8nWebhookUrl}/get-my-tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`Ticket lookup failed (${res.status})`);
  return unwrap<OdooTicket>(await res.json(), "ticket")
    .map(toTicket)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Concern types offered on the ticket form. `type` decides which Odoo path n8n takes. */
/* Same values the mobile app and the website form send (Odoo's "Detailed-Concern"). */
export const TICKET_CATEGORIES: { value: string; group: string; type: "technical" | "general" }[] = [
  { value: "General Inquiry", group: "General", type: "general" },
  { value: "Service Availability", group: "General", type: "general" },
  { value: "Payment Options", group: "General", type: "general" },
  { value: "Low energy output", group: "System performance", type: "technical" },
  { value: "Online monitoring is not working", group: "System performance", type: "technical" },
  { value: "Unusual signs on inverter and components (heat, smoke, discoloration, sparks)", group: "Safety", type: "technical" },
  { value: "Electrical shocks", group: "Safety", type: "technical" },
  { value: "Structural or roof damage / leak", group: "Safety", type: "technical" },
  { value: "Wiring or connection faults / loose connections", group: "Safety", type: "technical" },
  { value: "Panel damage – Warranty Claim", group: "Warranty", type: "technical" },
  { value: "Inverter issues – Warranty Claim", group: "Warranty", type: "technical" },
  { value: "Battery problems – Warranty Claim", group: "Warranty", type: "technical" },
  { value: "Other workmanship issues – Warranty Claim", group: "Warranty", type: "technical" },
];

export type NewTicket = {
  fullName: string;
  email: string;
  phone: string;
  stationId: string;
  category: string;
  details: string;
};

function manilaTimestamp() {
  return new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila", hour12: false }).replace(",", "");
}

async function postIntake(body: Record<string, string>): Promise<void> {
  if (!env.submissionsEnabled) {
    // Development against production: validate, log, pretend. Flip VITE_ENABLE_SUBMISSIONS to post for real.
    console.info("[submissions disabled] would POST to n8n webflow-customer-support:", body);
    await new Promise((r) => setTimeout(r, 600));
    return;
  }
  const res = await fetch(`${env.n8nWebhookUrl}/webflow-customer-support`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Submission-Source": "customer-portal", "X-Platform": "web", "X-App-Version": "0.1.0" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Submission failed (${res.status})`);
}

export async function createTicket(t: NewTicket): Promise<void> {
  const cat = TICKET_CATEGORIES.find((c) => c.value === t.category);
  const type = cat?.type ?? "general";
  const stamp = manilaTimestamp();
  if (type === "technical") {
    await postIntake({
      "Plant-Reference-Number": t.stationId || "N/A",
      "PV-Owner-Name": t.fullName,
      Email: t.email,
      Phone: t.phone || "N/A",
      "Service-Type": "Issue with Solar PV System",
      "Detailed-Concern": t.category,
      "Concern-Description": t.details,
      form_name: "solviva-support-technical-portal",
      "ticket-type": "technical",
      "submission-timestamp": stamp,
    });
  } else {
    await postIntake({
      "Full-Name": t.fullName,
      Email: t.email,
      Subject: t.category,
      "Concern-Description": t.details,
      form_name: "solviva-support-general-portal",
      "ticket-type": "general",
      "submission-timestamp": stamp,
    });
  }
}
