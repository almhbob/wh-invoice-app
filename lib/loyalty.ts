import { collection, doc, onSnapshot, setDoc } from "firebase/firestore";

import { LoyaltySettings, normalizeLoyalty } from "@/constants/loyalty";
import { db } from "@/lib/firebase";
import { adjustPoints as adjustTx, LoyaltyAccount, syncOrderLoyalty as syncTx } from "@/lib/loyaltyTx";

export type { LoyaltyAccount } from "@/lib/loyaltyTx";
export { loyaltyBase, needsLoyaltySync } from "@/lib/loyaltyTx";

const accountRef = (companyId: string, key: string) => doc(db, "companies", companyId, "loyaltyAccounts", key);
const settingsRef = (companyId: string) => doc(db, "companies", companyId, "settings", "loyalty");

export function subscribeLoyaltySettings(companyId: string, cb: (s: LoyaltySettings) => void) {
  return onSnapshot(settingsRef(companyId), (snap) => cb(normalizeLoyalty(snap.data())), () => cb(normalizeLoyalty(undefined)));
}

export function saveLoyaltySettings(companyId: string, s: LoyaltySettings) {
  return setDoc(settingsRef(companyId), { ...s, updatedAt: new Date().toISOString() });
}

export function subscribeAccount(companyId: string, key: string, cb: (a: LoyaltyAccount | null) => void) {
  return onSnapshot(accountRef(companyId, key), (snap) => cb(snap.exists() ? ({ ...(snap.data() as LoyaltyAccount), key }) : null), () => cb(null));
}

export function subscribeAccounts(companyId: string, cb: (list: LoyaltyAccount[]) => void) {
  return onSnapshot(
    collection(db, "companies", companyId, "loyaltyAccounts"),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as LoyaltyAccount), key: d.id }))),
    () => cb([])
  );
}

export const syncOrderLoyalty = (companyId: string, orderId: string, s: LoyaltySettings) => syncTx(db, companyId, orderId, s);

export const adjustPoints = (companyId: string, phone: string, name: string, delta: number, reason: string, by: { name: string; employeeId: string }) =>
  adjustTx(db, companyId, phone, name, delta, reason, by);
