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

await env.cleanup();
assert.equal(n, 9);
console.log(`All ${n} rule suites passed`);
