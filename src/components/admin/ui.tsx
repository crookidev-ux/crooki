import { Bike, CalendarClock, ChevronRight, Store, Utensils, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { AdminPayKey, OrderStatusValue } from "@/lib/admin-orders";
import { ORDER_STATUS_LABEL, PAY_LABEL } from "@/lib/admin-orders";

// Server-safe building blocks of the admin design system (styles in
// src/app/[locale]/admin/admin.css).

export function PageHeader({
  crumbs,
  title,
  description,
  actions,
}: {
  crumbs?: { label: string; href?: string }[];
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="adm-ph">
      <div className="min-w-0">
        {crumbs?.length === 1 && <div className="adm-crumb">{crumbs[0].label}</div>}
        {crumbs && crumbs.length > 1 && (
          <nav aria-label="Ruta" className="adm-crumb">
            {crumbs.map((c, i) => (
              <span key={c.label} className="inline-flex items-center gap-1.5">
                {i > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}
                {c.href ? <Link href={c.href}>{c.label}</Link> : <span>{c.label}</span>}
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="adm-ph-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="adm-empty">
      <Icon aria-hidden="true" />
      {children}
    </div>
  );
}

const PAY_TONE: Record<AdminPayKey, string> = { paid: "ok", awaiting: "", rejected: "bad", qr: "warn" };
const STATUS_TONE: Record<OrderStatusValue, string> = {
  pending: "warn",
  confirmed: "info",
  delivered: "ok",
  cancelled: "bad",
};

export function PayBadge({ pay }: { pay: AdminPayKey }) {
  return <span className={`adm-badge ${PAY_TONE[pay]}`}>{PAY_LABEL[pay]}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status as OrderStatusValue;
  return <span className={`adm-badge ${STATUS_TONE[s] ?? ""}`}>{ORDER_STATUS_LABEL[s] ?? status}</span>;
}

export const money = (n: number | null | undefined) => `$${Number(n ?? 0).toLocaleString("es-CO")}`;

/** Delivery / pickup / dine-in (or scheduled) as an icon tile. */
export function FulfillmentIcon({ order }: { order: { fulfillment: string | null; scheduled_for: string | null } }) {
  const Icon = order.scheduled_for
    ? CalendarClock
    : order.fulfillment === "pickup"
      ? Store
      : order.fulfillment === "dine_in"
        ? Utensils
        : Bike;
  return (
    <span className="adm-ftype" aria-hidden="true">
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}
