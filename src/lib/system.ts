import { env } from "./env";

/**
 * Equipment details come from the customer's CRM lead in Odoo (battery, inverter, sales rep). The
 * nightly mirror does not copy these into `solar_systems` yet, so the portal asks the staging n8n
 * workflow `get-my-system` for the login's own leads. The installed and energization dates are
 * mirrored (`solar_systems.odoo_installed_date`, `energization_date`); Odoo's own energization
 * field is empty on every lead.
 */
export type SystemDetails = {
  leadId: number;
  stationId: string | null;
  systemSizeKwp: number | null;
  battery: { brand: string | null; model: string | null; units: number; kwhPerUnit: number | null; totalKwh: number | null } | null;
  inverter: { brand: string | null; model: string | null; units: number; kwPerUnit: number | null } | null;
  salesRep: string | null;
};

type Lead = {
  id: number;
  x_studio_crm_design_solis_station_id: string | false;
  x_studio_crm_contract_system_size_kwp: number | false;
  x_studio_system_size_kwp: number | false;
  x_studio_crm_brand_battery: string | false;
  x_studio_crm_model_battery: string | false;
  x_studio_crm_quantity_battery: string | false;
  x_studio_crm_size_per_unit_kwh_battery: number | false;
  x_studio_crm_brand_inverter: string | false;
  x_studio_crm_model_inverter: string | false;
  x_studio_crm_quantity_inverter: string | false;
  x_studio_crm_size_per_unit_kw_inverter: number | false;
  user_id: [number, string] | false;
};

const str = (v: string | false | undefined) => (v ? String(v).trim() || null : null);
const num = (v: number | string | false | undefined) => {
  const n = Number(v);
  return v === false || v == null || !Number.isFinite(n) || n <= 0 ? null : n;
};

function toDetails(l: Lead): SystemDetails {
  const batteryUnits = num(l.x_studio_crm_quantity_battery) ?? 0;
  const kwhPerUnit = num(l.x_studio_crm_size_per_unit_kwh_battery);
  const hasBattery = batteryUnits > 0 && (kwhPerUnit != null || !!str(l.x_studio_crm_brand_battery));
  const inverterUnits = num(l.x_studio_crm_quantity_inverter) ?? 0;
  const hasInverter = inverterUnits > 0 || !!str(l.x_studio_crm_brand_inverter);
  return {
    leadId: l.id,
    stationId: str(l.x_studio_crm_design_solis_station_id),
    systemSizeKwp: num(l.x_studio_crm_contract_system_size_kwp) ?? num(l.x_studio_system_size_kwp),
    battery: hasBattery
      ? { brand: str(l.x_studio_crm_brand_battery), model: str(l.x_studio_crm_model_battery), units: batteryUnits, kwhPerUnit, totalKwh: kwhPerUnit != null ? kwhPerUnit * batteryUnits : null }
      : null,
    inverter: hasInverter ? { brand: str(l.x_studio_crm_brand_inverter), model: str(l.x_studio_crm_model_inverter), units: inverterUnits || 1, kwPerUnit: num(l.x_studio_crm_size_per_unit_kw_inverter) } : null,
    salesRep: l.user_id ? l.user_id[1] : null,
  };
}

const cache = new Map<string, Promise<Record<number, SystemDetails>>>();

/** Details keyed by CRM lead id. Cached per set of lead ids for the session. */
export function fetchSystemDetails(leadIds: number[]): Promise<Record<number, SystemDetails>> {
  const ids = [...new Set(leadIds.filter((n) => Number.isFinite(n) && n > 0))].sort();
  if (!ids.length) return Promise.resolve({});
  const key = ids.join(",");
  let p = cache.get(key);
  if (!p) {
    p = (async () => {
      const res = await fetch(`${env.n8nWebhookUrl}/get-my-system`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lead_ids: ids }) });
      if (!res.ok) throw new Error(`System details lookup failed (${res.status})`);
      const json = (await res.json()) as unknown;
      if (!Array.isArray(json)) throw new Error(json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : "Unexpected response");
      return Object.fromEntries((json as Lead[]).map((l) => [l.id, toDetails(l)]));
    })().catch((e) => {
      cache.delete(key);
      throw e;
    });
    cache.set(key, p);
  }
  return p;
}
