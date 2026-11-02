import type { Order, PaymentMethod } from "@/context/OrdersContext";

/**
 * Money rules shared by reports, shift close and the daily (Z) closing.
 *
 * - `totalAmount` is what the customer owes: goods after discounts + the tray
 *   deposit (insurance). The deposit is refundable, so it is NOT sales revenue.
 * - `amountPaid` is what was collected when the order was taken (it can be
 *   lower — a deposit/partial payment — or higher when change was given).
 *   When it is missing the order was paid in full.
 */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Refundable tray deposit on the order. */
export function orderDeposit(o: Pick<Order, "insuranceAmount">): number {
  const v = o.insuranceAmount ?? 0;
  return v > 0 ? v : 0;
}

/** Sales revenue of the order: what the customer owes minus the refundable deposit. */
export function orderNetSales(o: Pick<Order, "totalAmount" | "insuranceAmount">): number {
  return round2(Math.max(0, (o.totalAmount ?? 0) - orderDeposit(o)));
}

/**
 * Discount given on the order, in riyals. Uses the stored amount when the
 * cashier saved it; otherwise derives it from the discount rule and the net
 * sales (older orders), capping a fixed discount at what was sold.
 */
export function orderDiscountAmount(o: Pick<Order, "discount" | "discountAmount" | "totalAmount" | "insuranceAmount">): number {
  if (typeof o.discountAmount === "number") return round2(Math.max(0, o.discountAmount));
  const d = o.discount;
  if (!d || !(d.value > 0)) return 0;
  const net = orderNetSales(o);
  if (d.type === "percentage") {
    const p = Math.min(d.value, 100) / 100;
    // net = subtotal × (1 − p)  →  discount = net × p / (1 − p)
    return p >= 1 ? 0 : round2((net * p) / (1 - p));
  }
  return round2(d.value);
}

export type MoneyBuckets = Record<PaymentMethod, number>;

/**
 * Money that actually entered each till bucket when the order was taken:
 * the deposit goes to its own payment method, the goods part to the order's
 * method, and only what was collected (not the unpaid remainder) counts.
 */
export function orderCollected(o: Pick<Order, "totalAmount" | "amountPaid" | "insuranceAmount" | "paymentMethod" | "insurancePaymentMethod">): MoneyBuckets {
  const out: MoneyBuckets = { cash: 0, card: 0, transfer: 0 };
  const total = o.totalAmount ?? 0;
  const collected = Math.max(0, Math.min(o.amountPaid ?? total, total));
  const deposit = Math.min(orderDeposit(o), collected);
  const goods = collected - deposit;
  const method: PaymentMethod = o.paymentMethod ?? "cash";
  out[method] += goods;
  if (deposit > 0) out[o.insurancePaymentMethod ?? method] += deposit;
  out.cash = round2(out.cash);
  out.card = round2(out.card);
  out.transfer = round2(out.transfer);
  return out;
}

/** Amount still owed by the customer on this order. */
export function orderOutstanding(o: Pick<Order, "totalAmount" | "amountPaid">): number {
  const total = o.totalAmount ?? 0;
  return round2(Math.max(0, total - Math.min(o.amountPaid ?? total, total)));
}

export interface MoneySummary {
  orderCount: number;
  netSales: number;
  deposits: number;
  discounts: number;
  outstanding: number;
  collected: MoneyBuckets;
  collectedTotal: number;
}

export function summarizeOrders(orders: Order[]): MoneySummary {
  const s: MoneySummary = {
    orderCount: 0, netSales: 0, deposits: 0, discounts: 0, outstanding: 0,
    collected: { cash: 0, card: 0, transfer: 0 }, collectedTotal: 0,
  };
  for (const o of orders) {
    if (o.deleted) continue;
    s.orderCount += 1;
    s.netSales += orderNetSales(o);
    s.deposits += orderDeposit(o);
    s.discounts += orderDiscountAmount(o);
    s.outstanding += orderOutstanding(o);
    const c = orderCollected(o);
    s.collected.cash += c.cash;
    s.collected.card += c.card;
    s.collected.transfer += c.transfer;
  }
  s.netSales = round2(s.netSales);
  s.deposits = round2(s.deposits);
  s.discounts = round2(s.discounts);
  s.outstanding = round2(s.outstanding);
  s.collected = { cash: round2(s.collected.cash), card: round2(s.collected.card), transfer: round2(s.collected.transfer) };
  s.collectedTotal = round2(s.collected.cash + s.collected.card + s.collected.transfer);
  return s;
}
