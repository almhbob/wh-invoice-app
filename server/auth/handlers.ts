import {
  AuthEnv,
  getAccessToken,
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
import { BOOTSTRAP_ACCOUNTS } from "./bootstrap";

export interface Deps {
  fetchImpl?: typeof fetch;
  /** Test hook: JWKS keys used to verify ID tokens. */
  jwks?: (JsonWebKey & { kid: string })[];
}

const DISABLED_PREFIX = "!migrated-";
const PLATFORM_ROLES = new Set(["owner", "developer", "super_admin"]);

async function signedClaims(fs: Firestore, employee: EmployeeRecord) {
  const markerId = `${employee.companyId}__${employee.docId}`;
  const marker = await fs.get(`platformOwners/${markerId}`);
  const platformRole = marker?.active === true && PLATFORM_ROLES.has(String(marker.platformRole))
    ? marker.platformRole as "owner" | "developer" | "super_admin"
    : undefined;
  return {
    companyId: employee.companyId,
    role: employee.role,
    eid: employee.docId,
    employeeId: employee.employeeId,
    ...(platformRole ? { platformRole } : {}),
  };
}

function randomHex(n = 16) {
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, "0")).join("");
}

const SECURE_ACCOUNTS_SINCE = "2026-10-22T00:00:00.000Z";

function legacyPinOf(e: EmployeeRecord): string | null {
  // The old app treated a missing PIN as "1234". Such accounts keep working once,
  // but 1234 is weak so the employee is forced to choose a new PIN right away.
  if (e.legacyPin === undefined || e.legacyPin === "") {
    // Accounts created after secure sign-in shipped always get a server-side PIN;
    // one without it is incomplete and must not fall back to a guessable default.
    if (e.createdAt && e.createdAt >= SECURE_ACCOUNTS_SINCE) return null;
    return "1234";
  }
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

export async function handleStatus(env: AuthEnv, request?: Request, deps: Deps = {}) {
  const sa = readServiceAccount(env);
  const base = { configured: Boolean(sa), projectId: sa?.project_id ?? null };
  if (!sa || !request || new URL(request.url).searchParams.get("check") !== "1") return json(base);
  // Health check: reports only coarse stage codes, never key material.
  const stage = async (fn: () => Promise<unknown>) => {
    try { await fn(); return "ok"; } catch (e) { return (e instanceof Error ? e.message : String(e)).slice(0, 80); }
  };
  const fs = new Firestore(sa, deps.fetchImpl);
  const token = await stage(() => getAccessToken(sa, deps.fetchImpl));
  const read = token === "ok" ? await stage(() => fs.get("companies/laviviane-trial")) : "skipped";
  return json({ ...base, clientEmailDomain: sa.client_email.split("@")[1] ?? null, token, firestore: read });
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
    let emp = matchEmployee(employees, login);

    // Owner account that only existed in the old app code: create it once with the private setup code.
    if (!emp) {
      const boot = (BOOTSTRAP_ACCOUNTS[companyId] ?? []).find((b) => [b.employeeId.toLowerCase(), b.username].includes(login.toLowerCase()));
      const taken = boot && employees.some((e) => e.employeeId.toLowerCase() === boot.employeeId.toLowerCase());
      if (boot && !taken && (await sha256Hex(`${boot.salt}|${pin}`)) === boot.codeHash) {
        const now = new Date().toISOString();
        const id = await fs.create(`companies/${companyId}/employees`, {
          name: boot.name, employeeId: boot.employeeId, username: boot.username, role: boot.role, status: "active",
          companyId, permissions: ["*"], createdAt: now, createdBy: "bootstrap",
        });
        await writeSecret(fs, companyId, id, pin, true, "bootstrap");
        emp = { docId: id, companyId, name: boot.name, employeeId: boot.employeeId, username: boot.username, role: boot.role, status: "active", permissions: ["*"] };
        await clearThrottle(fs, loginKey);
        const bootEmployee: EmployeeRecord = {
          docId: id, companyId, name: boot.name, employeeId: boot.employeeId,
          username: boot.username, role: boot.role, status: "active",
        };
        const token = await createCustomToken(sa, employeeUid(companyId, id), await signedClaims(fs, bootEmployee));
        return json({ token, employee: publicEmployee(emp), mustChangePin: true });
      }
    }

    const result = emp && emp.status !== "suspended" ? await checkPin(fs, emp, pin) : { ok: false, mustChange: false };
    if (!emp || !result.ok) {
      await recordFailure(fs, keys);
      return json({ error: "invalid_credentials" }, 401);
    }

    await clearThrottle(fs, loginKey);
    const token = await createCustomToken(sa, employeeUid(companyId, emp.docId), await signedClaims(fs, emp));
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

async function activeActorRecord(fs: Firestore, actor: NonNullable<Awaited<ReturnType<typeof actorFrom>>>) {
  if (!isValidCompanyId(actor.companyId) || !isValidDocId(actor.eid)) return null;
  const doc = await fs.get(`companies/${actor.companyId}/employees/${actor.eid}`);
  if (!doc) return null;
  const current = toEmployeeRecord(actor.companyId, actor.eid, doc);
  if (current.status === "suspended" || current.role !== actor.role) return null;
  return current;
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
    const liveActor = await activeActorRecord(fs, actor);
    if (!liveActor) return json({ error: "forbidden" }, 403);

    const doc = await fs.get(`companies/${actor.companyId}/employees/${targetId}`);
    if (!doc) return json({ error: "not_found" }, 404);
    const target = toEmployeeRecord(actor.companyId, targetId, doc);
    const isSelf = targetId === actor.eid;

    if (isSelf) {
      const check = currentPin ? await checkPin(fs, target, currentPin) : { ok: false };
      if (!check.ok) return json({ error: "invalid_current_pin" }, 403);
      if (currentPin === newPin) return json({ error: "pin_same" }, 400);
    } else {
      const platformOwner = await fs.get(`platformOwners/${actor.companyId}__${targetId}`);
      if (platformOwner?.active === true || !canManagePinOf(actor, target.role)) {
        return json({ error: "forbidden" }, 403);
      }
    }

    // A PIN set by a manager is temporary: the employee must choose their own at next login.
    await writeSecret(fs, actor.companyId, targetId, newPin, !isSelf, actor.eid);
    return json({ ok: true });
  } catch (err) {
    console.error("set_pin_error", err instanceof Error ? err.message : err);
    return json({ error: "server_error" }, 500);
  }
}

// ── POST /api/auth/reset-pin ────────────────────────────────────────────────────

/** A company admin assigns a temporary employee PIN; the employee must change it at next login. */
export async function handleResetPin(request: Request, env: AuthEnv, deps: Deps = {}) {
  const sa = readServiceAccount(env);
  if (!sa) return notConfigured();

  const actor = await actorFrom(request, sa, deps);
  if (!actor) return json({ error: "unauthenticated" }, 401);
  if (actor.role !== "admin") return json({ error: "forbidden" }, 403);

  const body = await readJson<{ employeeDocId?: unknown; newPin?: unknown }>(request);
  const targetId = body?.employeeDocId;
  const newPin = typeof body?.newPin === "string" ? body.newPin.trim() : "";
  if (!isValidDocId(targetId) || !newPin) return json({ error: "bad_request" }, 400);

  const policy = pinPolicyError(newPin);
  if (policy) return json({ error: policy }, 400);

  const fs = new Firestore(sa, deps.fetchImpl);
  try {
    const liveActor = await activeActorRecord(fs, actor);
    if (!liveActor || liveActor.role !== "admin") return json({ error: "forbidden" }, 403);
    if (targetId === actor.eid) return json({ error: "forbidden" }, 403);

    // The target path is always derived from the signed-in admin's company claim.
    const doc = await fs.get(`companies/${actor.companyId}/employees/${targetId}`);
    if (!doc) return json({ error: "not_found" }, 404);
    const platformOwner = await fs.get(`platformOwners/${actor.companyId}__${targetId}`);
    if (platformOwner?.active === true) return json({ error: "forbidden" }, 403);

    await writeSecret(fs, actor.companyId, targetId, newPin, true, actor.eid);
    return json({ ok: true, mustChangePin: true });
  } catch (err) {
    console.error("reset_pin_error", err instanceof Error ? err.message : err);
    return json({ error: "server_error" }, 500);
  }
}
