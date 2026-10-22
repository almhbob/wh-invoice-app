import { LAVIVIANE_CATEGORY_ORDER, LAVIVIANE_PRODUCTS } from "../constants/lavivianeProducts";
import { clientIp, Firestore, isValidCompanyId, json, nowSec, readJson, readServiceAccount, sha256Hex, type AuthEnv } from "./auth/core";

/**
 * Public online ordering.
 *   GET  /api/catalog?s=<slug>       → menu for the customer page
 *   POST /api/online-order           → creates companies/{id}/onlineOrders/{auto} with status "new"
 * The branch (cashier) accepts, modifies or rejects it inside the app.
 * Prices are always recomputed here from the catalog — never trusted from the browser.
 */

const SLUGS: Record<string, string> = { laviviane: "laviviane-trial" };
const SURFACES = new Set(["cream", "jelly", "jelly_on_sugar", "sugar_print", "card", "other"]);
const DEPTS = new Set(["halwa", "mawali", "chocolate", "cake", "packaging"]);

export function resolveCompany(slugOrId: string | null | undefined): string | null {
  const v = String(slugOrId ?? "").trim().toLowerCase();
  if (!v) return null;
  if (SLUGS[v]) return SLUGS[v];
  return isValidCompanyId(v) ? v : null;
}

export interface CatalogProduct {
  id: string;
  name: string;
  nameEn?: string;
  price: number;
  department: string;
  category: string;
  description?: string;
  imageUri?: string;
}

function seedCatalog(companyId: string): CatalogProduct[] {
  if (companyId !== "laviviane-trial") return [];
  return LAVIVIANE_PRODUCTS.filter((p) => p.isAvailable !== false).map((p) => ({
    id: p.id, name: p.name, nameEn: p.nameEn, price: p.price, department: p.department, category: p.category, description: p.description, imageUri: p.imageUri,
  }));
}

export async function loadCatalog(env: AuthEnv, companyId: string, fetchImpl: typeof fetch = fetch) {
  const sa = readServiceAccount(env);
  let products: CatalogProduct[] = [];
  let brand = companyId === "laviviane-trial" ? "Laviviane" : "";
  if (sa) {
    try {
      const fs = new Firestore(sa, fetchImpl);
      const [docs, company] = await Promise.all([fs.list(`companies/${companyId}/products`), fs.get(`companies/${companyId}`).catch(() => null)]);
      if (company?.name) brand = String(company.name);
      products = docs
        .map(({ id, data }) => ({
          id,
          name: String(data.name ?? ""),
          nameEn: data.nameEn ? String(data.nameEn) : undefined,
          price: Number(data.price ?? 0),
          department: String(data.department ?? "cake"),
          category: String(data.category ?? ""),
          description: data.description ? String(data.description) : undefined,
          imageUri: data.imageUri ? String(data.imageUri) : undefined,
          available: data.isAvailable !== false,
          sortOrder: Number(data.sortOrder ?? 0),
        }))
        .filter((p) => p.available && p.name && p.price > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(({ available: _a, sortOrder: _s, ...p }) => p);
    } catch (err) {
      console.error("catalog_error", err instanceof Error ? err.message : err);
    }
  }
  if (!products.length) products = seedCatalog(companyId);
  const order = companyId === "laviviane-trial" ? [...LAVIVIANE_CATEGORY_ORDER] as string[] : [];
  const cats = [...new Set(products.map((p) => p.category))].sort((a, b) => {
    const ia = order.indexOf(a), ib = order.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });
  return { brand: brand || companyId, companyId, products, categories: cats, orderingEnabled: Boolean(sa) };
}

export async function handleCatalog(request: Request, env: AuthEnv, fetchImpl: typeof fetch = fetch) {
  const companyId = resolveCompany(new URL(request.url).searchParams.get("s"));
  if (!companyId) return json({ error: "bad_request" }, 400);
  const cat = await loadCatalog(env, companyId, fetchImpl);
  if (!cat.products.length) return json({ error: "not_found" }, 404);
  return json(cat, 200, { "Cache-Control": "public, max-age=60" });
}

// ── Order intake ───────────────────────────────────────────────────────────────

interface IncomingItem { productId?: unknown; qty?: unknown; writing?: { text?: unknown; surface?: unknown; note?: unknown } }
interface IncomingOrder {
  s?: unknown; name?: unknown; phone?: unknown; orderType?: unknown; address?: unknown; locationUrl?: unknown;
  date?: unknown; time?: unknown; notes?: unknown; items?: unknown; website?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function normalizePhone(v: string) {
  const d = v.replace(/[^\d]/g, "").replace(/^00966/, "0").replace(/^966/, "0");
  return /^05\d{8}$/.test(d) ? d : null;
}

function newCode() {
  const alphabet = "23456789abcdefghjkmnpqrstuvwxyz";
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => alphabet[b % alphabet.length]).join("");
}

async function rateLimited(fs: Firestore, key: string, max: number, windowSec: number) {
  const path = `authThrottle/${key}`;
  const doc = await fs.get(path);
  const t = nowSec();
  const fresh = !doc || Number(doc.windowStart ?? 0) + windowSec <= t;
  const count = fresh ? 1 : Number(doc!.failures ?? 0) + 1;
  await fs.patch(path, { failures: count, windowStart: fresh ? t : Number(doc!.windowStart), lockedUntil: 0, updatedAt: new Date().toISOString() });
  return count > max;
}

export async function handleOnlineOrder(request: Request, env: AuthEnv, fetchImpl: typeof fetch = fetch) {
  const sa = readServiceAccount(env);
  if (!sa) return json({ error: "not_configured" }, 503);
  const body = await readJson<IncomingOrder>(request);
  if (!body) return json({ error: "bad_request" }, 400);
  if (str(body.website, 50)) return json({ ok: true, trackingCode: newCode() }); // honeypot: silently drop bots

  const companyId = resolveCompany(typeof body.s === "string" ? body.s : null);
  const name = str(body.name, 60);
  const phone = normalizePhone(str(body.phone, 20));
  const orderType = body.orderType === "delivery" ? "delivery" : "pickup";
  const address = str(body.address, 300);
  const locationUrl = str(body.locationUrl, 300);
  const date = str(body.date, 10);
  const time = str(body.time, 5);
  const notes = str(body.notes, 500);
  const rawItems = Array.isArray(body.items) ? (body.items as IncomingItem[]).slice(0, 30) : [];

  const errors: string[] = [];
  if (!companyId) errors.push("company");
  if (name.length < 2) errors.push("name");
  if (!phone) errors.push("phone");
  if (orderType === "delivery" && address.length < 5 && !/^https:\/\/(www\.)?google\.[a-z.]+\/maps|^https:\/\/maps\.google\./.test(locationUrl)) errors.push("address");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) errors.push("datetime");
  if (!rawItems.length) errors.push("items");
  if (locationUrl && !/^https:\/\/(www\.)?(google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/.test(locationUrl)) errors.push("location");
  if (errors.length) return json({ error: "invalid", fields: errors }, 400);

  // The requested time must be in the future (Riyadh, UTC+3) and within 60 days.
  const due = Date.parse(`${date}T${time}:00+03:00`);
  if (isNaN(due) || due < Date.now() - 5 * 60_000 || due > Date.now() + 60 * 86400_000) return json({ error: "invalid", fields: ["datetime"] }, 400);

  const fs = new Firestore(sa, fetchImpl);
  try {
    const ipKey = await sha256Hex(`online|ip|${clientIp(request)}`);
    const phoneKey = await sha256Hex(`online|phone|${companyId}|${phone}`);
    if ((await rateLimited(fs, ipKey, 8, 3600)) || (await rateLimited(fs, phoneKey, 5, 3600))) {
      return json({ error: "rate_limited" }, 429);
    }

    const catalog = await loadCatalog(env, companyId!, fetchImpl);
    const byId = new Map(catalog.products.map((p) => [p.id, p]));
    const items: Record<string, unknown>[] = [];
    for (const [i, it] of rawItems.entries()) {
      const p = byId.get(String(it.productId ?? ""));
      const qty = Math.floor(Number(it.qty));
      if (!p || !(qty >= 1 && qty <= 50)) return json({ error: "invalid", fields: ["items"] }, 400);
      const wText = str(it.writing?.text, 120);
      const wSurface = SURFACES.has(String(it.writing?.surface)) ? String(it.writing?.surface) : "cream";
      items.push({
        id: `on${i + 1}`,
        productId: p.id,
        name: p.name,
        quantity: qty,
        price: p.price,
        department: DEPTS.has(p.department) ? p.department : "cake",
        ...(wText ? { writing: { text: wText, surface: wSurface, ...(str(it.writing?.note, 120) ? { note: str(it.writing?.note, 120) } : {}) } } : {}),
      });
    }
    const subtotal = items.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
    const trackingCode = newCode();
    const now = new Date().toISOString();
    const id = await fs.create(`companies/${companyId}/onlineOrders`, {
      status: "new",
      companyId,
      customerName: name,
      customerPhone: phone,
      orderType,
      ...(address ? { deliveryAddress: address } : {}),
      ...(locationUrl ? { locationUrl } : {}),
      deliveryTime: `${date} ${time}`,
      ...(notes ? { notes } : {}),
      items,
      subtotal,
      trackingCode,
      createdAt: now,
      updatedAt: now,
    });
    return json({ ok: true, id, trackingCode, subtotal, brand: catalog.brand });
  } catch (err) {
    console.error("online_order_error", err instanceof Error ? err.message : err);
    return json({ error: "server_error" }, 500);
  }
}
