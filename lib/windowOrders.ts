import { collection, doc, onSnapshot, orderBy, query, runTransaction, setDoc, where } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  dispatchPatch, editBlock, FactoryDept, DeptLineStatus, isLateDept, lateDeptPatch, lockedLineChanges, mergeDepts, normalizeCutoff,
  normalizeItems, orderStage, receiptDiff, SalesWindow, WindowOrder, WindowOrderItem, windowOrderId, WindowSettings,
} from "@/utils/windowOrders";

export class WindowOrderError extends Error {
  constructor(public code: "locked" | "locked_dept" | "locked_day" | "past_cutoff" | "changed" | "not_found" | "not_ready" | "not_dispatched" | "empty" | "already_dispatched" | "not_late") { super(code); }
}

const windowsCol = (companyId: string) => collection(db, "companies", companyId, "windows");
const ordersCol = (companyId: string) => collection(db, "companies", companyId, "windowOrders");
const orderRef = (companyId: string, id: string) => doc(db, "companies", companyId, "windowOrders", id);
const settingsRef = (companyId: string) => doc(db, "companies", companyId, "windowSettings", "main");
const now = () => new Date().toISOString();

export function subscribeWindowSettings(companyId: string, cb: (s: WindowSettings) => void, onError?: () => void) {
  return onSnapshot(settingsRef(companyId), (snap) => cb((snap.data() as WindowSettings | undefined) ?? {}), () => onError?.());
}

/** Managers: the evening cutoff for window orders (HH:mm, Riyadh). */
export async function saveWindowCutoff(companyId: string, cutoff: string) {
  await setDoc(settingsRef(companyId), { cutoff: normalizeCutoff(cutoff), updatedAt: now() }, { merge: true });
}

/** Managers: lock a day's window orders (numbers final for production) or unlock it. */
export async function setDayLock(companyId: string, date: string, locked: boolean, by: string) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(settingsRef(companyId));
    const cur = ((snap.data() as WindowSettings | undefined)?.locked ?? {});
    const next = { ...cur };
    if (locked) next[date] = { by, at: now() }; else delete next[date];
    tx.set(settingsRef(companyId), { locked: next, updatedAt: now() }, { merge: true });
  });
}

export function subscribeWindows(companyId: string, cb: (w: SalesWindow[]) => void, onError?: () => void) {
  return onSnapshot(query(windowsCol(companyId), orderBy("sort")), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SalesWindow, "id">) })));
  }, () => onError?.());
}

export async function saveWindow(companyId: string, w: SalesWindow) {
  await setDoc(doc(windowsCol(companyId), w.id), {
    name: w.name.trim().slice(0, 60), active: w.active, sort: w.sort ?? Date.now(), createdAt: w.createdAt ?? now(), updatedAt: now(),
  });
}

export function subscribeWindowOrders(companyId: string, date: string, cb: (o: WindowOrder[]) => void, onError?: () => void) {
  return onSnapshot(query(ordersCol(companyId), where("date", "==", date)), (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as WindowOrder), id: d.id })).sort((a, b) => a.windowName.localeCompare(b.windowName, "ar")));
  }, () => onError?.());
}

/**
 * Send or change a window's order for a day. Before dispatch the window may
 * top up: lines of departments that already started stay as they were, the
 * rest can change. Blocked after the cutoff or when the day is locked
 * (managers may override). `baseUpdatedAt` guards against two people editing
 * the same order at once.
 */
export async function sendWindowOrder(companyId: string, p: {
  window: SalesWindow; date: string; items: WindowOrderItem[]; note?: string; by: string; manager?: boolean; baseUpdatedAt?: string | null;
}) {
  const items = normalizeItems(p.items);
  if (!items.length) throw new WindowOrderError("empty");
  const id = windowOrderId(p.window.id, p.date);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef(companyId, id));
    const settingsSnap = await tx.get(settingsRef(companyId));
    const prev = snap.exists() ? (snap.data() as WindowOrder) : null;
    const settings = (settingsSnap.data() as WindowSettings | undefined) ?? {};
    const block = editBlock(prev, p.date, settings, { manager: p.manager });
    if (block === "dispatched") throw new WindowOrderError("locked");
    if (block) throw new WindowOrderError(block);
    if (p.baseUpdatedAt !== undefined && (prev?.updatedAt ?? null) !== p.baseUpdatedAt) throw new WindowOrderError("changed");
    if (lockedLineChanges(prev, items).length) throw new WindowOrderError("locked_dept");
    const data: Record<string, unknown> = {
      windowId: p.window.id, windowName: p.window.name, date: p.date, status: "sent", items, depts: mergeDepts(prev, items),
      createdBy: prev?.createdBy ?? p.by, sentAt: prev?.sentAt ?? now(), updatedAt: now(), companyId,
    };
    if (p.note?.trim()) data.note = p.note.trim().slice(0, 300);
    tx.set(orderRef(companyId, id), data);
  });
  return id;
}

/** A factory department moves its part of one window's order. */
export async function setDeptProgress(companyId: string, id: string, dept: FactoryDept, status: DeptLineStatus, by: string) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef(companyId, id));
    if (!snap.exists()) throw new WindowOrderError("not_found");
    const o = snap.data() as WindowOrder;
    // A department left behind by a partial dispatch may still move its own part.
    if (o.status !== "sent" && !isLateDept(o, dept)) throw new WindowOrderError("already_dispatched");
    tx.update(orderRef(companyId, id), { [`depts.${dept}`]: { status, by, at: now() }, updatedAt: now() });
  });
}

export async function dispatchWindowOrder(companyId: string, id: string, by: string, force = false) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef(companyId, id));
    if (!snap.exists()) throw new WindowOrderError("not_found");
    const o = { ...(snap.data() as WindowOrder), id };
    if (o.status !== "sent") throw new WindowOrderError("already_dispatched");
    if (!force && orderStage(o) !== "ready") throw new WindowOrderError("not_ready");
    // Record what actually leaves the factory: unready departments send 0 for now.
    const { items, lateDepts } = dispatchPatch(o);
    tx.update(orderRef(companyId, id), { status: "dispatched", items, lateDepts, dispatchedAt: now(), dispatchedBy: by, updatedAt: now() });
  });
}

/** A department that missed the main dispatch sends its lines now (before the window confirms receipt). */
export async function sendLateDeptPart(companyId: string, id: string, dept: FactoryDept, by: string) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef(companyId, id));
    if (!snap.exists()) throw new WindowOrderError("not_found");
    const o = { ...(snap.data() as WindowOrder), id };
    if (!isLateDept(o, dept)) throw new WindowOrderError("not_late");
    const { items, lateDepts } = lateDeptPatch(o, dept);
    tx.update(orderRef(companyId, id), { items, lateDepts, [`depts.${dept}`]: { status: "ready", by, at: now() }, updatedAt: now() });
  });
}

/** This window's orders that were dispatched and are still waiting for receipt — any day. */
export function subscribeAwaitingReceipt(companyId: string, windowId: string, cb: (o: WindowOrder[]) => void, onError?: () => void) {
  return onSnapshot(query(ordersCol(companyId), where("windowId", "==", windowId), where("status", "==", "dispatched")), (snap) => {
    cb(snap.docs.map((d) => ({ ...(d.data() as WindowOrder), id: d.id })).sort((a, b) => a.date.localeCompare(b.date)));
  }, () => onError?.());
}

export async function receiveWindowOrder(companyId: string, id: string, received: Record<string, number>, by: string, note?: string) {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(orderRef(companyId, id));
    if (!snap.exists()) throw new WindowOrderError("not_found");
    const o = snap.data() as WindowOrder;
    if (o.status !== "dispatched") throw new WindowOrderError("not_dispatched");
    const r = receiptDiff(o.items, received);
    const data: Record<string, unknown> = {
      status: "received", items: r.lines.map(({ diff: _d, ...l }) => l), shortageCount: r.shortageCount,
      receivedAt: now(), receivedBy: by, updatedAt: now(),
    };
    if (note?.trim()) data.receiveNote = note.trim().slice(0, 300);
    tx.update(orderRef(companyId, id), data);
  });
}

export async function getWindowOrder(companyId: string, windowId: string, date: string): Promise<WindowOrder | null> {
  const { getDoc } = await import("firebase/firestore");
  const snap = await getDoc(orderRef(companyId, windowOrderId(windowId, date)));
  return snap.exists() ? ({ ...(snap.data() as WindowOrder), id: snap.id }) : null;
}
