"use client";

import { useTransition } from "react";
import { Check, Loader2, PackageCheck, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { recheckPayments, setOrderStatus } from "@/app/[locale]/admin/pedidos/actions";
import type { OrderStatusValue } from "@/lib/admin-orders";
import { ConfirmButton } from "./controls";

/** Confirm / Delivered / Cancel for one order. `allowed` comes from nextStatuses() on the server. */
export function OrderStatusButtons({
  orderId,
  allowed,
  paidOnline,
}: {
  orderId: string;
  allowed: OrderStatusValue[];
  /** Paid with Bold: cancelling needs a refund in Bold, so the dialog says so. */
  paidOnline: boolean;
}) {
  const [pending, start] = useTransition();
  const run = (next: OrderStatusValue) =>
    start(async () => {
      const res = await setOrderStatus(orderId, next);
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    });

  if (allowed.length === 0) return null;
  const spin = <Loader2 aria-hidden="true" className="h-[18px] w-[18px] animate-spin" />;
  return (
    <div className="flex flex-wrap gap-2" aria-busy={pending}>
      {allowed.includes("confirmed") && (
        <button type="button" className="adm-btn adm-btn-primary flex-1" disabled={pending} onClick={() => run("confirmed")}>
          {pending ? spin : <Check aria-hidden="true" className="h-[18px] w-[18px]" />}
          Confirmar
        </button>
      )}
      {allowed.includes("delivered") && (
        <button
          type="button"
          className={`adm-btn flex-1 ${allowed.includes("confirmed") ? "" : "adm-btn-primary"}`}
          disabled={pending}
          onClick={() => run("delivered")}
        >
          {pending ? spin : <PackageCheck aria-hidden="true" className="h-[18px] w-[18px]" />}
          Marcar entregado
        </button>
      )}
      {allowed.includes("cancelled") && (
        <ConfirmButton
          className="adm-btn adm-btn-danger"
          disabled={pending}
          title="¿Cancelar este pedido?"
          body={
            paidOnline
              ? "Este pedido ya se pagó con Bold. Cancelarlo aquí no devuelve el dinero: haz el reembolso en el panel de Bold."
              : "El pedido queda como cancelado y sale de la lista por preparar. No se puede deshacer desde el panel."
          }
          confirmLabel="Sí, cancelar"
          onConfirm={() => run("cancelled")}
        >
          <X aria-hidden="true" className="h-[18px] w-[18px]" />
          Cancelar
        </ConfirmButton>
      )}
    </div>
  );
}

/** Re-checks recent Bold payments (a lost webhook) and reloads the page data. */
export function RecheckPaymentsButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="adm-btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await recheckPayments();
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
        })
      }
    >
      <RefreshCw aria-hidden="true" className={`h-[18px] w-[18px] ${pending ? "animate-spin" : ""}`} />
      {pending ? "Actualizando…" : "Actualizar"}
    </button>
  );
}
