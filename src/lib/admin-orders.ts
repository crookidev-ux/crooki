// Lógica pura de la lista de pedidos del admin (sin React) para poder probarla.

export type AdminPayKey = "paid" | "awaiting" | "rejected" | "qr";

type OrderLike = {
  status: string;
  payment_method?: string | null;
  payment_status?: string | null;
};

/** Pedido de pago en línea que aún no está pagado: no hay nada que preparar. */
export function isUnpaidBold(o: OrderLike): boolean {
  return o.payment_method === "bold" && o.payment_status !== "paid";
}

/** Clave de la etiqueta de pago. Pedidos antiguos (sin método) se tratan como QR / WhatsApp. */
export function payLabelKey(o: OrderLike): AdminPayKey {
  if (o.payment_method === "bold") {
    if (o.payment_status === "paid") return "paid";
    if (o.payment_status === "rejected") return "rejected";
    return "awaiting";
  }
  return "qr";
}

/** Cuenta como «pendiente» (por preparar) solo si está pendiente y no es un pago en línea sin pagar. */
export function countsAsPending(o: OrderLike): boolean {
  return o.status === "pending" && !isUnpaidBold(o);
}

/** 0 = pedidos normales, 1 = pago en línea sin pagar (van al final). */
export function sortRank(o: OrderLike): number {
  return isUnpaidBold(o) ? 1 : 0;
}

/** Orden estable: conserva el orden recibido (más recientes primero) y hunde los sin pagar. */
export function sortOrdersForAdmin<T extends OrderLike>(orders: T[]): T[] {
  return orders
    .map((o, i) => ({ o, i }))
    .sort((a, b) => sortRank(a.o) - sortRank(b.o) || a.i - b.i)
    .map((x) => x.o);
}

const WARNING_MARK = "⚠";

/** Líneas de las notas que son alertas (cobro doble, monto distinto) para mostrarlas destacadas. */
export function warningLines(notes: string | null | undefined): string[] {
  if (!notes) return [];
  return notes
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith(WARNING_MARK));
}
