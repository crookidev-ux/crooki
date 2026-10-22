// Pure server-side cart pricing. Every price and the delivery fee come from
// the catalog loaded from the database; the browser only says what it wants.
// The rules mirror the menu configurators (Combo/Box/HeladoConfigurator).
import { boxUnitPrice, comboUnitPrice, heladoUnitPrice, lineDisplayName } from "../pricing.ts";
import {
  allowedFulfillments,
  getZone,
  onlinePaymentAllowed,
  zoneAllowed,
} from "../delivery-zones.ts";
import type { DeliveryZone } from "@/lib/delivery-zones";
import type { CheckoutInput, CheckoutItemInput } from "@/lib/checkout/schema";

export type CatalogProduct = {
  id: string;
  name_es: string;
  name_en: string;
  price: number;
  available: boolean;
  isMerch: boolean;
  includes_salsa?: boolean;
  box_cookie_count?: number;
  gift_card_price?: number | null;
  gift_card_cake_price?: number | null;
  included_salsas_count?: number;
};

export type Catalog = {
  products: Map<string, CatalogProduct>;
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
  | { ok: false; status: 400 | 409; error: string; unavailable?: string[] };

const key = (parentId: string, childId: string) => `${parentId}:${childId}`;

function hasRowsFor(map: Map<string, number>, parentId: string): boolean {
  const prefix = `${parentId}:`;
  for (const k of map.keys()) if (k.startsWith(prefix)) return true;
  return false;
}

const money = (n: number) => Math.round(n);

type LineResult = { ok: true; line: PricedLine } | { ok: false; error: string };

function priceLine(
  item: CheckoutItemInput,
  product: CatalogProduct,
  catalog: Catalog,
  locale: "es" | "en",
): LineResult {
  const nameOf = (p: CatalogProduct) => (locale === "en" ? p.name_en : p.name_es);
  const bad = (error: string): LineResult => ({ ok: false, error: `${product.id}: ${error}` });
  const isCombo = hasRowsFor(catalog.comboCookies, product.id);
  const isBox = hasRowsFor(catalog.boxCookies, product.id);
  const base = money(product.price);

  let unit: number;
  let name: string;

  if (item.combo) {
    if (!isCombo) return bad("not a combo");
    const extra = catalog.comboCookies.get(key(product.id, item.combo.cookieId));
    const cookie = catalog.products.get(item.combo.cookieId);
    if (extra === undefined || !cookie) return bad("cookie not allowed in this combo");
    let salsaName: string | undefined;
    if (product.includes_salsa) {
      const salsaId = item.combo.includedSalsaId;
      if (!salsaId) return bad("included salsa required");
      const salsa = catalog.products.get(salsaId);
      if (!catalog.comboSalsas.has(key(product.id, salsaId)) || !salsa) {
        return bad("salsa not allowed in this combo");
      }
      salsaName = nameOf(salsa);
    } else if (item.combo.includedSalsaId) {
      return bad("this combo has no included salsa");
    }
    unit = comboUnitPrice(base, money(extra));
    name = lineDisplayName(nameOf(product), {
      combo: { cookieName: nameOf(cookie), includedSalsaName: salsaName },
    });
  } else if (item.box) {
    if (!isBox) return bad("not a box");
    const cookies: { quantity: number; extraPrice: number; cookieName: string }[] = [];
    for (const c of item.box.cookies) {
      const extra = catalog.boxCookies.get(key(product.id, c.cookieId));
      const cookie = catalog.products.get(c.cookieId);
      if (extra === undefined || !cookie) return bad("cookie not allowed in this box");
      cookies.push({ quantity: c.quantity, extraPrice: money(extra), cookieName: nameOf(cookie) });
    }
    const target = Math.max(2, product.box_cookie_count ?? 2);
    const count = cookies.reduce((s, c) => s + c.quantity, 0);
    if (count !== target) return bad(`box needs exactly ${target} cookies`);
    const giftPrice = product.gift_card_price ?? null;
    const giftCakePrice = product.gift_card_cake_price ?? null;
    if (item.box.giftCard === "card" && giftPrice === null) return bad("gift card not offered");
    if (item.box.giftCard === "card_and_cake" && giftCakePrice === null) {
      return bad("gift card + cake not offered");
    }
    unit = boxUnitPrice(
      base,
      cookies,
      item.box.giftCard,
      giftPrice === null ? null : money(giftPrice),
      giftCakePrice === null ? null : money(giftCakePrice),
    );
    name = lineDisplayName(nameOf(product), {
      box: {
        cookies: cookies.map((c) => ({ cookieName: c.cookieName, quantity: c.quantity })),
        giftCard: item.box.giftCard,
      },
    });
  } else if (item.helado && item.helado.salsas.length > 0) {
    if (isCombo || isBox) return bad("not a helado");
    const salsas: { quantity: number; extraPrice: number; salsaName: string }[] = [];
    for (const s of item.helado.salsas) {
      const extra = catalog.comboSalsas.get(key(product.id, s.salsaId));
      const salsa = catalog.products.get(s.salsaId);
      if (extra === undefined || !salsa) return bad("salsa not allowed for this helado");
      salsas.push({ quantity: s.quantity, extraPrice: money(extra), salsaName: nameOf(salsa) });
    }
    const max = product.included_salsas_count ?? 0;
    const count = salsas.reduce((sum, s) => sum + s.quantity, 0);
    if (max > 0 && count > max) return bad(`at most ${max} salsas`);
    unit = heladoUnitPrice(base, salsas);
    name = lineDisplayName(nameOf(product), {
      helado: { salsas: salsas.map((s) => ({ salsaName: s.salsaName, quantity: s.quantity })) },
    });
  } else {
    // Plain line (also a helado with no salsas). Combos and boxes must be configured.
    if (isCombo) return bad("combo requires a cookie selection");
    if (isBox) return bad("box requires a cookie selection");
    unit = base;
    name = nameOf(product);
  }

  return {
    ok: true,
    line: { product_id: product.id, product_name: name, quantity: item.quantity, unit_price: money(unit) },
  };
}

export function priceCart(input: CheckoutInput, catalog: Catalog): PriceCartResult {
  // 1. Every top-level product must exist and be available (409).
  const unavailable: string[] = [];
  for (const item of input.items) {
    const p = catalog.products.get(item.productId);
    if ((!p || !p.available) && !unavailable.includes(item.productId)) {
      unavailable.push(item.productId);
    }
  }
  if (unavailable.length > 0) {
    return { ok: false, status: 409, error: "Some products are not available", unavailable };
  }

  // 2. Price each line from the catalog (400 on an invalid configuration).
  const lines: PricedLine[] = [];
  let hasMerch = false;
  let hasFood = false;
  for (const item of input.items) {
    const product = catalog.products.get(item.productId)!;
    if (product.isMerch) hasMerch = true;
    else hasFood = true;
    const r = priceLine(item, product, catalog, input.locale);
    if (!r.ok) return { ok: false, status: 400, error: r.error };
    lines.push(r.line);
  }

  // 3. Fulfillment and zone rules.
  if (!allowedFulfillments({ hasMerch }).includes(input.fulfillment)) {
    return { ok: false, status: 400, error: "Merch can only be delivered" };
  }
  let zone: DeliveryZone | undefined;
  if (input.fulfillment === "delivery") {
    if (!input.delivery) return { ok: false, status: 400, error: "delivery is required" };
    zone = getZone(input.delivery.zoneId);
    if (!zone) return { ok: false, status: 400, error: "Unknown delivery zone" };
    if (!zoneAllowed(zone.id, { hasFood })) {
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
