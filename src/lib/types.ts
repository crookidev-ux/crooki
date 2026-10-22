import type { Fulfillment } from "./delivery-zones";

export type Locale = "es" | "en";

export type CategoryKind = "menu" | "merch";

// Kept as string so admin-created categories work without a TS change.
// The seeded menu order below only controls the legacy mock fallback.
export type Category = string;

export const CATEGORY_ORDER: string[] = [
  "galletas",
  "cajas",
  "helados",
  "especiales",
  "salados",
  "malteadas",
  "bebidas-frias",
  "bebidas-calientes",
];

export interface CategoryRow {
  slug: string;
  label_es: string;
  label_en: string;
  kind: CategoryKind;
  display_order: number;
  // Hidden categories (visible=false) are editable in the admin but excluded
  // from the customer pages. Optional so mock/legacy rows default to shown.
  visible?: boolean;
  created_at?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  display_order: number;
}

export interface Product {
  id: string;
  name_es: string;
  name_en: string;
  description_es: string;
  description_en: string;
  price: number;
  category: string;
  available: boolean;
  display_order: number;
  created_at: string;
  product_images: ProductImage[];
  // Combo-specific fields. `includes_salsa` is meaningful only for combos.
  // The two arrays are populated when the combo product is loaded with its
  // configuration; they're optional everywhere else.
  includes_salsa?: boolean;
  combo_cookies?: ComboCookieRow[];
  combo_salsas?: ComboSalsaRow[];
  // Box-specific fields. Meaningful only when category === 'cajas'.
  // `box_cookie_count` is the exact number of cookies the customer must pick.
  // The two gift-card prices are nullable; null = that add-on isn't offered.
  box_cookie_count?: number;
  gift_card_price?: number | null;
  gift_card_cake_price?: number | null;
  box_cookies?: BoxCookieRow[];
  included_salsas_count?: number;
}

export interface ComboCookieRow {
  id: string;
  combo_id: string;
  cookie_id: string;
  extra_price: number;
  display_order: number;
}

export interface ComboSalsaRow {
  id: string;
  combo_id: string;
  salsa_id: string;
  extra_price: number;
  display_order: number;
}

export interface BoxCookieRow {
  id: string;
  box_id: string;
  cookie_id: string;
  extra_price: number;
  display_order: number;
}

export type GiftCardChoice = "none" | "card" | "card_and_cake";

export interface BoxSelection {
  cookies: Array<{
    cookieId: string;
    cookieName: string;
    quantity: number;
    extraPrice: number;
  }>;
  giftCard: GiftCardChoice;
  giftCardPrice: number; // 0 when giftCard === 'none'
}

// Customer's helado salsa add-ons captured in the cart. Salsa eligibility is
// configured per-helado by the admin through the same `combo_salsas` rows the
// combos use (combo_id = the helado's product id).
export interface HeladoSelection {
  salsas: Array<{
    salsaId: string;
    salsaName: string;
    quantity: number;
    extraPrice: number;
  }>;
}

// Customer's combo configuration captured in the cart.
export interface ComboSelection {
  cookieId: string;
  cookieName: string;
  cookieExtra: number;
  includedSalsaId?: string;
  includedSalsaName?: string;
  additionalSalsas: Array<{
    salsaId: string;
    salsaName: string;
    quantity: number;
    extraPrice: number;
  }>;
}

export interface CartItem {
  product: Product;
  quantity: number;
  // Stable identifier — required for combos and boxes so two same-product cart
  // lines with different selections don't collapse. For plain products this
  // equals `product.id`.
  lineId: string;
  combo?: ComboSelection;
  box?: BoxSelection;
  helado?: HeladoSelection;
  // Per-unit price including all customization extras. Falls back to
  // `product.price` if absent.
  unitPrice?: number;
}

export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product_name: string;
}

export type PaymentStatus = "unpaid" | "awaiting_payment" | "paid" | "rejected";

export type PaymentMethod = "bold" | "qr";

export type { Fulfillment } from "./delivery-zones";

export interface PaymentAttempt {
  id: string;
  order_id: string;
  bold_order_id: string;
  amount: number;
  status: "created" | "approved" | "rejected";
  bold_payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  notes: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items: OrderItem[];
  fulfillment: Fulfillment;
  delivery_zone: string | null;
  delivery_fee: number;
  recipient_phone: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_at: string | null;
}
