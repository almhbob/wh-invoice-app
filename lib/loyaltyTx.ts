import { collection, doc, Firestore, runTransaction } from "firebase/firestore";

import { LoyaltySettings, loyaltyKey, OrderLoyalty, settleDelta } from "../constants/loyalty";

/**
 * Loyalty ledger transactions (no app imports, so the emulator tests run them as-is):
 *   companies/{c}/loyaltyAccounts/{phoneKey}  balance + lifetime totals
 *   companies/{c}/loyaltyTxns/{auto}          audit trail of every movement
 *   order.loyalty.state                       "applied" | "reversed" — makes settling idempotent
 *
 * Each movement runs in a transaction that reads the order, so any number of
 * devices can try to settle the same order and the points move exactly once.
 */

export interface LoyaltyAccount {
  key: string;
  phone: string;
  name: string;
  points: number;
  lifetimePoints: number;
  lifetimeSpent: number;
  redeemedPoints: number;
  orders: number;
  lastOrderAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

const accountRef = (db: Firestore, companyId: string, key: string) => doc(db, "companies", companyId, "loyaltyAccounts", key);
const orderRef = (db: Firestore, companyId: string, id: string) => doc(db, "companies", companyId, "orders", id);
const newTxnRef = (db: Firestore, companyId: string) => doc(collection(db, "companies", companyId, "loyaltyTxns"));

type OrderDoc = {
  deleted?: boolean;
  createdAt?: string;
  customerPhone?: string;
  customerName?: string;
  totalAmount?: number;
  insuranceAmount?: number;
  orderNumber?: number;
  loyalty?: OrderLoyalty;
};

/** Earning base: what the customer pays for goods (after discounts, without tray insurance). */
export function loyaltyBase(o: OrderDoc) {
  if (typeof o.loyalty?.base === "number") return Math.max(0, o.loyalty.base);
  return Math.max(0, (o.totalAmount ?? 0) - (o.insuranceAmount ?? 0));
}

/** True when an order still has a loyalty movement to make (settle or reverse). */
export function needsLoyaltySync(o: OrderDoc, s: LoyaltySettings) {
  const state = o.loyalty?.state;
  if (o.deleted) return state === "applied";
  if (state === "applied") return false;
  const key = o.loyalty?.key || loyaltyKey(o.customerPhone);
  if (!key) return false;
  if ((o.loyalty?.redeemPoints ?? 0) > 0) return true;
  if (!s.enabled || !o.createdAt || o.createdAt < s.startAt) return false;
  return loyaltyBase(o) > 0;
}

/** Settle (earn − redeem) or reverse an order's points, exactly once. Returns what happened. */
export async function syncOrderLoyalty(db: Firestore, companyId: string, orderId: string, s: LoyaltySettings): Promise<"applied" | "reversed" | "skipped"> {
  return runTransaction(db, async (tx) => {
    const oSnap = await tx.get(orderRef(db, companyId, orderId));
    if (!oSnap.exists()) return "skipped";
    const o = oSnap.data() as OrderDoc;
    if (!needsLoyaltySync(o, s)) return "skipped";
    const L: OrderLoyalty = o.loyalty ?? { key: "" };
    const key = L.key || loyaltyKey(o.customerPhone);
    const aRef = accountRef(db, companyId, key);
    const aSnap = await tx.get(aRef);
    const acc = (aSnap.exists() ? aSnap.data() : {}) as Partial<LoyaltyAccount>;
    const now = new Date().toISOString();
    const base = loyaltyBase(o);

    if (o.deleted) {
      const earned = L.earnedPoints ?? 0;
      const redeemed = L.redeemPoints ?? 0;
      tx.set(aRef, {
        points: (acc.points ?? 0) - earned + redeemed,
        lifetimePoints: Math.max(0, (acc.lifetimePoints ?? 0) - earned),
        lifetimeSpent: Math.max(0, (acc.lifetimeSpent ?? 0) - base),
        redeemedPoints: Math.max(0, (acc.redeemedPoints ?? 0) - redeemed),
        orders: Math.max(0, (acc.orders ?? 0) - 1),
        updatedAt: now,
      }, { merge: true });
      tx.update(orderRef(db, companyId, orderId), { "loyalty.state": "reversed", "loyalty.appliedAt": now });
      tx.set(newTxnRef(db, companyId), { key, orderId, orderNumber: o.orderNumber ?? null, type: "reverse", earned: -earned, redeemed: -redeemed, at: now });
      return "reversed";
    }

    const { earned, redeemed, delta } = settleDelta(
      s.enabled && o.createdAt && o.createdAt >= s.startAt ? base : 0,
      L.redeemPoints ?? 0,
      acc.points ?? 0,
      acc.lifetimeSpent ?? 0,
      s
    );
    tx.set(aRef, {
      phone: o.customerPhone ?? acc.phone ?? "",
      name: o.customerName || acc.name || "",
      points: (acc.points ?? 0) + delta,
      lifetimePoints: (acc.lifetimePoints ?? 0) + earned,
      lifetimeSpent: (acc.lifetimeSpent ?? 0) + base,
      redeemedPoints: (acc.redeemedPoints ?? 0) + redeemed,
      orders: (acc.orders ?? 0) + 1,
      lastOrderAt: o.createdAt ?? now,
      createdAt: acc.createdAt ?? now,
      updatedAt: now,
    }, { merge: true });
    tx.update(orderRef(db, companyId, orderId), {
      loyalty: { ...L, key, base, earnedPoints: earned, redeemPoints: redeemed, state: "applied", appliedAt: now },
    });
    tx.set(newTxnRef(db, companyId), { key, orderId, orderNumber: o.orderNumber ?? null, type: "settle", earned, redeemed, at: now });
    return "applied";
  });
}

/** Manual correction by a manager (e.g. goodwill points). */
export async function adjustPoints(db: Firestore, companyId: string, phone: string, name: string, delta: number, reason: string, by: { name: string; employeeId: string }) {
  const key = loyaltyKey(phone);
  if (!key || !Number.isFinite(delta) || delta === 0) throw new Error("bad_adjustment");
  await runTransaction(db, async (tx) => {
    const aRef = accountRef(db, companyId, key);
    const aSnap = await tx.get(aRef);
    const acc = (aSnap.exists() ? aSnap.data() : {}) as Partial<LoyaltyAccount>;
    const now = new Date().toISOString();
    tx.set(aRef, {
      phone: acc.phone || phone,
      name: acc.name || name,
      points: (acc.points ?? 0) + Math.round(delta),
      lifetimePoints: (acc.lifetimePoints ?? 0) + Math.max(0, Math.round(delta)),
      createdAt: acc.createdAt ?? now,
      updatedAt: now,
    }, { merge: true });
    tx.set(newTxnRef(db, companyId), { key, orderId: null, type: "adjust", earned: Math.round(delta), redeemed: 0, reason: reason.slice(0, 120), by, at: now });
  });
}
