/**
 * Server-side authentication core for Cloudflare Pages Functions.
 *
 * - Verifies employee PINs against Firestore using a Google service account
 *   (Admin-level REST access, bypasses client security rules).
 * - Stores PINs as salted PBKDF2-SHA256 hashes in a collection clients can never read.
 * - Mints Firebase custom tokens whose claims (companyId, role, eid) drive Firestore rules.
 *
 * No external dependencies: only WebCrypto + fetch, so it runs on Workers as-is.
 * Do NOT import app code with "@/..." aliases here — wrangler bundles this file on its own.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface AuthEnv {
  FIREBASE_SERVICE_ACCOUNT?: string;
}

export interface EmployeeRecord {
  docId: string;
  companyId: string;
  name: string;
  employeeId: string;
  username?: string;
  role: string;
  status?: string;
  permissions?: string[];
  branchId?: string;
  legacyPin?: string;
}

export interface PinSecret {
  pinHash: string;
  pinSalt: string;
  pinIter: number;
  mustChange?: boolean;
}

export interface SessionClaims {
  companyId: string;
  role: string;
  eid: string;
  employeeId: string;
  platformRole?: "owner" | "developer" | "super_admin";
}

// ── Small utils ────────────────────────────────────────────────────────────────

const enc = new TextEncoder();

export function b64url(bytes: ArrayBuffer | Uint8Array | string): string {
  const u8 = typeof bytes === "string" ? enc.encode(bytes) : bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toHex(buf: ArrayBuffer | Uint8Array) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function sha256Hex(input: string) {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(input)));
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders },
  });
}

// ── Service account ────────────────────────────────────────────────────────────

export function readServiceAccount(env: AuthEnv): ServiceAccount | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

async function importPrivateKey(pem: string) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\\n|\s/g, "");
  return crypto.subtle.importKey("pkcs8", b64urlDecode(body.replace(/\+/g, "-").replace(/\//g, "_")) as BufferSource, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export async function signJwt(payload: Record<string, unknown>, privateKeyPem: string) {
  const header = { alg: "RS256", typ: "JWT" };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const key = await importPrivateKey(privateKeyPem);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(unsigned));
  return `${unsigned}.${b64url(sig)}`;
}

let cachedToken: { token: string; exp: number; email: string } | null = null;

export async function getAccessToken(sa: ServiceAccount, fetchImpl: typeof fetch = fetch) {
  if (cachedToken && cachedToken.email === sa.client_email && cachedToken.exp - 60 > nowSec()) return cachedToken.token;
  const iat = nowSec();
  const assertion = await signJwt(
    {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat,
      exp: iat + 3600,
    },
    sa.private_key,
  );
  const res = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${assertion}`,
  });
  if (!res.ok) throw new Error(`token_exchange_failed:${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, exp: iat + (data.expires_in || 3600), email: sa.client_email };
  return data.access_token;
}

export async function createCustomToken(sa: ServiceAccount, uid: string, claims: SessionClaims) {
  const iat = nowSec();
  return signJwt(
    {
      iss: sa.client_email,
      sub: sa.client_email,
      aud: "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit",
      iat,
      exp: iat + 3600,
      uid,
      claims,
    },
    sa.private_key,
  );
}

export function employeeUid(companyId: string, docId: string) {
  return `emp_${companyId}_${docId}`.replace(/[^A-Za-z0-9_\-:.]/g, "_").slice(0, 128);
}

// ── Firestore REST ─────────────────────────────────────────────────────────────

type FsValue = Record<string, unknown>;

export function decodeValue(v: FsValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (((v.arrayValue as { values?: FsValue[] }).values) ?? []).map(decodeValue);
  if ("mapValue" in v) return decodeFields(((v.mapValue as { fields?: Record<string, FsValue> }).fields) ?? {});
  return undefined;
}

export function decodeFields(fields: Record<string, FsValue>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) out[k] = decodeValue(v);
  return out;
}

export function encodeValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } };
  return { stringValue: String(v) };
}

export function encodeFields(obj: Record<string, unknown>) {
  const out: Record<string, FsValue> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = encodeValue(v);
  return out;
}

export class Firestore {
  // Calling a stored `fetch` as a method (this.fetchImpl(...)) throws "Illegal invocation"
  // on Cloudflare Workers, so keep it wrapped in a plain closure.
  private fetchImpl: typeof fetch;
  constructor(private sa: ServiceAccount, fetchImpl: typeof fetch = fetch) {
    this.fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => fetchImpl(input, init)) as typeof fetch;
  }

  private get base() {
    return `https://firestore.googleapis.com/v1/projects/${this.sa.project_id}/databases/(default)/documents`;
  }

  private async req(path: string, init: RequestInit = {}) {
    const token = await getAccessToken(this.sa, this.fetchImpl);
    return this.fetchImpl(`${this.base}/${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  }

  async get(path: string): Promise<Record<string, unknown> | null> {
    const res = await this.req(path);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`firestore_get_failed:${res.status}`);
    const doc = (await res.json()) as { fields?: Record<string, FsValue> };
    return decodeFields(doc.fields ?? {});
  }

  async list(collectionPath: string, pageSize = 300): Promise<{ id: string; data: Record<string, unknown> }[]> {
    const out: { id: string; data: Record<string, unknown> }[] = [];
    let pageToken = "";
    for (let i = 0; i < 10; i++) {
      const res = await this.req(`${collectionPath}?pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
      if (!res.ok) throw new Error(`firestore_list_failed:${res.status}`);
      const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, FsValue> }[]; nextPageToken?: string };
      for (const d of body.documents ?? []) out.push({ id: d.name.split("/").pop() as string, data: decodeFields(d.fields ?? {}) });
      if (!body.nextPageToken) break;
      pageToken = body.nextPageToken;
    }
    return out;
  }

  /** Create a document with an auto-generated id; returns the id. */
  async create(collectionPath: string, data: Record<string, unknown>): Promise<string> {
    const res = await this.req(collectionPath, { method: "POST", body: JSON.stringify({ fields: encodeFields(data) }) });
    if (!res.ok) throw new Error(`firestore_create_failed:${res.status}`);
    const doc = (await res.json()) as { name: string };
    return doc.name.split("/").pop() as string;
  }

  /** Run a structured query under a parent document path ("" for root). */
  async runQuery(parentPath: string, structuredQuery: Record<string, unknown>): Promise<{ id: string; data: Record<string, unknown> }[]> {
    const res = await this.req(`${parentPath}:runQuery`, { method: "POST", body: JSON.stringify({ structuredQuery }) });
    if (!res.ok) throw new Error(`firestore_query_failed:${res.status}`);
    const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, FsValue> } }[];
    return rows.filter((r) => r.document).map((r) => ({ id: r.document!.name.split("/").pop() as string, data: decodeFields(r.document!.fields ?? {}) }));
  }

  /** Set (merge=false) or patch specific fields. Fields listed in deleteFields are removed. */
  async patch(path: string, data: Record<string, unknown>, opts: { merge?: boolean; deleteFields?: string[] } = {}) {
    const fieldPaths = [...Object.keys(data), ...(opts.deleteFields ?? [])];
    const mask = opts.merge || opts.deleteFields?.length
      ? fieldPaths.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&")
      : "";
    const res = await this.req(`${path}${mask ? `?${mask}` : ""}`, { method: "PATCH", body: JSON.stringify({ fields: encodeFields(data) }) });
    if (!res.ok) throw new Error(`firestore_patch_failed:${res.status}`);
  }
}

// ── PIN hashing & policy ───────────────────────────────────────────────────────

const PIN_ITER = 100_000;

export async function hashPin(pin: string, saltHex?: string, iter = PIN_ITER): Promise<PinSecret> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter }, key, 256);
  return { pinHash: toHex(bits), pinSalt: toHex(salt), pinIter: iter };
}

export async function verifyPin(pin: string, secret: PinSecret) {
  const h = await hashPin(pin, secret.pinSalt, secret.pinIter || PIN_ITER);
  return timingSafeEqual(h.pinHash, secret.pinHash);
}

const WEAK_PINS = new Set(["1234", "12345", "123456", "1234567", "12345678", "4321", "0000", "1111", "2580", "1212", "5678"]);

/** Returns an error code, or null when the PIN is acceptable. */
export function pinPolicyError(pin: string): string | null {
  if (!/^\d{4,8}$/.test(pin)) return "pin_format";
  if (/^(\d)\1+$/.test(pin) || WEAK_PINS.has(pin)) return "pin_weak";
  return null;
}

export function isWeakPin(pin: string) {
  return pinPolicyError(pin) !== null;
}

// ── Roles ──────────────────────────────────────────────────────────────────────

const PROTECTED_ROLES = new Set(["admin", "branch_supervisor"]);

export function canManagePinOf(actor: SessionClaims, targetRole: string) {
  if (actor.role === "admin") return true;
  if (actor.role === "branch_supervisor") return !PROTECTED_ROLES.has(targetRole);
  return false;
}

// ── Employees ──────────────────────────────────────────────────────────────────

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export function toEmployeeRecord(companyId: string, id: string, data: Record<string, unknown>): EmployeeRecord {
  return {
    docId: id,
    companyId,
    name: String(data.name ?? ""),
    employeeId: String(data.employeeId ?? ""),
    username: data.username ? String(data.username) : undefined,
    role: String(data.role ?? "guest"),
    status: data.status ? String(data.status) : "active",
    permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : undefined,
    branchId: data.branchId ? String(data.branchId) : undefined,
    legacyPin: data.pinCode !== undefined && data.pinCode !== null ? String(data.pinCode) : undefined,
  };
}

export function matchEmployee(list: EmployeeRecord[], login: string) {
  const l = norm(login);
  if (!l) return null;
  const matches = list.filter((e) => norm(e.employeeId) === l || norm(e.username || e.employeeId) === l);
  // Ambiguous logins are rejected rather than guessed.
  return matches.length === 1 ? matches[0] : null;
}

export function publicEmployee(e: EmployeeRecord) {
  return {
    id: e.docId,
    companyId: e.companyId,
    name: e.name,
    employeeId: e.employeeId,
    username: e.username,
    role: e.role,
    status: e.status,
    permissions: e.permissions,
    branchId: e.branchId,
  };
}

export function isValidCompanyId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(id);
}

export function isValidDocId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

// ── Throttling (stored in Firestore, never readable by clients) ───────────────

const WINDOW_SEC = 15 * 60;

export async function checkThrottle(fs: Firestore, keys: { key: string; max: number }[]) {
  for (const { key, max } of keys) {
    const doc = await fs.get(`authThrottle/${key}`);
    if (!doc) continue;
    const lockedUntil = Number(doc.lockedUntil ?? 0);
    if (lockedUntil > nowSec()) return Math.max(1, lockedUntil - nowSec());
    const windowStart = Number(doc.windowStart ?? 0);
    if (windowStart + WINDOW_SEC > nowSec() && Number(doc.failures ?? 0) >= max) return WINDOW_SEC;
  }
  return 0;
}

export async function recordFailure(fs: Firestore, keys: { key: string; max: number }[]) {
  for (const { key, max } of keys) {
    const doc = await fs.get(`authThrottle/${key}`);
    const fresh = !doc || Number(doc.windowStart ?? 0) + WINDOW_SEC <= nowSec();
    const failures = fresh ? 1 : Number(doc!.failures ?? 0) + 1;
    const windowStart = fresh ? nowSec() : Number(doc!.windowStart);
    await fs.patch(`authThrottle/${key}`, {
      failures,
      windowStart,
      lockedUntil: failures >= max ? nowSec() + WINDOW_SEC : 0,
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function clearThrottle(fs: Firestore, key: string) {
  await fs.patch(`authThrottle/${key}`, { failures: 0, windowStart: nowSec(), lockedUntil: 0, updatedAt: new Date().toISOString() });
}

// ── Firebase ID token verification ─────────────────────────────────────────────

let jwksCache: { keys: (JsonWebKey & { kid: string })[]; exp: number } | null = null;

async function getSecureTokenKeys(fetchImpl: typeof fetch) {
  if (jwksCache && jwksCache.exp > nowSec()) return jwksCache.keys;
  const res = await fetchImpl("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!res.ok) throw new Error("jwks_fetch_failed");
  const body = (await res.json()) as { keys: (JsonWebKey & { kid: string })[] };
  jwksCache = { keys: body.keys, exp: nowSec() + 3600 };
  return body.keys;
}

export async function verifyIdToken(idToken: string, projectId: string, fetchImpl: typeof fetch = fetch, keysOverride?: (JsonWebKey & { kid: string })[]) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("bad_token");
  const header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0]))) as { alg: string; kid: string };
  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1]))) as Record<string, unknown>;
  if (header.alg !== "RS256") throw new Error("bad_alg");
  const keys = keysOverride ?? (await getSecureTokenKeys(fetchImpl));
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown_kid");
  const key = await crypto.subtle.importKey("jwk", { ...jwk, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64urlDecode(parts[2]) as BufferSource, enc.encode(`${parts[0]}.${parts[1]}`));
  if (!ok) throw new Error("bad_signature");
  const t = nowSec();
  if (payload.aud !== projectId) throw new Error("bad_aud");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("bad_iss");
  if (typeof payload.exp !== "number" || payload.exp < t) throw new Error("expired");
  if (typeof payload.iat !== "number" || payload.iat > t + 300) throw new Error("bad_iat");
  if (!payload.sub) throw new Error("no_sub");
  return payload;
}

export function claimsFromIdToken(payload: Record<string, unknown>): SessionClaims | null {
  const { companyId, role, eid, employeeId } = payload as Record<string, unknown>;
  if (typeof companyId !== "string" || typeof role !== "string" || typeof eid !== "string") return null;
  return { companyId, role, eid, employeeId: String(employeeId ?? "") };
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function clientIp(request: Request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
}
