// Firestore security rules tests. Run via: firebase emulators:exec --only firestore "node tests/rules/firestore.rules.test.mjs"
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from "firebase/firestore";

const C = "laviviane-trial";
const OTHER = "other-co";

const env = await initializeTestEnvironment({
  projectId: "rules-test",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});

// Seed data with rules disabled.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, `companies/${C}`), { name: "Laviviane" });
  await setDoc(doc(db, `companies/${C}/employees/e1`), { name: "Admin", role: "admin", employeeId: "A1" });
  await setDoc(doc(db, `companies/${C}/employees/e2`), { name: "Cashier", role: "cashier", employeeId: "C1", pinCode: "!migrated-x" });
  await setDoc(doc(db, `companies/${C}/employees/e3`), { name: "Sup", role: "branch_supervisor", employeeId: "S1" });
  await setDoc(doc(db, `companies/${C}/employeeSecrets/e1`), { pinHash: "h" });
  await setDoc(doc(db, `companies/${C}/orders/o1`), { total: 10 });
  await setDoc(doc(db, `companies/${OTHER}/orders/o1`), { total: 99 });
  await setDoc(doc(db, `authThrottle/k`), { failures: 1 });
  await setDoc(doc(db, `companies/${C}/employees/e4`), { name: "Platform owner", role: "admin", employeeId: "P1" });
  await setDoc(doc(db, `platformOwners/${C}__e4`), { active: true, platformRole: "owner" });
  await setDoc(doc(db, `companies/${C}/auditLogs/a1`), {
    action: "user_login", actorId: "e2", actorName: "Cashier", targetId: null,
    targetType: null, details: {}, createdAt: serverTimestamp(),
  });
});

// Custom-token sessions: rules-unit-testing sets sign_in_provider via the token's firebase field.
const as = (uid, claims) => env.authenticatedContext(uid, { ...claims, firebase: { sign_in_provider: "custom" } }).firestore();
const admin = as("u1", { companyId: C, role: "admin", eid: "e1" });
const cashier = as("u2", { companyId: C, role: "cashier", eid: "e2" });
const sup = as("u3", { companyId: C, role: "branch_supervisor", eid: "e3" });
const anon = env.authenticatedContext("anon", { firebase: { sign_in_provider: "anonymous" } }).firestore();
const nobody = env.unauthenticatedContext().firestore();
const legacyAnonWithForgedClaims = env.authenticatedContext("x", { companyId: C, role: "admin", firebase: { sign_in_provider: "anonymous" } }).firestore();

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("✓", name); };

await t("anonymous / unauthenticated cannot read anything", async () => {
  await assertFails(getDoc(doc(anon, `companies/${C}/orders/o1`)));
  await assertFails(getDoc(doc(nobody, `companies/${C}/orders/o1`)));
  await assertFails(getDocs(collection(anon, `companies/${C}/employees`)));
  await assertFails(getDoc(doc(legacyAnonWithForgedClaims, `companies/${C}/orders/o1`)));
});
await t("members read/write their own company data", async () => {
  await assertSucceeds(getDoc(doc(cashier, `companies/${C}/orders/o1`)));
  await assertSucceeds(setDoc(doc(cashier, `companies/${C}/orders/o2`), { total: 5 }));
  await assertSucceeds(setDoc(doc(cashier, `companies/${C}/activeSessions/C1`), { deviceId: "d" }));
  await assertSucceeds(getDocs(collection(cashier, `companies/${C}/employees`)));
});
await t("no cross-company access", async () => {
  await assertFails(getDoc(doc(admin, `companies/${OTHER}/orders/o1`)));
  await assertFails(setDoc(doc(admin, `companies/${OTHER}/orders/x`), { a: 1 }));
});
await t("PIN secrets and throttle state are never client-readable", async () => {
  await assertFails(getDoc(doc(admin, `companies/${C}/employeeSecrets/e1`)));
  await assertFails(setDoc(doc(admin, `companies/${C}/employeeSecrets/e2`), { pinHash: "x" }));
  await assertFails(getDoc(doc(admin, `authThrottle/k`)));
});
await t("only managers manage employees; no plaintext PINs", async () => {
  await assertFails(setDoc(doc(cashier, `companies/${C}/employees/n1`), { name: "x", role: "cashier" }));
  await assertFails(updateDoc(doc(cashier, `companies/${C}/employees/e2`), { role: "admin" }));
  await assertSucceeds(setDoc(doc(admin, `companies/${C}/employees/n2`), { name: "x", role: "cake" }));
  await assertFails(setDoc(doc(admin, `companies/${C}/employees/n3`), { name: "x", role: "cake", pinCode: "1234" }));
  await assertFails(updateDoc(doc(admin, `companies/${C}/employees/e2`), { pinCode: "1234" }));
  await assertSucceeds(updateDoc(doc(admin, `companies/${C}/employees/e2`), { status: "suspended" }));
});
await t("branch supervisor cannot create or promote protected roles", async () => {
  await assertFails(setDoc(doc(sup, `companies/${C}/employees/n4`), { name: "x", role: "admin" }));
  await assertFails(updateDoc(doc(sup, `companies/${C}/employees/e2`), { role: "admin" }));
  await assertFails(updateDoc(doc(sup, `companies/${C}/employees/e2`), { role: "cake" }));
  await assertFails(deleteDoc(doc(sup, `companies/${C}/employees/e1`)));
  await assertSucceeds(setDoc(doc(sup, `companies/${C}/employees/n5`), { name: "x", role: "cashier" }));
  await assertFails(setDoc(doc(admin, `companies/${C}/employees/n6`), { name: "x", role: "developer" }));
  await assertFails(setDoc(doc(admin, `companies/${C}/employees/n7`), { name: "x", role: "cashier", platformRole: "owner" }));
  await assertFails(updateDoc(doc(admin, `companies/${C}/employees/e2`), { role: "super_admin" }));
  await assertFails(updateDoc(doc(admin, `companies/${C}/employees/e4`), { name: "Overwritten" }));
  await assertFails(deleteDoc(doc(admin, `companies/${C}/employees/e4`)));
  await assertFails(getDoc(doc(admin, `platformOwners/${C}__e4`)));
});
await t("only company admin can change an existing employee role", async () => {
  await assertSucceeds(updateDoc(doc(admin, `companies/${C}/employees/e2`), { role: "dept_supervisor" }));
  await assertSucceeds(updateDoc(doc(admin, `companies/${C}/employees/e2`), { role: "guest" }));
});
await t("company document: members read, only admin writes", async () => {
  await assertSucceeds(getDoc(doc(cashier, `companies/${C}`)));
  await assertFails(updateDoc(doc(cashier, `companies/${C}`), { name: "hacked" }));
  await assertSucceeds(updateDoc(doc(admin, `companies/${C}`), { name: "Laviviane ✓" }));
});

await t("audit logs are tenant-scoped, actor-bound and append-only", async () => {
  await assertSucceeds(getDoc(doc(admin, `companies/${C}/auditLogs/a1`)));
  await assertFails(getDoc(doc(cashier, `companies/${C}/auditLogs/a1`)));
  await assertSucceeds(setDoc(doc(cashier, `companies/${C}/auditLogs/a2`), {
    action: "user_login", actorId: "e2", actorName: "Cashier", targetId: null,
    targetType: null, details: {}, createdAt: serverTimestamp(),
  }));
  await assertFails(setDoc(doc(cashier, `companies/${C}/auditLogs/a3`), {
    action: "user_login", actorId: "e1", actorName: "Forged", targetId: null,
    targetType: null, details: {}, createdAt: serverTimestamp(),
  }));
  await assertFails(updateDoc(doc(admin, `companies/${C}/auditLogs/a1`), { actorName: "Edited" }));
  await assertFails(deleteDoc(doc(admin, `companies/${C}/auditLogs/a1`)));
  await assertFails(getDoc(doc(admin, `companies/${OTHER}/auditLogs/a1`)));
});

await t("tax profile: whole company reads, only the admin writes", async () => {
  const tax = { enabled: true, sellerName: "Laviviane", vatNumber: "310122393500003", vatRate: 15 };
  await assertSucceeds(setDoc(doc(admin, `companies/${C}/taxProfile/current`), tax));
  await assertSucceeds(getDoc(doc(cashier, `companies/${C}/taxProfile/current`)));
  await assertFails(setDoc(doc(cashier, `companies/${C}/taxProfile/current`), { ...tax, vatNumber: "300000000000003" }));
  await assertFails(setDoc(doc(sup, `companies/${C}/taxProfile/current`), tax));
  await assertFails(setDoc(doc(admin, `companies/${C}/taxProfile/other`), tax));
  await assertFails(getDoc(doc(admin, `companies/${OTHER}/taxProfile/current`)));
  await assertFails(getDoc(doc(nobody, `companies/${C}/taxProfile/current`)));
});

await t("platform leads: server-created, staff follow up, tenants can't see them", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "platformLeads/L1"), { shopName: "Shop", phone: "0551234567", status: "new" });
  });
  const staff = as("p1", { companyId: C, role: "admin", eid: "e4", platformRole: "owner" });
  await assertSucceeds(getDoc(doc(staff, "platformLeads/L1")));
  await assertSucceeds(updateDoc(doc(staff, "platformLeads/L1"), { status: "contacted", updatedAt: "now" }));
  await assertFails(updateDoc(doc(staff, "platformLeads/L1"), { phone: "0500000000" }));
  await assertFails(updateDoc(doc(staff, "platformLeads/L1"), { status: "deleted" }));
  await assertFails(setDoc(doc(staff, "platformLeads/L2"), { shopName: "x" }));
  await assertFails(getDoc(doc(admin, "platformLeads/L1")));
  await assertFails(setDoc(doc(nobody, "platformLeads/L3"), { shopName: "x" }));
});

await t("sales windows: managers set up, staff order, only managers delete", async () => {
  await assertSucceeds(setDoc(doc(sup, `companies/${C}/windows/w1`), { name: "نافذة العليا", active: true, sort: 1 }));
  await assertFails(setDoc(doc(cashier, `companies/${C}/windows/w2`), { name: "x", active: true, sort: 2 }));
  await assertSucceeds(getDoc(doc(cashier, `companies/${C}/windows/w1`)));
  const order = { windowId: "w1", date: "2026-11-02", status: "sent", items: [], depts: {} };
  await assertSucceeds(setDoc(doc(cashier, `companies/${C}/windowOrders/w1_2026-11-02`), order));
  await assertFails(setDoc(doc(cashier, `companies/${C}/windowOrders/other`), order));
  await assertFails(setDoc(doc(cashier, `companies/${C}/windowOrders/w1_2026-11-03`), { ...order, date: "2026-11-03", status: "deleted" }));
  await assertSucceeds(updateDoc(doc(cashier, `companies/${C}/windowOrders/w1_2026-11-02`), { "depts.cake": { status: "ready" } }));
  await assertFails(deleteDoc(doc(cashier, `companies/${C}/windowOrders/w1_2026-11-02`)));
  await assertSucceeds(deleteDoc(doc(admin, `companies/${C}/windowOrders/w1_2026-11-02`)));
  await assertFails(getDoc(doc(admin, `companies/${OTHER}/windowOrders/w1_2026-11-02`)));
});

await t("staff files and payroll are admin-only", async () => {
  await assertSucceeds(setDoc(doc(admin, `companies/${C}/hrWorkers/h1`), { name: "W", iqamaNumber: "2412345678", basicSalary: 3000 }));
  await assertSucceeds(setDoc(doc(admin, `companies/${C}/payroll/2026-11_h1`), { net: 3000 }));
  for (const who of [cashier, sup]) {
    await assertFails(getDoc(doc(who, `companies/${C}/hrWorkers/h1`)));
    await assertFails(getDocs(collection(who, `companies/${C}/hrWorkers`)));
    await assertFails(getDoc(doc(who, `companies/${C}/payroll/2026-11_h1`)));
    await assertFails(setDoc(doc(who, `companies/${C}/hrWorkers/h2`), { name: "x" }));
  }
  await assertFails(getDoc(doc(admin, `companies/${OTHER}/hrWorkers/h1`)));
});

await env.cleanup();
assert.equal(n, 13);
console.log(`All ${n} rule suites passed`);
