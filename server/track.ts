import { Firestore, isValidCompanyId, json, readServiceAccount, type AuthEnv } from "./auth/core";
import { loyaltyKey, normalizeLoyalty, pointsValue, tierFor } from "../constants/loyalty";

/**
 * Public order tracking: GET /api/track?c=<companyId>&t=<trackingCode>
 * Returns only what a customer needs to follow their order — no prices, phones or addresses.
 */

type Rec = Record<string, unknown>;
const DEPTS = ["cake", "halwa", "chocolate", "mawali", "packaging"];

export function publicStage(o: Rec): string {
  if (o.deleted) return "cancelled";
  const type = o.orderType === "delivery" ? "delivery" : "pickup";
  const ds = o.deliveryStatus;
  if (type === "delivery") {
    if (ds === "delivered") return "delivered";
    if (ds === "out_for_delivery") return "out_for_delivery";
    if (ds === "failed") return "delivery_failed";
  } else if (o.pickedUpAt) {
    return "picked_up";
  }
  const statuses = (o.departmentStatuses ?? {}) as Record<string, string>;
  const items = (Array.isArray(o.items) ? o.items : []) as Rec[];
  const depts = new Set<string>(items.map((i) => String(i.department)));
  Object.entries(statuses).forEach(([d, s]) => { if (s && s !== "cancelled") depts.add(d); });
  const list = DEPTS.filter((d) => depts.has(d));
  const writing = items.some((i) => String((i.writing as Rec | undefined)?.text ?? "").trim());
  const ws = String(o.writingStatus ?? "pending");
  const done = list.filter((d) => statuses[d] === "done").length + (writing && ws === "done" ? 1 : 0);
  const started = list.filter((d) => statuses[d] === "in_progress").length + (writing && ws === "in_progress" ? 1 : 0);
  const total = list.length + (writing ? 1 : 0);
  if (total && done === total) return "ready";
  if (done || started) return "in_production";
  return "received";
}

export function publicView(o: Rec, brand: string) {
  const items = (Array.isArray(o.items) ? o.items : []) as Rec[];
  const events = (Array.isArray(o.events) ? o.events : []) as Rec[];
  const driver = o.deliveryDriver as Rec | undefined;
  return {
    brand,
    orderNumber: o.orderNumber,
    customerFirstName: String(o.customerName ?? "").trim().split(/\s+/)[0] || null,
    orderType: o.orderType === "delivery" ? "delivery" : "pickup",
    stage: publicStage(o),
    scheduledFor: o.deliveryTime ?? null,
    driverName: driver?.name ? String(driver.name).split(/\s+/)[0] : null,
    items: items.map((i) => ({ name: String(i.name ?? ""), quantity: Number(i.quantity ?? 1) })),
    events: events
      .filter((e) => ["created", "ready", "dispatched", "delivered", "picked_up", "delivery_failed", "dept_started"].includes(String(e.type)))
      .map((e) => ({ type: e.type, at: e.at })),
    createdAt: o.createdAt ?? null,
    updatedAt: o.updatedAt ?? null,
  };
}

export function onlineView(o: Rec, brand: string) {
  const items = (Array.isArray(o.items) ? o.items : []) as Rec[];
  const status = String(o.status ?? "new");
  return {
    brand,
    orderNumber: null,
    customerFirstName: String(o.customerName ?? "").trim().split(/\s+/)[0] || null,
    orderType: o.orderType === "delivery" ? "delivery" : "pickup",
    stage: status === "rejected" ? "rejected" : "awaiting_confirmation",
    rejectReason: status === "rejected" ? (o.rejectReason ?? null) : null,
    scheduledFor: o.deliveryTime ?? null,
    driverName: null,
    items: items.map((i) => ({ name: String(i.name ?? ""), quantity: Number(i.quantity ?? 1) })),
    events: [{ type: "online_received", at: o.createdAt }],
    createdAt: o.createdAt ?? null,
    updatedAt: o.updatedAt ?? null,
  };
}

/** The customer's own loyalty summary (balance, tier, points from this order). */
export async function loyaltyView(fs: Firestore, companyId: string, o: Rec) {
  const settings = normalizeLoyalty(await fs.get(`companies/${companyId}/settings/loyalty`).catch(() => null));
  if (!settings.enabled) return null;
  const L = (o.loyalty ?? {}) as Rec;
  const key = String(L.key ?? "") || loyaltyKey(String(o.customerPhone ?? ""));
  if (!key) return null;
  const acc = await fs.get(`companies/${companyId}/loyaltyAccounts/${key}`).catch(() => null);
  if (!acc) return null;
  const points = Math.max(0, Math.floor(Number(acc.points ?? 0)));
  return {
    points,
    value: pointsValue(points, settings),
    tier: tierFor(Number(acc.lifetimeSpent ?? 0), settings).name,
    earned: L.state === "applied" && Number(L.earnedPoints) > 0 ? Number(L.earnedPoints) : null,
  };
}

export async function handleTrack(request: Request, env: AuthEnv, fetchImpl: typeof fetch = fetch) {
  const sa = readServiceAccount(env);
  if (!sa) return json({ error: "not_configured" }, 503);
  const url = new URL(request.url);
  const companyId = url.searchParams.get("c");
  const code = url.searchParams.get("t") ?? "";
  if (!isValidCompanyId(companyId) || !/^[a-z0-9]{8,16}$/.test(code)) return json({ error: "bad_request" }, 400);

  const fs = new Firestore(sa, fetchImpl);
  try {
    const rows = await fs.runQuery(`companies/${companyId}`, {
      from: [{ collectionId: "orders" }],
      where: { fieldFilter: { field: { fieldPath: "trackingCode" }, op: "EQUAL", value: { stringValue: code } } },
      limit: 1,
    });
    const company = await fs.get(`companies/${companyId}`).catch(() => null);
    const brand = String(company?.name ?? (companyId === "laviviane-trial" ? "Laviviane" : ""));
    if (rows.length) {
      const loyalty = await loyaltyView(fs, companyId, rows[0].data).catch(() => null);
      return json({ ...publicView(rows[0].data, brand), loyalty }, 200, { "Cache-Control": "no-store" });
    }
    // Not an order yet: maybe an online request still waiting for the branch.
    const pending = await fs.runQuery(`companies/${companyId}`, {
      from: [{ collectionId: "onlineOrders" }],
      where: { fieldFilter: { field: { fieldPath: "trackingCode" }, op: "EQUAL", value: { stringValue: code } } },
      limit: 1,
    });
    if (!pending.length) return json({ error: "not_found" }, 404);
    return json(onlineView(pending[0].data, brand), 200, { "Cache-Control": "no-store" });
  } catch (err) {
    console.error("track_error", err instanceof Error ? err.message : err);
    return json({ error: "server_error" }, 500);
  }
}
