import { DELIVERY_ZONES } from "./delivery-zones.data.ts";

export type DeliveryZone = {
  id: string;
  name: string;
  sector: string;
  /** null = «Consultar» (sin tarifa fija) */
  fee: number | null;
};

export type Fulfillment = "delivery" | "pickup" | "dine_in";

export const OUTSIDE_CITY_ZONE_ID = "fuera-de-cartagena";

const OUTSIDE_CITY_ZONE: DeliveryZone = {
  id: OUTSIDE_CITY_ZONE_ID,
  name: "Fuera de Cartagena (envío nacional)",
  sector: "Nacional",
  fee: null,
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

export function allowedFulfillments(cart: { hasMerch: boolean }): Fulfillment[] {
  return cart.hasMerch ? ["delivery"] : ["delivery", "pickup", "dine_in"];
}

export function zoneAllowed(zoneId: string, cart: { hasFood: boolean }): boolean {
  return zoneId === OUTSIDE_CITY_ZONE_ID ? !cart.hasFood : true;
}

export function onlinePaymentAllowed(
  zone: DeliveryZone | undefined,
  fulfillment: Fulfillment,
): boolean {
  if (fulfillment !== "delivery") return true;
  return zone?.fee != null;
}
