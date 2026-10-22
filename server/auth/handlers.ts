import {
  AuthEnv,
  canManagePinOf,
  checkThrottle,
  claimsFromIdToken,
  clearThrottle,
  clientIp,
  createCustomToken,
  employeeUid,
  EmployeeRecord,
  Firestore,
  hashPin,
  isValidCompanyId,
  isValidDocId,
  isWeakPin,
  json,
  matchEmployee,
  PinSecret,
  pinPolicyError,
  publicEmployee,
  readJson,
  readServiceAccount,
  recordFailure,
  ServiceAccount,
  sha256Hex,
  toEmployeeRecord,
  verifyIdToken,
  verifyPin,
} from "./core";

export interface Deps {
  fetchImpl?: typeof fetch;
  /** Test hook: JWKS keys used to verify ID tokens. */
  jwks?: (JsonWebKey & { kid: string })[];
}

const DISABLED_PREFIX = "!migrated-";

function randomHex(n = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
}

function legacyPinOf(e: EmployeeRecord): string | null {
  // Employees created after the secure rollout have no plaintext PIN at all: they need a PIN set via /set-pin.
  if (e.legacyPin === undefined || e.legacyPin === "") return null;
  if (e.legacyPin.startsWith(DISABLED_PREFIX)) return null;
  return e.legacyPin;
}

function timingSafe(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function readSecret(fs: Firestore, companyId: string, docId: string): Promise<PinSecret | null> {
  const s = await fs.get(`companies/${companyId}/employeeSecrets/${docId}`);
  if (!s || !s.pinHash || !s.pinSalt) return null;
  return { pinHash: String(s.pinHash), pinSalt: String(s.pinSalt), pinIter: Number(s.pinIter || 100000), mustChange: Boolean(s.mustChange) };
}

async function writeSecret(fs: Firestore, companyId: string, docId: string, pin: string, mustChange: boolean, by: string) {
  const secret = await hashPin(pin);
  await fs.patch(`companies/${companyId}/employeeSecrets/${docId}`, {
    ...secret,
    mustChange,
    updatedAt: new Date().toISOString(),
    updatedBy: by,
  });
  // Neutralise any legacy plaintext PIN so old clients can never match it again.
  await fs.patch(`companies/${companyId}/employees/${docId}`, { pinCode: `${DISABLED_PREFIX}${randomHex()}` }, { merge: true });
}

/** Verify a PIN for an employee; transparently migrates legacy plaintext PINs to hashes. */
async function checkPin(fs: Firestore, e: EmployeeRecord, pin: string): Promise<{ ok: boolean; mustChange: boolean }> {
  const secret = await readSecret(fs, e.companyId, e.docId);
  if (secret) {
    const ok = await verifyPin(pin, secret);
    return { ok, mustChange: ok && Boolean(secret.mustChange || isWeakPin(pin)) };
  }
  const legacy = legacyPinOf(e);
  if (legacy === null || !timingSafe(pin, legacy)) return { ok: false, mustChange: false };
  const mustChange = isWeakPin(pin);
  await writeSecret(fs, e.companyId, e.docId, pin, mustChange, "migration");
  return { ok: true, mustChange };
}

function notConfigured() {
  return json({ error: "not_configured" }, 503);
}

// ── GET /api/auth/status ───────────────────────────────────────────────────────

export function handleStatus(env: AuthEnv) {
  const sa = readServiceAccount(env);
  return json({ configured: Boolean(sa), projectId: sa?.project_id ?? null });
}

// ── POST /api/auth/login ───────────────────────────────────────────────────────

export async function handleLogin(request: Request, env: AuthEnv, deps: Deps = {}) {
  const sa = readServiceAccount(env);
  if (!sa) return notConfigured();

  const body = await readJson<{ companyId?: unknown; login?: unknown; pin?: unknown }>(request);
  const companyId = body?.companyId;
  const login = typeof body?.login === "string" ? body.login.trim() : "";
  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  if (!isValidCompanyId(companyId) || !login || login.length > 80 || !pin || pin.length > 32) {
    return json({ error: "bad_request" }, 400);
  }

  const fs = new Firestore(sa, deps.fetchImpl);
  const loginKey = await sha256Hex(`login|${companyId}|${login.toLowerCase()}`);
  const ipKey = await sha256Hex(`ip|${clientIp(request)}`);
  const keys = [{ key: loginKey, max: 8 }, { key: ipKey, max: 40 }];

  try {
    const wait = await checkThrottle(fs, keys);
    if (wait > 0) return json({ error: "locked", retryAfter: wait }, 429, { "Retry-After": String(wait) });

    const docs = await fs.list(`companies/${companyId}/employees`);
    const employees = docs.map((d) => toEmployeeRecord(companyId, d.id, d.data));
    const emp = matchEmployee(employees, login);

    const result = emp && emp.status !== "suspended" ? await checkPin(fs, emp, pin) : { ok: false, mustChange: false };
    if (!emp || !result.ok) {
      await recordFailure(fs, keys);
      return json({ error: "invalid_credentials" }, 401);
    }

    await clearThrottle(fs, loginKey);
    const claims = { companyId, role: emp.role, eid: emp.docId, employeeId: emp.employeeId };
    const token = await createCustomToken(sa, employeeUid(companyId, emp.docId), claims);
    await fs.patch(`companies/${companyId}/employees/${emp.docId}`, { lastLoginAt: new Date().toISOString() }, { merge: true });

    return json({ token, employee: publicEmployee(emp), mustChangePin: result.mustChange });
  } catch (err) {
    console.error("login_error", err instanceof Error ? err.message : err);
    return json({ error: "server_error" }, 500);
  }
}

// ── POST /api/auth/set-pin ─────────────────────────────────────────────────────

async function actorFrom(request: Request, sa: ServiceAccount, deps: Deps) {
  const auth = request.headers.get("Authorization") || "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!idToken) return null;
  try {
    const payload = await verifyIdToken(idToken, sa.project_id, deps.fetchImpl, deps.jwks);
    return claimsFromIdToken(payload);
  } catch {
    return null;
  }
}

export async function handleSetPin(request: Request, env: AuthEnv, deps: Deps = {}) {
  const sa = readServiceAccount(env);
  if (!sa) return notConfigured();

  const actor = await actorFrom(request, sa, deps);
  if (!actor) return json({ error: "unauthenticated" }, 401);

  const body = await readJson<{ employeeDocId?: unknown; newPin?: unknown; currentPin?: unknown }>(request);
  const targetId = body?.employeeDocId === undefined ? actor.eid : body.employeeDocId;
  const newPin = typeof body?.newPin === "string" ? body.newPin.trim() : "";
  const currentPin = typeof body?.currentPin === "string" ? body.currentPin.trim() : "";
  if (!isValidDocId(targetId)) return json({ error: "bad_request" }, 400);

  const policy = pinPolicyError(newPin);
  if (policy) return json({ error: policy }, 400);

  const fs = new Firestore(sa, deps.fetchImpl);
  try {
    const doc = await fs.get(`companies/${actor.companyId}/employees/${targetId}`);
    if (!doc) return json({ error: "not_found" }, 404);
    const target = toEmployeeRecord(actor.companyId, targetId, doc);
    const isSelf = targetId === actor.eid;

    if (isSelf) {
      const check = currentPin ? await checkPin(fs, target, currentPin) : { ok: false };
      if (!check.ok) return json({ error: "invalid_current_pin" }, 403);
      if (currentPin === newPin) return json({ error: "pin_same" }, 400);
    } else if (!canManagePinOf(actor, target.role)) {
      return json({ error: "forbidden" }, 403);
    }

    // A PIN set by a manager is temporary: the employee must choose their own at next login.
    await writeSecret(fs, actor.companyId, targetId, newPin, !isSelf, actor.eid);
    return json({ ok: true });
  } catch (err) {
    console.error("set_pin_error", err instanceof Error ? err.message : err);
    return json({ error: "server_error" }, 500);
  }
}
