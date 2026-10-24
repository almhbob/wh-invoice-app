// End-to-end data flows against the Firestore emulator with the real Web SDK and the
// production rules: every role's daily writes, exactly as the app sends them.
// Run via: firebase emulators:exec --only firestore "node flows.test.mjs"
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, collection, arrayUnion, runTransaction } from "firebase/firestore";
import { deepClean, normalizeEvents } from "./deepClean.mjs";

const C = "laviviane-trial";
const env = await initializeTestEnvironment({
  projectId: "flows-test",
  firestore: { rules: readFileSync("firestore.rules", "utf8") },
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, `companies/${C}`), { name: "Laviviane" });
  await setDoc(doc(db, `companies/${C}/employees/e1`), { name: "Admin", role: "admin", employeeId: "A1" });
  await setDoc(doc(db, `companies/${C}/employees/e3`), { name: "Sup", role: "branch_supervisor", employeeId: "S1" });
  // An order damaged by the old client (events stored as a map).
  await setDoc(doc(db, `companies/${C}/orders/damaged`), {
    companyId: C, orderNumber: 7, items: [], departmentStatuses: { cake: "pending" },
    events: { _methodName: "arrayUnion", Ac: [{ type: "created", at: "2026-10-20T10:00:00.000Z" }] },
  });
});

const as = (uid, claims) => env.authenticatedContext(uid, { ...claims, companyId: C, firebase: { sign_in_provider: "custom" } }).firestore();
const admin = as("u1", { role: "admin", eid: "e1" });
const sup = as("u3", { role: "branch_supervisor", eid: "e3" });
const cashier = as("u2", { role: "cashier", eid: "e2" });
const dept = Object.fromEntries(["halwa", "mawali", "chocolate", "cake", "packaging"].map((d, i) => [d, as("d" + i, { role: d, eid: "d" + i })]));
const calligrapher = as("w1", { role: "calligrapher", eid: "w1" });
const driver = as("r1", { role: "driver", eid: "r1" });

let n = 0;
const t = async (name, fn) => { await fn(); n++; console.log("✓", name); };
const now = () => new Date().toISOString();
const ord = (db, id) => doc(db, `companies/${C}/orders/${id}`);
const ev = (type, extra = {}) => ({ type, at: now(), ...extra });
const read = async (id) => {
  let data;
  await env.withSecurityRulesDisabled(async (ctx) => { data = (await getDoc(ord(ctx.firestore(), id))).data(); });
  return data;
};
// Same shape the app sends from patchOrder (deepClean over the whole payload).
const patch = (db, id, fields) => updateDoc(ord(db, id), deepClean({ ...fields, companyId: C, updatedAt: now() }));

await t("admin adds an employee (no PIN in the document)", async () => {
  const ref = await assertSucceeds(addDoc(collection(admin, `companies/${C}/employees`), deepClean({
    name: "منى", employeeId: "K1", username: "k1", role: "cake", status: "active", companyId: C,
    permissions: ["dept:cake"], createdAt: now(), createdBy: "A1", lastLoginAt: undefined, phone: undefined,
  })));
  assert.ok(ref.id);
});
await t("a plaintext PIN in a new employee document is refused", async () => {
  await assertFails(addDoc(collection(admin, `companies/${C}/employees`), { name: "x", employeeId: "X1", role: "cake", pinCode: "5831" }));
});
await t("branch supervisor adds staff but not managers", async () => {
  await assertSucceeds(addDoc(collection(sup, `companies/${C}/employees`), { name: "سائق", employeeId: "R1", role: "driver", phone: "0500000000", createdAt: now() }));
  await assertSucceeds(addDoc(collection(sup, `companies/${C}/employees`), { name: "خطاط", employeeId: "W1", role: "calligrapher", createdAt: now() }));
  await assertFails(addDoc(collection(sup, `companies/${C}/employees`), { name: "x", employeeId: "X2", role: "admin" }));
});
await t("cashier cannot add employees", async () => {
  await assertFails(addDoc(collection(cashier, `companies/${C}/employees`), { name: "x", employeeId: "X3", role: "cake" }));
});

await t("cashier claims an order number and creates an order", async () => {
  const counter = doc(cashier, `companies/${C}/counters/orders`);
  const num = await runTransaction(cashier, async (tx) => {
    const s = await tx.get(counter);
    const next = (s.exists() ? s.data().value : 0) + 1;
    tx.set(counter, { value: next }, { merge: true });
    return next;
  });
  assert.equal(num, 1);
  await assertSucceeds(setDoc(ord(cashier, "o1"), deepClean({
    id: "o1", companyId: C, orderNumber: num, customerName: "عميل تجريبي", orderType: "delivery",
    items: [
      { id: "a", name: "كيك", quantity: 1, price: 100, department: "cake", writing: { text: "مبروك", surface: "cream", color: undefined } },
      { id: "b", name: "معمول", quantity: 2, price: undefined, department: "halwa" },
    ],
    departmentStatuses: { cake: "pending", halwa: "pending", packaging: "pending" },
    departmentReceivers: {}, writingStatus: "pending", trackingCode: "trk123",
    events: [ev("created")], createdAt: now(), updatedAt: now(),
  })));
});

for (const d of ["cake", "halwa"]) {
  await t(`${d} employee starts then finishes their stage`, async () => {
    const receiver = { name: "موظف " + d, employeeId: d.toUpperCase() + "1", timestamp: now() };
    await assertSucceeds(patch(dept[d], "o1", {
      [`departmentStatuses.${d}`]: "in_progress",
      departmentReceivers: { [d]: receiver },
      events: arrayUnion(...deepClean([ev("dept_started", { dept: d, by: { name: receiver.name, employeeId: receiver.employeeId } })])),
    }));
    await assertSucceeds(patch(dept[d], "o1", {
      [`departmentStatuses.${d}`]: "done",
      events: arrayUnion(...deepClean([ev("dept_done", { dept: d, by: undefined })])),
    }));
  });
}

await t("calligrapher updates the writing status", async () => {
  await assertSucceeds(patch(calligrapher, "o1", { writingStatus: "done", writingBy: { name: "خطاط", employeeId: "W1" }, events: arrayUnion(deepClean(ev("writing_done"))) }));
});
await t("packaging completes, cashier assigns a driver", async () => {
  await assertSucceeds(patch(dept.packaging, "o1", { "departmentStatuses.packaging": "done", events: arrayUnion(deepClean(ev("dept_done", { dept: "packaging" }))) }));
  await assertSucceeds(patch(cashier, "o1", { deliveryStatus: "assigned", deliveryDriver: { name: "سائق", employeeId: "R1", phone: "0500000000", assignedAt: now() }, events: arrayUnion(deepClean(ev("driver_assigned"))) }));
});
await t("driver raises a transfer request, dispatches and delivers", async () => {
  await assertSucceeds(patch(driver, "o1", { driverRequest: { type: "transfer", reason: "بعد المسافة", note: undefined, at: now(), status: "open" }, events: arrayUnion(deepClean(ev("driver_request"))) }));
  await assertSucceeds(patch(driver, "o1", { deliveryStatus: "out_for_delivery", dispatchedAt: now(), deliveryFailedReason: null, events: arrayUnion(deepClean(ev("dispatched"))) }));
  await assertSucceeds(patch(driver, "o1", { deliveryStatus: "delivered", deliveryDeliveredAt: now(), deliveredTo: null, events: arrayUnion(deepClean(ev("delivered"))) }));
});

await t("the order timeline is a real array with every step", async () => {
  const o = await read("o1");
  assert.ok(Array.isArray(o.events), "events must be stored as an array");
  assert.deepEqual(o.events.map((e) => e.type), ["created", "dept_started", "dept_done", "dept_started", "dept_done", "writing_done", "dept_done", "driver_assigned", "driver_request", "dispatched", "delivered"]);
  assert.equal(o.departmentStatuses.cake, "done");
  assert.equal(o.departmentReceivers.cake.employeeId, "CAKE1");
  assert.ok(!("price" in o.items[1]), "undefined fields are stripped");
});

await t("a damaged timeline is read safely and rewritten whole", async () => {
  const before = await read("damaged");
  const events = normalizeEvents(before.events);
  assert.equal(events.length, 1);
  const next = [...events, ev("dept_started", { dept: "cake" })];
  await assertSucceeds(patch(dept.cake, "damaged", { "departmentStatuses.cake": "in_progress", events: next }));
  const after = await read("damaged");
  assert.ok(Array.isArray(after.events));
  assert.equal(after.events.length, 2);
});

await t("staff cannot touch another company or employee secrets", async () => {
  await assertFails(setDoc(doc(dept.cake, `companies/other/orders/x`), { a: 1 }));
  await assertFails(getDoc(doc(admin, `companies/${C}/employeeSecrets/e1`)));
  await assertFails(deleteDoc(doc(dept.cake, `companies/${C}/employees/e1`)));
});

await env.cleanup();
console.log(`\n${n} flow checks passed`);
