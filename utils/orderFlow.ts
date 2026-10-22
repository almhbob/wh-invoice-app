import { Linking, Platform } from "react-native";

import { Colors } from "@/constants/colors";
import type { Department, Order, OrderItem, WritingSurface } from "@/context/OrdersContext";

/**
 * Order lifecycle — one source of truth for every screen.
 *
 *  received ─► in_production ─► ready ─► out_for_delivery ─► delivered
 *                                   └──────────────► picked_up (pickup orders)
 *  Side exits: delivery_failed (back to ready), cancelled.
 */

export type OrderStage =
  | "received"
  | "in_production"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "picked_up"
  | "delivery_failed"
  | "cancelled";

export type OrderEventType =
  | "created"
  | "dept_started"
  | "dept_done"
  | "online_received"
  | "support_requested"
  | "transfer_requested"
  | "request_resolved"
  | "writing_started"
  | "writing_done"
  | "ready"
  | "driver_assigned"
  | "dispatched"
  | "delivered"
  | "picked_up"
  | "delivery_failed"
  | "cancelled";

export interface OrderEvent {
  type: OrderEventType;
  at: string;
  by?: { name: string; employeeId: string };
  dept?: Department;
  note?: string;
}

export const DEPT_ORDER: Department[] = ["cake", "halwa", "chocolate", "mawali", "packaging"];

export const DEPT_COLOR: Record<Department, string> = {
  halwa: Colors.halwa,
  mawali: Colors.mawali,
  chocolate: Colors.chocolate,
  cake: Colors.cake,
  packaging: Colors.packaging,
};

export const DEPT_ICON: Record<Department, string> = {
  halwa: "coffee",
  mawali: "package",
  chocolate: "gift",
  cake: "layers",
  packaging: "box",
};

/** Departments that must finish before the order is ready (item departments + packaging if tracked). */
export function orderDepartments(order: Order): Department[] {
  const set = new Set<Department>(order.items.map((i) => i.department));
  Object.entries(order.departmentStatuses ?? {}).forEach(([d, s]) => {
    if (s && s !== "cancelled") set.add(d as Department);
  });
  return DEPT_ORDER.filter((d) => set.has(d));
}

export function writingItems(order: Order): OrderItem[] {
  return order.items.filter((i) => i.writing?.text?.trim());
}

export function hasWriting(order: Order) {
  return writingItems(order).length > 0;
}

export function productionProgress(order: Order) {
  const depts = orderDepartments(order);
  const writing = hasWriting(order);
  const ws = order.writingStatus ?? "pending";
  const done = depts.filter((d) => order.departmentStatuses?.[d] === "done").length + (writing && ws === "done" ? 1 : 0);
  const started = depts.filter((d) => order.departmentStatuses?.[d] === "in_progress").length + (writing && ws === "in_progress" ? 1 : 0);
  const total = depts.length + (writing ? 1 : 0);
  return { depts, done, started, total, ratio: total ? done / total : 0 };
}

export const WRITING_SURFACES: { key: WritingSurface; ar: string; en: string; icon: string }[] = [
  { key: "cream",          ar: "كريمة مباشرة",   en: "Cream (direct)",    icon: "edit-3" },
  { key: "jelly",          ar: "جلي",            en: "Jelly",             icon: "droplet" },
  { key: "jelly_on_sugar", ar: "جلي على سكر",    en: "Jelly on sugar",    icon: "layers" },
  { key: "sugar_print",    ar: "طباعة على سكر",  en: "Sugar print",       icon: "printer" },
  { key: "card",           ar: "كرت",            en: "Card",              icon: "credit-card" },
  { key: "other",          ar: "أخرى",           en: "Other",             icon: "more-horizontal" },
];

export function surfaceLabel(item: OrderItem, lang: string) {
  const w = item.writing;
  if (!w) return "";
  if (w.surface === "other" && w.surfaceOther?.trim()) return w.surfaceOther.trim();
  const m = WRITING_SURFACES.find((s) => s.key === w.surface);
  return m ? (lang === "ar" ? m.ar : m.en) : w.surface;
}

export function isProductionDone(order: Order) {
  const { total, done } = productionProgress(order);
  return total > 0 && done === total;
}

export function orderStage(order: Order): OrderStage {
  if (order.deleted) return "cancelled";
  const ds = order.deliveryStatus;
  if (order.orderType === "delivery") {
    if (ds === "delivered") return "delivered";
    if (ds === "out_for_delivery") return "out_for_delivery";
    if (ds === "failed") return "delivery_failed";
  } else if (order.pickedUpAt) {
    return "picked_up";
  }
  const p = productionProgress(order);
  if (p.total > 0 && p.done === p.total) return "ready";
  if (p.done > 0 || p.started > 0) return "in_production";
  return "received";
}

export function isOrderOpen(order: Order) {
  const s = orderStage(order);
  return s !== "delivered" && s !== "picked_up" && s !== "cancelled";
}

export const STAGE_META: Record<OrderStage, { ar: string; en: string; color: string; icon: string }> = {
  received:         { ar: "تم الاستلام",     en: "Received",         color: Colors.textSecondary,    icon: "inbox" },
  in_production:    { ar: "قيد التحضير",     en: "In production",    color: Colors.statusInProgress, icon: "loader" },
  ready:            { ar: "جاهز",            en: "Ready",            color: Colors.statusDone,       icon: "check-circle" },
  out_for_delivery: { ar: "مع السائق",       en: "Out for delivery", color: Colors.gold,             icon: "truck" },
  delivered:        { ar: "تم التسليم",      en: "Delivered",        color: Colors.statusDone,       icon: "home" },
  picked_up:        { ar: "استلمه العميل",   en: "Picked up",        color: Colors.statusDone,       icon: "shopping-bag" },
  delivery_failed:  { ar: "تعذّر التسليم",   en: "Delivery failed",  color: Colors.statusCancelled,  icon: "alert-triangle" },
  cancelled:        { ar: "ملغي",            en: "Cancelled",        color: Colors.statusCancelled,  icon: "x-circle" },
};

export const EVENT_META: Record<OrderEventType, { ar: string; en: string; icon: string }> = {
  created:          { ar: "استُلم الطلب وأُرسل للأقسام", en: "Order received", icon: "file-plus" },
  dept_started:     { ar: "بدأ التحضير",                 en: "Preparation started", icon: "play" },
  dept_done:        { ar: "انتهى التحضير",               en: "Preparation done", icon: "check" },
  online_received:    { ar: "وصل الطلب من الرابط الأونلاين", en: "Online order received", icon: "globe" },
  support_requested:  { ar: "طلب السائق الدعم",          en: "Driver asked for support", icon: "life-buoy" },
  transfer_requested: { ar: "طلب السائق تحويل الطلب",    en: "Driver asked to transfer", icon: "repeat" },
  request_resolved:   { ar: "تمت معالجة طلب السائق",     en: "Driver request resolved", icon: "check-square" },
  writing_started:  { ar: "بدأ الخطاط الكتابة",          en: "Writing started", icon: "edit-3" },
  writing_done:     { ar: "انتهت الكتابة",               en: "Writing done", icon: "check-square" },
  ready:            { ar: "الطلب جاهز بالكامل",          en: "Order ready", icon: "check-circle" },
  driver_assigned:  { ar: "تم تعيين السائق",             en: "Driver assigned", icon: "user-check" },
  dispatched:       { ar: "خرج للتوصيل",                 en: "Out for delivery", icon: "truck" },
  delivered:        { ar: "تم التسليم للعميل",           en: "Delivered", icon: "home" },
  picked_up:        { ar: "استلمه العميل من الفرع",      en: "Picked up", icon: "shopping-bag" },
  delivery_failed:  { ar: "تعذّر التسليم",               en: "Delivery failed", icon: "alert-triangle" },
  cancelled:        { ar: "أُلغي الطلب",                 en: "Cancelled", icon: "x-circle" },
};

/** Steps shown in the progress tracker for this order type. */
export function trackerSteps(order: Order): OrderStage[] {
  return order.orderType === "delivery"
    ? ["received", "in_production", "ready", "out_for_delivery", "delivered"]
    : ["received", "in_production", "ready", "picked_up"];
}

export function stepIndex(order: Order) {
  const steps = trackerSteps(order);
  const s = orderStage(order);
  if (s === "delivery_failed") return steps.indexOf("ready");
  return Math.max(0, steps.indexOf(s));
}

/** Timeline events, falling back to a reconstruction for orders created before events existed. */
export function orderTimeline(order: Order): OrderEvent[] {
  if (order.events?.length) return [...order.events].sort((a, b) => a.at.localeCompare(b.at));
  const out: OrderEvent[] = [{ type: "created", at: order.createdAt, by: order.cashierEmployee }];
  Object.entries(order.departmentReceivers ?? {}).forEach(([d, r]) => {
    if (r?.timestamp) out.push({ type: "dept_started", at: r.timestamp, dept: d as Department, by: r });
  });
  if (order.deliveryDriver?.assignedAt) out.push({ type: "driver_assigned", at: order.deliveryDriver.assignedAt, note: order.deliveryDriver.name });
  if (order.deliveryDeliveredAt) out.push({ type: "delivered", at: order.deliveryDeliveredAt });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

// ── Due time ───────────────────────────────────────────────────────────────────

export function parseDue(dt?: string): Date | null {
  if (!dt) return null;
  const full = dt.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (full) return new Date(`${full[1]}T${full[2]}:00`);
  const dateOnly = dt.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return new Date(`${dateOnly[1]}T23:59:00`);
  const timeOnly = dt.match(/^(\d{2}:\d{2})$/);
  if (timeOnly) {
    const d = new Date();
    const [h, m] = timeOnly[1].split(":").map(Number);
    d.setHours(h, m, 0, 0);
    return d;
  }
  return null;
}

export type Urgency = "overdue" | "urgent" | "soon" | "ok" | "none";

export function dueUrgency(order: Order): Urgency {
  if (!isOrderOpen(order)) return "none";
  const due = parseDue(order.deliveryTime);
  if (!due) return "none";
  const diff = due.getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 60 * 60 * 1000) return "urgent";
  if (diff < 3 * 60 * 60 * 1000) return "soon";
  return "ok";
}

export const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: Colors.statusCancelled,
  urgent: Colors.warning,
  soon: Colors.info,
  ok: Colors.textSecondary,
  none: Colors.textMuted,
};

export function dueLabel(order: Order, lang: string): string | null {
  const due = parseDue(order.deliveryTime);
  if (!due) return null;
  const ar = lang === "ar";
  const diffMin = Math.round((due.getTime() - Date.now()) / 60000);
  const abs = Math.abs(diffMin);
  const span = abs < 60 ? `${abs} ${ar ? "د" : "min"}` : abs < 48 * 60 ? `${Math.round(abs / 60)} ${ar ? "س" : "h"}` : `${Math.round(abs / 1440)} ${ar ? "يوم" : "d"}`;
  if (!isOrderOpen(order)) return null;
  if (diffMin < 0) return ar ? `متأخر ${span}` : `${span} late`;
  return ar ? `بعد ${span}` : `in ${span}`;
}

/** Sort: overdue/soonest due first, then newest. */
export function byDueThenNewest(a: Order, b: Order) {
  const da = parseDue(a.deliveryTime)?.getTime() ?? Number.POSITIVE_INFINITY;
  const db = parseDue(b.deliveryTime)?.getTime() ?? Number.POSITIVE_INFINITY;
  if (da !== db) return da - db;
  return b.createdAt.localeCompare(a.createdAt);
}

// ── Tracking link & messaging ──────────────────────────────────────────────────

export function newTrackingCode() {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  const bytes = new Uint8Array(10);
  (globalThis.crypto ?? { getRandomValues: (a: Uint8Array) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function appOrigin() {
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return process.env.EXPO_PUBLIC_API_BASE || "https://fotra-dv1.pages.dev";
}

export function trackingUrl(order: Order) {
  if (!order.trackingCode || !order.companyId) return null;
  return `${appOrigin()}/track?c=${encodeURIComponent(order.companyId)}&t=${order.trackingCode}`;
}

export function intlPhone(phone: string) {
  const raw = phone.replace(/\D/g, "");
  if (raw.startsWith("00")) return raw.slice(2);
  if (raw.startsWith("05")) return `966${raw.slice(1)}`;
  if (raw.startsWith("5") && raw.length === 9) return `966${raw}`;
  return raw;
}

export function openWhatsApp(phone: string, message: string) {
  const to = intlPhone(phone);
  const url = `https://wa.me/${to}?text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => undefined);
}

export function callPhone(phone: string) {
  Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`).catch(() => undefined);
}

export function openMaps(address: string) {
  Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(address)}`).catch(() => undefined);
}

export function customerTrackingMessage(order: Order, brand: string) {
  const link = trackingUrl(order);
  const lines = [
    `مرحباً ${order.customerName} 🌸`,
    `شكراً لطلبك من ${brand}. رقم طلبك: #${order.orderNumber}`,
    order.deliveryTime ? `موعد ${order.orderType === "delivery" ? "التوصيل" : "الاستلام"}: ${order.deliveryTime}` : "",
    link ? `تابع حالة طلبك لحظة بلحظة:\n${link}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function driverDispatchMessage(order: Order, brand: string) {
  const items = order.items.map((i) => `• ${i.name} × ${i.quantity}`).join("\n");
  const remaining = Math.max(0, (order.totalAmount ?? 0) - (order.amountPaid ?? order.totalAmount ?? 0));
  const lines = [
    `🚚 طلب توصيل #${order.orderNumber} — ${brand}`,
    `العميل: ${order.customerName}`,
    `الجوال: ${order.customerPhone}${order.customerPhone2 ? ` / ${order.customerPhone2}` : ""}`,
    order.deliveryAddress ? `العنوان: ${order.deliveryAddress}` : "",
    order.deliveryAddress ? `الخريطة: https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress)}` : "",
    order.deliveryTime ? `الموعد: ${order.deliveryTime}` : "",
    "",
    "الأصناف:",
    items,
    remaining > 0 ? `\n💰 المتبقي للتحصيل: ${remaining.toFixed(2)} ر.س` : "\n✅ مدفوع بالكامل",
    order.insuranceAmount ? `🧾 تأمين صواني: ${order.insuranceAmount} ر.س` : "",
    order.notes ? `📝 ملاحظات: ${order.notes}` : "",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export function remainingAmount(order: Order) {
  if (!order.totalAmount) return 0;
  return Math.max(0, order.totalAmount - (order.amountPaid ?? order.totalAmount));
}

// ── Driver requests ────────────────────────────────────────────────────────────

export const SUPPORT_REASONS = [
  "العميل لا يرد",
  "العنوان غير واضح",
  "العميل غير موجود بالموقع",
  "مشكلة في التحصيل",
  "الطلب ناقص أو تالف",
  "عطل في المركبة",
  "أخرى",
];

export const TRANSFER_REASONS = [
  "ضغط طلبات",
  "بعد المسافة",
  "عطل في المركبة",
  "ظرف طارئ",
  "انتهاء الدوام",
  "أخرى",
];

export function hasOpenDriverRequest(order: Order) {
  return order.driverRequest?.status === "open";
}

/** Counts of deliveries assigned to a driver: today, this month, this year (+ delivered). */
export function driverStats(orders: Order[], driverId: string, now = new Date()) {
  const mine = orders.filter((o) => o.deliveryDriver?.employeeId === driverId && !o.deleted);
  const when = (o: Order) => new Date(o.deliveryDriver?.assignedAt ?? o.createdAt);
  const sameDay = (d: Date) => d.toDateString() === now.toDateString();
  const sameMonth = (d: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  const sameYear = (d: Date) => d.getFullYear() === now.getFullYear();
  const pack = (pred: (d: Date) => boolean) => {
    const list = mine.filter((o) => pred(when(o)));
    return { assigned: list.length, delivered: list.filter((o) => o.deliveryStatus === "delivered").length };
  };
  return {
    today: pack(sameDay),
    month: pack(sameMonth),
    year: pack(sameYear),
    open: mine.filter((o) => o.deliveryStatus !== "delivered").length,
  };
}
