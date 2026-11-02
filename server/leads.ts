// Public "start your trial" requests from sweet / cake shops (the /join page).
// Stored in platformLeads (service account only; platform owners read them in the
// developer dashboard). Validated and rate-limited here — the browser never writes.

import { clientIp, Firestore, json, nowSec, readJson, readServiceAccount, sha256Hex, type AuthEnv } from "./auth/core";
import { normalizePhone } from "./online";

export interface LeadEnv extends AuthEnv {
  /** Sales WhatsApp shown after sending, e.g. 9665XXXXXXXX (optional). */
  SALES_WHATSAPP?: string;
}

export const LEAD_PLANS = new Set(["starter", "business", "enterprise", "unsure"]);
export const SHOP_TYPES = new Set(["sweets", "cakes", "bakery", "chocolate", "cafe", "other"]);
const BRANCHES = new Set(["1", "2-3", "4-10", "10+"]);

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");

export interface LeadInput {
  shopName?: unknown; ownerName?: unknown; phone?: unknown; city?: unknown; email?: unknown;
  shopType?: unknown; branches?: unknown; plan?: unknown; notes?: unknown; consent?: unknown;
  website?: unknown; utm?: unknown;
}

export function validateLead(body: LeadInput) {
  const shopName = str(body.shopName, 80);
  const ownerName = str(body.ownerName, 60);
  const phone = normalizePhone(str(body.phone, 20));
  const city = str(body.city, 40);
  const email = str(body.email, 120).toLowerCase();
  const shopType = SHOP_TYPES.has(String(body.shopType)) ? String(body.shopType) : "other";
  const branches = BRANCHES.has(String(body.branches)) ? String(body.branches) : "1";
  const plan = LEAD_PLANS.has(String(body.plan)) ? String(body.plan) : "unsure";
  const notes = str(body.notes, 500);
  const utmRaw = body.utm && typeof body.utm === "object" ? (body.utm as Record<string, unknown>) : {};
  const utm: Record<string, string> = {};
  for (const k of ["source", "medium", "campaign", "content"]) { const v = str(utmRaw[k], 60); if (v) utm[k] = v; }

  const fields: string[] = [];
  if (shopName.length < 2) fields.push("shopName");
  if (ownerName.length < 2) fields.push("ownerName");
  if (!phone) fields.push("phone");
  if (city.length < 2) fields.push("city");
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) fields.push("email");
  if (body.consent !== true) fields.push("consent");
  return { fields, lead: { shopName, ownerName, phone: phone ?? "", city, email, shopType, branches, plan, notes, utm } };
}

async function bump(fs: Firestore, key: string, max: number, windowSec: number) {
  const path = `authThrottle/${key}`;
  const doc = await fs.get(path);
  const t = nowSec();
  const fresh = !doc || Number(doc.windowStart ?? 0) + windowSec <= t;
  const count = fresh ? 1 : Number(doc!.failures ?? 0) + 1;
  await fs.patch(path, { failures: count, windowStart: fresh ? t : Number(doc!.windowStart), lockedUntil: 0, updatedAt: new Date().toISOString() });
  return count > max;
}

function salesWhatsApp(env: LeadEnv) {
  const d = String(env.SALES_WHATSAPP ?? "").replace(/\D/g, "");
  return d.length >= 11 && d.length <= 15 ? d : null;
}

export function handleLeadConfig(env: LeadEnv) {
  return json({ whatsapp: salesWhatsApp(env) });
}

export async function handleLead(request: Request, env: LeadEnv, fetchImpl: typeof fetch = fetch) {
  const sa = readServiceAccount(env);
  if (!sa) return json({ error: "not_configured" }, 503);
  const body = await readJson<LeadInput>(request);
  if (!body) return json({ error: "bad_request" }, 400);
  const whatsapp = salesWhatsApp(env);
  if (str(body.website, 50)) return json({ ok: true, whatsapp }); // honeypot: silently drop bots

  const { fields, lead } = validateLead(body);
  if (fields.length) return json({ error: "invalid", fields }, 400);

  const fs = new Firestore(sa, fetchImpl);
  try {
    const ipKey = await sha256Hex(`lead|ip|${clientIp(request)}`);
    const phoneKey = await sha256Hex(`lead|phone|${lead.phone}`);
    if ((await bump(fs, ipKey, 5, 3600)) || (await bump(fs, phoneKey, 2, 86400))) {
      return json({ error: "rate_limited", whatsapp }, 429);
    }
    const now = new Date().toISOString();
    const data: Record<string, unknown> = { ...lead, status: "new", source: "join_page", consentAt: now, createdAt: now, updatedAt: now };
    if (!lead.email) delete data.email;
    if (!lead.notes) delete data.notes;
    if (!Object.keys(lead.utm).length) delete data.utm;
    const id = await fs.create("platformLeads", data);
    return json({ ok: true, id, whatsapp });
  } catch (err) {
    console.error("lead_error", err instanceof Error ? err.message : err);
    return json({ error: "server_error", whatsapp }, 500);
  }
}
