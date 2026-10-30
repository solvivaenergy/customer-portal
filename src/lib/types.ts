export type Profile = {
  id: string;
  email: string; // from auth
  full_name: string | null;
  phone: string | null;
  address: string | null;
  referral_code: string | null;
  solis_station_id: string | null;
  electricity_provider_id: number | null;
  odoo_customer_name: string | null;
  odoo_partner_id: number | null;
};

export type SolarSystem = {
  id: string;
  user_id: string;
  system_name: string | null;
  capacity_kwp: number | null;
  battery_capacity_kwh: number | null;
  address: string | null;
  status: string;
  // Not installation_date: that column is where the station's history starts (Solis's first generation).
  odoo_installed_date: string | null; // YYYY-MM-DD, install finished (Odoo "Installed Date", mirrored nightly)
  energization_date: string | null; // YYYY-MM-DD, first day of solar production (Solis, mirrored nightly)
  solis_station_id: string | null;
  solis_plant_name: string | null;
  is_primary: boolean | null;
  electricity_provider_id: number | null;
  odoo_lead_id: number | null; // CRM lead the plant was mirrored from (links Maintenance-app PMS requests)
};

export type Provider = { id: number; name: string; code: string };
/** One level of a tiered schedule: the ₱/kWh for a month whose consumption is above the previous level and up to this one. */
export type RateTier = { consumption_kwh: number; rate_per_kwh: number };
/**
 * A DU's published schedule for one month (residential). `rate` is the flat ₱/kWh; `tiers` (MERALCO
 * only so far) is sorted ascending; `net_metering_rate` (MERALCO only, monitoring migration 34) is
 * the ₱/kWh credited for exported energy — the blended generation cost excluding adjustments, one
 * figure for every level.
 */
export type Rate = { id: number; provider_id: number; rate: number; effective_date: string; customer_class: "residential" | "commercial"; tiers: RateTier[]; net_metering_rate: number | null };

export type DailyReading = {
  timestamp: string; // 04:00Z = noon Manila of that day
  production_kwh: number | null;
  consumption_kwh: number | null;
  grid_import_kwh: number | null;
  grid_export_kwh: number | null;
  battery_level: number | null;
  battery_status: string | null;
  battery_charge_kwh: number | null;
  battery_discharge_kwh: number | null;
};

export type HourBucket = {
  hour: number; // 0-23 Manila
  hour_start: string;
  production_kwh: number | null;
  consumption_kwh: number | null;
  grid_import_kwh: number | null;
  grid_export_kwh: number | null;
  // Battery energy of the hour (monitoring migration 24, 2026-10-09): the sum of the
  // five-minute slices of Solis's batteryPower. Hours stored before that hold 0.
  battery_charge_kwh: number | null;
  battery_discharge_kwh: number | null;
  peak_power_kw: number | null;
  battery_level_end: number | null;
  points: number;
  partial: boolean;
};

export type LiveData = {
  current_power_w: number;
  today_production_kwh: number;
  today_consumption_kwh: number;
  today_grid_import_kwh: number;
  today_grid_export_kwh: number;
  // Integrated from today's five-minute curve like the totals above; absent (undefined)
  // from a monitoring API older than 2026-10-09.
  today_battery_charge_kwh?: number | null;
  today_battery_discharge_kwh?: number | null;
  battery_level: number | null;
  battery_status: string | null;
  capacity_kwp: number;
  station_name: string;
  alltime_production_kwh: number;
  month_production_kwh: number;
};

export type FiveMinuteRow = {
  timestamp: string;
  battery_level: number | null;
  battery_status: string | null;
  production_kwh: number | null;
  consumption_kwh: number | null;
};

export type TicketStatus = "New" | "In Progress" | "Resolved" | "Cancelled";

/** A PMS request from Odoo's Maintenance app (maintenance.request). */
export type PmsRecord = {
  id: number;
  ref: string;
  name: string;
  stage: string;
  status: TicketStatus;
  requestDate: string | null; // YYYY-MM-DD
  scheduleDate: string | null; // ISO
  closeDate: string | null;
  preferredDate: string | null;
  timeSlot: string | null;
  alternativeDate: string | null;
  siteAddress: string | null;
  panelLocation: string | null;
  accessEquipment: string | null;
  workPermit: string | null;
  siteContact: string | null;
  accessInstructions: string | null;
  hasIssues: boolean;
  issueDescription: string | null;
  otherRequests: string | null;
  technician: string | null;
  description: string;
  createdAt: string;
};

export type Ticket = {
  id: number;
  ref: string; // display reference
  subject: string;
  /** First customer-facing category (an allow-listed Odoo tag, content/ticketCategories.ts) — the Figma table's "Category"; "" when none. */
  category: string;
  /** All customer-facing categories of the ticket, in Odoo's tag order. Internal tags never appear here. */
  categories: string[];
  descriptionHtml: string;
  description: string; // plain text
  stage: string; // raw Odoo stage name
  status: TicketStatus;
  priority: string;
  createdAt: string; // ISO
  kind: "support" | "pms";
};

/** One entry of a ticket's chatter (mail.message), customer-visible only: internal notes never reach the portal. */
export type TicketMessage = {
  id: number;
  body: string; // plain text, quoted replies removed
  author: string; // "You" for the customer's own messages
  email: string | null;
  date: string; // ISO
  mine: boolean;
  staff: boolean; // sent by Solviva (Customer Care / an @solvivaenergy.com address)
};
