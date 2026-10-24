/**
 * Run with: bun test server/auth
 * Exercises the auth handlers end-to-end against an in-memory Firestore/OAuth mock.
 */
import { describe, expect, test, beforeEach } from "bun:test";

import { b64url, b64urlDecode, decodeFields, encodeFields, signJwt, hashPin, verifyPin, pinPolicyError } from "./core";
import { handleLogin, handleSetPin, handleStatus } from "./handlers";
import { BOOTSTRAP_ACCOUNTS } from "./bootstrap";
import { sha256Hex } from "./core";
import { PRODUCTION_API_BASE, STAGING_API_BASE, resolveApiBase } from "../../lib/apiBase";

const PROJECT = "test-proj";
const COMPANY = "laviviane-trial";

async function genRsa() {
  const kp = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  let bin = "";
  pkcs8.forEach((b) => (bin += String.fromCharCode(b)));
  const pem = `-----BEGIN PRIVATE KEY-----\n${btoa(bin).match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
  const jwk = (await crypto.subtle.exportKey("jwk", kp.publicKey)) as JsonWebKey;
  return { pem, jwk, publicKey: kp.publicKey };
}

let sa: { project_id: string; client_email: string; private_key: string };
let saPub: CryptoKey;
let google: { pem: string; jwk: JsonWebKey };
let store: Map<string, Record<string, unknown>>;
let env: { FIREBASE_SERVICE_ACCOUNT: string };

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/`;

describe("API environment routing", () => {
  test("native staging ignores the default production URL", () => {
    expect(resolveApiBase({ platform: "android", appEnv: "staging", apiBase: PRODUCTION_API_BASE })).toBe(STAGING_API_BASE);
  });
  test("web stays on the current origin", () => {
    expect(resolveApiBase({ platform: "web", appEnv: "staging", webOrigin: "https://preview.fotra-staging.pages.dev" }))
      .toBe("https://preview.fotra-staging.pages.dev");
  });
  test("production retains its default endpoint", () => {
    expect(resolveApiBase({ platform: "android", appEnv: "production" })).toBe(PRODUCTION_API_BASE);
  });
});

const fetchMock = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.startsWith("https://oauth2.googleapis.com/token")) {
    return new Response(JSON.stringify({ access_token: "at", expires_in: 3600 }), { status: 200 });
  }
  if (!url.startsWith(BASE)) return new Response("nope", { status: 500 });
  const [pathPart, query = ""] = url.slice(BASE.length).split("?");
  const path = decodeURIComponent(pathPart);
  const method = init?.method ?? "GET";
  if (method === "POST") {
    const id = `auto${store.size + 1}`;
    store.set(`${path}/${id}`, decodeFields((JSON.parse(String(init!.body)) as { fields: Record<string, never> }).fields));
    return new Response(JSON.stringify({ name: `projects/x/databases/(default)/documents/${path}/${id}` }), { status: 200 });
  }
  if (method === "PATCH") {
    const body = JSON.parse(String(init!.body)) as { fields: Record<string, never> };
    const data = decodeFields(body.fields);
    const masks = new URLSearchParams(query).getAll("updateMask.fieldPaths");
    const prev = store.get(path) ?? {};
    let next: Record<string, unknown>;
    if (masks.length) {
      next = { ...prev };
      for (const m of masks) {
        if (m in data) next[m] = data[m];
        else delete next[m];
      }
    } else next = data;
    store.set(path, next);
    return new Response("{}", { status: 200 });
  }
  if (store.has(path)) return new Response(JSON.stringify({ name: path, fields: encodeFields(store.get(path)!) }), { status: 200 });
  // collection listing
  const prefix = `${path}/`;
  const docs = [...store.entries()]
    .filter(([k]) => k.startsWith(prefix) && !k.slice(prefix.length).includes("/"))
    .map(([k, v]) => ({ name: `projects/x/databases/(default)/documents/${k}`, fields: encodeFields(v) }));
  if (docs.length || path.split("/").length % 2 === 1) return new Response(JSON.stringify({ documents: docs }), { status: 200 });
  return new Response("{}", { status: 404 });
}) as typeof fetch;

async function idTokenFor(claims: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  const t = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: "k1", typ: "JWT" };
  const payload = { iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, iat: t, exp: t + 3600, sub: "uid1", ...claims, ...overrides };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const full = await signJwt(payload, google.pem); // signJwt uses typ-only header; rebuild with kid
  const key = await crypto.subtle.importKey("pkcs8", b64urlDecode(google.pem.replace(/-----[^-]+-----|\s/g, "").replace(/\+/g, "-").replace(/\//g, "_")), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  void full;
  return `${unsigned}.${b64url(sig)}`;
}

const deps = () => ({ fetchImpl: fetchMock, jwks: [{ ...(google.jwk as JsonWebKey), kid: "k1" }] });

function req(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://x${path}`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4", ...headers } });
}

beforeEach(async () => {
  if (!sa) {
    const k = await genRsa();
    sa = { project_id: PROJECT, client_email: "svc@test-proj.iam.gserviceaccount.com", private_key: k.pem };
    saPub = k.publicKey;
    google = await genRsa();
  }
  env = { FIREBASE_SERVICE_ACCOUNT: JSON.stringify(sa) };
  store = new Map();
  store.set(`companies/${COMPANY}/employees/e1`, { name: "مسؤول", employeeId: "LAVI001", username: "lavi001", pinCode: "1234", role: "admin", status: "active" });
  store.set(`companies/${COMPANY}/employees/e2`, { name: "كاشير", employeeId: "C01", username: "cash", pinCode: "7391", role: "cashier", status: "active" });
  store.set(`companies/${COMPANY}/employees/e3`, { name: "موقوف", employeeId: "S01", pinCode: "5555", role: "cake", status: "suspended" });
  store.set(`companies/${COMPANY}/employees/e4`, { name: "جديد", employeeId: "N01", role: "cake", status: "active" });
});

describe("pin helpers", () => {
  test("hash/verify roundtrip and policy", async () => {
    const s = await hashPin("4826");
    expect(await verifyPin("4826", s)).toBe(true);
    expect(await verifyPin("4827", s)).toBe(false);
    expect(pinPolicyError("1234")).toBe("pin_weak");
    expect(pinPolicyError("12a4")).toBe("pin_format");
    expect(pinPolicyError("4826")).toBeNull();
  });
});

describe("status", () => {
  test("reports configuration", async () => {
    expect(await (await handleStatus({})).json()).toEqual({ configured: false, projectId: null });
    expect((await (await handleStatus(env)).json()).configured).toBe(true);
    const deep = await (await handleStatus(env, new Request("https://x/api/auth/status?check=1"), deps())).json();
    expect(deep.token).toBe("ok");
  });
});

describe("login", () => {
  test("503 when not configured", async () => {
    const r = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "LAVI001", pin: "1234" }), {}, deps());
    expect(r.status).toBe(503);
  });

  test("legacy PIN migrates to hash, returns verifiable custom token", async () => {
    const r = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "lavi001", pin: "1234" }), env, deps());
    expect(r.status).toBe(200);
    const body = (await r.json()) as { token: string; employee: { id: string; role: string }; mustChangePin: boolean };
    expect(body.employee.id).toBe("e1");
    expect(body.mustChangePin).toBe(true); // weak legacy PIN
    const [h, p, sig] = body.token.split(".");
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", saPub, b64urlDecode(sig), new TextEncoder().encode(`${h}.${p}`));
    expect(ok).toBe(true);
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
    expect(payload.claims).toEqual({ companyId: COMPANY, role: "admin", eid: "e1", employeeId: "LAVI001" });
    expect(payload.aud).toContain("identitytoolkit");
    const secret = store.get(`companies/${COMPANY}/employeeSecrets/e1`)!;
    expect(typeof secret.pinHash).toBe("string");
    expect(String(store.get(`companies/${COMPANY}/employees/e1`)!.pinCode)).toStartWith("!migrated-");
    // Old plaintext PIN path is gone; hash path still accepts the PIN.
    const r2 = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "LAVI001", pin: "1234" }), env, deps());
    expect(r2.status).toBe(200);
  });

  test("strong legacy PIN does not force change", async () => {
    const r = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "cash", pin: "7391" }), env, deps());
    expect(((await r.json()) as { mustChangePin: boolean }).mustChangePin).toBe(false);
  });

  test("platformRole is minted only from a server-managed platform owner marker", async () => {
    store.set(`platformOwners/${COMPANY}__e1`, { active: true, platformRole: "owner" });
    const r = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "LAVI001", pin: "1234" }), env, deps());
    expect(r.status).toBe(200);
    const body = (await r.json()) as { token: string };
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body.token.split(".")[1])));
    expect(payload.claims.platformRole).toBe("owner");

    const regular = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "cash", pin: "7391" }), env, deps());
    const regularBody = (await regular.json()) as { token: string };
    const regularPayload = JSON.parse(new TextDecoder().decode(b64urlDecode(regularBody.token.split(".")[1])));
    expect(regularPayload.claims.platformRole).toBeUndefined();
  });

  test("wrong PIN, suspended, unknown and PIN-less accounts are rejected identically", async () => {
    for (const [login, pin] of [["LAVI001", "9999"], ["S01", "5555"], ["ghost", "1234"], ["N01", "0000"]]) {
      const r = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login, pin }), env, deps());
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: "invalid_credentials" });
    }
  });

  test("employee without a stored PIN uses the old default once and must change it", async () => {
    const r = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "N01", pin: "1234" }), env, deps());
    expect(r.status).toBe(200);
    expect(((await r.json()) as { mustChangePin: boolean }).mustChangePin).toBe(true);
  });

  test("one-time owner bootstrap creates the account once", async () => {
    const salt = "testsalt";
    const codeHash = await sha256Hex(`${salt}|7395014826`);
    BOOTSTRAP_ACCOUNTS[COMPANY] = [{ employeeId: "BOOT9", username: "boot9", name: "Owner", role: "admin", salt, codeHash }];
    expect((await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "BOOT9", pin: "1234" }), env, deps())).status).toBe(401);
    const ok = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "boot9", pin: "7395014826" }), env, deps());
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { mustChangePin: boolean; employee: { role: string; id: string } };
    expect(body.mustChangePin).toBe(true);
    expect(body.employee.role).toBe("admin");
    const created = [...store.entries()].filter(([k, v]) => k.startsWith(`companies/${COMPANY}/employees/`) && (v as { employeeId?: string }).employeeId === "BOOT9");
    expect(created).toHaveLength(1);
    // Second time: the account exists, so the normal (hashed) path is used — no duplicate.
    const again = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "BOOT9", pin: "7395014826" }), env, deps());
    expect(again.status).toBe(200);
    expect([...store.entries()].filter(([k, v]) => k.startsWith(`companies/${COMPANY}/employees/`) && (v as { employeeId?: string }).employeeId === "BOOT9")).toHaveLength(1);
    BOOTSTRAP_ACCOUNTS[COMPANY] = [];
  });

  test("locks after repeated failures", async () => {
    let last = 0;
    for (let i = 0; i < 9; i++) {
      last = (await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "LAVI001", pin: "0000" }), env, deps())).status;
    }
    expect(last).toBe(429);
    const ok = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "LAVI001", pin: "1234" }), env, deps());
    expect(ok.status).toBe(429); // still locked even with the right PIN
  });

  test("rejects malformed input", async () => {
    const r = await handleLogin(req("/api/auth/login", { companyId: "../evil", login: "x", pin: "1" }), env, deps());
    expect(r.status).toBe(400);
  });
});

describe("set-pin", () => {
  const adminClaims = { companyId: COMPANY, role: "admin", eid: "e1", employeeId: "LAVI001" };
  const cashierClaims = { companyId: COMPANY, role: "cashier", eid: "e2", employeeId: "C01" };

  test("requires a valid ID token", async () => {
    expect((await handleSetPin(req("/api/auth/set-pin", { newPin: "4826" }), env, deps())).status).toBe(401);
    const forged = await idTokenFor(adminClaims, { aud: "other-project" });
    expect((await handleSetPin(req("/api/auth/set-pin", { newPin: "4826" }, { Authorization: `Bearer ${forged}` }), env, deps())).status).toBe(401);
  });

  test("self change needs the current PIN and a strong new PIN", async () => {
    const tok = await idTokenFor(adminClaims);
    const auth = { Authorization: `Bearer ${tok}` };
    expect((await handleSetPin(req("/api/auth/set-pin", { newPin: "4826", currentPin: "0000" }, auth), env, deps())).status).toBe(403);
    expect((await handleSetPin(req("/api/auth/set-pin", { newPin: "1111", currentPin: "1234" }, auth), env, deps())).status).toBe(400);
    const ok = await handleSetPin(req("/api/auth/set-pin", { newPin: "4826", currentPin: "1234" }, auth), env, deps());
    expect(ok.status).toBe(200);
    const login = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "LAVI001", pin: "4826" }), env, deps());
    expect(((await login.json()) as { mustChangePin: boolean }).mustChangePin).toBe(false);
    expect((await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "LAVI001", pin: "1234" }), env, deps())).status).toBe(401);
  });

  test("cashier cannot set someone else's PIN; admin can (and it is temporary)", async () => {
    const cashier = await idTokenFor(cashierClaims);
    expect((await handleSetPin(req("/api/auth/set-pin", { employeeDocId: "e4", newPin: "4826" }, { Authorization: `Bearer ${cashier}` }), env, deps())).status).toBe(403);
    const admin = await idTokenFor(adminClaims);
    expect((await handleSetPin(req("/api/auth/set-pin", { employeeDocId: "e4", newPin: "4826" }, { Authorization: `Bearer ${admin}` }), env, deps())).status).toBe(200);
    const login = await handleLogin(req("/api/auth/login", { companyId: COMPANY, login: "N01", pin: "4826" }), env, deps());
    expect(login.status).toBe(200);
    expect(((await login.json()) as { mustChangePin: boolean }).mustChangePin).toBe(true);
  });
});
