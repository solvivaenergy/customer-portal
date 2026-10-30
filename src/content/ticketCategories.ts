/**
 * Which Odoo helpdesk tags customers may see as a ticket's "Category", and the wording they see.
 * Keys are the tags exactly as spelled in Odoo (matched case-insensitively); anything not listed is
 * an internal label (Endorsed to Sales, Duplicate Ticket, SQL Following Up…) and never reaches the
 * portal. Several Odoo tags can share one customer-facing name. Drawn up 2026-10-30 from the tags
 * on portal users' tickets; CX owns this list.
 */
export const TICKET_CATEGORY_LABELS: Record<string, string> = {
  // Technical Aftersales
  "Technical Support": "Technical support",
  "technical: Battery Fault": "Battery fault",
  "technical: Performance Analysis": "Performance analysis",
  "technical: Internet Connectivity": "Internet connectivity",
  "technical: Inverter Fault": "Inverter fault",
  "technical: Meter/CT Fault": "Meter / CT fault",
  "technical: PV String Outage": "PV string outage",
  "technical: App/Portal Access Issue": "App / portal access",
  "Higher Bill": "Higher bill",
  "No Savings": "No savings",
  "Workmanship": "Workmanship",
  "Roof Leak": "Roof leak",
  "Equipment Warranty": "Warranty",
  "PM Service": "PM service",
  "PMS Service": "PM service",
  // Net metering (the first spelling is Odoo's typo)
  "Net Meterning": "Net metering",
  "Legacy Net Metering": "Net metering",
  "2026 Net Metering": "Net metering",
  // Customer Care / billing
  "Complaint": "Complaint",
  "cx: Project Delayed": "Project delay",
  "Referral Pmt Incentive Recipient": "Referral incentive",
  "Processing Referral Incentive Payment": "Referral incentive",
  "cx: Referral Incentive Pmt": "Referral incentive",
  "Official Receipt": "Official receipt",
  "cx: Request for OR (Official Receipt)": "Official receipt",
  "cx: Request for SI (Sales Invoice)": "Sales invoice",
  "Refund Request": "Refund request",
  "Payment Due": "Payment",
  "Aftersales Payment": "Payment",
  "Others": "Others",
};

const byLowerTag = new Map(Object.entries(TICKET_CATEGORY_LABELS).map(([tag, label]) => [tag.trim().toLowerCase(), label]));

/** Customer-facing categories of a ticket, in Odoo's tag order, without duplicates; [] when only internal tags (or none) are set. */
export function customerCategories(tags: string[]): string[] {
  const out: string[] = [];
  for (const tag of tags) {
    const label = byLowerTag.get(tag.trim().toLowerCase());
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
