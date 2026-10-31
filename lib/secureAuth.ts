import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { signInWithCustomToken, signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { resolveApiBase } from "@/lib/apiBase";

/**
 * Secure (server-verified) login.
 *
 * When the Cloudflare function /api/auth/* is configured with a Firebase service
 * account, PINs are verified on the server and the app signs into Firebase with a
 * custom token whose claims (companyId, role, eid) are enforced by Firestore rules.
 * Production fails closed if that endpoint is unavailable or unconfigured. The
 * legacy client-side flow is available only through an explicit non-production opt-in.
 */

export type SecureAuthMode = "checking" | "secure" | "legacy" | "unavailable";

export interface SecureEmployee {
  id: string;
  companyId: string;
  name: string;
  employeeId: string;
  username?: string;
  role: string;
  status?: string;
  permissions?: string[];
  branchId?: string;
}

export type SecureAuthError =
  | "invalid_credentials"
  | "locked"
  | "not_configured"
  | "network"
  | "server_error"
  | "pin_format"
  | "pin_weak"
  | "pin_same"
  | "invalid_current_pin"
  | "forbidden"
  | "unauthenticated"
  | "not_found"
  | "bad_request";

export class SecureAuthFailure extends Error {
  constructor(public code: SecureAuthError, public retryAfter?: number) {
    super(code);
  }
}

function apiBase() {
  return resolveApiBase({
    platform: Platform.OS,
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    apiBase: process.env.EXPO_PUBLIC_API_BASE,
    legacyApiUrl: process.env.EXPO_PUBLIC_API_URL,
    webOrigin: typeof window !== "undefined" ? window.location.origin : "",
  });
}

let modePromise: Promise<SecureAuthMode> | null = null;
let resolvedMode: SecureAuthMode = "checking";
const modeListeners = new Set<(m: SecureAuthMode) => void>();

function setResolvedMode(m: SecureAuthMode) {
  resolvedMode = m;
  modeListeners.forEach((fn) => fn(m));
}

function fallbackAuthMode(): SecureAuthMode {
  const localLegacyOptIn = typeof __DEV__ !== "undefined" && __DEV__
    && process.env.EXPO_PUBLIC_ALLOW_LEGACY_AUTH === "true";
  return localLegacyOptIn ? "legacy" : "unavailable";
}

type StatusResult = "secure" | "not_configured" | "unreachable";

async function fetchStatusOnce(timeoutMs: number): Promise<StatusResult> {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBase()}/api/auth/status`, { signal: controller?.signal, cache: "no-store" as RequestCache });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("application/json")) return "unreachable";
    const body = (await res.json()) as { configured?: boolean };
    return body.configured === true ? "secure" : "not_configured";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

const STATUS_ATTEMPTS_MS = [6000, 9000, 12000];

/**
 * A phone on a weak connection (or inside WhatsApp's in-app browser) can miss the
 * first status check. Retry a few times before failing closed, and never cache a
 * failure: the next call (e.g. the "retry" button, or coming back online) checks again.
 */
export function getSecureAuthMode(): Promise<SecureAuthMode> {
  if (!modePromise) {
    const attempt = (async (): Promise<SecureAuthMode> => {
      for (let i = 0; i < STATUS_ATTEMPTS_MS.length; i++) {
        const r = await fetchStatusOnce(STATUS_ATTEMPTS_MS[i]);
        if (r === "secure") return "secure";
        if (r === "not_configured") return fallbackAuthMode();
        if (i < STATUS_ATTEMPTS_MS.length - 1) await new Promise((ok) => setTimeout(ok, 800 * (i + 1)));
      }
      return fallbackAuthMode();
    })();
    modePromise = attempt.then((m) => {
      if (m === "unavailable") modePromise = null;
      setResolvedMode(m);
      return m;
    });
  }
  return modePromise;
}

/** Check again now (retry button / back online). */
export function recheckSecureAuthMode(): Promise<SecureAuthMode> {
  if (resolvedMode !== "secure") {
    modePromise = null;
    setResolvedMode("checking");
  }
  return getSecureAuthMode();
}

export function currentSecureAuthMode() {
  return resolvedMode;
}

export function useSecureAuthMode(): SecureAuthMode {
  const [mode, setMode] = useState<SecureAuthMode>(resolvedMode);
  useEffect(() => {
    let alive = true;
    const fn = (m: SecureAuthMode) => { if (alive) setMode(m); };
    modeListeners.add(fn);
    getSecureAuthMode().then(fn);
    const onOnline = () => { if (resolvedMode === "unavailable") void recheckSecureAuthMode(); };
    if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("online", onOnline);
    return () => {
      alive = false;
      modeListeners.delete(fn);
      if (typeof window !== "undefined" && window.removeEventListener) window.removeEventListener("online", onOnline);
    };
  }, []);
  return mode;
}

async function post<T>(path: string, body: unknown, withAuth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withAuth) {
    const user = auth.currentUser;
    if (!user || user.isAnonymous) throw new SecureAuthFailure("unauthenticated");
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  } catch {
    throw new SecureAuthFailure("network");
  }
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    throw new SecureAuthFailure((data.error as SecureAuthError) || "server_error", Number(data.retryAfter) || undefined);
  }
  return data as T;
}

export async function secureLogin(companyId: string, login: string, pin: string) {
  const data = await post<{ token: string; employee: SecureEmployee; mustChangePin: boolean }>(
    "/api/auth/login",
    { companyId, login, pin },
  );
  await signInWithCustomToken(auth, data.token);
  return { employee: data.employee, mustChangePin: Boolean(data.mustChangePin) };
}

export async function secureSetPin(params: { newPin: string; currentPin?: string; employeeDocId?: string }) {
  await post<{ ok: true }>("/api/auth/set-pin", params, true);
}

/** Company-admin-only reset; the employee is forced to choose a new PIN at next login. */
export async function secureResetEmployeePin(params: { employeeDocId: string; newPin: string }) {
  await post<{ ok: true; mustChangePin: true }>("/api/auth/reset-pin", params, true);
}

export async function secureLogout() {
  try { await signOut(auth); } catch {}
}

/** Claims of the signed-in Firebase user (null when anonymous / signed out). */
export async function readSessionClaims(): Promise<{ companyId: string; role: string; eid: string; platformRole?: string } | null> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  const res = await user.getIdTokenResult();
  const { companyId, role, eid, platformRole } = res.claims as Record<string, unknown>;
  if (typeof companyId !== "string" || typeof role !== "string" || typeof eid !== "string") return null;
  return { companyId, role, eid, ...(typeof platformRole === "string" ? { platformRole } : {}) };
}

/** Client-side mirror of the server PIN policy, for instant feedback. */
export function localPinError(pin: string): "pin_format" | "pin_weak" | null {
  if (!/^\d{4,8}$/.test(pin)) return "pin_format";
  const weak = ["1234", "12345", "123456", "1234567", "12345678", "4321", "0000", "1111", "2580", "1212", "5678"];
  if (/^(\d)\1+$/.test(pin) || weak.includes(pin)) return "pin_weak";
  return null;
}
