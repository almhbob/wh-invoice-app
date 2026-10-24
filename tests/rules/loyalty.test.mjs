// Loyalty ledger against the Firestore emulator with the production rules:
// settle exactly once (even when several devices race), redeem, reverse on delete, re-apply on restore.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from "firebase/firestore";
import { syncOrderLoyalty, adjustPoints } from "./loyaltyTx.mjs";

const C = "laviviane-trial";
const env = await initializeTestEnvironment({ projectId: "loyalty-test", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
const S = {
  enabled: true, pointsPerRiyal: 1, pointValue: 0.05, minRedeemPoints: 100, maxRedeemPercent: 50, startAt: "2026-01-01T00:00:00.000Z",
  tiers: [{ id: "silver", name: "فضي", minSpent: 0, multiplier: 1 }, { id: "gold", name: "ذهبي", minSpent: 1500, multiplier: 1.25 }],
};
const cashier = env.authenticatedContext("u2", { companyId: C, role: "cashier", eid: "e2", firebase: { sign_in_provider: "custom" } }).firestore();
const other = env.authenticatedContext("u3", { companyId: C, role: "cake", eid: "e3", firebase: { sign_in_provider: "custom" } }).firestore();
const KEY = "551234567";
const acc = async () => (await getDoc(doc(cashier, `companies/${C}/loyaltyAccounts/${KEY}`))).data();
const ord = (id) => doc(cashier, `companies/${C}/orders/${id}`);
const now = () => new Date().toISOString();
let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("✓", name); };

await t("first purchase earns points once, even if several devices settle at the same time", async () => {
  await setDoc(ord("o1"), { customerName: "نورة", customerPhone: "0551234567", totalAmount: 230, insuranceAmount: 30, createdAt: now(), orderNumber: 1 });
  const results = await Promise.all([syncOrderLoyalty(cashier, C, "o1", S), syncOrderLoyalty(other, C, "o1", S), syncOrderLoyalty(cashier, C, "o1", S)]);
  assert.equal(results.filter((r) => r === "applied").length, 1);
  const a = await acc();
  assert.equal(a.points, 200, "insurance does not earn");
  assert.equal(a.lifetimeSpent, 200);
  assert.equal(a.orders, 1);
  assert.equal((await getDoc(ord("o1"))).data().loyalty.state, "applied");
});

await t("orders before the program start do not earn", async () => {
  await setDoc(ord("old"), { customerPhone: "0551234567", totalAmount: 500, createdAt: "2025-12-31T10:00:00.000Z" });
  assert.equal(await syncOrderLoyalty(cashier, C, "old", S), "skipped");
  assert.equal((await acc()).points, 200);
});

await t("redeeming at the counter deducts points and earns on the remainder", async () => {
  await setDoc(ord("o2"), { customerPhone: "+966 55 123 4567", totalAmount: 90, createdAt: now(), loyalty: { key: KEY, base: 90, redeemPoints: 200, redeemValue: 10 } });
  await syncOrderLoyalty(cashier, C, "o2", S);
  const a = await acc();
  assert.equal(a.points, 90);
  assert.equal(a.redeemedPoints, 200);
});

await t("deleting an order reverses its points; restoring re-applies them", async () => {
  await updateDoc(ord("o2"), { deleted: true });
  assert.equal(await syncOrderLoyalty(cashier, C, "o2", S), "reversed");
  assert.equal((await acc()).points, 200);
  assert.equal(await syncOrderLoyalty(cashier, C, "o2", S), "skipped", "reversal happens once");
  await updateDoc(ord("o2"), { deleted: false });
  assert.equal(await syncOrderLoyalty(cashier, C, "o2", S), "applied");
  assert.equal((await acc()).points, 90);
});

await t("manager adjustment with a reason, kept in the audit trail", async () => {
  await adjustPoints(cashier, C, "0551234567", "نورة", 50, "تعويض تأخير", { name: "مشرف", employeeId: "S1" });
  assert.equal((await acc()).points, 140);
  const log = (await getDocs(collection(cashier, `companies/${C}/loyaltyTxns`))).docs.map((d) => d.data().type);
  assert.deepEqual(log.sort(), ["adjust", "reverse", "settle", "settle", "settle"].sort());
});

await t("disabled program: no earning, but a redemption already given is still deducted", async () => {
  const off = { ...S, enabled: false };
  await setDoc(ord("o3"), { customerPhone: "0551234567", totalAmount: 100, createdAt: now() });
  assert.equal(await syncOrderLoyalty(cashier, C, "o3", off), "skipped");
  await setDoc(ord("o4"), { customerPhone: "0551234567", totalAmount: 100, createdAt: now(), loyalty: { key: KEY, base: 100, redeemPoints: 100, redeemValue: 5 } });
  await syncOrderLoyalty(cashier, C, "o4", off);
  assert.equal((await acc()).points, 40);
});

await t("other companies cannot read or write the ledger", async () => {
  const outsider = env.authenticatedContext("x", { companyId: "other", role: "admin", eid: "x", firebase: { sign_in_provider: "custom" } }).firestore();
  await assert.rejects(getDoc(doc(outsider, `companies/${C}/loyaltyAccounts/${KEY}`)));
  await assert.rejects(syncOrderLoyalty(outsider, C, "o1", S));
});

await env.cleanup();
console.log(`\n${n} loyalty checks passed`);
