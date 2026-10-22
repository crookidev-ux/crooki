// Pure line-price and line-name rules shared by the cart UI and the server.
import type { GiftCardChoice } from "@/lib/types";

interface PricedQty {
  quantity: number;
  extraPrice: number;
}

export function comboUnitPrice(basePrice: number, cookieExtra: number): number {
  return basePrice + cookieExtra;
}

export function boxUnitPrice(
  basePrice: number,
  cookies: PricedQty[],
  giftCard: GiftCardChoice,
  giftCardPrice: number | null,
  giftCardCakePrice: number | null,
): number {
  const extras = cookies.reduce((sum, c) => sum + c.quantity * c.extraPrice, 0);
  const giftCost =
    giftCard === "card"
      ? giftCardPrice ?? 0
      : giftCard === "card_and_cake"
        ? giftCardCakePrice ?? 0
        : 0;
  return basePrice + extras + giftCost;
}

export function heladoUnitPrice(basePrice: number, salsas: PricedQty[]): number {
  return basePrice + salsas.reduce((sum, s) => sum + s.quantity * s.extraPrice, 0);
}

export interface LineNameSelection {
  combo?: {
    cookieName: string;
    includedSalsaName?: string;
    additionalSalsas?: { salsaName: string; quantity: number }[];
  };
  box?: {
    cookies: { cookieName: string; quantity: number }[];
    giftCard: GiftCardChoice;
  };
  helado?: { salsas: { salsaName: string; quantity: number }[] };
}

export function lineDisplayName(baseName: string, sel: LineNameSelection): string {
  if (sel.combo) {
    const parts: string[] = [sel.combo.cookieName];
    if (sel.combo.includedSalsaName) parts.push(`Salsa ${sel.combo.includedSalsaName}`);
    for (const extra of sel.combo.additionalSalsas ?? []) {
      parts.push(`${extra.quantity}× ${extra.salsaName}`);
    }
    return `${baseName} · ${parts.join(" + ")}`;
  }
  if (sel.box) {
    const cookieParts = sel.box.cookies.map((c) => `${c.quantity}× ${c.cookieName}`);
    const giftSuffix =
      sel.box.giftCard === "card"
        ? " · Gift card"
        : sel.box.giftCard === "card_and_cake"
          ? " · Gift card + vela"
          : "";
    return `${baseName} · ${cookieParts.join(" + ")}${giftSuffix}`;
  }
  if (sel.helado && sel.helado.salsas.length > 0) {
    const salsaParts = sel.helado.salsas.map((s) => `${s.quantity}× ${s.salsaName}`);
    return `${baseName} · ${salsaParts.join(" + ")}`;
  }
  return baseName;
}
