// Pure server-side cart pricing. Every price and the delivery fee come from
// the catalog loaded from the database; the browser only says what it wants.
// The rules mirror the menu configurators (Combo/Box/HeladoConfigurator).
import { boxUnitPrice, comboUnitPrice, heladoUnitPrice, lineDisplayName, optionUnitPrice } from "../pricing.ts";
import {
  allowedFulfillments,
  getZone,
  onlinePaymentAllowed,
  strictestRule,
  zoneAllowed,
} from "../delivery-zones.ts";
import type { DeliveryRule, DeliveryZone } from "@/lib/delivery-zones";
import type { CheckoutInput, CheckoutItemInput } from "@/lib/checkout/schema";

export type CatalogProduct = {
  id: string;
  name_es: string;
  name_en: string;
  price: number;
  available: boolean;
  isMerch: boolean;
  /** Category slug; "combos" / "cajas" / "helados" decide the line kind, like ProductGrid. */
  category: string;
  /** false when the product's category is hidden (visible=false); gates top-level lines only. */
  categoryVisible: boolean;
  /** From the product's category; the cart follows the strictest one. */
  deliveryRule: DeliveryRule;
  includes_salsa?: boolean;
  box_cookie_count?: number;
  gift_card_price?: number | null;
  gift_card_cake_price?: number | null;
  included_salsas_count?: number;
};

/** A product_options row (integer pesos), as loaded by catalog.ts. */
export type CatalogOption = {
  id: string;
  label_es: string;
  label_en: string;
  price: number;
  min_qty: number;
  bulk_min_qty: number | null;
  bulk_price: number | null;
};

export type Catalog = {
  products: Map<string, CatalogProduct>;
  /**
   * productId → its options. A product with options is charged ONLY from
   * them (never products.price / sale price). Absent = no product has options.
   */
  options?: Map<string, CatalogOption[]>;
  /** key `${comboId}:${cookieId}` → extra_price */
  comboCookies: Map<string, number>;
  /** key `${comboId}:${salsaId}` → extra_price (also helado salsas: comboId = helado id) */
  comboSalsas: Map<string, number>;
  /** key `${boxId}:${cookieId}` → extra_price */
  boxCookies: Map<string, number>;
};

export type PricedLine = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
};

export type PriceCartResult =
  | {
      ok: true;
      lines: PricedLine[];
      subtotal: number;
      deliveryFee: number;
      total: number;
      zone?: DeliveryZone;
      hasMerch: boolean;
    }
  | { ok: false; status: 400 | 409; error: string; unavailable?: string[]; deliveryRestricted?: boolean };

const key = (parentId: string, childId: string) => `${parentId}:${childId}`;

const money = (n: number) => Math.round(n);
const validMoney = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
const validOptionalMoney = (n: number | null | undefined) => n == null || validMoney(n);

/** Junction extra price, or undefined when the row is missing or its money is invalid. */
function extraFor(map: Map<string, number>, parentId: string, childId: string): number | undefined {
  const v = map.get(key(parentId, childId));
  return validMoney(v) ? money(v) : undefined;
}

const positiveInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

/** Same rules as the product_options CHECKs; a row that breaks them is never used. */
function validOption(o: CatalogOption): boolean {
  if (!positiveInt(o.price) || !positiveInt(o.min_qty)) return false;
  if (o.bulk_min_qty == null && o.bulk_price == null) return true;
  return (
    positiveInt(o.bulk_min_qty) &&
    positiveInt(o.bulk_price) &&
    o.bulk_min_qty > o.min_qty &&
    o.bulk_price < o.price
  );
}

/** The options a product is sold with: undefined when it has none at all. */
function optionsOf(catalog: Catalog, productId: string): CatalogOption[] | undefined {
  // Combos, boxes and helados charge from products.price: leftover option rows
  // must not let them skip its checks.
  const category = catalog.products.get(productId)?.category;
  if (category === "combos" || category === "cajas" || category === "helados") return undefined;
  const rows = catalog.options?.get(productId);
  return rows && rows.length > 0 ? rows.filter(validOption) : undefined;
}

/** A product a customer can put in the cart as a line of its own. */
function orderable(p: CatalogProduct | undefined, options: CatalogOption[] | undefined): boolean {
  if (!p || !p.available || !p.categoryVisible) return false;
  // With options the price comes from them; at least one must be usable.
  if (options) return options.length > 0;
  return (
    validMoney(p.price) &&
    money(p.price) > 0 &&
    validOptionalMoney(p.gift_card_price) &&
    validOptionalMoney(p.gift_card_cake_price)
  );
}

/** A product used inside a combo/box/helado (cookie or salsa). */
function componentAvailable(p: CatalogProduct | undefined): p is CatalogProduct {
  return !!p && p.available;
}

type LineResult =
  | { ok: true; line: PricedLine }
  | { ok: false; error: string }
  | { ok: false; unavailable: string[] };

function priceLine(
  item: CheckoutItemInput,
  product: CatalogProduct,
  catalog: Catalog,
  locale: "es" | "en",
): LineResult {
  const nameOf = (p: CatalogProduct) => (locale === "en" ? p.name_en : p.name_es);
  const bad = (error: string): LineResult => ({ ok: false, error: `${product.id}: ${error}` });
  const base = money(product.price);
  const kind =
    product.category === "combos"
      ? "combo"
      : product.category === "cajas"
        ? "box"
        : product.category === "helados"
          ? "helado"
          : "plain";
  // Options exist only on plain products (schema.ts also forbids mixing them).
  if (item.optionId && kind !== "plain") return bad("this product has no options");

  // Components that exist in the whitelist but can't be sold right now.
  const unavailable: string[] = [];
  const component = (id: string): CatalogProduct | undefined => {
    const p = catalog.products.get(id);
    if (componentAvailable(p)) return p;
    if (!unavailable.includes(id)) unavailable.push(id);
    return undefined;
  };

  let unit: number;
  let name: string;

  if (kind === "combo") {
    if (!item.combo || item.box || item.helado) return bad("combo requires a cookie selection");
    const extra = extraFor(catalog.comboCookies, product.id, item.combo.cookieId);
    if (extra === undefined) return bad("cookie not allowed in this combo");
    const cookie = component(item.combo.cookieId);
    let salsa: CatalogProduct | undefined;
    if (product.includes_salsa) {
      const salsaId = item.combo.includedSalsaId;
      if (!salsaId) return bad("included salsa required");
      if (extraFor(catalog.comboSalsas, product.id, salsaId) === undefined) {
        return bad("salsa not allowed in this combo");
      }
      salsa = component(salsaId);
    } else if (item.combo.includedSalsaId) {
      return bad("this combo has no included salsa");
    }
    if (unavailable.length > 0 || !cookie) return { ok: false, unavailable };
    unit = comboUnitPrice(base, extra);
    name = lineDisplayName(nameOf(product), {
      combo: { cookieName: nameOf(cookie), includedSalsaName: salsa ? nameOf(salsa) : undefined },
    });
  } else if (kind === "box") {
    if (!item.box || item.combo || item.helado) return bad("box requires a cookie selection");
    const picked: { quantity: number; extraPrice: number; cookie?: CatalogProduct }[] = [];
    for (const c of item.box.cookies) {
      const extra = extraFor(catalog.boxCookies, product.id, c.cookieId);
      if (extra === undefined) return bad("cookie not allowed in this box");
      picked.push({ quantity: c.quantity, extraPrice: extra, cookie: component(c.cookieId) });
    }
    const target = Math.max(2, product.box_cookie_count ?? 2);
    const count = picked.reduce((s, c) => s + c.quantity, 0);
    if (count !== target) return bad(`box needs exactly ${target} cookies`);
    const giftPrice = product.gift_card_price ?? null;
    const giftCakePrice = product.gift_card_cake_price ?? null;
    if (item.box.giftCard === "card" && giftPrice === null) return bad("gift card not offered");
    if (item.box.giftCard === "card_and_cake" && giftCakePrice === null) {
      return bad("gift card + cake not offered");
    }
    if (unavailable.length > 0) return { ok: false, unavailable };
    unit = boxUnitPrice(
      base,
      picked,
      item.box.giftCard,
      giftPrice === null ? null : money(giftPrice),
      giftCakePrice === null ? null : money(giftCakePrice),
    );
    name = lineDisplayName(nameOf(product), {
      box: {
        cookies: picked.map((c) => ({ cookieName: nameOf(c.cookie!), quantity: c.quantity })),
        giftCard: item.box.giftCard,
      },
    });
  } else if (kind === "helado") {
    if (item.combo || item.box) return bad("a helado only accepts salsas");
    const picked: { quantity: number; extraPrice: number; salsa?: CatalogProduct }[] = [];
    for (const s of item.helado?.salsas ?? []) {
      const extra = extraFor(catalog.comboSalsas, product.id, s.salsaId);
      if (extra === undefined) return bad("salsa not allowed for this helado");
      picked.push({ quantity: s.quantity, extraPrice: extra, salsa: component(s.salsaId) });
    }
    const max = product.included_salsas_count ?? 0;
    const count = picked.reduce((sum, s) => sum + s.quantity, 0);
    if (max > 0 && count > max) return bad(`at most ${max} salsas`);
    if (unavailable.length > 0) return { ok: false, unavailable };
    // No salsas → plain line (same as HeladoConfigurator's addItem).
    unit = heladoUnitPrice(base, picked);
    name = lineDisplayName(nameOf(product), {
      helado: { salsas: picked.map((s) => ({ salsaName: nameOf(s.salsa!), quantity: s.quantity })) },
    });
  } else {
    if (item.combo || item.box || item.helado) return bad("this product takes no selection");
    const options = optionsOf(catalog, product.id);
    if (options) {
      // Old carts (saved before the product had options) send no option.
      if (!item.optionId) return { ok: false, unavailable: [product.id] };
      const opt = options.find((o) => o.id === item.optionId);
      if (!opt) return bad("option not offered for this product");
      if (item.quantity < opt.min_qty) return bad(`minimum ${opt.min_qty} units for this option`);
      unit = optionUnitPrice(opt, item.quantity);
      name = lineDisplayName(nameOf(product), {
        option: { label: (locale === "en" && opt.label_en) || opt.label_es },
      });
    } else {
      if (item.optionId) return bad("this product has no options");
      unit = base;
      name = nameOf(product);
    }
  }

  return {
    ok: true,
    line: { product_id: product.id, product_name: name, quantity: item.quantity, unit_price: money(unit) },
  };
}

export function priceCart(input: CheckoutInput, catalog: Catalog): PriceCartResult {
  // 1. Every top-level product must exist and be orderable (409): available,
  //    in a visible category, with a positive price ("Consultar" items are not
  //    orderable) and valid money fields.
  const unavailable: string[] = [];
  const addUnavailable = (id: string) => {
    if (!unavailable.includes(id)) unavailable.push(id);
  };
  for (const item of input.items) {
    const ok = orderable(catalog.products.get(item.productId), optionsOf(catalog, item.productId));
    if (!ok) addUnavailable(item.productId);
  }
  if (unavailable.length > 0) {
    return { ok: false, status: 409, error: "Some products are not available", unavailable };
  }

  // The cart merges equal lines, so a repeated product+option only comes from
  // a hand-made request (e.g. splitting lines to play with the minimum).
  const optionLines = new Set<string>();
  for (const item of input.items) {
    if (!item.optionId) continue;
    const k = key(item.productId, item.optionId);
    if (optionLines.has(k)) return { ok: false, status: 400, error: `${item.productId}: duplicate option line` };
    optionLines.add(k);
  }

  // 2. Price each line from the catalog (400 on an invalid configuration,
  //    409 when a chosen cookie/salsa is not available).
  const lines: PricedLine[] = [];
  let hasMerch = false;
  let hasFood = false;
  const rules: DeliveryRule[] = [];
  for (const item of input.items) {
    const product = catalog.products.get(item.productId)!;
    rules.push(product.deliveryRule);
    if (product.isMerch) hasMerch = true;
    else hasFood = true;
    const r = priceLine(item, product, catalog, input.locale);
    if (r.ok) lines.push(r.line);
    else if ("error" in r) return { ok: false, status: 400, error: r.error };
    else r.unavailable.forEach(addUnavailable);
  }
  if (unavailable.length > 0) {
    return { ok: false, status: 409, error: "Some products are not available", unavailable };
  }

  // 3. Fulfillment and zone rules.
  const deliveryRule = strictestRule(rules);
  if (!allowedFulfillments({ hasMerch, deliveryRule }).includes(input.fulfillment)) {
    const restricted = input.fulfillment === "delivery" || deliveryRule === "none";
    const error =
      input.fulfillment === "delivery"
        ? "Some products in this order cannot be delivered"
        : "Merch can only be delivered";
    return { ok: false, status: 400, error, ...(restricted ? { deliveryRestricted: true } : {}) };
  }
  let zone: DeliveryZone | undefined;
  if (input.fulfillment === "delivery") {
    if (!input.delivery) return { ok: false, status: 400, error: "delivery is required" };
    zone = getZone(input.delivery.zoneId);
    if (!zone) return { ok: false, status: 400, error: "Unknown delivery zone" };
    if (!zoneAllowed(zone.id, { hasFood, deliveryRule })) {
      if (deliveryRule === "nearby") {
        return {
          ok: false,
          status: 400,
          error: "This zone is out of range for some products in this order",
          deliveryRestricted: true,
        };
      }
      return { ok: false, status: 400, error: "Food cannot be shipped outside the city" };
    }
  }
  if (input.paymentMethod === "bold" && !onlinePaymentAllowed(zone, input.fulfillment)) {
    return { ok: false, status: 400, error: "Online payment is not available for this zone" };
  }

  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const deliveryFee = money(zone?.fee ?? 0);
  const result: PriceCartResult = {
    ok: true,
    lines,
    subtotal,
    deliveryFee,
    total: subtotal + deliveryFee,
    hasMerch,
  };
  if (zone) result.zone = zone;
  return result;
}
