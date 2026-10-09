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
  installation_date: string | null;
  solis_station_id: string | null;
  solis_plant_name: string | null;
  is_primary: boolean | null;
  electricity_provider_id: number | null;
};

export type Provider = { id: number; name: string; code: string };
export type Rate = { id: number; provider_id: number; rate: number; effective_date: string };

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

export type Ticket = {
  id: number;
  ref: string; // display reference
  subject: string;
  descriptionHtml: string;
  description: string; // plain text
  stage: string; // raw Odoo stage name
  status: TicketStatus;
  priority: string;
  createdAt: string; // ISO
  kind: "support" | "pms";
};
