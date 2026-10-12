import { env } from "./env";
import { stripHtml } from "./format";
import type { PmsRecord, TicketStatus } from "./types";

/**
 * PMS requests live in Odoo's Maintenance app (`maintenance.request`, custom `x_pms_*` fields),
 * not in Helpdesk. Two staging n8n workflows front it (scripts/n8n/create-staging-workflows.mjs):
 *   POST {n8n}/get-my-pms   {email, partner_id, lead_ids} → the customer's requests
 *   POST {n8n}/pms-request  wizard answers → creates a maintenance.request (questionnaire mapping)
 */

type OdooMaintenanceRequest = {
  id: number;
  name: string;
  stage_id: [number, string] | false;
  kanban_state: string;
  maintenance_type: string;
  request_date: string | false;
  schedule_date: string | false; // "YYYY-MM-DD HH:MM:SS" UTC
  close_date: string | false;
  create_date: string;
  user_id: [number, string] | false;
  description: string | false;
  x_pms_email: string | false;
  x_pms_preferred_date: string | false;
  x_pms_preferred_time_slot: string | false;
  x_pms_alt_date: string | false;
  x_pms_site_address: string | false;
  x_pms_panel_location: string | false;
  x_pms_access_equipment: string | false;
  x_pms_work_permit: string | false;
  x_pms_site_contact_name: string | false;
  x_pms_site_contact_number: string | false;
  x_pms_access_instructions: string | false;
  x_pms_has_issues: boolean;
  x_pms_issue_description: string | false;
  x_pms_other_requests: string | false;
};

/** Maintenance stages seen in Odoo: New Request, Proposal Sent, Report Validation, Done (+ any added later). */
export function statusFromMaintenanceStage(stage: string): TicketStatus {
  const s = stage.toLowerCase();
  if (/(done|complete|closed)/.test(s)) return "Resolved";
  if (/cancel/.test(s)) return "Cancelled";
  if (/new/.test(s)) return "New";
  return "In Progress";
}

const utc = (d: string | false): string | null => (d ? (d.includes("T") ? d : d.replace(" ", "T") + "Z") : null);
const text = (v: string | false): string | null => (v ? String(v) : null);

function toRecord(r: OdooMaintenanceRequest): PmsRecord {
  const stage = r.stage_id ? r.stage_id[1] : "New Request";
  return {
    id: r.id,
    ref: `PMS-${r.id}`,
    name: r.name,
    stage,
    status: statusFromMaintenanceStage(stage),
    requestDate: text(r.request_date),
    scheduleDate: utc(r.schedule_date),
    closeDate: text(r.close_date),
    preferredDate: text(r.x_pms_preferred_date),
    timeSlot: text(r.x_pms_preferred_time_slot),
    alternativeDate: text(r.x_pms_alt_date),
    siteAddress: text(r.x_pms_site_address),
    panelLocation: text(r.x_pms_panel_location),
    accessEquipment: text(r.x_pms_access_equipment),
    workPermit: text(r.x_pms_work_permit),
    siteContact: [text(r.x_pms_site_contact_name), text(r.x_pms_site_contact_number)].filter(Boolean).join(" · ") || null,
    accessInstructions: text(r.x_pms_access_instructions),
    hasIssues: !!r.x_pms_has_issues,
    issueDescription: text(r.x_pms_issue_description),
    otherRequests: text(r.x_pms_other_requests),
    technician: r.user_id ? r.user_id[1] : null,
    description: stripHtml(r.description || ""),
    createdAt: utc(r.create_date) ?? new Date().toISOString(),
  };
}

export async function fetchMyPms(args: { email: string; partnerId: number | null; leadIds: number[] }): Promise<PmsRecord[]> {
  const res = await fetch(`${env.n8nWebhookUrl}/get-my-pms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: args.email, partner_id: args.partnerId ?? undefined, lead_ids: args.leadIds }),
  });
  if (!res.ok) throw new Error(`PMS lookup failed (${res.status})`);
  const json = (await res.json()) as unknown;
  if (json && !Array.isArray(json) && typeof json === "object" && "error" in json) throw new Error(String((json as { error: unknown }).error));
  return (Array.isArray(json) ? (json as OdooMaintenanceRequest[]) : []).map(toRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** The wizard's answers (Support → Request PMS). */
export type PmsForm = {
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

/** After Sales needs lead time to plan a visit; the questionnaire app enforces the same rule. */
export const PMS_MIN_LEAD_DAYS = 10;

export async function createMaintenanceRequest(f: PmsForm, link: { partnerId: number | null; leadId: number | null }): Promise<{ id: number | null; dryRun: boolean }> {
  const hasIssues = /^yes/i.test(f.condition);
  const body = {
    first_name: f.firstName,
    last_name: f.lastName,
    email: f.email,
    contact_number: f.phone,
    site_address: f.siteAddress,
    preferred_date: f.preferredDate,
    preferred_time_slot: f.timeSlot,
    alternative_date: f.alternativeDate || null,
    panel_location: f.roofHeight,
    access_equipment: f.equipment,
    work_permit: f.workPermit,
    site_contact_name: f.siteContactName,
    site_contact_number: f.siteContactPhone,
    access_instructions: f.instructions,
    has_issues: hasIssues,
    issue_description: hasIssues ? f.concerns : "",
    other_requests: hasIssues ? "" : f.concerns,
    partner_id: link.partnerId,
    lead_id: link.leadId,
    station_id: f.stationId,
    token: `portal-${crypto.randomUUID()}`,
    source: "customer-portal",
  };
  if (!env.submissionsEnabled) {
    console.info("[submissions disabled] would POST to n8n pms-request:", body);
    await new Promise((r) => setTimeout(r, 600));
    return { id: null, dryRun: true };
  }
  const res = await fetch(`${env.n8nWebhookUrl}/pms-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Submission-Source": "customer-portal" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as { id?: number; error?: string } | null;
  if (!res.ok || !json || json.error || typeof json.id !== "number") throw new Error(json?.error ?? `PMS request failed (${res.status})`);
  return { id: json.id, dryRun: false };
}
