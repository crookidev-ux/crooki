"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { canTransition, isOpenOrder, ORDER_STATUS_LABEL } from "@/lib/admin-orders";
import { isBoldConfigured } from "@/lib/bold";
import { reconcileRecentBoldOrders } from "@/lib/payments.reconcile";
import { createServiceClient } from "@/lib/supabase/service";

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Moves an order to `next` (confirmed / delivered / cancelled). Server Actions
 * are reachable by direct POST, so this re-checks everything: admin session,
 * the transition rules of admin-orders.ts against the row as it is now, and a
 * guarded update (`status` must still be what we read) so two admins tapping
 * at once cannot skip a step. Uses the admin's own session: RLS
 * (`is_admin()`) is the last line of defence.
 */
export async function setOrderStatus(orderId: string, next: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin("es");
  if (typeof orderId !== "string" || !UUID.test(orderId)) return { ok: false, message: "Pedido no válido." };

  const { data: order, error: readError } = await supabase
    .from("orders")
    .select("id, status, payment_method, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (readError) {
    console.error("[admin/pedidos] read before status change", orderId, readError);
    return { ok: false, message: "No se pudo leer el pedido. Inténtalo de nuevo." };
  }
  if (!order) return { ok: false, message: "No encontramos ese pedido." };

  if (!canTransition(order, next)) {
    const why = !isOpenOrder(order)
      ? `El pedido ya está ${ORDER_STATUS_LABEL[order.status as keyof typeof ORDER_STATUS_LABEL]?.toLowerCase() ?? order.status}.`
      : "Este pedido se pagó en línea y Bold aún no confirma el pago: no se puede confirmar ni entregar.";
    return { ok: false, message: why };
  }

  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: next })
    .eq("id", orderId)
    .eq("status", order.status)
    // Bold may confirm the payment meanwhile: decide again from fresh data.
    .eq("payment_status", order.payment_status)
    .eq("payment_method", order.payment_method)
    .select("id");
  if (error) {
    console.error("[admin/pedidos] status change", orderId, next, error);
    return { ok: false, message: `No se guardó el cambio: ${error.message}` };
  }
  if (!updated?.length) {
    return { ok: false, message: "El pedido cambió mientras tanto. Revisa su estado actual." };
  }

  refresh();
  return { ok: true, message: `Pedido marcado como ${ORDER_STATUS_LABEL[next].toLowerCase()}.` };
}

/** «Actualizar»: asks Bold about recent unpaid online orders (a lost webhook) and reloads the page. */
export async function recheckPayments(): Promise<ActionResult> {
  await requireAdmin("es");
  let changed = 0;
  if (isBoldConfigured()) changed = await reconcileRecentBoldOrders(createServiceClient());
  refresh();
  return {
    ok: true,
    message: changed > 0 ? `Bold actualizó ${changed} pago${changed === 1 ? "" : "s"}.` : "Lista al día.",
  };
}
