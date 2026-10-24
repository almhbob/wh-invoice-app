import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { signInWithCustomToken, signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";

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
  if (Platform.OS === "web") return "";
  return process.env.EXPO_PUBLIC_API_BASE || "https://fotra-dv1.pages.dev";
}

let modePromise: Promise<SecureAuthMode> | null = null;
let resolvedMode: SecureAuthMode = "checking";

function fallbackAuthMode(): SecureAuthMode {
  const localLegacyOptIn = typeof __DEV__ !== "undefined" && __DEV__
    && process.env.EXPO_PUBLIC_ALLOW_LEGACY_AUTH === "true";
  return localLegacyOptIn ? "legacy" : "unavailable";
}

export function getSecureAuthMode(): Promise<SecureAuthMode> {
  if (!modePromise) {
    modePromise = (async () => {
      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = setTimeout(() => controller?.abort(), 6000);
        const res = await fetch(`${apiBase()}/api/auth/status`, { signal: controller?.signal, cache: "no-store" as RequestCache });
        clearTimeout(timer);
        const type = res.headers.get("content-type") || "";
        if (!res.ok || !type.includes("application/json")) return fallbackAuthMode();
        const body = (await res.json()) as { configured?: boolean };
        return body.configured === true ? "secure" : fallbackAuthMode();
      } catch {
        return fallbackAuthMode();
      }
    })().then((m) => {
      resolvedMode = m;
      return m;
    });
  }
  return modePromise;
}

export function currentSecureAuthMode() {
  return resolvedMode;
}

export function useSecureAuthMode(): SecureAuthMode {
  const [mode, setMode] = useState<SecureAuthMode>(resolvedMode);
  useEffect(() => {
    let alive = true;
    getSecureAuthMode().then((m) => alive && setMode(m));
    return () => { alive = false; };
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

export async function secureLogout() {
  try { await signOut(auth); } catch {}
}

/** Claims of the signed-in Firebase user (null when anonymous / signed out). */
export async function readSessionClaims(): Promise<{ companyId: string; role: string; eid: string } | null> {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || user.isAnonymous) return null;
  const res = await user.getIdTokenResult();
  const { companyId, role, eid } = res.claims as Record<string, unknown>;
  if (typeof companyId !== "string" || typeof role !== "string" || typeof eid !== "string") return null;
  return { companyId, role, eid };
}

/** Client-side mirror of the server PIN policy, for instant feedback. */
export function localPinError(pin: string): "pin_format" | "pin_weak" | null {
  if (!/^\d{4,8}$/.test(pin)) return "pin_format";
  const weak = ["1234", "12345", "123456", "1234567", "12345678", "4321", "0000", "1111", "2580", "1212", "5678"];
  if (/^(\d)\1+$/.test(pin) || weak.includes(pin)) return "pin_weak";
  return null;
}
