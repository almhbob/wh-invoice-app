import { describe, expect, test } from "bun:test";

import { decodeFields } from "./auth/core";
import { handleLead, handleLeadConfig, validateLead } from "./leads";

async function pem() {
  const kp = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  let bin = ""; raw.forEach((b) => (bin += String.fromCharCode(b)));
  return `-----BEGIN PRIVATE KEY-----\n${btoa(bin)}\n-----END PRIVATE KEY-----`;
}

const good = { shopName: "حلويات السعادة", ownerName: "أبو فهد", phone: "+966 55 123 4567", city: "الرياض", shopType: "sweets", branches: "2-3", plan: "business", consent: true };

describe("join page leads", () => {
  test("validation cleans input and requires consent", () => {
    const { fields, lead } = validateLead({ ...good, shopName: "  <b>حلويات</b>  السعادة ", plan: "free-forever" });
    expect(fields).toEqual([]);
    expect(lead.phone).toBe("0551234567");
    expect(lead.shopName).toBe("b حلويات /b السعادة");
    expect(lead.plan).toBe("unsure");
    expect(validateLead({ ...good, consent: false, phone: "123", email: "x@" }).fields).toEqual(["phone", "email", "consent"]);
  });

  test("stores a lead, drops bots, rate-limits repeats", async () => {
    const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: "p", client_email: "s@p.iam.gserviceaccount.com", private_key: await pem() }), SALES_WHATSAPP: "+966 50 000 0000" };
    const created: Record<string, unknown>[] = [];
    const store = new Map<string, Record<string, unknown>>();
    const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "a", expires_in: 3600 }));
      const path = url.split("/documents/")[1]?.split("?")[0] ?? "";
      if (init?.method === "POST" && path === "platformLeads") {
        created.push(decodeFields(JSON.parse(String(init.body)).fields));
        return new Response(JSON.stringify({ name: `x/platformLeads/L${created.length}` }));
      }
      if (init?.method === "PATCH") { store.set(path, decodeFields(JSON.parse(String(init.body)).fields)); return new Response("{}"); }
      const doc = store.get(path);
      if (doc) return new Response(JSON.stringify({ fields: Object.fromEntries(Object.entries(doc).map(([k, v]) => [k, typeof v === "number" ? { integerValue: String(v) } : { stringValue: String(v) }])) }));
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    const post = (b: unknown) => handleLead(new Request("https://x/api/lead", { method: "POST", body: JSON.stringify(b), headers: { "CF-Connecting-IP": "1.2.3.4" } }), env, fetchMock);

    const ok = await post(good);
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { whatsapp: string }).whatsapp).toBe("966500000000");
    expect(created[0]).toMatchObject({ shopName: "حلويات السعادة", phone: "0551234567", status: "new", source: "join_page" });

    expect((await post({ ...good, website: "spam" })).status).toBe(200);
    expect(created).toHaveLength(1);

    expect((await post({ ...good, phone: "abc" })).status).toBe(400);
    expect((await post(good)).status).toBe(200);
    expect((await post(good)).status).toBe(429); // same phone a third time in a day
    expect(created).toHaveLength(2);
  });

  test("no service account → 503; config hides a bad number", async () => {
    expect((await handleLead(new Request("https://x/api/lead", { method: "POST", body: "{}" }), {})).status).toBe(503);
    expect(await (handleLeadConfig({ SALES_WHATSAPP: "12" })).json()).toEqual({ whatsapp: null });
  });
});
