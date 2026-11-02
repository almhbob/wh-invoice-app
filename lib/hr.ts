import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where, writeBatch } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { computeNet, HrWorker, newPayrollLine, PayrollLine, toMoney } from "@/utils/hr";

const workersCol = (c: string) => collection(db, "companies", c, "hrWorkers");
const payrollCol = (c: string) => collection(db, "companies", c, "payroll");
const now = () => new Date().toISOString();

function clean<T extends Record<string, unknown>>(o: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== "") out[k] = typeof v === "string" ? v.trim() : v;
  return out as T;
}

export function subscribeWorkers(companyId: string, cb: (w: HrWorker[]) => void, onError?: () => void) {
  return onSnapshot(workersCol(companyId), (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as HrWorker), id: d.id })).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "ar")));
  }, () => onError?.());
}

export async function saveWorker(companyId: string, w: HrWorker) {
  const { id, ...rest } = w;
  const data = clean({
    ...rest,
    basicSalary: toMoney(rest.basicSalary), housing: toMoney(rest.housing), transport: toMoney(rest.transport), otherAllowance: toMoney(rest.otherAllowance),
    createdAt: rest.createdAt ?? now(), updatedAt: now(),
  } as Record<string, unknown>);
  await setDoc(id ? doc(workersCol(companyId), id) : doc(workersCol(companyId)), data);
}

export async function deleteWorker(companyId: string, id: string) {
  await deleteDoc(doc(workersCol(companyId), id));
}

export function subscribePayroll(companyId: string, month: string, cb: (l: PayrollLine[]) => void, onError?: () => void) {
  return onSnapshot(query(payrollCol(companyId), where("month", "==", month)), (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as PayrollLine), id: d.id })).sort((a, b) => a.name.localeCompare(b.name, "ar")));
  }, () => onError?.());
}

/** Adds a line for every active worker who doesn't have one this month. */
export async function generatePayroll(companyId: string, month: string, workers: HrWorker[], existing: PayrollLine[]) {
  const have = new Set(existing.map((l) => l.workerId));
  const batch = writeBatch(db);
  let n = 0;
  for (const w of workers) {
    if (!w.active || have.has(w.id)) continue;
    const line = newPayrollLine(w, month);
    const { id, ...data } = line;
    batch.set(doc(payrollCol(companyId), id), { ...data, updatedAt: now() });
    n++;
  }
  if (n) await batch.commit();
  return n;
}

export async function savePayrollLine(companyId: string, l: PayrollLine) {
  const { id, ...rest } = l;
  const data = clean({
    ...rest,
    basic: toMoney(rest.basic), allowances: toMoney(rest.allowances), additions: toMoney(rest.additions),
    deductions: toMoney(rest.deductions), advance: toMoney(rest.advance), net: computeNet(rest), updatedAt: now(),
  } as Record<string, unknown>);
  await setDoc(doc(payrollCol(companyId), id), data);
}

export async function deletePayrollLine(companyId: string, id: string) {
  await deleteDoc(doc(payrollCol(companyId), id));
}
