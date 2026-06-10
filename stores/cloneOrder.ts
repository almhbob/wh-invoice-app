import type { Order } from "@/context/OrdersContext";

// Module-level pending clone — set from Archive, consumed once by Cashier
let _pending: Order | null = null;

export function setPendingClone(order: Order) {
  _pending = order;
}

export function consumePendingClone(): Order | null {
  const o = _pending;
  _pending = null;
  return o;
}
