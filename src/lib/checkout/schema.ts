// Pure validation of the checkout request body. It builds a fresh object with
// only the known fields, so anything else the browser sends (prices, totals,
// names) is dropped and can never reach the pricing step.
import { OUTSIDE_CITY_ZONE_ID } from "../delivery-zones.ts";
import { AMOUNT_MISMATCH_NOTE, DOUBLE_CHARGE_NOTE } from "../payments.confirm.ts";
import type { Fulfillment } from "@/lib/delivery-zones";
import type { GiftCardChoice } from "@/lib/types";

export type CheckoutItemInput = {
  productId: string;
  quantity: number;
  combo?: { cookieId: string; includedSalsaId?: string };
  box?: { cookies: { cookieId: string; quantity: number }[]; giftCard: GiftCardChoice };
  helado?: { salsas: { salsaId: string; quantity: number }[] };
};

export type CheckoutInput = {
  locale: "es" | "en";
  customer: { name: string; email: string; phone: string };
  fulfillment: Fulfillment;
  delivery?: { zoneId: string; address: string; recipientPhone: string; city?: string };
  notes: string;
  paymentMethod: "bold" | "qr";
  acceptedPolicy: true;
  items: CheckoutItemInput[];
};

export type ParseResult = { ok: true; value: CheckoutInput } | { ok: false; error: string };

const MAX_TEXT = 200;
const MAX_NOTES = 1000;
const MAX_ITEMS = 100;
const MAX_QTY = 50;
const MAX_SUB_ROWS = 50;

const FULFILLMENTS: readonly Fulfillment[] = ["delivery", "pickup", "dine_in"];
const GIFT_CARDS: readonly GiftCardChoice[] = ["none", "card", "card_and_cake"];

class InvalidInput extends Error {}

function fail(message: string): never {
  throw new InvalidInput(message);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function record(v: unknown, field: string): Record<string, unknown> {
  if (!isRecord(v)) fail(`${field} must be an object`);
  return v;
}

function text(v: unknown, field: string, max = MAX_TEXT, required = true): string {
  if (v === undefined || v === null) {
    if (required) fail(`${field} is required`);
    return "";
  }
  if (typeof v !== "string") fail(`${field} must be a string`);
  const s = v.trim();
  if (required && s.length === 0) fail(`${field} is required`);
  if (s.length > max) fail(`${field} is too long`);
  return s;
}

const SYSTEM_NOTES = [DOUBLE_CHARGE_NOTE, AMOUNT_MISMATCH_NOTE];

/**
 * Customer notes without any line that is exactly one of the payment warnings
 * the server writes for the admin, so a customer cannot fake (or pre-empt) them.
 */
export function stripSystemNotes(notes: string): string {
  return notes
    .split("\n")
    .filter((line) => !SYSTEM_NOTES.includes(line.trim()))
    .join("\n")
    .trim();
}

function qty(v: unknown, field: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > MAX_QTY) {
    fail(`${field} must be an integer between 1 and ${MAX_QTY}`);
  }
  return v;
}

function oneOf<T extends string>(v: unknown, options: readonly T[], field: string): T {
  if (typeof v !== "string" || !(options as readonly string[]).includes(v)) {
    fail(`${field} is invalid`);
  }
  return v as T;
}

function list(v: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(v)) fail(`${field} must be an array`);
  if (v.length > max) fail(`${field} has too many entries`);
  return v;
}

function parseItem(raw: unknown, i: number): CheckoutItemInput {
  const f = `items[${i}]`;
  const r = record(raw, f);
  const item: CheckoutItemInput = {
    productId: text(r.productId, `${f}.productId`),
    quantity: qty(r.quantity, `${f}.quantity`),
  };

  if (r.combo !== undefined) {
    const c = record(r.combo, `${f}.combo`);
    item.combo = { cookieId: text(c.cookieId, `${f}.combo.cookieId`) };
    if (c.includedSalsaId !== undefined && c.includedSalsaId !== null && c.includedSalsaId !== "") {
      item.combo.includedSalsaId = text(c.includedSalsaId, `${f}.combo.includedSalsaId`);
    }
  }

  if (r.box !== undefined) {
    const b = record(r.box, `${f}.box`);
    item.box = {
      cookies: list(b.cookies, `${f}.box.cookies`, MAX_SUB_ROWS).map((raw, j) => {
        const c = record(raw, `${f}.box.cookies[${j}]`);
        return {
          cookieId: text(c.cookieId, `${f}.box.cookies[${j}].cookieId`),
          quantity: qty(c.quantity, `${f}.box.cookies[${j}].quantity`),
        };
      }),
      giftCard: oneOf(b.giftCard, GIFT_CARDS, `${f}.box.giftCard`),
    };
  }

  if (r.helado !== undefined) {
    const h = record(r.helado, `${f}.helado`);
    item.helado = {
      salsas: list(h.salsas, `${f}.helado.salsas`, MAX_SUB_ROWS).map((raw, j) => {
        const s = record(raw, `${f}.helado.salsas[${j}]`);
        return {
          salsaId: text(s.salsaId, `${f}.helado.salsas[${j}].salsaId`),
          quantity: qty(s.quantity, `${f}.helado.salsas[${j}].quantity`),
        };
      }),
    };
  }

  const kinds = [item.combo, item.box, item.helado].filter((x) => x !== undefined).length;
  if (kinds > 1) fail(`${f} has more than one configuration`);
  return item;
}

function parse(body: unknown): CheckoutInput {
  const r = record(body, "body");
  if (r.acceptedPolicy !== true) fail("acceptedPolicy must be true");

  const c = record(r.customer, "customer");
  const email = text(c.email, "customer.email");
  if (!/^[^\s@]+@[^\s@]+$/.test(email)) fail("customer.email is invalid");
  const customer = {
    name: text(c.name, "customer.name"),
    email,
    phone: text(c.phone, "customer.phone"),
  };

  const fulfillment = oneOf(r.fulfillment, FULFILLMENTS, "fulfillment");

  let delivery: CheckoutInput["delivery"];
  if (fulfillment === "delivery") {
    if (r.delivery === undefined || r.delivery === null) fail("delivery is required");
    const d = record(r.delivery, "delivery");
    const zoneId = text(d.zoneId, "delivery.zoneId");
    delivery = {
      zoneId,
      address: text(d.address, "delivery.address"),
      recipientPhone: text(d.recipientPhone, "delivery.recipientPhone"),
    };
    const city = text(d.city, "delivery.city", MAX_TEXT, zoneId === OUTSIDE_CITY_ZONE_ID);
    if (city) delivery.city = city;
  }

  const rawItems = list(r.items, "items", MAX_ITEMS);
  if (rawItems.length === 0) fail("items must not be empty");

  const value: CheckoutInput = {
    locale: oneOf(r.locale, ["es", "en"] as const, "locale"),
    customer,
    fulfillment,
    notes: stripSystemNotes(text(r.notes, "notes", MAX_NOTES, false)),
    paymentMethod: oneOf(r.paymentMethod, ["bold", "qr"] as const, "paymentMethod"),
    acceptedPolicy: true,
    items: rawItems.map(parseItem),
  };
  if (delivery) value.delivery = delivery;
  return value;
}

export function parseCheckoutInput(body: unknown): ParseResult {
  try {
    return { ok: true, value: parse(body) };
  } catch (e) {
    if (e instanceof InvalidInput) return { ok: false, error: e.message };
    throw e;
  }
}
