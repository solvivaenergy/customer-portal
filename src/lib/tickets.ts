import { env } from "./env";
import { stripHtml } from "./format";
import type { Ticket, TicketStatus } from "./types";

/**
 * Tickets go through the two existing n8n workflows (see docs/integrations.md):
 *  - POST {n8n}/get-my-tickets            {email} → helpdesk.ticket rows for that partner_email
 *  - POST {n8n}/webflow-customer-support  Webflow-shaped form → Odoo webhook creates the ticket
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
};

export function statusFromStage(stage: string): TicketStatus {
  const s = stage.toLowerCase();
  if (/(resolved|closed|done|solved|complete)/.test(s)) return "Resolved";
  if (/cancel/.test(s)) return "Cancelled";
  if (/^new$|new ticket|unassigned/.test(s)) return "New";
  return "In Progress";
}

export const PMS_SERVICE_TYPE = "Schedule a PMS";

function toTicket(t: OdooTicket): Ticket {
  const stage = t.stage_id ? t.stage_id[1] : "New";
  const descriptionHtml = t.description || "";
  const description = stripHtml(descriptionHtml);
  const isPms = /\bPMS\b|preventive maintenance/i.test(`${t.name} ${description.slice(0, 200)}`);
  return {
    id: t.id,
    ref: `${isPms ? "PMS" : "CS"}-${t.id}`,
    subject: t.name,
    descriptionHtml,
    description,
    stage,
    status: statusFromStage(stage),
    priority: t.priority,
    createdAt: t.create_date.includes("T") ? t.create_date : t.create_date.replace(" ", "T") + "Z",
    kind: isPms ? "pms" : "support",
  };
}

export async function fetchMyTickets(email: string): Promise<Ticket[]> {
  const res = await fetch(`${env.n8nWebhookUrl}/get-my-tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`Ticket lookup failed (${res.status})`);
  const json = (await res.json()) as unknown;
  const rows: OdooTicket[] = Array.isArray(json) ? (json as OdooTicket[]) : [];
  return rows.map(toTicket).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

export type PmsRequest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  siteAddress: string;
  stationId: string;
  preferredDate: string;
  timeSlot: string;
  alternativeDate: string;
  roofHeight: string;
  equipment: string[];
  workPermit: string;
  siteContactName: string;
  siteContactPhone: string;
  instructions: string;
  condition: string;
  concerns: string;
};

/** PMS requests ride the technical-ticket path with Service-Type "Schedule a PMS" (the Webflow form's value). */
export async function createPmsRequest(r: PmsRequest): Promise<void> {
  const lines = [
    `Preferred date: ${r.preferredDate}${r.timeSlot ? ` (${r.timeSlot})` : ""}`,
    r.alternativeDate ? `Alternative date: ${r.alternativeDate}` : null,
    `Site address: ${r.siteAddress}`,
    `Roof height: ${r.roofHeight || "not specified"}`,
    `Rooftop access equipment: ${r.equipment.length ? r.equipment.join(", ") : "not specified"}`,
    `Work permit: ${r.workPermit || "not specified"}`,
    r.siteContactName ? `Site contact: ${r.siteContactName} ${r.siteContactPhone}`.trim() : null,
    r.instructions ? `Additional instructions: ${r.instructions}` : null,
    `System condition: ${r.condition || "not specified"}`,
    r.concerns ? `Other concerns: ${r.concerns}` : null,
    "Submitted from the Customer Portal (consent to site access given).",
  ].filter(Boolean);
  await postIntake({
    "Plant-Reference-Number": r.stationId || "N/A",
    "PV-Owner-Name": `${r.firstName} ${r.lastName}`.trim(),
    Email: r.email,
    Phone: r.phone || "N/A",
    "Service-Type": PMS_SERVICE_TYPE,
    "Detailed-Concern": "Preventive Maintenance Service request",
    "Concern-Description": lines.join("\n"),
    form_name: "solviva-support-technical-portal-pms",
    "ticket-type": "technical",
    "submission-timestamp": manilaTimestamp(),
  });
}
