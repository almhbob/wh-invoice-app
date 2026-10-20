import { after, before, beforeEach, test as nodeTest } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import ts from "typescript";

// This test suite never uses a real Firebase project or production credentials.
assert.ok(process.env.FIRESTORE_EMULATOR_HOST, "Run through firebase emulators:exec");
assert.ok(process.env.FIREBASE_STORAGE_EMULATOR_HOST, "Storage emulator is required");
const projectId = "demo-tenant-security";
let env;
const serverTimestamp = () => ({ __serverTimestamp: true });
const firestoreBase = `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents`;
const storageBase = `http://127.0.0.1:9199/v0/b/${projectId}.appspot.com/o`;

// Use the emulators' REST protocol. This intentionally avoids loading two
// copies of the web SDK alongside firebase-admin's transitive compat SDK.
function mockToken(uid, claims) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    iss: `https://securetoken.google.com/${projectId}`, aud: projectId,
    sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now, ...claims,
  })}.`;
}
async function request(url, token, options = {}) {
  const response = await fetch(url, {
    ...options, signal: AbortSignal.timeout(90000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`Emulator request failed: HTTP ${response.status}`);
    error.code = response.status === 403 ? "permission-denied" : String(body.error?.status || response.status).toLowerCase().replaceAll("_", "-");
    throw error;
  }
  return body;
}
function value(input) {
  if (input === null) return { nullValue: null };
  if (typeof input === "string") return { stringValue: input };
  if (typeof input === "boolean") return { booleanValue: input };
  if (typeof input === "number") return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  return { mapValue: { fields: fields(input) } };
}
function fields(input) { return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)])); }
function restDb(token) {
  const commit = (write) => request(`${firestoreBase}:commit`, token, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ writes: [write] }),
  });
  return {
    doc(path) {
      const name = `projects/${projectId}/databases/(default)/documents/${path}`;
      const write = (data, update) => {
        const expanded = {};
        const transforms = [];
        for (const [key, item] of Object.entries(data)) {
          if (item?.__serverTimestamp) { transforms.push({ fieldPath: key, setToServerValue: "REQUEST_TIME" }); continue; }
          const parts = key.split(".");
          let target = expanded;
          for (const part of parts.slice(0, -1)) target = (target[part] ||= {});
          target[parts.at(-1)] = item;
        }
        return commit({
          update: { name, fields: fields(expanded) },
          ...(update ? { updateMask: { fieldPaths: Object.keys(data).filter((key) => !data[key]?.__serverTimestamp) }, currentDocument: { exists: true } } : {}),
          ...(transforms.length ? { updateTransforms: transforms } : {}),
        });
      };
      return {
        get: () => request(`${firestoreBase}/${path}`, token),
        set: (data) => write(data, false),
        update: (data) => write(data, true),
        delete: () => commit({ delete: name }),
      };
    },
    collection(path) { return { get: () => request(`${firestoreBase}/${path}`, token) }; },
  };
}
function restStorage(token) {
  return {
    ref(path) {
      return {
        fullPath: path,
        getMetadata: () => request(`${storageBase}/${encodeURIComponent(path)}`, token),
        putString: (text, _format, metadata) => request(`${storageBase}?uploadType=media&name=${encodeURIComponent(path)}`, token, {
          method: "POST", headers: { "Content-Type": metadata.contentType }, body: text,
        }),
      };
    },
  };
}
const withAdmin = (run) => run({ firestore: () => restDb("owner") });
const employee = (uid, role, extras = {}) => ({
  companyId: "alpha", authUid: uid, name: "Test employee", employeeId: uid.toUpperCase(),
  role, status: "active", createdAt: "2026-01-01T00:00:00.000Z", ...extras,
});
const order = (extras = {}) => ({
  companyId: "alpha", orderNumber: 1, createdAt: "2026-01-01T00:00:00.000Z",
  departmentStatuses: { cake: "pending", halwa: "pending", packaging: "pending" },
  departmentReceivers: {}, total: 100, ...extras,
});
function context(uid = "cashier", extras = {}) {
  const token = mockToken(uid, {
    companyId: "alpha", employeeDocId: uid,
    firebase: { sign_in_provider: "password" }, ...extras,
  });
  return { firestore: () => restDb(token), storage: () => restStorage(token) };
}
function db(uid, extras) { return context(uid, extras).firestore(); }
function test(name, run) { return nodeTest(name, { timeout: 120000 }, run); }

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { host: "127.0.0.1", port: 8080, rules: await readFile(new URL("../../firestore.rules", import.meta.url), "utf8") },
    storage: { host: "127.0.0.1", port: 9199, rules: await readFile(new URL("../../storage.rules", import.meta.url), "utf8") },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await withAdmin(async (ctx) => {
    const seed = ctx.firestore();
    const writes = [
      ["companies/alpha", { name: "Alpha", authMigrationVersion: 1 }],
      ["companies/beta", { name: "Beta" }],
      ["companies/alpha/employees/admin", employee("admin", "admin")],
      ["companies/alpha/employees/cashier", employee("cashier", "cashier")],
      ["companies/alpha/employees/cake", employee("cake", "cake")],
      ["companies/alpha/employees/packaging", employee("packaging", "packaging")],
      ["companies/alpha/employees/guest", employee("guest", "guest")],
      ["companies/alpha/employees/branch", employee("branch", "branch_supervisor", { branchId: "north" })],
      ["companies/alpha/employees/north-worker", employee("north-worker", "cashier", { branchId: "north" })],
      ["companies/alpha/employees/south-worker", employee("south-worker", "cashier", { branchId: "south" })],
      ["companies/alpha/employees/suspended", employee("suspended", "admin", { status: "suspended" })],
      ["companies/beta/employees/beta-admin", { ...employee("beta-admin", "admin"), companyId: "beta" }],
      ["companies/alpha/orders/order1", order()],
      ["companies/beta/orders/order1", order({ companyId: "beta" })],
      ["companies/alpha/products/cake1", { companyId: "alpha", price: 100, isAvailable: true }],
      ["companies/alpha/offers/offer1", { companyId: "alpha", usageCount: 0 }],
      ["companies/alpha/counters/orders", { companyId: "alpha", value: 1 }],
    ];
    await Promise.all(writes.map(([path, data]) => seed.doc(path).set(data)));
  });
});
after(async () => { await env?.cleanup(); });

test("unauthenticated, anonymous, missing claims and platform-role shortcuts are denied", async () => {
  const path = "companies/alpha/orders/order1";
  await assertFails(restDb(null).doc(path).get());
  await assertFails(db("cashier", { firebase: { sign_in_provider: "anonymous" } }).doc(path).get());
  await assertFails(db("cashier", { companyId: null, platformRole: "owner" }).doc(path).get());
  await assertFails(db("cashier", { employeeDocId: "admin", role: "admin" }).doc(path).get());
});
test("verified employee reads their company but cannot read another company", async () => {
  await assertSucceeds(db("cashier").doc("companies/alpha/orders/order1").get());
  await assertSucceeds(db("cashier").collection("companies/alpha/products").get());
  await assertFails(db("admin").doc("companies/beta/orders/order1").get());
  await assertFails(db("admin").collection("companies/beta/employees").get());
  await assertFails(db("admin").doc("companies/beta/settings/features").set({ companyId: "beta" }));
});
test("employee listing requires trusted credential-scrub readiness", async () => {
  await assertSucceeds(db("admin").collection("companies/alpha/employees").get());
  await withAdmin(async (ctx) => ctx.firestore().doc("companies/alpha").update({ authMigrationVersion: 0 }));
  await assertFails(db("admin").collection("companies/alpha/employees").get());
  await assertSucceeds(db("cashier").doc("companies/alpha/employees/cashier").get());
});
test("suspension or deletion revokes access without issuing new claims", async () => {
  const signed = db("cashier");
  await assertSucceeds(signed.doc("companies/alpha/orders/order1").get());
  await assertSucceeds(db("admin").doc("companies/alpha/employees/cashier").update({ status: "suspended" }));
  await assertFails(signed.doc("companies/alpha/orders/order1").get());
  await assertFails(db("suspended").doc("companies/alpha/orders/order1").get());
  await assertSucceeds(db("admin").doc("companies/alpha/employees/cashier").delete());
  await assertFails(signed.doc("companies/alpha/products/cake1").get());
});
test("cashier can create orders, cannot forge company, promote themselves or provision auth", async () => {
  const cashier = db("cashier");
  await assertSucceeds(cashier.doc("companies/alpha/orders/new").set(order({ orderNumber: 2 })));
  await assertFails(cashier.doc("companies/alpha/orders/foreign").set(order({ companyId: "beta" })));
  await assertFails(cashier.doc("companies/alpha/employees/cashier").update({ role: "admin" }));
  await assertFails(db("admin").doc("companies/alpha/employees/cashier").update({ authUid: "attacker" }));
  await assertFails(db("admin").doc("companies/alpha/employees/new").set(employee("new", "admin")));
  await assertFails(cashier.doc("companies/alpha/products/cake1").update({ price: 1 }));
});
test("company plan and subscription limits cannot be changed by a tenant administrator", async () => {
  await assertFails(db("admin").doc("companies/alpha").update({ plan: "enterprise", maxUsers: 999 }));
});
test("branch supervisor cannot assign protected roles or manage another branch", async () => {
  const branch = db("branch");
  await assertSucceeds(branch.doc("companies/alpha/employees/north-worker").update({ name: "Updated" }));
  await assertFails(branch.doc("companies/alpha/employees/north-worker").update({ role: "admin" }));
  await assertFails(branch.doc("companies/alpha/employees/south-worker").update({ name: "Not allowed" }));
  await assertFails(branch.doc("companies/alpha/employees/admin").delete());
});
test("department writes affect only their department, never totals or another department", async () => {
  const ref = db("cake").doc("companies/alpha/orders/order1");
  await assertSucceeds(ref.update({ "departmentStatuses.cake": "in_progress", updatedAt: "now" }));
  await assertFails(ref.update({ "departmentStatuses.halwa": "ready" }));
  await assertFails(ref.update({ total: 0 }));
  await assertFails(ref.delete());
  await assertSucceeds(db("packaging").doc("companies/alpha/orders/order1").update({ trayReturned: true, updatedAt: "now" }));
});
test("order identity is immutable, destructive operations are restricted", async () => {
  const ref = db("cashier").doc("companies/alpha/orders/order1");
  await assertFails(ref.update({ companyId: "beta" }));
  await assertFails(ref.update({ orderNumber: 99 }));
  await assertFails(ref.update({ deleted: true }));
  await assertFails(ref.delete());
  await assertSucceeds(db("admin").doc("companies/alpha/orders/order1").update({ deleted: true }));
});
test("guests cannot mutate operational data", async () => {
  await assertFails(db("guest").doc("companies/alpha/orders/new").set(order()));
  await assertFails(db("guest").doc("companies/alpha/orders/order1").update({ total: 0 }));
  await assertFails(db("guest").doc("companies/alpha/counters/orders").update({ value: 2 }));
});
test("sequential counters cannot be rolled back or jumped", async () => {
  const ref = db("cashier").doc("companies/alpha/counters/orders");
  await assertSucceeds(ref.update({ value: 2 }));
  await assertFails(ref.update({ value: 1 }));
  await assertFails(ref.update({ value: 100 }));
});
test("audit logs are attributed to authenticated UID and append-only", async () => {
  const ref = db("cashier").doc("companies/alpha/auditLogs/test");
  await assertSucceeds(ref.set({ companyId: "alpha", actorUid: "cashier", action: "user_login", createdAt: serverTimestamp() }));
  await assertFails(db("cashier").doc("companies/alpha/auditLogs/forged").set({ companyId: "alpha", actorUid: "admin", createdAt: serverTimestamp() }));
  const adminRef = db("admin").doc("companies/alpha/auditLogs/test");
  await assertSucceeds(adminRef.get());
  await assertFails(adminRef.update({ action: "changed" }));
  await assertFails(adminRef.delete());
});
test("legacy credentials cannot be read or written as employee profile fields", async () => {
  await withAdmin(async (ctx) => {
    await ctx.firestore().doc("companies/alpha/employees/legacy").set({ ...employee("legacy", "cashier"), passwordHash: "test-fixture-not-a-credential" });
  });
  await assertFails(db("admin").doc("companies/alpha/employees/legacy").get());
  await assertFails(db("admin").doc("companies/alpha/employees/cashier").update({ passwordHash: "test-fixture-not-a-credential" }));
});
test("unknown collections, legacy global data and sessions are denied by default", async () => {
  for (const path of ["orders/legacy", "companies/alpha/unknown/document", "companies/alpha/activeSessions/cashier"]) {
    await assertFails(db("admin").doc(path).set({ companyId: "alpha" }));
    await assertFails(db("admin").doc(path).get());
  }
});
test("storage restricts company, role, MIME type and suspensions", async () => {
  const adminStorage = context("admin").storage();
  const image = adminStorage.ref("product-images/alpha/security-test.png");
  await assertSucceeds(image.putString("test-image", "raw", { contentType: "image/png" }));
  await assertSucceeds(context("cashier").storage().ref(image.fullPath).getMetadata());
  await assertFails(context("beta-admin", { companyId: "beta", employeeDocId: "beta-admin" }).storage().ref(image.fullPath).getMetadata());
  await assertFails(context("suspended").storage().ref(image.fullPath).getMetadata());
  await assertFails(context("cashier").storage().ref("product-images/alpha/unauthorized.png").putString("test-image", "raw", { contentType: "image/png" }));
  await assertFails(adminStorage.ref("product-images/beta/foreign.png").putString("test-image", "raw", { contentType: "image/png" }));
  await assertFails(adminStorage.ref("product-images/alpha/script.html").putString("test-file", "raw", { contentType: "text/html" }));
  await assertFails(restStorage(null).ref(image.fullPath).getMetadata());
});
test("contract storage is private to the company's managers", async () => {
  const ref = context("admin").storage().ref("contracts/alpha/test.pdf");
  await assertSucceeds(ref.putString("test-pdf", "raw", { contentType: "application/pdf" }));
  await assertSucceeds(ref.getMetadata());
  await assertFails(context("cashier").storage().ref(ref.fullPath).getMetadata());
});
test("offline identity is bound to UID and expires; anonymous or incomplete identities are rejected", async () => {
  const source = await readFile(new URL("../../lib/tenantIdentity.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const { identityFromClaims, offlineIdentity, OFFLINE_SESSION_MAX_AGE_MS } = await import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
  const now = Date.now();
  const identity = identityFromClaims("uid", { companyId: "alpha", employeeDocId: "employee" }, false, now);
  assert.equal(offlineIdentity(JSON.stringify(identity), "uid", now + 1)?.companyId, "alpha");
  assert.equal(offlineIdentity(JSON.stringify(identity), "different-user", now + 1), null);
  assert.equal(offlineIdentity(JSON.stringify(identity), "uid", now + OFFLINE_SESSION_MAX_AGE_MS + 1), null);
  assert.equal(offlineIdentity(JSON.stringify({ ...identity, verifiedAt: now + 100 }), "uid", now), null);
  assert.equal(offlineIdentity("malformed", "uid"), null);
  assert.throws(() => identityFromClaims("uid", { companyId: "../beta", employeeDocId: "x" }, false));
  assert.throws(() => identityFromClaims("uid", { companyId: "alpha", employeeDocId: "employee" }, true));
  assert.throws(() => identityFromClaims("uid", { platformRole: "owner" }, false));
});
