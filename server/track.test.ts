import { describe, expect, test } from "bun:test";

import { encodeFields } from "./auth/core";
import { handleTrack, publicStage } from "./track";

async function pem() {
  const kp = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  let bin = ""; raw.forEach((b) => (bin += String.fromCharCode(b)));
  return `-----BEGIN PRIVATE KEY-----\n${btoa(bin)}\n-----END PRIVATE KEY-----`;
}

const order = {
  orderNumber: 42, customerName: "سارة أحمد", customerPhone: "0500000000", deliveryAddress: "حي السرية",
  orderType: "delivery", totalAmount: 300, trackingCode: "abcdefgh23",
  items: [{ id: "1", name: "كيك فانيلا", quantity: 1, department: "cake", price: 300 }],
  departmentStatuses: { cake: "done", packaging: "done" }, deliveryStatus: "out_for_delivery",
  deliveryDriver: { name: "خالد العتيبي", employeeId: "d1", phone: "0555" },
  events: [{ type: "created", at: "2026-10-22T08:00:00Z", by: { name: "كاشير", employeeId: "C1" } }, { type: "dispatched", at: "2026-10-22T10:00:00Z" }],
};

describe("public tracking", () => {
  test("stage computation", () => {
    expect(publicStage(order)).toBe("out_for_delivery");
    expect(publicStage({ ...order, deliveryStatus: "assigned" })).toBe("ready");
    expect(publicStage({ ...order, deliveryStatus: undefined, departmentStatuses: { cake: "in_progress", packaging: "pending" } })).toBe("in_production");
    expect(publicStage({ orderType: "pickup", pickedUpAt: "x", items: [] })).toBe("picked_up");
    const withWriting = { ...order, deliveryStatus: "assigned", items: [{ ...order.items[0], writing: { text: "سنة حلوة", surface: "cream" } }] };
    expect(publicStage({ ...withWriting, writingStatus: "pending" })).toBe("in_production");
    expect(publicStage({ ...withWriting, writingStatus: "done" })).toBe("ready");
  });

  test("returns a sanitized view and never leaks contact or money", async () => {
    const env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: "p", client_email: "s@p.iam.gserviceaccount.com", private_key: await pem() }) };
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2")) return new Response(JSON.stringify({ access_token: "a", expires_in: 3600 }));
      if (url.endsWith(":runQuery")) return new Response(JSON.stringify([{ document: { name: "x/orders/o1", fields: encodeFields(order) } }]));
      if (url.endsWith("companies/laviviane-trial")) return new Response(JSON.stringify({ fields: encodeFields({ name: "Laviviane" }) }));
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    const res = await handleTrack(new Request("https://x/api/track?c=laviviane-trial&t=abcdefgh23"), env, fetchMock);
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.stage).toBe("out_for_delivery");
    expect(body.driverName).toBe("خالد");
    expect(body.customerFirstName).toBe("سارة");
    const raw = JSON.stringify(body);
    for (const secret of ["0500000000", "0555", "السرية", "300", "كاشير"]) expect(raw.includes(secret)).toBe(false);
  });

  test("rejects malformed codes", async () => {
    const res = await handleTrack(new Request("https://x/api/track?c=a&t=../x"), { FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: "p", client_email: "e", private_key: "k" }) });
    expect(res.status).toBe(400);
  });
});
