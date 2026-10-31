/**
 * Sales windows (branches) and their daily order from the factory.
 *
 * Each window sends one order per day. Every factory department prepares its own
 * lines (cake, halwa, …) and marks them ready; when all departments are ready the
 * order is dispatched to the window, which confirms what it actually received.
 * Pure TS — shared by the app and tests.
 */

export type FactoryDept = "cake" | "halwa" | "mawali" | "chocolate" | "packaging";
export const FACTORY_DEPTS: FactoryDept[] = ["cake", "halwa", "mawali", "chocolate", "packaging"];

export interface SalesWindow {
  id: string;
  name: string;
  active: boolean;
  sort?: number;
  createdAt?: string;
}

export type DeptLineStatus = "pending" | "preparing" | "ready";

export interface WindowOrderItem {
  productId: string;
  name: string;
  department: FactoryDept;
  qty: number;
  receivedQty?: number;
}

export interface DeptProgress {
  status: DeptLineStatus;
  by?: string;
  at?: string;
}

export interface WindowOrder {
  id: string;
  windowId: string;
  windowName: string;
  /** Business day the goods are for, YYYY-MM-DD (Riyadh). */
  date: string;
  status: "sent" | "dispatched" | "received";
  items: WindowOrderItem[];
  depts: Partial<Record<FactoryDept, DeptProgress>>;
  note?: string;
  createdBy?: string;
  sentAt?: string;
  updatedAt?: string;
  dispatchedAt?: string;
  dispatchedBy?: string;
  receivedAt?: string;
  receivedBy?: string;
  receiveNote?: string;
  shortageCount?: number;
}

/** What the window and the factory see. */
export type WindowOrderStage = "sent" | "preparing" | "ready" | "dispatched" | "received" | "received_short";

export const STAGE_ORDER: WindowOrderStage[] = ["sent", "preparing", "ready", "dispatched", "received"];

export function isFactoryDept(d: unknown): d is FactoryDept {
  return FACTORY_DEPTS.includes(d as FactoryDept);
}

/** YYYY-MM-DD in Riyadh time (UTC+3, no DST). */
export function riyadhDate(at: Date = new Date(), addDays = 0): string {
  const t = at.getTime() + 3 * 3600_000 + addDays * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function windowOrderId(windowId: string, date: string) {
  return `${windowId}_${date}`;
}

export function slugWindowId(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = "w" + Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36).slice(0, 6);
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}${i}`;
  return id;
}

export function deptsOf(items: WindowOrderItem[]): FactoryDept[] {
  return FACTORY_DEPTS.filter((d) => items.some((i) => i.department === d && i.qty > 0));
}

export function initialDepts(items: WindowOrderItem[]): Partial<Record<FactoryDept, DeptProgress>> {
  return Object.fromEntries(deptsOf(items).map((d) => [d, { status: "pending" as const }]));
}

export function deptStatus(o: WindowOrder, d: FactoryDept): DeptLineStatus {
  return o.depts?.[d]?.status ?? "pending";
}

export function orderStage(o: WindowOrder): WindowOrderStage {
  if (o.status === "received") return (o.shortageCount ?? 0) > 0 ? "received_short" : "received";
  if (o.status === "dispatched") return "dispatched";
  const ds = deptsOf(o.items);
  if (ds.length && ds.every((d) => deptStatus(o, d) === "ready")) return "ready";
  if (ds.some((d) => deptStatus(o, d) !== "pending")) return "preparing";
  return "sent";
}

/** The window can still change its order while no department has started on it. */
export function canEditOrder(o: WindowOrder | null | undefined): boolean {
  if (!o) return true;
  return o.status === "sent" && deptsOf(o.items).every((d) => deptStatus(o, d) === "pending");
}

export function readyDeptCount(o: WindowOrder) {
  const ds = deptsOf(o.items);
  return { ready: ds.filter((d) => deptStatus(o, d) === "ready").length, total: ds.length };
}

/** Clean lines: positive whole quantities, one line per product, known departments. */
export function normalizeItems(items: WindowOrderItem[]): WindowOrderItem[] {
  const byId = new Map<string, WindowOrderItem>();
  for (const it of items) {
    const qty = Math.floor(Number(it.qty));
    if (!it.productId || !(qty > 0) || !isFactoryDept(it.department)) continue;
    const prev = byId.get(it.productId);
    byId.set(it.productId, { productId: it.productId, name: String(it.name ?? "").slice(0, 120), department: it.department, qty: Math.min(9999, (prev?.qty ?? 0) + qty) });
  }
  return [...byId.values()].sort((a, b) => FACTORY_DEPTS.indexOf(a.department) - FACTORY_DEPTS.indexOf(b.department) || a.name.localeCompare(b.name, "ar"));
}

export interface DeptProductTotal {
  productId: string;
  name: string;
  total: number;
  perWindow: { windowId: string; windowName: string; qty: number }[];
}

/** Everything one department must make for the day, summed across windows. */
export function deptTotals(orders: WindowOrder[], dept: FactoryDept): DeptProductTotal[] {
  const map = new Map<string, DeptProductTotal>();
  for (const o of orders) {
    for (const it of o.items) {
      if (it.department !== dept || it.qty <= 0) continue;
      const row = map.get(it.productId) ?? { productId: it.productId, name: it.name, total: 0, perWindow: [] };
      row.total += it.qty;
      row.perWindow.push({ windowId: o.windowId, windowName: o.windowName, qty: it.qty });
      map.set(it.productId, row);
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ar"));
}

/** Lines received short (or over) once the window confirms. */
export function receiptDiff(items: WindowOrderItem[], received: Record<string, number>) {
  const lines = items.map((it) => {
    const got = Math.max(0, Math.floor(Number(received[it.productId] ?? it.qty)));
    return { ...it, receivedQty: got, diff: got - it.qty };
  });
  return { lines, shortageCount: lines.filter((l) => l.diff < 0).length, shortQty: lines.reduce((s, l) => s + Math.max(0, -l.diff), 0) };
}
