import { describe, expect, test } from "bun:test";
import type { Order } from "../../context/OrdersContext";
import {
  orderCollected, orderDeposit, orderDiscountAmount, orderNetSales, orderOutstanding, round2, summarizeOrders,
} from "../../utils/orderMoney";

const o = (over: Partial<Order>): Order => ({
  id: "o1", companyId: "c", orderNumber: 1, customerName: "x", customerPhone: "05", orderType: "pickup",
  receivedAt: "", items: [], departmentStatuses: {} as Order["departmentStatuses"], departmentReceivers: {},
  createdAt: "2026-11-02T10:00:00.000Z", updatedAt: "2026-11-02T10:00:00.000Z", ...over,
} as Order);

describe("revenue", () => {
  test("tray deposit is not sales revenue", () => {
    const order = o({ totalAmount: 220, insuranceAmount: 20 });
    expect(orderDeposit(order)).toBe(20);
    expect(orderNetSales(order)).toBe(200);
  });
  test("orders without a total count as zero", () => {
    expect(orderNetSales(o({}))).toBe(0);
  });
  test("rounding avoids float noise", () => {
    expect(round2(3 * 3.3)).toBe(9.9);
  });
});

describe("discounts", () => {
  test("percentage discount recovered from net sales, deposit excluded", () => {
    // subtotal 200, 20% off → 160, plus 30 deposit → total 190
    const order = o({ totalAmount: 190, insuranceAmount: 30, discount: { type: "percentage", value: 20, reason: "" } });
    expect(orderDiscountAmount(order)).toBe(40);
  });
  test("stored discount amount wins", () => {
    const order = o({ totalAmount: 0, discount: { type: "fixed", value: 50, reason: "" }, discountAmount: 30 });
    expect(orderDiscountAmount(order)).toBe(30);
  });
  test("fixed discount on older orders", () => {
    expect(orderDiscountAmount(o({ totalAmount: 90, discount: { type: "fixed", value: 10, reason: "" } }))).toBe(10);
  });
});

describe("till / drawer", () => {
  test("deposit goes to its own payment method", () => {
    const c = orderCollected(o({ totalAmount: 250, insuranceAmount: 50, paymentMethod: "cash", insurancePaymentMethod: "card" }));
    expect(c).toEqual({ cash: 200, card: 50, transfer: 0 });
  });
  test("partial payment only counts what was collected", () => {
    const order = o({ totalAmount: 200, amountPaid: 100, paymentMethod: "cash" });
    expect(orderCollected(order).cash).toBe(100);
    expect(orderOutstanding(order)).toBe(100);
  });
  test("cash tendered above the total (change given) counts the total only", () => {
    expect(orderCollected(o({ totalAmount: 80, amountPaid: 100, paymentMethod: "cash" })).cash).toBe(80);
  });
  test("unpaid online order adds nothing to the drawer", () => {
    const order = o({ totalAmount: 120, amountPaid: 0, paymentMethod: "cash" });
    expect(orderCollected(order)).toEqual({ cash: 0, card: 0, transfer: 0 });
    expect(orderOutstanding(order)).toBe(120);
  });
});

describe("summary", () => {
  test("skips deleted orders and adds everything up", () => {
    const s = summarizeOrders([
      o({ id: "a", totalAmount: 220, insuranceAmount: 20, paymentMethod: "cash" }),
      o({ id: "b", totalAmount: 100, paymentMethod: "card", amountPaid: 40 }),
      o({ id: "c", totalAmount: 999, deleted: true }),
    ]);
    expect(s.orderCount).toBe(2);
    expect(s.netSales).toBe(300);
    expect(s.deposits).toBe(20);
    expect(s.collected).toEqual({ cash: 220, card: 40, transfer: 0 });
    expect(s.collectedTotal).toBe(260);
    expect(s.outstanding).toBe(60);
  });
});
