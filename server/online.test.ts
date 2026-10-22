import { describe, expect, test } from "bun:test";

import { decodeFields } from "./auth/core";
import { handleCatalog, handleOnlineOrder, normalizePhone, resolveCompany } from "./online";
import { DEFAULT_STORE_SETTINGS, earliestSlot, normalizeStoreSettings, scheduleError, riyadhMs } from "../constants/onlineStore";
import { LAVIVIANE_PRODUCTS } from "../constants/lavivianeProducts";

async function pem() {
  const kp = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  let bin = ""; raw.forEach((b) => (bin += String.fromCharCode(b)));
  return `-----BEGIN PRIVATE KEY-----\n${btoa(bin)}\n-----END PRIVATE KEY-----`;
}


describe("store rules", () => {
  const s = normalizeStoreSettings({ openDays: [0, 1, 2, 3, 4], openFrom: "10:00", openTo: "22:00", closedDates: ["2030-01-02"] });
  const now = riyadhMs("2030-01-01", "09:00"); // Tuesday
  test("schedule checks", () => {
    expect(scheduleError(s, "2030-01-01", "15:00", 4, now)).toBeNull();
    expect(scheduleError(s, "2030-01-01", "12:00", 4, now)).toBe("lead_time");
    expect(scheduleError(s, "2030-01-01", "23:00", 0, now)).toBe("outside_hours");
    expect(scheduleError(s, "2030-01-01", "15:10", 0, now)).toBe("bad_slot");
    expect(scheduleError(s, "2030-01-02", "15:00", 0, now)).toBe("closed_date");
    expect(scheduleError(s, "2030-01-04", "15:00", 0, now)).toBe("closed_day"); // Friday
    expect(earliestSlot(s, 30, now)).toEqual({ date: "2030-01-03", time: "10:00" }); // skips the closed date, opens 10:00
    expect(earliestSlot({ ...s, enabled: false }, 0, now)).toBeNull();
    expect(DEFAULT_STORE_SETTINGS.categoryLeadHours["Laviviane Cakes"]).toBe(24);
  });
});

describe("online ordering", () => {
  test("helpers", () => {
    expect(resolveCompany("Laviviane")).toBe("laviviane-trial");
    expect(resolveCompany("../x")).toBeNull();
    expect(normalizePhone("+966 50 123 4567")).toBe("0501234567");
    expect(normalizePhone("12345")).toBeNull();
  });

  test("catalog falls back to the seed menu without a service account", async () => {
    const res = await handleCatalog(new Request("https://x/api/catalog?s=laviviane"), {});
    const body = (await res.json()) as { products: unknown[]; orderingEnabled: boolean; categories: string[] };
    expect(body.products.length).toBeGreaterThan(50);
    expect(body.orderingEnabled).toBe(false);
    expect(body.categories[0]).toBe("New Cake Collection");
  });

  test("creates an online order with server-side prices, validates input", async () => {
    const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: "p", client_email: "s@p.iam.gserviceaccount.com", private_key: await pem() }) };
    const created: Record<string, unknown>[] = [];
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "a", expires_in: 3600 }));
      if (init?.method === "POST" && url.endsWith("/onlineOrders")) {
        created.push(decodeFields(JSON.parse(String(init.body)).fields));
        return new Response(JSON.stringify({ name: "x/onlineOrders/abc123" }));
      }
      if (init?.method === "PATCH") return new Response("{}");
      if (url.includes("/products")) return new Response(JSON.stringify({ documents: [] }));
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    const p = LAVIVIANE_PRODUCTS[0];
    const when = earliestSlot(normalizeStoreSettings(null), 24)!;
    const send = (extra: Record<string, unknown>) =>
      handleOnlineOrder(new Request("https://x/api/online-order", { method: "POST", body: JSON.stringify({
        s: "laviviane", name: "ريم", phone: "0501234567", orderType: "pickup", ...when,
        items: [{ productId: p.id, qty: 2, price: 1, writing: { text: "مبروك", surface: "sugar_print" } }], ...extra,
      }) }), env, fetchMock);

    const ok = await send({});
    expect(ok.status).toBe(200);
    expect(created).toHaveLength(1);
    const doc = created[0] as { subtotal: number; status: string; items: { price: number; writing: { surface: string } }[]; trackingCode: string };
    expect(doc.status).toBe("new");
    expect(doc.subtotal).toBe(p.price * 2); // client price ignored
    expect(doc.items[0].writing.surface).toBe("sugar_print");
    expect(doc.trackingCode).toMatch(/^[a-z0-9]{10}$/);

    expect((await send({ phone: "123" })).status).toBe(400);
    expect((await send({ orderType: "delivery", address: "" })).status).toBe(400);
    expect((await send({ items: [{ productId: "nope", qty: 1 }] })).status).toBe(400);
    expect((await send({ date: "2020-01-01" })).status).toBe(400);
    const tooSoon = await send(earliestSlot(normalizeStoreSettings(null), 4)!);
    expect(tooSoon.status).toBe(400); // cake needs 24h lead time
    expect(((await tooSoon.json()) as { error: string }).error).toBe("lead_time");
    const bot = await send({ website: "spam" });
    expect(bot.status).toBe(200);
    expect(created).toHaveLength(1); // honeypot dropped silently
  });

  test("503 when not configured", async () => {
    const r = await handleOnlineOrder(new Request("https://x/api/online-order", { method: "POST", body: "{}" }), {});
    expect(r.status).toBe(503);
  });
});
