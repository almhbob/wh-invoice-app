// Admin reset against the Firestore emulator: removes every order (beyond one page),
// honours the options, keeps employees/products/settings, logs who did it.
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";
import { countCompanyData, exportCompanyData, purgeCompanyData } from "./purge.mjs";

const C = "laviviane-trial";
const env = await initializeTestEnvironment({ projectId: "purge-test", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
const admin = env.authenticatedContext("u1", { companyId: C, role: "admin", eid: "e1", firebase: { sign_in_provider: "custom" } }).firestore();
const outsider = env.authenticatedContext("x", { companyId: "other", role: "admin", eid: "x", firebase: { sign_in_provider: "custom" } }).firestore();

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (let start = 0; start < 950; start += 450) {
    const b = writeBatch(db);
    for (let i = start; i < Math.min(950, start + 450); i++) b.set(doc(db, `companies/${C}/orders/o${i}`), { orderNumber: i + 1, totalAmount: 10 });
    await b.commit();
  }
  await setDoc(doc(db, `companies/${C}/onlineOrders/n1`), { status: "new" });
  await setDoc(doc(db, `companies/${C}/loyaltyAccounts/551234567`), { points: 120 });
  await setDoc(doc(db, `companies/${C}/counters/orders`), { value: 950 });
  await setDoc(doc(db, `companies/${C}/products/p1`), { name: "كيك" });
  await setDoc(doc(db, `companies/${C}/employees/e1`), { name: "Admin", role: "admin" });
  await setDoc(doc(db, `companies/other/orders/keep`), { orderNumber: 1 });
});

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("✓", name); };
const by = { name: "Admin", employeeId: "A1" };

await t("counts what is there", async () => {
  const c = await countCompanyData(admin, C);
  assert.deepEqual(c, { orders: 950, onlineOrders: 1, loyaltyAccounts: 1, loyaltyTxns: 0 });
});

await t("backup contains every record that will be deleted", async () => {
  const b = await exportCompanyData(admin, C, { orders: true, onlineOrders: true, resetNumbering: true, loyalty: false });
  assert.equal(b.collections.orders.length, 950);
  assert.equal(b.collections.onlineOrders.length, 1);
  assert.equal(b.collections.loyaltyAccounts, undefined);
});

await t("another company cannot reset ours", async () => {
  await assert.rejects(purgeCompanyData(outsider, C, { orders: true, onlineOrders: true, resetNumbering: true, loyalty: true }, by));
});

await t("reset removes all orders across pages and keeps the rest", async () => {
  const progress = [];
  const r = await purgeCompanyData(admin, C, { orders: true, onlineOrders: true, resetNumbering: true, loyalty: false }, by, (c, k) => progress.push(`${c}:${k}`));
  assert.equal(r.orders, 950);
  assert.equal(r.onlineOrders, 1);
  assert.ok(progress.length >= 3, "reports progress per page");
  assert.equal((await getDocs(collection(admin, `companies/${C}/orders`))).size, 0);
  assert.equal((await getDoc(doc(admin, `companies/${C}/counters/orders`))).exists(), false, "numbering restarts");
  assert.equal((await getDoc(doc(admin, `companies/${C}/loyaltyAccounts/551234567`))).data().points, 120, "loyalty kept");
  assert.ok((await getDoc(doc(admin, `companies/${C}/products/p1`))).exists(), "products kept");
  assert.ok((await getDoc(doc(admin, `companies/${C}/employees/e1`))).exists(), "employees kept");
  const log = (await getDocs(collection(admin, `companies/${C}/maintenanceLog`))).docs.map((d) => d.data());
  assert.equal(log.length, 1);
  assert.equal(log[0].by.employeeId, "A1");
  await env.withSecurityRulesDisabled(async (ctx) => {
    assert.ok((await getDoc(doc(ctx.firestore(), `companies/other/orders/keep`))).exists(), "other company untouched");
  });
});

await env.cleanup();
console.log(`\n${n} purge checks passed`);
