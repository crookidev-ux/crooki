import { DELIVERY_ZONES } from "./delivery-zones.data.ts";

export type DeliveryZone = {
  id: string;
  name: string;
  sector: string;
  /** null = «Consultar» (sin tarifa fija) */
  fee: number | null;
  /** Driving distance from the shop; null = not measured. */
  km: number | null;
};

export type Fulfillment = "delivery" | "pickup" | "dine_in";

/**
 * Per-category delivery rule (categories.delivery_rule):
 * any = every zone, nearby = up to NEARBY_MAX_KM, none = pick-up or dine-in only.
 */
export type DeliveryRule = "any" | "nearby" | "none";

export const NEARBY_MAX_KM = 6;

/** Just past the limit but served anyway (owner's decision, 2026-11-04). */
const NEARBY_EXCEPTIONS = new Set(["el-laguito"]);

export const OUTSIDE_CITY_ZONE_ID = "fuera-de-cartagena";

const OUTSIDE_CITY_ZONE: DeliveryZone = {
  id: OUTSIDE_CITY_ZONE_ID,
  name: "Fuera de Cartagena (envío nacional)",
  sector: "Nacional",
  fee: null,
  km: null,
};

const ALL_ZONES: DeliveryZone[] = [...DELIVERY_ZONES, OUTSIDE_CITY_ZONE];
const BY_ID = new Map(ALL_ZONES.map((z) => [z.id, z]));

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function getZone(id: string): DeliveryZone | undefined {
  return BY_ID.get(id);
}

export function searchZones(query: string, limit = 8): DeliveryZone[] {
  const q = normalize(query);
  if (!q) return [];
  const starts: DeliveryZone[] = [];
  const contains: DeliveryZone[] = [];
  for (const z of ALL_ZONES) {
    const n = normalize(z.name);
    if (n.startsWith(q)) starts.push(z);
    else if (n.includes(q)) contains.push(z);
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Reads a stored rule. An unknown value blocks delivery rather than opening it. */
export function parseDeliveryRule(value: unknown): DeliveryRule {
  return value === "any" || value === "nearby" || value === "none" ? value : "none";
}

/** A cart follows the most restrictive rule among its products. */
export function strictestRule(rules: Iterable<DeliveryRule>): DeliveryRule {
  let result: DeliveryRule = "any";
  for (const rule of rules) {
    if (rule === "none") return "none";
    if (rule === "nearby") result = "nearby";
  }
  return result;
}

/**
 * Ways this cart can be received. Empty for merch (delivery only) together
 * with a product that can't be delivered: the customer must remove one of them.
 */
export function allowedFulfillments(cart: {
  hasMerch: boolean;
  deliveryRule?: DeliveryRule;
}): Fulfillment[] {
  const canDeliver = cart.deliveryRule !== "none";
  if (cart.hasMerch) return canDeliver ? ["delivery"] : [];
  return canDeliver ? ["delivery", "pickup", "dine_in"] : ["pickup", "dine_in"];
}

/** Within the nearby radius, with a fixed fee (islands and «Consultar» stay out). */
function zoneIsNearby(zone: DeliveryZone | undefined): boolean {
  if (!zone || zone.fee == null) return false;
  if (NEARBY_EXCEPTIONS.has(zone.id)) return true;
  return zone.km != null && zone.km <= NEARBY_MAX_KM;
}

export function zoneAllowed(
  zoneId: string,
  cart: { hasFood: boolean; deliveryRule?: DeliveryRule },
): boolean {
  if (cart.deliveryRule === "none") return false;
  if (cart.deliveryRule === "nearby") return zoneIsNearby(getZone(zoneId));
  return zoneId === OUTSIDE_CITY_ZONE_ID ? !cart.hasFood : true;
}

/**
 * Whether a placed order's total is final: false only for a delivery whose fee
 * is still «Consultar» (stored as 0, agreed later over WhatsApp). Money
 * columns come back from Supabase as strings, so both are accepted.
 */
export function deliveryFeeSettled(order: {
  fulfillment: Fulfillment | null;
  delivery_fee: number | string | null;
}): boolean {
  if (order.fulfillment === "pickup" || order.fulfillment === "dine_in") return true;
  return order.fulfillment === "delivery" && Number(order.delivery_fee) > 0;
}

export function onlinePaymentAllowed(
  zone: DeliveryZone | undefined,
  fulfillment: Fulfillment,
): boolean {
  if (fulfillment !== "delivery") return true;
  return zone?.fee != null;
}
